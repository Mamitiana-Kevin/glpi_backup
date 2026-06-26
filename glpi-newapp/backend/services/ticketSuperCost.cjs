
const { wrapper: db } = require('../db.cjs');

// ─── Lecture ────────────────────────────────────────────────────────────────

function getLastActiveCost(ticketId) {
  return db.prepare(
    `SELECT * FROM ticket_super_cost WHERE ticket_id = ? AND type = 'close' AND is_active = 1 ORDER BY id DESC LIMIT 1`
  ).get(ticketId);
}

function getTicketCost(ticketId) {
  const lastActive = getLastActiveCost(ticketId);
  return lastActive ? lastActive.amount : null;
}

function getTotalSuperCost() {
  const result = db.prepare(
    `SELECT SUM(amount) AS total FROM ticket_super_cost WHERE type = 'close' AND is_active = 1`
  ).get();
  return result?.total ?? 0;
}

/**
 * Retourne le montant de base selon le mode choisi.
 * Mode 1 : dernier close actif
 * Mode 2 : premier close actif
 * Mode 3 : moyenne des closes actifs
 * Mode 4 : total des closes actifs
 */
function getBaseForMode(ticketId, mode, beforeId = null) {
  const modeInt = parseInt(mode, 10);
  const filter = beforeId
    ? `ticket_id = ? AND type = 'close' AND is_active = 1 AND id < ?`
    : `ticket_id = ? AND type = 'close' AND is_active = 1`;
  const params = beforeId ? [ticketId, beforeId] : [ticketId];

  let row;
  switch (modeInt) {
    case 1:
      row = db.prepare(`SELECT amount FROM ticket_super_cost WHERE ${filter} ORDER BY id DESC LIMIT 1`).get(...params);
      return row?.amount ?? 0;
    case 2:
      row = db.prepare(`SELECT amount FROM ticket_super_cost WHERE ${filter} ORDER BY id ASC LIMIT 1`).get(...params);
      return row?.amount ?? 0;
    case 3:
      row = db.prepare(`SELECT COALESCE(AVG(amount), 0) AS base FROM ticket_super_cost WHERE ${filter}`).get(...params);
      return row?.base ?? 0;
    case 4:
      row = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS base FROM ticket_super_cost WHERE ${filter}`).get(...params);
      return row?.base ?? 0;
    default:
      throw new Error(`Mode inconnu : ${mode}`);
  }
}

// ─── Écriture ────────────────────────────────────────────────────────────────

/**
 * Insère un coût de fermeture (type='close').
 */
function insertCost(ticketId, amount) {
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO ticket_super_cost (ticket_id, amount, type, reopening_pct, reopen_mode, is_active, created_at)
     VALUES (?, ?, 'close', NULL, NULL, 1, ?)`
  ).run(ticketId, amount, createdAt);
  return getLastActiveCost(ticketId);
}

