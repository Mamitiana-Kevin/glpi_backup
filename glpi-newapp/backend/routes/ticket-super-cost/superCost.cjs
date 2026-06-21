const express = require('express');
const router = express.Router();
const {
  getLastActiveCost,
  getTicketCost,
  getTotalSuperCost,
  getBaseForMode,
  insertCost,
  insertReopen,
  cancelLastActiveCost,
  getCostReportByItemtype,
} = require('../../services/ticketSuperCost.cjs');

// GET /backend/ticket-super-cost/total
router.get('/total', (req, res) => {
  try {
    const total = getTotalSuperCost();
    res.json(total);
  } catch (error) {
    console.error('Error fetching total super cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /backend/ticket-super-cost/report
router.get('/report', (req, res) => {
  try {
    const report = getCostReportByItemtype();
    res.json(report);
  } catch (error) {
    console.error('Error fetching cost report:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /backend/ticket-super-cost/:ticketId/last-active
router.get('/:ticketId/last-active', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const cost = getLastActiveCost(ticketId);
    res.json(cost || null);
  } catch (error) {
    console.error('Error fetching last active cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /backend/ticket-super-cost/:ticketId/base/:mode
router.get('/:ticketId/base/:mode', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const mode = parseInt(req.params.mode, 10);
    const base = getBaseForMode(ticketId, mode);
    res.json({ base });
  } catch (error) {
    console.error('Error fetching base for mode:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /backend/ticket-super-cost/:ticketId
router.get('/:ticketId', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const amount = getTicketCost(ticketId);
    res.json(amount);
  } catch (error) {
    console.error('Error fetching ticket cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /backend/ticket-super-cost
router.post('/', (req, res) => {
  try {
    const { ticketId, amount } = req.body;
    const result = insertCost(parseInt(ticketId, 10), parseFloat(amount));
    res.json(result);
  } catch (error) {
    console.error('Error saving cost:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /backend/ticket-super-cost/reopen
router.post('/reopen', (req, res) => {
  try {
    const { ticketId, amount, reopeningPct, reopenMode } = req.body;
    insertReopen(
      parseInt(ticketId, 10),
      parseFloat(amount),
      parseFloat(reopeningPct),
      parseInt(reopenMode, 10)
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving reopen:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /backend/ticket-super-cost/:ticketId/cancel
router.post('/:ticketId/cancel', (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const result = cancelLastActiveCost(ticketId);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling last active cost:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
