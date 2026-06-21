import { post, put, Legacy } from '../../api/glpiClient';
import { parseCSV } from './helpers/csvParser';

const TICKET_STATUS_MAP = { 
  New: 1, 
  'En cours': 2, 
  Assigned: 2,
  Planned: 3,
  'En attente': 4, 
  Pending: 4,
  Résolu: 5, 
  Solved: 5,
  Clos: 6,
  Closed: 6
};
const TICKET_PRIORITY_MAP = { 
  Low: 2, 
  Medium: 3, 
  High: 4, 
  'Very High': 5, 
  Urgent: 5 
};
const TICKET_TYPE_MAP = { Incident: 1, Demande: 2, Request: 2 };

function formatDate(dateStr, heureStr) {
  if (!dateStr) return null;
  // Format DD/MM/YYYY -> YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  const time = heureStr || "00:00";
  return `${isoDate} ${time}:00`;
}

function parseItems(cell) {
  if (!cell) return [];
  // Nettoyer ["PC-ADM-001","MN-FORM-002"]
  const cleaned = cell.replace(/[\[\]"]/g, '');
  if (!cleaned.trim()) return [];
  return cleaned.split(',').map(s => s.trim());
}

export async function importTickets(csvText, nameToItem, onProgress = () => {}) {
  const rows = parseCSV(csvText);
  const results = [];
  const refToId = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress(`Importation ticket ${i + 1}/${rows.length} : ${row.Titre}`);
    try {
      const level = TICKET_PRIORITY_MAP[row.Priority] ?? 3;
      const payload = {
        name: row.Titre,
        content: row.Description || ' ',
        type: TICKET_TYPE_MAP[row.Type] ?? 1,
        status: { id: 1 }, // ÉTAPE 1 : Toujours créer en tant que "Nouveau"
        urgency: level,
        impact: level,
        priority: level,
        date: formatDate(row.Date, row.Heure),
      };

      const { data } = await post('/Assistance/Ticket', payload);
      const ticketId = data.id;
      refToId[row.Ref_Ticket] = ticketId;
      await Legacy.put(`Ticket/${ticketId}`, {
        externalid: row.Ref_Ticket
      });
      const items = parseItems(row.Items);
      const warnings = [];

      // ÉTAPE 2 : Lier les items
      for (const itemName of items) {
        const item = nameToItem[itemName];
        if (item) {
          await Legacy.post('Item_Ticket', {
            tickets_id: ticketId,
            items_id: item.id,
            itemtype: item.itemtype
          });
          // console.log(ticketId);
        } else {
          warnings.push(`Item non trouvé: ${itemName}`);
        }
      }

      // ÉTAPE 3 : Mettre à jour vers le statut final si différent de "Nouveau"
      const finalStatusId = TICKET_STATUS_MAP[row.Status] ?? 1;
      if (finalStatusId !== 1) {
        // Utilisation de l'API Legacy car la V2 peut être capricieuse sur les updates de tickets
        await Legacy.put(`Ticket/${ticketId}`, {
          status: finalStatusId
        });
      }

      results.push({
        ref: row.Ref_Ticket,
        success: true,
        id: ticketId,
        error: warnings.length > 0 ? warnings.join(', ') : null
      });
    } catch (error) {
      console.error(`Error importing ticket ${row.Ref_Ticket}:`, error);
      throw new Error(`Échec critique sur le ticket ${row.Ref_Ticket} : ${error.response?.data?.message || error.message}`);
    }
  }

  return {
    results,
    refToId
  };
}
