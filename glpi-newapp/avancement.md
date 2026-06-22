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
| Backend local | Spring Boot (Java) ✅ |
| Base de données locale | SQLite via JPA (Spring Boot) ✅ |
| GLPI | 11.0.7 sur XAMPP (localhost) |

---

## Infrastructure locale

```
GLPI         → http://localhost/glpi          (XAMPP)
React        → http://localhost:5173          (Vite dev server)
Spring Boot  → http://localhost:8080          (actif ✅)
SQLite       → glpi_data.db                   (géré par Spring Boot ✅)
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
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
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
      // Spring Boot
      '/settings': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/history': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

Résultat :
- `/api/token` → `http://localhost/glpi/api.php/token`
- `/api/Ticket` → `http://localhost/glpi/api.php/Ticket`
- `/apirest/initSession` → `http://localhost/glpi/apirest.php/initSession`
- `/settings/kanban` → `http://localhost:8080/settings/kanban`
- `/settings/languages` → `http://localhost:8080/settings/languages`
- `/history/colors` → `http://localhost:8080/history/colors`
- `/history/ticket-status` → `http://localhost:8080/history/ticket-status`

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
│   └── glpiClient.js              ← client V2 + V1 Legacy
├── context/
│   └── AuthContext.jsx             ← gestion connexion
├── services/
│   ├── backend/                   ← appels vers Express (SQLite)
│   │   ├── ticketService.js        ← saveTicketStatusHistory, fetchTicketStatusHistory
│   │   ├── kanbanLanguageService.js ← CRUD langues multilingues
│   │   ├── kanbanSettingsService.js ← CRUD couleurs Kanban
│   │   ├── superCostService.js     ← Super Cost, rapport par itemtype
│   │   └── ticketItemService.js    ← Gestion des items de ticket
│   ├── dashboardService.js         ← stats assets + tickets ✓ FAIT
│   ├── resetService.js             ← purge Legacy ✓ FAIT
│   ├── elementService.js           ← fetchElements, ASSET_TYPES ✓ FAIT
│   └── ticketService.js            ← fetchKanbanTickets, updateTicketStatus, KANBAN_STATUSES, createTicket, fetchGlpiCostByItemtype ✓ FAIT
├── components/
│   ├── BackOfficeLayout.jsx        ← layout sidebar + topbar ✓ FAIT
│   ├── KanbanCard.jsx              ← carte ticket Kanban ✓ FAIT
│   ├── KanbanColumn.jsx            ← colonne statut Kanban ✓ FAIT
│   └── kanban.css                  ← styles Kanban dédiés ✓ FAIT
├── pages/
│   ├── Login.jsx                   ← ✓ FAIT
│   ├── backoffice/
│   │   ├── dashboard/
│   │   │   └── DashBoard.jsx       ← ✓ FAIT
│   │   ├── reset/
│   │   │   └── Reset.jsx           ← ✓ FAIT (utilise Legacy V1)
│   │   ├── import/
│   │   │   └── ImportPage.jsx      ← ✓ FAIT
│   │   ├── tickets/
│   │   │   ├── Tickets.jsx         ← ✓ FAIT
│   │   │   └── Tickets.css         ← ✓ FAIT
│   │   ├── costs/
│   │   │   └── CostReportPage.jsx  ← ✓ FAIT (Rapport par itemtype)
│   │   └── settings/
│   │       └── KanbanSettingsPage.jsx ← ✓ FAIT (couleurs + labels multilingues)
│   └── frontoffice/
│       ├── elements/
│       │   └── Element.jsx          ← ✓ FAIT
│       └── tickets/
│           ├── CreateTicket.jsx     ← ✓ FAIT (accepte formData/onChange/formId)
│           ├── KanbanPage.jsx       ← ✓ FAIT (Kanban + multilingue + multi-création + réouverture + super cost)
│           ├── KanbanColumn.jsx     ← ✓ FAIT
│           ├── KanbanCard.jsx       ← ✓ FAIT
│           └── TicketDetail.jsx     ← ✓ FAIT
└── App.jsx                         ← ✓ FAIT
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
| Vue Kanban (Tickets) | ✅ Fait | Drag&drop, multi-création, détail ticket, sélecteur de langue |
| Spring Boot + SQLite | ✅ Fait | Migré vers Express.js + SQLite (6 tables) |
| Paramètres Kanban | ✅ Fait | Couleurs + labels multilingues (table kanban_languages) |
| Historique statuts tickets | ✅ Fait | Enregistré dans SQLite à chaque drag&drop |
| Historique couleurs | ✅ Fait | Enregistré dans SQLite à chaque changement de couleur |
| Documentation Technique | ✅ Fait | Création du fichier `documentation.md` |
| Réouverture des Tickets | ✅ Fait | Choix du % et du mode de réouverture, calcul automatique du montant et insertion du coût 'reopen' |
| Super Cost | ✅ Fait | Gestion des surcoûts, répartition par itemtype |
| Rapport par Itemtype | ✅ Fait | Page CostReportPage avec coûts GLPI et Super Cost |

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

