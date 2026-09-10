const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function checkRealConsumption() {
  console.log("--- HISTORICAL ISSUANCE ITEM STATS ---");
  const issuanceStats = await db("issuance_items")
    .select("name")
    .sum("issued_qty as total_issued")
    .count("id as issue_events")
    .groupBy("name")
    .orderBy("total_issued", "desc")
    .limit(10);
  console.log("Top 10 issued items in issuance_items:\n", issuanceStats);

  console.log("\n--- HISTORICAL INDENT ITEM STATS ---");
  const indentStats = await db("indent_items")
    .select("name")
    .sum("qty as total_requested")
    .count("id as indent_events")
    .groupBy("name")
    .orderBy("total_requested", "desc")
    .limit(10);
  console.log("Top 10 requested items in indent_items:\n", indentStats);

  console.log("\n--- DAY OF WEEK CONSUMPTION FROM INDENTS ---");
  const dowStats = await db("indents")
    .select(db.raw("EXTRACT(DOW FROM date) as dow"))
    .count("id as indent_count")
    .groupByRaw("EXTRACT(DOW FROM date)")
    .orderBy("dow");
  console.log("Indents by Day of Week (0=Sun, 1=Mon...):\n", dowStats);

  console.log("\n--- DEPARTMENTS IN DB ---");
  const depts = await db("departments").select("id", "name", "code").orderBy("name");
  console.log("Departments in DB:\n", depts);

  process.exit(0);
}

checkRealConsumption().catch(err => {
  console.error(err);
  process.exit(1);
});
