const { init, wrapper: db } = require('./db.cjs');

async function runTest() {
  await init();
  try {
    console.log("Starting transaction test...");
    const testTx = db.transaction(() => {
      console.log("Inside transaction...");
      // Let's run a query
      const row = db.prepare("SELECT 1 + 1 AS result").get();
      console.log("Query result:", row);
    });
    
    testTx();
    console.log("Transaction test successful!");
  } catch (error) {
    console.error("Transaction test failed with error:", error);
  }
}

runTest();
