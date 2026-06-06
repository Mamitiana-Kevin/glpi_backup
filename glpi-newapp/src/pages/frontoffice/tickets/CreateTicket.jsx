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

export default function CreateTicket() {
  // ── Formulaire ticket ──
  const [form, setForm] = useState({
    name:     '',
    content:  '',
    type:     1,
    urgency:  3,
    impact:   3,
    priority: 3,
  });

  // ── Recherche éléments ──
  const [searchName,     setSearchName]     = useState('');
  const [searchType,     setSearchType]     = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [searching,      setSearching]      = useState(false);

  // ── Éléments sélectionnés ──
  const [selectedElements, setSelectedElements] = useState([]);

  // ── État soumission ──
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(null);
  const [error,      setError]      = useState(null);

  // ── Handlers formulaire ──
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ── Recherche éléments ──
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    setSearching(true);
    try {
      const results = await fetchElements({
        name: searchName.trim(),
        type: searchType,
      });
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchName, searchType]);

  // ── Sélection / désélection d'un élément ──
  const toggleElement = (element) => {
    setSelectedElements((prev) => {
      const exists = prev.find((el) => el.type === element.type && el.id === element.id);
      if (exists) {
        return prev.filter((el) => !(el.type === element.type && el.id === element.id));
      }
      return [...prev, element];
    });
  };

  const isSelected = (element) =>
    selectedElements.some((el) => el.type === element.type && el.id === element.id);

  // ── Soumission ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) {
      setError('Le titre et la description sont obligatoires.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Créer le ticket
      const ticket = await createTicket({
        name:     form.name,
        content:  form.content,
        type:     parseInt(form.type),
        urgency:  parseInt(form.urgency),
        impact:   parseInt(form.impact),
        priority: parseInt(form.priority),
      });

      const ticketId = ticket.id;

      // 2. Associer les éléments sélectionnés
      if (selectedElements.length > 0) {
        await associateMultipleElements(ticketId, selectedElements);
      }

      setSuccess(`Ticket #${ticketId} créé avec succès !${selectedElements.length > 0 ? ` (${selectedElements.length} élément(s) associé(s))` : ''}`);

      // Reset du formulaire
      setForm({ name: '', content: '', type: 1, urgency: 3, impact: 3, priority: 3 });
      setSelectedElements([]);
      setSearchResults([]);
      setSearchName('');
      setSearchType('');

    } catch {
      setError('Erreur lors de la création du ticket. Réessaie.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>
        Créer un ticket
      </h1>

      <form onSubmit={handleSubmit}>

        {/* ── Formulaire ticket ── */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 10, padding: 20, marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
            Informations du ticket
          </h2>

          {/* Titre */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
              Titre *
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleFormChange}
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
              name="content"
              value={form.content}
              onChange={handleFormChange}
              placeholder="Décris le problème en détail..."
              rows={4}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 7,
                border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical',
              }}
            />
          </div>

          {/* Type + Urgence + Impact + Priorité */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                Type
              </label>
              <select
                name="type"
                value={form.type}
                onChange={handleFormChange}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 7,
                  border: '1px solid #d1d5db', fontSize: 14, background: '#fff',
                }}
              >
                {TICKET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                Urgence
              </label>
              <select
                name="urgency"
                value={form.urgency}
                onChange={handleFormChange}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 7,
                  border: '1px solid #d1d5db', fontSize: 14, background: '#fff',
                }}
              >
                {URGENCY_LEVELS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                Impact
              </label>
              <select
                name="impact"
                value={form.impact}
                onChange={handleFormChange}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 7,
                  border: '1px solid #d1d5db', fontSize: 14, background: '#fff',
                }}
              >
                {IMPACT_LEVELS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                Priorité
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleFormChange}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 7,
                  border: '1px solid #d1d5db', fontSize: 14, background: '#fff',
                }}
              >
                {PRIORITY_LEVELS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Association d'éléments ── */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 10, padding: 20, marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
            Associer des éléments
            {selectedElements.length > 0 && (
              <span style={{
                marginLeft: 10, fontSize: 12, padding: '2px 9px',
                borderRadius: 20, background: '#e0f2fe', color: '#0369a1', fontWeight: 500,
              }}>
                {selectedElements.length} sélectionné(s)
              </span>
            )}
          </h2>

          {/* Barre de recherche éléments */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 7,
                border: '1px solid #d1d5db', fontSize: 14,
              }}
            />
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              style={{
                padding: '7px 10px', borderRadius: 7,
                border: '1px solid #d1d5db', fontSize: 14, background: '#fff',
              }}
            >
              <option value="">Tous les types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              style={{
                padding: '7px 16px', borderRadius: 7, border: 'none',
                background: '#2563eb', color: '#fff', fontSize: 14,
                fontWeight: 500, cursor: searching ? 'not-allowed' : 'pointer',
              }}
            >
              {searching ? '...' : 'Chercher'}
            </button>
          </div>

          {/* Résultats de recherche */}
          {searchResults.length > 0 && (
            <div style={{
              border: '1px solid #e5e7eb', borderRadius: 8,
              overflow: 'hidden', marginBottom: 14,
            }}>
              {searchResults.map((el, index) => (
                <div
                  key={`${el.type}-${el.id}`}
                  onClick={() => toggleElement(el)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', cursor: 'pointer',
                    background: isSelected(el) ? '#eff6ff' : index % 2 === 0 ? '#fff' : '#f9fafb',
                    borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                    borderLeft: isSelected(el) ? '3px solid #2563eb' : '3px solid transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected(el)}
                    onChange={() => toggleElement(el)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 16, height: 16 }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{el.name}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>#{el.id}</span>
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: '#e0f2fe', color: '#0369a1',
                  }}>
                    {el.typeLabel}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{el.serial}</span>
                </div>
              ))}
            </div>
          )}

          {/* Éléments sélectionnés */}
          {selectedElements.length > 0 && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
                Éléments associés au ticket :
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedElements.map((el) => (
                  <div
                    key={`${el.type}-${el.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 20,
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      fontSize: 13,
                    }}
                  >
                    <span>{el.name}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>({el.typeLabel})</span>
                    <button
                      type="button"
                      onClick={() => toggleElement(el)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#6b7280', fontSize: 14, padding: '0 2px', lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Messages ── */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: 16,
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
          }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: 16,
            background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a',
          }}>
            {success}
          </div>
        )}

        {/* ── Bouton soumettre ── */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
            background: submitting ? '#93c5fd' : '#2563eb',
            color: '#fff', fontSize: 15, fontWeight: 500,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Création en cours...' : 'Créer le ticket'}
        </button>

      </form>
    </div>
  );
}