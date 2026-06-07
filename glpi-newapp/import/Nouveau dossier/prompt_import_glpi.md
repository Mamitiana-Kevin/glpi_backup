# Prompt — Système d'import CSV pour GLPI 11.0.7

Tu vas créer un système d'import CSV pour une application React + Vite connectée à GLPI 11.0.7.
Le glpiClient.js est déjà en place et fonctionnel (voir section CONTEXTE en bas de ce fichier).

---

## RÈGLES ABSOLUES

1. N'utiliser QUE les imports depuis `../api/glpiClient` :
   - `import { get, post, del } from '../../api/glpiClient'` pour l'API V2
   - `import { Legacy } from '../../api/glpiClient'` pour l'API Legacy
   - NE JAMAIS créer un nouvel axios, NE JAMAIS appeler initSession ou refreshSession

2. `Legacy.post()` wrappe DÉJÀ automatiquement dans `{ input: data }`.
   NE JAMAIS faire `Legacy.post(url, { input: data })` → ça donnerait `{ input: { input: data } }`

3. L'API V2 attend un corps DIRECT sans wrapper `{ input }`.
   Exemple : `post('Assets/Computer', { name: '...', status: { id: 1 } })`

4. Pour les assets V2 :
   - Les clés étrangères sont des OBJETS imbriqués : `status: { id }`, `location: { id }`, `manufacturer: { id }`, `model: { id }`, `user: { id }`
   - Préfixer par `/Assets/` : `/Assets/Computer`, `/Assets/Monitor`, etc.
   - Les tickets : `/Assistance/Ticket`

5. Pour compter les éléments : lire `response.headers['x-total-count']`

---

## ARCHITECTURE À CRÉER

```
src/services/import/
├── validators/
│   ├── assetValidator.js
│   ├── ticketValidator.js
│   └── costValidator.js
├── helpers/
│   ├── csvParser.js
│   └── lookupCache.js
├── assetImportService.js
├── ticketImportService.js
├── costImportService.js
└── importOrchestrator.js
```

---

## FICHIER 1 — helpers/csvParser.js

Exporter deux fonctions :

**`parseCSV(text)`** :
- Parse un texte CSV en tableau d'objets
- Gère les champs entre guillemets contenant des virgules
- Retire les guillemets des valeurs
- Retourne `[]` si le texte est vide

**`readFileText(file)`** :
- Lit un File browser en texte UTF-8 via FileReader
- Retourne une `Promise<string>`

---

## FICHIER 2 — validators/assetValidator.js

Colonnes exactes attendues (ordre strict, 8 colonnes) :
```
Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User
```

Exporter **`validateAssetCSV(text)`** qui retourne :
```javascript
{
  valid: boolean,
  errors: [
    { type: 'WRONG_COLUMN_COUNT', expected: 8, found: N },
    { type: 'WRONG_COLUMN_NAME', index: N, expected: 'X', found: 'Y' },
    { type: 'NO_DATA_ROWS' },
    { type: 'MISSING_REQUIRED_VALUE', row: N, column: 'Name' | 'Item_Type' }
  ]
}
```

Règles :
- Vérifier d'abord le nombre de colonnes — si faux, stopper la validation immédiatement
- Vérifier chaque nom de colonne exactement (case-sensitive)
- Vérifier qu'il y a au moins 1 ligne de données
- Pour chaque ligne : `Name` et `Item_Type` sont obligatoires
- `User` peut être vide (asset sans utilisateur) → pas d'erreur

---

## FICHIER 3 — validators/ticketValidator.js

Colonnes exactes attendues (ordre strict, 9 colonnes) :
```
Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items
```

Exporter **`validateTicketCSV(text)`** qui retourne le même format d'erreurs.

Règles :
- `Ref_Ticket`, `Titre`, `Type`, `Status`, `Priority` sont obligatoires
- `Description` peut être vide
- `Items` peut être vide (ticket de type Demande sans asset lié) → pas d'erreur

---

## FICHIER 4 — validators/costValidator.js

Colonnes exactes attendues (ordre strict, 4 colonnes) :
```
Num_Ticket, Duration_second, Time_Cost, Fixed_Cost
```

Exporter **`validateCostCSV(text)`** qui retourne le même format d'erreurs.

Règles :
- `Num_Ticket` est obligatoire
- `Duration_second`, `Time_Cost`, `Fixed_Cost` peuvent être 0 ou vides → pas d'erreur

---

## FICHIER 5 — helpers/lookupCache.js

Ce fichier gère la résolution et la création des entités liées (dropdowns + users).
Utiliser uniquement l'API Legacy pour les lookups et créations.

