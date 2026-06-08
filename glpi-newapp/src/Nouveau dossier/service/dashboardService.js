import { get, Legacy } from '../api/glpiClient';

const ASSET_TYPES = [
  { key: 'Computer',         label: 'Ordinateurs' },
  { key: 'Monitor',          label: 'Moniteurs' },
  { key: 'Printer',          label: 'Imprimantes' },
  { key: 'Phone',            label: 'Téléphones' },
  { key: 'Peripheral',       label: 'Périphériques' },
  { key: 'NetworkEquipment', label: 'Équip. réseau' },
  { key: 'Software',         label: 'Logiciels' },
];

const ALL_PARC_TYPES = [
  { key: 'Computer',           label: 'Ordinateurs' },
  { key: 'Monitor',            label: 'Moniteurs' },
  { key: 'Software',           label: 'Logiciels' },
  { key: 'NetworkEquipment',   label: 'Matériels réseau' },
  { key: 'Peripheral',         label: 'Périphériques' },
  { key: 'Printer',            label: 'Imprimantes' },
  { key: 'CartridgeItem',      label: 'Cartouches' },
  { key: 'ConsumableItem',     label: 'Consommables' },
  { key: 'Phone',              label: 'Téléphones' },
  { key: 'Rack',               label: 'Baies' },
  { key: 'Enclosure',          label: 'Châssis' },
  { key: 'PDU',                label: 'PDU' },
  { key: 'PassiveDCEquipment', label: 'Équipements passifs' },
  { key: 'Unmanaged',          label: 'Actifs non gérés' },
  { key: 'Cable',              label: 'Câbles' },
];

const TICKET_STATUSES = [
  { key: 1, label: 'Nouveau' },
  { key: 2, label: 'En cours (attribué)' },
  { key: 3, label: 'En cours (planifié)' },
  { key: 4, label: 'En attente' },
  { key: 5, label: 'Résolu' },
  { key: 6, label: 'Clos' },
];

const TICKET_TYPES = [
  { key: 1, label: 'Incidents' },
  { key: 2, label: 'Demandes' },
];

// Récupère le total d'un endpoint via Content-Range (v2) ou X-Total-Count (legacy)
async function fetchCount(endpoint, params = {}, useLegacy = false) {
  try {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

    const apiCall = useLegacy 
      ? Legacy.get(cleanEndpoint, { range: '0-0', get_full_count: true, is_recursive: 1, ...params }) 
      : get(cleanEndpoint, { limit: 1, ...params });
    
    const response = await apiCall;
    
    // 1. Tenter Content-Range (Standard GLPI pour v1 et v2)
    const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
    if (contentRange) {
      const parts = contentRange.split('/');
      const total = parts[parts.length - 1];
      if (total !== undefined && total !== '*') {
        return parseInt(total, 10);
      }
    }

    // 2. Tenter X-Total-Count
    const totalCount = response.headers['x-total-count'] || response.headers['X-Total-Count'];
    if (totalCount !== undefined) return parseInt(totalCount, 10);

    // 3. Tenter de trouver le total dans le corps de la réponse
    if (response.data && typeof response.data === 'object') {
      if (response.data.total !== undefined) return parseInt(response.data.total, 10);
      if (response.data.count !== undefined && Array.isArray(response.data.data)) {
        return parseInt(response.data.total || response.data.count, 10);
      }
    }

    // 4. Fallback : longueur du tableau
    if (Array.isArray(response.data)) {
      return response.data.length;
    }
    
    return 0;
  } catch (error) {
    console.error(`Erreur comptage pour ${endpoint}:`, error.message);
    return 0;
  }
}

// Récupère les stats de tous les assets (API V2)
export async function fetchAssetStats() {
  const results = await Promise.all(
    ASSET_TYPES.map(async (type) => {
      const count = await fetchCount(`Assets/${type.key}`, { filter: 'is_deleted==0' });
      return { ...type, count };
    })
  );

  const total = results.reduce((sum, item) => sum + item.count, 0);
  return { total, details: results };
}

// Récupère les stats des tickets par statut
export async function fetchTicketStats() {
  try {
    const total = await fetchCount('Assistance/Ticket', { filter: 'is_deleted==0' });
    
    const response = await get('Assistance/Ticket', { 
      limit: 100,
      filter: 'is_deleted==0' 
    });
    const tickets = Array.isArray(response.data) ? response.data : (response.data?.data || []);

    const stats = TICKET_STATUSES.map((status) => {
      const count = tickets.filter(t => {
        const statusId = typeof t.status === 'object' ? t.status.id : t.status;
        return parseInt(statusId) === status.key;
      }).length;
      return { ...status, count };
    });

    return { total, details: stats };
  } catch (error) {
    console.error("Erreur lors de la récupération des stats tickets:", error);
    return { total: 0, details: TICKET_STATUSES.map(s => ({ ...s, count: 0 })) };
  }
}

// Récupère les stats des tickets par TYPE (Incident / Demande)
export async function fetchTicketTypeStats() {
  try {
    const response = await get('Assistance/Ticket', { 
      limit: 100,
      filter: 'is_deleted==0' 
    });
    const tickets = Array.isArray(response.data) ? response.data : (response.data?.data || []);

    const stats = TICKET_TYPES.map((type) => {
      const count = tickets.filter(t => {
        const typeId = typeof t.type === 'object' ? t.type.id : t.type;
        return parseInt(typeId) === type.key;
      }).length;
      return { ...type, count };
    });

    return { details: stats };
  } catch (error) {
    console.error("Erreur lors de la récupération des stats par type:", error);
    return { details: TICKET_TYPES.map(t => ({ ...t, count: 0 })) };
  }
}

/**
 * Récupère les statistiques de TOUT le parc via l'API Legacy.
 * Retourne un tableau d'objets { key, label, count }
 */
export async function fetchAllLegacy() {
  const results = await Promise.all(
    ALL_PARC_TYPES.map(async (type) => {
      const count = await fetchCount(type.key, { is_deleted: 0, is_recursive: 1 }, true);
      return { ...type, count };
    })
  );

  const total = results.reduce((sum, item) => sum + item.count, 0);
  return { total, details: results };
}