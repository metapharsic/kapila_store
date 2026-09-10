const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const xlsx = require("xlsx");
const db = require("../db");
const fs = require("fs");

function normalize(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[_\-\/().,]/g, " ")
    .replace(/\s+/g, " ");
}

async function auditAug21VsCurrent() {
  const file21 = "C:/Kapila_store/Project_requirement/Current stock report as on 21-08-26.xlsx";
  const wb21 = xlsx.readFile(file21);
  const sheet21 = wb21.Sheets[wb21.SheetNames[0]];
  const rows21 = xlsx.utils.sheet_to_json(sheet21, { defval: "" });

  const excel21Map = new Map();
  let total21Qty = 0;
  let total21Val = 0;

  for (const r of rows21) {
    const rawName = String(r["Dare: 21-08-26"] || "").trim();
    if (!rawName || rawName.toLowerCase() === "item") continue;

    const qty = parseFloat(r["__EMPTY"]) || 0;
    const price = parseFloat(r["__EMPTY_1"]) || 0;
    const totalVal = parseFloat(r["__EMPTY_2"]) || (qty * price);

    total21Qty += qty;
    total21Val += totalVal;

    const norm = normalize(rawName);
    excel21Map.set(norm, {
      name: rawName,
      norm,
      qty,
      price,
      totalVal,
    });
  }

  // Get aggregated current DB stock
  const dbRows = await db("stock")
    .select("name", "item_code", "category", "unit")
    .sum("remaining as remaining")
    .avg("price as avg_price")
    .select(db.raw("SUM(remaining * price) as total_val"))
    .groupBy("name", "item_code", "category", "unit");

  const dbMap = new Map();
  let dbTotalRemaining = 0;
  let dbTotalVal = 0;

  for (const r of dbRows) {
    const norm = normalize(r.name);
    const rem = parseFloat(r.remaining) || 0;
    const prc = parseFloat(r.avg_price) || 0;
    const val = parseFloat(r.total_val) || 0;

    dbTotalRemaining += rem;
    dbTotalVal += val;

    if (dbMap.has(norm)) {
      const prev = dbMap.get(norm);
      prev.remaining += rem;
      prev.totalVal += val;
    } else {
      dbMap.set(norm, {
        name: r.name,
        norm,
        item_code: r.item_code,
        category: r.category,
        unit: r.unit,
        remaining: rem,
        avgPrice: prc,
        totalVal: val,
      });
    }
  }

  const matched = [];
  const qtyVariances = [];
  const missingInDb = [];
  const dbOnly = [];
  const matchedDbKeys = new Set();

  for (const [norm, ex] of excel21Map.entries()) {
    let dbItem = dbMap.get(norm);
    if (!dbItem) {
      for (const [dbNorm, cand] of dbMap.entries()) {
        if ((dbNorm.length > 3 && norm.includes(dbNorm)) || (norm.length > 3 && dbNorm.includes(norm))) {
          dbItem = cand;
          break;
        }
      }
    }

    if (!dbItem) {
      missingInDb.push(ex);
      continue;
    }

    matchedDbKeys.add(dbItem.norm);
    const qtyDiff = dbItem.remaining - ex.qty;
    const priceDiff = dbItem.avgPrice - ex.price;
    const valDiff = dbItem.totalVal - ex.totalVal;

    if (Math.abs(qtyDiff) > 0.05) {
      qtyVariances.push({
        name: ex.name,
        dbName: dbItem.name,
        excelQty: ex.qty,
        dbRemaining: dbItem.remaining,
        qtyDiff,
        excelPrice: ex.price,
        dbPrice: dbItem.avgPrice,
        priceDiff,
        excelVal: ex.totalVal,
        dbVal: dbItem.totalVal,
        valDiff,
        unit: dbItem.unit,
        category: dbItem.category,
      });
    } else {
      matched.push({
        name: ex.name,
        qty: ex.qty,
        price: ex.price,
        val: ex.totalVal,
      });
    }
  }

  for (const [norm, dbItem] of dbMap.entries()) {
    if (!matchedDbKeys.has(norm)) {
      dbOnly.push(dbItem);
    }
  }

  const report = {
    summary: {
      aug21ItemCount: excel21Map.size,
      dbItemCount: dbMap.size,
      exactMatchCount: matched.length,
      qtyVarianceCount: qtyVariances.length,
      missingInDbCount: missingInDb.length,
      dbOnlyCount: dbOnly.length,
      aug21TotalQty: total21Qty,
      dbTotalRemaining,
      netQtyGrowth: dbTotalRemaining - total21Qty,
      aug21TotalValuation: total21Val,
      dbTotalValuation: dbTotalVal,
      netValuationGrowth: dbTotalVal - total21Val,
    },
    topQtyIncreases: [...qtyVariances].filter(v => v.qtyDiff > 0).sort((a, b) => b.qtyDiff - a.qtyDiff).slice(0, 15),
    topQtyDecreases: [...qtyVariances].filter(v => v.qtyDiff < 0).sort((a, b) => a.qtyDiff - b.qtyDiff).slice(0, 15),
    topValuationIncreases: [...qtyVariances].sort((a, b) => b.valDiff - a.valDiff).slice(0, 15),
    missingInDb: missingInDb.slice(0, 25),
    dbOnly: dbOnly.slice(0, 25),
  };

  fs.writeFileSync(path.join(__dirname, "aug21_vs_current_audit.json"), JSON.stringify(report, null, 2));
  console.log("Aug 21 vs Current Summary:", report.summary);
  process.exit(0);
}

auditAug21VsCurrent().catch(console.error);
