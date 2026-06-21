import { useState, useEffect, useCallback } from 'react';
import { fetchKanbanTickets, updateTicketStatus, KANBAN_STATUSES, } from '../../../services/ticketService';
import { fetchKanbanSettings, extractColors } from '../../../services/backend/kanbanSettingsService';
import { fetchAllLanguages, fetchLanguage, } from '../../../services/backend/kanbanLanguageService';
import { Legacy } from '../../../api/glpiClient';

import KanbanColumn from '../../../components/KanbanColumn';
import TicketDetail from './TicketDetail';
import CreateTicket from './CreateTicket';
import '../../../components/kanban.css';
import { saveTicketStatusHistory } from '../../../services/backend/ticketService';
import { fetchLastActiveCost, saveCost, cancelLastActiveCost, fetchBaseForMode, saveReopen } from '../../../services/backend/superCostService';
import { saveTicketItems } from '../../../services/backend/ticketItemService';

export default function KanbanPage() {
  const [columns, setColumns] = useState({ 1: [], 2: [], 5: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [costTicket, setCostTicket] = useState(null);
  const [superCost, setSuperCost] = useState('');
  const [reopenPercent, setReopenPercent] = useState('');
  const [reopenMode, setReopenMode] = useState(1);

  // Settings depuis SQLite
  const [colors, setColors] = useState({ 1: '#3b82f6', 2: '#f59e0b', 5: '#16a34a' });
  const [labels, setLabels] = useState({ 1: 'Nouveau', 2: 'En cours', 5: 'Résolu' });
  const [languages, setLanguages] = useState(['fr']);
  const [currentLang, setCurrentLang] = useState('fr');

  const statusesWithLabels = KANBAN_STATUSES.map((s) => ({
    ...s,
    label: labels[s.id] ?? s.label, // ← remplace par la traduction
  }));


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketData, settings, allLanguages] = await Promise.all([
        fetchKanbanTickets(),
        fetchKanbanSettings().catch(() => ({})),
        fetchAllLanguages().catch(() => ({ fr: { 1: 'Nouveau', 2: 'En cours', 5: 'Résolu' } })),
      ]);

      setColumns(ticketData);
      setColors(extractColors(settings));

      const codes = Object.keys(allLanguages);
      setLanguages(codes.length > 0 ? codes : ['fr']);

      // Labels de la langue courante
      const currentLabels = allLanguages[currentLang]
        ?? allLanguages['fr']
        ?? { 1: 'Nouveau', 2: 'En cours', 5: 'Résolu' };
      setLabels(currentLabels);

    } catch (err) {
      console.error('Erreur load:', err);
      setError('Impossible de charger les tickets.');
    } finally {
      setLoading(false);
    }
  }, [currentLang]);

  useEffect(() => { load(); }, [load]);

  const handleLangChange = async (lang) => {
    setCurrentLang(lang);
    try {
      const labels = await fetchLanguage(lang);
      setLabels(labels);
    } catch {
      // garder les labels actuels si erreur
    }
  };

  useEffect(() => { load(); }, [load]);

  const handleDragStart = (e, ticket) => {
    setDragging(ticket);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };


  // Mise à jour optimiste de l'UI (pas d'appel API)
  function moveTicketOptimistic(columns, ticket, oldStatusId, newStatusId) {
    return {
      ...columns,
      [oldStatusId]: columns[oldStatusId].filter((t) => t.id !== ticket.id),
      [newStatusId]: [
        ...(columns[newStatusId] ?? []),
        { ...ticket, status: newStatusId },
      ],
    };
  }

  // Rollback si l'API échoue
  function rollbackTicket(columns, ticket, oldStatusId, newStatusId) {
    return {
      ...columns,
      [newStatusId]: columns[newStatusId].filter((t) => t.id !== ticket.id),
      [oldStatusId]: [
        ...(columns[oldStatusId] ?? []),
        ticket,
      ],
    };
  }
  const handleDrop = async (e, newStatusId) => {
    e.preventDefault();
    if (!dragging || dragging.status === newStatusId) {
      setDragging(null);
      return;
    }
    const oldStatusId = dragging.status;

    // If moving FROM status 5 (resolved)
    if (oldStatusId === 5) {
      setCostTicket(dragging);
      // Load last active cost to get existing reopening_pct
      fetchLastActiveCost(dragging.id).then(lastActive => {
        if (lastActive && lastActive.reopening_pct !== null && lastActive.reopening_pct !== undefined) {
          setReopenPercent(String(lastActive.reopening_pct));
        }
      }).catch(err => console.error('Error loading last active cost:', err));
      setShowReopenModal(true);
      setDragging(null);
      return;
    }

    // Proceed with optimistic update
    setColumns((prev) => moveTicketOptimistic(prev, dragging, oldStatusId, newStatusId));
    setDragging(null);
    try {
      await updateTicketStatus(dragging.id, newStatusId);
      await saveTicketStatusHistory({
        ticketId: dragging.id,
        ticketName: dragging.name,
        oldStatus: oldStatusId,
        newStatus: newStatusId,
      });

      if (newStatusId === 5) {
        setCostTicket(dragging);
        setShowCostModal(true);
      }
    } catch {
      setColumns((prev) => rollbackTicket(prev, dragging, oldStatusId, newStatusId));
      alert('Erreur lors du changement de statut.');
    }
  };

  const handleCancel = async () => {
    const ticket = costTicket;
    const oldStatusId = 5;
    const newStatusId = 2; // En cours
    setShowReopenModal(false);

    try {
      await cancelLastActiveCost(ticket.id);
      await updateTicketStatus(ticket.id, newStatusId);
      await saveTicketStatusHistory({
        ticketId: ticket.id,
        ticketName: ticket.name,
        oldStatus: oldStatusId,
        newStatus: newStatusId,
      });
      // Reload to reflect changes
      load();
    } catch {
      alert('Erreur lors de l\'annulation.');
    } finally {
      setCostTicket(null);
      setReopenPercent('');
    }
  };

  const handleReopen = async () => {
    const pct = parseFloat(reopenPercent);
    if (!reopenPercent || isNaN(pct) || pct < 0 || pct > 100) {
      alert('Veuillez entrer un pourcentage de réouverture valide (0-100).');
      return;
    }

    const ticket = costTicket;
    const oldStatusId = 5;
    const newStatusId = 2;
    setShowReopenModal(false);

    try {
      const base = await fetchBaseForMode(ticket.id, reopenMode);
      const amount = (pct / 100) * base;
      await saveReopen(ticket.id, amount, pct, reopenMode);
      await updateTicketStatus(ticket.id, newStatusId);
      await saveTicketStatusHistory({
        ticketId: ticket.id,
        ticketName: ticket.name,
        oldStatus: oldStatusId,
        newStatus: newStatusId,
      });
      load();
    } catch {
      alert('Erreur lors de la réouverture.');
    } finally {
      setCostTicket(null);
      setReopenPercent('');
      setReopenMode(1);
    }
  };

  const handleSaveCost = async () => {
    if (!superCost || isNaN(parseFloat(superCost))) {
      alert('Veuillez entrer un coût valide.');
      return;
    }

    try {
      const amount = parseFloat(superCost);
      await saveCost(costTicket.id, amount);

      // Sync ticket items
      try {
        const itemsResponse = await Legacy.get('/Item_Ticket', { 'searchText[tickets_id]': costTicket.id });
        const items = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
        const formattedItems = items.map(item => ({
          item_id: item.items_id,
          itemtype: item.itemtype
        }));
        await saveTicketItems(costTicket.id, formattedItems);
      } catch (err) {
        console.error('Error syncing ticket items:', err);
      }

      setShowCostModal(false);
      setCostTicket(null);
      setSuperCost('');
    } catch {
      alert('Erreur lors de la sauvegarde du coût.');
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    load(); // Rafraîchit le Kanban après fermeture
  };

  if (loading) return <p className="kanban-loading">Chargement du Kanban...</p>;
  if (error) return <p className="kanban-error">{error}</p>;

  return (
    <div className="kanban-page">

      {/* Header */}
      <div className="kanban-header">
        <h1 className="kanban-title">Tickets — Vue Kanban</h1>

        {/* Sélecteur de langue */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: '#6b7280' }}>Langue :</label>
          <select
            value={currentLang}
            onChange={(e) => handleLangChange(e.target.value)}
            style={{
              padding: '5px 10px', borderRadius: 7,
              border: '1px solid #d1d5db', fontSize: 13,
              background: '#fff', cursor: 'pointer',
            }}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang === 'fr' ? '🇫🇷 Français'
                  : lang === 'mg' ? '🇲🇬 Malagasy'
                    : lang === 'en' ? '🇬🇧 English'
                      : lang}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Board */}
      <div className="kanban-board">
        {statusesWithLabels.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tickets={columns[status.id] ?? []}
            color={colors[status.id]}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onCardClick={setSelectedTicket}
            onAdd={status.id === 1 ? () => setShowAddModal(true) : undefined}
          />
        ))}
      </div>

      {/* Modal Ajouter ticket */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseAddModal}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-header-title">Nouveau ticket</h2>
              <button className="modal-close-btn" onClick={handleCloseAddModal}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <CreateTicket onSuccess={handleCloseAddModal} />
            </div>
          </div>
        </div>
      )}

      {/* Modal Détail ticket */}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          statusLabels={labels}
        />
      )}

      {/* Modal Coût */}
      {showCostModal && costTicket && (
        <div className="modal-overlay" onClick={() => setShowCostModal(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-header-title">Coût du ticket</h2>
              <button className="modal-close-btn" onClick={() => setShowCostModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ marginBottom: 16 }}>Ticket : {costTicket.name}</p>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Super Coût</label>
                <input
                  type="number"
                  value={superCost}
                  onChange={(e) => setSuperCost(e.target.value)}
                  placeholder="Entrez le coût"
                  style={{
                    width: '100%', padding: '8px 12px',
                    border: '1px solid #d1d5db', borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSaveCost}
                  style={{
                    padding: '8px 16px', background: '#2563eb', color: '#fff',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14
                  }}
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Réouverture */}
      {showReopenModal && costTicket && (
        <div className="modal-overlay" onClick={() => setShowReopenModal(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-header-title">Réouverture du ticket</h2>
              <button className="modal-close-btn" onClick={() => setShowReopenModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ marginBottom: 16 }}>Ticket : {costTicket.name}</p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Base de calcul</label>
                <select
                  value={reopenMode}
                  onChange={(e) => setReopenMode(parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                >
                  <option value={1}>1 — Dernier coût</option>
                  <option value={2}>2 — Premier coût</option>
                  <option value={3}>3 — Moyenne des coûts</option>
                  <option value={4}>4 — Total des coûts</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Pourcentage de réouverture (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={reopenPercent}
                  onChange={(e) => setReopenPercent(e.target.value)}
                  placeholder="Entrez le pourcentage"
                  style={{
                    width: '100%', padding: '8px 12px',
                    border: '1px solid #d1d5db', borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '8px 16px', background: '#ef4444', color: '#fff',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleReopen}
                  style={{
                    padding: '8px 16px', background: '#f59e0b', color: '#fff',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14
                  }}
                >
                  Réouvrir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}