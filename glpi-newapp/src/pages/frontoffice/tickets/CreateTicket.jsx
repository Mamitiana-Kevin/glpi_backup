import { useState, useCallback } from 'react';
import { fetchElements, ASSET_TYPES } from '../../../services/elementService';
import { createTicket, associateMultipleElements } from '../../../services/ticketService';

const TICKET_TYPES = [
  { value: 1, label: 'Incident' },
  { value: 2, label: 'Demande' },
];

const URGENCY_LEVELS = [
  { value: 1, label: 'Très basse' },
  { value: 2, label: 'Basse' },
  { value: 3, label: 'Moyenne' },
  { value: 4, label: 'Haute' },
  { value: 5, label: 'Très haute' },
];

const IMPACT_LEVELS = [
  { value: 1, label: 'Très bas' },
  { value: 2, label: 'Bas' },
  { value: 3, label: 'Moyen' },
  { value: 4, label: 'Haut' },
  { value: 5, label: 'Très haut' },
];

const PRIORITY_LEVELS = [
  { value: 1, label: 'Très basse' },
  { value: 2, label: 'Basse' },
  { value: 3, label: 'Moyenne' },
  { value: 4, label: 'Haute' },
  { value: 5, label: 'Très haute' },
  { value: 6, label: 'Majeure' },
];

