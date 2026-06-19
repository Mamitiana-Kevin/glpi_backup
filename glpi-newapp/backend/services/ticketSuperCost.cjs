
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
 * Mode 3 : total des closes actifs
 * Mode 4 : moyenne des closes actifs
 */
function getBaseForMode(ticketId, mode) {
  const modeInt = parseInt(mode, 10);
  let row;
  switch (modeInt) {
    case 1:
      row = db.prepare(
        `SELECT amount FROM ticket_super_cost WHERE ticket_id = ? AND type = 'close' AND is_active = 1 ORDER BY id DESC LIMIT 1`
      ).get(ticketId);
      return row?.amount ?? 0;
    case 2:
      row = db.prepare(
        `SELECT amount FROM ticket_super_cost WHERE ticket_id = ? AND type = 'close' AND is_active = 1 ORDER BY id ASC LIMIT 1`
      ).get(ticketId);
      return row?.amount ?? 0;
    case 3:
      row = db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS base FROM ticket_super_cost WHERE ticket_id = ? AND type = 'close' AND is_active = 1`
      ).get(ticketId);
      return row?.base ?? 0;
    case 4:
      row = db.prepare(
        `SELECT COALESCE(AVG(amount), 0) AS base FROM ticket_super_cost WHERE ticket_id = ? AND type = 'close' AND is_active = 1`
      ).get(ticketId);
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

/**
 * Insère un coût de réouverture (type='reopen').
 * amount est déjà calculé côté React (pct/100 * base).
 */
function insertReopen(ticketId, amount, reopeningPct, reopenMode) {
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO ticket_super_cost (ticket_id, amount, type, reopening_pct, reopen_mode, is_active, created_at)
     VALUES (?, ?, 'reopen', ?, ?, 1, ?)`
  ).run(ticketId, amount, reopeningPct, reopenMode, createdAt);
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

module.exports = {
  getLastActiveCost,
  getTicketCost,
  getTotalSuperCost,
  getBaseForMode,
  insertCost,
  insertReopen,
  cancelLastActiveCost,
  getCostReportByItemtype,
};
