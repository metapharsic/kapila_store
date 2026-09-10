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

async function runMultiAgentValidation() {
  console.log("================================================================================");
  console.log("   HOTEL KAPILA MULTI-AGENT INVENTORY STOCK VALIDATION & AUDIT ENGINE           ");
  console.log("================================================================================\n");

  // ==========================================
  // AGENT 1: Ingestion & Normalization Agent
  // ==========================================
  console.log("🤖 [Agent 1: Ingestion & Normalization Agent]");
  console.log("   Reading reference stock reports and database stock records...");

  // Load Aug 24 stock report (latest)
  const file24 = "C:/Kapila_store/Project_requirement/Current stock report as on 24-08-26.xlsx";
  const wb24 = xlsx.readFile(file24);
  const sheet24 = wb24.Sheets["Current Stock Report"] || wb24.Sheets[wb24.SheetNames[0]];
  const rows24 = xlsx.utils.sheet_to_json(sheet24, { defval: "" });

  const ref24Items = new Map();
  let ref24TotalQty = 0;
  let ref24TotalVal = 0;

  for (const r of rows24) {
    const rawName = String(r["Item"] || r["Item Name"] || "").trim();
    if (!rawName || rawName.toLowerCase() === "item") continue;

    const qty = parseFloat(r["Current Stock"] || r["Qty"] || 0) || 0;
    const price = parseFloat(r["Average Purchase Price (₹)"] || r["Price"] || 0) || 0;
    const totalVal = parseFloat(r["Total (₹)"] || 0) || (qty * price);

    ref24TotalQty += qty;
    ref24TotalVal += totalVal;

    const norm = normalize(rawName);
    ref24Items.set(norm, {
      originalName: rawName,
      norm,
      qty,
      price,
      totalVal,
    });
  }
  console.log(`   ✓ Ingested Reference Report (24-Aug-26): ${ref24Items.size} items`);
  console.log(`     Total Quantity: ${ref24TotalQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
  console.log(`     Total Valuation: ₹${ref24TotalVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

  // Load Aug 21 stock report (reference)
  const file21 = "C:/Kapila_store/Project_requirement/Current stock report as on 21-08-26.xlsx";
  const wb21 = xlsx.readFile(file21);
  const sheet21 = wb21.Sheets[wb21.SheetNames[0]];
  const rows21 = xlsx.utils.sheet_to_json(sheet21, { defval: "" });

  const ref21Items = new Map();
  let ref21TotalQty = 0;
  let ref21TotalVal = 0;

  for (const r of rows21) {
    const rawName = String(r["Dare: 21-08-26"] || r["Item"] || "").trim();
    if (!rawName || rawName.toLowerCase() === "item") continue;

    const qty = parseFloat(r["__EMPTY"] || 0) || 0;
    const price = parseFloat(r["__EMPTY_1"] || 0) || 0;
    const totalVal = parseFloat(r["__EMPTY_2"] || 0) || (qty * price);

    ref21TotalQty += qty;
    ref21TotalVal += totalVal;

    const norm = normalize(rawName);
    ref21Items.set(norm, {
      originalName: rawName,
      norm,
      qty,
      price,
      totalVal,
    });
  }
  console.log(`   ✓ Ingested Reference Report (21-Aug-26): ${ref21Items.size} items`);
  console.log(`     Total Quantity: ${ref21TotalQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
  console.log(`     Total Valuation: ₹${ref21TotalVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}\n`);

  // Load active DB stock
  const dbRows = await db("stock")
    .select("name", "item_code", "category", "unit")
    .sum("remaining as remaining")
    .avg("price as avg_price")
    .select(db.raw("SUM(remaining * price) as total_val"))
    .count("id as batch_count")
    .groupBy("name", "item_code", "category", "unit");

  const dbItems = new Map();
  let dbTotalRemaining = 0;
  let dbTotalValuation = 0;

  for (const r of dbRows) {
    const rawName = String(r.name).trim();
    const remaining = parseFloat(r.remaining) || 0;
    const avgPrice = parseFloat(r.avg_price) || 0;
    const totalVal = parseFloat(r.total_val) || 0;
    const batchCount = parseInt(r.batch_count, 10) || 1;

    dbTotalRemaining += remaining;
    dbTotalValuation += totalVal;

    const norm = normalize(rawName);
    if (dbItems.has(norm)) {
      const prev = dbItems.get(norm);
      prev.remaining += remaining;
      prev.totalVal += totalVal;
      prev.batchCount += batchCount;
      prev.avgPrice = prev.remaining > 0 ? prev.totalVal / prev.remaining : prev.avgPrice;
    } else {
      dbItems.set(norm, {
        originalName: rawName,
        norm,
        item_code: r.item_code,
        category: r.category,
        unit: r.unit,
        remaining,
        avgPrice,
        totalVal,
        batchCount,
      });
    }
  }

  console.log(`   ✓ Ingested Active Database Stock: ${dbItems.size} unique items (${dbRows.length} grouped SKUs)`);
  console.log(`     Total Remaining Stock: ${dbTotalRemaining.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
  console.log(`     Total Active Valuation: ₹${dbTotalValuation.toLocaleString("en-IN", { maximumFractionDigits: 2 })}\n`);

  // ==========================================
  // AGENT 2: Physical Inventory & Stock Level Auditor
  // ==========================================
  console.log("🤖 [Agent 2: Physical Inventory & Stock Level Auditor]");
  console.log("   Reconciling DB stock levels against August 24 report...");

  const matched = [];
  const qtyVariances = [];
  const priceVariances = [];
  const missingInDb = [];
  const matchedNorms = new Set();

  for (const [norm, ref] of ref24Items.entries()) {
    let dbItem = dbItems.get(norm);

    // Fuzzy fallback if exact normalized name not found
    if (!dbItem) {
      for (const [dbNorm, candidate] of dbItems.entries()) {
        if ((dbNorm.length > 3 && norm.includes(dbNorm)) || (norm.length > 3 && dbNorm.includes(norm))) {
          dbItem = candidate;
          break;
        }
      }
    }

    if (!dbItem) {
      missingInDb.push(ref);
      continue;
    }

    matchedNorms.add(dbItem.norm);

    const qtyDiff = dbItem.remaining - ref.qty; // Positive = DB has more, Negative = DB has less
    const priceDiff = dbItem.avgPrice - ref.price;
    const valDiff = dbItem.totalVal - ref.totalVal;

    if (Math.abs(qtyDiff) > 0.05) {
      qtyVariances.push({
        name: ref.originalName,
        dbName: dbItem.originalName,
        refQty: ref.qty,
        dbRemaining: dbItem.remaining,
        qtyDiff,
        pctDiff: ref.qty > 0 ? ((qtyDiff / ref.qty) * 100) : null,
        refPrice: ref.price,
        dbPrice: dbItem.avgPrice,
        refVal: ref.totalVal,
        dbVal: dbItem.totalVal,
        valDiff,
        unit: dbItem.unit,
        category: dbItem.category,
      });
    } else {
      matched.push({
        name: ref.originalName,
        qty: ref.qty,
        dbQty: dbItem.remaining,
        price: ref.price,
        dbPrice: dbItem.avgPrice,
        val: ref.totalVal,
        dbVal: dbItem.totalVal,
      });
    }

    if (Math.abs(priceDiff) > 0.5) {
      priceVariances.push({
        name: ref.originalName,
        refPrice: ref.price,
        dbPrice: dbItem.avgPrice,
        priceDiff,
        pctDiff: ref.price > 0 ? ((priceDiff / ref.price) * 100) : null,
      });
    }
  }

  // Surplus items in DB not present in Reference Excel
  const unlistedInExcel = [];
  for (const [norm, dbItem] of dbItems.entries()) {
    if (!matchedNorms.has(norm)) {
      unlistedInExcel.push(dbItem);
    }
  }

  console.log(`   ✓ Exact Quantity Matches   : ${matched.length}`);
  console.log(`   ✓ Quantity Variances       : ${qtyVariances.length}`);
  console.log(`   ✓ Price / Rate Variances   : ${priceVariances.length}`);
  console.log(`   ✓ Missing in App DB        : ${missingInDb.length}`);
  console.log(`   ✓ Unlisted in Ref Excel    : ${unlistedInExcel.length}\n`);

  // ==========================================
  // AGENT 3: Financial & Valuation Auditor
  // ==========================================
  console.log("🤖 [Agent 3: Financial & Valuation Auditor]");
  const valuationDelta = dbTotalValuation - ref24TotalVal;
  const qtyDelta = dbTotalRemaining - ref24TotalQty;

  console.log(`   • Reference Total Valuation (24-Aug) : ₹${ref24TotalVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
  console.log(`   • Active Database Total Valuation   : ₹${dbTotalValuation.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
  console.log(`   • Net Valuation Variance            : ₹${valuationDelta.toLocaleString("en-IN", { maximumFractionDigits: 2 })} (${((valuationDelta / ref24TotalVal) * 100).toFixed(2)}%)`);
  console.log(`   • Net Quantity Variance             : ${qtyDelta.toLocaleString("en-IN", { maximumFractionDigits: 2 })} units\n`);

  // Top 10 High-Impact Valuation Variances
  const topValuationVariances = [...qtyVariances]
    .sort((a, b) => Math.abs(b.valDiff) - Math.abs(a.valDiff))
    .slice(0, 15);

  // Top 10 Stock Surplus (DB > Excel)
  const topSurplus = [...qtyVariances]
    .filter(v => v.qtyDiff > 0)
    .sort((a, b) => b.qtyDiff - a.qtyDiff)
    .slice(0, 10);

  // Top 10 Stock Deficits (DB < Excel)
  const topDeficits = [...qtyVariances]
    .filter(v => v.qtyDiff < 0)
    .sort((a, b) => a.qtyDiff - b.qtyDiff)
    .slice(0, 10);

  // ==========================================
  // AGENT 4: Save Structured Audit Output
  // ==========================================
  const auditReport = {
    timestamp: new Date().toISOString(),
    executiveSummary: {
      referenceReport: "Current stock report as on 24-08-26.xlsx",
      totalRefItems: ref24Items.size,
      totalDbItems: dbItems.size,
      exactMatchCount: matched.length,
      qtyVarianceCount: qtyVariances.length,
      priceVarianceCount: priceVariances.length,
      missingInDbCount: missingInDb.length,
      unlistedInExcelCount: unlistedInExcel.length,
      refTotalQty: ref24TotalQty,
      dbTotalRemaining,
      netQtyDelta: qtyDelta,
      refTotalValuation: ref24TotalVal,
      dbTotalValuation,
      netValuationDelta: valuationDelta,
      pctValuationDelta: (valuationDelta / ref24TotalVal) * 100,
    },
    topValuationVariances,
    topSurplus,
    topDeficits,
    missingInDb: missingInDb.slice(0, 20),
    unlistedInExcel: unlistedInExcel.slice(0, 20),
  };

  const outJsonPath = path.join(__dirname, "multi_agent_inventory_audit.json");
  fs.writeFileSync(outJsonPath, JSON.stringify(auditReport, null, 2));
  console.log(`🤖 [Agent 5: Executive Reporting Agent] Written complete audit report to ${outJsonPath}\n`);

  process.exit(0);
}

runMultiAgentValidation().catch(e => {
  console.error("Multi-Agent Validation failed:", e);
  process.exit(1);
});
