import { post,get } from '../api/glpiClient';
import { Legacy } from '../api/glpiClient';

export async function createTicket({ name, content, type, urgency, impact, priority }) {
  const response = await post('/Assistance/Ticket', {
    name,
    content,
    type,
    urgency,
    impact,
    priority,
    status: 1, // Nouveau par défaut
  });
  // L'API v2 retourne l'objet directement dans data, qui contient l'id
  return response.data;
}

export async function associateElementToTicket(ticketId, itemtype, itemId) {
  // On utilise l'API Legacy pour la relation car la v2 est instable sur ce point
  const response = await Legacy.post('/Item_Ticket', {
    itemtype,
    items_id: itemId,
    tickets_id: ticketId,
  });
  return response.data;
}

export async function associateMultipleElements(ticketId, elements) {
  const results = await Promise.allSettled(
    elements.map((el) =>
      associateElementToTicket(ticketId, el.type, el.id)
    )
  );
  return results;
}

export async function fetchTickets({ searchText = '', status = '' } = {}) {
  // On construit les filtres un par un
  let filters = [];
  
  // Le filtre is_deleted est souvent nécessaire pour éviter les éléments en corbeille
  filters.push('is_deleted==0');

  if (status) {
    filters.push(`status==${status}`);
  }

  // Pour la recherche, si on en a une, on l'ajoute
  if (searchText) {
    // On essaie la syntaxe standard RSQL pour le like case-insensitive
    filters.push(`name=ilike=*${searchText}*`);
  }

  const filterString = filters.join(';');
  console.log('Final Ticket Filter:', filterString);

  try {
    const response = await get('/Assistance/Ticket', {
      filter: filterString,
      limit: 100,
      sort: 'id',
      order: 'DESC'
    });
    
    return Array.isArray(response.data) ? response.data : (response.data?.data || []);
  } catch (error) {
    console.error('RSQL Filter Error:', error.message);
    
    // Si ça échoue, on essaie sans le filtre de recherche (juste is_deleted et status)
    try {
      const fallbackFilters = ['is_deleted==0'];
      if (status) fallbackFilters.push(`status==${status}`);
      
      const response = await get('/Assistance/Ticket', {
        filter: fallbackFilters.join(';'),
        limit: 500, // On augmente la limite pour le filtrage local
        sort: 'id',
        order: 'DESC'
      });
      
      let tickets = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      
      // Si on avait une recherche, on l'applique en local puisqu'elle a échoué côté API
      if (searchText) {
        const s = searchText.toLowerCase();
        tickets = tickets.filter(t => 
          (t.name && t.name.toLowerCase().includes(s)) || 
          (t.content && t.content.toLowerCase().includes(s))
        );
      }
      return tickets;
    } catch (e) {
      // Fallback ultime : vraiment aucun filtre
      const lastResort = await get('/Assistance/Ticket', { limit: 500 });
      return Array.isArray(lastResort.data) ? lastResort.data : (lastResort.data?.data || []);
    }
  }
}
export async function fetchTicketDetails(ticketId) {
  const ticketResponse = await get(`/Assistance/Ticket/${ticketId}`);
  const ticket = ticketResponse.data;

  let items = [];
  try {
    const itemsResponse = await Legacy.get(`/Ticket/${ticketId}/Item_Ticket`, {
      expand_dropdowns: true
    });
    const raw = Array.isArray(itemsResponse.data) ? itemsResponse.data : [];
    items = raw.map(link => ({
      id: link.id,
      item_name: link.items_id,   // "PC-ADM-001"
      itemtype: link.itemtype,    // "Computer"
    }));
  } catch (e) {
    console.error("Erreur items", e);
  }

  return { ...ticket, linked_items: items };
}

// ── Fonctions Kanban ─────────────────────────────────────────────

export const KANBAN_STATUSES = [
  { id: 1, label: 'Nouveau',  color: '#3b82f6' },
  { id: 2, label: 'En cours', color: '#f59e0b' },
  { id: 5, label: 'Résolu',   color: '#16a34a' },
];

// Récupérer les tickets groupés par statut
// Récupérer les tickets groupés par statut — Legacy V1
export async function fetchKanbanTickets() {
  const results = await Promise.all(
    KANBAN_STATUSES.map(async (status) => {
      try {
        const response = await Legacy.get('/Ticket', {
          'searchText[status]': status.id,
          is_deleted: 0,
          limit: 100,
          sort: 'id',
          order: 'DESC',
        });

        const items = Array.isArray(response.data) ? response.data : [];

        return {
          statusId: status.id,
          tickets: items.map((t) => ({
            id:       t.id,
            name:     t.name ?? '—',
            content:  t.content ?? '',
            status:   t.status,
            type:     t.type,
            priority: t.priority,
            urgency:  t.urgency,
            date:     t.date_creation,
          })),
        };
      } catch {
        return { statusId: status.id, tickets: [] };
      }
    })
  );

  return results.reduce((acc, { statusId, tickets }) => {
    acc[statusId] = tickets;
    return acc;
  }, {});
}
// Changer statut via Legacy
export async function updateTicketStatus(ticketId, newStatus) {
  const response = await Legacy.put(`/Ticket/${ticketId}`, {
    status: newStatus,
  });
  console.log('Update Ticket Status:', response.data, newStatus);
  return response.data;
}

/**
 * Calcule le coût GLPI total d'un ticket réparti par itemtype
 * @param {number} ticketId
 * @returns {Object} { Computer: 45.5, Phone: 45.5, ... }
 */
export async function fetchGlpiCostByItemtype(ticketId) {
  // 1. Récupérer les items liés au ticket
  const itemsRes = await Legacy.get(`/Ticket/${ticketId}/Item_Ticket`);
  const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
  if (items.length === 0) return {};

  // 2. Récupérer les coûts GLPI du ticket
  const costsRes = await Legacy.get(`/Ticket/${ticketId}/TicketCost`);
  const costs = Array.isArray(costsRes.data) ? costsRes.data : [];
  if (costs.length === 0) return {};

  // 3. Sommer cost_fixed + cost_material + cost_time pour chaque entrée
  const totalCost = costs.reduce((sum, c) => {
    const heures = (parseFloat(c.actiontime) || 0) / 3600;
    const coutTemps = heures * (parseFloat(c.cost_time) || 0);
    return sum + (parseFloat(c.cost_fixed) || 0)
              + (parseFloat(c.cost_material) || 0)
              + coutTemps;
  }, 0);

  // 4. Répartir équitablement entre les items
  const costPerItem = totalCost / items.length;
  const result = {};
  for (const item of items) {
    result[item.itemtype] = (result[item.itemtype] || 0) + costPerItem;
  }

  return result;
}
