const db = require("../db");

/**
 * Fuzzy-match a scanned item name against stock using pg_trgm similarity.
 * Checks stock_aliases first (exact), then trigram similarity on stock.name.
 * Returns { name, item_code, unit, score, via } or null.
 */
async function fuzzyMatchStock(scannedName) {
  const clean = (scannedName || "").trim();
  if (!clean) return null;

  // 1. Exact alias lookup
  const alias = await db("stock_aliases")
    .whereRaw("LOWER(alias) = LOWER(?)", [clean])
    .first();
  if (alias) {
    return { name: alias.canonical_name, item_code: alias.item_code, unit: null, score: 1.0, via: "alias" };
  }

  // 2. Exact stock name match
  const exact = await db("stock")
    .select("name", "item_code", "unit")
    .whereRaw("LOWER(name) = LOWER(?)", [clean])
    .first();
  if (exact) return { ...exact, score: 1.0, via: "exact" };

  // 3. pg_trgm similarity
  const rows = await db.raw(
    `SELECT DISTINCT ON (item_code) name, item_code, unit,
            similarity(LOWER(name), LOWER(?)) AS score
     FROM stock
     WHERE similarity(LOWER(name), LOWER(?)) > 0.35
     ORDER BY item_code, score DESC`,
    [clean, clean]
  );

  if (!rows.rows.length) return null;

  // Pick highest score across deduplicated item_codes
  const best = rows.rows.reduce((a, b) => (parseFloat(b.score) > parseFloat(a.score) ? b : a));
  return { ...best, score: parseFloat(best.score), via: "fuzzy" };
}

/**
 * pg_trgm similarity match for a single name (used only for names that miss
 * alias + exact lookup). Returns match or null.
 */
async function trigramMatch(scannedName) {
  const clean = (scannedName || "").trim();
  if (!clean) return null;
  const rows = await db.raw(
    `SELECT DISTINCT ON (item_code) name, item_code, unit,
            similarity(LOWER(name), LOWER(?)) AS score
     FROM stock
     WHERE similarity(LOWER(name), LOWER(?)) > 0.35
     ORDER BY item_code, score DESC`,
    [clean, clean]
  );
  if (!rows.rows.length) return null;
  const best = rows.rows.reduce((a, b) => (parseFloat(b.score) > parseFloat(a.score) ? b : a));
  return { ...best, score: parseFloat(best.score), via: "fuzzy" };
}

/**
 * Batch fuzzy-match: returns map of scannedName → match|null.
 * Resolves in bulk to avoid N×3 round-trips:
 *   1. one query for all alias hits
 *   2. one query for all exact stock-name hits
 *   3. pg_trgm ONLY for the leftover misses (usually few)
 */
async function fuzzyMatchBatch(names) {
  const results = {};
  const clean = names.map((n) => (n || "").trim()).filter(Boolean);
  if (!clean.length) return results;

  const lowerSet = [...new Set(clean.map((n) => n.toLowerCase()))];

  // 1. bulk alias lookup
  const aliasRows = await db("stock_aliases").whereRaw("LOWER(alias) = ANY(?)", [lowerSet]);
  const aliasMap = {};
  aliasRows.forEach((a) => { aliasMap[a.alias.toLowerCase()] = a; });

  // 2. bulk exact stock-name lookup
  const exactRows = await db("stock")
    .select("name", "item_code", "unit")
    .whereRaw("LOWER(name) = ANY(?)", [lowerSet]);
  const exactMap = {};
  exactRows.forEach((s) => { if (!exactMap[s.name.toLowerCase()]) exactMap[s.name.toLowerCase()] = s; });

  // 3. trigram only for names that missed both maps
  const misses = [...new Set(clean.filter((n) => {
    const ln = n.toLowerCase();
    return !aliasMap[ln] && !exactMap[ln];
  }))];
  const trigramMap = {};
  await Promise.all(misses.map(async (n) => { trigramMap[n.toLowerCase()] = await trigramMatch(n); }));

  clean.forEach((n) => {
    const ln = n.toLowerCase();
    if (aliasMap[ln]) {
      const a = aliasMap[ln];
      results[n] = { name: a.canonical_name, item_code: a.item_code, unit: null, score: 1.0, via: "alias" };
    } else if (exactMap[ln]) {
      results[n] = { ...exactMap[ln], score: 1.0, via: "exact" };
    } else {
      results[n] = trigramMap[ln] || null;
    }
  });
  return results;
}

/**
 * Persist an alias so future scans resolve automatically.
 */
async function saveAlias(alias, item_code, canonical_name, created_by = "system") {
  await db("stock_aliases")
    .insert({ alias: alias.trim(), item_code, canonical_name, created_by })
    .onConflict("alias")
    .merge({ item_code, canonical_name, created_by });
}

module.exports = { fuzzyMatchStock, fuzzyMatchBatch, saveAlias };