```javascript
import { Legacy } from '../../api/glpiClient';
```

Exporter un objet `lookupCache` avec les méthodes suivantes :

**`lookupCache.clear()`** — vide le cache interne (Map)

**`lookupCache.resolveDropdown(glpiType, name)`** :
- `glpiType` : `'State'`, `'Location'`, `'Manufacturer'`, `'ComputerModel'`, `'MonitorModel'`, etc.
- Chercher d'abord dans le cache local (clé = `${glpiType}::${name}`)
- Sinon : `GET Legacy /{glpiType}?searchText={name}` pour trouver par nom
- Si introuvable : `POST Legacy /{glpiType}` avec `{ name }` pour créer
- Mettre en cache et retourner l'`id` (number) ou `null` si échec

**`lookupCache.resolveUser(fullName)`** :
- Si `fullName` est vide → retourner `null` (pas d'erreur, asset sans user)
- Split du nom complet :
  - `"Rakoto Jean"` → `lastname: "RAKOTO"`, `firstname: "Jean"`, `login: "rakoto.jean"`
  - Format général : premier mot = lastname en majuscules, reste = firstname
  - `login` = `lastname.lowercase + "." + firstname.lowercase` (espaces remplacés par `.`)
- Chercher d'abord dans le cache local (clé = `user::${login}`)
- Sinon : `GET Legacy /User?searchText={login}` pour trouver par login
- Si introuvable : `POST Legacy /User` avec :
  ```javascript
  { login, firstname, lastname, password: "Glpi1234!", _profiles_id: 4, _entities_id: 0 }
  ```
- Mettre en cache et retourner l'`id` ou `null` si échec

---

## FICHIER 6 — assetImportService.js

```javascript
import { post } from '../../api/glpiClient';
import { lookupCache } from './helpers/lookupCache';
import { parseCSV } from './helpers/csvParser';
```

Exporter **`importAssets(csvText)`** :

Pour chaque ligne du CSV :
1. Résoudre les entités via `lookupCache` :
   - `statusId` = `resolveDropdown('State', row.Status)`
   - `locationId` = `resolveDropdown('Location', row.Location)`
   - `manufacturerId` = `resolveDropdown('Manufacturer', row.Manufacturer)`
   - `modelId` = `resolveDropdown(`${row.Item_Type}Model`, row.Model)`
   - `userId` = `resolveUser(row.User)` — peut être `null`

2. Construire le payload V2 avec objets imbriqués :
```javascript
{
  name: row.Name,
  otherserial: row.Inventory_Number,
  ...(statusId       && { status:       { id: statusId } }),
  ...(locationId     && { location:     { id: locationId } }),
  ...(manufacturerId && { manufacturer: { id: manufacturerId } }),
  ...(modelId        && { model:        { id: modelId } }),
  ...(userId         && { user:         { id: userId } }),
}
```

3. `POST` V2 sur `/Assets/${row.Item_Type}`

4. Retourner un objet de résultat par ligne :
```javascript
{ name: row.Name, success: boolean, id: number | null, itemtype: string, error: string | null }
```

La fonction retourne :
```javascript
{
  results: [...],
  nameToItem: {
    "PC-ADM-001": { id: 42, itemtype: "Computer" },
    ...
  }
}
```

---

## FICHIER 7 — ticketImportService.js

```javascript
import { post } from '../../api/glpiClient';
import { Legacy } from '../../api/glpiClient';
import { parseCSV } from './helpers/csvParser';
```

Constantes de mapping à définir dans le fichier :
```javascript
const TICKET_STATUS_MAP   = { New: 1, 'En cours': 2, 'En attente': 4, Résolu: 5, Clos: 6 };
const TICKET_PRIORITY_MAP = { Low: 2, Medium: 3, High: 4, Urgent: 5 };
const TICKET_TYPE_MAP     = { Incident: 1, Demande: 2, Request: 2 };
```

Helper **`formatDate(dateStr, heureStr)`** :
- `dateStr` format `DD/MM/YYYY`, `heureStr` format `HH:MM`
- Retourne `"YYYY-MM-DD HH:MM:00"`

Helper **`parseItems(cell)`** :
- Reçoit une cellule comme `["PC-ADM-001","MN-FORM-002"]` ou vide
- Retire les `[`, `]`, `"` résiduels et découpe sur `,`
- Retourne un tableau de noms propres : `["PC-ADM-001", "MN-FORM-002"]`
- Si vide → retourne `[]`

Exporter **`importTickets(csvText, nameToItem)`** :

Pour chaque ligne :
1. Calculer `level` = `TICKET_PRIORITY_MAP[row.Priority] ?? 3`
2. Construire le payload :
```javascript
{
  name:     row.Titre,
  content:  row.Description || ' ',
  type:     TICKET_TYPE_MAP[row.Type] ?? 1,
  status:   { id: TICKET_STATUS_MAP[row.Status] ?? 1 },
  urgency:  level,
  impact:   level,
  priority: level,
  date:     formatDate(row.Date, row.Heure),
}
```
3. `POST` V2 `/Assistance/Ticket` → récupérer `ticketId`
4. Pour chaque item dans `parseItems(row.Items)` :
   - Chercher dans `nameToItem[name]`
   - Si trouvé : `Legacy.post('Item_Ticket', { tickets_id: ticketId, items_id: item.id, itemtype: item.itemtype })`
   - Si introuvable : ajouter un warning dans le résultat, ne pas bloquer l'import

5. Retourner :
```javascript
{
  results: [{ ref: row.Ref_Ticket, success: boolean, id: number | null, error: string | null }],
  refToId:  { "1": 55, "2": 56, ... }
}
```

---

## FICHIER 8 — costImportService.js

```javascript
import { post } from '../../api/glpiClient';
import { parseCSV } from './helpers/csvParser';
```

Helper **`parseNumber(val)`** :
- Convertit `"8,7"` → `8.7` (virgule décimale FR → point)
- Retourne `0` si vide ou invalide

Exporter **`importCosts(csvText, refToId)`** :

Pour chaque ligne :
1. Récupérer `ticketId` via `refToId[row.Num_Ticket]`
2. Si `ticketId` introuvable → logger erreur dans résultat, continuer à la ligne suivante
3. Construire payload :
```javascript
{
  name:          "Intervention",
  duration:      parseNumber(row.Duration_second),
  cost_time:     parseNumber(row.Time_Cost),
  cost_fixed:    parseNumber(row.Fixed_Cost),
  cost_material: 0,
}
```
4. `POST` V2 `/Assistance/Ticket/${ticketId}/Cost`
5. Retourner un tableau de résultats par ligne :
```javascript
[{ num_ticket: row.Num_Ticket, success: boolean, error: string | null }]
```

---

## FICHIER 9 — importOrchestrator.js

```javascript
import { validateAssetCSV }  from './validators/assetValidator';
import { validateTicketCSV } from './validators/ticketValidator';
import { validateCostCSV }   from './validators/costValidator';
import { lookupCache }       from './helpers/lookupCache';
import { importAssets }      from './assetImportService';
import { importTickets }     from './ticketImportService';
import { importCosts }       from './costImportService';
import { readFileText }      from './helpers/csvParser';
```

Exporter **`runImport({ feuille1, feuille2, feuille3 })`** avec ce flux exact :

```
ÉTAPE 1 — Lire les 3 fichiers en parallèle
  const [text1, text2, text3] = await Promise.all([
    readFileText(feuille1),
    readFileText(feuille2),
    readFileText(feuille3),
  ])

ÉTAPE 2 — Valider les 3 fichiers AVANT tout appel GLPI
  const v1 = validateAssetCSV(text1)
  const v2 = validateTicketCSV(text2)
  const v3 = validateCostCSV(text3)

  Si au moins un est invalide → retourner IMMÉDIATEMENT sans toucher GLPI :
  {
    success: false,
    validationErrors: {
      feuille1: v1.errors,   // tableau vide si valide
      feuille2: v2.errors,
      feuille3: v3.errors,
    }
  }

ÉTAPE 3 — Vider le cache lookup (repartir propre)
  lookupCache.clear()

ÉTAPE 4 — Importer dans l'ordre (séquentiel, pas parallèle)
  const assetsResult  = await importAssets(text1)
  const ticketsResult = await importTickets(text2, assetsResult.nameToItem)
  const costsResult   = await importCosts(text3, ticketsResult.refToId)

ÉTAPE 5 — Retourner le rapport complet
  {
    success: true,
    stats: {
      assets:  { total: N, success: N, failed: N },
      tickets: { total: N, success: N, failed: N },
      costs:   { total: N, success: N, failed: N },
    },
    details: {
      assets:  assetsResult.results,
      tickets: ticketsResult.results,
      costs:   costsResult.results,
    }
  }
```

---

## CONTEXTE — glpiClient.js (ne pas modifier ce fichier)

```javascript
import axios from "axios";

const BASE_URL = "/api";

const OAUTH_CREDENTIALS = {
  grant_type: "password",
  client_id: "dd4c96b414f68d3e26e90e8b6a7f8c834370a2943c06655a81b95d061f0757d6",
  client_secret: "3dea3703d5a568e3324cde707eedea38104111a7743d4343b48828880fa20598",
  username: "",
  password: "",
  scope: "api user inventory status graphql",
};

const getStoredCreds = () => {
  const creds = sessionStorage.getItem("glpi_creds");
  return creds ? JSON.parse(creds) : { username: "", password: "" };
};

const setStoredCreds = (creds) => {
  sessionStorage.setItem("glpi_creds", JSON.stringify(creds));
};

let accessToken = sessionStorage.getItem("glpi_token");

async function fetchToken(username, password) {
  const creds = {
    ...OAUTH_CREDENTIALS,
    ...(username ? { username, password } : getStoredCreds()),
  };
  if (!creds.username || !creds.password) {
    console.warn("No credentials found for fetchToken");
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  if (username) setStoredCreds({ username, password });
  const params = new URLSearchParams(creds);
  const { data } = await axios.post(`${BASE_URL}/token`, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  accessToken = data.access_token;
  sessionStorage.setItem("glpi_token", accessToken);
  return accessToken;
}

async function getToken() {
  if (!accessToken) await fetchToken();
  return accessToken;
}

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;
  config.headers["App-Token"] = "nzJu5tfBe4JbVW9tkwAB4jSKgXUCCD3WOVEBuz4H";
  return config;
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/token")
    ) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    try {
      accessToken = null;
      const newToken = await fetchToken();
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      accessToken = null;
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export function get(url, params = {})    { return api.get(url, { params }); }
export function post(url, data = {})     { return api.post(url, data); }
export function put(url, data = {})      { return api.put(url, data); }
export function patch(url, data = {})    { return api.patch(url, data); }
export function del(url, data = {})      { return api.delete(url, { data }); }

export async function refreshSession(username, password) {
  accessToken = null;
  return fetchToken(username, password);
}

export function clearSession() {
  accessToken = null;
  sessionStorage.removeItem("glpi_token");
  sessionStorage.removeItem("glpi_creds");
}

// ── API Legacy ──────────────────────────────────────────────────────

const LEGACY_BASE_URL = "/apirest";
const LEGACY_CREDENTIALS = { login: "glpi", password: "glpi" };

let sessionToken = null;

async function initSession() {
  const { data } = await axios.get(`${LEGACY_BASE_URL}/initSession`, {
    headers: {
      "Content-Type": "application/json",
      "App-Token": "nzJu5tfBe4JbVW9tkwAB4jSKgXUCCD3WOVEBuz4H",
    },
    auth: {
      username: LEGACY_CREDENTIALS.login,
      password: LEGACY_CREDENTIALS.password,
    },
  });
  sessionToken = data.session_token;
  return sessionToken;
}

async function getSessionToken() {
  if (!sessionToken) await initSession();
  return sessionToken;
}

const legacy = axios.create({ baseURL: LEGACY_BASE_URL });

legacy.interceptors.request.use(async (config) => {
  const token = await getSessionToken();
  config.headers["Session-Token"] = token;
  config.headers["App-Token"] = "nzJu5tfBe4JbVW9tkwAB4jSKgXUCCD3WOVEBuz4H";
  return config;
});

let isRefreshingLegacy = false;
let failedQueueLegacy = [];

function processQueueLegacy(error, token = null) {
  failedQueueLegacy.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueueLegacy = [];
}

legacy.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/initSession")
    ) {
      return Promise.reject(error);
    }
    if (isRefreshingLegacy) {
      return new Promise((resolve, reject) => {
        failedQueueLegacy.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers["Session-Token"] = token;
        return legacy(originalRequest);
      });
    }
    originalRequest._retry = true;
    isRefreshingLegacy = true;
    try {
      sessionToken = null;
      const newToken = await initSession();
      processQueueLegacy(null, newToken);
      originalRequest.headers["Session-Token"] = newToken;
      return legacy(originalRequest);
    } catch (refreshError) {
      processQueueLegacy(refreshError, null);
      sessionToken = null;
      return Promise.reject(refreshError);
    } finally {
      isRefreshingLegacy = false;
    }
  }
);

export const Legacy = {
  get(url, params = {})  { return legacy.get(url, { params }); },
  post(url, data = {})   { return legacy.post(url, { input: data }); },
  put(url, data = {})    { return legacy.put(url, { input: data }); },
  del(url)               { return legacy.delete(url); },
  delPurge(url) {
    const separator = url.includes('?') ? '&' : '?';
    return legacy.delete(`${url}${separator}force_purge=1`);
  },
  async refreshSession() {
    sessionToken = null;
    return initSession();
  },
  async killSession() {
    try { await legacy.get("/killSession"); }
    finally { sessionToken = null; }
  },
};

export { legacy };
export default api;
```
