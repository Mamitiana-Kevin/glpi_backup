
const express = require('express');
const router = express.Router();
const { upsertTicketItems, getItemsByTicket, countItemsByTicket } = require('../../services/ticketItem.cjs');

router.post('/', (req, res) => {
  try {
    const { ticketId, items } = req.body;
    const result = upsertTicketItems(ticketId, items);
    res.json(result);
  } catch (error) {
    console.error('Error upserting ticket items:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:ticketId', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    res.json(getItemsByTicket(ticketId));
  } catch (error) {
    console.error('Error fetching ticket items:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:ticketId/count', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    res.json({ count: countItemsByTicket(ticketId) });
  } catch (error) {
    console.error('Error counting ticket items:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