## Modifications récentes (10/06/2026)

### Kanban des Tickets
- **Vue Kanban** : Implémentation d'une page Kanban permettant de visualiser les tickets par colonnes de statut (Nouveau, En cours, Résolu).
- **Drag & Drop** : Support du glisser-déposer pour changer le statut des tickets de manière fluide.
- **Composants Dédiés** : Création de `KanbanCard`, `KanbanColumn`, `TicketDetail` pour une structure modulaire et réutilisable. CSS dédié dans `kanban.css`.
- **Optimisation UI** : Mise à jour optimiste de l'interface lors du déplacement d'un ticket, avec mécanisme de rollback en cas d'échec de l'API. Fonctions `moveTicketOptimistic` et `rollbackTicket` dans `ticketService.js`.
- **Service Dédié** : Ajout de `fetchKanbanTickets`, `updateTicketStatus`, `KANBAN_STATUSES` dans `ticketService.js` utilisant l'API Legacy pour le filtrage et la mise à jour des statuts.
- **Multi-création** : Le modal d'ajout permet de créer plusieurs tickets en même temps via un tableau de formulaires. Bouton "Ajouter une ligne" dans le modal. `CreateTicket` accepte désormais les props `formData`, `onChange`, `formId`.
- **Bouton d'ajout dans colonne** : Le bouton "+ Ajouter 1 ticket" est dans le header de la colonne "Nouveau" via la prop `onAdd`.

### Express.js + SQLite (sql.js)
- **Projet migré** : Le backend Spring Boot a été entièrement migré vers une architecture légère **Express.js** intégrée directement sous `glpi-newapp/backend`.
- **Base de données** : SQLite gérée via `sql.js` (WebAssembly, pure JS sans compilation native requise) avec sauvegarde immédiate et synchrone sur disque (`glpi_data.db`).
- **5 tables créées automatiquement** au démarrage du serveur :
  - `kanban_settings` : couleurs uniquement, toujours INSERT jamais UPDATE, valeur courante = dernier INSERT par clé.
  - `kanban_color_history` : historique des changements de couleur (old/new color, statusId, changedAt).
  - `kanban_languages` : labels multilingues (languageCode, statusId, label) avec contrainte unique.
  - `ticket_status_history` : historique des changements de statut des tickets lors des drag & drop.
  - `ticket_super_cost` : surcoûts par ticket.
- **Endpoints Express unifiés** sous le préfixe `/backend` :
  - `GET/POST /backend/settings/kanban` → couleurs
  - `GET/POST/DELETE /backend/settings/languages` → labels multilingues
  - `GET/DELETE /backend/history/colors` → historique couleurs
  - `GET/POST/DELETE /backend/history/ticket-status` → historique statuts
  - `GET/POST /backend/ticket-super-cost` → surcoûts tickets
- **Historique statuts** : À chaque drag & drop dans le Kanban, React appelle `saveTicketStatusHistory` (dans `services/backend/ticketService.js`) pour enregistrer le changement dans SQLite via le proxy `/backend`.

