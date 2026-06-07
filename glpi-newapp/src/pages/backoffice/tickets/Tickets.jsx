import { useState, useEffect } from 'react';
import { fetchTickets, fetchTicketDetails } from '../../../services/ticketService';
import './Tickets.css';

const STATUS_LABELS = {
  1: 'Nouveau',
  2: 'En cours (attribué)',
  3: 'En cours (planifié)',
  4: 'En attente',
  5: 'Résolu',
  6: 'Clos',
};

const TYPE_LABELS = {
  1: 'Incident',
  2: 'Demande',
};

const PRIORITY_LEVELS = [
  { value: 1, label: 'Très basse' },
  { value: 2, label: 'Basse' },
  { value: 3, label: 'Moyenne' },
  { value: 4, label: 'Haute' },
  { value: 5, label: 'Très haute' },
  { value: 6, label: 'Majeure' },
];


export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await fetchTickets();
      setTickets(data);
    } catch (error) {
      console.error("Erreur chargement tickets", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (ticketId) => {
    setDetailLoading(true);
    try {
      const details = await fetchTicketDetails(ticketId);
      console.log('DETAILS TICKET:', details); // Debug
      setSelectedTicket(details);
    } catch (error) {
      console.error("Erreur chargement détails", error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Helper pour extraire l'ID du statut qu'il soit un objet ou un nombre
  const getStatusId = (status) => {
    if (!status) return 1;
    if (typeof status === 'object') return status.id;
    return parseInt(status);
  };

  // Helper pour extraire le nom d'un élément (peut être un objet ou une string)
  const getItemName = (item) => {
    if (!item) return 'Inconnu';
    if (typeof item === 'object') return item.name || item.completename || 'Élément';
    return item;
  };

  return (
    <div className="tickets-container">
      {/* ── Liste des Tickets ── */}
      <div className={`tickets-list-panel ${selectedTicket ? 'minimized' : 'full-width'}`}>
        <div className="panel-header">
          <h2>Tickets</h2>
          <button onClick={loadTickets} className="refresh-btn">
            Rafraîchir
          </button>
        </div>

        <div className="table-wrapper">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Titre</th>
                <th>Priorite</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="loading-container">Chargement des tickets...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={5} className="loading-container">Aucun ticket trouvé</td></tr>
              ) : (
                tickets.map((t) => {
                  const statusId = getStatusId(t.status);
                  
                  return (
                    <tr key={t.id} className={selectedTicket?.id === t.id ? 'active-row' : ''}>
                      <td className="ticket-id">#{t.id}</td>
                      <td className="ticket-name">{t.name}</td>
                      <td style={{ fontWeight: 500 }}>{PRIORITY_LEVELS.find(p => p.value === t.priority)?.label || 'Inconnu'} ({t.priority})</td>
                      <td>
                        <span className={`status-badge status-${statusId}`}>
                          {STATUS_LABELS[statusId] || 'Inconnu'}
                        </span>
                      </td>
                      <td className="ticket-date">
                        {new Date(t.date_creation).toLocaleDateString()}
                      </td>
                      <td>
                        <button onClick={() => handleViewDetails(t.id)} className="view-btn">
                          Voir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Détail du Ticket ── */}
      {selectedTicket && (
        <div className="ticket-details-panel">
          <div className="panel-header">
            <h2>Détail du ticket #{selectedTicket.id}</h2>
            <button onClick={() => setSelectedTicket(null)} className="close-btn">×</button>
          </div>

          <div className="details-content">
            {detailLoading ? (
              <div className="loading-container">Chargement des détails...</div>
            ) : (
              <>
                <div className="details-header-info">
                  <h3 className="details-title">{selectedTicket.name}</h3>
                  <div className="details-badges">
                    <span className="badge-type">
                      Type: {TYPE_LABELS[selectedTicket.type] || 'Incident'}
                    </span>
                    <span className={`status-badge status-${getStatusId(selectedTicket.status)}`}>
                      Statut: {STATUS_LABELS[getStatusId(selectedTicket.status)]}
                    </span>
                  </div>
                </div>

                <div className="details-body">
                  <p className="details-text">{selectedTicket.content}</p>
                </div>

                <div className="details-info-grid">
                  <div className="info-item">
                    <label>Date de création</label>
                    <div className="info-value">{new Date(selectedTicket.date_creation).toLocaleString()}</div>
                  </div>
                  <div className="info-item">
                    <label>Demandeur</label>
                    <div className="info-value">
                      {getItemName(selectedTicket.users_id_recipient)}
                    </div>
                  </div>
                </div>

                <div className="linked-items-section">
                  <h4>Éléments associés ({selectedTicket.linked_items?.length || 0})</h4>
                  {selectedTicket.linked_items && selectedTicket.linked_items.length > 0 ? (
                    <div className="linked-items-list">
                      {selectedTicket.linked_items.map((link, idx) => (
                        <div key={idx} className="linked-item">
                          <span className="item-name">{getItemName(link.item_name)}</span>
                          <span className="item-type-label">{link.itemtype}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-msg">Aucun élément associé.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
