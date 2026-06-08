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