const { wrapper: db } = require('../db.cjs');
const FR_DEFAULTS = { 1: 'Nouveau', 2: 'En cours', 5: 'Résolu' };

function getAllLanguages() {
  const codes = db
    .prepare(`SELECT DISTINCT language_code FROM kanban_languages`)
    .all()
    .map((r) => r.language_code);

  const allCodes = codes.includes('fr') ? codes : ['fr', ...codes];
  const result = {};
  
  for (const code of allCodes) {
    const labels = { ...FR_DEFAULTS };
    const rows = db
      .prepare(`SELECT status_id, label FROM kanban_languages WHERE language_code = ?`)
      .all(code);
    for (const row of rows) labels[row.status_id] = row.label;
    result[code] = labels;
  }
  
  return result;
}

function getLanguageCodes() {
  const codes = db
    .prepare(`SELECT DISTINCT language_code FROM kanban_languages`)
    .all()
    .map((r) => r.language_code);
  return codes.includes('fr') ? codes : ['fr', ...codes];
}

function getLanguage(code) {
  const labels = { ...FR_DEFAULTS };
  const rows = db
    .prepare(`SELECT status_id, label FROM kanban_languages WHERE language_code = ?`)
    .all(code);
  for (const row of rows) labels[row.status_id] = row.label;
  return labels;
}

function saveLanguage(code, labels = {}) {
  const STATUS_IDS = [1, 2, 5];
  
  const upsert = db.prepare(`
    INSERT INTO kanban_languages (language_code, status_id, label)
    VALUES (?, ?, ?)
    ON CONFLICT (language_code, status_id) DO UPDATE SET label = excluded.label
  `);

  const saveAll = db.transaction(() => {
    for (const statusId of STATUS_IDS) {
      const label = labels[statusId] ?? labels[String(statusId)] ?? '';
      if (!label.trim()) continue;
      upsert.run(code, statusId, label);
    }
  });

  saveAll();
  return getLanguage(code);
}

function deleteLanguage(code) {
  if (code === 'fr') throw new Error('Le français ne peut pas être supprimé.');
  db.prepare(`DELETE FROM kanban_languages WHERE language_code = ?`).run(code);
}

module.exports = { getAllLanguages, getLanguageCodes, getLanguage, saveLanguage, deleteLanguage };
