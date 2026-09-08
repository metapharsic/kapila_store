#!/usr/bin/env node
/**
 * find_duplicate_stock.js
 * -----------------------
 * READ-ONLY report. Finds stock rows that are almost certainly the SAME
 * item but were entered under different item_code / name spellings
 * (casing, whitespace, trailing punctuation, singular/plural, etc.),
 * which fragments true remaining qty / value across "different" items
 * in reports.
 *
 * This does NOT flag every item with multiple rows -- this system
 * intentionally keeps one row per stock batch/date, so multiple rows
 * sharing the same item_code are normal. It only flags a name-group
 * that spans MORE THAN ONE DISTINCT item_code, which means the same
 * logical item got split into separate "items".
 *
 * USAGE (run on the machine with real DB access, from the backend/ dir):
 *
 *   cd backend
 *   node scripts/find_duplicate_stock.js
 *
 * Requires the normal backend .env / DATABASE_URL used by knexfile.js.
 * Makes no writes of any kind -- SELECT queries only.
 */

const db = require("../db");

// Normalize a name for grouping: lower-case, trim, collapse internal
// whitespace to single spaces.
function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// A looser normalization used for the "near-duplicate" pass: also strips
// common punctuation and a trailing plural 's', so "Onions", "onion,",
// and "Onion" all collapse to the same key.
function looseNormalizeName(name) {
  let n = normalizeName(name);
  n = n.replace(/[.,;:'"()\-_/\\]/g, "");
  n = n.replace(/\s+/g, " ").trim();
  if (n.endsWith("s") && n.length > 3) {
    n = n.slice(0, -1);
  }
  return n;
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

async function main() {
  const rows = await db("stock").select(
    "id",
    "name",
    "qty",
    "remaining",
    "unit",
    "date",
    "price",
    "supplier",
    "expiry_date",
    "item_code",
    "category",
    "batch_no"
  );

  await report("Exact normalized-name duplicates", rows, normalizeName);
  await report("Near-duplicate names (punctuation/plural insensitive)", rows, looseNormalizeName);

  await db.destroy();
}

async function report(title, rows, keyFn) {
  console.log("\n=========================================");
  console.log(title);
  console.log("=========================================\n");

  // key -> Map(item_code -> { rows, name variants, totalRemainingValue, latestDate })
  const groups = new Map();

  for (const row of rows) {
    const key = keyFn(row.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, new Map());
    const byCode = groups.get(key);
    const code = row.item_code == null ? "(none)" : String(row.item_code);
    if (!byCode.has(code)) {
      byCode.set(code, {
        rows: [],
        nameVariants: new Set(),
        totalValue: 0,
        latestDate: null,
      });
    }
    const bucket = byCode.get(code);
    bucket.rows.push(row);
    bucket.nameVariants.add(row.name);
    const value = Number(row.remaining || 0) * Number(row.price || 0);
    bucket.totalValue += value;
    const d = row.date ? new Date(row.date) : null;
    if (d && (!bucket.latestDate || d > bucket.latestDate)) bucket.latestDate = d;
  }

  let flaggedCount = 0;

  for (const [key, byCode] of groups.entries()) {
    if (byCode.size <= 1) continue; // same item_code everywhere -> fine (multi-batch)
    flaggedCount++;

    console.log(`Normalized name: "${key}"`);
    console.log(`  Distinct item_codes involved: ${byCode.size}`);

    let best = null;
    for (const [code, bucket] of byCode.entries()) {
      const nameList = Array.from(bucket.nameVariants).join(" | ");
      console.log(
        `    item_code=${code}  rows=${bucket.rows.length}  total_remaining_value=${money(
          bucket.totalValue
        )}  latest_date=${bucket.latestDate ? bucket.latestDate.toISOString().slice(0, 10) : "n/a"}  names="${nameList}"`
      );
      if (
        !best ||
        bucket.totalValue > best.bucket.totalValue ||
        (bucket.totalValue === best.bucket.totalValue &&
          bucket.latestDate &&
          (!best.bucket.latestDate || bucket.latestDate > best.bucket.latestDate))
      ) {
        best = { code, bucket };
      }
    }

    console.log(`  Suggested canonical item_code: ${best.code}`);
    console.log("");
  }

  if (flaggedCount === 0) {
    console.log("  (none found)\n");
  } else {
    console.log(`Total flagged groups: ${flaggedCount}\n`);
  }
}

main().catch((err) => {
  console.error("find_duplicate_stock.js failed:", err);
  process.exitCode = 1;
});