### Multilingue Kanban (migration Option 1 → Option 2)
- **Nouvelle table `kanban_languages`** : Remplace les clés `label_X_XX` dans `kanban_settings`. Contient `languageCode`, `statusId`, `label` avec contrainte unique sur `(languageCode, statusId)`.
- **Nouveau service Express** : Intégré dans les routes de `settings.cjs` :
  - `GET /backend/settings/languages` → toutes les langues `{ fr: {1:"Nouveau",...}, mg: {...} }`
  - `GET /backend/settings/languages/codes` → `["fr", "mg", "en"]`
  - `GET /backend/settings/languages/{code}` → labels d'une langue
  - `POST /backend/settings/languages` → ajouter/modifier une langue
  - `DELETE /backend/settings/languages/{code}` → supprimer (sauf fr)
- **Nouveau service React** : `services/backend/kanbanLanguageService.js` pour tous les appels vers Express.
- **`kanbanSettingsService.js` simplifié** : Ne gère plus que les couleurs (`fetchKanbanSettings`, `saveKanbanSettings`, `extractColors`). Les fonctions `extractLabels` et `extractAvailableLanguages` ont été supprimées.
- **Sélecteur de langue dans le Kanban** : `KanbanPage` charge toutes les langues au démarrage et recharge les labels à la volée lors d'un changement de langue sans recharger les tickets.
- **Page paramètres Kanban** : `KanbanSettingsPage` (backoffice) permet de modifier les couleurs + gérer les langues (ajouter, modifier, supprimer). Le français ne peut pas être supprimé.

---

## Modifications récentes (14/06/2026)

### Restructuration Backend Express
- **Separation Logique / Routes** : Le backend a été restructuré en deux dossiers principaux :
  1. **`services/`** : Toutes les requêtes SQL + logique métier regroupés par domaine (fichiers courts et autonomes).
  2. **`routes/`** : Seulement les endpoints, qui appellent les services (aucune logique métier ici).
- **Organisation des routes** : Les routes sont regroupées par fonctionnalité (kanban, history, ticket-super-cost, ticket-item) avec des `index.cjs` pour simplifier les imports.
- **Facilité de copie** : Chaque fichier service est autonome et peut être copié facilement dans un autre projet.

### Fonctionnalité Réouverture des Tickets
- **Logique de réouverture** : Lorsque l'on déplace un ticket depuis "Résolu" vers un autre statut, une modale permet de configurer le pourcentage et le mode de réouverture.
- **Calcul du montant de réouverture** : Le frontend interroge le backend pour obtenir le montant de base correspondant au mode choisi (1: Dernier, 2: Premier, 3: Moyenne, 4: Total) via l'API, calcule `amount = pct / 100 * base`, et l'enregistre en base.
- **Insertion du coût de réouverture** : Un coût de type `reopen` est inséré pour stocker le montant calculé, le pourcentage et le mode associés.

### Refonte du Super Cost
- **Table de base** : La table `ticket_super_cost` contient désormais `type` (`close` ou `reopen`), `reopening_pct`, `reopen_mode` et `is_active` (1 = actif, 0 = annulé).
- **Table `ticket_item`** : Gère la relation many-to-many entre les tickets et les items (ticket_id, item_id, itemtype) pour la distribution des coûts.
- **Service `ticketSuperCost.cjs`** :
  - `getLastActiveCost(ticketId)` : Récupère le dernier coût de type 'close' actif.
  - `getTicketCost(ticketId)` : Récupère le montant du dernier coût de type 'close' actif.
  - `getTotalSuperCost()` : Calcule le total de tous les coûts de type 'close' actifs.
  - `getBaseForMode(ticketId, mode)` : Calcule la base financière selon le mode (Dernier, Premier, Moyenne, Total).
  - `insertCost(ticketId, amount)` : Enregistre un coût de fermeture de type 'close'.
  - `insertReopen(ticketId, amount, reopeningPct, reopenMode)` : Enregistre un coût de réouverture de type 'reopen'.
  - `cancelLastActiveCost(ticketId)` : Annule/désactive le dernier coût actif (is_active = 0).
  - `getCostReportByItemtype()` : Génère le rapport financier avec les coûts (close) et réouvertures (reopen) distribués par itemtype et par item.
