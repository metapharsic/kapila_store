const xlsx = require("xlsx");
const db = require("../db");
const fs = require("fs");
const path = require("path");

function normalizeName(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[_\-\/()]/g, " ")
    .replace(/\s+/g, " ");
}

async function runMultiAgentAudit() {
  console.log("=================================================================");
  console.log("🤖 Multi-Agent Stock Discrepancy Audit: Excel vs. App Database");
  console.log("=================================================================\n");

  // --- AGENT 1: ExcelParser Agent ---
  const excelPath = "C:\\Kapila_store\\Project_requirement\\Current stock report as on 21-08-26.xlsx";
  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  const excelItems = [];
  let excelTotalValuation = 0;
  let excelTotalQty = 0;

  // Skip header row if present
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const itemName = String(r["Dare: 21-08-26"] || "").trim();
    if (!itemName || itemName.toLowerCase() === "item") continue;

    const currentStock = parseFloat(r["__EMPTY"]) || 0;
    const avgPrice = parseFloat(r["__EMPTY_1"]) || 0;
    const totalVal = parseFloat(r["__EMPTY_2"]) || (currentStock * avgPrice);

    excelTotalValuation += totalVal;
    excelTotalQty += currentStock;

    excelItems.push({
      originalName: itemName,
      cleanName: normalizeName(itemName),
      currentStock,
      avgPrice,
      totalVal,
    });
  }

  console.log(`[Agent 1: ExcelParser] Parsed ${excelItems.length} valid stock items from Excel.`);
  console.log(`  - Excel Total Quantity: ${excelTotalQty.toFixed(2)}`);
  console.log(`  - Excel Total Valuation: ₹${excelTotalValuation.toLocaleString("en-IN", { maximumFractionDigits: 2 })}\n`);

  // --- AGENT 2: AppInventory Agent ---
  const dbItems = await db("stock").select(
    "id",
    "name",
    "item_code",
    "category",
    "unit",
    "qty",
    "remaining",
    "price",
    "supplier",
    "date"
  );

  let dbTotalRemaining = 0;
  let dbTotalValuation = 0;
  const dbItemMap = new Map();

  for (const item of dbItems) {
    const rem = parseFloat(item.remaining) || 0;
    const prc = parseFloat(item.price) || 0;
    dbTotalRemaining += rem;
    dbTotalValuation += (rem * prc);

    const key = normalizeName(item.name);
    if (!dbItemMap.has(key)) {
      dbItemMap.set(key, []);
    }
    dbItemMap.get(key).push({
      ...item,
      remaining: rem,
      price: prc,
      cleanName: key,
    });
  }

  console.log(`[Agent 2: AppInventory] Extracted ${dbItems.length} stock records from App Database.`);
  console.log(`  - App Total Remaining Stock: ${dbTotalRemaining.toFixed(2)}`);
  console.log(`  - App Total Valuation: ₹${dbTotalValuation.toLocaleString("en-IN", { maximumFractionDigits: 2 })}\n`);

  // --- AGENT 3: Reconciliation Agent ---
  const matched = [];
  const qtyDiscrepancies = [];
  const priceDiscrepancies = [];
  const missingInApp = [];
  const matchedDbIds = new Set();

  for (const ex of excelItems) {
    const dbCandidates = dbItemMap.get(ex.cleanName);

    if (!dbCandidates || dbCandidates.length === 0) {
      // Try partial / fuzzy lookup
      let fuzzyMatch = null;
      for (const [dbKey, items] of dbItemMap.entries()) {
        if (dbKey.includes(ex.cleanName) || ex.cleanName.includes(dbKey)) {
          fuzzyMatch = items[0];
          break;
        }
      }

      if (fuzzyMatch) {
        matchedDbIds.add(fuzzyMatch.id);
        const qtyDiff = ex.currentStock - fuzzyMatch.remaining;
        const priceDiff = ex.avgPrice - fuzzyMatch.price;

        if (Math.abs(qtyDiff) > 0.01) {
          qtyDiscrepancies.push({
            name: ex.originalName,
            appMatchName: fuzzyMatch.name,
            excelQty: ex.currentStock,
            appRemaining: fuzzyMatch.remaining,
            difference: qtyDiff,
            excelPrice: ex.avgPrice,
            appPrice: fuzzyMatch.price,
            unit: fuzzyMatch.unit,
            isFuzzy: true,
          });
        }
        if (Math.abs(priceDiff) > 0.01) {
          priceDiscrepancies.push({
            name: ex.originalName,
            appMatchName: fuzzyMatch.name,
            excelPrice: ex.avgPrice,
            appPrice: fuzzyMatch.price,
            priceDiff,
          });
        }
      } else {
        missingInApp.push(ex);
      }
    } else {
      const dbItem = dbCandidates[0];
      matchedDbIds.add(dbItem.id);

      const qtyDiff = ex.currentStock - dbItem.remaining;
      const priceDiff = ex.avgPrice - dbItem.price;

      if (Math.abs(qtyDiff) > 0.01) {
        qtyDiscrepancies.push({
          name: ex.originalName,
          appMatchName: dbItem.name,
          excelQty: ex.currentStock,
          appRemaining: dbItem.remaining,
          difference: qtyDiff,
          excelPrice: ex.avgPrice,
          appPrice: dbItem.price,
          unit: dbItem.unit,
          isFuzzy: false,
        });
      } else {
        matched.push({
          name: ex.originalName,
          qty: ex.currentStock,
          price: ex.avgPrice,
        });
      }

      if (Math.abs(priceDiff) > 0.01) {
        priceDiscrepancies.push({
          name: ex.originalName,
          appMatchName: dbItem.name,
          excelPrice: ex.avgPrice,
          appPrice: dbItem.price,
          priceDiff,
        });
      }
    }
  }

  // Find extra items in App not in Excel
  const extraInApp = dbItems.filter(item => !matchedDbIds.has(item.id));

  // --- AGENT 4: DataQuality & Valuation Analysis ---
  const valuationDelta = excelTotalValuation - dbTotalValuation;
  const qtyDelta = excelTotalQty - dbTotalRemaining;

  const result = {
    timestamp: new Date().toISOString(),
    summary: {
      excelItemCount: excelItems.length,
      appItemCount: dbItems.length,
      exactMatchCount: matched.length,
      qtyDiscrepancyCount: qtyDiscrepancies.length,
      priceDiscrepancyCount: priceDiscrepancies.length,
      missingInAppCount: missingInApp.length,
      extraInAppCount: extraInApp.length,
      excelTotalQty,
      appTotalRemaining: dbTotalRemaining,
      qtyDelta,
      excelTotalValuation,
      appTotalValuation: dbTotalValuation,
      valuationDelta,
    },
    topQtyDiscrepancies: qtyDiscrepancies.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)).slice(0, 30),
    topMissingInApp: missingInApp.sort((a, b) => b.totalVal - a.totalVal).slice(0, 30),
    topExtraInApp: extraInApp.sort((a, b) => b.remaining - a.remaining).slice(0, 30),
    allQtyDiscrepancies: qtyDiscrepancies,
    allMissingInApp: missingInApp,
    allExtraInApp: extraInApp,
  };

  fs.writeFileSync(path.join(__dirname, "discrepancy_report.json"), JSON.stringify(result, null, 2));

  console.log("=================================================================");
  console.log("📊 RECONCILIATION SUMMARY");
  console.log("=================================================================");
  console.log(`• Total Items in Excel:            ${excelItems.length}`);
  console.log(`• Total Items in App DB:           ${dbItems.length}`);
  console.log(`• Items Missing in App:            ${missingInApp.length}`);
  console.log(`• Items Extra in App:              ${extraInApp.length}`);
  console.log(`• Quantity Discrepancies:          ${qtyDiscrepancies.length}`);
  console.log(`• Price/Rate Discrepancies:        ${priceDiscrepancies.length}`);
  console.log(`• Total Valuation Difference:      ₹${valuationDelta.toLocaleString("en-IN", { maximumFractionDigits: 2 })} (Excel vs App)`);
  console.log(`• Total Quantity Difference:       ${qtyDelta.toFixed(2)} units`);
  console.log("=================================================================\n");

  process.exit(0);
}

runMultiAgentAudit().catch(e => {
  console.error("Audit failure:", e);
  process.exit(1);
});
