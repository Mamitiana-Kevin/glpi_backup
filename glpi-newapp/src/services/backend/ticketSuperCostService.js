import axios from 'axios';

const client = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
});

export async function saveSuperCost(ticketId, superCost) {
  const response = await client.post('/ticket-super-cost', {
    ticketId,
    superCost,
  });
  return response.data;
}

export async function getTotalSuperCost() {
  const response = await client.get('/ticket-super-cost/total');
  return response.data;
}
