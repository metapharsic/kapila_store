const db = require("../db");
const path = require("path");
const fs = require("fs");

// GET /api/audits
async function list(req, res, next) {
  try {
    const { status } = req.query;
    const { offset, limit, sort, order } = req.pagination || { offset: 0, limit: 10, sort: "created_at", order: "desc" };

    const filter = (qb) => {
      if (status) {
        qb.where("audit_sessions.status", status);
      }
    };

    const countQuery = db("audit_sessions").modify(filter);
    const [{ count }] = await countQuery.count("id as count");

    const rows = await db("audit_sessions")
      .leftJoin("departments", "audit_sessions.department_id", "departments.id")
      .select(
        "audit_sessions.*",
        "departments.name as department_name",
        db("audit_items")
          .count("id")
          .whereRaw("audit_session_id = audit_sessions.id")
          .as("items_count")
      )
      .modify(filter)
      .orderBy(`audit_sessions.${sort}`, order)
      .offset(offset)
      .limit(limit);

    res.json({
      success: true,
      data: rows,
      total: parseInt(count || 0, 10),
      page: req.pagination?.page || 1,
      limit
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/audits/summary
async function summary(req, res, next) {
  try {
    const openCount = await db("audit_sessions").where("status", "in_progress").count("id as count").first();
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const completedThisMonth = await db("audit_sessions")
      .where("status", "completed")
      .andWhere("created_at", ">=", firstDayOfMonth)
      .count("id as count")
      .first();
    const lastAudit = await db("audit_sessions")
      .where("status", "completed")
      .orderBy("created_at", "desc")
      .first();

    res.json({
      success: true,
      data: {
        open: parseInt(openCount?.count || 0, 10),
        completed_this_month: parseInt(completedThisMonth?.count || 0, 10),
        last_audit_date: lastAudit ? lastAudit.created_at : null
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/audits
async function create(req, res, next) {
  try {
    const { reference, auditor_name, department_id, notes } = req.body;

    // 1. Reject if another in_progress audit exists for the same department scope
    const existing = await db("audit_sessions")
      .where("status", "in_progress")
      .andWhere((qb) => {
        if (department_id === null || department_id === undefined) {
          qb.whereNull("department_id");
        } else {
          qb.where("department_id", department_id);
        }
      })
      .first();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "An audit session is already in progress for this department scope."
      });
    }

    // 2. Query stock items grouped by item_code to sum the remaining quantities
    let stockQuery = db("stock")
      .select("item_code", "name", "unit")
      .sum("remaining as total_remaining")
      .min("id as representative_id")
      .groupBy("item_code", "name", "unit");

    if (department_id) {
      const dept = await db("departments").where("id", department_id).first();
      if (!dept) {
        return res.status(404).json({ success: false, error: "Department not found" });
      }
      const templateRows = await db("indent_templates")
        .whereILike("template_name", `%${dept.name}%`)
        .select("item_name", "item_code");

      const deptItemNames = templateRows.map((t) => t.item_name.toLowerCase());
      const deptItemCodes = templateRows.map((t) => t.item_code).filter(Boolean);

      if (deptItemNames.length > 0 || deptItemCodes.length > 0) {
        stockQuery.where((qb) => {
          if (deptItemNames.length > 0) qb.whereIn(db.raw("LOWER(name)"), deptItemNames);
          if (deptItemCodes.length > 0) qb.orWhereIn("item_code", deptItemCodes);
        });
      } else {
        stockQuery.whereRaw("1 = 0");
      }
    }

    const stockItems = await stockQuery;

    // 3. Build snapshot
    const snapshot = {};
    stockItems.forEach((item) => {
      snapshot[item.item_code] = parseFloat(item.total_remaining || 0);
    });

    // 4. Save session and items
    const result = await db.transaction(async (trx) => {
      const [session] = await trx("audit_sessions")
        .insert({
          reference,
          auditor_name,
          department_id: department_id || null,
          status: "in_progress",
          snapshot: JSON.stringify(snapshot),
          notes: notes || null,
          created_by: req.user.id
        })
        .returning("*");

      const auditItems = stockItems.map((item) => ({
        audit_session_id: session.id,
        stock_item_id: item.representative_id,
        item_code: item.item_code,
        item_name: item.name,
        unit: item.unit,
        db_qty: parseFloat(item.total_remaining || 0),
        physical_qty: null,
        difference: null,
        discrepancy_reason: null,
        action: null,
        db_adjusted: false
      }));

      let insertedItems = [];
      if (auditItems.length > 0) {
        insertedItems = await trx("audit_items").insert(auditItems).returning("*");
      }

      return { ...session, items: insertedItems };
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.code === "23505" || err.message.includes("unique") || err.message.includes("UNIQUE")) {
      return res.status(400).json({ success: false, error: `Audit reference already exists.` });
    }
    next(err);
  }
}

// GET /api/audits/:id
async function getOne(req, res, next) {
  try {
    const session = await db("audit_sessions")
      .leftJoin("departments", "audit_sessions.department_id", "departments.id")
      .select("audit_sessions.*", "departments.name as department_name")
      .where("audit_sessions.id", req.params.id)
      .first();
    if (!session) {
      return res.status(404).json({ success: false, error: "Audit session not found" });
    }

    const items = await db("audit_items")
      .where("audit_session_id", session.id)
      .orderBy("item_name", "asc");

    const currentStock = await db("stock")
      .select("item_code")
      .sum("remaining as current_qty")
      .groupBy("item_code");

    const currentQtyMap = {};
    currentStock.forEach((s) => {
      currentQtyMap[s.item_code] = parseFloat(s.current_qty || 0);
    });

    let hasConcurrentChanges = false;
    const formattedItems = items.map((item) => {
      const currentQty = currentQtyMap[item.item_code] ?? 0;
      const isDifferent = Math.abs(currentQty - parseFloat(item.db_qty)) > 0.0001;
      if (isDifferent) {
        hasConcurrentChanges = true;
      }
      return {
        ...item,
        db_qty: parseFloat(item.db_qty),
        physical_qty: item.physical_qty !== null ? parseFloat(item.physical_qty) : null,
        difference: item.difference !== null ? parseFloat(item.difference) : null,
        current_qty: currentQty
      };
    });

    res.json({
      success: true,
      data: {
        ...session,
        has_concurrent_changes: hasConcurrentChanges,
        items: formattedItems
      }
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/audits/:id/items/:itemId
async function updateItem(req, res, next) {
  try {
    const session = await db("audit_sessions").where("id", req.params.id).first();
    if (!session) {
      return res.status(404).json({ success: false, error: "Audit session not found" });
    }
    if (session.status !== "in_progress") {
      return res.status(400).json({ success: false, error: `Cannot update items on a ${session.status} audit session.` });
    }

    const item = await db("audit_items")
      .where({ id: req.params.itemId, audit_session_id: session.id })
      .first();

    if (!item) {
      return res.status(404).json({ success: false, error: "Audit item not found" });
    }

    const physicalQty = parseFloat(req.body.physical_qty);
    const difference = physicalQty - parseFloat(item.db_qty);

    const [updated] = await db("audit_items")
      .where("id", item.id)
      .update({
        physical_qty: physicalQty,
        difference,
        updated_at: db.fn.now()
      })
      .returning("*");

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// POST /api/audits/:id/finalise
async function finalise(req, res, next) {
  try {
    const session = await db("audit_sessions").where("id", req.params.id).first();
    if (!session) return res.status(404).json({ success: false, error: "Audit session not found" });
    if (session.status !== "in_progress") {
      return res.status(400).json({ success: false, error: "Audit session is not in progress." });
    }

    const auditItems = await db("audit_items").where("audit_session_id", session.id);
    const missingCount = auditItems.filter((it) => it.physical_qty === null);
    if (missingCount.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Some items have not been counted yet.",
        missing_items: missingCount.map((it) => ({ id: it.id, name: it.item_name }))
      });
    }

    const { items: bodyItems } = req.body;
    const bodyItemsMap = Object.fromEntries(bodyItems.map((item) => [item.audit_item_id, item]));

    const todayStr = new Date().toISOString().slice(0, 10);
    const lowStockAlerts = [];

    await db.transaction(async (trx) => {
      for (const auditItem of auditItems) {
        const entry = bodyItemsMap[auditItem.id] || {};
        const discrepancyReason = entry.discrepancy_reason || "";
        const action = entry.action || null;

        // 1. Update action and reason
        await trx("audit_items")
          .where("id", auditItem.id)
          .update({
            discrepancy_reason: discrepancyReason || null,
            action: action || null
          });

        const diff = parseFloat(auditItem.difference || 0);

        // 2. Perform DB adjustments if action is adjust_db and difference !== 0
        if (action === "adjust_db" && Math.abs(diff) > 0.0001) {
          const physicalQty = parseFloat(auditItem.physical_qty);

          // Get active stock batches for this item code
          const activeBatches = await trx("stock")
            .where("item_code", auditItem.item_code)
            .where("remaining", ">", 0)
            .orderBy("date", "asc")
            .orderBy("id", "asc");

          const totalSystem = activeBatches.reduce((sum, b) => sum + parseFloat(b.remaining), 0);
          const discrepancy = physicalQty - totalSystem;

          if (discrepancy < 0) {
            // Shrinkage: Deduct from oldest batches first (FIFO)
            let toDeduct = Math.abs(discrepancy);
            for (const batch of activeBatches) {
              if (toDeduct <= 0) break;
              const rem = parseFloat(batch.remaining);
              const deduction = Math.min(rem, toDeduct);

              await trx("stock")
                .where("id", batch.id)
                .update({ remaining: rem - deduction });

              await trx("stock_adjustments").insert({
                stock_id: batch.id,
                qty: -deduction,
                reason: discrepancyReason || "Audit Correction",
                date: todayStr,
                notes: `FIFO deduction of ${deduction} units during physical audit finalisation.`
              });

              toDeduct -= deduction;
            }
          } else if (discrepancy > 0) {
            // Surplus: Add to the newest batch
            if (activeBatches.length > 0) {
              const latestBatch = activeBatches[activeBatches.length - 1];
              const rem = parseFloat(latestBatch.remaining);
              await trx("stock")
                .where("id", latestBatch.id)
                .update({ remaining: rem + discrepancy });

              await trx("stock_adjustments").insert({
                stock_id: latestBatch.id,
                qty: discrepancy,
                reason: discrepancyReason || "Audit Correction",
                date: todayStr,
                notes: `Surplus of ${discrepancy} units added to latest batch during physical audit finalisation.`
              });
            } else {
              // No active batches exist. Let's find the last purchase of this item_code to clone details
              const lastBatch = await trx("stock")
                .where("item_code", auditItem.item_code)
                .orderBy("date", "desc")
                .first();

              const [newBatch] = await trx("stock").insert({
                name: lastBatch ? lastBatch.name : auditItem.item_name,
                qty: discrepancy,
                remaining: discrepancy,
                unit: lastBatch ? lastBatch.unit : auditItem.unit,
                date: todayStr,
                price: lastBatch ? (lastBatch.price || 0) : 0,
                supplier: lastBatch ? (lastBatch.supplier || "Unknown") : "Unknown",
                supplier_id: lastBatch ? lastBatch.supplier_id : null,
                expiry_date: null,
                min_alert_qty: lastBatch ? lastBatch.min_alert_qty : null,
                item_code: auditItem.item_code,
                created_by: req.user.id
              }).returning("*");

              await trx("stock_adjustments").insert({
                stock_id: newBatch.id,
                qty: discrepancy,
                reason: discrepancyReason || "Audit Correction",
                date: todayStr,
                notes: `Created new batch of ${discrepancy} units during physical audit finalisation.`
              });
            }
          }

          // Mark as adjusted in audit items
          await trx("audit_items")
            .where("id", auditItem.id)
            .update({ db_adjusted: true });

          // 3. Check for low stock alert post-adjustment
          const updatedTotal = await trx("stock")
            .where("item_code", auditItem.item_code)
            .sum("remaining as total")
            .first();
          const totalRem = parseFloat(updatedTotal?.total || 0);

          const latestBatch = await trx("stock")
            .where("item_code", auditItem.item_code)
            .orderBy("date", "desc")
            .first();

          if (latestBatch) {
            const threshold = latestBatch.min_alert_qty !== null
              ? parseFloat(latestBatch.min_alert_qty)
              : parseFloat(latestBatch.qty) * 0.25;

            if (totalRem <= threshold) {
              lowStockAlerts.push({
                item_code: auditItem.item_code,
                name: latestBatch.name,
                remaining: totalRem,
                qty: latestBatch.qty,
                unit: latestBatch.unit,
                pct: latestBatch.qty > 0 ? Math.round((totalRem / latestBatch.qty) * 100) : 0
              });
            }
          }
        }
      }

      // Update session status to completed
      await trx("audit_sessions")
        .where("id", session.id)
        .update({
          status: "completed",
          updated_at: trx.fn.now()
        });
    });

    // Fetch summary statistics
    const finalItems = await db("audit_items").where("audit_session_id", session.id);
    const matched = finalItems.filter((it) => Math.abs(parseFloat(it.difference || 0)) < 0.0001).length;
    const adjusted = finalItems.filter((it) => it.db_adjusted).length;
    const flagged_recount = finalItems.filter((it) => it.action === "recount").length;
    const flagged_investigate = finalItems.filter((it) => it.action === "investigate").length;

    res.json({
      success: true,
      data: {
        matched,
        adjusted,
        flagged_recount,
        flagged_investigate,
        low_stock_alerts: lowStockAlerts
      }
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/audits/:id
async function cancel(req, res, next) {
  try {
    const session = await db("audit_sessions").where("id", req.params.id).first();
    if (!session) return res.status(404).json({ success: false, error: "Audit session not found" });
    if (session.status !== "in_progress") {
      return res.status(400).json({ success: false, error: `Can only cancel in-progress audits (current status: ${session.status}).` });
    }

    await db("audit_sessions")
      .where("id", session.id)
      .update({
        status: "cancelled",
        updated_at: db.fn.now()
      });

    res.json({ success: true, message: "Audit session cancelled successfully." });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, summary, create, getOne, updateItem, finalise, cancel };
