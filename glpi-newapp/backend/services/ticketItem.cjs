
const { wrapper: db } = require('../db.cjs');

function upsertTicketItems(ticketId, items) {
  for (const item of items) {
    db.prepare(`
      INSERT OR IGNORE INTO ticket_item (ticket_id, item_id, itemtype)
      VALUES (?, ?, ?)
    `).run(ticketId, item.item_id, item.itemtype);
  }
  return getItemsByTicket(ticketId);
}

function getItemsByTicket(ticketId) {
  return db.prepare(`SELECT * FROM ticket_item WHERE ticket_id = ?`).all(ticketId);
}

function countItemsByTicket(ticketId) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ticket_item WHERE ticket_id = ?`).get(ticketId);
  return row.count ?? 0;
}

module.exports = { upsertTicketItems, getItemsByTicket, countItemsByTicket };
