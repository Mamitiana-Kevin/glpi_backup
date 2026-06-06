import { get } from '../api/glpiClient';

const ASSET_TYPES = [
  { key: 'Computer',         label: 'Ordinateur' },
  { key: 'Monitor',          label: 'Moniteur' },
  { key: 'Printer',          label: 'Imprimante' },
  { key: 'Phone',            label: 'Téléphone' },
  { key: 'Peripheral',       label: 'Périphérique' },
  { key: 'NetworkEquipment', label: 'Équip. réseau' },
  { key: 'Software',         label: 'Logiciel' },
];

export { ASSET_TYPES };

export async function fetchElements({ name = '', type = '', location = '' } = {}) {
  const typesToFetch = type
    ? ASSET_TYPES.filter((t) => t.key === type)
    : ASSET_TYPES;

  const results = await Promise.all(
    typesToFetch.map(async (assetType) => {
      try {
        const params = { limit: 50 };
        const filters = ['is_deleted==0']; // Par défaut, on ne prend que les actifs
        // Ajouter des wildcards '*' pour la recherche partielle avec ilike
        if (name)     filters.push(`name=ilike=*${name}*`);
        if (location) filters.push(`location.name=ilike=*${location}*`);
        
        if (filters.length > 0) {
          params.filter = filters.join(';');
        }

        console.log(`Fetching ${assetType.key} with filters:`, params.filter);
        // ← /Assets/ devant le type
        const response = await get(`/Assets/${assetType.key}`, params);
        const items = Array.isArray(response.data) ? response.data : [];

        return items.map((item) => ({
          id:        item.id,
          name:      item.name ?? '—',
          serial:    item.serial ?? '—',
          type:      assetType.key,
          typeLabel: assetType.label,
          // Accéder au nom de la localisation si c'est un objet
          location:  (typeof item.location === 'object' ? item.location?.name : item.location) ?? '—',
        }));
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}