export default function CreateTicket({ onSuccess }) {
  // ── État multi-tickets ──
  const [tickets, setTickets] = useState([
    {
      id: Date.now(),
      form: {
        name:     '',
        content:  '',
        type:     1,
        urgency:  3,
        impact:   3,
        priority: 3,
      },
      selectedElements: [],
      searchName: '',
      searchType: '',
      searchResults: [],
      searching: false,
    }
  ]);

  // ── État global soumission ──
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(null);
  const [error,      setError]      = useState(null);

  // ── Ajouter un nouveau formulaire ──
  const addTicketRow = () => {
    setTickets((prev) => [
      ...prev,
      {
        id: Date.now() + prev.length,
        form: {
          name:     '',
          content:  '',
          type:     1,
          urgency:  3,
          impact:   3,
          priority: 3,
        },
        selectedElements: [],
        searchName: '',
        searchType: '',
        searchResults: [],
        searching: false,
      }
    ]);
  };

  // ── Supprimer un formulaire ──
  const removeTicketRow = (id) => {
    if (tickets.length === 1) return;
    setTickets((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Handlers par ligne ──
  const handleTicketChange = (id, field, value, isForm = true) => {
    setTickets((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      if (isForm) {
        return { ...t, form: { ...t.form, [field]: value } };
      }
      return { ...t, [field]: value };
    }));
  };

  const handleSearch = async (id) => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    handleTicketChange(id, 'searching', true, false);
    try {
      const results = await fetchElements({
        name: ticket.searchName.trim(),
        type: ticket.searchType,
      });
      handleTicketChange(id, 'searchResults', results, false);
    } catch {
      handleTicketChange(id, 'searchResults', [], false);
    } finally {
      handleTicketChange(id, 'searching', false, false);
    }
  };

  const toggleElement = (id, element) => {
    setTickets((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const exists = t.selectedElements.find((el) => el.type === element.type && el.id === element.id);
      const newSelected = exists
        ? t.selectedElements.filter((el) => !(el.type === element.type && el.id === element.id))
        : [...t.selectedElements, element];
      return { ...t, selectedElements: newSelected };
    }));
  };

  const isSelected = (ticket, element) =>
    ticket.selectedElements.some((el) => el.type === element.type && el.id === element.id);

  // ── Soumission globale ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const invalid = tickets.some(t => !t.form.name.trim() || !t.form.content.trim());
    if (invalid) {
      setError('Le titre et la description sont obligatoires pour tous les tickets.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const results = [];
      
      for (const ticketData of tickets) {
        // 1. Créer le ticket
        const ticket = await createTicket({
          name:     ticketData.form.name,
          content:  ticketData.form.content,
          type:     parseInt(ticketData.form.type),
          urgency:  parseInt(ticketData.form.urgency),
          impact:   parseInt(ticketData.form.impact),
          priority: parseInt(ticketData.form.priority),
        });

        const ticketId = ticket.id;

        // 2. Associer les éléments sélectionnés
        if (ticketData.selectedElements.length > 0) {
          await associateMultipleElements(ticketId, ticketData.selectedElements);
        }
        
        results.push(ticketId);
      }

      setSuccess(`${results.length} ticket(s) créé(s) avec succès ! (IDs: ${results.join(', ')})`);

      // Notification parent
      if (onSuccess) onSuccess();

      // Reset
      setTickets([
        {
          id: Date.now(),
          form: { name: '', content: '', type: 1, urgency: 3, impact: 3, priority: 3 },
          selectedElements: [],
          searchName: '', searchType: '', searchResults: [], searching: false
        }
      ]);

    } catch (err) {
      console.error(err);
      setError('Erreur lors de la création des tickets. Certains ont peut-être été créés.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 0 24px 0' }}>
      
      <form onSubmit={handleSubmit}>
        
        {tickets.map((ticket, index) => (
          <div key={ticket.id} style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 10, padding: 20, marginBottom: 30,
            position: 'relative',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}>
            {/* Header de ligne */}
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              marginBottom: 20, borderBottom: '1px solid #f3f4f6', paddingBottom: 10 
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
                Ticket #{index + 1}
              </h2>
              {tickets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTicketRow(ticket.id)}
                  style={{
                    background: '#fee2e2', color: '#dc2626', border: 'none',
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>

            {/* ── Formulaire ticket ── */}
            <div style={{ marginBottom: 20 }}>
              {/* Titre */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                  Titre *
                </label>
                <input
                  type="text"
                  value={ticket.form.name}
                  onChange={(e) => handleTicketChange(ticket.id, 'name', e.target.value)}
                  placeholder="Ex: Imprimante en panne salle 3"
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 7,
                    border: '1px solid #d1d5db', fontSize: 14,
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                  Description *
                </label>
                <textarea
                  value={ticket.form.content}
                  onChange={(e) => handleTicketChange(ticket.id, 'content', e.target.value)}
                  placeholder="Décris le problème en détail..."
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 7,
                    border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical',
                  }}
                />
              </div>

              {/* Type + Urgence + Impact + Priorité */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Type</label>
                  <select
                    value={ticket.form.type}
                    onChange={(e) => handleTicketChange(ticket.id, 'type', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
                  >
                    {TICKET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Urgence</label>
                  <select
                    value={ticket.form.urgency}
                    onChange={(e) => handleTicketChange(ticket.id, 'urgency', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
                  >
                    {URGENCY_LEVELS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Impact</label>
                  <select
                    value={ticket.form.impact}
                    onChange={(e) => handleTicketChange(ticket.id, 'impact', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
                  >
                    {IMPACT_LEVELS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Priorité</label>
                  <select
                    value={ticket.form.priority}
                    onChange={(e) => handleTicketChange(ticket.id, 'priority', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
                  >
                    {PRIORITY_LEVELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Association d'éléments ── */}
            <div style={{
              background: '#f9fafb', border: '1px solid #f3f4f6',
              borderRadius: 8, padding: 15,
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#4b5563' }}>
                Éléments associés ({ticket.selectedElements.length})
              </p>

              {/* Barre de recherche */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Nom..."
                  value={ticket.searchName}
                  onChange={(e) => handleTicketChange(ticket.id, 'searchName', e.target.value, false)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
                <select
                  value={ticket.searchType}
                  onChange={(e) => handleTicketChange(ticket.id, 'searchType', e.target.value, false)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}
                >
                  <option value="">Types</option>
                  {ASSET_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => handleSearch(ticket.id)}
                  disabled={ticket.searching}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none',
                    background: '#4b5563', color: '#fff', fontSize: 13, cursor: 'pointer'
                  }}
                >
                  {ticket.searching ? '...' : 'Chercher'}
                </button>
              </div>

              {/* Résultats condensés */}
              {ticket.searchResults.length > 0 && (
                <div style={{
                  maxHeight: 150, overflowY: 'auto', background: '#fff',
                  border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 12
                }}>
                  {ticket.searchResults.map((el) => (
                    <div
                      key={`${el.type}-${el.id}`}
                      onClick={() => toggleElement(ticket.id, el)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                        cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                        background: isSelected(ticket, el) ? '#eff6ff' : 'transparent'
                      }}
                    >
                      <input type="checkbox" checked={isSelected(ticket, el)} readOnly style={{ pointerEvents: 'none' }} />
                      <span style={{ fontSize: 13, flex: 1 }}>{el.name} <small style={{color: '#9ca3af'}}>#{el.id}</small></span>
                      <span style={{ fontSize: 11, background: '#e0f2fe', padding: '1px 6px', borderRadius: 10 }}>{el.typeLabel}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Badges sélectionnés */}
              {ticket.selectedElements.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ticket.selectedElements.map((el) => (
                    <span key={`${el.type}-${el.id}`} style={{
                      fontSize: 11, background: '#fff', border: '1px solid #bfdbfe',
                      padding: '2px 8px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4
                    }}>
                      {el.name}
                      <button type="button" onClick={() => toggleElement(ticket.id, el)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* ── Actions globales ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            type="button"
            onClick={addTicketRow}
            style={{
              flex: 1, padding: '12px', borderRadius: 8, border: '2px dashed #d1d5db',
              background: '#f9fafb', color: '#4b5563', fontWeight: 600, cursor: 'pointer'
            }}
          >
            + Ajouter une ligne (nouveau ticket)
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px', borderRadius: 8, marginBottom: 16, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 14 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '12px', borderRadius: 8, marginBottom: 16, background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', fontSize: 14 }}>
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '14px', borderRadius: 8, border: 'none',
            background: submitting ? '#93c5fd' : '#2563eb',
            color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 6px -1px rgb(37 99 235 / 0.3)'
          }}
        >
          {submitting ? 'Création en cours...' : `Valider et créer ${tickets.length} ticket(s)`}
        </button>

      </form>
    </div>
  );
}