const express = require('express');
const router = express.Router();
const { addEntry, getAllEntries, getEntriesByTicketId, deleteAllEntries } = require('../../services/ticketStatusHistory.cjs');

router.post('/', (req, res) => {
  try {
    const { ticketId, ticketName, oldStatus, newStatus } = req.body;
    console.log('Received ticket status change:', { ticketId, ticketName, oldStatus, newStatus });
    const result = addEntry(ticketId, ticketName, oldStatus, newStatus);
    res.json(result);
  } catch (error) {
    console.error('Error saving ticket status history:', error);
    res.status(500).json({ error: error.message });
  }
});
router.get('/', (req, res) => {
  try {
    res.json(getAllEntries());
  } catch (error) {
    console.error('Error fetching all entries:', error);
    res.status(500).json({ error: error.message });
  }
});
router.get('/:ticketId', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    res.json(getEntriesByTicketId(ticketId));
  } catch (error) {
    console.error('Error fetching entries by ticket id:', error);
    res.status(500).json({ error: error.message });
  }
});
router.delete('/', (req, res) => {
  try {
    deleteAllEntries();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting all entries:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
