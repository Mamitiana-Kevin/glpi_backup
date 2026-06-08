import { post } from '../../api/glpiClient';
import { parseCSV } from './helpers/csvParser';

function parseNumber(val) {
  if (!val) return 0;
  const num = parseFloat(val.toString().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

export async function importCosts(csvText, refToId, onProgress = () => {}) {
  const rows = parseCSV(csvText);
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress(`Importation coût ${i + 1}/${rows.length} pour ticket ${row.Num_Ticket}`);
    try {
      const ticketId = refToId[row.Num_Ticket];
      if (!ticketId) {
        throw new Error(`Ticket avec la référence ${row.Num_Ticket} non trouvé dans l'import précédent`);
      }

      const payload = {
        name: "Intervention",
        duration: parseNumber(row.Duration_second),
        cost_time: parseNumber(row.Time_Cost),
        cost_fixed: parseNumber(row.Fixed_Cost),
        cost_material: 0,
      };

      await post(`/Assistance/Ticket/${ticketId}/Cost`, payload);

      results.push({
        num_ticket: row.Num_Ticket,
        success: true,
        error: null
      });
    } catch (error) {
      console.error(`Error importing cost for ticket ${row.Num_Ticket}:`, error);
      throw new Error(`Échec critique sur le coût du ticket ${row.Num_Ticket} : ${error.response?.data?.message || error.message}`);
    }
  }

  return results;
}
