const express = require('express');
const router = express.Router();
const { resetSqliteDb } = require('../../services/resetSqlite.cjs');

router.delete('/', async (req, res) => {
  try {
    const result = await resetSqliteDb();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
