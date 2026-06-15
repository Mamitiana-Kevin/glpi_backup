const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../glpi_data.db');

async function resetSqliteDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      return { success: true, message: 'Base de données SQLite supprimée avec succès' };
    } else {
      return { success: true, message: 'Base de données SQLite n\'existait pas' };
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de la base de données SQLite:', error);
    throw error;
  }
}

module.exports = { resetSqliteDb };
