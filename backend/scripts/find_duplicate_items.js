// AI-standard enhancement #9: fuzzy-match stock item names to surface likely
// duplicates (typos, near-identical names split across item_codes) for a
// manager to review and merge. Read-only — never writes, never merges
// automatically. Uses the existing idx_stock_name_trgm trigram index, no new
// infra needed.
//
// Digit-stripped comparison excludes legit size variants (e.g. "Box
// Container 200ml" vs "300ml" — different SKUs, correctly separate items),
// so only true near-identical spellings surface.
//
// Run: node scripts/find_duplicate_items.js [threshold]  (default 0.75)
const knex = require("knex")(require("../knexfile").development);

async function run() {
  const threshold = parseFloat(process.argv[2]) || 0.75;

  const rows = await knex.raw(
    `
    SELECT a.item_code AS code_a, a.name AS name_a, b.item_code AS code_b, b.name AS name_b,
           similarity(lower(a.name), lower(b.name)) AS sim
    FROM (SELECT DISTINCT item_code, name FROM stock) a
    JOIN (SELECT DISTINCT item_code, name FROM stock) b
      ON a.item_code < b.item_code
    WHERE similarity(lower(a.name), lower(b.name)) > ?
      AND lower(regexp_replace(a.name, '[0-9]+', '', 'g')) = lower(regexp_replace(b.name, '[0-9]+', '', 'g'))
    ORDER BY sim DESC
    `,
    [threshold]
  );

  if (rows.rows.length === 0) {
    console.log(`No likely duplicates found above similarity threshold ${threshold}.`);
  } else {
    console.log(`Found ${rows.rows.length} likely duplicate pair(s) (threshold ${threshold}):\n`);
    rows.rows.forEach((r) => {
      console.log(`  ${r.code_a} "${r.name_a}"  <->  ${r.code_b} "${r.name_b}"  (sim ${r.sim.toFixed(2)})`);
    });
    console.log("\nReview manually — this script never merges automatically.");
  }

  await knex.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