function insertReopen(ticketId, calculatedAmount, reopeningPct, reopenMode) {
  const maxIdRow = db.prepare(`SELECT MAX(id) AS max_id FROM ticket_super_cost`).get();
  const nextId = (maxIdRow?.max_id ?? 0) + 1;
  const finalAmount = computeReopenAmount(ticketId, calculatedAmount, nextId);
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO ticket_super_cost (ticket_id, amount, type, reopening_pct, reopen_mode, is_active, created_at)
     VALUES (?, ?, 'reopen', ?, ?, 1, ?)`
  ).run(ticketId, finalAmount, reopeningPct, reopenMode, createdAt);
}

/**
 * Annule le dernier close actif (is_active = 0).
 */
function cancelLastActiveCost(ticketId) {
  const lastActive = getLastActiveCost(ticketId);
  if (!lastActive) {
    throw new Error('No active cost to cancel');
  }
  db.prepare(`UPDATE ticket_super_cost SET is_active = 0 WHERE id = ?`).run(lastActive.id);
  return lastActive;
}

// ─── Rapport ─────────────────────────────────────────────────────────────────

/** Retourne la map ticketId → nombre d'items */
function _getTicketItemCountMap() {
  const rows = db.prepare(
    `SELECT ticket_id, COUNT(*) AS item_count FROM ticket_item GROUP BY ticket_id`
  ).all();
  const map = {};
  rows.forEach(r => { map[r.ticket_id] = r.item_count; });
  return map;
}

/** Retourne les items d'un ticket */
function _getItemsForTicket(ticketId) {
  return db.prepare(`SELECT * FROM ticket_item WHERE ticket_id = ?`).all(ticketId);
}

/** Initialise une entrée de rapport pour un itemtype si elle n'existe pas */
function _ensureReportEntry(report, itemtype) {
  if (!report[itemtype]) {
    report[itemtype] = { total_super_cost: 0, total_reopening_cost: 0, items: [] };
  }
}

/** Ajoute ou cumule un item dans le rapport */
function _upsertReportItem(report, itemtype, item, allocatedCost, allocatedReopeningCost) {
  const existing = report[itemtype].items.find(
    i => i.item_id === item.item_id && i.itemtype === item.itemtype
  );
  if (!existing) {
    report[itemtype].items.push({ ...item, allocatedCost, allocatedReopeningCost });
  } else {
    existing.allocatedCost += allocatedCost;
    existing.allocatedReopeningCost += allocatedReopeningCost;
  }
}

/** Traite les lignes type='close' is_active=1 dans le rapport */
function _processCloseCosts(report, ticketCountMap) {
  const closeCosts = db.prepare(
    `SELECT ticket_id, amount FROM ticket_super_cost WHERE type = 'close' AND is_active = 1`
  ).all();

  closeCosts.forEach(cost => {
    const { ticket_id: ticketId, amount } = cost;
    const itemCount = ticketCountMap[ticketId] || 1;
    const perItemCost = amount / itemCount;
    const items = _getItemsForTicket(ticketId);

    items.forEach(item => {
      _ensureReportEntry(report, item.itemtype);
      report[item.itemtype].total_super_cost += perItemCost;
      _upsertReportItem(report, item.itemtype, item, perItemCost, 0);
    });
  });
}

/** Traite les lignes type='reopen' is_active=1 dans le rapport */
function _processReopenCosts(report, ticketCountMap) {
  const reopenCosts = db.prepare(
    `SELECT ticket_id, amount FROM ticket_super_cost WHERE type = 'reopen' AND is_active = 1`
  ).all();

  reopenCosts.forEach(cost => {
    const { ticket_id: ticketId, amount } = cost;
    const itemCount = ticketCountMap[ticketId] || 1;
    const perItemReopeningCost = amount / itemCount;
    const items = _getItemsForTicket(ticketId);

    items.forEach(item => {
      _ensureReportEntry(report, item.itemtype);
      report[item.itemtype].total_reopening_cost += perItemReopeningCost;
      _upsertReportItem(report, item.itemtype, item, 0, perItemReopeningCost);
    });
  });
}

/** Convertit le rapport en tableau */
function _reportToArray(report) {
  return Object.keys(report).map(itemtype => ({
    itemtype,
    total_super_cost: report[itemtype].total_super_cost,
    total_reopening_cost: report[itemtype].total_reopening_cost,
    items: report[itemtype].items,
  }));
}

function getCostReportByItemtype() {
  const ticketCountMap = _getTicketItemCountMap();
  const report = {};
  _processCloseCosts(report, ticketCountMap);
  _processReopenCosts(report, ticketCountMap);
  return _reportToArray(report);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

function getPlafondPct() {
  const row = db.prepare(`SELECT value FROM cost_settings WHERE key = 'plafond_pct'`).get();
  return row?.value ?? 30;
}

function setPlafondPct(pct) {
  db.prepare(`UPDATE cost_settings SET value = ? WHERE key = 'plafond_pct'`).run(pct);
}

function getPlafondForTicket(ticketId, beforeId) {
  const totalCloses = getBaseForMode(ticketId, 4, beforeId);
  const pct = getPlafondPct();
  return totalCloses * (pct / 100);
}

function getCumulReopens(ticketId, beforeId) {
  const filter = beforeId
    ? `ticket_id = ? AND type = 'reopen' AND is_active = 1 AND id < ?`
    : `ticket_id = ? AND type = 'reopen' AND is_active = 1`;
  const params = beforeId ? [ticketId, beforeId] : [ticketId];
  const row = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM ticket_super_cost WHERE ${filter}`
  ).get(...params);
  return row?.total ?? 0;
}

