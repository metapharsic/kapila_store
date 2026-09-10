const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const fs = require("fs");

const audit = JSON.parse(fs.readFileSync(path.join(__dirname, "multi_agent_inventory_audit.json"), "utf8"));
console.log("Missing item in DB:", audit.missingInDb);

// Let's inspect a few sample items comparing ref24 qty vs db qty
const xlsx = require("xlsx");
const db = require("../db");

async function checkDouble() {
  const file24 = "C:/Kapila_store/Project_requirement/Current stock report as on 24-08-26.xlsx";
  const wb24 = xlsx.readFile(file24);
  const sheet24 = wb24.Sheets["Current Stock Report"];
  const rows24 = xlsx.utils.sheet_to_json(sheet24);

  console.log("\nSample comparisons (Excel 24-Aug vs DB):");
  for (let i = 0; i < 5; i++) {
    const r = rows24[i];
    const name = r["Item"];
    const dbRow = await db("stock").whereRaw("LOWER(TRIM(name)) = LOWER(TRIM(?))", [name]).sum("remaining as rem").first();
    console.log(`- ${name}: Excel = ${r["Current Stock"]}, DB Sum = ${dbRow.rem}, Ratio = ${r["Current Stock"] / dbRow.rem}`);
  }

  // Also check sheet 2: Reconciliation vs Aug 21 Sheet
  const sheetRecon = wb24.Sheets["Reconciliation vs Aug 21 Sheet"];
  const rowsRecon = xlsx.utils.sheet_to_json(sheetRecon);
  console.log("\nSample from 'Reconciliation vs Aug 21 Sheet':", rowsRecon.slice(0, 3));

  process.exit(0);
}

checkDouble();
