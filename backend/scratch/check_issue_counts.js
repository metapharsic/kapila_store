const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function checkIssuances() {
  const c = await db("issuance_items").count("id as c").first();
  console.log("Total issuance_items count:", c.c);

  const topIssued = await db("issuance_items")
    .select("name")
    .sum("issued as total_issued")
    .count("id as times_issued")
    .groupBy("name")
    .orderBy("total_issued", "desc")
    .limit(10);
  console.log("Top 10 issued items:\n", topIssued);

  process.exit(0);
}

checkIssuances().catch(console.error);
