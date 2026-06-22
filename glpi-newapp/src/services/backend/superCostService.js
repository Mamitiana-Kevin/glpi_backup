
import axios from 'axios';

const client = axios.create({
  baseURL: '/backend',
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchLastActiveCost(ticketId) {
  const response = await client.get(`/ticket-super-cost/${ticketId}/last-active`);
  return response.data;
}

export async function saveCost(ticketId, amount) {
  const response = await client.post('/ticket-super-cost', { ticketId, amount });
  return response.data;
}

export async function fetchCostReport() {
  const response = await client.get('/ticket-super-cost/report');
  return response.data;
}

export async function cancelLastActiveCost(ticketId) {
  const response = await client.post(`/ticket-super-cost/${ticketId}/cancel`);
  return response.data;
}

export async function getTotalSuperCost() {
  const response = await client.get('/ticket-super-cost/total');
  return response.data;
}

export async function fetchTicketCost(ticketId) {
  const response = await client.get(`/ticket-super-cost/${ticketId}`);
  return response.data;
}

/**
 * Récupère le montant de base selon le mode choisi pour un ticket.
 * Mode 1 : dernier close, 2 : premier close, 3 : total, 4 : moyenne
 */
export async function fetchBaseForMode(ticketId, mode) {
  const response = await client.get(`/ticket-super-cost/${ticketId}/base/${mode}`);
  return response.data.base;
}

/**
 * Enregistre une réouverture.
 * Le calcul amount = pct/100 * base doit être fait avant d'appeler cette fonction.
 */
export async function saveReopen(ticketId, amount, reopeningPct, reopenMode) {
  const response = await client.post('/ticket-super-cost/reopen', {
    ticketId,
    amount,
    reopeningPct,
    reopenMode,
  });
  return response.data;
}

export async function fetchAllReopens() {
  const response = await client.get('/ticket-super-cost/reopens');
  return response.data;
}

export async function updateReopen(id, reopeningPct, reopenMode) {
  const response = await client.put(`/ticket-super-cost/reopens/${id}`, { reopeningPct, reopenMode });
  return response.data;
}



export async function fetchAllCloseCosts() {
  const response = await client.get('/ticket-super-cost/closes');
  return response.data;
}

export async function updateCloseCost(id, amount) {
  const response = await client.put(`/ticket-super-cost/closes/${id}`, { amount });
  return response.data;
}
