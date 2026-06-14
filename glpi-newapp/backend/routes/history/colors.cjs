const express = require('express');
const router = express.Router();
const { getAllHistory, getHistoryByStatusId, deleteAllHistory } = require('../../services/kanbanColorsHistory.cjs');

router.get('/', (req, res) => res.json(getAllHistory()));
router.get('/:statusId', (req, res) => {
  const statusId = parseInt(req.params.statusId, 10);
  res.json(getHistoryByStatusId(statusId));
});
router.delete('/', (req, res) => {
  deleteAllHistory();
  res.status(204).send();
});

module.exports = router;
