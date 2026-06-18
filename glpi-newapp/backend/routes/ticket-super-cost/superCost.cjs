
const express = require('express');
const router = express.Router();
const {
  getLastActiveCost,
  getLastInactiveCost,
  deactivateLastCost,
  insertCost,
  getTotalReopeningCost,
  getCostReportByItemtype,
  cancelLastActiveCost,
  getTicketCost,
  getTotalSuperCost,
  updateReopeningPercentage
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

router.post('/:ticketId/cancel', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const cancelled = cancelLastActiveCost(ticketId);
    res.json({ success: true, cancelled });
  } catch (error) {
    console.error('Error cancelling last active cost:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:ticketId/update-reopening-pct', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const { reopeningPct } = req.body;
    updateReopeningPercentage(ticketId, reopeningPct);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating reopening percentage:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/total', (req, res) => {
  try {
    res.json(getTotalSuperCost());
  } catch (error) {
    console.error('Error fetching total super cost:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:ticketId', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const cost = getTicketCost(ticketId);
    res.json({ superCost: cost });
  } catch (error) {
    console.error('Error fetching ticket cost:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

