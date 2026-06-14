const express = require('express');
const cors = require('cors');
const { init } = require('./db.cjs');

const app = express();
const PORT = 8080;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

init().then(() => {
  const settingsRoutes      = require('./routes/settings.cjs');
  const historyRoutes       = require('./routes/history.cjs');
  const ticketSuperCostRoutes = require('./routes/ticketSuperCost.cjs');

  app.use('/backend/settings',          settingsRoutes);
  app.use('/backend/history',           historyRoutes);
  app.use('/backend/ticket-super-cost', ticketSuperCostRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: PORT, db: 'glpi_data.db' });
  });

  app.listen(PORT, () => {
    console.log(`✅ GLPI Express Backend lancé sur http://localhost:${PORT}`);
  });

}).catch(err => {
  console.error('❌ Échec initialisation SQLite :', err);
  process.exit(1);
});
