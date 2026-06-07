import api, { initSession, legacyApi, initLegacySession } from "../glpi";

const ITEM_TYPES = [
  "Computer",
  "Monitor",
  "Printer",
  "NetworkEquipment",
  "Phone",
];

export const getItems = async (itemType = "Computer") => {
  await initSession();
  const response = await api.get(`Assets/${itemType}`);
  return Array.isArray(response.data)
    ? response.data
    : response.data.data || [];
};

export const getTickets = async () => {
  await initSession();
  const response = await api.get("Assistance/Ticket");
  return Array.isArray(response.data)
    ? response.data
    : response.data.data || [];
};

/**
 * Coûts d'un ticket : sous-ressource HL /Assistance/Ticket/{id}/Cost.
 */
export const getTicketCosts = async (ticketId) => {
  await initSession();
  const response = await api.get(`Assistance/Ticket/${ticketId}/Cost`);
  return Array.isArray(response.data)
    ? response.data
    : response.data.data || [];
};

/**
 * Équipements liés à un ticket. L'API HL v2.3 n'expose pas la relation
 * Item_Ticket : on passe par l'API legacy, puis on enrichit chaque lien avec le
 * nom de l'asset (récupéré via l'API HL).
 * @returns {Promise<Array<{itemtype:string, items_id:number, name:string|null}>>}
 */
export const getTicketItems = async (ticketId) => {
  await initLegacySession();
  const response = await legacyApi.get(`Ticket/${ticketId}/Item_Ticket`);
  const links = Array.isArray(response.data)
    ? response.data
    : response.data.data || [];

  await initSession();
  return Promise.all(
    links.map(async (link) => {
      let name = null;
      try {
        const asset = await api.get(`Assets/${link.itemtype}/${link.items_id}`);
        name = asset.data?.name ?? null;
      } catch {
        /* nom indisponible (asset supprimé ?) */
      }
      return { itemtype: link.itemtype, items_id: link.items_id, name };
    }),
  );
};

const fetchAllIds = async (endpoint) => {
  try {
    // range large pour récupérer aussi les éléments déjà en corbeille (is_deleted)
    const response = await api.get(endpoint, { params: { range: "0-9999" } });
    const items = Array.isArray(response.data)
      ? response.data
      : response.data.data || [];
    const ids = items
      .map((item) => (typeof item === "object" ? item.id : item))
      .filter(Boolean);
    console.log(`[reset] ${endpoint} → ${ids.length} items`, ids);
    return ids;
  } catch (err) {
    console.warn(
      `[reset] GET ${endpoint} failed:`,
      err.response?.data ?? err.message,
    );
    return [];
  }
};

const deleteById = async (endpoint, id) => {
  try {
    // force=true purge définitivement (paramètre attendu par l'API HL v2.3).
    // Sans ce flag, l'élément est seulement déplacé dans la corbeille (is_deleted)
    // et reste donc présent en base — c'est ce qui faisait échouer le reset.
    await api.delete(`${endpoint}/${id}`, { params: { force: true } });
    console.log(`[reset] deleted ${endpoint}/${id}`);
  } catch (err) {
    console.warn(
      `[reset] DELETE ${endpoint}/${id} failed:`,
      err.response?.data ?? err.message,
    );
  }
};

export const resetData = async () => {
  await initSession();

  // Supprimer les tickets (GLPI supprime en cascade les coûts et liens)
  const ticketIds = await fetchAllIds("Assistance/Ticket");
  for (const id of ticketIds) {
    await deleteById("Assistance/Ticket", id);
  }

  // Supprimer les assets de chaque type
  for (const type of ITEM_TYPES) {
    const ids = await fetchAllIds(`Assets/${type}`);
    for (const id of ids) {
      await deleteById(`Assets/${type}`, id);
    }
  }
};

// ---------------------------------------------------------------------------
// Import helpers
// ---------------------------------------------------------------------------

const parseCSV = (text) => {
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  return lines.slice(1).map((line) => {
    // Handle quoted fields containing commas
    const fields = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = fields[i] ?? "";
    });
    return obj;
  });
};

const readFileText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });

// ---------------------------------------------------------------------------
// Résolution des entités liées (dropdowns + utilisateurs)
// ---------------------------------------------------------------------------
// IMPORTANT : l'API HL v2.3 attend des OBJETS imbriqués pour les clés
// étrangères ({ status: { id }, location: { id }, manufacturer: { id }… }) et
// NON des champs plats (states_id, locations_id…). Les colonnes CSV sont des
// NOMS : on les résout en id via /Dropdowns/{Type} (ou /Administration/User),
// en créant l'entité si elle n'existe pas encore.
// Cache vidé au début de chaque importData() (cf. plus bas).
const _idCache = new Map(); // `${endpoint}::${field}::${name}` → id | null

