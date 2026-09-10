const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function main() {
  const tables = await db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  const indentRelated = tables.rows.map(r => r.table_name).filter(t => 
    t.includes("indent") || t.includes("recipe") || t.includes("dish") || t.includes("dept") || t.includes("issuance") || t.includes("production")
  );
  console.log("INDENT RELATED TABLES:", indentRelated);

  const indentCount = await db("indents").count("id as c").first();
  console.log("INDENTS COUNT:", indentCount);

  const indentItemCount = await db("indent_items").count("id as c").first();
  console.log("INDENT_ITEMS COUNT:", indentItemCount);

  // Check columns of indents and indent_items
  const indCols = await db("indents").columnInfo();
  console.log("\nINDENTS COLUMNS:", Object.keys(indCols));

  const itemCols = await db("indent_items").columnInfo();
  console.log("\nINDENT_ITEMS COLUMNS:", Object.keys(itemCols));

  // Check sample indents
  const sampleIndents = await db("indents").select("*").limit(5);
  console.log("\nSAMPLE INDENTS:\n", JSON.stringify(sampleIndents, null, 2));

  // Check sample indent items
  const sampleItems = await db("indent_items").select("*").limit(5);
  console.log("\nSAMPLE INDENT ITEMS:\n", JSON.stringify(sampleItems, null, 2));

  // Check distinct departments in indents
  const depts = await db("indents").distinct("department").select();
  console.log("\nDISTINCT DEPTS IN INDENTS:\n", depts.map(d => d.department));

  // Check date range
  const dateRange = await db("indents").min("date as min_date").max("date as max_date").first();
  console.log("\nDATE RANGE:", dateRange);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