- **Service `ticketItem.cjs`** :
  - `upsertTicketItems(ticketId, items)` : Enregistre les associations d'items pour un ticket.
  - `getItemsByTicket(ticketId)` : Récupère les items associés à un ticket.
  - `countItemsByTicket(ticketId)` : Compte le nombre d'items associés à un ticket.
- **Routes mises à jour** : `/backend/ticket-super-cost/` et `/backend/ticket-item/`
- **Frontend mis à jour** :
  - `superCostService.js` : Appels aux nouveaux endpoints
  - `ticketItemService.js` : Gestion des items de ticket
  - `KanbanPage.jsx` : Modale de réouverture et synchronisation des items
  - `CostReportPage.jsx` : Rapport par itemtype, avec coûts GLPI et Super Cost

### Rapport par Itemtype
- **Page CostReportPage** : Tableau avec 4 colonnes :
  1. Element (itemtype)
  2. Total coût GLPI (récupéré via GLPI API, réparti par item)
  3. Super Cost (récupéré via SQLite, réparti par item)
  4. Total coût réouverture (récupéré via SQLite)
- **Calcul côté backend** : Les coûts sont déjà divisés par le nombre d'items par ticket pour optimiser le frontend.

### Gestion des Erreurs
- Ajout de try/catch dans les routes Express pour renvoyer des erreurs détaillées.
- Console log dans le frontend pour débuguer les appels API.

---

## Modifications récentes (21/06/2026)

### Correction de l'Initialisation du Backend Express
- **Correction du TypeError sur Express** : Résolution du crash au démarrage (`TypeError: argument handler must be a function`) en implémentant le fichier de routes `backend/routes/ticket-super-cost/superCost.cjs` qui était vide.
- **Définition complète des routes ticket-super-cost** : Implémentation des 8 endpoints pour gérer les surcoûts et les réouvertures.
- **Ordre de routage d'Express** : Positionnement des routes statiques/spécifiques (`/total`, `/report`, `/reopen`) avant les routes dynamiques/paramétrées (`/:ticketId`) pour éviter les conflits de capture.

### Ajustement des Modes de Réouverture (Inversion Mode 3 et Mode 4)
- **Mise à jour de la logique SQL** : Inversion des modes dans `backend/services/ticketSuperCost.cjs` :
  - **Mode 3** : Devient la **moyenne** des coûts actifs (`AVG(amount)`).
  - **Mode 4** : Devient le **total** des coûts actifs (`SUM(amount)`).
- **Mise à jour de l'UI Frontend** : Synchronisation des menus déroulants d'options de mode de réouverture dans `KanbanPage.jsx` et `CostImportPage.jsx` pour refléter cette inversion (1: Dernier, 2: Premier, 3: Moyenne, 4: Total).
- **Fichier de test CSV** : Mise à jour de `import/sqlite.csv` pour utiliser des IDs existants (`583`, `584` au lieu de `579`, `580`).

---

## Modifications récentes (22/06/2026)

### Gestion CRUD des Réouvertures et Supercosts
- **Nouvelle Page de Gestion SQLite (`ReopenListPage.jsx`)** :
  - Création d'une page divisée en deux sections : Supercosts (fermetures) et Réouvertures.
  - Permet la modification inline du montant pour les supercosts (sans possibilité de suppression).
  - Permet la modification inline du pourcentage et du mode pour les réouvertures (sans possibilité de suppression).
  - Navigation : Ajout d'une entrée "Liste sqlite" dans la sidebar (`BackOfficeLayout.jsx`) pointant vers `/costs/reopens`.
