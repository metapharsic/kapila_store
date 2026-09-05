const db = require("../db");

async function analyzeDbStockStructure() {
  const distinctNames = await db("stock").countDistinct("name as count").first();
  console.log("Distinct item names in stock table:", distinctNames.count);

  const aggregated = await db("stock")
    .select("name")
    .sum("remaining as total_remaining")
    .avg("price as avg_price")
    .count("id as batch_count")
    .groupBy("name")
    .orderBy("batch_count", "desc")
    .limit(10);
  console.log("Top 10 items by batch count in DB:", aggregated);

  process.exit(0);
}

analyzeDbStockStructure();
