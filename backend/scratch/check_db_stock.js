const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function main() {
  const count = await db("stock").count("id as count").first();
  console.log("TOTAL STOCK ROWS:", count);
  const sample = await db("stock").select("id", "name", "item_code", "category", "qty", "remaining", "price", "unit").limit(10);
  console.log("SAMPLE STOCK ROWS:", JSON.stringify(sample, null, 2));

  // Check unique items vs batches
  const uniqueItems = await db("stock").distinct("name").select();
  console.log("UNIQUE ITEM NAMES IN DB:", uniqueItems.length);

  // Sum of remaining
  const totals = await db("stock").sum("remaining as totalRemaining").sum(db.raw("remaining * price as totalValuation")).first();
  console.log("DB TOTALS:", totals);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
