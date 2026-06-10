import '../../../components/kanban.css';

const PRIORITY_LABELS = { 1:'Très basse', 2:'Basse', 3:'Moyenne', 4:'Haute', 5:'Très haute' };
const TYPE_LABELS     = { 1:'Incident', 2:'Demande' };
const STATUS_LABELS   = { 1:'Nouveau', 2:'En cours', 5:'Résolu' };

export default function TicketDetail({ ticket, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container modal-detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-header-title">Ticket #{ticket.id}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <p className="ticket-detail-label">Titre</p>
            <p style={{ fontSize: 15, fontWeight: 500 }}>{ticket.name}</p>
          </div>
          <div>
            <p className="ticket-detail-label">Description</p>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
              {ticket.content || '—'}
            </p>
          </div>
          <div className="ticket-detail-grid">
            <div className="ticket-detail-field">
              <p className="ticket-detail-label">Type</p>
              <p className="ticket-detail-value">{TYPE_LABELS[ticket.type] ?? '—'}</p>
            </div>
            <div className="ticket-detail-field">
              <p className="ticket-detail-label">Statut</p>
              <p className="ticket-detail-value">{STATUS_LABELS[ticket.status] ?? '—'}</p>
            </div>
            <div className="ticket-detail-field">
              <p className="ticket-detail-label">Priorité</p>
              <p className="ticket-detail-value">{PRIORITY_LABELS[ticket.priority] ?? '—'}</p>
            </div>
          </div>
          <div>
            <p className="ticket-detail-label">Date de création</p>
            <p style={{ fontSize: 13 }}>
              {ticket.date ? new Date(ticket.date).toLocaleString('fr-FR') : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}