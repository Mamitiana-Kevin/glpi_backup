import './kanban.css';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({
  status, tickets, color,
  onDragStart, onDrop, onDragOver, onCardClick,
  onAdd, // ← seulement pour la colonne Nouveau
}) {
  return (
    <div
      className="kanban-column"
      onDrop={(e) => onDrop(e, status.id)}
      onDragOver={onDragOver}
    >
      <div
        className="kanban-column-header"
        style={{ background: color }}
      >
        <span className="kanban-column-title">{status.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="kanban-column-count">{tickets.length}</span>
          {/* Bouton ajouter uniquement sur la colonne Nouveau */}
          {onAdd && (
            <button
              onClick={onAdd}
              className="btn-add-ticket-col"
            >
              +
            </button>
          )}
        </div>
      </div>

      <div className="kanban-column-body">
        {tickets.length === 0 ? (
          <div className="kanban-column-empty">Aucun ticket</div>
        ) : (
          tickets.map((ticket) => (
            <KanbanCard
              key={ticket.id}
              ticket={ticket}
              onClick={onCardClick}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}