function computeReopenAmount(ticketId, calculatedAmount, beforeId) {
  const plafond = getPlafondForTicket(ticketId, beforeId);
  const cumul = getCumulReopens(ticketId, beforeId);
  const reste = plafond - cumul;
  if (reste <= 0) return 0;
  if (calculatedAmount > reste) return reste;
  return calculatedAmount;
}

function getAllReopens() {
  return db.prepare(
    `SELECT * FROM ticket_super_cost WHERE type = 'reopen' ORDER BY id DESC`
  ).all();
}

function updateReopen(id, reopeningPct, reopenMode) {
  const row = db.prepare(
    `SELECT ticket_id FROM ticket_super_cost WHERE id = ?`
  ).get(id);
  if (!row) return;

  const ticketId = row.ticket_id;
  const base = getBaseForMode(ticketId, reopenMode, id);
  const calculatedAmount = (reopeningPct / 100) * base;
  const finalAmount = computeReopenAmount(ticketId, calculatedAmount, id);

  db.prepare(
    `UPDATE ticket_super_cost SET reopening_pct = ?, reopen_mode = ?, amount = ? WHERE id = ? AND type = 'reopen'`
  ).run(reopeningPct, reopenMode, finalAmount, id);
}

function getAllCloseCosts() {
  return db.prepare(
    `SELECT * FROM ticket_super_cost WHERE type = 'close' ORDER BY id DESC`
  ).all();
}
function updateCloseCost(id, amount) {
  const closeRow = db.prepare(
    `SELECT ticket_id FROM ticket_super_cost WHERE id = ?`
  ).get(id);
  if (!closeRow) return;

  const ticketId = closeRow.ticket_id;

  db.prepare(
    `UPDATE ticket_super_cost SET amount = ? WHERE id = ? AND type = 'close'`
  ).run(amount, id);

  _recalcReopens(ticketId);
}

function restoreCost(id) {
  const row = db.prepare(
    `SELECT ticket_id, type FROM ticket_super_cost WHERE id = ?`
  ).get(id);
  if (!row) return;

  db.prepare(
    `UPDATE ticket_super_cost SET is_active = 1 WHERE id = ?`
  ).run(id);

  if (row.type === 'close') {
    _recalcReopens(row.ticket_id);
  }
}

function _recalcReopens(ticketId) {


  const reopens = db.prepare(
    `SELECT id, reopening_pct, reopen_mode FROM ticket_super_cost 
     WHERE ticket_id = ? AND type = 'reopen' AND is_active = 1 
     ORDER BY id ASC`
  ).all(ticketId);

  for (const reopen of reopens) {
    const base = getBaseForMode(ticketId, reopen.reopen_mode, reopen.id);
    const calculatedAmount = (reopen.reopening_pct / 100) * base;
    const finalAmount = computeReopenAmount(ticketId, calculatedAmount, reopen.id);
    db.prepare(
      `UPDATE ticket_super_cost SET amount = ? WHERE id = ?`
    ).run(finalAmount, reopen.id);
  }
}
function getCancelledCosts() {
  return db.prepare(
    `SELECT * FROM ticket_super_cost WHERE is_active = 0 ORDER BY id DESC`
  ).all();
}



module.exports = {
  getLastActiveCost,
  getTicketCost,
  getTotalSuperCost,
  getBaseForMode,
  insertCost,
  insertReopen,
  cancelLastActiveCost,
  getCostReportByItemtype,
  getAllReopens,
  updateReopen,
  getAllCloseCosts,
  updateCloseCost,
  getCancelledCosts,
  restoreCost,
  getPlafondPct,
  setPlafondPct,
};
