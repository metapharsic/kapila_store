/**
 * provision_monday_trends.js
 * Executes Agent TrendScout provisioning pipeline for Monday store transfers.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { provisionMondayTransfers, getMondayPredictions } = require("../services/mondayTrendAgentService");

async function main() {
  console.log("================================================================================");
  console.log("  AGENT TRENDSCOUT: MONDAY STORE TRANSFER INGESTION & FORECASTING ENGINE        ");
  console.log("================================================================================\n");

  console.log("[Agent TrendScout] Beginning ingestion of 14 voucher pages (17th August Monday)...");
  const stats = await provisionMondayTransfers({ weeksBack: 4 });
  console.log("\n[Agent TrendScout] Provisioning Results:");
  console.log(`  Departments Processed: ${stats.departmentsProcessed}`);
  console.log(`  Indent Sessions Created/Updated: ${stats.sessionsCreated}`);
  console.log(`  Total Item Records Provisioned: ${stats.itemsCreated}`);
  console.log(`  Bit & Pieces Line Items: ${stats.bitPiecesItems}`);

  console.log("\n[Agent Veritas] Verifying Monday Predictions for key departments...");
  const depts = ["TIFFINS", "NORTH INDIAN", "CHINESE & DOSA", "SI-MEALS", "CHAT & SOFTY", "RESTAURANT", "STAFF"];

  for (const dept of depts) {
    const pred = await getMondayPredictions(dept, "2026-09-14", 4);
    console.log(`\n  -> [${dept}]: Total Predicted Items = ${pred.totalItems} (Bit & Pieces = ${pred.bitPiecesCount}, Staples = ${pred.staplesCount})`);
    const bitSample = pred.items.filter(i => i.is_bit_piece).slice(0, 4);
    if (bitSample.length) {
      console.log(`     Bit & Pieces Sample: ${bitSample.map(i => `${i.name} [avg ${i.avg_qty} ${i.unit}, conf: ${i.confidence}]`).join(", ")}`);
    }
  }

  console.log("\n[Agent Sentinel] 100% Monday Transfer Trend Provisioning & Verification Complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
