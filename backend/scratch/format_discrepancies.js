const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "detailed_discrepancy_report.json"), "utf8"));

console.log("=== TOP 15 VALUATION DISCREPANCIES (EXCEL vs DB) ===");
console.log("-----------------------------------------------------------------------------------------");
console.log("Item Name | Excel Qty | DB Qty | Qty Diff | Excel Price | DB Price | Val Diff (₹)");
console.log("-----------------------------------------------------------------------------------------");
for (const item of data.topValuationDiscrepancies.slice(0, 15)) {
  console.log(
    `${item.name.padEnd(25)} | ` +
    `${item.excelQty.toFixed(1).padStart(9)} | ` +
    `${item.dbRemaining.toFixed(1).padStart(8)} | ` +
    `${item.qtyDiff.toFixed(1).padStart(8)} | ` +
    `₹${item.excelPrice.toFixed(1).padStart(9)} | ` +
    `₹${item.dbAvgPrice.toFixed(1).padStart(7)} | ` +
    `₹${item.valuationDiff.toFixed(2).padStart(12)}`
  );
}

console.log("\n=== TOP 10 ITEMS PRESENT IN EXCEL BUT MISSING IN APP DB ===");
console.log("-----------------------------------------------------------------------------------------");
for (const item of data.topMissingInDb.slice(0, 10)) {
  console.log(`${item.originalName.padEnd(30)} | Qty: ${item.qty.toString().padStart(6)} | Avg Price: ₹${item.price.toFixed(2).padStart(8)} | Total: ₹${item.val.toFixed(2).padStart(10)}`);
}

console.log("\n=== TOP 10 ITEMS PRESENT IN APP DB BUT NOT IN EXCEL ===");
console.log("-----------------------------------------------------------------------------------------");
for (const item of data.topExtraInDb.slice(0, 10)) {
  console.log(`${item.name.padEnd(30)} | Remaining: ${item.remaining.toFixed(1).padStart(7)} | Avg Price: ₹${item.avgPrice.toFixed(2).padStart(8)} | Total: ₹${item.val.toFixed(2).padStart(10)}`);
}
