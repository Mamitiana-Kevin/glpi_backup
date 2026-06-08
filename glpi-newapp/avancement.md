# Contexte du projet — GLPI NewApp React

## Vue d'ensemble

Projet d'évaluation consistant à créer une application externe (**NewApp**) en **React + Vite** connectée à une instance **GLPI 11.0.7** locale via ses APIs REST.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 19 + Vite |
| Styling | CSS inline (pas de lib UI) |
| Routing | react-router-dom |
| HTTP | axios |
| Backend local | Spring Boot (Java) — à venir |
| Base de données locale | SQLite via JPA (Spring Boot) — à venir |
| GLPI | 11.0.7 sur XAMPP (localhost) |

---

## Infrastructure locale

```
GLPI         → http://localhost/glpi          (XAMPP)
React        → http://localhost:5173          (Vite dev server)
Spring Boot  → http://localhost:8080          (à venir)
SQLite       → glpi_data.db                   (géré par Spring Boot)
```

---

## Proxy Vite — `vite.config.js`

Le proxy Vite évite les problèmes CORS en redirigeant les appels :

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/apirest': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/apirest/, '/glpi/apirest.php'),
        configure: proxy => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.authorization)
              proxyReq.setHeader('Authorization', req.headers.authorization);
            if (req.headers['app-token'])
              proxyReq.setHeader('App-Token', req.headers['app-token']);
            if (req.headers['session-token'])
              proxyReq.setHeader('Session-Token', req.headers['session-token']);
          });
        },
      },
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '/glpi/api.php/v2.3'),
        configure: proxy => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.authorization)
              proxyReq.setHeader('Authorization', req.headers.authorization);
            if (req.headers['app-token'])
              proxyReq.setHeader('App-Token', req.headers['app-token']);
          });
        },
      },
    },
  },
});
```

Résultat :
- `/api/token` → `http://localhost/glpi/api.php/token`
- `/api/Ticket` → `http://localhost/glpi/api.php/Ticket`
- `/apirest/initSession` → `http://localhost/glpi/apirest.php/initSession`

---

## APIs GLPI utilisées

### ⚠️ Règle fondamentale

> **Toute l'application utilise l'API V2 (OAuth2) SAUF la page Reset qui utilise l'API V1 (Legacy).**

### API V2 — OAuth2 (`/api.php/v2.3`)

Utilisée pour : Dashboard, Tickets, Assets, FrontOffice.

**Règle des Routes v2 (High-Level) :**
- **Assets** : Toujours préfixer par `/Assets/` (ex: `/Assets/Computer`, `/Assets/Monitor`)
- **Tickets** : Toujours utiliser `/Assistance/Ticket`

**Credentials OAuth2 :**
```
client_id     : dd4c96b414f68d3e26e90e8b6a7f8c834370a2943c06655a81b95d061f0757d6
client_secret : 3dea3703d5a568e3324cde707eedea38104111a7743d4343b48828880fa20598
grant_type    : password
scope         : api user inventory status graphql
username      : glpi
password      : glpi
```

**Obtenir un token :**
```
POST /api/token
Content-Type: application/x-www-form-urlencoded
body: grant_type=password&client_id=...&client_secret=...&username=glpi&password=glpi&scope=...
→ { "access_token": "eyJ...", "expires_in": 3600 }
```

**Utilisation :**
```javascript
import { get, post, put, del } from '../api/glpiClient';

// Exemples
const computers = await get('/Assets/Computer');
const tickets   = await get('/Assistance/Ticket');

// Compter via Content-Range (v2)
const total = response.headers['content-range'].split('/')[1];
```

**Filtrage RSQL & Recherche :**
- **Actifs seulement** : Toujours ajouter `is_deleted==0`
- **Recherche partielle** : Utiliser `ilike` avec des jokers `*`
```
GET /api/Assistance/Ticket?filter=is_deleted==0;status==1
GET /api/Assets/Computer?filter=is_deleted==0;name=ilike=*macbook*
```

