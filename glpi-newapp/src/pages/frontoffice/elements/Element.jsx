import { useState, useEffect, useCallback } from 'react';
import { fetchElements, ASSET_TYPES } from '../../../services/elementService';

export default function Elements() {
  const [elements, setElements]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [total, setTotal]         = useState(0);

  // Critères de recherche
  const [searchName, setSearchName]         = useState('');
  const [searchType, setSearchType]         = useState('');
  const [searchLocation, setSearchLocation] = useState('');

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchElements({
        name:     searchName.trim(),
        type:     searchType,
        location: searchLocation.trim(),
      });
      setElements(data);
      setTotal(data.length);
    } catch {
      setError('Impossible de charger les éléments.');
    } finally {
      setLoading(false);
    }
  }, [searchName, searchType, searchLocation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    search();
  };

  const handleReset = () => {
    setSearchName('');
    setSearchType('');
    setSearchLocation('');
    // La recherche sera relancée par le useEffect si on veut un comportement automatique,
    // ou on peut l'appeler manuellement avec les valeurs vides.
  };

  // Chargement initial et relance lors du reset (si on veut que ce soit auto)
  useEffect(() => {
    search();
  }, [searchType]); // On peut relancer auto sur changement de type, par exemple.

  // Pour name et location, on préfère attendre le "Submit" pour éviter trop d'appels
  // Mais pour le reset, on veut que ça revienne à zéro.
  useEffect(() => {
    if (searchName === '' && searchLocation === '' && searchType === '') {
      search();
    }
  }, [searchName, searchLocation, searchType, search]);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 20 }}>
        Éléments du parc
      </h1>

      {/* ── Formulaire de recherche ── */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
          padding: 16,
          background: '#f9fafb',
          borderRadius: 10,
          border: '1px solid #e5e7eb',
        }}
      >
        {/* Nom */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Nom</label>
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 7,
              border: '1px solid #d1d5db', fontSize: 14,
            }}
          />
        </div>

        {/* Type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Type</label>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 7,
              border: '1px solid #d1d5db', fontSize: 14,
              background: '#fff',
            }}
          >
            <option value="">Tous les types</option>
            {ASSET_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Localisation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Localisation</label>
          <input
            type="text"
            placeholder="Ex: Salle 1..."
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 7,
              border: '1px solid #d1d5db', fontSize: 14,
            }}
          />
        </div>

        {/* Boutons */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button
            type="submit"
            style={{
              padding: '7px 18px', borderRadius: 7, border: 'none',
              background: '#2563eb', color: '#fff', fontSize: 14,
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            Rechercher
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '7px 14px', borderRadius: 7,
              border: '1px solid #d1d5db', background: '#fff',
              fontSize: 14, cursor: 'pointer',
            }}
          >
            Réinitialiser
          </button>
        </div>
      </form>

      {/* ── Résultats ── */}
      <div style={{ marginBottom: 10, fontSize: 13, color: '#6b7280' }}>
        {loading ? 'Chargement...' : `${total} élément(s) trouvé(s)`}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
        }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                {['ID', 'Nom', 'Type', 'Numéro de série', 'Localisation'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px', fontWeight: 500,
                    color: '#374151', borderBottom: '1px solid #e5e7eb',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elements.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '20px 14px', textAlign: 'center', color: '#9ca3af' }}>
                    Aucun élément trouvé
                  </td>
                </tr>
              ) : (
                elements.map((el, index) => (
                  <tr
                    key={`${el.type}-${el.id}`}
                    style={{ background: index % 2 === 0 ? '#fff' : '#f9fafb' }}
                  >
                    <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{el.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{el.name}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 9px', borderRadius: 20, fontSize: 12,
                        background: '#e0f2fe', color: '#0369a1', fontWeight: 500,
                      }}>
                        {el.typeLabel}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6b7280' }}>{el.serial}</td>
                    <td style={{ padding: '10px 14px', color: '#6b7280' }}>{el.location}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}