const resolveOrCreate = async (endpoint, field, name) => {
  const clean = (name ?? "").trim();
  if (!clean) return null;
  const key = `${endpoint}::${field}::${clean}`;
  if (_idCache.has(key)) return _idCache.get(key);

  let id = null;
  try {
    // Filtre RSQL ; valeur entre quotes pour gérer les espaces/accents.
    const res = await api.get(endpoint, {
      params: { filter: `${field}=="${clean}"` },
    });
    const items = Array.isArray(res.data) ? res.data : res.data.data || [];
    if (items.length) id = items[0].id;
  } catch {
    /* introuvable ou filtre non supporté → on tente la création ci-dessous */
  }

  if (!id) {
    try {
      const res = await api.post(endpoint, { [field]: clean });
      id = res.data?.id ?? null;
    } catch (err) {
      console.warn(
        `Création échouée (${endpoint} ${field}="${clean}"):`,
        err.response?.data ?? err.message,
      );
    }
  }

  _idCache.set(key, id);
  return id;
};

// Dropdowns indexés par "name", utilisateurs par "username".
const resolveDropdown = (type, name) =>
  resolveOrCreate(`Dropdowns/${type}`, "name", name);
const resolveUser = (name) =>
  resolveOrCreate("Administration/User", "username", name);

const TICKET_STATUS_MAP = {
  New: 1,
  "En cours": 2,
  "En attente": 4,
  Résolu: 5,
  Clos: 6,
};

const TICKET_PRIORITY_MAP = {
  Low: 2,
  Medium: 3,
  High: 4,
  Urgent: 5,
};

const TICKET_TYPE_MAP = {
  Incident: 1,
  Demande: 2,
  Request: 2,
};

