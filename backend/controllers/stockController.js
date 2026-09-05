const db = require("../db");
const { normalizeUnit, CANONICAL_UNITS, getConversionMultiplier } = require("../utils/units");
const { auditLog } = require("../services/auditService");
const { sendNotification } = require("./notificationController");
const { publish } = require("../services/kafkaProducer");

// Admin gets pinged the moment a store-manager-level actor makes a large
// adjustment/delete — SM is never blocked, but every footstep is watched.
const ADJUSTMENT_ALERT_QTY = 50;
async function alertAdminIfLarge(req, action, item, delta) {
  if (Math.abs(delta) < ADJUSTMENT_ALERT_QTY) return;
  const adminRole = await db("roles").where({ key: "admin" }).first();
  if (!adminRole) return;
  await sendNotification({
    recipient_role_id: adminRole.id,
    title: `Large Stock ${action}`,
    message: `${req.user?.name || "A user"} ${action.toLowerCase()}d ${Math.abs(delta)} ${item.unit || ""} of ${item.name} (${item.item_code}).`,
    type: "stock_threshold",
    severity: "warning",
    metadata: { item_code: item.item_code, delta },
  });
}

// GET /api/stock
// Query params: name, unit, date_from, date_to, low_stock, q (full-text), page, limit, sort, order
async function list(req, res, next) {
  try {
    const { name, unit, date_from, date_to, low_stock, q, supplier, expiry_status, active_only, category } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const applyFilters = (qb) => {
      if (name) {
        qb.where((inner) => {
          inner.whereILike("name", `%${name}%`).orWhereILike("supplier", `%${name}%`);
        });
      }
      if (unit)      qb.where("unit", unit);
      if (date_from) qb.where("date", ">=", date_from);
      if (date_to)   qb.where("date", "<=", date_to);
      if (low_stock === "true") qb.whereRaw("remaining <= COALESCE(min_alert_qty, qty * 0.25)");
      if (active_only === "true") qb.where("remaining", ">", 0);
      if (supplier)  qb.where("supplier", supplier);
      if (category)  qb.where("category", category);
      if (expiry_status) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (expiry_status === "expired") {
          qb.where("expiry_date", "<", todayStr);
        } else if (expiry_status === "expiring") {
          const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
          qb.whereBetween("expiry_date", [todayStr, soon]);
        } else if (expiry_status === "fresh") {
          qb.where("expiry_date", ">", new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
        }
      }
      if (q) {
        qb.where((inner) => {
          inner.whereILike("name", `%${q}%`)
               .orWhereILike("supplier", `%${q}%`)
               .orWhereILike("item_code", `%${q}%`);
        });
      }
    };

    let query = db("stock").select(
      "id", "name", "qty", "remaining", "unit", "date", "created_at", "price", "supplier", "expiry_date", "min_alert_qty", "item_code", "category",
      db.raw("ROUND((remaining / NULLIF(qty, 0) * 100)::numeric, 1) AS pct_remaining")
    ).modify(applyFilters);

    if (q) {
      query.orderBy([
        { column: sort, order },
        { column: "id", order: "desc" }
      ]);
    } else {
      query.orderBy([
        { column: sort, order },
        { column: "id", order: "desc" }
      ]);
    }

    const [{ count }] = await db("stock").count("id as count").modify(applyFilters);

    const [stats] = await db("stock").modify(applyFilters).select(
      db.raw("COALESCE(SUM(qty * price), 0) AS total_spend"),
      db.raw("COALESCE(SUM(remaining * price), 0) AS store_value"),
      db.raw("COALESCE(SUM(remaining * price) FILTER (WHERE remaining <= COALESCE(min_alert_qty, qty * 0.25)), 0) AS low_stock_value")
    );

    const rows = await query.offset(offset).limit(limit);
    res.json({
      success: true,
      data: rows,
      total: parseInt(count),
      page: req.pagination.page,
      limit,
      stats: {
        total_spend: parseFloat(stats.total_spend),
        store_value: parseFloat(stats.store_value),
        low_stock_value: parseFloat(stats.low_stock_value)
      }
    });
  } catch (err) { next(err); }
}

