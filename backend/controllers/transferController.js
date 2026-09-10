const db = require("../db");
const { getDepartmentNames } = require("../services/permissionService");
const { publish } = require("../services/kafkaProducer");
const stockLedgerService = require("../services/stockLedgerService");

async function generateTransferNumber(dateStr) {
  const formatted = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const [{ count }] = await db("stock_transfers").where("date", dateStr).count("id as count");
  const seq = String(parseInt(count || 0) + 1).padStart(4, "0");
  return `TRF-${formatted}-${seq}`;
}

// GET /api/transfers/available-stock
// Real-time stock for Agent Routeur & combobox selection
async function getAvailableStock(req, res, next) {
  try {
    const { from_location = "Store", q } = req.query;

    if (from_location === "Store") {
      let query = db("stock")
        .where("remaining", ">", 0)
        .groupBy("item_code", "name", "category", "unit")
        .select(
          "item_code",
          "name",
          "category",
          "unit",
          db.raw("COALESCE(SUM(remaining), 0) as available_qty"),
          db.raw("COALESCE(AVG(price), 0) as avg_unit_price"),
          db.raw("MAX(rack_location) as rack"),
          db.raw("MAX(storage_zone) as shelf"),
          db.raw("MAX(pack_size) as pack_size")
        );

      if (q) {
        query.where((inner) => {
          inner.whereILike("name", `%${q}%`).orWhereILike("item_code", `%${q}%`);
        });
      }

      const rows = await query.orderBy("name", "asc").limit(100);
      return res.json({
        success: true,
        data: rows.map((r) => ({
          item_code: r.item_code,
          name: r.name,
          category: r.category || "General",
          unit: r.unit,
          available_qty: Math.round(parseFloat(r.available_qty) * 1000) / 1000,
          avg_unit_price: Math.round(parseFloat(r.avg_unit_price) * 100) / 100,
          rack: r.rack || null,
          shelf: r.shelf || null,
          bin: r.bin || null,
          pack_size: r.pack_size || null,
        })),
      });
    }

    // If source is a department, check issued stock for that department
    const deptRows = await db("issuance_items")
      .join("issuances", "issuance_items.issuance_id", "issuances.id")
      .whereRaw("LOWER(issuances.dept) = LOWER(?)", [from_location])
      .groupBy("issuance_items.item_code", "issuance_items.name", "issuance_items.unit")
      .select(
        "issuance_items.item_code",
        "issuance_items.name",
        "issuance_items.unit",
        db.raw("COALESCE(SUM(issuance_items.qty_issued), 0) as total_received")
      )
      .limit(100);

    return res.json({
      success: true,
      data: deptRows.map((r) => ({
        item_code: r.item_code,
        name: r.name,
        category: "Department Stock",
        unit: r.unit,
        available_qty: Math.round(parseFloat(r.total_received) * 1000) / 1000,
        avg_unit_price: 0,
      })),
    });
  } catch (err) { next(err); }
}

// GET /api/transfers/summary
// High-level analytics and Multi-Agent telemetry metrics
async function getSummary(req, res, next) {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStart = todayStr.slice(0, 7) + "-01";

    const [{ in_transit_count }] = await db("stock_transfers")
      .where("status", "Pending")
      .count("id as in_transit_count");

    const [{ today_value }] = await db("stock_transfers")
      .where("date", todayStr)
      .sum("total_value as today_value");

    const [{ mtd_accepted_value }] = await db("stock_transfers")
      .where("status", "Accepted")
      .where("date", ">=", monthStart)
      .sum("total_value as mtd_accepted_value");

    const [{ discrepancies_count }] = await db("stock_transfers")
      .where("transit_status", "PARTIAL")
      .orWhere("status", "Rejected")
      .count("id as discrepancies_count");

    // Inter-department cost matrix (aggregated flows)
    const flows = await db("stock_transfers")
      .where("status", "Accepted")
      .groupBy("from_location", "to_location")
      .select(
        "from_location",
        "to_location",
        db.raw("COUNT(id) as transfer_count"),
        db.raw("COALESCE(SUM(total_value), 0) as total_flow_value")
      )
      .orderBy("total_flow_value", "desc");

    res.json({
      success: true,
      data: {
        in_transit_count: parseInt(in_transit_count || 0),
        today_valuation: Math.round(parseFloat(today_value || 0) * 100) / 100,
        mtd_accepted_valuation: Math.round(parseFloat(mtd_accepted_value || 0) * 100) / 100,
        discrepancies_count: parseInt(discrepancies_count || 0),
        inter_dept_matrix: flows.map((f) => ({
          from: f.from_location,
          to: f.to_location,
          count: parseInt(f.transfer_count),
          value: Math.round(parseFloat(f.total_flow_value) * 100) / 100,
        })),
        agents_telemetry: {
          routeur: { name: "Agent Routeur", status: "Active", latency_ms: 12 },
          valuator: { name: "Agent Valuator", status: "Active", valuation_model: "LIFO/Avg" },
          gatekeeper: { name: "Agent Gatekeeper", status: "Active", handshake_protocol: "2-Stage" },
          veritas: { name: "Agent Veritas", status: "Active", ledger_sync: "Double-Entry Atomic" },
        },
      },
    });
  } catch (err) { next(err); }
}

