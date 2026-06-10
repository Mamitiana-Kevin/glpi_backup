import axios from 'axios';

const client = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
});

// Enregistrer un changement de statut
export async function saveTicketStatusHistory({ ticketId, ticketName, oldStatus, newStatus }) {
  const response = await client.post('/history/ticket-status', {
    ticketId,
    ticketName,
    oldStatus,
    newStatus,
  });
  return response.data;
}

// Tout l'historique
export async function fetchTicketStatusHistory() {
  const response = await client.get('/history/ticket-status');
  return response.data;
}

// Historique d'un ticket précis
export async function fetchTicketHistory(ticketId) {
  const response = await client.get(`/history/ticket-status/${ticketId}`);
  return response.data;
}