// POST /api/stock
async function create(req, res, next) {
  try {
    const { name, qty, unit, date, price, supplier, expiry_date, min_alert_qty, category } = req.body;

    // Check if item name already has an item_code
    let item_code;
    const existing = await db("stock")
      .whereRaw("LOWER(name) = LOWER(?)", [name.trim()])
      .select("item_code")
      .first();
      
    if (existing) {
      item_code = existing.item_code;
    } else {
      // Find maximum item code in database to generate the next one
      const maxRow = await db("stock")
        .whereILike("item_code", "KPL-%")
        .select("item_code")
        .orderByRaw("CAST(SUBSTRING(item_code FROM 5) AS INTEGER) DESC")
        .first();
        
      if (maxRow) {
        const lastNum = parseInt(maxRow.item_code.split("-")[1], 10);
        item_code = `KPL-${lastNum + 1}`;
      } else {
        item_code = "KPL-101";
      }
    }

    const [row] = await db("stock").insert({
      name, qty, remaining: qty, unit, date, price, supplier, expiry_date, min_alert_qty, item_code, category: category || null
    }).returning("*");

    await auditLog(req, { action: "stock.create", resource: "stock", resourceId: row.id, after: row });
    publish("stock-events", { type: "stock.create", id: row.id, item_code: row.item_code, qty: row.qty });

    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
}

// PATCH /api/stock/:id
async function update(req, res, next) {
  try {
    const { remaining, min_alert_qty, reason, notes, name, unit, price, item_code, category } = req.body;

    const current = await db("stock").where("id", req.params.id).first();
    if (!current) return res.status(404).json({ success: false, error: "Not found" });

    const updates = {};
    if (min_alert_qty !== undefined) updates.min_alert_qty = min_alert_qty === null ? null : Math.max(0, parseFloat(min_alert_qty));
    if (name !== undefined) updates.name = name;
    if (unit !== undefined) updates.unit = unit;
    if (price !== undefined) updates.price = parseFloat(price) || 0;
    if (item_code !== undefined) updates.item_code = item_code;
    if (category !== undefined) updates.category = category || null;
    
    let delta = 0;
    if (remaining !== undefined) {
      const targetRem = Math.max(0, parseFloat(remaining));
      updates.remaining = targetRem;
      delta = targetRem - current.remaining;
    }

    const row = await db.transaction(async (trx) => {
      const [updatedRow] = await trx("stock").where("id", req.params.id)
        .update(updates).returning("*");

      if (remaining !== undefined && delta !== 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        await trx("stock_adjustments").insert({
          stock_id: req.params.id,
          qty: delta,
          reason: reason || "Audit Correction",
          date: todayStr,
          notes: notes || null
        });
      }
      return updatedRow;
    });

    await auditLog(req, { action: "stock.edit", resource: "stock", resourceId: row.id, before: current, after: row });
    publish("stock-events", { type: "stock.edit", id: row.id, item_code: row.item_code, delta });
    if (delta !== 0) await alertAdminIfLarge(req, "Adjust", row, delta);

    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

// DELETE /api/stock/:id
async function remove(req, res, next) {
  try {
    const { reason } = req.body || {};
    const existing = await db("stock").where("id", req.params.id).first();
    if (!existing) return res.status(404).json({ success: false, error: "Not found" });

    const deleted = await db("stock").where("id", req.params.id).delete();
    if (!deleted) return res.status(404).json({ success: false, error: "Not found" });

    await auditLog(req, { action: "stock.delete", resource: "stock", resourceId: existing.id, before: existing, metadata: reason ? { reason } : null });
    publish("stock-events", { type: "stock.delete", id: existing.id, item_code: existing.item_code });
    await alertAdminIfLarge(req, "Delete", existing, parseFloat(existing.remaining) || 0);

    res.json({ success: true });
  } catch (err) { next(err); }
}

// GET /api/stock/ledger
// Query params: type (Purchase|Issue|Leftover|Adjustment), q (item name search),
// date_from, date_to — all applied client-side after merging the 4 sources since
// they come from different tables with no common query surface.
async function getLedger(req, res, next) {
  try {
    const { offset = 0, limit = 50 } = req.pagination || { offset: 0, limit: 50 };
    const { type, q, date_from, date_to } = req.query;

    const purchases = db("stock")
      .select("date", "name", db.raw("'Purchase' as type"), "qty", "unit", "price", "supplier as detail", "created_at", "item_code");

    // unit_price was previously dropped here (hardcoded NULL) even though
    // issuance_items carries a real per-unit price — ledger showed every
    // issue with a blank cost. Use it so issue rows show real value too.
    const issuances = db("issuance_items")
      .join("issuances", "issuances.id", "issuance_items.issuance_id")
      .select("issuances.date", "issuance_items.name", db.raw("'Issue' as type"), "issuance_items.issued as qty", "issuance_items.unit", "issuance_items.unit_price as price", "issuances.dept as detail", "issuances.created_at", "issuance_items.item_code");

    const distinctStock = db("stock").select("name", "item_code", "unit").distinctOn("name").as("ds");

    const leftovers = db("leftovers")
      .leftJoin(distinctStock, db.raw("LOWER(leftovers.item)"), db.raw("LOWER(ds.name)"))
      .select("leftovers.date", "leftovers.item as name", db.raw("'Leftover' as type"), "leftovers.qty", "ds.unit", db.raw("NULL::numeric as price"), "leftovers.dept as detail", "leftovers.created_at", "ds.item_code");

    const adjustments = db("stock_adjustments")
      .join("stock", "stock.id", "stock_adjustments.stock_id")
      .select(
        "stock_adjustments.date",
        "stock.name",
        db.raw("'Adjustment' as type"),
        "stock_adjustments.qty",
        "stock.unit",
        db.raw("NULL::numeric as price"),
        db.raw("CONCAT(stock_adjustments.reason, ' (', COALESCE(stock_adjustments.notes, 'No details'), ')') as detail"),
        "stock_adjustments.created_at",
        "stock.item_code"
      );

    const sources = { Purchase: purchases, Issue: issuances, Leftover: leftovers, Adjustment: adjustments };
    const wanted = type && sources[type] ? [type] : Object.keys(sources);
    const results = await Promise.all(wanted.map((t) => sources[t]));

    let ledger = results.flat();

    if (q) {
      const needle = q.toLowerCase();
      ledger = ledger.filter((r) => (r.name || "").toLowerCase().includes(needle));
    }
    if (date_from) ledger = ledger.filter((r) => r.date >= date_from);
    if (date_to) ledger = ledger.filter((r) => r.date <= date_to);

    ledger = ledger
      .map((r) => ({ ...r, value: r.price != null ? parseFloat(r.qty) * parseFloat(r.price) : null }))
      .sort((a, b) => {
        const diff = new Date(b.created_at || b.date) - new Date(a.created_at || a.date);
        if (diff !== 0) return diff;
        return (a.item_code || "").localeCompare(b.item_code || "");
      });

    const total = ledger.length;
    const paginated = ledger.slice(offset, offset + limit);

    res.json({ success: true, data: paginated, total, page: req.pagination?.page || 1, limit });
  } catch (err) { next(err); }
}

// GET /api/stock/insights
async function getInsights(req, res, next) {
  try {
    const supplierSpend = await db("stock")
      .select("supplier", db.raw("SUM(remaining * price) as active_value"), db.raw("COUNT(*) as batch_count"))
      .whereNotNull("supplier")
      .groupBy("supplier")
      .orderBy("active_value", "desc");

    const priceTrends = await db("stock")
      .select("name", "price", "date", "supplier")
      .whereNotNull("price")
      .orderBy("name")
      .orderBy("date", "desc");

    // Cost breakdown by category — where is capital actually locked, at a glance.
    const categorySpend = await db("stock")
      .select(db.raw("COALESCE(category, 'Uncategorized') as category"), db.raw("SUM(remaining * price) as active_value"), db.raw("COUNT(*) as batch_count"))
      .groupBy(db.raw("COALESCE(category, 'Uncategorized')"))
      .orderBy("active_value", "desc");

    // Month-over-month purchase spend (last 6 months), for a trend line.
    const monthlySpendRows = await db("stock")
      .whereNotNull("price")
      .where("date", ">=", db.raw("CURRENT_DATE - INTERVAL '6 months'"))
      .select(db.raw("to_char(date, 'YYYY-MM') as month"), db.raw("SUM(qty * price) as spend"))
      .groupBy(db.raw("to_char(date, 'YYYY-MM')"))
      .orderBy("month", "asc");
    const monthlySpend = monthlySpendRows.map((r) => ({ month: r.month, spend: parseFloat(r.spend) || 0 }));

    res.json({ success: true, data: { supplierSpend, priceTrends, categorySpend, monthlySpend } });
  } catch (err) { next(err); }
}

// POST /api/stock/reconcile
async function reconcile(req, res, next) {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "Items array is required." });
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    await db.transaction(async (trx) => {
      for (const item of items) {
        const { item_code, physical_qty, reason, notes } = item;
        const targetPhysical = Math.max(0, parseFloat(physical_qty));

        // Get active stock batches for this item code
        const activeBatches = await trx("stock")
          .where("item_code", item_code)
          .where("remaining", ">", 0)
          .orderBy("date", "asc")
          .orderBy("id", "asc");

        const totalSystem = activeBatches.reduce((sum, b) => sum + parseFloat(b.remaining), 0);
        const discrepancy = targetPhysical - totalSystem;

        if (discrepancy === 0) continue;

        if (discrepancy < 0) {
          // Shrinkage: Deduct from oldest batches first (FIFO)
          let toDeduct = Math.abs(discrepancy);
          for (const batch of activeBatches) {
            if (toDeduct <= 0) break;
            const deduction = Math.min(parseFloat(batch.remaining), toDeduct);
            
            await trx("stock")
              .where("id", batch.id)
              .update({
                remaining: parseFloat(batch.remaining) - deduction
              });

            await trx("stock_adjustments").insert({
              stock_id: batch.id,
              qty: -deduction,
              reason: reason || "Audit Correction",
              date: todayStr,
              notes: notes || `FIFO deduction of ${deduction} units during physical reconciliation.`
            });

            toDeduct -= deduction;
          }
        } else {
          // Surplus: Add to the newest batch
          if (activeBatches.length > 0) {
            const latestBatch = activeBatches[activeBatches.length - 1];
            await trx("stock")
              .where("id", latestBatch.id)
              .update({
                remaining: parseFloat(latestBatch.remaining) + discrepancy
              });

            await trx("stock_adjustments").insert({
              stock_id: latestBatch.id,
              qty: discrepancy,
              reason: reason || "Audit Correction",
              date: todayStr,
              notes: notes || `Surplus of ${discrepancy} units added during physical reconciliation.`
            });
          } else {
            // No active batches exist. Let's find the last purchase of this item_code to clone details
            const lastBatch = await trx("stock")
              .where("item_code", item_code)
              .orderBy("date", "desc")
              .first();

            if (lastBatch) {
              const [newBatch] = await trx("stock").insert({
                name: lastBatch.name,
                qty: discrepancy,
                remaining: discrepancy,
                unit: lastBatch.unit,
                date: todayStr,
                price: lastBatch.price || 0,
                supplier: lastBatch.supplier || "Unknown",
                supplier_id: lastBatch.supplier_id || null,
                expiry_date: null,
                min_alert_qty: lastBatch.min_alert_qty,
                item_code: item_code
              }).returning("*");

              await trx("stock_adjustments").insert({
                stock_id: newBatch.id,
                qty: discrepancy,
                reason: reason || "Audit Correction",
                date: todayStr,
                notes: notes || `Created new batch of ${discrepancy} units during physical reconciliation.`
              });
            }
          }
        }
      }
    });

    res.json({ success: true, message: "Reconciliation complete." });
  } catch (err) {
    next(err);
  }
}

