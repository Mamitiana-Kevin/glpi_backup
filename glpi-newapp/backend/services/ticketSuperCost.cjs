
const { wrapper: db } = require('../db.cjs');

function getLastActiveCost(ticketId) {
  return db.prepare(`SELECT * FROM ticket_super_cost WHERE ticket_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1`).get(ticketId);
}

function getLastInactiveCost(ticketId) {
  return db.prepare(`SELECT * FROM ticket_super_cost WHERE ticket_id = ? AND is_active = 0 ORDER BY id DESC LIMIT 1`).get(ticketId);
}

function deactivateLastCost(ticketId, reopeningPct) {
  db.prepare(`UPDATE ticket_super_cost SET is_active = 0, reopening_pct = ? WHERE ticket_id = ? AND is_active = 1`).run(reopeningPct, ticketId);
}

function insertCost(ticketId, amount, reopeningPct) {
  const createdAt = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO ticket_super_cost (ticket_id, amount, reopening_pct, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `);
  stmt.run(ticketId, amount, reopeningPct, createdAt);
  return getLastActiveCost(ticketId);
}

function getTotalReopeningCost(ticketId) {
  const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM ticket_super_cost WHERE ticket_id = ? AND is_active = 0`).get(ticketId);
  return row.total ?? 0;
}

function getCostReportByItemtype() {
  try {
    console.log('Starting getCostReportByItemtype...');
    // First, for each ticket, get number of items
    const ticketItemCounts = db.prepare(`
      SELECT ticket_id, COUNT(*) AS item_count
      FROM ticket_item
      GROUP BY ticket_id
    `).all();
    console.log('ticketItemCounts:', ticketItemCounts);
    
    const ticketCountMap = {};
    ticketItemCounts.forEach(row => {
      ticketCountMap[row.ticket_id] = row.item_count;
    });
    
    // Now process to get report by itemtype
    const report = {};
    
    // Process active costs
    const activeCosts = db.prepare(`
      SELECT ticket_id, amount
      FROM ticket_super_cost
      WHERE is_active = 1
    `).all();
    console.log('activeCosts:', activeCosts);
    
    activeCosts.forEach(cost => {
      const ticketId = cost.ticket_id;
      const itemCount = ticketCountMap[ticketId] || 1; // Default to 1 if no items
      const perItemCost = cost.amount / itemCount;
      
      // Get items for this ticket
      const items = db.prepare(`
        SELECT *
        FROM ticket_item
        WHERE ticket_id = ?
      `).all(ticketId);
      console.log(`Items for ticket ${ticketId}:`, items);
      
      items.forEach(item => {
        if (!report[item.itemtype]) {
          report[item.itemtype] = { 
            total_super_cost: 0, 
            total_reopening_cost: 0,
            items: []
          };
        }
        report[item.itemtype].total_super_cost += perItemCost;
        
        // Check if item already exists
        const existingItem = report[item.itemtype].items.find(i => 
          i.item_id === item.item_id && i.itemtype === item.itemtype
        );
        
        if (!existingItem) {
          report[item.itemtype].items.push({ 
            ...item, 
            allocatedCost: perItemCost, 
            allocatedReopeningCost: 0 
          });
        } else {
          existingItem.allocatedCost += perItemCost;
        }
      });
    });
    
    // Process inactive costs (reopening)
    const inactiveCosts = db.prepare(`
      SELECT ticket_id, amount, reopening_pct
      FROM ticket_super_cost
      WHERE is_active = 0
    `).all();
    console.log('inactiveCosts:', inactiveCosts);
    
    inactiveCosts.forEach(cost => {
      const ticketId = cost.ticket_id;
      const itemCount = ticketCountMap[ticketId] || 1; // Default to 1 if no items
      const reopeningAmount = (cost.reopening_pct || 0) / 100 * cost.amount;
      const perItemReopeningCost = reopeningAmount / itemCount;
      
      // Get items for this ticket
      const items = db.prepare(`
        SELECT *
        FROM ticket_item
        WHERE ticket_id = ?
      `).all(ticketId);
      
      items.forEach(item => {
        if (!report[item.itemtype]) {
          report[item.itemtype] = { 
            total_super_cost: 0, 
            total_reopening_cost: 0,
            items: []
          };
        }
        report[item.itemtype].total_reopening_cost += perItemReopeningCost;
        
        const existingItem = report[item.itemtype].items.find(i => 
          i.item_id === item.item_id && i.itemtype === item.itemtype
        );
        
        if (!existingItem) {
          report[item.itemtype].items.push({ 
            ...item, 
            allocatedCost: 0, 
            allocatedReopeningCost: perItemReopeningCost 
          });
        } else {
          existingItem.allocatedReopeningCost += perItemReopeningCost;
        }
      });
    });
    
    // Convert to array
    const result = Object.keys(report).map(itemtype => ({
      itemtype,
      total_super_cost: report[itemtype].total_super_cost,
      total_reopening_cost: report[itemtype].total_reopening_cost,
      items: report[itemtype].items
    }));
    console.log('Final report result:', result);
    return result;
  } catch (error) {
    console.error('Error in getCostReportByItemtype:', error);
    throw error;
  }
}

function cancelLastActiveCost(ticketId) {
  const lastActive = getLastActiveCost(ticketId);
  if (!lastActive) {
    throw new Error('No active cost to cancel');
  }
  db.prepare(`UPDATE ticket_super_cost SET is_active = 0 WHERE id = ?`).run(lastActive.id);
  return lastActive;
}

function getTicketCost(ticketId) {
  const lastActive = getLastActiveCost(ticketId);
  return lastActive ? lastActive.amount : null;
}

function getTotalSuperCost() {
  const result = db.prepare(`
    SELECT SUM(amount) AS total 
    FROM ticket_super_cost 
    WHERE is_active = 1
  `).get();
  
  return result?.total ?? 0;
}

module.exports = {
  getLastActiveCost,
  getLastInactiveCost,
  deactivateLastCost,
  insertCost,
  getTotalReopeningCost,
  getCostReportByItemtype,
  cancelLastActiveCost,
  getTicketCost,
  getTotalSuperCost
};
