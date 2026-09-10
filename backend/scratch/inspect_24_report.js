const xlsx = require("xlsx");
const path = require("path");

const f24 = "C:/Kapila_store/Project_requirement/Current stock report as on 24-08-26.xlsx";
const wb = xlsx.readFile(f24);
console.log("SHEET NAMES:", wb.SheetNames);

for (const sName of wb.SheetNames) {
  const sheet = wb.Sheets[sName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n--- SHEET: ${sName} (Rows: ${rows.length}) ---`);
  console.log("Headers:", rows[0]);
  console.log("Row 1-3:", rows.slice(1, 4));
}
