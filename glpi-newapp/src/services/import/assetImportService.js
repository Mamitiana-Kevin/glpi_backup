import { post } from '../../api/glpiClient';
import { lookupCache } from './helpers/lookupCache';
import { parseCSV } from './helpers/csvParser';
import { normalizeItemType } from './helpers/typeNormalizer';

export async function importAssets(csvText) {
  const rows = parseCSV(csvText);
  const results = [];
  const nameToItem = {};

  for (const row of rows) {
    try {
      const itemType = normalizeItemType(row.Item_Type);
      
      const statusId = await lookupCache.resolveDropdown('State', row.Status);
      const locationId = await lookupCache.resolveDropdown('Location', row.Location);
      const manufacturerId = await lookupCache.resolveDropdown('Manufacturer', row.Manufacturer);
      
      // Exception : Software et d'autres types n'ont pas de "Modèles" dans GLPI
      const typesWithModels = [
        'Computer', 'Monitor', 'Peripheral', 'Printer', 'Phone', 
        'NetworkEquipment', 'PassiveEquipment', 'Rack', 'Enclosure', 'PDU'
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

      // URL dynamique : Software et SoftwareLicense ne sont pas sous /Assets/
      const isTopLevel = ['Software', 'SoftwareLicense'].includes(itemType);
      const url = isTopLevel ? `/${itemType}` : `/Assets/${itemType}`;

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
      results.push({
        name: row.Name,
        success: false,
        id: null,
        itemtype: row.Item_Type,
        error: error.response?.data?.message || error.message
      });
    }
  }

  return {
    results,
    nameToItem
  };
}