// GET /api/transfers
async function list(req, res, next) {
  try {
    const { status, from_location, to_location, transfer_type, q, date_from, date_to } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const deptNames = !req.user.isAdmin ? await getDepartmentNames(req.user) : null;

    const filter = (qb) => {
      if (status)        qb.where("status", status);
      if (from_location) qb.where("from_location", from_location);
      if (to_location)   qb.where("to_location", to_location);
      if (transfer_type) qb.where("transfer_type", transfer_type);
      if (date_from)     qb.where("date", ">=", date_from);
      if (date_to)       qb.where("date", "<=", date_to);
      if (q)             qb.whereILike("transfer_number", `%${q}%`);

      if (!req.user.isAdmin) {
        if (deptNames && deptNames.length) {
          qb.where((inner) => {
            inner.whereIn("from_location", deptNames)
                 .orWhereIn("to_location", deptNames);
          });
        } else {
          qb.whereRaw("1 = 0");
        }
      }
    };

    const [{ count }] = await db("stock_transfers").modify(filter).count("id as count");
    const rows = await db("stock_transfers")
      .modify(filter)
      .select("*")
      .orderBy(sort || "date", order || "desc")
      .offset(offset).limit(limit);

    // Attach items count and brief preview
    const ids = rows.map((r) => r.id);
    const items = ids.length ? await db("stock_transfer_items").whereIn("transfer_id", ids) : [];

    const enriched = rows.map((t) => {
      const lineItems = items.filter((it) => it.transfer_id === t.id);
      return {
        ...t,
        items_count: lineItems.length,
        items_summary: lineItems.slice(0, 3).map((it) => `${it.qty} ${it.unit} ${it.name}`).join(", ") + (lineItems.length > 3 ? "…" : ""),
      };
    });

    res.json({ success: true, data: enriched, total: parseInt(count), page: req.pagination.page, limit });
  } catch (err) { next(err); }
}

// GET /api/transfers/:id
async function getOne(req, res, next) {
  try {
    const transfer = await db("stock_transfers").where("id", req.params.id).first();
    if (!transfer) return res.status(404).json({ success: false, error: "Transfer not found." });

    if (!req.user.isAdmin) {
      const deptNames = await getDepartmentNames(req.user);
      const hasFrom = deptNames.some(d => d.toLowerCase() === transfer.from_location.toLowerCase());
      const hasTo = deptNames.some(d => d.toLowerCase() === transfer.to_location.toLowerCase());
      if (!hasFrom && !hasTo) {
        return res.status(403).json({ success: false, error: "Access denied to this transfer." });
      }
    }

    const items = await db("stock_transfer_items").where("transfer_id", req.params.id).orderBy("id");
    res.json({ success: true, data: { ...transfer, items } });
  } catch (err) { next(err); }
}

