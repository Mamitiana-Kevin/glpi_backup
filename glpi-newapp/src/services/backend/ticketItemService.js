
import axios from 'axios';

const client = axios.create({
  baseURL: '/backend',
  headers: { 'Content-Type': 'application/json' },
});

export async function saveTicketItems(ticketId, items) {
  const response = await client.post('/ticket-item', { ticketId, items });
  return response.data;
}

export async function fetchTicketItems(ticketId) {
  const response = await client.get(`/ticket-item/${ticketId}`);
  return response.data;
}

export async function fetchTicketItemCount(ticketId) {
  const response = await client.get(`/ticket-item/${ticketId}/count`);
  return response.data;
}