### API V1 — Legacy (`/apirest.php`)

Utilisée pour : **page Reset (purge)** et **Relations (Item_Ticket)**.

**Credentials Legacy :**
```
App-Token : nzJu5tfBe4JbVW9tkwAB4jSKgXUCCD3WOVEBuz4H
username  : glpi
password  : glpi
```

**Utilisation :**
```javascript
import { Legacy } from '../api/glpiClient';

const items = await Legacy.get('/Computer');
await Legacy.delPurge('/Computer/42');  // suppression définitive (force_purge=1)
```

---

## Fichier client API — `src/api/glpiClient.js`

Ce fichier gère la persistence et le rafraîchissement automatique.

- **Persistence** : Utilise `sessionStorage` (`glpi_token` et `glpi_creds`). Permet de rester connecté après un F5.
- **Intercepteur** : Ajoute `Authorization: Bearer <token>` et `App-Token` à chaque requête.
- **Auto-Refresh** : Si une erreur 401 survient, il tente de récupérer un nouveau token avec les credentials stockés.

```javascript
// Export V1 (Legacy) — utiliser UNIQUEMENT pour Reset et Relations
export const Legacy = {
  get(url, params),
  post(url, data),      // wrappe automatiquement dans { input: data }
  put(url, data),       // wrappe automatiquement dans { input: data }
  del(url),             // mise à la corbeille
  delPurge(url),        // suppression définitive (force_purge=1 injecté dans l'URL)
  refreshSession(),
  killSession(),
}
```

---

## Méthodes d'appel clés (Guide pour l'IA)

### 1. Recherche d'éléments (Multicritère)
Pour chercher dans le parc, on combine les filtres avec `;` (ET logique) et on utilise des `*` pour le "contient".
```javascript
// elementService.js
const filters = ['is_deleted==0'];
if (name) filters.push(`name=ilike=*${name}*`);
const response = await get(`/Assets/Computer`, { filter: filters.join(';') });
```

### 2. Création de Ticket (v2)
GLPI 11 exige le champ `impact` pour valider la matrice de priorité.
```javascript
// ticketService.js
await post('/Assistance/Ticket', {
  name: "Titre",
  content: "Description",
  type: 1,      // 1:Incident, 2:Demande
  urgency: 3,   // 1-5
  impact: 3,    // 1-5
  priority: 3,  // 1-6 (6: Majeure)
  status: 1     // 1: Nouveau
});
```

### 3. Association Asset-Ticket (Hybride v2 + Legacy)
L'API v2 étant complexe sur les relations, on utilise une méthode hybride :
1. Création du ticket via **API v2** → récupère l'ID.
2. Association via **API Legacy** sur l'endpoint `/Item_Ticket`.
```javascript
// ticketService.js
const ticket = await createTicket(...); // v2
await Legacy.post('/Item_Ticket', {
  itemtype: 'Computer',
  items_id: 42,
  tickets_id: ticket.id
});
```

### 4. Purge Complète (Reset)
Pour supprimer définitivement, il faut vider la corbeille.
```javascript
// resetService.js
// 1. Lister les actifs ET les supprimés (is_deleted: 1)
const active = await Legacy.get('/Computer', { range: '0-1000' });
const deleted = await Legacy.get('/Computer', { is_deleted: 1, range: '0-1000' });
// 2. Purger chaque ID
await Legacy.delPurge(`/Computer/${id}`); // Appelle DELETE ...?force_purge=1
```

**Protections implémentées :**
- **Utilisateurs par défaut** : Les IDs 2 à 6 (`glpi`, `tech`, `post-only`, etc.) sont exclus de la purge.
- **Données d'usine** : Pour les dropdowns et modèles, les IDs <= 20 sont préservés pour ne pas casser la configuration standard de GLPI.

### 5. Système d'Importation (CSV & Images)