- **Recalcul Dynamique en Cascade** :
  - **Modification d'un Supercost** : La mise à jour du montant d'un supercost (`type = 'close'`) via `updateCloseCost` recalcule automatiquement et met à jour en cascade le montant de toutes les réouvertures (`type = 'reopen'`) associées au même ticket en fonction de leur mode et pourcentage enregistrés.
  - **Modification d'une Réouverture** : La mise à jour du pourcentage ou du mode d'une réouverture via `updateReopen` recalcule automatiquement son montant sur la base financière correcte (en interrogeant `getBaseForMode`).
- **Mises à jour des Services & Routes** :
  - **Backend (`ticketSuperCost.cjs`)** : Ajout des fonctions d'accès et d'édition (`getAllCloseCosts`, `updateCloseCost`, `getAllReopens`, `updateReopen`).
  - **Routes (`superCost.cjs`)** : Ajout des endpoints `GET /closes`, `PUT /closes/:id`, `GET /reopens`, `PUT /reopens/:id`.
  - **Résolution de conflit de routage** : Positionnement des routes statiques `/closes` et `/reopens` avant la route dynamique `/:ticketId` dans Express pour éviter l'interception de ces chemins par `parseInt(req.params.ticketId)`.
  - **Frontend Service (`superCostService.js`)** : Ajout des méthodes d'appel API associées.

---

## Journal de bord des erreurs corrigées
- **Erreur 400 (User creation)** : L'API Legacy attendait `name` au lieu de `login`. Corrigé.
- **Erreur 404 (Ticket Update)** : Le `PUT` sur `/api/Assistance/Ticket/ID` échouait sur certaines versions. Corrigé en utilisant `Legacy.put('Ticket/ID', ...)`.
- **Dashboard vide** : Les headers de comptage variaient selon la version de GLPI. Corrigé avec une logique de détection multi-sources.
- **CORS / Proxy** : Configuration du proxy Vite pour rediriger `/api` et `/apirest` vers les bons scripts PHP de GLPI.
- **Reset incomplet** : Certains types d'assets importés n'étaient pas ciblés par la purge. Corrigé en synchronisant `allAPI` dans `resetService.js`.
- **Recherche Tickets inopérante** : Correction de la syntaxe RSQL et ajout d'un filtrage local de secours pour assurer la fiabilité de la recherche.
- **Kanban colonnes toutes identiques** : Le filtre `status==X` de la V2 ne fonctionnait pas correctement. Corrigé en passant `fetchKanbanTickets` en Legacy avec `searchText[status]`.
- **Hook invalide (Invalid hook call)** : Imports manquants de `fetchKanbanSettings`, `extractColors`, `extractLabels` dans `KanbanPage`. Corrigé en ajoutant les imports depuis `kanbanSettingsService`.
- **Changement de langue sans effet** : `KANBAN_STATUSES` passé directement aux colonnes sans appliquer les labels traduits. Corrigé avec `statusesWithLabels = KANBAN_STATUSES.map(s => ({...s, label: labels[s.id] ?? s.label}))`.
- **WebSocket HMR échoue** : Ajout de `hmr: { protocol: 'ws', host: 'localhost', port: 5173 }` dans `vite.config.js`.

---

## Backend Express.js (Node.js)

Le backend a été migré de Spring Boot vers une architecture Node.js/Express.js intégrée à l'application React sous `backend/`.

### Stack technique backend

| Élément | Détail |
|---|---|
| Framework | **Express.js** |
| Environnement | **Node.js** >= 18 (CommonJS via `.cjs`) |
| Base de données | **SQLite** via `sql.js` (WebAssembly, pure JS, sans compilation native C++) |
| Persistance | Écriture immédiate sur disque (`glpi_data.db`) après chaque modification |
| Dev Tooling | **Nodemon** (configuré pour ignorer la base SQLite pour éviter les boucles de restart) |
| Point d'entrée | `backend/server.cjs` (sur le port `8080`) |

### Configuration et Exclusions (`nodemon.json`)
Pour éviter que les écritures de la base de données ne déclenchent des boucles de redémarrage avec Nodemon, la configuration suivante est appliquée :
```json
{
  "ignore": [
    "backend/glpi_data.db*",
    "node_modules"
  ]
}
```

---

### Structure complète des fichiers

