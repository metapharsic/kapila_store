const db = require("../db");

// GET /api/reorder-points
async function list(req, res, next) {
  try {
    const { is_active, q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const filter = (qb) => {
      if (is_active !== undefined) qb.where("reorder_points.is_active", is_active === "true");
      if (q) {
        qb.where((sub) => {
          sub.whereILike("reorder_points.name", `%${q}%`).orWhereILike("reorder_points.item_code", `%${q}%`);
        });
      }
    };

    const [{ count }] = await db("reorder_points").modify(filter).count("id as count");
    const rows = await db("reorder_points")
      .leftJoin("suppliers", "reorder_points.preferred_supplier_id", "suppliers.id")
      .modify(filter)
      .select("reorder_points.*", "suppliers.name as supplier_name")
      .orderBy(sort ? `reorder_points.${sort}` : "reorder_points.name", order || "asc").orderBy("reorder_points.id", "desc")
      .offset(offset).limit(limit);

    // Attach current stock level to each row
    const itemCodes = rows.map((r) => r.item_code);
    const stockLevels = itemCodes.length > 0
      ? await db("stock")
          .whereIn("item_code", itemCodes)
          .select("item_code")
          .sum("remaining as total_remaining")
          .groupBy("item_code")
      : [];
    const stockMap = Object.fromEntries(stockLevels.map((s) => [s.item_code, parseFloat(s.total_remaining || 0)]));

    const enriched = rows.map((r) => ({
      ...r,
      current_stock: stockMap[r.item_code] ?? null,
      needs_reorder: stockMap[r.item_code] !== undefined && stockMap[r.item_code] <= r.min_qty,
    }));

    res.json({ success: true, data: enriched, total: parseInt(count), page: req.pagination.page, limit });
  } catch (err) { next(err); }
}

// POST /api/reorder-points
async function create(req, res, next) {
  try {
    const { item_code, name, min_qty, reorder_qty, lead_time_days, preferred_supplier_id, notes } = req.body;

    const existing = await db("reorder_points").where("item_code", item_code).first();
    if (existing)
      return res.status(400).json({ success: false, error: `Reorder point for ${item_code} already exists. Use PATCH to update.` });

    const [row] = await db("reorder_points")
      .insert({ item_code, name, min_qty, reorder_qty, lead_time_days: lead_time_days || 3, preferred_supplier_id: preferred_supplier_id || null, notes: notes || null, is_active: true })
      .returning("*");

    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
}

// PATCH /api/reorder-points/:id
async function update(req, res, next) {
  try {
    const existing = await db("reorder_points").where("id", req.params.id).first();
    if (!existing) return res.status(404).json({ success: false, error: "Reorder point not found." });

    const fields = ["min_qty", "reorder_qty", "lead_time_days", "preferred_supplier_id", "is_active", "notes", "name"];
    const updates = {};
    fields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    updates.updated_at = db.fn.now();

    const [row] = await db("reorder_points").where("id", req.params.id).update(updates).returning("*");
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

// DELETE /api/reorder-points/:id
async function remove(req, res, next) {
  try {
    const deleted = await db("reorder_points").where("id", req.params.id).del();
    if (!deleted) return res.status(404).json({ success: false, error: "Reorder point not found." });
    res.json({ success: true, message: "Reorder point deleted." });
  } catch (err) { next(err); }
}

// GET /api/reorder-points/alerts  — items currently below min_qty
async function alerts(req, res, next) {
  try {
    const points = await db("reorder_points").where("is_active", true).select("*");
    if (points.length === 0) return res.json({ success: true, data: [] });

    const itemCodes = points.map((p) => p.item_code);
    const stockLevels = await db("stock")
      .whereIn("item_code", itemCodes)
      .select("item_code", "name", "unit")
      .sum("remaining as total_remaining")
      .groupBy("item_code", "name", "unit");

    const stockMap = Object.fromEntries(stockLevels.map((s) => [s.item_code, { remaining: parseFloat(s.total_remaining || 0), unit: s.unit }]));

    const needReorder = points
      .filter((p) => {
        const stock = stockMap[p.item_code];
        return !stock || stock.remaining <= p.min_qty;
      })
      .map((p) => ({
        ...p,
        current_stock: stockMap[p.item_code]?.remaining ?? 0,
        unit: stockMap[p.item_code]?.unit ?? "pcs",
        deficit: Math.max(0, p.reorder_qty - (stockMap[p.item_code]?.remaining ?? 0)),
      }));

    res.json({ success: true, data: needReorder });
  } catch (err) { next(err); }
}

async function predictive(req, res, next) {
  try {
    const points = await db("reorder_points")
      .leftJoin("suppliers", "reorder_points.preferred_supplier_id", "suppliers.id")
      .select("reorder_points.*", "suppliers.name as preferred_supplier_name", "suppliers.phone as preferred_supplier_phone")
      .where("reorder_points.is_active", true);

    if (points.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const itemCodes = points.map(p => p.item_code);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10);

    const consumption = await db("issuance_items")
      .join("issuances", "issuances.id", "issuance_items.issuance_id")
      .where("issuances.date", ">=", fourteenDaysAgoStr)
      .whereIn("issuance_items.item_code", itemCodes)
      .select("issuance_items.item_code")
      .sum("issuance_items.issued as total_issued")
      .groupBy("issuance_items.item_code");

    const consumptionMap = {};
    consumption.forEach(c => {
      consumptionMap[c.item_code] = parseFloat(c.total_issued || 0);
    });

    const stockLevels = await db("stock")
      .whereIn("item_code", itemCodes)
      .select("item_code", "unit")
      .sum("remaining as total_remaining")
      .groupBy("item_code", "unit");

    const stockMap = {};
    stockLevels.forEach(s => {
      stockMap[s.item_code] = {
        remaining: parseFloat(s.total_remaining || 0),
        unit: s.unit
      };
    });

    // "Opening Stock" (and similar) are bulk-import placeholders for the
    // opening balance — not real vendors. Never surface them as a supplier
    // recommendation or WhatsApp target.
    const PLACEHOLDER_SUPPLIERS = ["opening stock", "unknown", "n/a", "none"];
    const purchases = await db("stock")
      .whereIn("item_code", itemCodes)
      .whereNotNull("supplier")
      .whereNotNull("price")
      .where("price", ">", 0)
      .whereNotIn(db.raw("LOWER(supplier)"), PLACEHOLDER_SUPPLIERS)
      .select("item_code", "supplier", "price")
      .orderBy("price", "asc");

    const supplierComparisonMap = {};
    purchases.forEach(p => {
      if (!supplierComparisonMap[p.item_code]) {
        supplierComparisonMap[p.item_code] = [];
      }
      if (!supplierComparisonMap[p.item_code].some(item => item.supplier.toLowerCase() === p.supplier.toLowerCase())) {
        supplierComparisonMap[p.item_code].push({
          supplier: p.supplier,
          price: parseFloat(p.price)
        });
      }
    });

    const predictions = points.map(p => {
      const stockInfo = stockMap[p.item_code] || { remaining: 0, unit: "kg" };
      const currentStock = stockInfo.remaining;
      const unit = stockInfo.unit || "kg";
      
      const totalIssued14 = consumptionMap[p.item_code] || 0;
      const velocity = totalIssued14 / 14;

      let daysToOut = 999;
      if (currentStock <= 0) {
        daysToOut = 0;
      } else if (velocity > 0) {
        daysToOut = parseFloat((currentStock / velocity).toFixed(1));
      }

      const comparisons = supplierComparisonMap[p.item_code] || [];
      const cheapestSupplier = comparisons[0] || null;

      const hasRealSupplier = !!(p.preferred_supplier_name || cheapestSupplier);
      let recommendedSupplierName = p.preferred_supplier_name || (cheapestSupplier ? cheapestSupplier.supplier : null);
      let recommendedSupplierPhone = p.preferred_supplier_phone || "";
      let recommendedPrice = cheapestSupplier ? cheapestSupplier.price : null;
      const reorderQty = p.reorder_qty || 50;

      // No real supplier on record (or no phone) — don't generate a dead wa.me link,
      // the UI should prompt "add supplier" instead of opening a blank chat.
      const canWhatsApp = hasRealSupplier && !!recommendedSupplierPhone.replace(/[^0-9]/g, "");
      const waText = `Hi ${recommendedSupplierName}, please supply the following item for Hotel Kapila:\n- ${p.name} (${p.item_code}): ${reorderQty} ${unit}\n\nPlease confirm delivery date. Thank you!`;
      const waLink = canWhatsApp
        ? `https://wa.me/${recommendedSupplierPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waText)}`
        : null;

      return {
        id: p.id,
        item_code: p.item_code,
        name: p.name,
        current_stock: currentStock,
        unit,
        velocity: parseFloat(velocity.toFixed(2)),
        days_to_out: daysToOut,
        min_qty: p.min_qty,
        reorder_qty: reorderQty,
        comparisons,
        cheapest_supplier: cheapestSupplier,
        recommended_supplier: recommendedSupplierName,
        has_real_supplier: hasRealSupplier,
        recommended_price: recommendedPrice,
        wa_link: waLink,
        needs_reorder: daysToOut <= 3 || currentStock <= p.min_qty
      };
    });

    const sorted = predictions.sort((a, b) => a.days_to_out - b.days_to_out);
    res.json({ success: true, data: sorted });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, alerts, predictive };
