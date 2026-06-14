const express = require('express');
const router = express.Router();
const { wrapper: db } = require('../db.cjs');

const DEFAULTS = {
  color_1: '#3b82f6',
  color_2: '#f59e0b',
  color_5: '#16a34a',
};

router.get('/kanban', (req, res) => {
  const result = { ...DEFAULTS };

  for (const key of Object.keys(DEFAULTS)) {
    const row = db
      .prepare(
        `SELECT value FROM kanban_settings
         WHERE key = ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(key);

    if (row) result[key] = row.value;
  }

  res.json(result);
});

router.post('/kanban', (req, res) => {
  const { settings = {}, changedBy = 'admin' } = req.body;

  const current = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    const row = db
      .prepare(`SELECT value FROM kanban_settings WHERE key = ? ORDER BY id DESC LIMIT 1`)
      .get(key);
    if (row) current[key] = row.value;
  }

  const insertSetting = db.prepare(
    `INSERT INTO kanban_settings (key, value, changed_by) VALUES (?, ?, ?)`
  );
  const insertHistory = db.prepare(
    `INSERT INTO kanban_color_history (status_id, old_color, new_color, changed_by)
     VALUES (?, ?, ?, ?)`
  );

  const saveAll = db.transaction((settings) => {
    for (const [key, value] of Object.entries(settings)) {
      if (!key.startsWith('color_')) continue;

      insertSetting.run(key, value, changedBy);

      if (value !== current[key]) {
        const statusId = parseInt(key.replace('color_', ''), 10);
        if (!isNaN(statusId)) {
          insertHistory.run(statusId, current[key] ?? '#000000', value, changedBy);
        }
      }
    }
  });

  saveAll(settings);

  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    const row = db
      .prepare(`SELECT value FROM kanban_settings WHERE key = ? ORDER BY id DESC LIMIT 1`)
      .get(key);
    if (row) result[key] = row.value;
  }

  res.json(result);
});

router.get('/languages', (req, res) => {
  const FR_DEFAULTS = { 1: 'Nouveau', 2: 'En cours', 5: 'Résolu' };

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
    for (const row of rows) {
      labels[row.status_id] = row.label;
    }
    result[code] = labels;
  }

  res.json(result);
});

router.get('/languages/codes', (req, res) => {
  const codes = db
    .prepare(`SELECT DISTINCT language_code FROM kanban_languages`)
    .all()
    .map((r) => r.language_code);

  const allCodes = codes.includes('fr') ? codes : ['fr', ...codes];
  res.json(allCodes);
});

router.get('/languages/:code', (req, res) => {
  const { code } = req.params;
  const FR_DEFAULTS = { 1: 'Nouveau', 2: 'En cours', 5: 'Résolu' };

  const labels = { ...FR_DEFAULTS };
  const rows = db
    .prepare(`SELECT status_id, label FROM kanban_languages WHERE language_code = ?`)
    .all(code);
  for (const row of rows) {
    labels[row.status_id] = row.label;
  }

  res.json(labels);
});

router.post('/languages', (req, res) => {
  const { code, labels = {} } = req.body;
  const STATUS_IDS = [1, 2, 5];
  const FR_DEFAULTS = { 1: 'Nouveau', 2: 'En cours', 5: 'Résolu' };

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

  const result = { ...FR_DEFAULTS };
  const rows = db
    .prepare(`SELECT status_id, label FROM kanban_languages WHERE language_code = ?`)
    .all(code);
  for (const row of rows) {
    result[row.status_id] = row.label;
  }

  res.json(result);
});

router.delete('/languages/:code', (req, res) => {
  const { code } = req.params;

  if (code === 'fr') {
    return res.status(400).json({ error: 'Le français ne peut pas être supprimé.' });
  }

  db.prepare(`DELETE FROM kanban_languages WHERE language_code = ?`).run(code);
  res.status(204).send();
});

module.exports = router;
