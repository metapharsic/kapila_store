#!/usr/bin/env node
/**
 * merge_duplicate_stock.js
 * -------------------------
 * Fixes fragmented duplicate items identified by find_duplicate_stock.js.
 *
 * IMPORTANT: this does NOT delete or merge stock rows (each row is a
 * legitimate batch/lot and other tables -- stock_adjustments, audit_items --
 * reference stock.id by FK and must keep their history intact). Instead it
 * re-labels the duplicate rows' item_code/name to the canonical
 * item_code/name so that future reports (which aggregate by item_code)
 * treat them as one logical item again.
 *
 * DRY RUN BY DEFAULT. Nothing is written unless you pass --confirm.
 *
 * USAGE (run on the machine with real DB access, from the backend/ dir):
 *
 *   # 1) Dry run using a JSON config you fill in after reviewing the
 *   #    find_duplicate_stock.js report:
 *   cd backend
 *   node scripts/merge_duplicate_stock.js --config scripts/duplicate_merge_map.json
 *
 *   # 2) Once the printed plan looks correct, actually apply it:
 *   node scripts/merge_duplicate_stock.js --config scripts/duplicate_merge_map.json --confirm
 *
 *   # Or, for a single one-off merge without a config file:
 *   node scripts/merge_duplicate_stock.js --canonical ONI-001 --duplicates ONI-01,ONI_1 [--confirm]
 *
 * duplicate_merge_map.json format (array so multiple merges can run at once):
 *   [
 *     {
 *       "canonical_item_code": "ONI-001",
 *       "canonical_name": "Onion",
 *       "duplicate_item_codes": ["ONI-01", "ONI_1", "onion "]
 *     }
 *   ]
 *
 * "canonical_name" is optional -- if omitted, the script only fixes
 * item_code and leaves each row's existing name untouched.
 */

const fs = require("fs");
const path = require("path");
const db = require("../db");

function parseArgs(argv) {
  const args = { confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--confirm") args.confirm = true;
    else if (a === "--config") args.config = argv[++i];
    else if (a === "--canonical") args.canonical = argv[++i];
    else if (a === "--duplicates") args.duplicates = argv[++i];
    else if (a === "--canonical-name") args.canonicalName = argv[++i];
  }
  return args;
}

function loadMergePlans(args) {
  if (args.config) {
    const configPath = path.resolve(process.cwd(), args.config);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!Array.isArray(raw)) {
      throw new Error("Config file must be a JSON array of merge plans.");
    }
    return raw.map((entry) => ({
      canonicalCode: entry.canonical_item_code,
      canonicalName: entry.canonical_name || null,
      duplicateCodes: entry.duplicate_item_codes || [],
    }));
  }

  if (args.canonical && args.duplicates) {
    return [
      {
        canonicalCode: args.canonical,
        canonicalName: args.canonicalName || null,
        duplicateCodes: args.duplicates.split(",").map((s) => s.trim()).filter(Boolean),
      },
    ];
  }

  throw new Error(
    "Provide either --config <path-to-duplicate_merge_map.json>, or --canonical <code> --duplicates <code1,code2,...>"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plans = loadMergePlans(args);

  if (!args.confirm) {
    console.log("*** DRY RUN (no --confirm passed) -- no data will be modified ***\n");
  }

  for (const plan of plans) {
    if (!plan.canonicalCode) {
      console.log("Skipping plan with no canonical_item_code:", plan);
      continue;
    }
    if (!plan.duplicateCodes || plan.duplicateCodes.length === 0) {
      console.log(`Skipping ${plan.canonicalCode}: no duplicate_item_codes given`);
      continue;
    }

    console.log(`\nPlan: merge into canonical item_code="${plan.canonicalCode}"` +
      (plan.canonicalName ? ` (name="${plan.canonicalName}")` : ""));

    for (const dupCode of plan.duplicateCodes) {
      if (dupCode === plan.canonicalCode) {
        console.log(`  - skipping duplicate code equal to canonical: "${dupCode}"`);
        continue;
      }

      const rows = await db("stock").where({ item_code: dupCode }).select(
        "id",
        "name",
        "item_code",
        "remaining",
        "price",
        "date",
        "batch_no"
      );

      if (rows.length === 0) {
        console.log(`  - item_code="${dupCode}": no matching stock rows found, skipping`);
        continue;
      }

      console.log(`  - item_code="${dupCode}": ${rows.length} row(s) would be updated:`);
      for (const r of rows) {
        console.log(
          `      stock.id=${r.id}  name="${r.name}" -> "${plan.canonicalName || r.name}"  item_code="${r.item_code}" -> "${plan.canonicalCode}"  (batch_no=${r.batch_no || "n/a"}, remaining=${r.remaining})`
        );
      }

      if (args.confirm) {
        const update = { item_code: plan.canonicalCode };
        if (plan.canonicalName) update.name = plan.canonicalName;

        const updated = await db("stock").where({ item_code: dupCode }).update(update);
        console.log(`      -> applied: ${updated} row(s) updated.`);
      }
    }
  }

  if (!args.confirm) {
    console.log("\nNo changes were made (dry run). Re-run with --confirm to apply.");
  } else {
    console.log("\nDone. Changes applied. No rows were deleted; batch/audit history is intact.");
  }

  await db.destroy();
}

main().catch((err) => {
  console.error("merge_duplicate_stock.js failed:", err);
  process.exitCode = 1;
});
