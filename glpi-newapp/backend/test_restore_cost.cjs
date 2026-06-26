const { init, wrapper: db } = require('./db.cjs');
const { restoreCost } = require('./services/ticketSuperCost.cjs');

async function test() {
  await init();
  try {
    console.log("Setting up mock data...");
    
    // Clear old test data if any
    db.prepare("DELETE FROM ticket_super_cost WHERE ticket_id = 9999").run();
    
    // 1. Insert a close cost with amount = 100, is_active = 0
    const insertCloseResult = db.prepare(
      `INSERT INTO ticket_super_cost (ticket_id, amount, type, is_active, created_at)
       VALUES (9999, 100.0, 'close', 0, datetime('now'))`
    ).run();
    const closeId = insertCloseResult.lastInsertRowid;
    console.log("Inserted cancelled close cost ID:", closeId);
    
    // 2. Insert a reopen cost for the same ticket
    const insertReopenResult = db.prepare(
      `INSERT INTO ticket_super_cost (ticket_id, amount, type, reopening_pct, reopen_mode, is_active, created_at)
       VALUES (9999, 0.0, 'reopen', 20.0, 4, 1, datetime('now'))`
    ).run();
    const reopenId = insertReopenResult.lastInsertRowid;
    console.log("Inserted reopen cost ID:", reopenId);
    
    // 3. Run restoreCost on the close cost
    console.log(`Running restoreCost(${closeId})...`);
    restoreCost(closeId);
    console.log("restoreCost finished!");
    
    // 4. Query the DB to check the results
    const closeRow = db.prepare("SELECT * FROM ticket_super_cost WHERE id = ?").get(closeId);
    const reopenRow = db.prepare("SELECT * FROM ticket_super_cost WHERE id = ?").get(reopenId);
    
    console.log("Resulting Close Row:", closeRow);
    console.log("Resulting Reopen Row (should have amount = 20.0):", reopenRow);
    
    // Clean up
    db.prepare("DELETE FROM ticket_super_cost WHERE ticket_id = 9999").run();
  } catch (err) {
    console.error("Test failed with error:", err);
  }
}

test();
