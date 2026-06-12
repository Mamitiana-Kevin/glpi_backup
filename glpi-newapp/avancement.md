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
│   ├── backend/                   ← appels vers Spring Boot (SQLite)
│   │   ├── ticketService.js        ← saveTicketStatusHistory, fetchTicketStatusHistory
│   │   └── kanbanLanguageService.js ← CRUD langues multilingues
│   ├── dashboardService.js         ← stats assets + tickets ✓ FAIT
│   ├── resetService.js             ← purge Legacy ✓ FAIT
│   ├── elementService.js           ← fetchElements, ASSET_TYPES ✓ FAIT
│   ├── kanbanSettingsService.js    ← fetchKanbanSettings, saveKanbanSettings, extractColors ✓ FAIT
│   └── ticketService.js            ← fetchKanbanTickets, updateTicketStatus, KANBAN_STATUSES, createTicket ✓ FAIT
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
│   │   └── settings/
│   │       └── KanbanSettingsPage.jsx ← ✓ FAIT (couleurs + labels multilingues)
│   └── frontoffice/
│       ├── elements/
│       │   └── Element.jsx          ← ✓ FAIT
│       └── tickets/
│           ├── CreateTicket.jsx     ← ✓ FAIT (accepte formData/onChange/formId)
│           ├── KanbanPage.jsx       ← ✓ FAIT (Kanban + multilingue + multi-création)
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
| Spring Boot + SQLite | ✅ Fait | 3 tables : kanban_settings, kanban_color_history, ticket_status_history |
| Paramètres Kanban | ✅ Fait | Couleurs + labels multilingues (table kanban_languages) |
| Historique statuts tickets | ✅ Fait | Enregistré dans SQLite à chaque drag&drop |
| Historique couleurs | ✅ Fait | Enregistré dans SQLite à chaque changement de couleur |
| Documentation Technique | ✅ Fait | Création du fichier `documentation.md` |

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

### Spring Boot + SQLite
- **Projet initialisé** : Spring Boot 3.3 avec Tomcat embarqué, SQLite via `sqlite-jdbc` + `hibernate-community-dialects`.
- **3 tables créées automatiquement** via `ddl-auto=update` :
  - `kanban_settings` : couleurs uniquement, toujours INSERT jamais UPDATE, valeur courante = dernier INSERT par clé.
  - `kanban_color_history` : historique des changements de couleur (old/new color, statusId, changedAt).
  - `ticket_status_history` : historique des changements de statut des tickets lors des drag & drop (ticketId, ticketName, oldStatus, newStatus, changedAt).
- **Endpoints Spring Boot** :
  - `GET/POST /settings/kanban` → couleurs
  - `GET /history/colors`, `GET /history/colors/{statusId}`, `DELETE /history/colors`
  - `GET/POST /history/ticket-status`, `GET /history/ticket-status/{ticketId}`, `DELETE /history/ticket-status`
- **Historique statuts** : À chaque drag & drop dans le Kanban, React appelle `saveTicketStatusHistory` (dans `services/backend/ticketService.js`) pour enregistrer le changement dans SQLite.

### Multilingue Kanban (migration Option 1 → Option 2)
- **Nouvelle table `kanban_languages`** : Remplace les clés `label_X_XX` dans `kanban_settings`. Contient `languageCode`, `statusId`, `label` avec contrainte unique sur `(languageCode, statusId)`.
- **Nouveau service Spring Boot** : `KanbanLanguageService` + `KanbanLanguageController` avec endpoints :
  - `GET /settings/languages` → toutes les langues `{ fr: {1:"Nouveau",...}, mg: {...} }`
  - `GET /settings/languages/codes` → `["fr", "mg", "en"]`
  - `GET /settings/languages/{code}` → labels d'une langue
  - `POST /settings/languages` → ajouter/modifier une langue
  - `DELETE /settings/languages/{code}` → supprimer (sauf fr)
