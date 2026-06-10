import axios from 'axios';

const client = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchKanbanSettings() {
  const response = await client.get('/settings/kanban');
  return response.data;
}

export async function saveKanbanSettings(settings, changedBy = 'admin') {
  const response = await client.post('/settings/kanban', { settings, changedBy });
  return response.data;
}

export async function fetchColorHistory() {
  const response = await client.get('/history/colors');
  return response.data;
}

/**
 * Extrait les couleurs depuis les settings
 * { color_1: "#3b82f6", color_2: "#f59e0b", color_5: "#16a34a" }
 */
export function extractColors(settings) {
  return {
    1: settings.color_1 ?? '#3b82f6',
    2: settings.color_2 ?? '#f59e0b',
    5: settings.color_5 ?? '#16a34a',
  };
}

/**
 * Extrait les labels d'une langue depuis les settings
 * extractLabels(settings, 'mg') → { 1: "Vaovao", 2: "Efa manao", 5: "Vita" }
 * Si la langue n'existe pas, retombe sur 'fr'
 */
export function extractLabels(settings, lang = 'fr') {
  return {
    1: settings[`label_1_${lang}`] ?? settings['label_1_fr'] ?? 'Nouveau',
    2: settings[`label_2_${lang}`] ?? settings['label_2_fr'] ?? 'En cours',
    5: settings[`label_5_${lang}`] ?? settings['label_5_fr'] ?? 'Résolu',
  };
}

/**
 * Retourne toutes les langues disponibles dans les settings
 * ['fr', 'mg', 'en']
 */
export function extractAvailableLanguages(settings) {
  const langs = new Set();
  Object.keys(settings).forEach((key) => {
    const match = key.match(/^label_\d+_(\w+)$/);
    if (match) langs.add(match[1]);
  });
  return Array.from(langs);
}