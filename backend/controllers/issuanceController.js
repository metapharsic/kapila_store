const db = require("../db");
const { applyDepartmentScope, assertDepartmentAccess } = require("../services/permissionService");
const { getConversionMultiplier, normalizeUnit } = require("../utils/units");
const { auditLog } = require("../services/auditService");
const { publish } = require("../services/kafkaProducer");
const stockLedgerService = require("../services/stockLedgerService");

// GET /api/issuances
// Query params: dept, date_from, date_to, scanned, q, page, limit, sort, order
async function list(req, res, next) {
  try {
    const { dept, date_from, date_to, scanned, q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const filter = (qb) => {
      if (dept)      qb.where("issuances.dept", dept);
      if (date_from) qb.where("issuances.date", ">=", date_from);
      if (date_to)   qb.where("issuances.date", "<=", date_to);
      if (scanned !== undefined) qb.where("issuances.scanned", scanned === "true");
      if (q) {
        qb.whereIn("issuances.id", db("issuance_items")
          .select("issuance_id")
          .whereRaw("search_vec @@ plainto_tsquery('english', ?)", [q]));
      }
    };

    const countQuery = db("issuances").modify(filter);
    await applyDepartmentScope(countQuery, req.user, "issuances.dept");
    const [{ count }] = await countQuery.count("issuances.id as count");
    const listQuery = db("issuances").modify(filter);
    await applyDepartmentScope(listQuery, req.user, "issuances.dept");
    const issuances = await listQuery
      .select("issuances.*", db.raw("COALESCE(indents.indent_type, 'routine') as indent_type"))
      .leftJoin("indents", "issuances.indent_id", "indents.id")
      .orderBy(`issuances.${sort}`, order).orderBy("issuances.id", "desc")
      .offset(offset).limit(limit);

    const ids = issuances.map((i) => i.id);
    const items = ids.length ? await db("issuance_items").whereIn("issuance_id", ids) : [];

    const data = issuances.map((iss) => ({
      ...iss,
      items: items.filter((it) => it.issuance_id === iss.id),
    }));

    res.json({ success: true, data, total: parseInt(count), page: req.pagination.page, limit });
  } catch (err) { next(err); }
}


// POST /api/issuances  — atomic: create issuance + deduct stock + mark indent issued
async function create(req, res, next) {
  try {
    const { indent_id, production_plan_id, dept, date, scanned = false, items, dispatch_strategy = "LIFO" } = req.body;

    if (!indent_id && !production_plan_id) {
      return res.status(400).json({ success: false, error: "Issuance must be linked to either a valid Indent ID or a Production Plan ID to prevent ghost draws." });
    }

    const deptExists = await db("departments").whereRaw("LOWER(name) = LOWER(?)", [dept.trim()]).first();
    if (!deptExists) {
      return res.status(400).json({ success: false, error: `Department '${dept}' does not exist.` });
    }
    await assertDepartmentAccess(req.user, deptExists.name);

    // Budget control is per-item trend-based (see real-time anomaly flag
    // below, after insert) rather than a hard dept-wide monthly cap — a
    // legit large order for one dept must never get blocked outright.
    // Flags a concern instead of rejecting the issuance.

    const issuance = await db.transaction(async (trx) => {
      if (indent_id) {
        const indent = await trx("indents").where("id", indent_id).forUpdate().first();
        if (!indent) {
          throw new Error(`Indent #${indent_id} does not exist.`);
        }
        if (indent.status !== "approved" && indent.status !== "partial") {
          throw new Error(`Indent #${indent_id} is in '${indent.status}' status. Only approved or partial indents can be issued.`);
        }
      }

      if (production_plan_id) {
        const plan = await trx("production_plans").where("id", production_plan_id).first();
        if (!plan) {
          throw new Error(`Production Plan #${production_plan_id} does not exist.`);
        }
      }

      const [iss] = await trx("issuances")
        .insert({ indent_id: indent_id || null, production_plan_id: production_plan_id || null, dept: deptExists.name, date, scanned })
        .returning("*");

      const issItems = items.map((it) => ({
        issuance_id: iss.id,
        name: it.name,
        qty: it.qty,
        issued: it.issued,
        unit: it.unit,
        item_code: it.item_code,
        unit_price: parseFloat(it.unit_price) || 0.00,
      }));
      const savedItems = await trx("issuance_items").insert(issItems).returning("*");

      // Deduct stock using FIFO logic
      for (const it of items) {
        let toDeduct = parseFloat(it.issued);
        if (toDeduct <= 0) continue;

        const isLIFO = (dispatch_strategy || "").toUpperCase() === "LIFO" || (it.dispatch_strategy || "").toUpperCase() === "LIFO";

        // Query active stock batches. If specific batch is provided by Store Manager LIFO selection, prioritize it.
        let batchesQuery = trx("stock")
          .where((qb) => {
            if (it.stock_id) qb.where("id", it.stock_id);
            else if (it.batch_id) qb.where("id", it.batch_id);
            else if (it.item_code) qb.where("item_code", it.item_code);
            else qb.whereRaw("LOWER(name) = LOWER(?)", [it.name]);
          })
          .andWhere("remaining", ">", 0)
          .andWhere((qb) => {
            qb.whereNull("expiry_date").orWhere("expiry_date", ">=", date);
          });

        if (isLIFO) {
          // LIFO: newest inward batches drain first
          batchesQuery = batchesQuery
            .orderBy("date", "desc")
            .orderBy("id", "desc");
        } else {
          // FIFO / FEFO: soonest expiry drains first, tiebreak oldest date
          batchesQuery = batchesQuery
            .orderByRaw("expiry_date ASC NULLS LAST")
            .orderBy("date", "asc")
            .orderBy("id", "asc");
        }

        let batches = await batchesQuery.forUpdate();

        // Fallback: if specific batch didn't satisfy full toDeduct, fetch remaining batches for item
        if (batches.length > 0 && (it.stock_id || it.batch_id)) {
          const batchSum = batches.reduce((acc, b) => acc + parseFloat(b.remaining || 0), 0);
          if (batchSum < toDeduct) {
            const extraBatches = await trx("stock")
              .where((qb) => {
                if (it.item_code) qb.where("item_code", it.item_code);
                else qb.whereRaw("LOWER(name) = LOWER(?)", [it.name]);
              })
              .whereNotIn("id", batches.map(b => b.id))
              .andWhere("remaining", ">", 0)
              .andWhere((qb) => {
                qb.whereNull("expiry_date").orWhere("expiry_date", ">=", date);
              })
              .orderBy("date", isLIFO ? "desc" : "asc")
              .orderBy("id", isLIFO ? "desc" : "asc")
              .forUpdate();
            batches = [...batches, ...extraBatches];
          }
        }

        if (batches.length === 0) {
          // If this is a direct/fresh produce or newly-requested item without warehouse batches, record issuance without batch deduction
          if (!it.item_code || it.item_code === "KPL-NEW") {
            console.warn(`[Issuance] Non-stock / direct fresh item '${it.name}' (${it.item_code}) issued without stock batch deduction.`);
            continue;
          }
          throw new Error(`Insufficient stock for '${it.name}'. Requested: ${toDeduct} ${it.unit || "units"}, no batches available.`);
        }

        const stockUnit = batches[0].unit || "kg";
        let multiplier = getConversionMultiplier(it.unit || stockUnit, stockUnit, it.name);
        if (multiplier === null) {
          if (normalizeUnit(it.unit) === normalizeUnit(stockUnit)) {
            multiplier = 1;
          } else {
            throw new Error(`Cannot issue '${it.name}' with unit '${it.unit}': incompatible with stock unit '${stockUnit}'. Please select a compatible unit.`);
          }
        }


        toDeduct = toDeduct * multiplier;

        const totalAvailable = batches.reduce((sum, b) => sum + parseFloat(b.remaining), 0);
        if (totalAvailable < toDeduct) {
          throw new Error(`Insufficient stock for '${it.name}'. Requested: ${parseFloat(it.issued)} ${it.unit || stockUnit} (${toDeduct.toFixed(2)} ${stockUnit}), Available: ${totalAvailable} ${stockUnit}`);
        }

        for (const batch of batches) {
          if (toDeduct <= 0) break;
          const rem = parseFloat(batch.remaining);
          const deductFromThis = rem >= toDeduct ? toDeduct : rem;

          if (rem >= toDeduct) {
            // Deplete this batch and finish
            await trx("stock")
              .where("id", batch.id)
              .update({ remaining: rem - toDeduct });
            toDeduct = 0;
          } else {
            // Fully consume this batch and continue
            await trx("stock")
              .where("id", batch.id)
              .update({ remaining: 0 });
            toDeduct -= rem;
          }

          // Record atomic double-entry stock ledger deduction
          await stockLedgerService.recordEntry(trx, {
            stock_id: batch.id,
            item_code: batch.item_code || it.item_code,
            item_name: it.name,
            category: batch.category,
            transaction_type: "OUTWARD_ISSUE",
            qty: deductFromThis,
            unit: batch.unit || stockUnit,
            unit_price: parseFloat(batch.price) || 0,
            total_value: Math.round(deductFromThis * (parseFloat(batch.price) || 0) * 100) / 100,
            batch_no: batch.batch_no,
            department: dept,
            supplier: batch.supplier,
            reference_doc_type: "ISSUE",
            reference_doc_id: iss.id,
            reference_doc_no: `ISS-${iss.id}`,
            reason: indent_id ? `Issued against Indent #${indent_id}` : `Issued against Plan #${production_plan_id}`,
            notes: `Issued to ${dept}`,
            created_by: req.user?.name || "Storekeeper"
          });
        }
      }

      // Update linked indent logic for partial issuances — original requested qty
      // is kept intact for audit; only issued_qty accumulates.
      if (indent_id) {
        for (const it of items) {
          const issuedQty = parseFloat(it.issued);
          if (issuedQty > 0) {
            const indentItem = await trx("indent_items")
              .where("indent_id", indent_id)
              .where((qb) => {
                if (it.item_code) {
                  qb.where("item_code", it.item_code);
                } else {
                  qb.whereRaw("LOWER(TRIM(name)) = LOWER(TRIM(?))", [it.name]);
                }
              })
              .first();
            if (indentItem) {
              const newIssued = Math.min(
                parseFloat(indentItem.qty),
                parseFloat(indentItem.issued_qty || 0) + issuedQty
              );
              await trx("indent_items").where("id", indentItem.id).update({ issued_qty: newIssued });
            }
          }
        }

        const allItems = await trx("indent_items").where("indent_id", indent_id);
        const fullyIssued = allItems.length > 0 &&
          allItems.every((i) => parseFloat(i.issued_qty || 0) >= parseFloat(i.qty));
        const anyIssued = allItems.some((i) => parseFloat(i.issued_qty || 0) > 0);
        const nextStatus = fullyIssued ? "issued" : anyIssued ? "partial" : null;
        if (nextStatus) {
          await trx("indents").where("id", indent_id).update({ status: nextStatus });
        }
      }

      return { ...iss, items: savedItems };
    });

    await auditLog(req, { action: "issuances.create", resource: "issuances", resourceId: issuance.id, after: issuance });

    const { checkHighValueAlert } = require("../utils/highValueAlert");
    checkHighValueAlert({
      module: "issuance",
      id: issuance.id,
      dept: issuance.dept,
      creatorUserId: req.user.id,
      lineItems: issuance.items.map((it) => ({
        name: it.name,
        qty: parseFloat(it.issued) || 0,
        value: (parseFloat(it.issued) || 0) * (parseFloat(it.unit_price) || 0),
      })),
      occurredAt: new Date(issuance.created_at || Date.now()),
    });

    // AI-standard enhancement #2: real-time anomaly flag, not just the
    // nightly cron (cron/anomalyDetector.js). Reuses its same threshold
    // logic so "suspicious" means the same thing in both places. Flags only
    // — never blocks the issuance, since a false positive must never trap
    // a legitimate large order (same non-blocking principle as the FEFO fix).
    const anomalies = [];
    try {
      const { getThreshold } = require("../cron/anomalyDetector");
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      for (const it of issuance.items) {
        const issuedQty = parseFloat(it.issued);
        if (issuedQty <= 0) continue;

        const baseline = await db("issuance_items as ii")
          .join("issuances as i", "i.id", "ii.issuance_id")
          .where("i.dept", issuance.dept)
          .andWhere("ii.name", it.name)
          .andWhere("i.date", ">=", sevenDaysAgo)
          .andWhere("i.date", "<", issuance.date)
          .avg("ii.issued as avg_issued")
          .count("ii.id as sample_count")
          .first();

        const avgIssued = parseFloat(baseline?.avg_issued) || 0;
        const sampleCount = parseInt(baseline?.sample_count || 0, 10);
        if (sampleCount < 2 || avgIssued <= 0) continue; // not enough history to judge

        const threshold = getThreshold(issuance.dept, it.name);
        if (issuedQty > avgIssued * threshold) {
          const spikePct = (((issuedQty / avgIssued) - 1) * 100).toFixed(1);
          anomalies.push({ item: it.name, issued: issuedQty, baseline_avg: avgIssued, spike_pct: parseFloat(spikePct) });

          await db("anomaly_alerts").insert({
            item: it.name,
            department: issuance.dept,
            date: issuance.date,
            baseline_ratio: avgIssued,
            current_ratio: issuedQty,
            severity: "Critical",
            description: `Real-time flag on issuance #${issuance.id}: ${it.name} issued ${issuedQty} vs 7-day avg ${avgIssued.toFixed(2)} (+${spikePct}%).`,
            status: "UNREAD",
          });

          publish("issuance-events", {
            type: "issuance.anomaly",
            issuance_id: issuance.id,
            dept: issuance.dept,
            item: it.name,
            issued: issuedQty,
            baseline_avg: avgIssued,
            spike_pct: parseFloat(spikePct),
          });
        }
      }
    } catch (anomalyErr) {
      console.error("[Issuance] Real-time anomaly check failed (non-blocking):", anomalyErr.message);
    }

    // Kafka is the sync bus — kafkaConsumer.js reacts to this event and runs
    // the reorder-breach check itself, decoupled from this request. If the
    // broker is unreachable, publish() returns false and we fall back to
    // running the check in-process so a downed broker never silently
    // disables auto-PO drafting.
    const eventItems = items.map((it) => ({ name: it.name, qty: parseFloat(it.issued) || 0 }));
    publish("issuance-events", {
      type: "issuance.create",
      id: issuance.id,
      dept: issuance.dept,
      indent_id: issuance.indent_id,
      items: eventItems,
      creator_user_id: req.user.id,
    }).then((delivered) => {
      if (!delivered) {
        const { checkAndDraftReorderPOs } = require("../services/reorderAutoPO");
        checkAndDraftReorderPOs(eventItems, `issuance #${issuance.id} (Kafka fallback)`, req.user.id).catch(() => {});
      }
    });

    res.status(201).json({ success: true, data: issuance, anomalies });
  } catch (err) { next(err); }
}

// DELETE /api/issuances/:id
async function remove(req, res, next) {
  try {
    const iss = await db("issuances").where("id", req.params.id).first();
    if (!iss) return res.status(404).json({ success: false, error: "Not found" });

    await assertDepartmentAccess(req.user, iss.dept);

    await db.transaction(async (trx) => {
      const items = await trx("issuance_items").where("issuance_id", iss.id);

      // Revert stock
      for (const it of items) {
        let toRevert = parseFloat(it.issued);
        if (toRevert <= 0) continue;

        // Try to find the newest batch for this item to add back the stock
        const lastBatch = await trx("stock")
          .whereRaw("LOWER(name) = LOWER(?)", [it.name])
          .orderBy("date", "desc")
          .orderBy("id", "desc")
          .first();

        if (lastBatch) {
          const multiplier = getConversionMultiplier(it.unit || lastBatch.unit, lastBatch.unit);
          if (multiplier !== null) {
            toRevert = toRevert * multiplier;
          }
          await trx("stock")
            .where("id", lastBatch.id)
            .update({ remaining: parseFloat(lastBatch.remaining) + toRevert });
        } else {
          // If no batch exists, we should recreate one, but ideally they exist.
          // Let's create a generic batch
          const todayStr = new Date().toISOString().slice(0, 10);
          await trx("stock").insert({
            name: it.name,
            qty: toRevert,
            remaining: toRevert,
            unit: it.unit,
            date: todayStr,
            item_code: it.item_code || "KPL-NEW",
          });
        }
      }

      // Revert indent if linked
      if (iss.indent_id) {
        await trx("indents").where("id", iss.indent_id).update({ status: "pending" });

        for (const it of items) {
          const toRevert = parseFloat(it.issued);
          if (toRevert <= 0) continue;

          const existingIndentItem = await trx("indent_items")
            .where({ indent_id: iss.indent_id, name: it.name })
            .first();

          if (existingIndentItem) {
            await trx("indent_items")
              .where("id", existingIndentItem.id)
              .update({ qty: parseFloat(existingIndentItem.qty) + toRevert });
          } else {
            await trx("indent_items").insert({
              indent_id: iss.indent_id,
              name: it.name,
              qty: toRevert,
              unit: it.unit,
              item_code: it.item_code
            });
          }
        }
      }

      await trx("issuance_items").where("issuance_id", iss.id).delete();
      await trx("issuances").where("id", iss.id).delete();
    });

    publish("issuance-events", {
      type: "issuance.delete",
      id: iss.id,
      dept: iss.dept,
      indent_id: iss.indent_id,
    });

    await auditLog(req, { action: "issuances.delete", resource: "issuances", resourceId: iss.id, before: iss });
    res.json({ success: true, message: "Issuance deleted and stock reverted." });
  } catch (err) { next(err); }
}

async function bulkPreview(req, res, next) {
  try {
    const indents = await db("indents")
      .where("status", "approved")
      .select("*")
      .orderBy("created_at", "desc");

    const indentIds = indents.map(i => i.id);
    const indentItems = indentIds.length
      ? await db("indent_items").whereIn("indent_id", indentIds).select("*")
      : [];

    const uniqueNames = [...new Set(indentItems.map(it => it.name.toLowerCase()))];
    const stock = uniqueNames.length
      ? await db("stock")
          .whereIn(db.raw("LOWER(name)"), uniqueNames)
          .andWhere("remaining", ">", 0)
          .select("name", "remaining", "unit")
      : [];

    const stockMap = {};
    stock.forEach(s => {
      const key = s.name.toLowerCase();
      if (!stockMap[key]) stockMap[key] = { remaining: 0, unit: s.unit };
      stockMap[key].remaining += parseFloat(s.remaining);
    });

    const itemTotals = {};
    indentItems.forEach(it => {
      const key = it.name.toLowerCase();
      if (!itemTotals[key]) {
        itemTotals[key] = { name: it.name, requested: 0, available: stockMap[key]?.remaining || 0, unit: it.unit };
      }
      itemTotals[key].requested += parseFloat(it.qty);
    });

    const shortfalls = Object.values(itemTotals).filter(t => t.requested > t.available);

    const indentsEnriched = indents.map(ind => ({
      ...ind,
      items: indentItems.filter(it => it.indent_id === ind.id)
    }));

    res.json({
      success: true,
      data: {
        indents: indentsEnriched,
        shortfalls
      }
    });
  } catch (err) {
    next(err);
  }
}

async function bulkIssue(req, res, next) {
  try {
    const { indentIds, dispatch_strategy = "LIFO" } = req.body;
    if (!indentIds || !Array.isArray(indentIds) || indentIds.length === 0) {
      return res.status(400).json({ success: false, error: "indentIds must be a non-empty array." });
    }

    const today = new Date().toISOString().slice(0, 10);
    let totalIssuedIndents = 0;

    await db.transaction(async (trx) => {
      const indents = await trx("indents").whereIn("id", indentIds).andWhere("status", "approved").forUpdate();
      if (indents.length !== indentIds.length) {
        throw new Error("One or more selected indents are not in approved status or do not exist.");
      }

      totalIssuedIndents = indents.length;
      const indentItems = await trx("indent_items").whereIn("indent_id", indentIds);

      // Canonical grouping key: item_code when present (reliable), else name.
      // OCR names drift from stock names, so item_code is the trustworthy join.
      const keyOf = (it) => it.item_code || `name:${(it.name || "").toLowerCase()}`;
      const codes = [...new Set(indentItems.map(it => it.item_code).filter(Boolean))];
      const names = [...new Set(indentItems.filter(it => !it.item_code).map(it => it.name.toLowerCase()))];

      const stockQuery = (codes.length || names.length)
        ? trx("stock")
            .where((qb) => {
              if (codes.length) qb.orWhereIn("item_code", codes);
              if (names.length) qb.orWhereIn(trx.raw("LOWER(name)"), names);
            })
            .andWhere("remaining", ">", 0)
            .andWhere((qb) => {
              qb.whereNull("expiry_date").orWhere("expiry_date", ">=", today);
            })
            .select("id", "name", "item_code", "remaining", "unit", "price", "date")
        : null;

      let stock = [];
      if (stockQuery) {
        if (dispatch_strategy === "LIFO") {
          stock = await stockQuery
            .orderBy("date", "desc")
            .orderBy("id", "desc")
            .forUpdate();
        } else {
          stock = await stockQuery
            .orderByRaw("expiry_date ASC NULLS LAST")
            .orderBy("date", "asc")
            .orderBy("id", "asc")
            .forUpdate();
        }
      }

      const stockByItem = {};
      stock.forEach(s => {
        // index each batch under both its code and its name so either key resolves it
        const keys = [s.item_code, `name:${(s.name || "").toLowerCase()}`].filter(Boolean);
        keys.forEach(k => {
          if (!stockByItem[k]) stockByItem[k] = [];
          if (!stockByItem[k].includes(s)) stockByItem[k].push(s);
        });
      });

      const itemTotals = {};
      indentItems.forEach(it => {
        const key = keyOf(it);
        if (!itemTotals[key]) itemTotals[key] = 0;
        itemTotals[key] += parseFloat(it.qty);
      });

      const allocationFactors = {};
      Object.keys(itemTotals).forEach(key => {
        const available = (stockByItem[key] || []).reduce((sum, b) => sum + parseFloat(b.remaining), 0);
        const requested = itemTotals[key] || 0;
        allocationFactors[key] = requested > 0 ? Math.min(1, available / requested) : 1;
      });

      for (const ind of indents) {
        const itemsToIssue = indentItems.filter(it => it.indent_id === ind.id);
        const [iss] = await trx("issuances")
          .insert({ indent_id: ind.id, dept: ind.dept, date: today, scanned: false })
          .returning("*");

        const issRows = [];
        for (const it of itemsToIssue) {
          const key = keyOf(it);
          const factor = allocationFactors[key] || 1;
          const issuedQty = Math.round(parseFloat(it.qty) * factor * 100) / 100;

          issRows.push({
            issuance_id: iss.id,
            name: it.name,
            qty: it.qty,
            issued: issuedQty,
            unit: it.unit,
            item_code: it.item_code,
            unit_price: 0
          });

          // FIFO Stock deduction — convert indent unit → stock unit first
          const batches = stockByItem[key] || [];
          const stockUnit = batches.length ? (batches[0].unit || "kg") : (it.unit || "kg");
          let multiplier = getConversionMultiplier(it.unit || stockUnit, stockUnit, it.name);
          if (multiplier === null) {
            if (normalizeUnit(it.unit) === normalizeUnit(stockUnit)) {
              multiplier = 1;
            } else {
              console.warn(`[Issuance] Incompatible unit '${it.unit}' for '${it.name}' (stock unit: '${stockUnit}'). Defaulting to 1:1.`);
              multiplier = 1;
            }
          }
          let toDeduct = issuedQty * multiplier;
          for (const batch of batches) {
            if (toDeduct <= 0) break;
            const rem = parseFloat(batch.remaining);
            const deductFromThis = rem >= toDeduct ? toDeduct : rem;

            if (rem >= toDeduct) {
              await trx("stock").where("id", batch.id).update({ remaining: rem - toDeduct });
              batch.remaining = rem - toDeduct;
              toDeduct = 0;
            } else {
              await trx("stock").where("id", batch.id).update({ remaining: 0 });
              batch.remaining = 0;
              toDeduct -= rem;
            }

            await stockLedgerService.recordEntry(trx, {
              stock_id: batch.id,
              item_code: batch.item_code || it.item_code,
              item_name: it.name,
              category: batch.category,
              transaction_type: "OUTWARD_ISSUE",
              qty: deductFromThis,
              unit: batch.unit || stockUnit,
              unit_price: parseFloat(batch.price) || 0,
              total_value: Math.round(deductFromThis * (parseFloat(batch.price) || 0) * 100) / 100,
              batch_no: batch.batch_no,
              department: ind.dept,
              supplier: batch.supplier,
              reference_doc_type: "ISSUE",
              reference_doc_id: iss.id,
              reference_doc_no: `ISS-${iss.id}`,
              reason: `Bulk issue against Indent #${ind.id}`,
              notes: `Bulk department issue to ${ind.dept}`,
              created_by: req.user?.name || "Storekeeper"
            });
          }
        }

        if (issRows.length > 0) {
          await trx("issuance_items").insert(issRows);
        }

        await trx("indents").where("id", ind.id).update({ status: "issued" });

        const eventItems = itemsToIssue.map((it) => ({ name: it.name, qty: parseFloat(it.qty) || 0 }));
        publish("issuance-events", {
          type: "issuance.create",
          id: iss.id,
          dept: iss.dept,
          indent_id: ind.id,
          items: eventItems,
          creator_user_id: req.user.id,
        }).then((delivered) => {
          if (!delivered) {
            const { checkAndDraftReorderPOs } = require("../services/reorderAutoPO");
            checkAndDraftReorderPOs(eventItems, `issuance #${iss.id} (bulk, Kafka fallback)`, req.user.id).catch(() => {});
          }
        });
      }
    });

    res.json({ success: true, message: `Successfully issued ${totalIssuedIndents} indents in bulk.` });
  } catch (err) {
    next(err);
  }
}

async function validatePhoto(req, res, next) {
  try {
    const { image, mimeType = "image/jpeg", items } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "Base64 image data is required." });
    }
    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: "Items array is required for validation comparison." });
    }

    const { validateIssuancePhoto } = require("../services/localAI");
    const result = await validateIssuancePhoto(image, mimeType, items);

    if (!result.matches) {
      const { publish } = require("../services/kafkaProducer");
      publish("issuance-events", { 
        type: "issuance.photo_mismatch", 
        items, 
        mismatches: result.mismatches, 
        confidence: result.confidence,
        creator_user_id: req.user.id 
      }).catch(e => console.error("Failed to publish Kafka photo mismatch event:", e.message));
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove, bulkPreview, bulkIssue, validatePhoto };
