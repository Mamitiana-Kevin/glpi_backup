const express = require('express');
const router = express.Router();
const colorsRoutes = require('./colors.cjs');
const ticketStatusRoutes = require('./ticketStatus.cjs');

router.use('/colors', colorsRoutes);
router.use('/ticket-status', ticketStatusRoutes);

module.exports = router;