const formatDate = (dateStr, heureStr = "00:00") => {
  // dateStr: DD/MM/YYYY, heureStr: HH:MM
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month}-${day} ${heureStr}:00`;
};

/**
 * Import Feuille 1 (Assets: Computer, Monitor…).
 * Résout/crée les entités liées (Status, Location, Manufacturer, Model, User)
 * et les rattache via des objets imbriqués attendus par l'API HL v2.3.
 * Renvoie une map { nomAsset → { id, itemtype } } réutilisable pour lier les
 * items aux tickets (Feuille 2).
 */
const importAssets = async (csvText) => {
  const rows = parseCSV(csvText);
  const nameToItem = {};

  for (const row of rows) {
    const type = row.Item_Type?.trim();
    if (!type) continue;

    // Body direct (sans wrapper { input }) — sinon asset vide.
    const payload = {
      name: row.Name,
      otherserial: row.Inventory_Number,
    };

    // Clés étrangères : on résout le NOM CSV en id (création si absent) puis on
    // passe un objet { id }. Le modèle dépend du type (ComputerModel/MonitorModel…).
    const statusId = await resolveDropdown("State", row.Status);
    if (statusId) payload.status = { id: statusId };

    const locationId = await resolveDropdown("Location", row.Location);
    if (locationId) payload.location = { id: locationId };

    const manufacturerId = await resolveDropdown("Manufacturer", row.Manufacturer);
    if (manufacturerId) payload.manufacturer = { id: manufacturerId };

    const modelId = await resolveDropdown(`${type}Model`, row.Model);
    if (modelId) payload.model = { id: modelId };

    const userId = await resolveUser(row.User);
    if (userId) payload.user = { id: userId };

    try {
      const res = await api.post(`Assets/${type}`, payload);
      const id = res.data?.id ?? res.data?.[0]?.id;
      if (id && row.Name) nameToItem[row.Name] = { id, itemtype: type };
    } catch (err) {
      console.warn(
        `Asset import failed for ${row.Name}:`,
        err.response?.data ?? err.message,
      );
    }
  }

  return nameToItem;
};

// Parse la colonne Items (Feuille 2). Après parseCSV les guillemets ont déjà
// été retirés, donc on reçoit p.ex. `[PC-ADM-001,MN-FORM-002]`. On enlève les
// crochets/guillemets résiduels et on découpe sur la virgule.
const parseItems = (cell) =>
  String(cell ?? "")
    .replace(/[[\]"]/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Lie un équipement à un ticket via l'API legacy (Item_Ticket) — l'API HL v2.3
 * n'expose pas cette relation.
 */
const linkItemToTicket = async (ticketId, { id, itemtype }) => {
  await legacyApi.post("Item_Ticket", {
    input: { tickets_id: ticketId, items_id: id, itemtype },
  });
};

/**
 * Import Feuille 2 (Tickets) + liaison des équipements (colonne Items).
 * @param {string} csvText
 * @param {Record<string,{id:number,itemtype:string}>} nameToItem  map nom→item
 *        renvoyée par importAssets, pour résoudre les noms de la colonne Items.
 * Returns a map { refTicket → glpiTicketId } pour rattacher les coûts (Feuille 3).
 */
const importTickets = async (csvText, nameToItem = {}) => {
  const rows = parseCSV(csvText);
  const refToId = {};

  for (const row of rows) {
    // GLPI calcule la priorité à partir de l'urgence et de l'impact :
    // on aligne les trois sur la valeur CSV pour des données cohérentes.
    const level = TICKET_PRIORITY_MAP[row.Priority] ?? 3;

    const payload = {
      name: row.Titre,
      content: row.Description,
      // type / urgency / impact / priority sont des ENTIERS dans le schéma HL,
      // mais status est un OBJET { id } (comme pour les assets). Envoyer un
      // entier plat le faisait ignorer → le ticket restait au statut par défaut.
      type: TICKET_TYPE_MAP[row.Type] ?? 1,
      status: { id: TICKET_STATUS_MAP[row.Status] ?? 1 },
      urgency: level,
      impact: level,
      priority: level,
      date: formatDate(row.Date, row.Heure),
    };

    let ticketId;
    try {
      // Body direct (sans wrapper { input }), sinon ticket vide. Voir importAssets.
      const res = await api.post("Assistance/Ticket", payload);
      ticketId = res.data?.id ?? res.data?.[0]?.id;
      if (ticketId) refToId[row.Ref_Ticket] = ticketId;
    } catch (err) {
      console.warn(
        `Ticket import failed for ref ${row.Ref_Ticket}:`,
        err.response?.data ?? err.message,
      );
      continue;
    }
    if (!ticketId) continue;

    // Liaison des équipements rattachés au ticket (colonne Items).
    for (const name of parseItems(row.Items)) {
      const item = nameToItem[name];
      if (!item) {
        console.warn(
          `Item "${name}" introuvable (ticket réf ${row.Ref_Ticket}) — non lié.`,
        );
        continue;
      }
      try {
        await linkItemToTicket(ticketId, item);
      } catch (err) {
        console.warn(
          `Liaison ${name} → ticket ${ticketId} échouée:`,
          err.response?.data ?? err.message,
        );
      }
    }
  }

  return refToId;
};

/**
 * Import Feuille 3 (Coûts). Sous-ressource imbriquée du ticket :
 * POST /Assistance/Ticket/{id}/Cost (tickets_id implicite via l'URL).
 * Num_Ticket correspond au Ref_Ticket de la Feuille 2.
 */
// Les CSV exportés en locale FR utilisent la virgule décimale ("8,7").
const parseNumber = (val) => parseFloat(String(val ?? "").replace(",", ".")) || 0;

const importCosts = async (csvText, refToId) => {
  const rows = parseCSV(csvText);

  for (const row of rows) {
    const ticketId = refToId[row.Num_Ticket];
    if (!ticketId) continue;

    const payload = {
      // L'API HL nomme la durée "duration" (et non "actiontime") : envoyer
      // actiontime laissait la durée à 0.
      name: "Intervention",
      duration: parseNumber(row.Duration_second),
      cost_time: parseNumber(row.Time_Cost),
      cost_fixed: parseNumber(row.Fixed_Cost),
      cost_material: 0,
    };

    try {
      // Body direct (sans wrapper { input }), sinon coût vide. Voir importAssets.
      await api.post(`Assistance/Ticket/${ticketId}/Cost`, payload);
    } catch (err) {
      console.warn(
        `Cost import failed for ticket ${row.Num_Ticket}:`,
        err.response?.data ?? err.message,
      );
    }
  }
};

/**
 * Main import function called from Import.jsx
 * @param {{ feuille1: File, feuille2: File, feuille3: File }} files
 */
export const importData = async ({ feuille1, feuille2, feuille3 }) => {
  await initSession(); // API HL (assets, tickets, coûts)
  await initLegacySession(); // API legacy (liaison Item_Ticket)
  _idCache.clear(); // repartir propre : les dropdowns ont pu changer entre 2 imports

  const [text1, text2, text3] = await Promise.all([
    readFileText(feuille1),
    readFileText(feuille2),
    feuille3 ? readFileText(feuille3) : Promise.resolve(null),
  ]);

  // 1) Assets → renvoie { nomAsset → { id, itemtype } }
  const nameToItem = await importAssets(text1);
  // 2) Tickets + liaison des équipements (colonne Items) via nameToItem
  const refToId = await importTickets(text2, nameToItem);
  // 3) Coûts rattachés aux tickets
  if (text3) await importCosts(text3, refToId);
};

export { api };
export default api;
