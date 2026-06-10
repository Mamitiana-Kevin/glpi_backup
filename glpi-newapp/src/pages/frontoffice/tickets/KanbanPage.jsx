import { useState, useEffect, useCallback } from 'react';
import {
  fetchKanbanTickets,
  updateTicketStatus,
  moveTicketOptimistic,
  rollbackTicket,
  KANBAN_STATUSES,
} from '../../../services/ticketService';
import KanbanColumn from '../../../components/KanbanColumn';
import TicketDetail from './TicketDetail';
import CreateTicket from './CreateTicket';
import '../../../components/kanban.css';

export default function KanbanPage() {
  const [columns,        setColumns]        = useState({ 1: [], 2: [], 5: [] });
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [dragging,       setDragging]       = useState(null);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Couleurs — remplacées par SQLite plus tard
  const [colors] = useState({ 1: '#3b82f6', 2: '#f59e0b', 5: '#16a34a' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchKanbanTickets();
      setColumns(data);
    } catch {
      setError('Impossible de charger les tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDragStart = (e, ticket) => {
    setDragging(ticket);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStatusId) => {
    e.preventDefault();
    if (!dragging || dragging.status === newStatusId) {
      setDragging(null);
      return;
    }
    const oldStatusId = dragging.status;
    setColumns((prev) => moveTicketOptimistic(prev, dragging, oldStatusId, newStatusId));
    setDragging(null);
    try {
      await updateTicketStatus(dragging.id, newStatusId);
    } catch {
      setColumns((prev) => rollbackTicket(prev, dragging, oldStatusId, newStatusId));
      alert('Erreur lors du changement de statut.');
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    load(); // Rafraîchit le Kanban après fermeture
  };

  if (loading) return <p className="kanban-loading">Chargement du Kanban...</p>;
  if (error)   return <p className="kanban-error">{error}</p>;

  return (
    <div className="kanban-page">

      {/* Header */}
      <div className="kanban-header">
        <h1 className="kanban-title">Tickets — Vue Kanban</h1>
      </div>

      {/* Board */}
      <div className="kanban-board">
        {KANBAN_STATUSES.map((status) => (
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
            <CreateTicket />
          </div>
        </div>
      )}

      {/* Modal Détail ticket */}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}