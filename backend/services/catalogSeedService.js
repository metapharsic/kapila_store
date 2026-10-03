const fs = require("fs");
const path = require("path");
const db = require("../db");

// Static seed data extracted verbatim from the original migrations so a
// truncated "Danger Zone" catalog table can be restored without re-running
// migrations (which only run once, forward, against a fresh DB).
//
//   - indent_subcategories_seed.json  <- migration 065's SUBCATEGORIES_SEED array
//   - indent_templates_seed.json      <- migration 054's `rows` array (872 rows,
//                                        including the intentional trailing-space
//                                        template_name quirks e.g. "TIFFINS ",
//                                        "SI- MEALS ", "STAFF ", which
//                                        CANONICAL_TEMPLATES alias-matching in
//                                        indentController.js depends on)
const SUBCATEGORIES_SEED = require("../db/seeds/indent_subcategories_seed.json");
const INDENT_TEMPLATES_SEED = require("../db/seeds/indent_templates_seed.json");

// Same export dump migration 065 reads to populate indent_subcategory_items.
const ITEMS_EXPORT_PATH = path.join(__dirname, "../scratch/trend_mr_indents_export.json");

/**
 * Idempotently restores the `indent_subcategories` and
 * `indent_subcategory_items` tables to their original migration-065 seed
 * state. Safe to run repeatedly / on a partially-populated table: existing
 * rows (matched by `code` for subcategories, by `subcategory_id` +
 * `item_name` for items) are left untouched and never duplicated.
 *
 * @param {import('knex').Knex.Transaction} trx
 * @returns {Promise<{ subcategoriesInserted: number, itemsInserted: number }>}
 */
async function restoreIndentSubcategories(trx) {
  let subcategoriesInserted = 0;
  let itemsInserted = 0;

  for (const sc of SUBCATEGORIES_SEED) {
    const existing = await trx("indent_subcategories").where("code", sc.code).first();
    if (!existing) {
      await trx("indent_subcategories").insert(sc);
      subcategoriesInserted += 1;
    }
  }

  // Rebuild indent_subcategory_items from the same export dump the original
  // migration used, mirroring its categoryId -> code -> subcategory_id
  // resolution exactly.
  if (fs.existsSync(ITEMS_EXPORT_PATH)) {
    const dump = JSON.parse(fs.readFileSync(ITEMS_EXPORT_PATH, "utf8"));

    const categoryMap = new Map(); // subcategory code -> indent_subcategories.id
    const subcatsInDb = await trx("indent_subcategories").select("id", "code");
    subcatsInDb.forEach((s) => categoryMap.set(s.code, s.id));

    const oldCatIdToCode = new Map(); // dump category id -> code
    if (Array.isArray(dump.categories)) {
      dump.categories.forEach((c) => oldCatIdToCode.set(c.id, c.code));
    }

    if (Array.isArray(dump.items) && dump.items.length > 0) {
      for (let i = 0; i < dump.items.length; i++) {
        const it = dump.items[i];
        const subcatCode = oldCatIdToCode.get(it.categoryId) || it.categoryId;
        const subcatId = categoryMap.get(subcatCode);
        if (!subcatId) continue; // not one of the 16 canonical SUB- categories

        const existingItem = await trx("indent_subcategory_items")
          .where({ subcategory_id: subcatId, item_name: it.name })
          .first();
        if (existingItem) continue;

        await trx("indent_subcategory_items").insert({
          subcategory_id: subcatId,
          item_name: it.name,
          sku: it.sku || `SKU-${i + 1}`,
          unit: (it.unit || "KG").toUpperCase(),
          standard_pack_size: it.standardPackSize || null,
          default_cost: parseFloat(it.defaultCost) || 0,
          default_qty: 1,
          min_order_qty: parseFloat(it.minOrderQty) || 1,
          max_order_qty: parseFloat(it.maxOrderQty) || 500,
          notes: it.notes || null,
          sort_order: i + 1,
        });
        itemsInserted += 1;
      }
    }
  }

  return { subcategoriesInserted, itemsInserted };
}

/**
 * Idempotently restores the `indent_templates` table to its original
 * migration-054 seed state (872 rows across the 9 canonical departments).
 * Relies on the table's existing `unique(["template_name", "row_no"])`
 * constraint via `onConflict().ignore()`, so it can be run any number of
 * times without duplicating or erroring on rows that already exist.
 *
 * @param {import('knex').Knex.Transaction} trx
 * @returns {Promise<{ templatesInserted: number }>}
 */
async function restoreIndentTemplates(trx) {
  const chunkSize = 100;
  let templatesInserted = 0;

  for (let i = 0; i < INDENT_TEMPLATES_SEED.length; i += chunkSize) {
    const chunk = INDENT_TEMPLATES_SEED.slice(i, i + chunkSize);
    const inserted = await trx("indent_templates")
      .insert(chunk)
      .onConflict(["template_name", "row_no"])
      .ignore()
      .returning("id");
    templatesInserted += Array.isArray(inserted) ? inserted.length : 0;
  }

  return { templatesInserted };
}

/**
 * Restores both catalog groups inside one transaction, matching the
 * transaction pattern used by systemResetController.js.
 */
async function restoreFullCatalog() {
  return db.transaction(async (trx) => {
    const subcategoriesResult = await restoreIndentSubcategories(trx);
    const templatesResult = await restoreIndentTemplates(trx);
    return { ...subcategoriesResult, ...templatesResult };
  });
}

module.exports = {
  restoreIndentSubcategories,
  restoreIndentTemplates,
  restoreFullCatalog,
};
