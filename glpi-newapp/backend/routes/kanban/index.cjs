const express = require('express');
const router = express.Router();
const settingsRoutes = require('./settings.cjs');
const languagesRoutes = require('./languages.cjs');

router.use('/settings', settingsRoutes);
router.use('/languages', languagesRoutes);

module.exports = router;
