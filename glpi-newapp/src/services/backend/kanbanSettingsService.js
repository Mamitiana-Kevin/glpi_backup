import axios from 'axios';

const client = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Récupère les paramètres actuels (couleurs uniquement).
 * Retourne : { color_1: "#3b82f6", color_2: "#f59e0b", color_5: "#16a34a" }
 */
export async function fetchKanbanSettings() {
  const response = await client.get('/settings/kanban');
  return response.data;
}

/**
 * Sauvegarde les couleurs (toujours INSERT côté Spring Boot).
 * @param settings { color_1: "#ef4444", color_2: "...", color_5: "..." }
 * @param changedBy identifiant utilisateur
 */
export async function saveKanbanSettings(settings, changedBy = 'admin') {
  const response = await client.post('/settings/kanban', { settings, changedBy });
  return response.data;
}

/**
 * Extrait les couleurs depuis les settings.
 * Retourne : { 1: "#3b82f6", 2: "#f59e0b", 5: "#16a34a" }
 */
export function extractColors(settings) {
  return {
    1: settings.color_1 ?? '#3b82f6',
    2: settings.color_2 ?? '#f59e0b',
    5: settings.color_5 ?? '#16a34a',
  };
}

/**
 * Récupère l'historique des changements de couleur.
 */
export async function fetchColorHistory() {
  const response = await client.get('/history/colors');
  return response.data;
}