import axios from 'axios';

const client = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Récupère toutes les langues avec leurs labels.
 * Retourne : { fr: {1:"Nouveau",...}, mg: {1:"Vaovao",...} }
 */
export async function fetchAllLanguages() {
  const response = await client.get('/settings/languages');
  return response.data;
}

/**
 * Récupère les codes de langues disponibles.
 * Retourne : ["fr", "mg", "en"]
 */
export async function fetchLanguageCodes() {
  const response = await client.get('/settings/languages/codes');
  return response.data;
}

/**
 * Récupère les labels d'une langue.
 * Retourne : { 1: "Vaovao", 2: "Efa manao", 5: "Vita" }
 */
export async function fetchLanguage(code) {
  const response = await client.get(`/settings/languages/${code}`);
  return response.data;
}

/**
 * Sauvegarde ou met à jour les labels d'une langue.
 * @param code   "mg"
 * @param labels { 1: "Vaovao", 2: "Efa manao", 5: "Vita" }
 */
export async function saveLanguage(code, labels) {
  const response = await client.post('/settings/languages', { code, labels });
  return response.data;
}

/**
 * Supprime une langue (sauf fr).
 */
export async function deleteLanguage(code) {
  await client.delete(`/settings/languages/${code}`);
}