// GET /api/stock/available
// Query: names=comma list (legacy) and/or codes=comma list (preferred).
// Returns a flat map keyed BOTH by lowercased name AND by item_code, each entry
// { available, price, name, unit, item_code }. item_code keys are the reliable
// join for issuance — names drift (OCR "BAKING" vs stock "Baking Powder").
async function getAvailableStock(req, res, next) {
  try {
    const { names, codes } = req.query;
    const toList = (v) => (v ? (Array.isArray(v) ? v : v.split(",").map((x) => x.trim())).filter(Boolean) : null);
    const namesList = toList(names);
    const codesList = toList(codes);

    // Build a WHERE that matches either the requested names OR the requested codes.
    const scope = (qb) => {
      if (!namesList && !codesList) return; // no filter → all stock
      qb.where((w) => {
        if (namesList) w.orWhereIn(db.raw("LOWER(name)"), namesList.map((n) => n.toLowerCase()));
        if (codesList) w.orWhereIn("item_code", codesList);
      });
    };

    // Sum remaining qty grouped by item_code + name (so we can key by both)
    const qtyRows = await db("stock")
      .select("item_code", "name")
      .sum("remaining as available")
      .modify(scope)
      .groupBy("item_code", "name");

    // Latest batch per item for price + unit (prefer active batches, then recent)
    const detailRows = await db("stock")
      .select("item_code", "name", "price", "unit", "date", "created_at", "remaining")
      .modify(scope)
      .orderBy("date", "desc")
      .orderBy("created_at", "desc");

    // Best detail (price+unit) per item_code and per name
    const bestBy = {};
    const consider = (key, r) => {
      if (!key) return;
      const rowHasActive = parseFloat(r.remaining) > 0;
      const cur = bestBy[key];
      if (!cur) {
        bestBy[key] = { price: parseFloat(r.price) || 0, unit: r.unit || "kg", hasActive: rowHasActive };
      } else if ((!cur.hasActive && rowHasActive) || (cur.hasActive === rowHasActive && parseFloat(r.price) > 0 && cur.price === 0)) {
        bestBy[key] = { price: parseFloat(r.price) || 0, unit: r.unit || "kg", hasActive: rowHasActive };
      }
    };
    detailRows.forEach((r) => {
      consider(r.item_code, r);
      consider(r.name.toLowerCase(), r);
    });

    // Sum available per item_code and per name (a name/code may span batches)
    const availByCode = {};
    const availByName = {};
    qtyRows.forEach((r) => {
      if (r.item_code) availByCode[r.item_code] = (availByCode[r.item_code] || 0) + parseFloat(r.available || 0);
      availByName[r.name.toLowerCase()] = (availByName[r.name.toLowerCase()] || 0) + parseFloat(r.available || 0);
    });

    const formatted = {};
    qtyRows.forEach((r) => {
      const nameKey = r.name.toLowerCase();
      const entry = (key, available) => ({
        available,
        price: bestBy[key]?.price || 0,
        unit: bestBy[key]?.unit || "kg",
        name: r.name,
        item_code: r.item_code,
      });
      // key by name (legacy) and by item_code (preferred)
      formatted[nameKey] = entry(nameKey, availByName[nameKey]);
      if (r.item_code) formatted[r.item_code] = entry(r.item_code, availByCode[r.item_code]);
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
}

async function getSupplierRates(req, res, next) {
  try {
    const { item } = req.query;
    if (!item) return res.json({ success: true, data: [] });

    // Fetch the latest prices for each supplier for the given item name
    const rates = await db("stock")
      .select("supplier", "supplier_id")
      .max("price as price")
      .max("date as last_date")
      .whereILike("name", item)
      .whereNotNull("supplier")
      .groupBy("supplier", "supplier_id")
      .orderBy("price", "asc");

    res.json({ success: true, data: rates });
  } catch (err) { next(err); }
}

// PATCH /api/stock/unit  — correct an item's base unit in one shot.
// Body: { item_code, unit }. Updates EVERY stock batch for that item_code so
// availability + issuance immediately speak the corrected unit. This is a label
// correction (e.g. import guessed "kg" but item is really "pcs"); quantities are
// left as-is. (reorder_points has no unit column, so nothing to sync there.)
async function updateItemUnit(req, res, next) {
  try {
    const { item_code } = req.body;
    const unit = normalizeUnit(req.body.unit);

    if (!item_code) return res.status(400).json({ success: false, error: "item_code is required." });
    if (!CANONICAL_UNITS.includes(unit)) {
      return res.status(400).json({ success: false, error: `Invalid unit. Allowed: ${CANONICAL_UNITS.join(", ")}` });
    }

    const batches = await db("stock").where("item_code", item_code);
    if (batches.length === 0) return res.status(404).json({ success: false, error: `No stock found for item_code '${item_code}'.` });

    const oldUnit = batches[0].unit;
    // Dimensionally-compatible swap (kg<->g, L<->ml, dozen/box<->pcs) — rescale
    // qty/remaining/price so real-world value survives the relabel. A true
    // mislabel fix across incompatible dimensions (e.g. kg -> pcs) has no
    // multiplier, so those stay label-only as before.
    const multiplier = getConversionMultiplier(oldUnit, unit);

    await db.transaction(async (trx) => {
      for (const batch of batches) {
        if (multiplier !== null && multiplier !== 1) {
          await trx("stock").where("id", batch.id).update({
            unit,
            qty: parseFloat(batch.qty) * multiplier,
            remaining: parseFloat(batch.remaining) * multiplier,
            price: batch.price != null ? parseFloat(batch.price) / multiplier : batch.price,
          });
        } else {
          await trx("stock").where("id", batch.id).update({ unit });
        }
      }
    });

    const row = await db("stock").where("item_code", item_code).first();
    publish("stock-events", { type: "stock.unit_change", item_code, old_unit: oldUnit, new_unit: unit, rescaled: multiplier !== null && multiplier !== 1 });
    res.json({ success: true, data: { item_code, unit, name: row ? row.name : null, batches_updated: batches.length, rescaled: multiplier !== null && multiplier !== 1 } });
  } catch (err) { next(err); }
}

// POST /api/stock/alias  — teach a scanned/misspelled name → real stock item.
// Called when a store manager corrects an OCR mismatch in the indent/issuance
// review screen. Written once here, every future scan of that same spelling
// auto-matches via fuzzyMatchStock's alias lookup (services/fuzzyMatch.js) —
// the store manager never has to fix the same item twice.
async function createAlias(req, res, next) {
  try {
    const { alias, item_code } = req.body;
    if (!alias || !alias.trim() || !item_code) {
      return res.status(400).json({ success: false, error: "alias and item_code are required." });
    }

    const stockItem = await db("stock").where("item_code", item_code).first();
    if (!stockItem) return res.status(404).json({ success: false, error: `No stock item found for item_code '${item_code}'.` });

    const [row] = await db("stock_aliases")
      .insert({
        alias: alias.trim(),
        item_code,
        canonical_name: stockItem.name,
        created_by: req.user?.name || "system",
      })
      .onConflict("alias")
      .merge(["item_code", "canonical_name", "created_by"])
      .returning("*");

    await auditLog(req, { action: "stock.alias_taught", resource: "stock_aliases", resourceId: row.id, after: row });

    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
}

async function searchNLP(req, res, next) {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: "Query is required." });
    }

    const { parseNLStockQuery } = require("../services/localAI");
    const filters = await parseNLStockQuery(query);

    const qb = db("stock");

    if (filters.name) {
      qb.where("name", "ilike", `%${filters.name}%`);
    }
    if (filters.category) {
      qb.where("category", "ilike", `%${filters.category}%`);
    }
    if (filters.minQty !== undefined && filters.minQty !== null) {
      qb.where("remaining", ">=", filters.minQty);
    }
    if (filters.maxQty !== undefined && filters.maxQty !== null) {
      qb.where("remaining", "<=", filters.maxQty);
    }
    if (filters.expiringWithinDays !== undefined && filters.expiringWithinDays !== null) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const soon = new Date(Date.now() + filters.expiringWithinDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      qb.whereBetween("expiry_date", [todayStr, soon]);
    }

    const results = await qb.select("*").orderBy("name", "asc").limit(100);
    res.json({ success: true, filters, data: results });
  } catch (err) {
    next(err);
  }
}

async function getSubstituteRecommendation(req, res, next) {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ success: false, error: "Item name is required." });
    }

    const item = await db("stock").whereRaw("LOWER(name) = LOWER(?)", [name.trim()]).first();
    const category = item?.category;

    const qb = db("stock").where("remaining", ">", 0).distinct("name", "item_code", "unit", "price");
    if (category) {
      qb.where("category", category);
    }
    const candidates = await qb;

    const filteredCandidates = candidates.filter(c => c.name.toLowerCase() !== name.trim().toLowerCase());

    const { getAISubstitute } = require("../services/localAI");
    const bestMatch = await getAISubstitute(name, filteredCandidates);

    res.json({ success: true, substitute: bestMatch });
  } catch (err) {
    next(err);
  }
}

async function getSuggestedCategory(req, res, next) {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ success: false, error: "name parameter is required." });
    }
    const { suggestCategory } = require("../services/localAI");
    const category = await suggestCategory(name);
    res.json({ success: true, category });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, getLedger, getInsights, reconcile, getAvailableStock, getSupplierRates, updateItemUnit, createAlias, searchNLP, getSubstituteRecommendation, getSuggestedCategory };
