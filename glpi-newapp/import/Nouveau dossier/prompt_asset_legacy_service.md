# Prompt — Création de assetImportLegacyService.js

Tu vas créer un nouveau fichier `assetImportLegacyService.js` dans `src/services/import/`.
Ce fichier est une alternative à `assetImportService.js` qui utilise l'API V2.
La logique est identique, seule la façon d'envoyer les données change (Legacy vs V2).
NE PAS modifier les fichiers existants sauf `importOrchestrator.js`.

---

## RÈGLES ABSOLUES

1. Utiliser UNIQUEMENT `Legacy` depuis `../../api/glpiClient` pour les appels d'import :
   ```javascript
   import { Legacy } from '../../api/glpiClient';
   ```

2. `Legacy.post()` wrappe DÉJÀ automatiquement dans `{ input: data }`.
   NE JAMAIS faire `Legacy.post(url, { input: data })` → double wrap.

3. Avec l'API Legacy, les clés étrangères sont des CHAMPS PLATS avec suffixe `_id` :
   - PAS d'objets imbriqués comme la V2
   - Exemple : `states_id: 2` et NON `status: { id: 2 }`

4. L'endpoint Legacy pour créer un asset est simplement :
   ```
   POST /apirest.php/{ItemType}
   ```
   Exemple : `Legacy.post('Computer', { name: '...', states_id: 2 })`

5. Réutiliser `lookupCache` tel quel — il utilise déjà la Legacy en interne.

---

## FICHIER À CRÉER — assetImportLegacyService.js

Emplacement : `src/services/import/assetImportLegacyService.js`

```javascript
import { Legacy } from '../../api/glpiClient';
import { lookupCache } from './helpers/lookupCache';
import { parseCSV } from './helpers/csvParser';
```

---

## Types sans modèle

Ces types n'ont pas de champ modèle dans GLPI — ne pas appeler resolveDropdown pour eux :
```javascript
const TYPES_WITHOUT_MODEL = [
  'Software',
  'Cable',
  'CartridgeItem',
  'ConsumableItem',
];
```

---

## Mapping des champs modèle par type

Chaque type a son propre champ `*models_id` en Legacy :
```javascript
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
```

Si le type n'est pas dans ce map ET n'est pas dans TYPES_WITHOUT_MODEL,
utiliser le fallback : `${type.toLowerCase()}models_id`.

---

## Mapping des champs modèle pour resolveDropdown

Le type GLPI à passer à `lookupCache.resolveDropdown` pour le modèle :
```javascript
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
```

---

## Fonction exportée — `importAssetsLegacy(csvText)`

Pour chaque ligne du CSV :

1. Ignorer si `row.Item_Type` est vide

2. Résoudre les entités via `lookupCache` (identique au service V2) :
   ```javascript
   const statusId       = await lookupCache.resolveDropdown('State', row.Status);
   const locationId     = await lookupCache.resolveDropdown('Location', row.Location);
   const manufacturerId = await lookupCache.resolveDropdown('Manufacturer', row.Manufacturer);
   const userId         = await lookupCache.resolveUser(row.User); // null si vide

   // Modèle — seulement si le type en a un
   let modelId = null;
   if (!TYPES_WITHOUT_MODEL.includes(row.Item_Type) && row.Model) {
     const glpiModelType = MODEL_TYPE_MAP[row.Item_Type];
     if (glpiModelType) {
       modelId = await lookupCache.resolveDropdown(glpiModelType, row.Model);
     }
   }
   ```

3. Construire le payload Legacy avec champs PLATS :
   ```javascript
   const payload = {
     name: row.Name,
     otherserial: row.Inventory_Number || '',
   };

   if (statusId)       payload.states_id        = statusId;
   if (locationId)     payload.locations_id      = locationId;
   if (manufacturerId) payload.manufacturers_id  = manufacturerId;
   if (userId)         payload.users_id           = userId;
   if (modelId) {
     const modelField = MODEL_FIELD_MAP[row.Item_Type]
       ?? `${row.Item_Type.toLowerCase()}models_id`;
     payload[modelField] = modelId;
   }
   ```

4. Appeler l'API Legacy :
   ```javascript
   const response = await Legacy.post(row.Item_Type, payload);
   const id = response.data?.id ?? response.data?.[0]?.id;
   ```

5. Retourner un résultat par ligne :
   ```javascript
   { name: row.Name, success: true, id, itemtype: row.Item_Type, error: null }
   // ou en cas d'erreur :
   { name: row.Name, success: false, id: null, itemtype: row.Item_Type, error: err.message }
   ```

La fonction retourne :
```javascript
{
  results: [...],
  nameToItem: {
    "PC-ADM-001": { id: 42, itemtype: "Computer" },
    "MN-FORM-002": { id: 43, itemtype: "Monitor" },
    ...
  }
}
```

`nameToItem` ne contient que les assets dont `success: true` et `id` non null.

---

## MODIFICATION — importOrchestrator.js

Ajouter l'import en haut du fichier :
```javascript
import { importAssetsLegacy } from './assetImportLegacyService';
```

Garder l'import existant aussi :
```javascript
import { importAssets } from './assetImportService'; // V2 — garder
```

Remplacer dans le corps de `runImport` UNIQUEMENT cette ligne :
```javascript
// AVANT (V2)
const assetsResult = await importAssets(text1);

// APRÈS (Legacy)
const assetsResult = await importAssetsLegacy(text1);
```

Le reste de l'orchestrateur ne change pas du tout —
`assetsResult.nameToItem` a exactement la même structure dans les deux services.

---

## CE QUI NE CHANGE PAS

- `assetImportService.js` — garder tel quel, ne pas modifier
- `ticketImportService.js` — aucune modification
- `costImportService.js` — aucune modification
- `imageImportService.js` — aucune modification
- Tous les validators — aucune modification
- `lookupCache.js` — aucune modification
- `csvParser.js` — aucune modification
- `glpiClient.js` — aucune modification
