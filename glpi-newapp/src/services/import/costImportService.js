import { post } from '../../api/glpiClient';
import { parseCSV } from './helpers/csvParser';

function parseNumber(val) {
  if (!val) return 0;
  const num = parseFloat(val.toString().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

export async function importCosts(csvText, refToId) {
  const rows = parseCSV(csvText);
  const results = [];

  for (const row of rows) {
    try {
      const ticketId = refToId[row.Num_Ticket];
      if (!ticketId) {
        results.push({
          num_ticket: row.Num_Ticket,
          success: false,
          error: `Ticket avec la référence ${row.Num_Ticket} non trouvé dans l'import précédent`
        });
        continue;
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
      results.push({
        num_ticket: row.Num_Ticket,
        success: false,
        error: error.response?.data?.message || error.message
      });
    }
  }

  return results;
}