- **Nouveau service React** : `services/backend/kanbanLanguageService.js` pour tous les appels vers Spring Boot.
- **`kanbanSettingsService.js` simplifié** : Ne gère plus que les couleurs (`fetchKanbanSettings`, `saveKanbanSettings`, `extractColors`). Les fonctions `extractLabels` et `extractAvailableLanguages` ont été supprimées.
- **Sélecteur de langue dans le Kanban** : `KanbanPage` charge toutes les langues au démarrage et recharge les labels à la volée lors d'un changement de langue sans recharger les tickets.
- **Page paramètres Kanban** : `KanbanSettingsPage` (backoffice) permet de modifier les couleurs + gérer les langues (ajouter, modifier, supprimer). Le français ne peut pas être supprimé.

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

## Backend Spring Boot

### Stack technique backend

| Élément | Détail |
|---|---|
| Framework | Spring Boot **4.0.6** |
| Langage | Java **17** |
| Packaging | **WAR** (déployable sur Tomcat externe) |
| Persistence | Spring Data JPA + Hibernate |
| Base de données | **SQLite** via `sqlite-jdbc 3.45.1.0` |
| Dialecte | `org.hibernate.community.dialect.SQLiteDialect` |
| Boilerplate | **Lombok** (`@Data`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@RequiredArgsConstructor`) |
| Point d'entrée | `GlpiBackendApplication.java` + `ServletInitializer.java` (WAR) |

### Configuration (`application.properties`)
```properties
# SQLite
spring.datasource.url=jdbc:sqlite:glpi_data.db
spring.datasource.driver-class-name=org.sqlite.JDBC
spring.jpa.database-platform=org.hibernate.community.dialect.SQLiteDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true

# Port
server.port=8080

# CORS pour React
spring.web.cors.allowed-origins=http://localhost:5173
```

> `ddl-auto=update` : Hibernate crée/met à jour automatiquement les tables au démarrage. Aucun script SQL manuel.

---

### Structure complète des fichiers

```
glpi-backend/
├── pom.xml                              ← dépendances Maven
├── glpi_data.db                         ← base SQLite (auto-générée)
└── src/
    ├── main/
    │   ├── java/com/glpi/glpi_backend/
    │   │   ├── GlpiBackendApplication.java    ← @SpringBootApplication, main()
    │   │   ├── ServletInitializer.java        ← extends SpringBootServletInitializer (WAR)
    │   │   ├── model/
    │   │   │   ├── KanbanSetting.java
    │   │   │   ├── KanbanColorHistory.java
    │   │   │   ├── KanbanLanguage.java
    │   │   │   └── TicketStatusHistory.java
    │   │   ├── repository/
    │   │   │   ├── KanbanSettingRepository.java
    │   │   │   ├── KanbanColorHistoryRepository.java
    │   │   │   ├── KanbanLanguageRepository.java
    │   │   │   └── TicketStatusHistoryRepository.java
    │   │   ├── service/
    │   │   │   ├── KanbanSettingService.java
    │   │   │   ├── KanbanColorHistoryService.java
    │   │   │   ├── KanbanLanguageService.java
    │   │   │   └── TicketStatusHistoryService.java
    │   │   └── controller/
    │   │       ├── KanbanSettingsController.java
    │   │       ├── KanbanColorHistoryController.java
    │   │       ├── KanbanLanguageController.java
    │   │       └── TicketStatusHistoryController.java
    │   └── resources/
    │       └── application.properties
    └── test/
```

---

### Couche Model (Entités JPA)

Les entités sont annotées `@Entity` + `@Table` et mappées automatiquement vers des tables SQLite.
Lombok génère `get/set/equals/hashCode/toString` via `@Data`, et les constructeurs via `@NoArgsConstructor`/`@AllArgsConstructor`.

#### `KanbanSetting.java` → table `kanban_settings`

**Règle critique : jamais d'UPDATE, toujours INSERT.**
La valeur courante d'une clé = le dernier INSERT (ORDER BY createdAt DESC LIMIT 1).

```java
@Entity @Table(name = "kanban_settings")
public class KanbanSetting {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String key;        // ex: "color_1", "color_2", "color_5"

    @Column(nullable = false)
    private String value;      // ex: "#3b82f6"

    @Column(nullable = false)
    private LocalDateTime createdAt;  // auto-rempli par @PrePersist

    @Column(nullable = false)
    private String changedBy;  // ex: "admin"

    @PrePersist
    public void prePersist() { this.createdAt = LocalDateTime.now(); }
}
```

Clés utilisées : `color_1` (Nouveau), `color_2` (En cours), `color_5` (Résolu).

---

#### `KanbanColorHistory.java` → table `kanban_color_history`

Enregistre chaque changement de couleur avec l'ancienne et la nouvelle valeur.

```java
@Entity @Table(name = "kanban_color_history")
public class KanbanColorHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer statusId;  // 1, 2 ou 5
    private String oldColor;   // ex: "#3b82f6"
    private String newColor;   // ex: "#ef4444"
    private LocalDateTime changedAt;  // auto @PrePersist
    private String changedBy;
}
```

---

#### `KanbanLanguage.java` → table `kanban_languages`

Table de référence stable pour les labels multilingues.
**Contrairement à KanbanSetting : INSERT ou UPDATE selon l'existence.**
Contrainte unique sur `(language_code, status_id)`.

```java
@Entity
@Table(name = "kanban_languages",
       uniqueConstraints = @UniqueConstraint(columnNames = {"language_code", "status_id"}))
