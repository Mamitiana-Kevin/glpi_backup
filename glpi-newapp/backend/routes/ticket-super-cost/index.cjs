const express = require('express');
const router = express.Router();
const superCostRoutes = require('./superCost.cjs');

router.use('/', superCostRoutes);

module.exports = router;
