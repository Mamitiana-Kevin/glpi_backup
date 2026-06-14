const { wrapper: db } = require('../db.cjs');

function getAllHistory() {
  return db.prepare(`SELECT * FROM kanban_color_history ORDER BY id DESC`).all();
}

function getHistoryByStatusId(statusId) {
  return db.prepare(`SELECT * FROM kanban_color_history WHERE status_id = ? ORDER BY id DESC`).all(statusId);
}

function deleteAllHistory() {
  db.prepare(`DELETE FROM kanban_color_history`).run();
}

module.exports = { getAllHistory, getHistoryByStatusId, deleteAllHistory };