L'importation est orchestrée de manière séquentielle pour garantir l'intégrité des relations entre les entités.

**Architecture du module (`src/services/import/`) :**
- **Orchestrateur** ([importOrchestrator.js](file:///c:/xampp/htdocs/glpi/glpi-newapp/src/services/import/importOrchestrator.js)) : Gère le flux global (Validation -> Assets -> Tickets -> Coûts -> Images).
- **Validators** : Valident la structure des colonnes et la présence des champs obligatoires avant tout appel API.
- **Lookup Cache** ([lookupCache.js](file:///c:/xampp/htdocs/glpi/glpi-newapp/src/services/import/helpers/lookupCache.js)) : 
    - Convertit les noms (CSV) en IDs (GLPI).
    - **Création automatique** : Si un lieu, un fabricant, un modèle ou un utilisateur n'existe pas, il est créé à la volée via l'API Legacy.
- **Type Normalizer** ([typeNormalizer.js](file:///c:/xampp/htdocs/glpi/glpi-newapp/src/services/import/helpers/typeNormalizer.js)) : 
    - Mappe les variations de noms (ex: "ordinateur", "PC", "baie", "chassis") vers les `itemtypes` officiels.
    - Gère l'insensibilité à la casse et les traductions.

**Logique d'importation :**
1. **Assets (Legacy)** : Importation des équipements via l'API Legacy pour une meilleure compatibilité des types. Les relations sont envoyées via des champs plats (ex: `states_id: X`). Support étendu : `Computer`, `Monitor`, `Software`, `NetworkEquipment`, `Printer`, `Phone`, `Peripheral`, `Rack`, `Enclosure`, `PDU`, `Cable`, `CartridgeItem`, `ConsumableItem`.
2. **Tickets (v2)** : Création des tickets. Les priorités et types sont mappés selon les constantes GLPI.
3. **Liaisons (Legacy)** : Chaque asset mentionné dans la colonne `Items` du CSV ticket est lié via l'endpoint `/Item_Ticket` de l'API Legacy.
4. **Images (Multipart)** : Les images contenues dans le ZIP sont extraites (via `JSZip`), uploadées via `FormData` sur `/Document` (en utilisant l'instance `legacy` d'axios pour le support multipart) et liées aux assets via `Document_Item`.

---

## Guide du Design System (CSS Global)

Toutes les pages utilisent désormais [All.css](file:///c:/xampp/htdocs/glpi/glpi-newapp/src/assets/css/All.css). Voici les classes principales à utiliser pour garder une interface cohérente :

### 1. Structure de Page
- `.page-container` : Conteneur principal de la page (flex column, gap 24px).
- `.page-header` : En-tête avec `<h2>` pour le titre et `<p>` pour la description.
- `.split-view` : Layout avec liste à gauche (`.panel-main`) et détails à droite (`.panel-side`).

### 2. Conteneurs & Cartes
- `.glpi-card` : Carte blanche avec bordure et ombre légère.
- `.stats-grid` : Grille responsive pour aligner des cartes de stats.
- `.panel-header` / `.panel-content` : Structure interne des panneaux de détails ou de listes.

### 3. Tableaux
- `table.glpi-table` : Style standard GLPI (en-têtes grisés, lignes alternées, hover).
- `.table-wrapper` : Conteneur pour permettre le scroll vertical interne.

### 4. Boutons & Formulaires
- `.btn .btn-primary` : Bouton principal (bleu foncé).
- `.btn .btn-outline` : Bouton secondaire (bordure grise).
- `.btn .btn-danger` : Bouton d'action critique (rouge).
- `.form-group` / `.form-control` : Structure standard pour les champs de saisie.

### 5. Badges de Statut
- `.badge` : Classe de base.
- `.status-1` à `.status-6` : Couleurs automatiques selon l'ID du statut GLPI.

---

## Authentification de l'application

### Backoffice
- **Pas de login classique** — un code unique sert de mot de passe
- Code mis par défaut dans le formulaire
- Pages backoffice protégées par `ProtectedRoute`

### Contexte Auth — `src/context/AuthContext.jsx`
```javascript
const { isConnected, login, logout, error, loading } = useAuth();
// login(username, password) → appelle refreshSession() de la V2
// logout() → appelle clearSession()
```

---

## Structure du projet React

```
src/
├── api/
│   └── glpiClient.js          ← client V2 + V1 Legacy
├── context/
│   └── AuthContext.jsx         ← gestion connexion
├── services/
│   ├── dashboardService.js     ← stats assets + tickets ✓ FAIT
│   └── resetService.js         ← purge Legacy ✓ FAIT
├── components/
│   └── BackOfficeLayout.jsx     ← layout sidebar + topbar ✓ FAIT
├── pages/
│   ├── Login.jsx               ← ✓ FAIT
│   ├── backoffice/
│   │   ├── dashboard/
│   │   │   └── DashBoard.jsx   ← ✓ FAIT
│   │   ├── reset/
│   │   │   └── Reset.jsx       ← ✓ FAIT (utilise Legacy V1)
│   │   ├── import/
│   │   │   └── ImportPage.jsx  ← ✓ FAIT
│   │   └── tickets/
│   │       ├── Tickets.jsx     ← ✓ FAIT
│   │       └── Tickets.css     ← ✓ FAIT
│   └── frontoffice/
│       ├── elements/
│       │   └── Element.jsx      ← ✓ FAIT
│       └── tickets/
│           └── CreateTicket.jsx ← ✓ FAIT
└── App.jsx                     ← ✓ FAIT
```

---

## Avancement des fonctionnalités

| Fonctionnalité | État | Détails |
|---|---|---|
| Connexion OAuth2 (v2) | ✅ Fait | Authentification via Grant Type Password |
| Dashboard Stats | ✅ Fait | Correction des compteurs (Content-Range & X-Total-Count) |
| Import CSV Assets | ✅ Fait | Orchestrateur Tout-ou-Rien, via API Legacy pour compatibilité totale |
| Import CSV Tickets | ✅ Fait | Workflow en 2 étapes (Création puis MAJ Statut) |
| Import Images (ZIP) | ✅ Fait | Upload multipart vers `/Document` |
| Reset (Purge) | ✅ Fait | Protection des IDs système (2-6) et IDs <= 20 |
| Documentation Technique | ✅ Fait | Création du fichier `documentation.md` |
| Backend Spring Boot | ⏳ À FAIRE | Centralisation de la logique et stockage local |

---

## Modifications récentes (08/06/2026)

### Dashboard et Compteurs
- **Correction des 0 dans le Dashboard** : 
  - `fetchCount` est devenu hybride et plus robuste. Il vérifie `Content-Range` (v1/v2), `X-Total-Count` et même le corps de la réponse si l'API renvoie un objet `{ total: X, data: [...] }`.
  - Suppression des slashes initiaux dans les endpoints pour assurer que le `baseURL` d'Axios soit correctement pris en compte.
  - Ajout du paramètre `get_full_count: true` et `range: 0-0` pour les appels Legacy afin de forcer GLPI à renvoyer le total dans les headers sans charger toutes les données.
- **Vue exhaustive du parc** : Le Dashboard affiche désormais l'intégralité des équipements gérés par l'importateur Legacy (Baies, Châssis, PDU, Câbles, Consommables, etc.) en utilisant `fetchAllLegacy()`.

### Assistance (Tickets)
- **Filtrage et Recherche** : Implémentation d'une barre de recherche (Nom/Contenu) et d'un filtre par statut dans la liste des tickets.
- **Logique de Robustesse** : Utilisation d'un système hybride (RSQL API v2 + filtrage client en fallback) pour garantir le fonctionnement de la recherche même sur les versions de GLPI limitées.
- **Debouncing** : Optimisation des performances avec un délai de 300ms avant le déclenchement des requêtes de recherche.

### Reset et Purge
- **Synchronisation avec l'Import** : Le service de Reset a été étendu pour inclure tous les nouveaux types d'assets (Rack, Enclosure, PDU, PassiveDCEquipment, Cable, Unmanaged) ainsi que leurs modèles respectifs.
- **Protection des données d'usine** : Les nouveaux modèles (`RackModel`, etc.) ont été ajoutés à la liste des entités protégées (ID <= 20) pour préserver la stabilité du système GLPI.

### Authentification Legacy
- **Choix des Credentials** : L'API Legacy (`apirest.php`) continue d'utiliser le compte `glpi/glpi` par défaut pour les opérations de Reset et les statistiques étendues du Dashboard. Ce choix permet de garantir que ces opérations critiques disposent des permissions nécessaires (Super-Admin) indépendamment de l'utilisateur connecté via OAuth2.
- **Récursivité** : Ajout de `is_recursive=1` sur les appels Legacy pour s'assurer que les compteurs incluent les éléments de toutes les sous-entités.

### Normalisation
- **Support étendu des Assets** : Les types comme `CartridgeItem` ou `Software` sont désormais gérés correctement via l'API Legacy car ils ne se trouvent pas sous le préfixe `/Assets/` de la V2.

---

## Journal de bord des erreurs corrigées
- **Erreur 400 (User creation)** : L'API Legacy attendait `name` au lieu de `login`. Corrigé.
- **Erreur 404 (Ticket Update)** : Le `PUT` sur `/api/Assistance/Ticket/ID` échouait sur certaines versions. Corrigé en utilisant `Legacy.put('Ticket/ID', ...)`.
- **Dashboard vide** : Les headers de comptage variaient selon la version de GLPI. Corrigé avec une logique de détection multi-sources.
- **CORS / Proxy** : Configuration du proxy Vite pour rediriger `/api` et `/apirest` vers les bons scripts PHP de GLPI.
- **Reset incomplet** : Certains types d'assets importés n'étaient pas ciblés par la purge. Corrigé en synchronisant `allAPI` dans `resetService.js`.
- **Recherche Tickets inopérante** : Correction de la syntaxe RSQL et ajout d'un filtrage local de secours pour assurer la fiabilité de la recherche.

---

## Données à importer (Jour 1)

- 3 fichiers CSV : contenu du parc (lien Google Sheets fourni)
- 1 fichier ZIP : images des éléments
- Import via page React → Spring Boot → SQLite → GLPI API V2

---

## Statuts des tickets GLPI

| Valeur | Label |
|---|---|
| 1 | Nouveau |
| 2 | En cours (attribué) |
| 3 | En cours (planifié) |
| 4 | En attente |
| 5 | Résolu |
| 6 | Clos |

## Types de tickets GLPI

| Valeur | Label |
|---|---|
| 1 | Incident |
| 2 | Demande |

## Assets du parc (itemtypes)

| Itemtype | Label |
|---|---|
| Computer | Ordinateurs |
| Monitor | Moniteurs |
| Printer | Imprimantes |
| Phone | Téléphones |
| Peripheral | Périphériques |
| NetworkEquipment | Équipements réseau |
| Software | Logiciels |
| SoftwareLicense | Licences logicielles |

---

## Règles importantes à respecter

1. **Toujours utiliser `get/post/put/del` (V2) sauf pour le Reset**
2. **Ne jamais utiliser `Legacy.*` en dehors de `resetService.js`**
3. **Toujours passer par le proxy Vite — ne jamais hardcoder `http://localhost/glpi`**
4. **Les réponses sont en JSON — toujours lire `response.data`**
5. **Pour compter les éléments — lire `response.headers['x-total-count']`**
6. **Spring Boot gère SQLite — React ne touche jamais SQLite directement**