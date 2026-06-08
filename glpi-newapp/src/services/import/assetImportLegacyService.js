import { Legacy } from '../../api/glpiClient';
import { lookupCache } from './helpers/lookupCache';
import { parseCSV } from './helpers/csvParser';
import { normalizeItemType } from './helpers/typeNormalizer';

const TYPES_WITHOUT_MODEL = [
  'Software',
  'Cable',
  'CartridgeItem',
  'ConsumableItem',
];

const MODEL_FIELD_MAP = {
  Computer:           'computermodels_id',
  Monitor:            'monitormodels_id',
  Printer:            'printermodels_id',
  Phone:              'phonemodels_id',
  Peripheral:         'peripheralmodels_id',
  NetworkEquipment:   'networkequipmentmodels_id',
  Rack:               'rackmodels_id',
  Enclosure:          'enclosuremodels_id',
  PDU:                'pdumodels_id',
  PassiveDCEquipment: 'passivedcequipmentmodels_id',
};

const MODEL_TYPE_MAP = {
  Computer:           'ComputerModel',
  Monitor:            'MonitorModel',
  Printer:            'PrinterModel',
  Phone:              'PhoneModel',
  Peripheral:         'PeripheralModel',
  NetworkEquipment:   'NetworkEquipmentModel',
  Rack:               'RackModel',
  Enclosure:          'EnclosureModel',
  PDU:                'PDUModel',
  PassiveDCEquipment: 'PassiveDCEquipmentModel',
};

export async function importAssetsLegacy(csvText, onProgress = () => {}) {
  const rows = parseCSV(csvText);
  const results = [];
  const nameToItem = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.Item_Type) continue;

    onProgress(`Importation asset Legacy ${i + 1}/${rows.length} : ${row.Name}`);
    
    try {
      const itemType = normalizeItemType(row.Item_Type);
      
      // Statut : si vide, on prend "New" par défaut
      const statusName = row.Status || 'New';
      const statusId = await lookupCache.resolveDropdown('State', statusName);
      
      const locationId     = await lookupCache.resolveDropdown('Location', row.Location);
      const manufacturerId = await lookupCache.resolveDropdown('Manufacturer', row.Manufacturer);
      const userId         = await lookupCache.resolveUser(row.User);

      // Modèle — seulement si le type en a un
      let modelId = null;
      if (!TYPES_WITHOUT_MODEL.includes(itemType) && row.Model) {
        const glpiModelType = MODEL_TYPE_MAP[itemType];
        if (glpiModelType) {
          modelId = await lookupCache.resolveDropdown(glpiModelType, row.Model);
        }
      }

      // Construction du payload Legacy (champs PLATS)
      const payload = {
        name: row.Name,
        otherserial: row.Inventory_Number || '',
      };

      if (statusId)       payload.states_id        = statusId;
      if (locationId)     payload.locations_id      = locationId;
      if (manufacturerId) payload.manufacturers_id  = manufacturerId;
      if (userId)         payload.users_id           = userId;
      
      if (modelId) {
        const modelField = MODEL_FIELD_MAP[itemType] 
          ?? `${itemType.toLowerCase()}models_id`;
        payload[modelField] = modelId;
      }

      // Appel API Legacy
      const response = await Legacy.post(itemType, payload);
      const id = response.data?.id ?? response.data?.[0]?.id;

      if (!id) {
        throw new Error("Échec de récupération de l'ID après création Legacy");
      }

      const result = {
        name: row.Name,
        success: true,
        id,
        itemtype: itemType,
        error: null
      };

      results.push(result);
      nameToItem[row.Name] = { id, itemtype: itemType };

    } catch (error) {
      console.error(`Error importing asset Legacy ${row.Name}:`, error);
      // Logique tout ou rien : on throw l'erreur pour arrêter l'orchestrateur
      throw new Error(`Échec critique Legacy sur l'asset ${row.Name} : ${error.response?.data?.message || error.message}`);
    }
  }

  return {
    results,
    nameToItem
  };
}
