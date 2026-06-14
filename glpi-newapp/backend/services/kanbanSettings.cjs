const { wrapper: db } = require('../db.cjs');

const DEFAULTS = {
  color_1: '#3b82f6',
  color_2: '#f59e0b',
  color_5: '#16a34a',
};

function getLatestSettings() {
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    const row = db
      .prepare(`SELECT value FROM kanban_settings WHERE key = ? ORDER BY id DESC LIMIT 1`)
      .get(key);
    if (row) result[key] = row.value;
  }
  return result;
}

function saveSettings(settings, changedBy = 'admin') {
  const current = getLatestSettings();
  
  const saveAll = db.transaction((settings) => {
    for (const [key, value] of Object.entries(settings)) {
      if (!key.startsWith('color_')) continue;

      db
        .prepare(`INSERT INTO kanban_settings (key, value, changed_by) VALUES (?, ?, ?)`)
        .run(key, value, changedBy);

      if (value !== current[key]) {
        const statusId = parseInt(key.replace('color_', ''), 10);
        if (!isNaN(statusId)) {
          db
            .prepare(`INSERT INTO kanban_color_history (status_id, old_color, new_color, changed_by) VALUES (?, ?, ?, ?)`)
            .run(statusId, current[key] ?? '#000000', value, changedBy);
        }
      }
    }
  });

  saveAll(settings);
  return getLatestSettings();
}

module.exports = { fetchSettings: getLatestSettings, saveSettings };
