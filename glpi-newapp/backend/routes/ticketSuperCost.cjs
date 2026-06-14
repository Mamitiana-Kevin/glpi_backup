const express = require('express');
const router = express.Router();
const { wrapper: db } = require('../db.cjs');

router.get('/total', (req, res) => {
  const row = db
    .prepare(`SELECT COALESCE(SUM(super_cost), 0) as total FROM ticket_super_cost`)
    .get();
  res.json(row.total);
});

router.get('/:ticketId', (req, res) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  const row = db
    .prepare(`SELECT * FROM ticket_super_cost WHERE ticket_id = ?`)
    .get(ticketId);

  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { ticketId, superCost } = req.body;

  const existing = db
    .prepare(`SELECT * FROM ticket_super_cost WHERE ticket_id = ?`)
    .get(ticketId);

  if (existing) {
    db.prepare(`UPDATE ticket_super_cost SET super_cost = ? WHERE ticket_id = ?`)
      .run(superCost, ticketId);
  } else {
    db.prepare(
      `INSERT INTO ticket_super_cost (ticket_id, super_cost) VALUES (?, ?)`
    ).run(ticketId, superCost);
  }

  const result = db
    .prepare(`SELECT * FROM ticket_super_cost WHERE ticket_id = ?`)
    .get(ticketId);

  res.json(result);
});

module.exports = router;
