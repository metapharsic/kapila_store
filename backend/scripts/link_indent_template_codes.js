/**
 * Links indent_templates.item_code to real stock item_codes via fuzzy match.
 * Run after migration 052 (or after adding a new template) whenever `stock`
 * has been (re)seeded — migration alone can't do this since it needs live
 * stock data that may not exist yet at migration time.
 * Usage: node scripts/link_indent_template_codes.js
 */
const db = require("../db");
const { fuzzyMatchBatch } = require("../services/fuzzyMatch");

(async () => {
  const rows = await db("indent_templates").select("id", "item_name");
  const names = rows.map((r) => r.item_name);
  const matches = await fuzzyMatchBatch(names);

  let matched = 0;
  const unmatched = [];
  for (const r of rows) {
    const m = matches[r.item_name];
    if (m) {
      await db("indent_templates").where("id", r.id).update({ item_code: m.item_code });
      matched++;
    } else {
      unmatched.push(r.item_name);
    }
  }

  console.log(`Linked ${matched} of ${rows.length} template rows to stock item_codes.`);
  if (unmatched.length) console.log("Unmatched (needs manual stock entry or alias):", unmatched);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
