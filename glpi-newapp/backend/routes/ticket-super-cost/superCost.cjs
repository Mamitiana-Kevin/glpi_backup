
const express = require('express');
const router = express.Router();
const {
  getLastActiveCost,
  getLastInactiveCost,
  deactivateLastCost,
  insertCost,
  getTotalReopeningCost,
  getCostReportByItemtype
} = require('../../services/ticketSuperCost.cjs');

router.get('/:ticketId/last-active', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    res.json(getLastActiveCost(ticketId));
  } catch (error) {
    console.error('Error fetching last active cost:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/deactivate', (req, res) => {
  try {
    const { ticketId, reopeningPct } = req.body;
    deactivateLastCost(ticketId, reopeningPct);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deactivating cost:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { ticketId, amount, reopeningPct } = req.body;
    const result = insertCost(ticketId, amount, reopeningPct);
    res.json(result);
  } catch (error) {
    console.error('Error inserting cost:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/report', (req, res) => {
  try {
    res.json(getCostReportByItemtype());
  } catch (error) {
    console.error('Error fetching cost report:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:ticketId/reopening-total', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    res.json({ total: getTotalReopeningCost(ticketId) });
  } catch (error) {
    console.error('Error fetching reopening total:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