public class KanbanLanguage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "language_code", nullable = false)
    private String languageCode;  // ex: "fr", "mg", "en"

    @Column(name = "status_id", nullable = false)
    private Integer statusId;     // 1, 2 ou 5

    @Column(nullable = false)
    private String label;         // ex: "Vaovao"
}
```

---

#### `TicketStatusHistory.java` → table `ticket_status_history`

Enregistré à chaque drag & drop dans le Kanban.

```java
@Entity @Table(name = "ticket_status_history")
public class TicketStatusHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer ticketId;    // ID ticket dans GLPI
    private String ticketName;   // Nom du ticket (dénormalisé pour lisibilité)
    private Integer oldStatus;   // Ancien statut GLPI
    private Integer newStatus;   // Nouveau statut GLPI
    private LocalDateTime changedAt;  // auto @PrePersist
}
```

---

### Couche Repository (Spring Data JPA)

Chaque repository étend `JpaRepository<Entité, Long>` — Spring génère automatiquement les requêtes SQL à partir des noms de méthodes.

#### `KanbanSettingRepository`

```java
@Repository
public interface KanbanSettingRepository extends JpaRepository<KanbanSetting, Long> {

    // SELECT * FROM kanban_settings WHERE key = ? ORDER BY created_at DESC LIMIT 1
    @Query("SELECT s FROM KanbanSetting s WHERE s.key = :key ORDER BY s.createdAt DESC")
    Optional<KanbanSetting> findLatestByKey(String key);
}
```

#### `KanbanColorHistoryRepository`

```java
@Repository
public interface KanbanColorHistoryRepository extends JpaRepository<KanbanColorHistory, Long> {

    // SELECT * FROM kanban_color_history WHERE status_id = ? ORDER BY changed_at DESC
    List<KanbanColorHistory> findByStatusIdOrderByChangedAtDesc(Integer statusId);

    // SELECT * FROM kanban_color_history ORDER BY changed_at DESC
    List<KanbanColorHistory> findAllByOrderByChangedAtDesc();
}
```

#### `KanbanLanguageRepository`

```java
@Repository
public interface KanbanLanguageRepository extends JpaRepository<KanbanLanguage, Long> {

    // SELECT * FROM kanban_languages WHERE language_code = ?
    List<KanbanLanguage> findByLanguageCode(String languageCode);

    // SELECT * FROM kanban_languages WHERE language_code = ? AND status_id = ?
    Optional<KanbanLanguage> findByLanguageCodeAndStatusId(String languageCode, Integer statusId);

    // SELECT DISTINCT language_code FROM kanban_languages
    @Query("SELECT DISTINCT k.languageCode FROM KanbanLanguage k")
    List<String> findDistinctLanguageCodes();

