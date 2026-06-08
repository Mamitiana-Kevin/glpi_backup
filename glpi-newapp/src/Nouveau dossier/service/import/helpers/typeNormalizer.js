/**
 * Mappe les variations de noms (casse, fautes courantes, français) 
 * vers les types officiels de l'API GLPI.
 */
const TYPE_MAPPING = {
  // Ordinateurs
  'computer': 'Computer',
  'ordinateur': 'Computer',
  'pc': 'Computer',
  'computeur': 'Computer',
  
  // Moniteurs
  'monitor': 'Monitor',
  'moniteur': 'Monitor',
  'ecran': 'Monitor',
  
  // Périphériques
  'peripheral': 'Peripheral',
  'peripherique': 'Peripheral',
  
  // Imprimantes
  'printer': 'Printer',
  'imprimante': 'Printer',
  
  // Téléphones
  'phone': 'Phone',
  'telephone': 'Phone',
  'mobile': 'Phone',
  
  // Réseau
  'networkequipment': 'NetworkEquipment',
  'network': 'NetworkEquipment',
  'reseau': 'NetworkEquipment',
  'switch': 'NetworkEquipment',
  'router': 'NetworkEquipment',

  // Baies et Châssis
  'rack': 'Rack',
  'baie': 'Rack',
  'enclosure': 'Enclosure',
  'chassis': 'Enclosure',
  'pdu': 'PDU',

  // Équipements passifs
  'passivedcequipment': 'PassiveDCEquipment',
  'passiveequipment': 'PassiveDCEquipment',
  'passif': 'PassiveDCEquipment',
  'équipement passif': 'PassiveDCEquipment',

  // Câbles
  'cable': 'Cable',
  'câble': 'Cable',
  
  // Consommables et Cartouches
  'cartridgeitem': 'CartridgeItem',
  'cartouche': 'CartridgeItem',
  'cartridge': 'CartridgeItem',
  'consumableitem': 'ConsumableItem',
  'consommable': 'ConsumableItem',
  'consumable': 'ConsumableItem',

  // Logiciels
  'software': 'Software',
  'logiciel': 'Software',
  'softwarelicense': 'SoftwareLicense',
  'licence': 'SoftwareLicense',
  'licence logiciel': 'SoftwareLicense'
};

/**
 * Normalise un type d'item pour correspondre à l'API GLPI.
 * @param {string} rawType - Le type brut venant du CSV
 * @returns {string} - Le type normalisé (ex: "Computer")
 */
export function normalizeItemType(rawType) {
  if (!rawType) return '';
  
  const cleanType = rawType.trim().toLowerCase();
  
  // 1. Chercher dans le mapping
  if (TYPE_MAPPING[cleanType]) {
    return TYPE_MAPPING[cleanType];
  }
  
  // 2. Si pas dans le mapping, on tente une capitalisation standard
  // (ex: "PassiveEquipment" -> "PassiveEquipment" si déjà bien écrit mais mal cassé)
  // On capitalise la première lettre et on garde le reste tel quel
  return cleanType.charAt(0).toUpperCase() + cleanType.slice(1);
}
