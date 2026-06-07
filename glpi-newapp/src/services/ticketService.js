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

export async function fetchTickets() {
  const response = await get('/Assistance/Ticket', {
    filter: 'is_deleted==0',
    limit: 100,
    sort: 'id',
    order: 'DESC'
  });
  console.log('TICKET EXEMPLE:', response.data[0]); // voir la structure d'un ticket
 
  return response.data;
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