    // DELETE FROM kanban_languages WHERE language_code = ?
    void deleteByLanguageCode(String languageCode);
}
```

#### `TicketStatusHistoryRepository`

```java
@Repository
public interface TicketStatusHistoryRepository extends JpaRepository<TicketStatusHistory, Long> {

    // SELECT * FROM ticket_status_history WHERE ticket_id = ? ORDER BY changed_at DESC
    List<TicketStatusHistory> findByTicketIdOrderByChangedAtDesc(Integer ticketId);

    // SELECT * FROM ticket_status_history ORDER BY changed_at DESC
    List<TicketStatusHistory> findAllByOrderByChangedAtDesc();
}
```

---

### Couche Service (Logique métier)

#### `KanbanSettingService`

Gère uniquement les **couleurs** (les labels sont dans `KanbanLanguageService`).

```java
@Service @RequiredArgsConstructor
public class KanbanSettingService {

    // Couleurs par défaut si aucun enregistrement en base
    private static final Map<String, String> DEFAULTS = Map.of(
        "color_1", "#3b82f6",  // bleu
        "color_2", "#f59e0b",  // orange
        "color_5", "#16a34a"   // vert
    );

    // Lit la valeur courante de chaque clé (= dernier INSERT)
    public Map<String, String> getCurrentSettings() { ... }

    // Sauvegarde via INSERT + enregistre dans KanbanColorHistory si couleur changée
    public Map<String, String> saveSettings(Map<String, String> newSettings, String changedBy) {
        // Pour chaque clé "color_X" reçue :
        //   1. INSERT dans kanban_settings
        //   2. Si valeur différente de l'ancienne → INSERT dans kanban_color_history
    }
}
```

#### `KanbanLanguageService`

```java
@Service @RequiredArgsConstructor
public class KanbanLanguageService {

    private static final List<Integer> STATUS_IDS = List.of(1, 2, 5);

    // Labels français par défaut (fallback si pas en base)
    private static final Map<Integer, String> FR_DEFAULTS = Map.of(
        1, "Nouveau", 2, "En cours", 5, "Résolu"
    );

    // Retourne { "fr": {1:"Nouveau",...}, "mg": {1:"Vaovao",...} }
    public Map<String, Map<Integer, String>> getAll() { ... }

    // Retourne les labels d'une langue (fallback français si inconnue)
    public Map<Integer, String> getByCode(String code) { ... }

    // Retourne ["fr", "mg", "en"] — fr toujours en premier
    public List<String> getAvailableCodes() { ... }

    // INSERT si nouveau, UPDATE si existant (findByLanguageCodeAndStatusId)
    @Transactional
    public Map<Integer, String> saveLanguage(String code, Map<Integer, String> labels) { ... }

    // Interdit pour "fr" → lance IllegalArgumentException
    @Transactional
    public void deleteLanguage(String code) { ... }
}
```

#### `KanbanColorHistoryService`

```java
@Service @RequiredArgsConstructor
public class KanbanColorHistoryService {
    public List<KanbanColorHistory> getAll()                         // tout l'historique
    public List<KanbanColorHistory> getByStatusId(Integer statusId)  // historique d'un statut
    public void clearAll()                                           // vider la table
}
```

#### `TicketStatusHistoryService`

```java
@Service @RequiredArgsConstructor
public class TicketStatusHistoryService {
    // Crée un enregistrement (appelé depuis React à chaque drag & drop)
    public TicketStatusHistory save(Integer ticketId, String ticketName, Integer oldStatus, Integer newStatus)

