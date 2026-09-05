const db = require("../db");
const { getDepartmentNames } = require("../services/permissionService");
const { publish } = require("../services/kafkaProducer");

async function generateTransferNumber(dateStr) {
  const formatted = dateStr.replace(/-/g, "");
  const [{ count }] = await db("stock_transfers").where("date", dateStr).count("id as count");
  const seq = String(parseInt(count || 0) + 1).padStart(4, "0");
  return `TRF-${formatted}-${seq}`;
}

// GET /api/transfers
async function list(req, res, next) {
  try {
    const { status, from_location, to_location, q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const deptNames = !req.user.isAdmin ? await getDepartmentNames(req.user) : null;

    const filter = (qb) => {
      if (status)        qb.where("status", status);
      if (from_location) qb.where("from_location", from_location);
      if (to_location)   qb.where("to_location", to_location);
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

    res.json({ success: true, data: rows, total: parseInt(count), page: req.pagination.page, limit });
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
async function create(req, res, next) {
  try {
    const { date, from_location, to_location, items, initiated_by, remarks } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ success: false, error: "At least one item required." });

    for (const it of items) {
      const qty = parseFloat(it.qty);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, error: `Invalid quantity for item '${it.name || it.item_code}': must be greater than zero.` });
      }
    }

    if (!req.user.isAdmin) {
      const deptNames = await getDepartmentNames(req.user);
      const hasFrom = deptNames.some(d => d.toLowerCase() === (from_location || "Store").toLowerCase());
      const hasTo = deptNames.some(d => d.toLowerCase() === to_location.toLowerCase());
      if (!hasFrom && !hasTo) {
        return res.status(403).json({ success: false, error: "Access denied: you must be assigned to either the source or destination department." });
      }
    }

    const transfer_number = await generateTransferNumber(date);

    const result = await db.transaction(async (trx) => {
      const [transfer] = await trx("stock_transfers")
        .insert({ transfer_number, date, from_location: from_location || "Store", to_location, status: "Pending", initiated_by: initiated_by || null, remarks: remarks || null })
        .returning("*");

      const saved = await trx("stock_transfer_items")
        .insert(items.map((it) => ({
          transfer_id: transfer.id,
          item_code: it.item_code,
          name: it.name,
          qty: it.qty,
          unit: it.unit,
          batch_no: it.batch_no || null,
        })))
        .returning("*");

      return { ...transfer, items: saved };
    });

    publish("transfer-events", { type: "transfer.create", id: result.id, transfer_number: result.transfer_number });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// PATCH /api/transfers/:id/accept
async function accept(req, res, next) {
  try {
    const { accepted_by } = req.body;
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

    if (transfer.status !== "Pending")
      return res.status(400).json({ success: false, error: `Transfer is already ${transfer.status}.` });

    const items = await db("stock_transfer_items").where("transfer_id", req.params.id);

    await db.transaction(async (trx) => {
      // Deduct from source (FIFO across batches of same item_code)
      for (const it of items) {
        const batches = await trx("stock")
          .where("item_code", it.item_code)
          .where("remaining", ">", 0)
          .orderBy("date", "asc")
          .orderBy("id", "asc")
          .forUpdate();

        let toDeduct = parseFloat(it.qty);
        const totalAvailable = batches.reduce((sum, b) => sum + parseFloat(b.remaining), 0);
        if (totalAvailable < toDeduct) {
          throw new Error(`Insufficient stock for transfer item '${it.name || it.item_code}'. Requested: ${toDeduct}, Available: ${totalAvailable}`);
        }

        for (const batch of batches) {
          if (toDeduct <= 0) break;
          const deduction = Math.min(parseFloat(batch.remaining), toDeduct);
          await trx("stock").where("id", batch.id).update({ remaining: parseFloat(batch.remaining) - deduction });
          toDeduct -= deduction;
        }

        // Audit trail for the deduction
        const latestBatch = batches[0];
        if (latestBatch) {
          await trx("stock_adjustments").insert({
            stock_id: latestBatch.id,
            qty: -parseFloat(it.qty),
            reason: "Transfer",
            date: transfer.date,
            notes: `Transfer ${transfer.transfer_number} → ${transfer.to_location}`,
          });
        }
      }

      await trx("stock_transfers")
        .where("id", req.params.id)
        .update({ status: "Accepted", accepted_by: accepted_by || null, updated_at: trx.fn.now() });
    });

    const updated = await db("stock_transfers").where("id", req.params.id).first();
    const updatedItems = await db("stock_transfer_items").where("transfer_id", req.params.id);
    publish("transfer-events", { type: "transfer.accept", id: updated.id, transfer_number: updated.transfer_number, items: updatedItems.map(i => ({ item_code: i.item_code, qty: i.qty })) });
    publish("stock-events", { type: "stock.transfer_out", transfer_id: updated.id, items: updatedItems.map(i => ({ item_code: i.item_code, qty: i.qty })) });
    res.json({ success: true, data: { ...updated, items: updatedItems } });
  } catch (err) { next(err); }
}

// PATCH /api/transfers/:id/reject
async function reject(req, res, next) {
  try {
    const { accepted_by, remarks } = req.body;
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

    if (transfer.status !== "Pending")
      return res.status(400).json({ success: false, error: `Transfer is already ${transfer.status}.` });

    await db("stock_transfers").where("id", req.params.id)
      .update({ status: "Rejected", accepted_by: accepted_by || null, remarks: remarks || transfer.remarks, updated_at: db.fn.now() });

    const updated = await db("stock_transfers").where("id", req.params.id).first();
    const items = await db("stock_transfer_items").where("transfer_id", req.params.id);
    publish("transfer-events", { type: "transfer.reject", id: updated.id, transfer_number: updated.transfer_number });
    res.json({ success: true, data: { ...updated, items } });
  } catch (err) { next(err); }
}

// DELETE /api/transfers/:id  (only pending)
async function remove(req, res, next) {
  try {
    const transfer = await db("stock_transfers").where("id", req.params.id).first();
    if (!transfer) return res.status(404).json({ success: false, error: "Transfer not found." });
    if (transfer.status !== "Pending")
      return res.status(400).json({ success: false, error: "Only pending transfers can be deleted." });

    await db("stock_transfers").where("id", req.params.id).del();
    publish("transfer-events", { type: "transfer.delete", id: transfer.id, transfer_number: transfer.transfer_number });
    res.json({ success: true, message: "Transfer deleted." });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, accept, reject, remove };
