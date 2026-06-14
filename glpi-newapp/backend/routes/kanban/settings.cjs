const express = require('express');
const router = express.Router();
const { fetchSettings, saveSettings } = require('../../services/kanbanSettings.cjs');

router.get('/', (req, res) => res.json(fetchSettings()));
router.post('/', (req, res) => {
  const { settings = {}, changedBy = 'admin' } = req.body;
  res.json(saveSettings(settings, changedBy));
});

module.exports = router;
