import './kanban.css';

const PRIORITY_COLORS = {
  1: '#6b7280', 2: '#3b82f6', 3: '#f59e0b', 4: '#ef4444', 5: '#7c3aed',
};
const PRIORITY_LABELS = {
  1: 'Très basse', 2: 'Basse', 3: 'Moyenne', 4: 'Haute', 5: 'Très haute',
};
const TYPE_LABELS = { 1: 'Incident', 2: 'Demande' };

export default function KanbanCard({ ticket, onClick, onDragStart }) {
  return (
    <div
      className="kanban-card"
      draggable
      onDragStart={(e) => onDragStart(e, ticket)}
      onClick={() => onClick(ticket)}
    >
      <div className="kanban-card-header">
        <span className="kanban-card-id">#{ticket.id}</span>
        <span className={`kanban-card-type ${ticket.type === 1 ? 'incident' : 'demande'}`}>
          {TYPE_LABELS[ticket.type] ?? '—'}
        </span>
      </div>

      <p className="kanban-card-title">{ticket.name}</p>

      <div className="kanban-card-footer">
        <span
          className="kanban-card-priority"
          style={{
            color: PRIORITY_COLORS[ticket.priority] ?? '#6b7280',
            border: `1px solid ${PRIORITY_COLORS[ticket.priority] ?? '#e5e7eb'}`,
          }}
        >
          {PRIORITY_LABELS[ticket.priority] ?? '—'}
        </span>
        <span className="kanban-card-date">
          {ticket.date ? new Date(ticket.date).toLocaleDateString('fr-FR') : ''}
        </span>
      </div>
    </div>
  );
}