const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function checkCols() {
  const issueCols = await db("issuances").columnInfo();
  console.log("issuances cols:", Object.keys(issueCols));

  const itemCols = await db("issuance_items").columnInfo();
  console.log("issuance_items cols:", Object.keys(itemCols));

  const sampleIssueItems = await db("issuance_items").select("*").limit(3);
  console.log("sample issuance_items:", sampleIssueItems);

  process.exit(0);
}

checkCols().catch(err => {
  console.error(err);
  process.exit(1);
});
