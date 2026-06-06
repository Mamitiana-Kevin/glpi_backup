import { post } from '../api/glpiClient';
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