```
glpi-newapp/
├── package.json                   ← Dépendances Express/sql.js et scripts npm
├── nodemon.json                   ← Dossiers et fichiers ignorés par nodemon
└── backend/
    ├── server.cjs                 ← Point d'entrée principal (Middlewares, CORS, Routing)
    ├── db.cjs                     ← Connexion SQLite via sql.js et wrapper d'accès synchrone
    ├── glpi_data.db               ← Base SQLite persistante
    ├── services/                  ← SQL + Logique Métier (tout dans un fichier)
    │   ├── kanbanSettings.cjs     ← Logique et requêtes pour les paramètres Kanban
    │   ├── kanbanLanguages.cjs    ← Logique et requêtes pour les langues Kanban
    │   ├── kanbanColorsHistory.cjs ← Logique et requêtes pour l'historique des couleurs
    │   ├── ticketStatusHistory.cjs ← Logique et requêtes pour l'historique des statuts
    │   └── ticketSuperCost.cjs    ← Logique et requêtes pour les surcoûts
    └── routes/                    ← Seulement les endpoints, pas de logique
        ├── kanban/
        │   ├── index.cjs
        │   ├── settings.cjs       ← Routes /backend/kanban/settings
        │   └── languages.cjs      ← Routes /backend/kanban/languages
        ├── history/
        │   ├── index.cjs
        │   ├── colors.cjs         ← Routes /backend/history/colors
        │   └── ticketStatus.cjs   ← Routes /backend/history/ticket-status
        ├── ticket-super-cost/
        │   ├── index.cjs
        │   └── superCost.cjs      ← Routes /backend/ticket-super-cost
        └── ticket-item/
            └── index.cjs          ← Routes /backend/ticket-item
```

---

### Structure Modulaire (Routes + Services)

Pour faciliter la maintenance et la copie des fichiers, le backend a été restructuré en **deux dossiers** :
1. **`services/`** : Contient toutes les requêtes SQL + la logique métier. Un fichier par domaine (100% autonome, facile à copier).
2. **`routes/`** : Contient uniquement les définitions des endpoints. Chaque route appelle un service (aucune logique métier ici, très simple).

**Principes clés :**
- Toutes les requêtes SQL sont dans `services/`
- Toutes les logiques métier (transactions, vérifications) sont dans `services/`
- Les fichiers `routes/` ne font qu'appeler les services et renvoyer la réponse
- Facile à diviser et à copier dans un autre projet

---

### Accès aux données et Persistance (`backend/db.cjs`)

Puisque `sql.js` fonctionne en mémoire, le fichier `db.cjs` implémente un wrapper synchrone pour reproduire le comportement de JDBC/Hibernate. Chaque écriture (`run` ou `transaction`) déclenche une écriture synchrone immédiate sur le disque.

```javascript
// Les opérations clés du wrapper db :
// - db.prepare(sql).get(...params) : Récupère une seule ligne
// - db.prepare(sql).all(...params) : Récupère toutes les lignes
// - db.prepare(sql).run(...params) : Exécute INSERT/UPDATE/DELETE et écrit sur disque
// - db.transaction(fn) : Exécute une série de requêtes en une seule transaction
```

---

### Les Routes et APIs

Toutes les routes personnalisées commencent désormais par le préfixe `/backend`.

#### 1. Configuration Kanban & Langues (`/backend/settings`)
* **`GET /backend/settings/kanban`** : Récupère les dernières couleurs définies (INSERT-only).
* **`POST /backend/settings/kanban`** : Ajoute de nouvelles couleurs et enregistre tout changement dans l'historique.
* **`GET /backend/settings/languages`** : Retourne toutes les langues avec leurs labels traduits.
* **`GET /backend/settings/languages/codes`** : Renvoie les codes de langues disponibles (ex: `["fr", "mg"]`).
* **`POST /backend/settings/languages`** : Ajoute ou met à jour les labels d'une langue (`ON CONFLICT DO UPDATE`).
* **`DELETE /backend/settings/languages/:code`** : Supprime une langue (le français `fr` est protégé).

