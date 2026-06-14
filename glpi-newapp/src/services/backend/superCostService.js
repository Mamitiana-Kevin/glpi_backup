
import axios from 'axios';

const client = axios.create({
  baseURL: '/backend',
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchLastActiveCost(ticketId) {
  const response = await client.get(`/ticket-super-cost/${ticketId}/last-active`);
  return response.data;
}

export async function deactivateCost(ticketId, reopeningPct) {
  const response = await client.post('/ticket-super-cost/deactivate', { ticketId, reopeningPct });
  return response.data;
}

export async function saveCost(ticketId, amount, reopeningPct) {
  const response = await client.post('/ticket-super-cost', { ticketId, amount, reopeningPct });
  return response.data;
}

export async function fetchReopeningTotal(ticketId) {
  const response = await client.get(`/ticket-super-cost/${ticketId}/reopening-total`);
  return response.data;
}

export async function fetchCostReport() {
  const response = await client.get('/ticket-super-cost/report');
  return response.data;
}

