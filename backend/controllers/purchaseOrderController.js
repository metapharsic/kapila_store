const db = require("../db");
const { publish } = require("../services/kafkaProducer");
const { auditLog } = require("../services/auditService");

// Helper to generate a unique PO number: PO-YYYYMMDD-XXXX
async function generatePONumber(dateStr) {
  const dateObj = new Date(dateStr);
  const formattedDate = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
  
  // Count how many POs are on this date
  const [{ count }] = await db("purchase_orders")
    .where("date", dateStr)
    .count("id as count");
  
  const seq = parseInt(count || 0) + 1;
  const seqStr = String(seq).padStart(4, "0");
  return `PO-${formattedDate}-${seqStr}`;
}

// GET /api/purchase-orders
async function list(req, res, next) {
  try {
    const { supplier_id, status, date_from, date_to, q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const filter = (qb) => {
      if (supplier_id) qb.where("purchase_orders.supplier_id", supplier_id);
      if (status) qb.where("purchase_orders.status", status);
      if (date_from) qb.where("purchase_orders.date", ">=", date_from);
      if (date_to) qb.where("purchase_orders.date", "<=", date_to);
      if (q) {
        qb.where("purchase_orders.po_number", "ilike", `%${q}%`)
          .orWhere("suppliers.name", "ilike", `%${q}%`);
      }
    };

    const [{ count }] = await db("purchase_orders")
      .join("suppliers", "purchase_orders.supplier_id", "suppliers.id")
      .modify(filter)
      .count("purchase_orders.id as count");

    const rows = await db("purchase_orders")
      .join("suppliers", "purchase_orders.supplier_id", "suppliers.id")
      .modify(filter)
      .select(
        "purchase_orders.*", 
        "suppliers.name as supplier_name",
        db("purchase_order_items")
          .count("id")
          .whereRaw("po_id = purchase_orders.id")
          .as("item_count")
      )
      .orderBy(sort ? `purchase_orders.${sort}` : "purchase_orders.date", order || "desc").orderBy("purchase_orders.id", "desc")
      .offset(offset)
      .limit(limit);

    res.json({ success: true, data: rows, total: parseInt(count), page: req.pagination.page, limit });
  } catch (err) {
    next(err);
  }
}

// GET /api/purchase-orders/:id
async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    const po = await db("purchase_orders")
      .join("suppliers", "purchase_orders.supplier_id", "suppliers.id")
      .where("purchase_orders.id", id)
      .select("purchase_orders.*", "suppliers.name as supplier_name", "suppliers.gstin as supplier_gstin", "suppliers.phone as supplier_phone", "suppliers.rating as supplier_rating")
      .first();

    if (!po) {
      return res.status(404).json({ success: false, error: "Purchase Order not found." });
    }

    const items = await db("purchase_order_items")
      .where("po_id", id)
      .select("*")
      .orderBy("id", "asc");

    res.json({ success: true, data: { ...po, items } });
  } catch (err) {
    next(err);
  }
}

