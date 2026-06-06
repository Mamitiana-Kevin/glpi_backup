import { get } from '../api/glpiClient';

const ASSET_TYPES = [
  { key: 'Computer',         label: 'Ordinateurs' },
  { key: 'Monitor',          label: 'Moniteurs' },
  { key: 'Printer',          label: 'Imprimantes' },
  { key: 'Phone',            label: 'Téléphones' },
  { key: 'Peripheral',       label: 'Périphériques' },
  { key: 'NetworkEquipment', label: 'Équip. réseau' },
  { key: 'Software',         label: 'Logiciels' },
];

const TICKET_STATUSES = [
  { key: 1, label: 'Nouveau' },
  { key: 2, label: 'En cours (attribué)' },
  { key: 3, label: 'En cours (planifié)' },
  { key: 4, label: 'En attente' },
  { key: 5, label: 'Résolu' },
  { key: 6, label: 'Clos' },
];

// Récupère le total d'un endpoint via Content-Range (v2) ou X-Total-Count (legacy)
async function fetchCount(endpoint, params = {}) {
  const response = await get(endpoint, { limit: 1, ...params });
  
  // L'API v2 utilise Content-Range (ex: "0-0/42")
  const contentRange = response.headers['content-range'];
  if (contentRange) {
    const total = contentRange.split('/')[1];
    return parseInt(total ?? '0', 10);
  }

  // Fallback pour la legacy API
  const total = response.headers['x-total-count'];
  return parseInt(total ?? '0', 10);
}

// Récupère les stats de tous les assets
export async function fetchAssetStats() {
  const results = await Promise.all(
    ASSET_TYPES.map(async (type) => {
      try {
        // On ne prend que les éléments actifs (pas dans la corbeille)
        const count = await fetchCount(`/Assets/${type.key}`, {
          filter: 'is_deleted==0',
        });
        return { ...type, count };
      } catch {
        return { ...type, count: 0 };
      }
    })
  );

  const total = results.reduce((sum, item) => sum + item.count, 0);
  return { total, details: results };
}

// Récupère les stats des tickets par statut
export async function fetchTicketStats() {
  try {
    // On ne récupère que les tickets actifs (pas supprimés)
    const response = await get('/Assistance/Ticket', { 
      limit: 100,
      filter: 'is_deleted==0' 
    });
    const tickets = response.data || [];

    const stats = TICKET_STATUSES.map((status) => {
      const count = tickets.filter(t => {
        // Le statut peut être un objet {id: X, name: Y} ou juste l'ID
        const statusId = typeof t.status === 'object' ? t.status.id : t.status;
        return parseInt(statusId) === status.key;
      }).length;
      return { ...status, count };
    });

    const total = tickets.length;
    return { total, details: stats };
  } catch (error) {
    console.error("Erreur lors de la récupération des stats tickets:", error);
    return { total: 0, details: TICKET_STATUSES.map(s => ({ ...s, count: 0 })) };
  }
}