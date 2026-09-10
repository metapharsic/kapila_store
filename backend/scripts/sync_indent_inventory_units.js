/**
 * sync_indent_inventory_units.js
 * Synchronizes indent_templates, historical indent_items, and stock_aliases
 * with active inventory (stock) to eliminate mismatches during indents and issuances.
 *
 * Actions:
 * 1. Removes OCR noise rows (Time:, STALL, DISPOSABLES, VADA, TATTE IDLY).
 * 2. Unlinks false grocery/disposable item codes from fresh produce and dish items.
 * 3. Synchronizes default_unit in indent_templates to match stock.unit exactly.
 * 4. Harmonizes historical indent_items with stock units and item_codes.
 * 5. Seeds stock_aliases for seamless multi-lingual and alias resolution.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");
const { normalizeUnit, getConversionMultiplier } = require("../utils/units");

function normalize(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[_\-\/().,]/g, " ")
    .replace(/\s+/g, " ");
}

async function runSync() {
  console.log("================================================================================");
  console.log("  MULTI-AGENT DATA SYNCHRONIZATION: INDENT & INVENTORY HARMONIZATION ENGINE     ");
  console.log("================================================================================\n");

  // Step 1: Load active stock catalog
  const stockRows = await db("stock")
    .select("item_code", "name", "unit", "category", "price")
    .groupBy("item_code", "name", "unit", "category", "price");

  const stockByCode = new Map();
  const stockByName = new Map();
  const stockByNorm = new Map();

  stockRows.forEach((s) => {
    if (s.item_code) stockByCode.set(s.item_code.trim().toUpperCase(), s);
    stockByName.set(s.name.trim().toLowerCase(), s);
    stockByNorm.set(normalize(s.name), s);
  });

  console.log(`[Agent 1: Inventory Catalog]: Loaded ${stockByCode.size} unique SKUs from stock.\n`);

  // Step 2: Delete OCR noise / section header rows from indent_templates
  console.log("[Agent 2: Template Cleansing]: Purging OCR noise & non-item headers...");
  const noiseDeleted = await db("indent_templates")
    .whereILike("item_name", "%Time:%")
    .orWhereIn("item_name", ["STALL", "DISPOSABLES", "VADA", "TATTE  IDLY", "TATTE IDLY"])
    .del();
  console.log(`  -> Deleted ${noiseDeleted} noise/header rows from indent_templates.\n`);

  // Step 3: Unlink false grocery item codes from fresh produce and kitchen preparations
  console.log("[Agent 2: Unlinking False Mappings]: Severing incorrect non-food / sauce linkages...");
  const falseMappings = [
    { namePattern: "%capsicum%", falseCode: "KPL-153", unit: "kg" },
    { namePattern: "%green chilli%", falseCode: "KPL-231", unit: "kg" },
    { namePattern: "%green chili%", falseCode: "KPL-231", unit: "kg" },
    { namePattern: "%tomato%", falseCode: "KPL-424", unit: "kg" },
    { namePattern: "%टमाटर%", falseCode: "KPL-424", unit: "kg" },
    { namePattern: "%dosa batter%", falseCode: "KPL-200", unit: "kg" },
    { namePattern: "%dosa mix%", falseCode: "KPL-200", unit: "kg" },
    { namePattern: "%rava dosa%", falseCode: "KPL-203", unit: "kg" },
    { namePattern: "%faluda%", falseCode: "KPL-212", unit: "pkt" },
    { namePattern: "%idly%", falseCode: "KPL-245", unit: "kg" },
  ];

  let unlinkedCount = 0;
  for (const fm of falseMappings) {
    const updated = await db("indent_templates")
      .whereILike("item_name", fm.namePattern)
      .andWhere("item_code", fm.falseCode)
      .update({ item_code: null, default_unit: fm.unit });
    unlinkedCount += updated;
  }
  console.log(`  -> Unlinked ${unlinkedCount} template rows falsely mapped to non-food/sauce SKUs.\n`);

  // Step 4: Synchronize default_unit of all matched indent_templates to match stock.unit
  console.log("[Agent 2: Unit Harmonization]: Aligning template default_units with stock.unit...");
  const allTemplates = await db("indent_templates").select("*").orderBy("id", "asc");

  let unitUpdatedCount = 0;
  let codeLinkedCount = 0;

  for (const tmpl of allTemplates) {
    let code = tmpl.item_code ? tmpl.item_code.trim().toUpperCase() : null;
    let stockMatch = code ? stockByCode.get(code) : null;

    // If no match by code, try matching by name or normalized name
    if (!stockMatch && tmpl.item_name) {
      const norm = normalize(tmpl.item_name);
      stockMatch = stockByName.get(tmpl.item_name.trim().toLowerCase()) || stockByNorm.get(norm);
      if (stockMatch) {
        code = stockMatch.item_code;
        await db("indent_templates").where("id", tmpl.id).update({ item_code: code });
        codeLinkedCount++;
      }
    }

    if (stockMatch) {
      const currentUnit = (tmpl.default_unit || "").trim();
      const targetUnit = stockMatch.unit;

      // Check if unit differs
      if (currentUnit !== targetUnit) {
        await db("indent_templates")
          .where("id", tmpl.id)
          .update({ default_unit: targetUnit });
        unitUpdatedCount++;
      }
    }
  }

  // Specific fix for Onion row 130 if not caught
  await db("indent_templates")
    .where("item_code", "KPL-316")
    .andWhere("default_unit", "L")
    .update({ default_unit: "kg" });

  console.log(`  -> Synchronized default_unit for ${unitUpdatedCount} template rows.`);
  console.log(`  -> Linked item_code for ${codeLinkedCount} template rows.\n`);

  // Step 5: Harmonize historical indent_items
  console.log("[Agent 4: Historical Indent Sanitization]: Aligning historical indent_items...");
  const indentItems = await db("indent_items").select("*").orderBy("id", "asc");
  let indUpdatedCount = 0;

  for (const it of indentItems) {
    let code = it.item_code ? it.item_code.trim().toUpperCase() : null;
    let match = code ? stockByCode.get(code) : null;

    if (!match && it.name) {
      const norm = normalize(it.name);
      match = stockByName.get(it.name.trim().toLowerCase()) || stockByNorm.get(norm);
      if (match) {
        code = match.item_code;
        await db("indent_items").where("id", it.id).update({ item_code: code });
        indUpdatedCount++;
      }
    }

    if (match) {
      const curUnit = normalizeUnit(it.unit);
      const stockUnit = normalizeUnit(match.unit);

      // If unit is identical or directly equivalent (like case -> box, bottle -> pcs)
      const mult = getConversionMultiplier(curUnit, stockUnit, it.name);
      if (mult !== null && curUnit !== stockUnit && mult === 1) {
        await db("indent_items").where("id", it.id).update({ unit: match.unit });
        indUpdatedCount++;
      }
    }
  }
  console.log(`  -> Harmonized ${indUpdatedCount} historical indent_items records.\n`);

  // Step 6: Populate stock_aliases
  console.log("[Agent 2: Alias Directory]: Seeding stock_aliases for intelligent resolution...");
  const aliasesToSeed = [
    { alias: "Atta", item_code: "KPL-109", canonical_name: "Atta (Wheat Flour)" },
    { alias: "Wheat Flour", item_code: "KPL-109", canonical_name: "Atta (Wheat Flour)" },
    { alias: "Maida", item_code: "KPL-286", canonical_name: "Maida (All Purpose Flour)" },
    { alias: "All Purpose Flour", item_code: "KPL-286", canonical_name: "Maida (All Purpose Flour)" },
    { alias: "Besan", item_code: "KPL-122", canonical_name: "Besan (Gram Flour)" },
    { alias: "Gram Flour", item_code: "KPL-122", canonical_name: "Besan (Gram Flour)" },
    { alias: "Sooji", item_code: "KPL-393", canonical_name: "Sooji (Semolina)" },
    { alias: "Rava", item_code: "KPL-393", canonical_name: "Sooji (Semolina)" },
    { alias: "Semolina", item_code: "KPL-393", canonical_name: "Sooji (Semolina)" },
    { alias: "Urad Dal", item_code: "KPL-435", canonical_name: "Urad Dal (Black Gram)" },
    { alias: "Toor Dal", item_code: "KPL-428", canonical_name: "Toor Dal (Pigeon Pea)" },
    { alias: "Moong Dal", item_code: "KPL-299", canonical_name: "Moong Dal (Yellow Lentils)" },
    { alias: "Chana Dal", item_code: "KPL-156", canonical_name: "Chana Dal (Bengal Gram)" },
    { alias: "Ghee", item_code: "KPL-223", canonical_name: "Ghee (Clarified Butter)" },
    { alias: "Butter", item_code: "KPL-147", canonical_name: "Butter (Salted)" },
    { alias: "Paneer", item_code: "KPL-323", canonical_name: "Paneer (Cottage Cheese)" },
    { alias: "Jeera", item_code: "KPL-256", canonical_name: "Jeera (Cumin Seeds)" },
    { alias: "Cumin Seeds", item_code: "KPL-256", canonical_name: "Jeera (Cumin Seeds)" },
    { alias: "Mustard", item_code: "KPL-309", canonical_name: "Mustard Seeds" },
    { alias: "Mustard Seeds", item_code: "KPL-309", canonical_name: "Mustard Seeds" },
    { alias: "Cardamom", item_code: "KPL-154", canonical_name: "Cardamom Green" },
    { alias: "Cloves", item_code: "KPL-178", canonical_name: "Cloves" },
    { alias: "Cinnamon", item_code: "KPL-174", canonical_name: "Cinnamon Stick" },
    { alias: "Black Pepper", item_code: "KPL-340", canonical_name: "Pepper Black" },
    { alias: "Pepper Black", item_code: "KPL-340", canonical_name: "Pepper Black" },
    { alias: "Sugar", item_code: "KPL-410", canonical_name: "Sugar (M30)" },
    { alias: "Salt", item_code: "KPL-366", canonical_name: "Salt (Tata Salt)" },
    { alias: "Turmeric", item_code: "KPL-432", canonical_name: "Turmeric Powder" },
    { alias: "Haldi", item_code: "KPL-432", canonical_name: "Turmeric Powder" },
    { alias: "Chilli Powder", item_code: "KPL-358", canonical_name: "Red Chilli Powder" },
    { alias: "Red Chilli Powder", item_code: "KPL-358", canonical_name: "Red Chilli Powder" },
    { alias: "Cashew", item_code: "KPL-158", canonical_name: "Cashew Nut (Kaju)" },
    { alias: "Kaju", item_code: "KPL-158", canonical_name: "Cashew Nut (Kaju)" },
    { alias: "Badam", item_code: "KPL-114", canonical_name: "Badam (Almond)" },
    { alias: "Almond", item_code: "KPL-114", canonical_name: "Badam (Almond)" },
    { alias: "Kismis", item_code: "KPL-268", canonical_name: "Kismis (Raisins)" },
    { alias: "Raisins", item_code: "KPL-268", canonical_name: "Kismis (Raisins)" },
    { alias: "Pista", item_code: "KPL-344", canonical_name: "Pista (Pistachio)" },
    { alias: "Oil", item_code: "KPL-413", canonical_name: "Sunflower Oil" },
    { alias: "Sunflower Oil", item_code: "KPL-413", canonical_name: "Sunflower Oil" },
    { alias: "Refined Oil", item_code: "KPL-413", canonical_name: "Sunflower Oil" },
    { alias: "Mineral Water 1L", item_code: "KPL-280", canonical_name: "Mineral water 1l" },
    { alias: "Mineral Water 500ml", item_code: "KPL-281", canonical_name: "Mineral water 500ml" },
    { alias: "Mineral Water 250ml", item_code: "KPL-282", canonical_name: "Mineral water 250 Ml" },
    { alias: "Parcel Covers 4x6", item_code: "KPL-329", canonical_name: "Parcel Covers 4*6" },
    { alias: "Parcel Covers 5x8", item_code: "KPL-330", canonical_name: "Parcel Covers 5*8" },
    { alias: "Parcel Covers 6x9", item_code: "KPL-331", canonical_name: "Parcel Covers 6*9" },
    { alias: "Box 1000ml", item_code: "KPL-132", canonical_name: "Box Container 1000 Ml" },
    { alias: "Box 500ml", item_code: "KPL-138", canonical_name: "Box Container 500 Ml" },
    { alias: "Box 750ml", item_code: "KPL-139", canonical_name: "Box Container 750ml" },
    { alias: "Box 250ml", item_code: "KPL-135", canonical_name: "Box Container 250ml" },
    { alias: "Cheese Block", item_code: "KPL-159", canonical_name: "Cheese 500g" },
    { alias: "Cheese 500g", item_code: "KPL-159", canonical_name: "Cheese 500g" },
  ];

  let aliasInserted = 0;
  for (const a of aliasesToSeed) {
    await db("stock_aliases")
      .insert({
        alias: a.alias,
        item_code: a.item_code,
        canonical_name: a.canonical_name,
        created_by: "system_sync",
      })
      .onConflict("alias")
      .merge({
        item_code: a.item_code,
        canonical_name: a.canonical_name,
        created_by: "system_sync",
      });
    aliasInserted++;
  }
  console.log(`  -> Upserted ${aliasInserted} canonical stock aliases.\n`);

  console.log("================================================================================");
  console.log("  SYNCHRONIZATION COMPLETED SUCCESSFULLY!                                       ");
  console.log("================================================================================");
  process.exit(0);
}

runSync().catch((err) => {
  console.error("FATAL: Sync failed:", err);
  process.exit(1);
});