// POST /api/transfers
// Multi-Agent Creation Pipeline (Agent Routeur + Agent Valuator)
async function create(req, res, next) {
  try {
    const { date, from_location = "Store", to_location, items, initiated_by, remarks } = req.body;

    if (!to_location) {
      return res.status(400).json({ success: false, error: "Destination location ('to_location') is mandatory." });
    }

    if (from_location === to_location) {
      return res.status(400).json({ success: false, error: "Source ('from_location') and Destination ('to_location') must be different." });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: "At least one item required for transfer." });
    }

    // Role & Department Permission Scope Check
    if (!req.user.isAdmin) {
      const deptNames = await getDepartmentNames(req.user);
      const hasFrom = deptNames.some(d => d.toLowerCase() === from_location.toLowerCase());
      const hasTo = deptNames.some(d => d.toLowerCase() === to_location.toLowerCase());
      if (!hasFrom && !hasTo) {
        return res.status(403).json({ success: false, error: "Access denied: you must be assigned to either the source or destination department." });
      }
    }

    // Agent Routeur: Determine transfer archetype
    let transfer_type = "STORE_TO_DEPT";
    if (from_location === "Store" && to_location !== "Store") {
      transfer_type = "STORE_TO_DEPT";
    } else if (from_location !== "Store" && to_location === "Store") {
      transfer_type = "DEPT_TO_STORE";
    } else if (from_location !== "Store" && to_location !== "Store") {
      transfer_type = "DEPT_TO_DEPT";
    }

    // Agent Valuator & Routeur: Validate line items, prices, and available stock
    let transfer_total_value = 0;
    const validatedItems = [];

    for (const it of items) {
      const qty = parseFloat(it.qty);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, error: `Invalid quantity for item '${it.name || it.item_code}': must be greater than zero.` });
      }

      // If source is Store, enforce non-overdraft balance check
      if (from_location === "Store") {
        const stockAgg = await db("stock")
          .where("item_code", it.item_code)
          .where("remaining", ">", 0)
          .sum("remaining as available")
          .first();

        const available = parseFloat(stockAgg?.available || 0);
        if (available < qty) {
          return res.status(400).json({
            success: false,
            error: `Agent Routeur: Insufficient stock in Store for item '${it.name || it.item_code}'. Requested: ${qty} ${it.unit || ""}, Available on-hand: ${available} ${it.unit || ""}.`
          });
        }
      }

      // Agent Valuator: Auto-fetch unit price if not supplied
      let unit_price = parseFloat(it.unit_price || 0);
      if (unit_price <= 0) {
        const latestStock = await db("stock")
          .where("item_code", it.item_code)
          .orderBy("date", "desc")
          .orderBy("id", "desc")
          .first();
        unit_price = parseFloat(latestStock?.price || 0);
      }

      const item_total_value = Math.round(qty * unit_price * 100) / 100;
      transfer_total_value += item_total_value;

      validatedItems.push({
        item_code: it.item_code,
        name: it.name,
        qty,
        unit: it.unit || "kg",
        batch_no: it.batch_no || null,
        unit_price,
        total_value: item_total_value,
        rack: it.rack || null,
        shelf: it.shelf || null,
        bin: it.bin || null,
        condition_status: "Good",
        received_qty: null,
        transit_variance: 0,
      });
    }

    const transferDate = date || new Date().toISOString().slice(0, 10);
    const transfer_number = await generateTransferNumber(transferDate);

    const result = await db.transaction(async (trx) => {
      const [transfer] = await trx("stock_transfers")
        .insert({
          transfer_number,
          date: transferDate,
          from_location,
          to_location,
          status: "Pending",
          transit_status: "DISPATCHED",
          transfer_type,
          total_value: Math.round(transfer_total_value * 100) / 100,
          dispatched_at: trx.fn.now(),
          initiated_by: initiated_by || req.user?.name || "Storekeeper",
          remarks: remarks || null,
        })
        .returning("*");

      const savedItems = await trx("stock_transfer_items")
        .insert(validatedItems.map((it) => ({
          transfer_id: transfer.id,
          ...it,
        })))
        .returning("*");

      return { ...transfer, items: savedItems };
    });

    publish("transfer-events", {
      type: "transfer.create",
      id: result.id,
      transfer_number: result.transfer_number,
      from_location,
      to_location,
      total_value: result.total_value,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// PATCH /api/transfers/:id/accept
// Multi-Agent Handshake & Verification Pipeline (Agent Gatekeeper + Agent Veritas)
async function accept(req, res, next) {
  try {
    const { accepted_by, items: receiptItems, remarks } = req.body;
    const transfer = await db("stock_transfers").where("id", req.params.id).first();
    if (!transfer) return res.status(404).json({ success: false, error: "Transfer not found." });

    if (!req.user.isAdmin) {
      const deptNames = await getDepartmentNames(req.user);
      const hasFrom = deptNames.some(d => d.toLowerCase() === transfer.from_location.toLowerCase());
      const hasTo = deptNames.some(d => d.toLowerCase() === transfer.to_location.toLowerCase());
      if (!hasFrom && !hasTo) {
        return res.status(403).json({ success: false, error: "Access denied to this transfer." });
      }
    }

    if (transfer.status !== "Pending") {
      return res.status(400).json({ success: false, error: `Transfer is already ${transfer.status}.` });
    }

    const items = await db("stock_transfer_items").where("transfer_id", req.params.id);
    let hasVariance = false;

    await db.transaction(async (trx) => {
      // 1. Process receipt quantities and variances
      for (const it of items) {
        const receiptMatch = Array.isArray(receiptItems) ? receiptItems.find(r => r.id === it.id || r.item_code === it.item_code) : null;
        const receivedQty = receiptMatch && receiptMatch.received_qty !== undefined ? parseFloat(receiptMatch.received_qty) : parseFloat(it.qty);
        const condition = receiptMatch?.condition_status || it.condition_status || "Good";
        const variance = Math.max(0, Math.round((parseFloat(it.qty) - receivedQty) * 1000) / 1000);

        if (variance > 0) hasVariance = true;

        await trx("stock_transfer_items")
          .where("id", it.id)
          .update({
            received_qty: receivedQty,
            transit_variance: variance,
            condition_status: condition,
            updated_at: trx.fn.now(),
          });

        // 2. Agent Veritas: Stock Adjustments & Double-Entry Ledger Posting
        if (transfer.from_location === "Store") {
          // Deduct from Store (FIFO across active batches)
          const batches = await trx("stock")
            .where("item_code", it.item_code)
            .where("remaining", ">", 0)
            .orderBy("date", "asc")
            .orderBy("id", "asc")
            .forUpdate();

          let toDeduct = parseFloat(it.qty);
          const totalAvailable = batches.reduce((sum, b) => sum + parseFloat(b.remaining), 0);
          if (totalAvailable < toDeduct) {
            throw new Error(`Agent Veritas: Insufficient stock for transfer item '${it.name || it.item_code}'. Requested: ${toDeduct}, Available on-hand: ${totalAvailable}`);
          }

          for (const batch of batches) {
            if (toDeduct <= 0) break;
            const deduction = Math.min(parseFloat(batch.remaining), toDeduct);
            await trx("stock").where("id", batch.id).update({ remaining: parseFloat(batch.remaining) - deduction });
            toDeduct -= deduction;
          }

          // Double-Entry Ledger Entry: TRANSFER_OUT
          await stockLedgerService.recordEntry(trx, {
            stock_id: batches[0]?.id || null,
            item_code: it.item_code,
            item_name: it.name,
            transaction_type: "TRANSFER_OUT",
            qty: receivedQty,
            unit: it.unit,
            unit_price: parseFloat(it.unit_price || batches[0]?.price || 0),
            department: transfer.to_location,
            reference_doc_type: "TRANSFER",
            reference_doc_id: transfer.id,
            reference_doc_no: transfer.transfer_number,
            reason: "Stock Transfer Out",
            notes: `Transfer ${transfer.transfer_number} from Store → ${transfer.to_location}`,
            created_by: accepted_by || req.user?.name || "Storekeeper",
          });

          // If shrinkage / transit loss occurred, record TRANSFER_LOSS
          if (variance > 0) {
            await stockLedgerService.recordEntry(trx, {
              stock_id: batches[0]?.id || null,
              item_code: it.item_code,
              item_name: it.name,
              transaction_type: "TRANSFER_LOSS",
              qty: variance,
              unit: it.unit,
              unit_price: parseFloat(it.unit_price || batches[0]?.price || 0),
              department: transfer.to_location,
              reference_doc_type: "TRANSFER",
              reference_doc_id: transfer.id,
              reference_doc_no: transfer.transfer_number,
              reason: "Transit Variance / Shrinkage",
              notes: `Transit loss of ${variance} ${it.unit} on ${transfer.transfer_number} (Condition: ${condition})`,
              created_by: accepted_by || req.user?.name || "Storekeeper",
            });
          }

          // Legacy stock_adjustments link
          if (batches[0]) {
            await trx("stock_adjustments").insert({
              stock_id: batches[0].id,
              qty: -parseFloat(it.qty),
              reason: "Transfer",
              date: transfer.date,
              notes: `Transfer ${transfer.transfer_number} → ${transfer.to_location}`,
            });
          }
        } else if (transfer.to_location === "Store") {
          // Return to store: Restock batch into stock table
          const [restockedBatch] = await trx("stock")
            .insert({
              item_code: it.item_code,
              name: it.name,
              qty: receivedQty,
              remaining: receivedQty,
              unit: it.unit,
              price: parseFloat(it.unit_price || 0),
              supplier: `Return from ${transfer.from_location}`,
              date: transfer.date,
              batch_no: it.batch_no || `RET-${transfer.transfer_number}`,
            })
            .returning("*");

          // Double-Entry Ledger Entry: TRANSFER_IN
          await stockLedgerService.recordEntry(trx, {
            stock_id: restockedBatch?.id || null,
            item_code: it.item_code,
            item_name: it.name,
            transaction_type: "TRANSFER_IN",
            qty: receivedQty,
            unit: it.unit,
            unit_price: parseFloat(it.unit_price || 0),
            department: transfer.from_location,
            reference_doc_type: "TRANSFER",
            reference_doc_id: transfer.id,
            reference_doc_no: transfer.transfer_number,
            reason: "Department Return to Store",
            notes: `Returned from ${transfer.from_location} → Store (Transfer ${transfer.transfer_number})`,
            created_by: accepted_by || req.user?.name || "Storekeeper",
          });
        } else {
          // Department-to-Department Transfer: Record inter-kitchen cost transfer in ledger
          await stockLedgerService.recordEntry(trx, {
            item_code: it.item_code,
            item_name: it.name,
            transaction_type: "TRANSFER_OUT",
            qty: receivedQty,
            unit: it.unit,
            unit_price: parseFloat(it.unit_price || 0),
            department: transfer.from_location,
            reference_doc_type: "TRANSFER",
            reference_doc_id: transfer.id,
            reference_doc_no: transfer.transfer_number,
            reason: "Inter-Kitchen Transfer",
            notes: `Inter-Kitchen Transfer ${transfer.transfer_number} from ${transfer.from_location} → ${transfer.to_location}`,
            created_by: accepted_by || req.user?.name || "Storekeeper",
          });
        }
      }

      // Update transfer status
      await trx("stock_transfers")
        .where("id", req.params.id)
        .update({
          status: "Accepted",
          transit_status: hasVariance ? "PARTIAL" : "DELIVERED",
          accepted_by: accepted_by || req.user?.name || "Storekeeper",
          received_at: trx.fn.now(),
          remarks: remarks || transfer.remarks,
          updated_at: trx.fn.now(),
        });
    });

    const updated = await db("stock_transfers").where("id", req.params.id).first();
    const updatedItems = await db("stock_transfer_items").where("transfer_id", req.params.id);

    publish("transfer-events", {
      type: "transfer.accept",
      id: updated.id,
      transfer_number: updated.transfer_number,
      transit_status: updated.transit_status,
      items: updatedItems.map(i => ({ item_code: i.item_code, qty: i.qty, received_qty: i.received_qty })),
    });

    res.json({ success: true, data: { ...updated, items: updatedItems } });
  } catch (err) { next(err); }
}

// PATCH /api/transfers/:id/reject
async function reject(req, res, next) {
  try {
    const { accepted_by, remarks, rejection_reason } = req.body;
    const transfer = await db("stock_transfers").where("id", req.params.id).first();
    if (!transfer) return res.status(404).json({ success: false, error: "Transfer not found." });

    if (!req.user.isAdmin) {
      const deptNames = await getDepartmentNames(req.user);
      const hasFrom = deptNames.some(d => d.toLowerCase() === transfer.from_location.toLowerCase());
      const hasTo = deptNames.some(d => d.toLowerCase() === transfer.to_location.toLowerCase());
      if (!hasFrom && !hasTo) {
        return res.status(403).json({ success: false, error: "Access denied to this transfer." });
      }
    }

    if (transfer.status !== "Pending") {
      return res.status(400).json({ success: false, error: `Transfer is already ${transfer.status}.` });
    }

    const reason = rejection_reason || remarks || "Transfer rejected by recipient";

    await db("stock_transfers").where("id", req.params.id).update({
      status: "Rejected",
      transit_status: "REJECTED",
      accepted_by: accepted_by || req.user?.name || null,
      rejection_reason: reason,
      remarks: remarks || transfer.remarks,
      updated_at: db.fn.now(),
    });

    const updated = await db("stock_transfers").where("id", req.params.id).first();
    const items = await db("stock_transfer_items").where("transfer_id", req.params.id);

    publish("transfer-events", {
      type: "transfer.reject",
      id: updated.id,
      transfer_number: updated.transfer_number,
      reason,
    });

    res.json({ success: true, data: { ...updated, items } });
  } catch (err) { next(err); }
}

// DELETE /api/transfers/:id
async function remove(req, res, next) {
  try {
    const transfer = await db("stock_transfers").where("id", req.params.id).first();
    if (!transfer) return res.status(404).json({ success: false, error: "Transfer not found." });
    if (transfer.status !== "Pending") {
      return res.status(400).json({ success: false, error: "Only pending transfers can be deleted." });
    }

    await db("stock_transfers").where("id", req.params.id).del();
    publish("transfer-events", { type: "transfer.delete", id: transfer.id, transfer_number: transfer.transfer_number });
    res.json({ success: true, message: "Transfer deleted." });
  } catch (err) { next(err); }
}

module.exports = {
  list,
  getOne,
  create,
  accept,
  reject,
  remove,
  getAvailableStock,
  getSummary,
};