    public List<TicketStatusHistory> getAll()
    public List<TicketStatusHistory> getByTicketId(Integer ticketId)
    public void clearAll()
}
```

---

### Couche Controller (API REST)

Tous les controllers sont annotés `@RestController` + `@CrossOrigin(origins = "http://localhost:5173")`.

#### `KanbanSettingsController` — `/settings/kanban`

| Méthode | URL | Description | Body / Réponse |
|---|---|---|---|
| `GET` | `/settings/kanban` | Couleurs actuelles | `{"color_1":"#3b82f6","color_2":"#f59e0b","color_5":"#16a34a"}` |
| `POST` | `/settings/kanban` | Sauvegarder couleurs | `{"settings":{"color_1":"#ef4444"},"changedBy":"admin"}` |

#### `KanbanLanguageController` — `/settings/languages`

| Méthode | URL | Description | Réponse exemple |
|---|---|---|---|
| `GET` | `/settings/languages` | Toutes les langues | `{"fr":{1:"Nouveau",...},"mg":{1:"Vaovao",...}}` |
| `GET` | `/settings/languages/codes` | Codes disponibles | `["fr","mg","en"]` |
| `GET` | `/settings/languages/{code}` | Labels d'une langue | `{1:"Vaovao",2:"Efa manao",5:"Vita"}` |
| `POST` | `/settings/languages` | Ajouter/modifier une langue | `{"code":"mg","labels":{"1":"Vaovao","2":"Efa manao","5":"Vita"}}` |
| `DELETE` | `/settings/languages/{code}` | Supprimer une langue (sauf `fr`) | `204 No Content` ou `400` |

#### `KanbanColorHistoryController` — `/history/colors`

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/history/colors` | Tout l'historique couleurs |
| `GET` | `/history/colors/{statusId}` | Historique d'un statut |
| `DELETE` | `/history/colors` | Vider l'historique |

#### `TicketStatusHistoryController` — `/history/ticket-status`

| Méthode | URL | Description | Body |
|---|---|---|---|
| `POST` | `/history/ticket-status` | Enregistrer un changement | `{"ticketId":5,"ticketName":"Pb réseau","oldStatus":1,"newStatus":2}` |
| `GET` | `/history/ticket-status` | Tout l'historique | — |
| `GET` | `/history/ticket-status/{ticketId}` | Historique d'un ticket | — |
| `DELETE` | `/history/ticket-status` | Vider l'historique | — |

---

### Flux de données complet (React → Spring Boot → SQLite)

```
[Drag & Drop Kanban]
    │
    ├─► ticketService.js (React)
    │     updateTicketStatus(id, newStatus)  → PUT Legacy API GLPI
    │     saveTicketStatusHistory(...)       → POST /history/ticket-status
    │
    └─► TicketStatusHistoryController (Spring Boot)
              │
              ▼
          TicketStatusHistoryService.save(...)
              │
              ▼
          TicketStatusHistoryRepository.save(entity)
              │
              ▼
          SQLite → INSERT INTO ticket_status_history (...)

[Changement couleur Kanban]
    │
    ├─► kanbanSettingsService.js (React)
    │     saveKanbanSettings({color_1:"#ef4444"})  → POST /settings/kanban
    │
    └─► KanbanSettingsController (Spring Boot)
              │
              ▼
          KanbanSettingService.saveSettings(...)
              ├── INSERT INTO kanban_settings (key="color_1", value="#ef4444")
              └── INSERT INTO kanban_color_history (oldColor, newColor, ...)

[Changement langue Kanban]
    │
    ├─► kanbanLanguageService.js (React)
    │     saveLanguage("mg", {1:"Vaovao",...})  → POST /settings/languages
    │
    └─► KanbanLanguageController (Spring Boot)
              │
              ▼
          KanbanLanguageService.saveLanguage(...)
              └── INSERT OR UPDATE kanban_languages (language_code, status_id, label)
```

### Lancer le backend
```bash
cd glpi-backend
mvn spring-boot:run
# Accessible sur http://localhost:8080
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
6. **Spring Boot gère SQLite — React ne touche jamais SQLite directement**
7. **Les services dans `services/backend/` appellent Spring Boot (port 8080)**
8. **Les autres services (`ticketService`, `elementService`, etc.) appellent GLPI**
9. **`kanban_settings` : toujours INSERT jamais UPDATE — valeur courante = dernier INSERT**
10. **`kanban_languages` : INSERT ou UPDATE — c'est une table de référence stable**
11. **Le français (`fr`) ne peut jamais être supprimé des langues Kanban**