const express = require('express');
const router = express.Router();
const { getAllLanguages, getLanguageCodes, getLanguage, saveLanguage, deleteLanguage } = require('../../services/kanbanLanguages.cjs');

router.get('/', (req, res) => res.json(getAllLanguages()));
router.get('/codes', (req, res) => res.json(getLanguageCodes()));
router.get('/:code', (req, res) => res.json(getLanguage(req.params.code)));
router.post('/', (req, res) => {
  const { code, labels = {} } = req.body;
  res.json(saveLanguage(code, labels));
});
router.delete('/:code', (req, res) => {
  try {
    deleteLanguage(req.params.code);
    res.status(204).send();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
