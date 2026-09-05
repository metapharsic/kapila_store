const db = require("../db");

async function check() {
  try {
    const totalItems = await db("stock").count("id as count").first();
    console.log("Total Stock Records in Database:", totalItems.count);

    const sumQty = await db("stock").sum("qty as total_qty").first();
    const sumRemaining = await db("stock").sum("remaining as total_remaining").first();
    console.log("Total Seeded Quantity:", sumQty.total_qty);
    console.log("Total Remaining Quantity:", sumRemaining.total_remaining);

    // Let's sample a few items to check their values
    const sample = await db("stock").select("name", "qty", "remaining", "unit").limit(10);
    console.log("\nSample 10 Stock Items:");
    console.table(sample);

  } catch (err) {
    console.error("Error checking stock data:", err);
  } finally {
    db.destroy();
  }
}

check();
