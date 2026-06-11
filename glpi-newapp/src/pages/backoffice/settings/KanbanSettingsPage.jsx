import { useState, useEffect } from 'react';
import { fetchKanbanSettings, saveKanbanSettings, extractColors, } from '../../../services/backend/kanbanSettingsService';
import { fetchAllLanguages, saveLanguage, deleteLanguage, } from '../../../services/backend/kanbanLanguageService';
const STATUS_IDS = [1, 2, 5];
const STATUS_NAMES = { 1: 'Nouveau', 2: 'En cours', 5: 'Résolu' };
const LANG_NAMES = { fr: '🇫🇷 Français', mg: '🇲🇬 Malagasy', en: '🇬🇧 English' };

export default function KanbanSettingsPage() {
  // ── Couleurs ──
  const [colors, setColors] = useState({
    1: '#3b82f6',
    2: '#f59e0b',
    5: '#16a34a',
  });

  // ── Labels par langue { fr: {1: "Nouveau", 2: "...", 5: "..."}, mg: {...} } ──
  const [langLabels, setLangLabels] = useState({});
  const [languages,  setLanguages]  = useState([]);

  // ── Nouvelle langue ──
  const [newLang, setNewLang] = useState({
    code:    '',
    label_1: '',
    label_2: '',
    label_5: '',
  });

  // ── États ──
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(null);
  const [error,    setError]    = useState(null);

  // ── Chargement initial ──
  useEffect(() => {
    const load = async () => {
      try {
        const [settings, allLanguages] = await Promise.all([
          fetchKanbanSettings(),
          fetchAllLanguages().catch(() => ({})),
        ]);

        setColors(extractColors(settings));

        const langs = Object.keys(allLanguages);
        setLanguages(langs.length > 0 ? langs : ['fr']);
        setLangLabels(allLanguages);

      } catch {
        setError('Impossible de charger les paramètres.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);
  // ── Modifier couleur ──
  const handleColorChange = (statusId, value) => {
    setColors((prev) => ({ ...prev, [statusId]: value }));
  };

  // ── Modifier label d'une langue existante ──
  const handleLabelChange = (lang, statusId, value) => {
    setLangLabels((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [statusId]: value },
    }));
  };

  // ── Supprimer une langue ──
  const handleDeleteLang = async (lang) => {
    try {
      await deleteLanguage(lang);
      setLanguages((prev) => prev.filter((l) => l !== lang));
      setLangLabels((prev) => {
        const updated = { ...prev };
        delete updated[lang];
        return updated;
      });
    } catch {
      setError(`Impossible de supprimer la langue "${lang}".`);
    }
  };

  // ── Ajouter une nouvelle langue ──
  const handleAddLang = async () => {
    const code = newLang.code.trim().toLowerCase();
    if (!code) {
      setError('Le code de la langue est obligatoire.');
      return;
    }
    if (languages.includes(code)) {
      setError(`La langue "${code}" existe déjà.`);
      return;
    }
    if (!newLang.label_1 || !newLang.label_2 || !newLang.label_5) {
      setError('Tous les labels sont obligatoires.');
      return;
    }

    try {
      await saveLanguage(code, {
        1: newLang.label_1,
        2: newLang.label_2,
        5: newLang.label_5,
      });

      setLanguages((prev) => [...prev, code]);
      setLangLabels((prev) => ({
        ...prev,
        [code]: {
          1: newLang.label_1,
          2: newLang.label_2,
          5: newLang.label_5,
        },
      }));
      setNewLang({ code: '', label_1: '', label_2: '', label_5: '' });
      setError(null);
    } catch {
      setError(`Impossible d\'ajouter la langue "${code}".`);
    }
  };
  // ── Sauvegarder tout ──
  const handleSave = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      // 1. Sauvegarder les couleurs
      await saveKanbanSettings({
        color_1: colors[1],
        color_2: colors[2],
        color_5: colors[5],
      }, 'admin');

      // 2. Sauvegarder chaque langue
      for (const lang of languages) {
        const labels = langLabels[lang] ?? {};
        await saveLanguage(lang, {
          1: labels[1] ?? '',
          2: labels[2] ?? '',
          5: labels[5] ?? '',
        });
      }

      setSuccess('Paramètres sauvegardés avec succès !');
    } catch {
      setError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ padding: 24 }}>Chargement...</p>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>
        Paramètres du Kanban
      </h1>

      {/* ── Section Couleurs ── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, padding: 20, marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
          Couleurs des colonnes
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STATUS_IDS.map((id) => (
            <div
              key={id}
              style={{ display: 'flex', alignItems: 'center', gap: 14 }}
            >
              {/* Aperçu couleur */}
              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: colors[id],
                border: '1px solid #e5e7eb', flexShrink: 0,
              }} />

              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block', fontSize: 13,
                  fontWeight: 500, marginBottom: 4,
                }}>
                  {STATUS_NAMES[id]}
                </label>
                <input
                  type="color"
                  value={colors[id]}
                  onChange={(e) => handleColorChange(id, e.target.value)}
                  style={{
                    width: 80, height: 32, padding: 2,
                    borderRadius: 6, border: '1px solid #d1d5db',
                    cursor: 'pointer',
                  }}
                />
              </div>

              <span style={{ fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>
                {colors[id]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section Labels existants ── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, padding: 20, marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
          Labels par langue
        </h2>

        {languages.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            Aucune langue configurée. Ajoutez-en une ci-dessous.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {languages.map((lang) => (
              <div
                key={lang}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8, overflow: 'hidden',
                }}
              >
                {/* Header langue */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {LANG_NAMES[lang] ?? `🌐 ${lang.toUpperCase()}`}
                  </span>
                  {/* Ne pas pouvoir supprimer le français */}
                  {lang !== 'fr' && (
                    <button
                      onClick={() => handleDeleteLang(lang)}
                      style={{
                        background: '#fef2f2', border: '1px solid #fca5a5',
                        color: '#dc2626', borderRadius: 6,
                        padding: '3px 10px', fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                {/* Labels */}
                <div style={{
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 12,
                }}>
                  {STATUS_IDS.map((id) => (
                    <div key={id}>
                      <label style={{
                        display: 'block', fontSize: 12,
                        color: '#6b7280', marginBottom: 4,
                      }}>
                        {STATUS_NAMES[id]}
                      </label>
                      <input
                        type="text"
                        value={langLabels[lang]?.[id] ?? ''}
                        onChange={(e) => handleLabelChange(lang, id, e.target.value)}
                        style={{
                          width: '100%', padding: '7px 10px',
                          borderRadius: 7, border: '1px solid #d1d5db',
                          fontSize: 13,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section Ajouter une langue ── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, padding: 20, marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
          Ajouter une langue
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Code langue */}
          <div>
            <label style={{
              display: 'block', fontSize: 13,
              fontWeight: 500, marginBottom: 4,
            }}>
              Code langue
            </label>
            <input
              type="text"
              placeholder="ex: mg, en, es, de..."
              value={newLang.code}
              onChange={(e) => setNewLang((prev) => ({ ...prev, code: e.target.value }))}
              maxLength={5}
              style={{
                width: 150, padding: '7px 10px',
                borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13,
              }}
            />
          </div>

          {/* Labels */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
          }}>
            {STATUS_IDS.map((id) => (
              <div key={id}>
                <label style={{
                  display: 'block', fontSize: 12,
                  color: '#6b7280', marginBottom: 4,
                }}>
                  {STATUS_NAMES[id]}
                </label>
                <input
                  type="text"
                  placeholder={`Label pour ${STATUS_NAMES[id]}...`}
                  value={newLang[`label_${id}`] ?? ''}
                  onChange={(e) =>
                    setNewLang((prev) => ({ ...prev, [`label_${id}`]: e.target.value }))
                  }
                  style={{
                    width: '100%', padding: '7px 10px',
                    borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13,
                  }}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddLang}
            style={{
              alignSelf: 'flex-start',
              padding: '7px 16px', borderRadius: 7,
              border: '1px solid #2563eb', background: '#eff6ff',
              color: '#2563eb', fontSize: 13,
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            + Ajouter la langue
          </button>
        </div>
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

      {/* ── Bouton Sauvegarder ── */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', padding: '10px 0',
          borderRadius: 8, border: 'none',
          background: saving ? '#93c5fd' : '#2563eb',
          color: '#fff', fontSize: 15,
          fontWeight: 500,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Sauvegarde en cours...' : 'Sauvegarder les paramètres'}
      </button>
    </div>
  );
}