const express = require('express');
const cors = require('cors');
const { init } = require('./db.cjs');

const app = express();
const PORT = 8080;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

init().then(() => {
  const settingsRoutes = require('./routes/kanban/settings.cjs');
  const languagesRoutes = require('./routes/kanban/languages.cjs');
  const historyColorsRoutes = require('./routes/history/colors.cjs');
  const historyTicketStatusRoutes = require('./routes/history/ticketStatus.cjs');
  const ticketSuperCostRoutes = require('./routes/ticket-super-cost/superCost.cjs');
  const ticketItemRoutes = require('./routes/ticket-item/index.cjs');

  app.use('/backend/settings/kanban', settingsRoutes);
  app.use('/backend/settings/languages', languagesRoutes);
  app.use('/backend/history/colors', historyColorsRoutes);
  app.use('/backend/history/ticket-status', historyTicketStatusRoutes);
  app.use('/backend/ticket-super-cost', ticketSuperCostRoutes);
  app.use('/backend/ticket-item', ticketItemRoutes);

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
