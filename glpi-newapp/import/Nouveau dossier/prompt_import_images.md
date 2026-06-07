# Prompt — Ajout de l'import d'images ZIP à l'import GLPI existant

Tu vas ajouter la gestion d'un fichier ZIP d'images au système d'import CSV déjà en place.
L'import CSV (assets, tickets, coûts) fonctionne déjà et NE DOIT PAS être modifié,
sauf `importOrchestrator.js` pour y brancher l'étape image.

---

## RÈGLES ABSOLUES

1. Le ZIP est OPTIONNEL — si aucun fichier ZIP n'est fourni, l'import CSV se termine
   normalement sans erreur. Ne jamais bloquer l'import à cause de l'absence du ZIP.

2. Pour l'upload multipart, utiliser l'instance `legacy` axios directement
   (exportée depuis glpiClient.js via `export { legacy }`) car `Legacy.post()`
   wrappe en JSON et ne supporte pas le `multipart/form-data`.

3. `Legacy.post()` wrappe DÉJÀ dans `{ input: data }`.
   Pour `Document_Item`, utiliser `Legacy.post('Document_Item', { ... })`
   SANS re-wrapper — le client s'en charge.

4. NE JAMAIS créer un nouvel axios. Utiliser uniquement ce qui est exporté
   depuis `../../api/glpiClient`.

5. Installer JSZip via npm pour extraire le ZIP en mémoire :
   `npm install jszip`

---

## NOUVEAU FICHIER À CRÉER — imageImportService.js

Emplacement : `src/services/import/imageImportService.js`

```javascript
import JSZip from 'jszip';
import { Legacy, legacy } from '../../api/glpiClient';
```

### Formats d'images acceptés
```javascript
const ACCEPTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];
```

### Helper — `getExtension(filename)`
- Retourne l'extension en minuscules : `"PC-ADM-001.PNG"` → `"png"`

### Helper — `getAssetName(filename)`
- Retire l'extension et retourne le nom brut : `"PC-ADM-001.png"` → `"PC-ADM-001"`

### Helper — `getMimeType(extension)`
- Retourne le MIME type correspondant :
  - `png` → `image/png`
  - `jpg` / `jpeg` → `image/jpeg`
  - `gif` → `image/gif`
  - `bmp` → `image/bmp`
  - `webp` → `image/webp`
  - `svg` → `image/svg+xml`
  - défaut → `application/octet-stream`

### Fonction principale — `uploadDocument(assetName, fileBlob, extension, item)`

`item` est un objet `{ id: number, itemtype: string }` venant du `nameToItem`.

Étape 1 — Créer le document dans GLPI via multipart :
```javascript
const formData = new FormData();
formData.append(
  'uploadManifest',
  JSON.stringify({ input: { name: assetName } })
);
formData.append(
  'filename[0]',
  new File([fileBlob], `${assetName}.${extension}`, { type: getMimeType(extension) })
);

// Utiliser l'instance legacy directement (pas Legacy.post) car multipart
const response = await legacy.post('/Document', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
const documentId = response.data?.id ?? response.data?.[0]?.id;
```

Étape 2 — Lier le document à l'asset :
```javascript
await Legacy.post('Document_Item', {
  documents_id: documentId,
  items_id: item.id,
  itemtype: item.itemtype,
});
```

Retourner :
```javascript
{ assetName, success: true, documentId }
```

En cas d'erreur à n'importe quelle étape, capturer avec try/catch et retourner :
```javascript
{ assetName, success: false, error: string }
```

### Fonction exportée — `importImages(zipFile, nameToItem)`

Signature :
```javascript
export async function importImages(zipFile, nameToItem = {})
```

- Si `zipFile` est null ou undefined → retourner immédiatement :
  ```javascript
  { skipped: true, results: [] }
  ```

Sinon :
1. Lire le ZIP avec JSZip :
   ```javascript
   const zip = await JSZip.loadAsync(zipFile);
   ```

2. Pour chaque fichier dans le ZIP :
   - Ignorer les dossiers (`file.dir === true`)
   - Ignorer les fichiers dont l'extension n'est pas dans `ACCEPTED_EXTENSIONS`
   - Ignorer les fichiers système comme `__MACOSX` ou `.DS_Store`

3. Pour chaque image valide :
   - Extraire le nom de l'asset via `getAssetName(filename)`
   - Chercher dans `nameToItem[assetName]`
   - Si introuvable dans `nameToItem` → logger un warning dans les résultats, continuer
   - Si trouvé → appeler `uploadDocument(assetName, fileBlob, extension, item)`
   - Extraire le blob : `const fileBlob = await file.async('blob')`

4. Retourner :
   ```javascript
   {
     skipped: false,
     results: [
       { assetName: 'PC-ADM-001', success: true, documentId: 45 },
       { assetName: 'MN-FORM-002', success: false, error: '...' },
       { assetName: 'XX-UNKNOWN', success: false, error: 'Asset non trouvé dans nameToItem' },
     ]
   }
   ```

---

## MODIFICATION — importOrchestrator.js

Ajouter l'import en haut :
```javascript
import { importImages } from './imageImportService';
```

Modifier la signature de `runImport` :
```javascript
// AVANT
export async function runImport({ feuille1, feuille2, feuille3 })

// APRÈS
export async function runImport({ feuille1, feuille2, feuille3, zipFile = null })
```

Ajouter une étape 5 après l'import des coûts (les étapes 1-4 existantes ne changent pas) :

```
ÉTAPE 5 — Import des images (optionnel)
  const imagesResult = await importImages(zipFile, assetsResult.nameToItem)
```

Modifier le rapport final retourné pour inclure les images :
```javascript
{
  success: true,
  stats: {
    assets:  { total: N, success: N, failed: N },
    tickets: { total: N, success: N, failed: N },
    costs:   { total: N, success: N, failed: N },
    images:  imagesResult.skipped
               ? { skipped: true }
               : { total: N, success: N, failed: N },
  },
  details: {
    assets:  assetsResult.results,
    tickets: ticketsResult.results,
    costs:   costsResult.results,
    images:  imagesResult.results,
  }
}
```

---

## CE QUI NE CHANGE PAS

- `assetImportService.js` — aucune modification
- `ticketImportService.js` — aucune modification
- `costImportService.js` — aucune modification
- Tous les validators — aucune modification
- `lookupCache.js` — aucune modification
- `csvParser.js` — aucune modification
- `glpiClient.js` — aucune modification
