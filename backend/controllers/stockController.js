const db = require("../db");
const { normalizeUnit, CANONICAL_UNITS, getConversionMultiplier } = require("../utils/units");
const { auditLog } = require("../services/auditService");
const { sendNotification } = require("./notificationController");
const { publish } = require("../services/kafkaProducer");
const stockLedgerService = require("../services/stockLedgerService");

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
    const { name, unit, date_from, date_to, low_stock, q, supplier, expiry_status, active_only, category, storage_zone } = req.query || {};
    const pagination = req.pagination || {};
    const offset = pagination.offset ?? 0;
    const limit = pagination.limit ?? 20;
    const sort = pagination.sort || "created_at";
    const order = pagination.order || "desc";
    const page = pagination.page || 1;

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
      if (storage_zone) qb.where("storage_zone", storage_zone);
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
               .orWhereILike("item_code", `%${q}%`)
               .orWhereILike("rack_location", `%${q}%`)
               .orWhereILike("storage_zone", `%${q}%`)
               .orWhereILike("invoice_no", `%${q}%`)
               .orWhereILike("batch_no", `%${q}%`);
        });
      }
    };

    let query = db("stock").select(
      "id", "name", "qty", "remaining", "unit", "date", "created_at", "price", "supplier", "expiry_date", "min_alert_qty", "item_code", "category",
      "rack_location", "storage_zone", "invoice_no", "purchase_time", "batch_no", "pack_size",
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
    const {
      name, qty, unit, date, price, supplier, expiry_date, min_alert_qty, category,
      rack_location, storage_zone, invoice_no, batch_no, purchase_time, supplier_id, notes, pack_size
    } = req.body;

    // Check if item name already has an item_code
    let item_code;
    const existing = await db("stock")
      .whereRaw("LOWER(name) = LOWER(?)", [name.trim()])
      .select("item_code", "unit")
      .first();
      
    if (existing) {
      item_code = existing.item_code;
      if (existing.unit) {
        const { areUnitsCompatible } = require("../utils/units");
        if (!areUnitsCompatible(unit, existing.unit, name)) {
          return res.status(400).json({
            success: false,
            error: `Unit '${unit}' is dimensionally incompatible with existing stock unit '${existing.unit}' for '${name}'.`
          });
        }
      }
    } else if (req.body.item_code && req.body.item_code.trim()) {
      item_code = req.body.item_code.trim().toUpperCase();
    } else {
      // Find maximum item code in database to generate the next one
      const maxRow = await db("stock")
        .whereRaw("item_code ~ '^KPL-[0-9]+$'")
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

    const todayStr = date || new Date().toISOString().slice(0, 10);
    const nowTime = purchase_time || new Date().toISOString();
    const finalBatchNo = batch_no && batch_no.trim() ? batch_no.trim() : `BAT-${item_code}-${Date.now().toString().slice(-6)}`;
    const finalZone = storage_zone && storage_zone.trim() ? storage_zone.trim() : "General Store & Provisions";
    const finalRack = rack_location && rack_location.trim() ? rack_location.trim() : "Unassigned Rack";
    const finalInvoice = invoice_no && invoice_no.trim() ? invoice_no.trim() : (supplier ? `INV-${(supplier.slice(0, 3)).toUpperCase()}-${Date.now().toString().slice(-6)}` : null);

    const row = await db.transaction(async (trx) => {
      const [newRow] = await trx("stock").insert({
        name: name.trim(),
        qty: parseFloat(qty),
        remaining: parseFloat(qty),
        unit,
        date: todayStr,
        price: parseFloat(price) || 0,
        supplier: supplier ? supplier.trim() : null,
        supplier_id: supplier_id ? parseInt(supplier_id, 10) : null,
        expiry_date: expiry_date || null,
        min_alert_qty: min_alert_qty !== null && min_alert_qty !== undefined && min_alert_qty !== "" ? parseFloat(min_alert_qty) : null,
        item_code,
        category: category || null,
        rack_location: finalRack,
        storage_zone: finalZone,
        invoice_no: finalInvoice,
        batch_no: finalBatchNo,
        purchase_time: nowTime,
        pack_size: pack_size !== undefined && pack_size !== "" ? parseFloat(pack_size) : 1.0,
      }).returning("*");

      if (parseFloat(newRow.qty) > 0) {
        await stockLedgerService.recordEntry(trx, {
          stock_id: newRow.id,
          item_code: newRow.item_code,
          item_name: newRow.name,
          category: newRow.category,
          transaction_type: "INWARD_PURCHASE",
          qty: parseFloat(newRow.qty),
          unit: newRow.unit,
          unit_price: parseFloat(newRow.price) || 0,
          total_value: Math.round((parseFloat(newRow.qty) * (parseFloat(newRow.price) || 0)) * 100) / 100,
          batch_no: newRow.batch_no,
          department: "CENTRAL STORE",
          supplier: newRow.supplier,
          invoice_no: newRow.invoice_no,
          reference_doc_type: "STOCK",
          reference_doc_id: newRow.id,
          reference_doc_no: newRow.invoice_no || `STK-${newRow.id}`,
          reason: notes ? `Direct Stock Inward: ${notes}` : "Direct Stock Inward",
          notes: notes || "New item added with opening inventory",
          created_by: req.user?.name || "Storekeeper"
        });
      }

      return newRow;
    });

    await auditLog(req, { action: "stock.create", resource: "stock", resourceId: row.id, after: row });
    publish("stock-events", { type: "stock.create", id: row.id, item_code: row.item_code, qty: row.qty });

    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
}

// PATCH /api/stock/:id
async function update(req, res, next) {
  try {
    const { remaining, min_alert_qty, reason, notes, name, unit, price, item_code, category, rack_location, storage_zone, invoice_no, supplier, expiry_date, pack_size } = req.body;

    const current = await db("stock").where("id", req.params.id).first();
    if (!current) return res.status(404).json({ success: false, error: "Not found" });

    const updates = {};
    if (min_alert_qty !== undefined) updates.min_alert_qty = min_alert_qty === null ? null : Math.max(0, parseFloat(min_alert_qty));
    if (name !== undefined) updates.name = name;
    if (unit !== undefined) {
      const { areUnitsCompatible } = require("../utils/units");
      if (!areUnitsCompatible(unit, current.unit, current.name)) {
        return res.status(400).json({
          success: false,
          error: `Cannot change unit to '${unit}': dimensionally incompatible with current stock unit '${current.unit}'.`
        });
      }
      updates.unit = unit;
    }
    if (price !== undefined) updates.price = parseFloat(price) || 0;
    if (item_code !== undefined) updates.item_code = item_code;
    if (category !== undefined) updates.category = category || null;
    if (rack_location !== undefined) updates.rack_location = rack_location || null;
    if (storage_zone !== undefined) updates.storage_zone = storage_zone || null;
    if (invoice_no !== undefined) updates.invoice_no = invoice_no || null;
    if (supplier !== undefined) updates.supplier = supplier || null;
    if (expiry_date !== undefined) updates.expiry_date = expiry_date || null;
    if (pack_size !== undefined && pack_size !== "") updates.pack_size = parseFloat(pack_size);
    
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

        await stockLedgerService.recordEntry(trx, {
          stock_id: updatedRow.id,
          item_code: updatedRow.item_code,
          item_name: updatedRow.name,
          category: updatedRow.category,
          transaction_type: delta > 0 ? "ADJUSTMENT_ADD" : "ADJUSTMENT_DEDUCT",
          qty: Math.abs(delta),
          unit: updatedRow.unit,
          unit_price: parseFloat(updatedRow.price) || 0,
          batch_no: updatedRow.batch_no,
          department: "CENTRAL STORE",
          supplier: updatedRow.supplier,
          reference_doc_type: "ADJUSTMENT",
          reference_doc_id: updatedRow.id,
          reference_doc_no: `ADJ-${updatedRow.id}`,
          reason: reason || "Audit Correction",
          notes: notes || null,
          created_by: req.user?.name || "Storekeeper"
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

    await db.transaction(async (trx) => {
      if (parseFloat(existing.remaining || 0) > 0) {
        await stockLedgerService.recordEntry(trx, {
          stock_id: existing.id,
          item_code: existing.item_code,
          item_name: existing.name,
          category: existing.category,
          transaction_type: "ADJUSTMENT_DEDUCT",
          qty: parseFloat(existing.remaining),
          unit: existing.unit,
          unit_price: parseFloat(existing.price) || 0,
          batch_no: existing.batch_no,
          department: "CENTRAL STORE",
          supplier: existing.supplier,
          reference_doc_type: "ADJUSTMENT",
          reference_doc_id: existing.id,
          reference_doc_no: `DEL-${existing.id}`,
          reason: reason || "Decommissioned from stock",
          notes: "Stock item deleted",
          created_by: req.user?.name || "Storekeeper"
        });
      }
      await trx("stock").where("id", req.params.id).delete();
    });

    await auditLog(req, { action: "stock.delete", resource: "stock", resourceId: existing.id, before: existing, metadata: { reason } });
    publish("stock-events", { type: "stock.delete", id: existing.id, item_code: existing.item_code });
    await alertAdminIfLarge(req, "Delete", existing, -(existing.remaining || 0));

    res.json({ success: true, message: "Item deleted" });
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
// Agent Auditor: creates a reconciliation_sessions record
// Agent Valuator: calculates ₹ impact per line and session totals
// Agent Veritas: flags anomalies where variance >15% of system qty or >5 units
async function reconcile(req, res, next) {
  try {
    const { items, session_name, conducted_by, notes: sessionNotes } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "Items array is required." });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const results = [];
    let surplusValue = 0, shortageValue = 0, surplusCount = 0, shortageCount = 0, matchedCount = 0;

    const sessionRow = await db("reconciliation_sessions").insert({
      session_name: session_name || `Reconciliation — ${todayStr}`,
      conducted_by: conducted_by || null,
      status: "SUBMITTED",
      notes: sessionNotes || null,
      submitted_at: new Date().toISOString(),
    }).returning("*");
    const sessionId = sessionRow[0]?.id || sessionRow[0];

    await db.transaction(async (trx) => {
      for (const item of items) {
        const { item_code, physical_qty, reason, notes } = item;
        const targetPhysical = Math.max(0, parseFloat(physical_qty));

        const activeBatches = await trx("stock")
          .where("item_code", item_code)
          .where("remaining", ">", 0)
          .orderBy("date", "asc")
          .orderBy("id", "asc");

        const totalSystem = activeBatches.reduce((sum, b) => sum + parseFloat(b.remaining), 0);
        const discrepancy = targetPhysical - totalSystem;
        const avgPrice = activeBatches.length
          ? activeBatches.reduce((s, b) => s + parseFloat(b.price || 0), 0) / activeBatches.length
          : 0;
        const valueImpact = discrepancy * avgPrice;

        // Agent Veritas anomaly check
        const anomaly = totalSystem > 0 && Math.abs(discrepancy / totalSystem) > 0.15 && Math.abs(discrepancy) > 5;

        if (Math.abs(discrepancy) < 0.0001) {
          matchedCount++;
          results.push({ item_code, discrepancy: 0, value_impact: 0, anomaly: false, status: "matched" });
          continue;
        }

        if (discrepancy < 0) {
          shortageCount++;
          shortageValue += Math.abs(valueImpact);
          let toDeduct = Math.abs(discrepancy);
          for (const batch of activeBatches) {
            if (toDeduct <= 0) break;
            const deduction = Math.min(parseFloat(batch.remaining), toDeduct);
            await trx("stock").where("id", batch.id).update({ remaining: parseFloat(batch.remaining) - deduction });
            await trx("stock_adjustments").insert({
              stock_id: batch.id,
              qty: -deduction,
              reason: reason || "Audit Correction",
              date: todayStr,
              notes: notes || `FIFO deduction of ${deduction} units during physical reconciliation.`,
              session_id: sessionId,
            });

            await stockLedgerService.recordEntry(trx, {
              stock_id: batch.id,
              item_code: batch.item_code || item_code,
              item_name: batch.name,
              category: batch.category,
              transaction_type: "ADJUSTMENT_DEDUCT",
              qty: deduction,
              unit: batch.unit,
              unit_price: parseFloat(batch.price) || 0,
              batch_no: batch.batch_no,
              department: "CENTRAL STORE",
              supplier: batch.supplier,
              reference_doc_type: "RECONCILIATION",
              reference_doc_id: sessionId,
              reference_doc_no: `REC-${sessionId}`,
              reason: reason || "Physical Count Shortage",
              notes: notes || `FIFO audit deduction of ${deduction} units during physical reconciliation session #${sessionId}.`,
              created_by: conducted_by || req.user?.name || "Stock Auditor"
            });

            toDeduct -= deduction;
          }
          results.push({ item_code, discrepancy, value_impact: valueImpact, anomaly, status: "shortage" });
        } else {
          surplusCount++;
          surplusValue += valueImpact;
          if (activeBatches.length > 0) {
            const latestBatch = activeBatches[activeBatches.length - 1];
            await trx("stock").where("id", latestBatch.id).update({ remaining: parseFloat(latestBatch.remaining) + discrepancy });
            await trx("stock_adjustments").insert({
              stock_id: latestBatch.id,
              qty: discrepancy,
              reason: reason || "Audit Correction",
              date: todayStr,
              notes: notes || `Surplus of ${discrepancy} units added during physical reconciliation.`,
              session_id: sessionId,
            });

            await stockLedgerService.recordEntry(trx, {
              stock_id: latestBatch.id,
              item_code: latestBatch.item_code || item_code,
              item_name: latestBatch.name,
              category: latestBatch.category,
              transaction_type: "ADJUSTMENT_ADD",
              qty: discrepancy,
              unit: latestBatch.unit,
              unit_price: parseFloat(latestBatch.price) || 0,
              batch_no: latestBatch.batch_no,
              department: "CENTRAL STORE",
              supplier: latestBatch.supplier,
              reference_doc_type: "RECONCILIATION",
              reference_doc_id: sessionId,
              reference_doc_no: `REC-${sessionId}`,
              reason: reason || "Physical Count Surplus",
              notes: notes || `Surplus of ${discrepancy} units added during physical reconciliation session #${sessionId}.`,
              created_by: conducted_by || req.user?.name || "Stock Auditor"
            });
          } else {
            const lastBatch = await trx("stock").where("item_code", item_code).orderBy("date", "desc").first();
            if (lastBatch) {
              const [newBatch] = await trx("stock").insert({
                name: lastBatch.name, qty: discrepancy, remaining: discrepancy, unit: lastBatch.unit,
                date: todayStr, price: lastBatch.price || 0, supplier: lastBatch.supplier || "Unknown",
                supplier_id: lastBatch.supplier_id || null, expiry_date: null,
                min_alert_qty: lastBatch.min_alert_qty, item_code,
              }).returning("*");
              await trx("stock_adjustments").insert({
                stock_id: newBatch.id, qty: discrepancy, reason: reason || "Audit Correction",
                date: todayStr, notes: notes || `Created new batch during physical reconciliation.`,
                session_id: sessionId,
              });

              await stockLedgerService.recordEntry(trx, {
                stock_id: newBatch.id,
                item_code: newBatch.item_code || item_code,
                item_name: newBatch.name,
                category: newBatch.category,
                transaction_type: "ADJUSTMENT_ADD",
                qty: discrepancy,
                unit: newBatch.unit,
                unit_price: parseFloat(newBatch.price) || 0,
                batch_no: newBatch.batch_no,
                department: "CENTRAL STORE",
                supplier: newBatch.supplier,
                reference_doc_type: "RECONCILIATION",
                reference_doc_id: sessionId,
                reference_doc_no: `REC-${sessionId}`,
                reason: reason || "Physical Count Surplus",
                notes: notes || `Created new batch for surplus of ${discrepancy} units during physical reconciliation session #${sessionId}.`,
                created_by: conducted_by || req.user?.name || "Stock Auditor"
              });
            }
          }
          results.push({ item_code, discrepancy, value_impact: valueImpact, anomaly, status: "surplus" });
        }
      }
    });

    // Update session totals
    await db("reconciliation_sessions").where("id", sessionId).update({
      item_count: items.length,
      total_surplus_value: surplusValue,
      total_shortage_value: shortageValue,
      surplus_item_count: surplusCount,
      shortage_item_count: shortageCount,
      matched_item_count: matchedCount,
    });

    res.json({
      success: true,
      message: `Reconciliation complete — ${items.length} item(s) processed.`,
      session_id: sessionId,
      summary: { surplus_items: surplusCount, shortage_items: shortageCount, matched_items: matchedCount,
        surplus_value: surplusValue, shortage_value: shortageValue, net_value: surplusValue - shortageValue },
      results,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/stock/reconcile/history
// Agent Auditor: returns paginated list of reconciliation sessions
async function getReconciliationHistory(req, res, next) {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const sessions = await db("reconciliation_sessions")
      .orderBy("created_at", "desc")
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    const total = await db("reconciliation_sessions").count("id as count").first();
    res.json({ success: true, data: sessions, total: parseInt(total.count) });
  } catch (err) { next(err); }
}

// GET /api/stock/reconcile/history/:id
// Agent Auditor: returns full item-level breakdown for one session
async function getReconciliationSession(req, res, next) {
  try {
    const { id } = req.params;
    const session = await db("reconciliation_sessions").where("id", id).first();
    if (!session) return res.status(404).json({ success: false, error: "Session not found." });
    const adjustments = await db("stock_adjustments as sa")
      .join("stock as s", "s.id", "sa.stock_id")
      .where("sa.session_id", id)
      .select(
        "sa.id", "sa.qty", "sa.reason", "sa.date", "sa.notes",
        "s.name", "s.item_code", "s.unit", "s.price"
      )
      .orderBy("sa.id", "asc");
    res.json({ success: true, session, adjustments });
  } catch (err) { next(err); }
}

// GET /api/stock/adjustments
// Agent Auditor: paginated raw adjustment ledger for Audit Trail tab
async function getAdjustmentLedger(req, res, next) {
  try {
    const { limit = 50, offset = 0, item_code, reason, date_from, date_to } = req.query;
    let q = db("stock_adjustments as sa")
      .join("stock as s", "s.id", "sa.stock_id")
      .leftJoin("reconciliation_sessions as rs", "rs.id", "sa.session_id")
      .select(
        "sa.id", "sa.qty", "sa.reason", "sa.date", "sa.notes", "sa.session_id",
        "s.name", "s.item_code", "s.unit", "s.price",
        "rs.session_name"
      )
      .orderBy("sa.id", "desc")
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    if (item_code) q = q.where("s.item_code", item_code);
    if (reason) q = q.where("sa.reason", reason);
    if (date_from) q = q.where("sa.date", ">=", date_from);
    if (date_to) q = q.where("sa.date", "<=", date_to);
    const rows = await q;
    const totalQ = db("stock_adjustments as sa")
      .join("stock as s", "s.id", "sa.stock_id");
    if (item_code) totalQ.where("s.item_code", item_code);
    if (reason) totalQ.where("sa.reason", reason);
    if (date_from) totalQ.where("sa.date", ">=", date_from);
    if (date_to) totalQ.where("sa.date", "<=", date_to);
    const total = await totalQ.count("sa.id as count").first();
    res.json({ success: true, data: rows, total: parseInt(total.count) });
  } catch (err) { next(err); }
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

// GET /api/stock/details/:id
async function getItemDetails(req, res, next) {
  try {
    const item = await db("stock").where("id", req.params.id).first();
    if (!item) return res.status(404).json({ success: false, error: "Item not found" });

    // Fetch all active and past batches for this SKU
    const batches = await db("stock")
      .where("item_code", item.item_code)
      .orderBy("date", "desc")
      .orderBy("id", "desc");

    const totalRemaining = batches.reduce((sum, b) => sum + parseFloat(b.remaining || 0), 0);
    const totalQty = batches.reduce((sum, b) => sum + parseFloat(b.qty || 0), 0);
    const totalValuation = batches.reduce((sum, b) => sum + (parseFloat(b.remaining || 0) * parseFloat(b.price || 0)), 0);

    // Supplier details if available
    let supplierDetails = null;
    if (item.supplier_id) {
      supplierDetails = await db("suppliers").where("id", item.supplier_id).first();
    } else if (item.supplier) {
      supplierDetails = await db("suppliers").whereRaw("LOWER(name) = LOWER(?)", [item.supplier.trim()]).first();
    }

    // 1. Recent issuance consumption with quantities, rate, total value, notes, and reference doc
    const rawIssuances = await db("issuance_items")
      .join("issuances", "issuance_items.issuance_id", "issuances.id")
      .where((qb) => {
        if (item.item_code) qb.where("issuance_items.item_code", item.item_code);
        else qb.whereRaw("LOWER(issuance_items.name) = LOWER(?)", [item.name.trim()]);
      })
      .select(
        "issuances.id as issuance_id",
        "issuances.dept",
        "issuances.date",
        "issuance_items.qty as requested_qty",
        "issuance_items.issued",
        "issuance_items.unit",
        "issuance_items.unit_price",
        "issuances.indent_id",
        "issuances.production_plan_id",
        "issuances.created_at"
      )
      .orderBy("issuances.date", "desc")
      .orderBy("issuances.id", "desc")
      .limit(20);

    const recentIssuances = rawIssuances.map((iss) => {
      const issuedQty = parseFloat(iss.issued !== undefined && iss.issued !== null ? iss.issued : iss.requested_qty) || 0;
      const rate = parseFloat(iss.unit_price) || parseFloat(item.price) || 0;
      const totalVal = Math.round(issuedQty * rate * 100) / 100;
      const refNote = iss.indent_id ? `Against Indent #${iss.indent_id}` : (iss.production_plan_id ? `Against Plan #${iss.production_plan_id}` : "Direct Kitchen Draw");
      return {
        ...iss,
        issued_qty: issuedQty,
        unit_price: rate,
        total_value: totalVal,
        reference_no: `ISS-${iss.issuance_id}`,
        notes: `Issued to ${iss.dept} (${refNote})`
      };
    });

    // 2. Department Indents for this item with quantity, status, value, and notes
    const rawIndents = await db("indent_items")
      .join("indents", "indent_items.indent_id", "indents.id")
      .where((qb) => {
        if (item.item_code) qb.where("indent_items.item_code", item.item_code);
        else qb.whereRaw("LOWER(indent_items.name) = LOWER(?)", [item.name.trim()]);
      })
      .select(
        "indents.id as indent_id",
        "indents.dept",
        "indents.date",
        "indents.status",
        "indents.indent_type",
        "indent_items.qty as requested_qty",
        "indent_items.issued_qty",
        "indent_items.unit",
        "indents.created_at"
      )
      .orderBy("indents.date", "desc")
      .orderBy("indents.id", "desc")
      .limit(20);

    const recentIndents = rawIndents.map((ind) => {
      const reqQty = parseFloat(ind.requested_qty) || 0;
      const rate = parseFloat(item.price) || 0;
      const totalVal = Math.round(reqQty * rate * 100) / 100;
      return {
        ...ind,
        unit_price: rate,
        estimated_value: totalVal,
        reference_no: `IND-${ind.indent_id}`,
        notes: `${ind.indent_type === "adhoc" ? "Ad-hoc urgent request" : "Nightly routine indent"} from ${ind.dept}`
      };
    });

    // 3. Complete chronological movement ledger for this SKU
    let movements = [];
    try {
      movements = await db("stock_ledger")
        .where((qb) => {
          if (item.item_code) qb.where("item_code", item.item_code);
          else qb.where("stock_id", item.id);
        })
        .orderBy("created_at", "desc")
        .limit(30);
    } catch (e) {
      console.warn("Could not query stock_ledger for item movements:", e.message);
    }

    res.json({
      success: true,
      data: {
        item,
        totalRemaining,
        totalQty,
        totalValuation,
        batchCount: batches.length,
        batches,
        supplierDetails,
        recentIssuances,
        recentIndents,
        movements,
      }
    });
  } catch (err) { next(err); }
}

// POST /api/stock/:id/append
async function appendBatch(req, res, next) {
  try {
    const { qty, price, supplier, invoice_no, batch_no, expiry_date, rack_location, storage_zone, purchase_time, date } = req.body;
    
    const baseItem = await db("stock").where("id", req.params.id).first();
    if (!baseItem) return res.status(404).json({ success: false, error: "Item not found" });

    const numericQty = Math.max(0.001, parseFloat(qty) || 0);
    const numericRate = parseFloat(price) !== undefined && !isNaN(parseFloat(price)) ? parseFloat(price) : (baseItem.price || 0);
    const todayStr = date || new Date().toISOString().slice(0, 10);
    const nowTime = purchase_time || new Date().toISOString();
    const finalBatchNo = batch_no || `BAT-${baseItem.item_code}-${Date.now().toString().slice(-6)}`;
    const finalRack = rack_location || baseItem.rack_location || "Rack A-01 / Shelf 1";
    const finalZone = storage_zone || baseItem.storage_zone || "Main Dry Store";

    const newBatch = await db.transaction(async (trx) => {
      const [batchRow] = await trx("stock").insert({
        name: baseItem.name,
        item_code: baseItem.item_code,
        category: baseItem.category,
        unit: baseItem.unit,
        qty: numericQty,
        remaining: numericQty,
        price: numericRate,
        supplier: supplier || baseItem.supplier || "Direct Vendor",
        invoice_no: invoice_no || null,
        batch_no: finalBatchNo,
        date: todayStr,
        purchase_time: nowTime,
        expiry_date: expiry_date || null,
        rack_location: finalRack,
        storage_zone: finalZone,
        min_alert_qty: baseItem.min_alert_qty,
        created_by: req.user?.id || null,
      }).returning("*");

      await stockLedgerService.recordEntry(trx, {
        stock_id: batchRow.id,
        item_code: batchRow.item_code,
        item_name: batchRow.name,
        category: batchRow.category,
        transaction_type: "INWARD_PURCHASE",
        qty: parseFloat(batchRow.qty),
        unit: batchRow.unit,
        unit_price: parseFloat(batchRow.price) || 0,
        batch_no: batchRow.batch_no,
        department: "CENTRAL STORE",
        supplier: batchRow.supplier,
        invoice_no: batchRow.invoice_no,
        reference_doc_type: "STOCK",
        reference_doc_id: batchRow.id,
        reference_doc_no: `BATCH-${batchRow.id}`,
        reason: "Inward Delivery Batch Append",
        created_by: req.user?.name || "Storekeeper"
      });

      return batchRow;
    });

    await auditLog(req, {
      action: "stock.batch_append",
      resource: "stock",
      resourceId: newBatch.id,
      after: newBatch
    });

    publish("stock-events", {
      type: "stock.append",
      id: newBatch.id,
      item_code: newBatch.item_code,
      qty: newBatch.qty,
      rack_location: newBatch.rack_location
    });

    res.status(201).json({
      success: true,
      message: `Successfully appended batch ${finalBatchNo} for ${baseItem.name}.`,
      data: newBatch
    });
  } catch (err) { next(err); }
}

// GET /api/stock/export-excel
async function exportStockExcel(req, res, next) {
  try {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Enterprise Inventory System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Available Stock Master", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 4 }]
    });

    // Fetch aggregated stock catalog
    const rows = await db("stock")
      .select(
        "item_code",
        "name",
        "category",
        "unit",
        db.raw("SUM(remaining) as total_remaining"),
        db.raw("SUM(qty) as total_received"),
        db.raw("MAX(price) as latest_price"),
        db.raw("SUM(remaining * price) as total_valuation"),
        db.raw("MAX(min_alert_qty) as reorder_level"),
        db.raw("MAX(storage_zone) as storage_zone"),
        db.raw("MAX(rack_location) as rack_location"),
        db.raw("MAX(supplier) as primary_supplier"),
        db.raw("MAX(invoice_no) as latest_invoice"),
        db.raw("MAX(date) as latest_date"),
        db.raw("MAX(purchase_time) as latest_purchase_time"),
        db.raw("MIN(expiry_date) as nearest_expiry"),
        db.raw("COUNT(id) as batch_count")
      )
      .groupBy("item_code", "name", "category", "unit")
      .orderBy("item_code", "asc");

    // Title banner
    sheet.mergeCells("A1:R1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "HOTEL KAPILA — ENTERPRISE INVENTORY & WAREHOUSE MASTER REPORT";
    titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } }; // Slate 900
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 28;

    // Subtitle / Telemetry
    sheet.mergeCells("A2:R2");
    const subCell = sheet.getCell("A2");
    const totalValuationAll = rows.reduce((s, r) => s + parseFloat(r.total_valuation || 0), 0);
    const totalUnitsAll = rows.reduce((s, r) => s + parseFloat(r.total_remaining || 0), 0);
    subCell.value = `Generated on: ${new Date().toLocaleString("en-IN")} | Total Active SKUs: ${rows.length} | Total Stock: ${totalUnitsAll.toLocaleString("en-IN", { maximumFractionDigits: 2 })} units | Valuation: ₹${totalValuationAll.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    subCell.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FFE2E8F0" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 20;

    // Blank row
    sheet.getRow(3).height = 6;

    // Headers
    const headers = [
      { header: "SL", key: "sl", width: 6 },
      { header: "SKU / Code", key: "item_code", width: 14 },
      { header: "Item Description", key: "name", width: 32 },
      { header: "Category", key: "category", width: 16 },
      { header: "Available Stock", key: "remaining", width: 16 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Rate (₹)", key: "price", width: 12 },
      { header: "Total Valuation (₹)", key: "valuation", width: 18 },
      { header: "Reorder Level", key: "reorder", width: 14 },
      { header: "Stock Health", key: "health", width: 14 },
      { header: "Storage Zone", key: "storage_zone", width: 30 },
      { header: "Rack Loading Position", key: "rack_location", width: 22 },
      { header: "Primary Vendor", key: "supplier", width: 26 },
      { header: "Invoice / Ref", key: "invoice_no", width: 16 },
      { header: "Receipt Date", key: "date", width: 14 },
      { header: "Exact Entry Timestamp", key: "purchase_time", width: 24 },
      { header: "Nearest Expiry", key: "expiry", width: 14 },
      { header: "Batches", key: "batch_count", width: 10 },
    ];

    sheet.columns = headers.map(h => ({ key: h.key, width: h.width }));

    const headerRow = sheet.getRow(4);
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h.header;
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } }; // Slate 700
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "medium", color: { argb: "FF0F172A" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF475569" } },
        right: { style: "thin", color: { argb: "FF475569" } }
      };
    });
    headerRow.height = 24;

    rows.forEach((r, idx) => {
      const rowIdx = idx + 5;
      const row = sheet.getRow(rowIdx);
      const remaining = parseFloat(r.total_remaining) || 0;
      const reorder = parseFloat(r.reorder_level) || 0;
      const price = parseFloat(r.latest_price) || 0;
      const valuation = parseFloat(r.total_valuation) || (remaining * price);

      let health = "HEALTHY";
      if (remaining <= 0) health = "DEPLETED";
      else if (remaining <= reorder) health = "LOW STOCK";

      const formattedTime = r.latest_purchase_time
        ? new Date(r.latest_purchase_time).toLocaleString("en-IN")
        : (r.latest_date || "—");

      row.values = [
        idx + 1,
        r.item_code,
        r.name,
        r.category || "General",
        remaining,
        r.unit,
        price,
        valuation,
        reorder || "—",
        health,
        r.storage_zone || "Main Dry Store",
        r.rack_location || "Rack A-01 / Shelf 1",
        r.primary_supplier || "Standard Vendor",
        r.latest_invoice || "INV-GEN",
        r.latest_date ? new Date(r.latest_date).toISOString().slice(0, 10) : "—",
        formattedTime,
        r.nearest_expiry ? new Date(r.nearest_expiry).toISOString().slice(0, 10) : "No Expiry",
        parseInt(r.batch_count, 10) || 1
      ];

      // Formatting
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).alignment = { horizontal: "center" };
      row.getCell(2).font = { bold: true };
      row.getCell(4).alignment = { horizontal: "center" };
      row.getCell(5).numFmt = "#,##0.00";
      row.getCell(5).font = { bold: true };
      row.getCell(6).alignment = { horizontal: "center" };
      row.getCell(7).numFmt = "₹#,##0.00";
      row.getCell(8).numFmt = "₹#,##0.00";
      row.getCell(8).font = { bold: true };
      row.getCell(9).alignment = { horizontal: "right" };
      row.getCell(10).alignment = { horizontal: "center" };
      row.getCell(10).font = { bold: true };
      if (health === "LOW STOCK") {
        row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        row.getCell(10).font = { bold: true, color: { argb: "FFB45309" } };
      } else if (health === "DEPLETED") {
        row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } };
        row.getCell(10).font = { bold: true, color: { argb: "FFE11D48" } };
      } else {
        row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
        row.getCell(10).font = { bold: true, color: { argb: "FF047857" } };
      }

      row.getCell(12).font = { color: { argb: "FF2563EB" }, bold: true };
      row.getCell(15).alignment = { horizontal: "center" };
      row.getCell(16).alignment = { horizontal: "center" };
      row.getCell(17).alignment = { horizontal: "center" };
      row.getCell(18).alignment = { horizontal: "center" };

      if (idx % 2 === 1) {
        for (let c = 1; c <= 18; c++) {
          if (c !== 10) {
            const cell = row.getCell(c);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          }
        }
      }

      for (let c = 1; c <= 18; c++) {
        row.getCell(c).border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      }
      row.height = 20;
    });

    const filename = `Kapila_Warehouse_Available_Stock_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
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

// GET /api/stock/ledger
async function getLedger(req, res, next) {
  try {
    const { q, type, department, supplier, item_code, date_from, date_to } = req.query || {};
    const pagination = req.pagination || { page: 1, limit: 20, offset: 0, sort: "created_at", order: "desc" };
    const result = await stockLedgerService.queryLedger(
      { q, type, department, supplier, item_code, date_from, date_to },
      pagination
    );
    res.json({
      success: true,
      data: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
      summary: result.summary
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/stock/ledger/export-excel
async function exportLedgerExcel(req, res, next) {
  try {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Enterprise Inventory System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Stock Movement Ledger", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 4 }]
    });

    const { q, type, department, supplier, item_code, date_from, date_to } = req.query || {};
    const result = await stockLedgerService.queryLedger(
      { q, type, department, supplier, item_code, date_from, date_to },
      { page: 1, limit: 10000, sort: "created_at", order: "desc" }
    );

    // Title banner
    sheet.mergeCells("A1:N1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "HOTEL KAPILA — DOUBLE-ENTRY INVENTORY & FINANCIAL STOCK LEDGER";
    titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 28;

    // Subtitle telemetry
    sheet.mergeCells("A2:N2");
    const subCell = sheet.getCell("A2");
    subCell.value = `Exported: ${new Date().toLocaleString("en-IN")} | Total Movements: ${result.total} | Inflow Value: ₹${result.summary.totalInflowValue.toFixed(2)} | Outflow Value: ₹${result.summary.totalOutflowValue.toFixed(2)}`;
    subCell.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FFE2E8F0" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 20;

    sheet.getRow(3).height = 6;

    const headers = [
      { header: "SL", key: "sl", width: 6 },
      { header: "Date & Time", key: "created_at", width: 20 },
      { header: "Transaction Type", key: "type", width: 20 },
      { header: "SKU", key: "item_code", width: 14 },
      { header: "Item Description", key: "item_name", width: 30 },
      { header: "Destination / Party", key: "party", width: 22 },
      { header: "Movement Qty", key: "qty", width: 16 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Rate (₹)", key: "price", width: 12 },
      { header: "Total Value (₹)", key: "value", width: 16 },
      { header: "Bal Before", key: "before", width: 14 },
      { header: "Bal After", key: "after", width: 14 },
      { header: "Ref Document", key: "ref_doc", width: 18 },
      { header: "User / Reason", key: "reason", width: 28 }
    ];

    const headerRow = sheet.getRow(4);
    headerRow.values = headers.map(h => h.header);
    headers.forEach((h, i) => { sheet.getColumn(i + 1).width = h.width; });
    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "medium", color: { argb: "FF0F172A" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } }
      };
    });
    headerRow.height = 24;

    result.rows.forEach((r, idx) => {
      const rowIdx = idx + 5;
      const row = sheet.getRow(rowIdx);
      const isOutflow = ["OUTWARD_ISSUE", "ADJUSTMENT_DEDUCT", "RETURN_TO_VENDOR"].includes(r.transaction_type);
      const qtySign = isOutflow ? -parseFloat(r.qty) : parseFloat(r.qty);

      row.values = [
        idx + 1,
        new Date(r.created_at).toLocaleString("en-IN"),
        r.transaction_type,
        r.item_code,
        r.item_name,
        r.department || r.supplier || "Central Store",
        qtySign,
        r.unit,
        parseFloat(r.unit_price) || 0,
        parseFloat(r.total_value) || 0,
        parseFloat(r.balance_qty_before) || 0,
        parseFloat(r.balance_qty_after) || 0,
        r.reference_doc_no || r.reference_doc_type,
        `${r.reason || ""} (${r.created_by || "System"})`.trim()
      ];

      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).alignment = { horizontal: "center" };
      row.getCell(3).alignment = { horizontal: "center" };
      row.getCell(3).font = { bold: true };
      row.getCell(4).alignment = { horizontal: "center" };
      row.getCell(7).numFmt = "#,##0.00";
      row.getCell(7).font = { bold: true, color: isOutflow ? { argb: "FFE11D48" } : { argb: "FF047857" } };
      row.getCell(8).alignment = { horizontal: "center" };
      row.getCell(9).numFmt = "₹#,##0.00";
      row.getCell(10).numFmt = "₹#,##0.00";
      row.getCell(10).font = { bold: true };
      row.getCell(11).numFmt = "#,##0.00";
      row.getCell(12).numFmt = "#,##0.00";
      row.getCell(12).font = { bold: true };
      row.getCell(13).alignment = { horizontal: "center" };

      if (idx % 2 === 1) {
        for (let c = 1; c <= 14; c++) {
          row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      }
      row.height = 20;
    });

    const filename = `Kapila_Stock_Movement_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}

// GET /api/stock/lifo-suggestions?item_code=...&name=...
async function getLIFOSuggestions(req, res, next) {
  try {
    const { item_code, name } = req.query;
    const MultiAgentInventoryService = require("../services/multiAgentInventoryService");
    const result = await MultiAgentInventoryService.getLIFOBatches({ item_code, name });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/stock/agent-status
async function getMultiAgentStatus(req, res, next) {
  try {
    const MultiAgentInventoryService = require("../services/multiAgentInventoryService");
    const status = await MultiAgentInventoryService.getMultiAgentStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

// POST /api/stock/sync-today-multi-agent
async function triggerMultiAgentSync(req, res, next) {
  try {
    const loader = require("../services/multiAgentInventoryLoader");
    const result = await loader.executeFullSync();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/stock/sync-today-status
async function getMultiAgentSyncStatus(req, res, next) {
  try {
    const loader = require("../services/multiAgentInventoryLoader");
    const status = await loader.getLiveStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  getLedger,
  exportLedgerExcel,
  getInsights,
  reconcile,
  getReconciliationHistory,
  getReconciliationSession,
  getAdjustmentLedger,
  getAvailableStock,
  getSupplierRates,
  updateItemUnit,
  createAlias,
  searchNLP,
  getSubstituteRecommendation,
  getSuggestedCategory,
  getItemDetails,
  appendBatch,
  exportStockExcel,
  getLIFOSuggestions,
  getMultiAgentStatus,
  triggerMultiAgentSync,
  getMultiAgentSyncStatus,
};

