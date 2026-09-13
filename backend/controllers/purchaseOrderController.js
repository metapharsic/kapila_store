const db = require("../db");
const { publish } = require("../services/kafkaProducer");
const { auditLog } = require("../services/auditService");

// Helper to generate a unique PO number: PO-YYYYMMDD-XXXX
async function generatePONumber(dateStr) {
  const dateObj = new Date(dateStr);
  const formattedDate = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
  
  const [{ count }] = await db("purchase_orders")
    .whereRaw("po_number LIKE ?", [`PO-${formattedDate}-%`])
    .count("id as count");
  
  let seq = parseInt(count || 0) + 1;
  let candidate = `PO-${formattedDate}-${String(seq).padStart(4, "0")}`;
  while (await db("purchase_orders").where("po_number", candidate).first()) {
    seq++;
    candidate = `PO-${formattedDate}-${String(seq).padStart(4, "0")}`;
  }
  return candidate;
}

// GET /api/purchase-orders
async function list(req, res, next) {
  try {
    const { supplier_id, status, date_from, date_to, q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const filter = (qb) => {
      if (supplier_id) qb.where("purchase_orders.supplier_id", supplier_id);
      if (status && status !== "ALL") {
        if (status.toLowerCase() === "pending") {
          qb.where((b) => b.whereRaw("LOWER(purchase_orders.status) = ?", ["pending"]).orWhereRaw("LOWER(purchase_orders.status) = ?", ["pending approval"]));
        } else {
          qb.whereRaw("LOWER(purchase_orders.status) = ?", [status.toLowerCase()]);
        }
      }
      if (date_from) qb.where("purchase_orders.date", ">=", date_from);
      if (date_to) qb.where("purchase_orders.date", "<=", date_to);
      if (q) {
        qb.where((b) => {
          b.where("purchase_orders.po_number", "ilike", `%${q}%`)
            .orWhere("suppliers.name", "ilike", `%${q}%`);
        });
      }
    };

    const [{ count }] = await db("purchase_orders")
      .leftJoin("suppliers", "purchase_orders.supplier_id", "suppliers.id")
      .modify(filter)
      .count("purchase_orders.id as count");

    const rows = await db("purchase_orders")
      .leftJoin("suppliers", "purchase_orders.supplier_id", "suppliers.id")
      .modify(filter)
      .select(
        "purchase_orders.*", 
        "suppliers.name as supplier_name",
        "suppliers.phone as supplier_phone",
        "suppliers.gstin as supplier_gstin",
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

    // Verify unit compatibility against existing stock
    const { areUnitsCompatible } = require("../utils/units");
    const itemCodes = items.map(i => (i.item_code || "").trim().toUpperCase()).filter(Boolean);
    const itemNames = items.map(i => (i.name || "").trim().toLowerCase()).filter(Boolean);

    const existingStocks = await db("stock")
      .where((qb) => {
        if (itemCodes.length) qb.whereIn(db.raw("UPPER(item_code)"), itemCodes);
        if (itemNames.length) qb.orWhereIn(db.raw("LOWER(name)"), itemNames);
      })
      .select("item_code", "name", "unit");

    const stockMap = new Map();
    for (const s of existingStocks) {
      if (s.item_code) stockMap.set(s.item_code.trim().toUpperCase(), s);
      if (s.name) stockMap.set(s.name.trim().toLowerCase(), s);
    }

    for (const it of items) {
      const codeKey = (it.item_code || "").trim().toUpperCase();
      const nameKey = (it.name || "").trim().toLowerCase();
      const matched = (codeKey && stockMap.get(codeKey)) || stockMap.get(nameKey);
      if (matched && matched.unit && !areUnitsCompatible(it.unit, matched.unit, it.name)) {
        return res.status(400).json({
          success: false,
          error: `Item '${it.name}' unit '${it.unit}' is dimensionally incompatible with inventory stock unit '${matched.unit}'.`
        });
      }
    }

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

// POST /api/purchase-orders/:id/items
async function appendItem(req, res, next) {
  try {
    const { id } = req.params;
    const { item_code, name, qty, unit, unit_price } = req.body;

    if (!name || !qty || Number(qty) <= 0 || unit_price === undefined || Number(unit_price) < 0) {
      return res.status(400).json({ success: false, error: "Valid item name, positive quantity, and non-negative unit price are required." });
    }

    const existing = await db("purchase_orders").where("id", id).first();
    if (!existing) {
      return res.status(404).json({ success: false, error: "Purchase Order not found." });
    }

    if (existing.status === "Received") {
      return res.status(400).json({ success: false, error: "Cannot append items to a received Purchase Order." });
    }

    const q = Number(qty);
    const p = Number(unit_price);
    const lineTotal = q * p;

    const result = await db.transaction(async (trx) => {
      const [newItem] = await trx("purchase_order_items").insert({
        po_id: id,
        item_code: (item_code || "").trim().toUpperCase() || null,
        name: name.trim(),
        qty: q,
        unit: unit || "kg",
        unit_price: p,
        total_price: lineTotal
      }).returning("*");

      const newTotal = Number(existing.total_amount || 0) + lineTotal;

      const [updatedPo] = await trx("purchase_orders")
        .where("id", id)
        .update({
          total_amount: newTotal,
          updated_at: trx.fn.now()
        })
        .returning("*");

      const allItems = await trx("purchase_order_items")
        .where("po_id", id)
        .orderBy("id", "asc");

      return { ...updatedPo, items: allItems, addedItem: newItem };
    });

    publish("purchase-order-events", { type: "purchase_order.append_item", id: existing.id, item_code, qty: q });
    await auditLog(req, {
      action: "purchase_orders.append_item",
      resource: "purchase_orders",
      resourceId: existing.id,
      after: result
    });

    res.json({ success: true, data: result, message: `Appended ${name} to PO successfully.` });
  } catch (err) {
    next(err);
  }
}

// POST /api/purchase-orders/provision
async function provision(req, res, next) {
  try {
    const result = await db.transaction(async (trx) => {
      // 1. Seed or find suppliers
      const standardSuppliers = [
        { name: "Sri Lakshmi Agro & Rice Mills", contact_name: "Ramesh Reddy", phone: "+91 98490 12345", email: "orders@srilakshmiagro.com", gstin: "36AAACL1234F1Z1", address: "Plot 12, IDA Nacharam, Hyderabad", rating: 4.8 },
        { name: "Metro Wholesale Cash & Carry", contact_name: "Vikram Malhotra", phone: "+91 98480 23456", email: "b2b@metrowholesale.in", gstin: "36AABCM5678G1Z2", address: "Moosapet Cross Road, Kukatpally, Hyderabad", rating: 4.9 },
        { name: "Royal Spices & Condiments", contact_name: "Mohammad Arif", phone: "+91 98491 34567", email: "sales@royalspices.com", gstin: "36AACCR9012H1Z3", address: "Begum Bazar, Old City, Hyderabad", rating: 4.6 },
        { name: "Vijaya Dairy & Milk Producers", contact_name: "Suresh Kumar", phone: "+91 98492 45678", email: "dist@vijayadairy.com", gstin: "36AADCV3456J1Z4", address: "Lalapet, Secunderabad", rating: 4.7 },
        { name: "Balaji Fresh Produce & Vegetables", contact_name: "K. Balaji", phone: "+91 98493 56789", email: "balajiproduce@gmail.com", gstin: "36AAACB7890K1Z5", address: "Bowenpally Market Yard, Secunderabad", rating: 4.5 },
        { name: "Godrej Agrovet & Poultry", contact_name: "Anand Joshi", phone: "+91 98494 67890", email: "orders@godrejagrovet.com", gstin: "36AACCG1122L1Z6", address: "Medchal Highway, Hyderabad", rating: 4.8 }
      ];

      const supplierMap = {};
      for (const s of standardSuppliers) {
        let sup = await trx("suppliers").where("name", s.name).first();
        if (!sup) {
          const [created] = await trx("suppliers").insert(s).returning("*");
          sup = created;
        }
        supplierMap[s.name] = sup.id;
      }

      // 2. Seed supplier rate quotes
      const uid = req.user?.id || 1;
      const quotesToSeed = [
        { item_code: "KPL-113", item_name: "Badam", unit: "kg", supplier_name: "Royal Spices & Condiments", supplier_id: supplierMap["Royal Spices & Condiments"], quoted_rate: 880, notes: "California Whole Grade-A (Wholesale)", quoted_by: uid },
        { item_code: "KPL-113", item_name: "Badam", unit: "kg", supplier_name: "Metro Wholesale Cash & Carry", supplier_id: supplierMap["Metro Wholesale Cash & Carry"], quoted_rate: 895, notes: "Bulk 10kg pack", quoted_by: uid },
        { item_code: "KPL-113", item_name: "Badam", unit: "kg", supplier_name: "Sri Lakshmi Agro & Rice Mills", supplier_id: supplierMap["Sri Lakshmi Agro & Rice Mills"], quoted_rate: 910, notes: "Local distributor rate", quoted_by: uid },

        { item_code: "KPL-427", item_name: "Tugar Dal", unit: "kg", supplier_name: "Sri Lakshmi Agro & Rice Mills", supplier_id: supplierMap["Sri Lakshmi Agro & Rice Mills"], quoted_rate: 110, notes: "Unpolished Desi Toor Dal", quoted_by: uid },
        { item_code: "KPL-427", item_name: "Tugar Dal", unit: "kg", supplier_name: "Metro Wholesale Cash & Carry", supplier_id: supplierMap["Metro Wholesale Cash & Carry"], quoted_rate: 114, notes: "50kg Gunny Bag pack", quoted_by: uid },
        { item_code: "KPL-427", item_name: "Tugar Dal", unit: "kg", supplier_name: "Royal Spices & Condiments", supplier_id: supplierMap["Royal Spices & Condiments"], quoted_rate: 118, notes: "Standard retail bag", quoted_by: uid },

        { item_code: "KPL-428", item_name: "Turmeric Powder", unit: "kg", supplier_name: "Royal Spices & Condiments", supplier_id: supplierMap["Royal Spices & Condiments"], quoted_rate: 185, notes: "Pure Salem Curcumin 3.5%", quoted_by: uid },
        { item_code: "KPL-428", item_name: "Turmeric Powder", unit: "kg", supplier_name: "Metro Wholesale Cash & Carry", supplier_id: supplierMap["Metro Wholesale Cash & Carry"], quoted_rate: 195, notes: "1kg institutional foil pack", quoted_by: uid },

        { item_code: "KPL-161", item_name: "Cherries", unit: "kg", supplier_name: "Balaji Fresh Produce & Vegetables", supplier_id: supplierMap["Balaji Fresh Produce & Vegetables"], quoted_rate: 260, notes: "Fresh dessert cherries (A grade)", quoted_by: uid },
        { item_code: "KPL-161", item_name: "Cherries", unit: "kg", supplier_name: "Metro Wholesale Cash & Carry", supplier_id: supplierMap["Metro Wholesale Cash & Carry"], quoted_rate: 275, notes: "Cold chain imported", quoted_by: uid },

        { item_code: "KPL-183", item_name: "Coke", unit: "bottle", supplier_name: "Metro Wholesale Cash & Carry", supplier_id: supplierMap["Metro Wholesale Cash & Carry"], quoted_rate: 18.5, notes: "Case of 24x300ml glass", quoted_by: uid },
        { item_code: "KPL-183", item_name: "Coke", unit: "bottle", supplier_name: "Sri Lakshmi Agro & Rice Mills", supplier_id: supplierMap["Sri Lakshmi Agro & Rice Mills"], quoted_rate: 19.5, notes: "Beverage crate delivery", quoted_by: uid },

        { item_code: "KPL-426", item_name: "Towels", unit: "pcs", supplier_name: "Metro Wholesale Cash & Carry", supplier_id: supplierMap["Metro Wholesale Cash & Carry"], quoted_rate: 135, notes: "100% Cotton Hotel Kitchen Napkins", quoted_by: uid }
      ];

      for (const q of quotesToSeed) {
        const hasQuote = await trx("supplier_rate_quotes")
          .where({ item_code: q.item_code, supplier_name: q.supplier_name })
          .first();
        if (!hasQuote) {
          await trx("supplier_rate_quotes").insert({
            ...q,
            created_at: trx.fn.now(),
            updated_at: trx.fn.now()
          });
        }
      }

      // 3. Seed realistic Purchase Orders across lifecycle statuses
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const daysAgo2 = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      const daysAgo3 = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      const daysAgo5 = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
      const daysAgo7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const in3days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

      const demoPOs = [
        {
          po_number: "PO-" + today.replace(/-/g, "") + "-0001",
          supplier_id: supplierMap["Sri Lakshmi Agro & Rice Mills"],
          date: today,
          status: "Draft",
          notes: `Expected Delivery: ${tomorrow} | Terms: Net 30 | Notes: Routine monthly staple replenishment for main kitchen`,
          items: [
            { item_code: "KPL-427", name: "Tugar Dal", qty: 50, unit: "kg", unit_price: 110 },
            { item_code: "KPL-428", name: "Turmeric Powder", qty: 20, unit: "kg", unit_price: 190 }
          ]
        },
        {
          po_number: "PO-" + yesterday.replace(/-/g, "") + "-0002",
          supplier_id: supplierMap["Royal Spices & Condiments"],
          date: yesterday,
          status: "Pending",
          notes: `Expected Delivery: ${in3days} | Terms: Net 15 | Notes: Premium dry fruits batch for banquet kitchen. Requires Store Manager approval.`,
          items: [
            { item_code: "KPL-113", name: "Badam", qty: 25, unit: "kg", unit_price: 880 },
            { item_code: "KPL-428", name: "Turmeric Powder", qty: 15, unit: "kg", unit_price: 185 }
          ]
        },
        {
          po_number: "PO-" + daysAgo2.replace(/-/g, "") + "-0003",
          supplier_id: supplierMap["Metro Wholesale Cash & Carry"],
          date: daysAgo2,
          status: "Approved",
          notes: `Expected Delivery: ${today} | Terms: COD | Notes: Restaurant bar & beverage stock. Approved by GM, awaiting inward dispatch.`,
          items: [
            { item_code: "KPL-183", name: "Coke", qty: 200, unit: "bottle", unit_price: 18.5 },
            { item_code: "KPL-426", name: "Towels", qty: 40, unit: "pcs", unit_price: 135 }
          ]
        },
        {
          po_number: "PO-" + daysAgo3.replace(/-/g, "") + "-0004",
          supplier_id: supplierMap["Balaji Fresh Produce & Vegetables"],
          date: daysAgo3,
          status: "Sent",
          notes: `Expected Delivery: ${today} | Terms: Immediate | Notes: Fresh produce delivery sent via WhatsApp. Truck in transit.`,
          items: [
            { item_code: "KPL-161", name: "Cherries", qty: 30, unit: "kg", unit_price: 260 },
            { item_code: "KPL-427", name: "Tugar Dal", qty: 20, unit: "kg", unit_price: 114 }
          ]
        },
        {
          po_number: "PO-" + daysAgo5.replace(/-/g, "") + "-0005",
          supplier_id: supplierMap["Sri Lakshmi Agro & Rice Mills"],
          date: daysAgo5,
          status: "Received",
          notes: `Expected Delivery: ${daysAgo3} | Terms: Net 30 | Notes: Inward receipt verified via GRN #GRN-0908-01. Stock batches updated.`,
          items: [
            { item_code: "KPL-427", name: "Tugar Dal", qty: 100, unit: "kg", unit_price: 110 }
          ]
        },
        {
          po_number: "PO-" + daysAgo7.replace(/-/g, "") + "-0006",
          supplier_id: supplierMap["Royal Spices & Condiments"],
          date: daysAgo7,
          status: "Cancelled",
          notes: `Expected Delivery: ${daysAgo5} | Terms: COD | Notes: Cancelled due to duplicate indent request from Tiffins section.`,
          items: [
            { item_code: "KPL-113", name: "Badam", qty: 5, unit: "kg", unit_price: 890 }
          ]
        }
      ];

      let createdCount = 0;
      for (const poData of demoPOs) {
        let existingPo = await trx("purchase_orders").where("po_number", poData.po_number).first();
        if (!existingPo) {
          const total_amount = poData.items.reduce((sum, it) => sum + (it.qty * it.unit_price), 0);
          const [newPo] = await trx("purchase_orders").insert({
            po_number: poData.po_number,
            supplier_id: poData.supplier_id,
            date: poData.date,
            status: poData.status,
            notes: poData.notes,
            total_amount,
            created_at: trx.fn.now(),
            updated_at: trx.fn.now()
          }).returning("*");

          const itemsToInsert = poData.items.map(it => ({
            po_id: newPo.id,
            item_code: it.item_code,
            name: it.name,
            qty: it.qty,
            unit: it.unit,
            unit_price: it.unit_price,
            total_price: it.qty * it.unit_price
          }));
          await trx("purchase_order_items").insert(itemsToInsert);
          createdCount++;
        }
      }

      return {
        suppliersCount: Object.keys(supplierMap).length,
        quotesCount: quotesToSeed.length,
        posCreated: createdCount
      };
    });

    res.json({
      success: true,
      message: `Provisioned ${result.posCreated} purchase orders, ${result.suppliersCount} suppliers, and ${result.quotesCount} supplier rate quotes.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  createAutoDraft,
  appendItem,
  provision,
  generatePONumber
};

