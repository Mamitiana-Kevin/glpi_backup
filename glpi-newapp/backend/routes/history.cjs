const express = require('express');
const router = Router();
const { wrapper: db } = require('../db.cjs');

function Router() {
  return express.Router();
}

router.get('/colors', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM kanban_color_history ORDER BY id DESC`)
    .all();
  res.json(rows);
});

router.get('/colors/:statusId', (req, res) => {
  const statusId = parseInt(req.params.statusId, 10);
  const rows = db
    .prepare(
      `SELECT * FROM kanban_color_history
       WHERE status_id = ?
       ORDER BY id DESC`
    )
    .all(statusId);
  res.json(rows);
});

router.delete('/colors', (req, res) => {
  db.prepare(`DELETE FROM kanban_color_history`).run();
  res.status(204).send();
});

router.post('/ticket-status', (req, res) => {
  const { ticketId, ticketName, oldStatus, newStatus } = req.body;

  const stmt = db.prepare(`
    INSERT INTO ticket_status_history (ticket_id, ticket_name, old_status, new_status)
    VALUES (?, ?, ?, ?)
  `);

  const info = stmt.run(ticketId, ticketName, oldStatus, newStatus);

  const inserted = db
    .prepare(`SELECT * FROM ticket_status_history WHERE id = ?`)
    .get(info.lastInsertRowid);

  res.json(inserted);
});

router.get('/ticket-status', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM ticket_status_history ORDER BY id DESC`)
    .all();
  res.json(rows);
});

router.get('/ticket-status/:ticketId', (req, res) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  const rows = db
    .prepare(
      `SELECT * FROM ticket_status_history
       WHERE ticket_id = ?
       ORDER BY id DESC`
    )
    .all(ticketId);
  res.json(rows);
});

router.delete('/ticket-status', (req, res) => {
  db.prepare(`DELETE FROM ticket_status_history`).run();
  res.status(204).send();
});

module.exports = router;
