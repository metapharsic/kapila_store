const db = require("../db");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");

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

    // Fetch current remaining quantity, category, and average unit price from stock
    const stockInfo = await db("stock")
      .select("item_code", "category")
      .sum("remaining as current_qty")
      .avg("price as avg_price")
      .groupBy("item_code", "category");

    const stockMap = {};
    stockInfo.forEach((s) => {
      stockMap[s.item_code] = {
        category: s.category || "General",
        current_qty: parseFloat(s.current_qty || 0),
        unit_price: parseFloat(s.avg_price || 0)
      };
    });

    let hasConcurrentChanges = false;
    const formattedItems = items.map((item) => {
      const info = stockMap[item.item_code] || { category: "General", current_qty: 0, unit_price: 0 };
      const currentQty = info.current_qty;
      const isDifferent = Math.abs(currentQty - parseFloat(item.db_qty)) > 0.0001;
      if (isDifferent) {
        hasConcurrentChanges = true;
      }
      return {
        ...item,
        category: info.category,
        unit_price: info.unit_price,
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

    const physicalQty = req.body.physical_qty === "" || req.body.physical_qty === null ? null : parseFloat(req.body.physical_qty);
    const difference = physicalQty !== null && !isNaN(physicalQty) ? physicalQty - parseFloat(item.db_qty) : null;

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

// POST /api/audits/:id/batch-count (Multi-Threaded / Parallel Chunks)
async function batchCount(req, res, next) {
  try {
    const session = await db("audit_sessions").where("id", req.params.id).first();
    if (!session) return res.status(404).json({ success: false, error: "Audit session not found" });
    if (session.status !== "in_progress") {
      return res.status(400).json({ success: false, error: `Cannot update items on a ${session.status} audit session.` });
    }

    const { items: inputItems } = req.body;
    if (!Array.isArray(inputItems) || inputItems.length === 0) {
      return res.status(400).json({ success: false, error: "Items array is required" });
    }

    const updated = [];
    const CHUNK_SIZE = 25; // Concurrent batch chunk processing

    await db.transaction(async (trx) => {
      for (let i = 0; i < inputItems.length; i += CHUNK_SIZE) {
        const chunk = inputItems.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async ({ audit_item_id, physical_qty }) => {
            const it = await trx("audit_items")
              .where({ id: audit_item_id, audit_session_id: session.id })
              .first();
            if (!it) return null;

            const pQty = physical_qty === "" || physical_qty === null || physical_qty === undefined
              ? null
              : parseFloat(physical_qty);

            const difference = pQty !== null && !isNaN(pQty) ? pQty - parseFloat(it.db_qty) : null;

            const [upd] = await trx("audit_items")
              .where("id", it.id)
              .update({
                physical_qty: pQty,
                difference,
                updated_at: trx.fn.now()
              })
              .returning("*");
            return upd;
          })
        );
        updated.push(...chunkResults.filter(Boolean));
      }
    });

    res.json({
      success: true,
      message: `Successfully updated ${updated.length} items concurrently.`,
      updated_count: updated.length,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/audits/:id/agent-telemetry
async function getAgentTelemetry(req, res, next) {
  try {
    const session = await db("audit_sessions")
      .leftJoin("departments", "audit_sessions.department_id", "departments.id")
      .select("audit_sessions.*", "departments.name as department_name")
      .where("audit_sessions.id", req.params.id)
      .first();
    if (!session) return res.status(404).json({ success: false, error: "Audit session not found" });

    const items = await db("audit_items")
      .where("audit_session_id", session.id)
      .orderBy("item_name", "asc");

    // Fetch unit price and category mapping
    const stockInfo = await db("stock")
      .select("item_code", "category")
      .avg("price as avg_price")
      .groupBy("item_code", "category");

    const priceMap = {};
    const catMap = {};
    stockInfo.forEach((s) => {
      priceMap[s.item_code] = parseFloat(s.avg_price || 0);
      if (s.category) catMap[s.item_code] = s.category;
    });

    const totalItems = items.length;
    let countedItems = 0;
    let matchedItems = 0;
    let surplusCount = 0;
    let shrinkageCount = 0;
    let theoreticalValuation = 0;
    let physicalValuation = 0;
    let netVarianceValuation = 0;
    let totalShrinkageValuation = 0;
    let totalSurplusValuation = 0;

    const anomalies = [];
    const categoryBreakdown = {};

    items.forEach((it) => {
      const dbQty = parseFloat(it.db_qty || 0);
      const unitPrice = priceMap[it.item_code] || 0;
      const category = catMap[it.item_code] || "General";

      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { total: 0, counted: 0, discrepancies: 0 };
      }
      categoryBreakdown[category].total += 1;

      theoreticalValuation += dbQty * unitPrice;

      if (it.physical_qty !== null) {
        countedItems += 1;
        categoryBreakdown[category].counted += 1;

        const physQty = parseFloat(it.physical_qty);
        physicalValuation += physQty * unitPrice;

        const diff = physQty - dbQty;
        const diffVal = diff * unitPrice;
        netVarianceValuation += diffVal;

        if (Math.abs(diff) < 0.0001) {
          matchedItems += 1;
        } else if (diff < 0) {
          shrinkageCount += 1;
          totalShrinkageValuation += Math.abs(diffVal);
          categoryBreakdown[category].discrepancies += 1;
        } else {
          surplusCount += 1;
          totalSurplusValuation += diffVal;
          categoryBreakdown[category].discrepancies += 1;
        }

        // Sentinel Anomaly Detection
        const pctDiff = dbQty > 0 ? (Math.abs(diff) / dbQty) * 100 : 100;
        const isHighPct = pctDiff >= 15 && Math.abs(diff) >= 1;
        const isHighValue = Math.abs(diffVal) >= 1000;
        const isSuspiciousZero = dbQty >= 5 && physQty === 0;

        if (isHighPct || isHighValue || isSuspiciousZero) {
          anomalies.push({
            id: it.id,
            item_code: it.item_code,
            item_name: it.item_name,
            category,
            unit: it.unit,
            db_qty: dbQty,
            physical_qty: physQty,
            diff,
            diff_val: diffVal,
            pct_diff: Math.round(pctDiff),
            anomaly_type: isSuspiciousZero ? "ZERO_COUNT_HIGH_STOCK" : isHighValue ? "HIGH_VALUE_DISCREPANCY" : "SEVERE_VARIANCE",
            risk_level: isHighValue || isSuspiciousZero ? "CRITICAL" : "MODERATE"
          });
        }
      }
    });

    const progressPct = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;
    const canFinalise = totalItems > 0 && countedItems === totalItems;

    // Agent Veritas Readiness
    const pendingReasons = items.filter(
      (it) => it.physical_qty !== null && Math.abs(parseFloat(it.difference || 0)) > 0.0001 && !it.discrepancy_reason
    ).length;

    res.json({
      success: true,
      data: {
        agent_sentinel: {
          name: "Agent Sentinel",
          role: "Variance Anomaly Detector",
          status: anomalies.length > 0 ? (anomalies.some((a) => a.risk_level === "CRITICAL") ? "CRITICAL" : "WARNING") : "HEALTHY",
          anomaly_count: anomalies.length,
          critical_anomalies: anomalies.filter((a) => a.risk_level === "CRITICAL"),
          all_anomalies: anomalies
        },
        agent_auditor: {
          name: "Agent Auditor",
          role: "Theoretical Verifier",
          total_skus: totalItems,
          counted_skus: countedItems,
          uncounted_skus: totalItems - countedItems,
          progress_pct: progressPct,
          matched_skus: matchedItems,
          discrepancy_skus: countedItems - matchedItems,
          shrinkage_count: shrinkageCount,
          surplus_count: surplusCount,
          category_breakdown: categoryBreakdown
        },
        agent_valuator: {
          name: "Agent Valuator",
          role: "Financial Telemetry",
          theoretical_valuation: Math.round(theoreticalValuation * 100) / 100,
          physical_valuation: Math.round(physicalValuation * 100) / 100,
          net_variance: Math.round(netVarianceValuation * 100) / 100,
          total_shrinkage: Math.round(totalShrinkageValuation * 100) / 100,
          total_surplus: Math.round(totalSurplusValuation * 100) / 100,
          currency: "INR"
        },
        agent_veritas: {
          name: "Agent Veritas",
          role: "Atomic Ledger Adjuster",
          ready_for_finalise: canFinalise && pendingReasons === 0,
          pending_counts: totalItems - countedItems,
          pending_reasons: pendingReasons,
          ledger_transactions_projected: items.filter(
            (it) => it.physical_qty !== null && Math.abs(parseFloat(it.difference || 0)) > 0.0001
          ).length
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/audits/:id/finalise
async function finalise(req, res, next) {
  try {
    const session = await db("audit_sessions")
      .leftJoin("departments", "audit_sessions.department_id", "departments.id")
      .select("audit_sessions.*", "departments.name as department_name")
      .where("audit_sessions.id", req.params.id)
      .first();

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

        // 2. Perform DB adjustments and atomic stock_ledger postings if action is adjust_db and difference !== 0
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
          let affectedBatchId = null;
          let representativeBatch = null;

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
                reason: discrepancyReason || "Physical Audit Correction",
                date: todayStr,
                notes: `FIFO deduction of ${deduction} units during physical audit finalisation (${session.reference}).`
              });

              if (!affectedBatchId) affectedBatchId = batch.id;
              if (!representativeBatch) representativeBatch = batch;
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
                reason: discrepancyReason || "Physical Audit Correction",
                date: todayStr,
                notes: `Surplus of ${discrepancy} units added to latest batch during physical audit finalisation (${session.reference}).`
              });

              affectedBatchId = latestBatch.id;
              representativeBatch = latestBatch;
            } else {
              // No active batches exist. Find last purchase of this item_code to clone details
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
                supplier: lastBatch ? (lastBatch.supplier || "Physical Audit Intake") : "Physical Audit Intake",
                supplier_id: lastBatch ? lastBatch.supplier_id : null,
                expiry_date: null,
                min_alert_qty: lastBatch ? lastBatch.min_alert_qty : null,
                item_code: auditItem.item_code,
                category: lastBatch ? lastBatch.category : "General",
                created_by: req.user.id
              }).returning("*");

              await trx("stock_adjustments").insert({
                stock_id: newBatch.id,
                qty: discrepancy,
                reason: discrepancyReason || "Physical Audit Correction",
                date: todayStr,
                notes: `Created new batch of ${discrepancy} units during physical audit finalisation (${session.reference}).`
              });

              affectedBatchId = newBatch.id;
              representativeBatch = newBatch;
            }
          }

          // Fetch fallback batch if needed for pricing and metadata
          if (!representativeBatch) {
            representativeBatch = await trx("stock")
              .where("item_code", auditItem.item_code)
              .orderBy("date", "desc")
              .first();
          }

          // ATOMIC DOUBLE-ENTRY STOCK_LEDGER POSTING
          const absDiscrepancy = Math.abs(discrepancy);
          const unitCost = representativeBatch ? parseFloat(representativeBatch.price || 0) : 0;
          const totalValuation = Math.round(absDiscrepancy * unitCost * 100) / 100;
          const transType = discrepancy > 0 ? "ADJUSTMENT_ADD" : "ADJUSTMENT_DEDUCT";

          await trx("stock_ledger").insert({
            stock_id: affectedBatchId,
            item_code: auditItem.item_code,
            item_name: auditItem.item_name,
            category: representativeBatch?.category || "General",
            transaction_type: transType,
            qty: absDiscrepancy,
            unit: auditItem.unit,
            unit_price: unitCost,
            total_value: totalValuation,
            balance_qty_before: totalSystem,
            balance_qty_after: physicalQty,
            batch_no: representativeBatch?.batch_no || `AUDIT-${session.reference}`,
            department: session.department_name || "CENTRAL STORE",
            supplier: representativeBatch?.supplier || "Physical Inventory Audit",
            invoice_no: session.reference,
            reference_doc_type: "AUDIT",
            reference_doc_id: session.id,
            reference_doc_no: session.reference,
            reason: discrepancyReason || "Physical Stock Audit Reconciliation",
            notes: `Audit ${session.reference}: system balance adjusted from ${totalSystem} to ${physicalQty} ${auditItem.unit} via ${transType}. Action: ${action}.`,
            created_by: req.user?.username || req.user?.name || "Auditor",
            created_at: trx.fn.now()
          });

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

// GET /api/audits/:id/export-excel
async function exportExcel(req, res, next) {
  try {
    const session = await db("audit_sessions")
      .leftJoin("departments", "audit_sessions.department_id", "departments.id")
      .select("audit_sessions.*", "departments.name as department_name")
      .where("audit_sessions.id", req.params.id)
      .first();
    if (!session) return res.status(404).json({ success: false, error: "Audit session not found" });

    const items = await db("audit_items")
      .where("audit_session_id", session.id)
      .orderBy("item_name", "asc");

    // Fetch prices and categories
    const stockInfo = await db("stock")
      .select("item_code", "category")
      .avg("price as avg_price")
      .groupBy("item_code", "category");

    const priceMap = {};
    const catMap = {};
    stockInfo.forEach((s) => {
      priceMap[s.item_code] = parseFloat(s.avg_price || 0);
      if (s.category) catMap[s.item_code] = s.category;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila Inventory System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Audit Variance Report", {
      pageSetup: { paperSize: 9, orientation: "landscape" }
    });

    // 1. Branded Header
    sheet.mergeCells("A1:K1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "HOTEL KAPILA — STOCK AUDIT VARIANCE REPORT";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 32;

    // 2. Metadata details
    sheet.getCell("A2").value = `Audit Reference: ${session.reference}`;
    sheet.getCell("D2").value = `Auditor: ${session.auditor_name}`;
    sheet.getCell("G2").value = `Scope: ${session.department_name || "CENTRAL STORE"}`;
    sheet.getCell("J2").value = `Status: ${session.status.toUpperCase()}`;
    sheet.getRow(2).font = { bold: true, size: 10 };
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    // 3. Table Headers
    const headers = [
      "Sl No", "Item Code", "Item Name", "Category", "Unit",
      "Theoretical (DB) Qty", "Physical Count Qty", "Variance Qty",
      "Unit Cost (₹)", "Financial Variance (₹)", "Discrepancy Reason", "Action"
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8A838" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      };
    });

    let netVarianceVal = 0;

    items.forEach((it, idx) => {
      const dbQty = parseFloat(it.db_qty || 0);
      const physQty = it.physical_qty !== null ? parseFloat(it.physical_qty) : null;
      const diff = physQty !== null ? physQty - dbQty : null;
      const unitPrice = priceMap[it.item_code] || 0;
      const valDiff = diff !== null ? diff * unitPrice : null;
      const category = catMap[it.item_code] || "General";

      if (valDiff !== null) netVarianceVal += valDiff;

      const row = sheet.addRow([
        idx + 1,
        it.item_code,
        it.item_name,
        category,
        it.unit,
        dbQty,
        physQty !== null ? physQty : "Not Counted",
        diff !== null ? diff : "—",
        unitPrice,
        valDiff !== null ? Math.round(valDiff * 100) / 100 : "—",
        it.discrepancy_reason || "—",
        it.action || (it.db_adjusted ? "Adjusted" : "—")
      ]);

      if (diff !== null && Math.abs(diff) > 0.0001) {
        if (diff < 0) {
          row.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
        } else {
          row.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        }
      }
    });

    sheet.addRow([]);
    const summaryRow = sheet.addRow([
      "TOTALS", "", "", "", "",
      "", "", "", "NET IMPACT:", Math.round(netVarianceVal * 100) / 100, "", ""
    ]);
    summaryRow.font = { bold: true };
    summaryRow.getCell(10).fill = {
      type: "pattern", pattern: "solid",
      fgColor: { argb: netVarianceVal < 0 ? "FFFEE2E2" : "FFECFDF5" }
    };

    sheet.addRow([]);
    sheet.addRow([]);
    const signRow = sheet.addRow([
      "Store Auditor:", "", "",
      "Executive Chef / Dept Head:", "", "",
      "General Manager / Accounts:", "", "", ""
    ]);
    signRow.font = { bold: true, italic: true };

    sheet.columns.forEach((col) => {
      col.width = Math.max(col.width || 12, 14);
    });
    sheet.getColumn(3).width = 28;
    sheet.getColumn(11).width = 24;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Hotel_Kapila_Stock_Audit_${session.reference}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// GET /api/audits/:id/export-csv
async function exportCsv(req, res, next) {
  try {
    const session = await db("audit_sessions")
      .leftJoin("departments", "audit_sessions.department_id", "departments.id")
      .select("audit_sessions.*", "departments.name as department_name")
      .where("audit_sessions.id", req.params.id)
      .first();
    if (!session) return res.status(404).json({ success: false, error: "Audit session not found" });

    const items = await db("audit_items")
      .where("audit_session_id", session.id)
      .orderBy("item_name", "asc");

    const stockInfo = await db("stock")
      .select("item_code", "category")
      .avg("price as avg_price")
      .groupBy("item_code", "category");

    const priceMap = {};
    const catMap = {};
    stockInfo.forEach((s) => {
      priceMap[s.item_code] = parseFloat(s.avg_price || 0);
      if (s.category) catMap[s.item_code] = s.category;
    });

    const headers = [
      "Item Code", "Item Name", "Category", "Unit", "Theoretical Qty",
      "Physical Qty", "Variance", "Unit Cost", "Variance Value", "Discrepancy Reason", "Action", "DB Adjusted"
    ];

    const rows = items.map((it) => {
      const dbQty = parseFloat(it.db_qty || 0);
      const physQty = it.physical_qty !== null ? parseFloat(it.physical_qty) : "";
      const diff = physQty !== "" ? physQty - dbQty : "";
      const unitPrice = priceMap[it.item_code] || 0;
      const varVal = diff !== "" ? Math.round(diff * unitPrice * 100) / 100 : "";
      const cat = catMap[it.item_code] || "General";

      return [
        `"${it.item_code}"`,
        `"${(it.item_name || "").replace(/"/g, '""')}"`,
        `"${cat}"`,
        `"${it.unit}"`,
        dbQty,
        physQty,
        diff,
        unitPrice,
        varVal,
        `"${(it.discrepancy_reason || "").replace(/"/g, '""')}"`,
        `"${it.action || ""}"`,
        it.db_adjusted ? "YES" : "NO"
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Hotel_Kapila_Stock_Audit_${session.reference}.csv"`);
    res.status(200).send(csvContent);
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

module.exports = {
  list,
  summary,
  create,
  getOne,
  updateItem,
  batchCount,
  getAgentTelemetry,
  finalise,
  exportExcel,
  exportCsv,
  cancel
};