// POST /api/purchase-orders
async function create(req, res, next) {
  try {
    const { supplier_id, date, status, notes, items } = req.body;

    // Verify supplier exists
    const supplier = await db("suppliers").where("id", supplier_id).first();
    if (!supplier) {
      return res.status(400).json({ success: false, error: "Supplier not found." });
    }

    const po_number = await generatePONumber(date);

    // Compute total amount
    let total_amount = 0;
    const poItems = items.map(it => {
      const total_price = it.qty * it.unit_price;
      total_amount += total_price;
      return {
        item_code: it.item_code,
        name: it.name,
        qty: it.qty,
        unit: it.unit,
        unit_price: it.unit_price,
        total_price
      };
    });

    // Non-admin roles (store manager) can never self-finalize a PO — force it
    // into the approval pipeline regardless of what status the client sent.
    const isAdmin = req.user.roles?.some((r) => r.key === "admin") || req.user.isAdmin;
    const finalStatus = isAdmin ? (status || "Draft") : "Pending";

    const result = await db.transaction(async (trx) => {
      const [po] = await trx("purchase_orders")
        .insert({
          po_number,
          supplier_id,
          date,
          status: finalStatus,
          total_amount,
          notes: notes || null
        })
        .returning("*");

      const itemsToInsert = poItems.map(it => ({ ...it, po_id: po.id }));
      const savedItems = await trx("purchase_order_items").insert(itemsToInsert).returning("*");

      // Trigger approval flow if status is pending
      if (finalStatus.toLowerCase() === "pending") {
        const { createApprovalRequest } = require("./approvalController");
        await createApprovalRequest(trx, "purchase_orders", po.id, total_amount, req.user.id);
      }

      return { ...po, items: savedItems };
    });

    publish("purchase-order-events", { type: "purchase_order.create", id: result.id, po_number: result.po_number, total_amount: result.total_amount });
    await auditLog(req, { action: "purchase_orders.create", resource: "purchase_orders", resourceId: result.id, after: result });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/purchase-orders/:id
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { supplier_id, date, status, notes, items } = req.body;

    const existing = await db("purchase_orders").where("id", id).first();
    if (!existing) {
      return res.status(404).json({ success: false, error: "Purchase Order not found." });
    }

    if (existing.status === "Received") {
      return res.status(400).json({ success: false, error: "Cannot modify a received Purchase Order." });
    }

    // Enforce valid status lifecycle transitions
    if (status && status !== existing.status) {
      if (status === "Received") {
        return res.status(400).json({
          success: false,
          error: "Purchase Orders cannot be marked 'Received' directly. Please process delivery via Goods Receipt (GRN) to update stock batches."
        });
      }

      if (status === "Sent" && !["Approved", "Sent"].includes(existing.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot mark PO as 'Sent' while in '${existing.status}' status. PO must be Approved first.`
        });
      }

      if (status === "Approved" && !req.user.isAdmin) {
        const canApprove = req.user.permissions?.includes?.("purchase_orders.approve") || req.user.isAdmin;
        if (!canApprove) {
          return res.status(403).json({
            success: false,
            error: "You do not have permission to approve Purchase Orders. Please use the Approval Queue."
          });
        }
      }
    }

    // Verify supplier if changed
    if (supplier_id && supplier_id !== existing.supplier_id) {
      const supplier = await db("suppliers").where("id", supplier_id).first();
      if (!supplier) {
        return res.status(400).json({ success: false, error: "Supplier not found." });
      }
    }

    const result = await db.transaction(async (trx) => {
      let total_amount = existing.total_amount;

      if (items) {
        // Recalculate and replace items
        await trx("purchase_order_items").where("po_id", id).del();
        total_amount = 0;
        const itemsToInsert = items.map(it => {
          const total_price = it.qty * it.unit_price;
          total_amount += total_price;
          return {
            po_id: id,
            item_code: it.item_code,
            name: it.name,
            qty: it.qty,
            unit: it.unit,
            unit_price: it.unit_price,
            total_price
          };
        });
        await trx("purchase_order_items").insert(itemsToInsert);
      }

      const [po] = await trx("purchase_orders")
        .where("id", id)
        .update({
          supplier_id: supplier_id || existing.supplier_id,
          date: date || existing.date,
          status: status || existing.status,
          notes: notes !== undefined ? notes : existing.notes,
          total_amount,
          updated_at: trx.fn.now()
        })
        .returning("*");

      // Trigger approval flow if status transitions to pending
      if (status && status.toLowerCase() === "pending" && existing.status.toLowerCase() !== "pending") {
        const { createApprovalRequest } = require("./approvalController");
        await createApprovalRequest(trx, "purchase_orders", po.id, total_amount, req.user.id);
      }

      const updatedItems = await trx("purchase_order_items")
        .where("po_id", id)
        .select("*")
        .orderBy("id", "asc");

      return { ...po, items: updatedItems };
    });

    publish("purchase-order-events", { type: "purchase_order.update", id: result.id, status: result.status });
    await auditLog(req, { action: "purchase_orders.update", resource: "purchase_orders", resourceId: result.id, before: existing, after: result });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/purchase-orders/:id
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await db("purchase_orders").where("id", id).first();
    if (!existing) {
      return res.status(404).json({ success: false, error: "Purchase Order not found." });
    }

    if (existing.status === "Received") {
      return res.status(400).json({ success: false, error: "Cannot delete a received Purchase Order." });
    }

    await db("purchase_orders").where("id", id).del();
    publish("purchase-order-events", { type: "purchase_order.delete", id: existing.id, po_number: existing.po_number });
    await auditLog(req, { action: "purchase_orders.delete", resource: "purchase_orders", resourceId: existing.id, before: existing });
    res.json({ success: true, message: "Purchase Order deleted successfully." });
  } catch (err) {
    next(err);
  }
}

// POST /api/purchase-orders/auto-draft
// Auto drafts a PO for all low stock items from a specific supplier
async function createAutoDraft(req, res, next) {
  try {
    const { supplier_id } = req.body;
    if (!supplier_id) {
      return res.status(400).json({ success: false, error: "Supplier ID is required for drafting." });
    }

    const supplier = await db("suppliers").where("id", supplier_id).first();
    if (!supplier) {
      return res.status(400).json({ success: false, error: "Supplier not found." });
    }

    // Find all low stock items
    // First, let's fetch total current stock grouped by item_code
    const activeStock = await db("stock")
      .select("item_code", "name", "unit")
      .sum("remaining as total_remaining")
      .sum("qty as total_qty")
      .max("min_alert_qty as min_alert")
      .groupBy("item_code", "name", "unit");

    const lowStockItems = activeStock.filter(item => {
      const remaining = parseFloat(item.total_remaining || 0);
      const totalQty = parseFloat(item.total_qty || 0);
      const threshold = item.min_alert !== null ? parseFloat(item.min_alert) : totalQty * 0.25;
      return remaining <= threshold;
    });

    if (lowStockItems.length === 0) {
      return res.status(400).json({ success: false, error: "No low stock items found to reorder." });
    }

    // For each low stock item, find the last purchase price from this supplier (or fallback to any supplier)
    const itemsWithPrice = await Promise.all(lowStockItems.map(async (item) => {
      // Try to find last price from this supplier
      let lastPriceRecord = await db("stock")
        .where("item_code", item.item_code)
        .where("supplier_id", supplier_id)
        .whereNotNull("price")
        .orderBy("date", "desc")
        .first();

      if (!lastPriceRecord) {
        // Fallback to last price from any supplier
        lastPriceRecord = await db("stock")
          .where("item_code", item.item_code)
          .whereNotNull("price")
          .orderBy("date", "desc")
          .first();
      }

      const unitPrice = lastPriceRecord ? parseFloat(lastPriceRecord.price) : 10; // default/placeholder price if never bought
      // Reorder quantity recommendation: replenish up to full total_qty (reorder buffer) or default to 50 units
      const reorderQty = Math.max(10, Math.ceil(parseFloat(item.total_qty || 50) - parseFloat(item.total_remaining || 0)));

      return {
        item_code: item.item_code,
        name: item.name,
        qty: reorderQty,
        unit: item.unit,
        unit_price: unitPrice
      };
    }));

    if (req.body.preview) {
      return res.json({ success: true, data: { items: itemsWithPrice } });
    }

    const date = new Date().toISOString().slice(0, 10);
    const po_number = await generatePONumber(date);

    let total_amount = 0;
    const poItems = itemsWithPrice.map(it => {
      const total_price = it.qty * it.unit_price;
      total_amount += total_price;
      return {
        item_code: it.item_code,
        name: it.name,
        qty: it.qty,
        unit: it.unit,
        unit_price: it.unit_price,
        total_price
      };
    });

    const result = await db.transaction(async (trx) => {
      const [po] = await trx("purchase_orders")
        .insert({
          po_number,
          supplier_id,
          date,
          status: "Draft",
          total_amount,
          notes: "Auto-drafted due to low stock alert"
        })
        .returning("*");

      const itemsToInsert = poItems.map(it => ({ ...it, po_id: po.id }));
      const savedItems = await trx("purchase_order_items").insert(itemsToInsert).returning("*");

      // Same "Draft" status is produced by services/reorderAutoPO.js, which
      // always routes into the approval queue — without this, two identical
      // status strings meant different real-world workflow state depending
      // on which code path created the PO.
      const { createApprovalRequest } = require("./approvalController");
      await createApprovalRequest(trx, "purchase_orders", po.id, total_amount, req.user.id);

      return { ...po, items: savedItems };
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, createAutoDraft, generatePONumber };
