const { wrapper: db } = require('../db.cjs');

function addEntry(ticketId, ticketName, oldStatus, newStatus) {
  const changedAt = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO ticket_status_history (ticket_id, ticket_name, old_status, new_status, changed_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(ticketId, ticketName, oldStatus, newStatus, changedAt);
  const allEntries = getAllEntries();
  return allEntries[0];
}

function getAllEntries() {
  return db.prepare(`SELECT * FROM ticket_status_history ORDER BY id DESC`).all();
}

function getEntriesByTicketId(ticketId) {
  return db.prepare(`SELECT * FROM ticket_status_history WHERE ticket_id = ? ORDER BY id DESC`).all(ticketId);
}

function deleteAllEntries() {
  db.prepare(`DELETE FROM ticket_status_history`).run();
}

module.exports = { addEntry, getAllEntries, getEntriesByTicketId, deleteAllEntries };
