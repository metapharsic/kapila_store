const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");
const { getConversionMultiplier, normalizeUnit } = require("../utils/units");

function normalize(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[_\-\/().,]/g, " ")
    .replace(/\s+/g, " ");
}

async function auditMatching() {
  console.log("================================================================================");
  console.log("  MULTI-AGENT AUDIT: INDENT & ISSUANCE ITEM + UNIT MATCHING AGAINST INVENTORY  ");
  console.log("================================================================================\n");

  // Load stock catalog
  const stockRows = await db("stock")
    .select("id", "name", "item_code", "category", "unit", "remaining", "price")
    .orderBy("id", "asc");

  const stockByCode = new Map();
  const stockByName = new Map();
  const stockByNorm = new Map();

  stockRows.forEach(s => {
    if (s.item_code) stockByCode.set(s.item_code.trim().toUpperCase(), s);
    stockByName.set(s.name.trim().toLowerCase(), s);
    stockByNorm.set(normalize(s.name), s);
  });

  console.log(`[Stock Inventory]: Loaded ${stockRows.length} batch records across ${stockByNorm.size} unique normalized SKUs.\n`);

  // --- AUDIT 1: indent_templates (872 rows) ---
  console.log("--- AUDIT 1: indent_templates (872 rows) vs stock ---");
  const templateRows = await db("indent_templates").select("*").orderBy("id", "asc");

  let tmplMissingCode = 0;
  let tmplWrongCode = 0;
  let tmplUnmatchedName = 0;
  let tmplUnitMismatches = [];
  let tmplExactMatches = 0;

  for (const t of templateRows) {
    const tCode = t.item_code ? t.item_code.trim().toUpperCase() : "";
    const tNorm = normalize(t.item_name);

    let match = null;
    if (tCode && stockByCode.has(tCode)) {
      match = stockByCode.get(tCode);
    } else if (stockByNorm.has(tNorm)) {
      match = stockByNorm.get(tNorm);
    } else {
      // Fuzzy lookup
      for (const [sNorm, sItem] of stockByNorm.entries()) {
        if ((sNorm.length > 3 && tNorm.includes(sNorm)) || (tNorm.length > 3 && sNorm.includes(tNorm))) {
          match = sItem;
          break;
        }
      }
    }

    if (!match) {
      tmplUnmatchedName++;
    } else {
      if (!tCode) tmplMissingCode++;
      else if (match.item_code && tCode !== match.item_code.trim().toUpperCase()) tmplWrongCode++;

      // Check unit compatibility
      const tUnit = t.default_unit || "kg";
      const sUnit = match.unit || "kg";
      const mult = getConversionMultiplier(tUnit, sUnit);

      if (normalizeUnit(tUnit) !== normalizeUnit(sUnit)) {
        tmplUnitMismatches.push({
          id: t.id,
          dept: t.template_name,
          templateItem: t.item_name,
          templateCode: t.item_code,
          templateUnit: tUnit,
          stockName: match.name,
          stockCode: match.item_code,
          stockUnit: sUnit,
          multiplier: mult,
          isConvertible: mult !== null,
        });
      } else {
        tmplExactMatches++;
      }
    }
  }

  console.log(`• Total Template Rows:         ${templateRows.length}`);
  console.log(`• Matched to Stock:            ${templateRows.length - tmplUnmatchedName}`);
  console.log(`• Unmatched to Stock:          ${tmplUnmatchedName}`);
  console.log(`• Missing Item Code:           ${tmplMissingCode}`);
  console.log(`• Mismatched Item Code:        ${tmplWrongCode}`);
  console.log(`• Unit Mismatches:             ${tmplUnitMismatches.length}`);
  console.log(`  - Convertible (e.g. g <-> kg): ${tmplUnitMismatches.filter(u => u.isConvertible).length}`);
  console.log(`  - INCOMPATIBLE (convert = null): ${tmplUnitMismatches.filter(u => !u.isConvertible).length}`);

  // Sample incompatible unit mismatches
  const incomp = tmplUnitMismatches.filter(u => !u.isConvertible);
  if (incomp.length > 0) {
    console.log("\nSample Incompatible Unit Mismatches in Templates:");
    console.log(JSON.stringify(incomp.slice(0, 10), null, 2));
  }

  // --- AUDIT 2: historical indent_items (402 rows) ---
  console.log("\n--- AUDIT 2: indent_items (402 rows) vs stock ---");
  const indentItems = await db("indent_items").select("*").orderBy("id", "asc");

  let indMissingCode = 0;
  let indUnmatched = 0;
  let indUnitMismatches = [];

  for (const it of indentItems) {
    const code = it.item_code ? it.item_code.trim().toUpperCase() : "";
    const norm = normalize(it.name);

    let match = (code && stockByCode.has(code)) ? stockByCode.get(code) : stockByNorm.get(norm);
    if (!match) {
      indUnmatched++;
    } else {
      if (!code || code === "KPL-NEW") indMissingCode++;
      const iUnit = it.unit || "kg";
      const sUnit = match.unit || "kg";
      const mult = getConversionMultiplier(iUnit, sUnit);
      if (normalizeUnit(iUnit) !== normalizeUnit(sUnit)) {
        indUnitMismatches.push({
          id: it.id,
          indent_id: it.indent_id,
          name: it.name,
          indentUnit: iUnit,
          stockName: match.name,
          stockUnit: sUnit,
          mult,
          isConvertible: mult !== null,
        });
      }
    }
  }

  console.log(`• Total Indent Items:          ${indentItems.length}`);
  console.log(`• Unmatched to Stock:          ${indUnmatched}`);
  console.log(`• Missing/KPL-NEW Code:        ${indMissingCode}`);
  console.log(`• Unit Mismatches:             ${indUnitMismatches.length}`);
  console.log(`  - Incompatible Units:        ${indUnitMismatches.filter(u => !u.isConvertible).length}`);

  // --- AUDIT 3: recipe_items vs stock ---
  console.log("\n--- AUDIT 3: recipe_items vs stock ---");
  const recipeItems = await db("recipe_items").select("*").orderBy("id", "asc");
  let recUnmatched = 0;
  let recUnitIncompatible = 0;

  for (const r of recipeItems) {
    const norm = normalize(r.item_name);
    const match = stockByNorm.get(norm);
    if (!match) {
      recUnmatched++;
    } else {
      const rUnit = r.unit || "kg";
      const sUnit = match.unit || "kg";
      const mult = getConversionMultiplier(rUnit, sUnit);
      if (mult === null) recUnitIncompatible++;
    }
  }

  console.log(`• Total Recipe Items:          ${recipeItems.length}`);
  console.log(`• Unmatched to Stock:          ${recUnmatched}`);
  console.log(`• Incompatible Units:          ${recUnitIncompatible}`);

  process.exit(0);
}

auditMatching().catch(console.error);