#### 2. Historiques (`/backend/history`)
* **`GET /backend/history/colors`** : Récupère l'historique des changements de couleurs.
* **`DELETE /backend/history/colors`** : Vide l'historique des couleurs.
* **`POST /backend/history/ticket-status`** : Enregistre le changement de statut d'un ticket lors d'un Drag & Drop.
* **`GET /backend/history/ticket-status`** : Récupère tout l'historique de statut des tickets.
* **`GET /backend/history/ticket-status/:ticketId`** : Récupère l'historique propre à un ticket.

#### 3. Surcoûts (`/backend/ticket-super-cost`)
* **`GET /backend/ticket-super-cost/total`** : Calcule le total cumulé de tous les surcoûts de fermeture actifs (`type = 'close'`).
* **`GET /backend/ticket-super-cost/report`** : Récupère le rapport complet des coûts de fermeture et de réouverture par itemtype.
* **`GET /backend/ticket-super-cost/:ticketId/last-active`** : Récupère le dernier surcoût de type 'close' actif pour un ticket.
* **`GET /backend/ticket-super-cost/:ticketId/base/:mode`** : Calcule le montant de base pour la réouverture d'un ticket selon le mode sélectionné (1: Dernier, 2: Premier, 3: Moyenne, 4: Total).
* **`GET /backend/ticket-super-cost/:ticketId`** : Récupère le montant du dernier coût de type 'close' actif pour un ticket.
* **`POST /backend/ticket-super-cost`** : Enregistre un nouveau coût de fermeture de type 'close'.
* **`POST /backend/ticket-super-cost/reopen`** : Enregistre un coût de réouverture de type 'reopen' avec son pourcentage et son mode de calcul.
* **`POST /backend/ticket-super-cost/:ticketId/cancel`** : Annule le dernier coût ou réouverture actif du ticket (`is_active = 0`).

#### 4. Relations Ticket-Items (`/backend/ticket-item`)
* **`POST /backend/ticket-item`** : Associe des items (équipements) à un ticket.
* **`GET /backend/ticket-item/:ticketId`** : Récupère la liste des items associés à un ticket.
* **`GET /backend/ticket-item/:ticketId/count`** : Récupère le nombre d'items associés à un ticket.

---

### Flux de données complet (React → Express → SQLite)

```
[Drag & Drop Kanban]
    │
    ├─► ticketService.js (React)
    │     updateTicketStatus(id, newStatus)  → PUT Legacy API GLPI
    │     saveTicketStatusHistory(...)       → POST /backend/history/ticket-status
    │
    └─► server.cjs (Express)
              │
              ▼
          routes/history.cjs
              │
              ▼
          db.cjs -> INSERT INTO ticket_status_history (...)
              │
              ▼
          SQLite (glpi_data.db)
```

### Lancer le backend

Depuis la racine de `glpi-newapp` :
```bash
npm run backend
# Lance nodemon backend/server.cjs sur http://localhost:8080
```

---

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

1. **Toujours utiliser `get/post/put/del` (V2) sauf pour le Reset et le Kanban**
2. **`Legacy.*` uniquement dans `resetService.js` et fonctions Kanban de `ticketService.js`**
3. **Toujours passer par le proxy Vite — ne jamais hardcoder `http://localhost/glpi`**
4. **Les réponses GLPI sont en JSON — toujours lire `response.data`**
5. **Pour compter les éléments GLPI — lire `response.headers['content-range']` ou `x-total-count`**
6. **Le backend Express gère SQLite — React ne touche jamais SQLite directement**
7. **Les services dans `services/backend/` appellent le backend Express via le préfixe de proxy `/backend`**
8. **Les autres services (`ticketService`, `elementService`, etc.) appellent GLPI**
9. **`kanban_settings` : toujours INSERT jamais UPDATE — valeur courante = dernier INSERT**
10. **`kanban_languages` : INSERT ou UPDATE — c'est une table de référence stable**
11. **Le français (`fr`) ne peut jamais être supprimé des langues Kanban**