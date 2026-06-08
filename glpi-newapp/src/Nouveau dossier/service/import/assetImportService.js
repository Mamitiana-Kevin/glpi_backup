import { post } from '../../api/glpiClient';
import { lookupCache } from './helpers/lookupCache';
import { parseCSV } from './helpers/csvParser';
import { normalizeItemType } from './helpers/typeNormalizer';

export async function importAssets(csvText, onProgress = () => {}) {
  const rows = parseCSV(csvText);
  const results = [];
  const nameToItem = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress(`Importation asset ${i + 1}/${rows.length} : ${row.Name}`);
    try {
      const itemType = normalizeItemType(row.Item_Type);
      
      // Statut : si vide, on prend "New" par défaut
      const statusName = row.Status || 'New';
      const statusId = await lookupCache.resolveDropdown('State', statusName);
      
      const locationId = await lookupCache.resolveDropdown('Location', row.Location);
      const manufacturerId = await lookupCache.resolveDropdown('Manufacturer', row.Manufacturer);
      
      // Exception : Software et d'autres types n'ont pas de "Modèles" dans GLPI
      const typesWithModels = [
        'Computer', 'Monitor', 'Peripheral', 'Printer', 'Phone', 
        'NetworkEquipment', 'PassiveDCEquipment', 'Rack', 'Enclosure', 'PDU'
      ];
      let modelId = null;
      if (typesWithModels.includes(itemType)) {
        modelId = await lookupCache.resolveDropdown(`${itemType}Model`, row.Model);
      }
      
      const userId = await lookupCache.resolveUser(row.User);

      const payload = {
        name: row.Name,
        otherserial: row.Inventory_Number,
        ...(statusId && { status: { id: statusId } }),
        ...(locationId && { location: { id: locationId } }),
        ...(manufacturerId && { manufacturer: { id: manufacturerId } }),
        ...(modelId && { model: { id: modelId } }),
        ...(userId && { user: { id: userId } }),
      };

      // URL dynamique : Certains types ne sont pas sous /Assets/
      const topLevelTypes = ['Software', 'SoftwareLicense', 'CartridgeItem', 'ConsumableItem'];
      const isTopLevel = topLevelTypes.some(t => t.toLowerCase() === itemType.toLowerCase());
      
      // On utilise le type normalisé pour l'URL
      const urlType = isTopLevel 
        ? topLevelTypes.find(t => t.toLowerCase() === itemType.toLowerCase())
        : itemType;
        
      const url = isTopLevel ? `/${urlType}` : `/Assets/${urlType}`;

      const { data } = await post(url, payload);
      
      const result = {
        name: row.Name,
        success: true,
        id: data.id,
        itemtype: itemType,
        error: null
      };
      
      results.push(result);
      nameToItem[row.Name] = { id: data.id, itemtype: itemType };
    } catch (error) {
      console.error(`Error importing asset ${row.Name}:`, error);
      // Logique tout ou rien : on throw l'erreur pour arrêter l'orchestrateur
      throw new Error(`Échec critique sur l'asset ${row.Name} : ${error.response?.data?.message || error.message}`);
    }
  }

  return {
    results,
    nameToItem
  };
}
