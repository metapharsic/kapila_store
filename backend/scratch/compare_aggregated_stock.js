const xlsx = require("xlsx");
const db = require("../db");
const fs = require("fs");
const path = require("path");

function normalize(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[_\-\/().,]/g, " ")
    .replace(/\s+/g, " ");
}

async function runAggregatedComparison() {
  const excelPath = "C:\\Kapila_store\\Project_requirement\\Current stock report as on 21-08-26.xlsx";
  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  const excelMap = new Map();
  let excelTotalVal = 0;
  let excelTotalQty = 0;

  for (const r of rawRows) {
    const name = String(r["Dare: 21-08-26"] || "").trim();
    if (!name || name.toLowerCase() === "item") continue;

    const qty = parseFloat(r["__EMPTY"]) || 0;
    const price = parseFloat(r["__EMPTY_1"]) || 0;
    const val = parseFloat(r["__EMPTY_2"]) || (qty * price);

    excelTotalVal += val;
    excelTotalQty += qty;

    const norm = normalize(name);
    excelMap.set(norm, {
      originalName: name,
      norm,
      qty,
      price,
      val,
    });
  }

  // Aggregate DB stock by item name
  const dbAgg = await db("stock")
    .select("name")
    .sum("remaining as remaining")
    .avg("price as avg_price")
    .select(db.raw("SUM(remaining * price) as total_val"))
    .count("id as batch_count")
    .groupBy("name");

  const dbMap = new Map();
  let dbTotalVal = 0;
  let dbTotalQty = 0;

  for (const row of dbAgg) {
    const rem = parseFloat(row.remaining) || 0;
    const avgPrc = parseFloat(row.avg_price) || 0;
    const val = parseFloat(row.total_val) || 0;

    dbTotalQty += rem;
    dbTotalVal += val;

    const norm = normalize(row.name);
    dbMap.set(norm, {
      name: row.name,
      norm,
      remaining: rem,
      avgPrice: avgPrc,
      val,
      batches: parseInt(row.batch_count),
    });
  }

  const matched = [];
  const qtyMismatch = [];
  const priceMismatch = [];
  const missingInDb = [];
  const matchedDbKeys = new Set();

  for (const [norm, ex] of excelMap.entries()) {
    let dbItem = dbMap.get(norm);

    if (!dbItem) {
      // Fuzzy check
      for (const [dKey, dVal] of dbMap.entries()) {
        if (dKey.includes(norm) || norm.includes(dKey)) {
          dbItem = dVal;
          break;
        }
      }
    }

    if (!dbItem) {
      missingInDb.push(ex);
    } else {
      matchedDbKeys.add(dbItem.norm);
      const qtyDiff = ex.qty - dbItem.remaining;
      const priceDiff = ex.price - dbItem.avgPrice;
      const valDiff = ex.val - dbItem.val;

      const itemComparison = {
        name: ex.originalName,
        dbName: dbItem.name,
        excelQty: ex.qty,
        dbRemaining: dbItem.remaining,
        qtyDiff,
        excelPrice: ex.price,
        dbAvgPrice: dbItem.avgPrice,
        priceDiff,
        excelValuation: ex.val,
        dbValuation: dbItem.val,
        valuationDiff: valDiff,
      };

      if (Math.abs(qtyDiff) > 0.01) {
        qtyMismatch.push(itemComparison);
      } else {
        matched.push(itemComparison);
      }

      if (Math.abs(priceDiff) > 0.5) {
        priceMismatch.push(itemComparison);
      }
    }
  }

  const extraInDb = [];
  for (const [dKey, dVal] of dbMap.entries()) {
    if (!matchedDbKeys.has(dKey)) {
      extraInDb.push(dVal);
    }
  }

  const output = {
    excelTotalCount: excelMap.size,
    dbTotalCount: dbMap.size,
    excelTotalVal,
    dbTotalVal,
    valuationDifference: excelTotalVal - dbTotalVal,
    excelTotalQty,
    dbTotalQty,
    qtyDifference: excelTotalQty - dbTotalQty,
    missingInDbCount: missingInDb.length,
    extraInDbCount: extraInDb.length,
    qtyMismatchCount: qtyMismatch.length,
    priceMismatchCount: priceMismatch.length,
    topValuationDiscrepancies: qtyMismatch.sort((a, b) => Math.abs(b.valuationDiff) - Math.abs(a.valuationDiff)).slice(0, 25),
    topMissingInDb: missingInDb.sort((a, b) => b.val - a.val).slice(0, 25),
    topExtraInDb: extraInDb.sort((a, b) => b.val - a.val).slice(0, 25),
    allQtyMismatches: qtyMismatch,
    allMissingInDb: missingInDb,
    allExtraInDb: extraInDb,
  };

  fs.writeFileSync(path.join(__dirname, "detailed_discrepancy_report.json"), JSON.stringify(output, null, 2));

  console.log("=== COMPLETED AGGREGATED DISCREPANCY AUDIT ===");
  console.log(`Excel Unique Items:          ${excelMap.size}`);
  console.log(`DB Unique Items:             ${dbMap.size}`);
  console.log(`Missing in DB (in Excel):    ${missingInDb.length}`);
  console.log(`Extra in DB (not in Excel):  ${extraInDb.length}`);
  console.log(`Quantity Mismatches:         ${qtyMismatch.length}`);
  console.log(`Price/Rate Mismatches:       ${priceMismatch.length}`);
  console.log(`Excel Total Valuation:       ₹${excelTotalVal.toFixed(2)}`);
  console.log(`DB Total Valuation:          ₹${dbTotalVal.toFixed(2)}`);
  console.log(`Valuation Delta:             ₹${(excelTotalVal - dbTotalVal).toFixed(2)}`);
  console.log(`Excel Total Quantity:        ${excelTotalQty.toFixed(2)}`);
  console.log(`DB Total Quantity:           ${dbTotalQty.toFixed(2)}`);
  console.log(`Quantity Delta:              ${(excelTotalQty - dbTotalQty).toFixed(2)}`);

  process.exit(0);
}

runAggregatedComparison().catch(e => {
  console.error(e);
  process.exit(1);
});
