const db = require("../db");
const { publish } = require("../services/kafkaProducer");

// GET /api/suppliers
async function list(req, res, next) {
  try {
    const { q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const filter = (qb) => {
      if (q) {
        qb.where("name", "ilike", `%${q}%`)
          .orWhere("contact_name", "ilike", `%${q}%`)
          .orWhere("phone", "ilike", `%${q}%`)
          .orWhere("email", "ilike", `%${q}%`)
          .orWhere("gstin", "ilike", `%${q}%`);
      }
    };

    const [{ count }] = await db("suppliers").modify(filter).count("id as count");
    const rows = await db("suppliers").modify(filter)
      .select("*")
      .orderBy([
        { column: sort || "name", order: order || "asc" },
        { column: "id", order: "desc" }
      ])
      .offset(offset)
      .limit(limit);

    const enrichedRows = [];
    for (const r of rows) {
      const perf = await db("goods_receipt_notes")
        .leftJoin("purchase_orders", "goods_receipt_notes.po_id", "purchase_orders.id")
        .leftJoin("goods_receipt_items", "goods_receipt_notes.id", "goods_receipt_items.grn_id")
        .where("goods_receipt_notes.supplier_id", r.id)
        .select(
          db.raw("AVG(CASE WHEN goods_receipt_notes.po_id IS NOT NULL AND goods_receipt_notes.date >= purchase_orders.date THEN (goods_receipt_notes.date - purchase_orders.date) ELSE NULL END) as avg_lead_time_days"),
          db.raw("ROUND((COALESCE(SUM(goods_receipt_items.qty_accepted), 0) / NULLIF(SUM(goods_receipt_items.qty_ordered), 0) * 100)::numeric, 1) as fulfillment_rate")
        )
        .first();

      let leadTimeScore = 100;
      if (perf && perf.avg_lead_time_days !== null) {
        const days = parseFloat(perf.avg_lead_time_days);
        if (days <= 2) leadTimeScore = 100;
        else if (days === 3) leadTimeScore = 80;
        else if (days === 4) leadTimeScore = 60;
        else leadTimeScore = 40;
      }
      const fulfillmentRate = perf && perf.fulfillment_rate ? parseFloat(perf.fulfillment_rate) : 100;
      const score = Math.round(0.4 * leadTimeScore + 0.6 * fulfillmentRate);

      enrichedRows.push({
        ...r,
        reliability_score: score
      });
    }

    res.json({ success: true, data: enrichedRows, total: parseInt(count), page: req.pagination.page, limit });
  } catch (err) {
    next(err);
  }
}

// POST /api/suppliers
async function create(req, res, next) {
  try {
    const { name, contact_name, phone, email, gstin, address } = req.body;
    
    // Check if supplier name already exists
    const existing = await db("suppliers").whereRaw("LOWER(name) = LOWER(?)", [name.trim()]).first();
    if (existing) {
      return res.status(400).json({ success: false, error: "Supplier with this name already exists." });
    }

    const [row] = await db("suppliers")
      .insert({
        name: name.trim(),
        contact_name: contact_name || null,
        phone: phone || null,
        email: email || null,
        gstin: gstin || null,
        address: address || null
      })
      .returning("*");

    publish("supplier-events", { type: "supplier.create", id: row.id, name: row.name });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/suppliers/:id
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, contact_name, phone, email, gstin, address } = req.body;

    const existing = await db("suppliers").where("id", id).first();
    if (!existing) {
      return res.status(404).json({ success: false, error: "Supplier not found." });
    }

    if (name) {
      const duplicate = await db("suppliers")
        .whereRaw("LOWER(name) = LOWER(?)", [name.trim()])
        .whereNot("id", id)
        .first();
      if (duplicate) {
        return res.status(400).json({ success: false, error: "Another supplier with this name already exists." });
      }
    }

    const [updatedRow] = await db("suppliers")
      .where("id", id)
      .update({
        name: name ? name.trim() : existing.name,
        contact_name: contact_name !== undefined ? contact_name : existing.contact_name,
        phone: phone !== undefined ? phone : existing.phone,
        email: email !== undefined ? email : existing.email,
        gstin: gstin !== undefined ? gstin : existing.gstin,
        address: address !== undefined ? address : existing.address,
        updated_at: db.fn.now()
      })
      .returning("*");

    publish("supplier-events", { type: "supplier.update", id: updatedRow.id, name: updatedRow.name });
    res.json({ success: true, data: updatedRow });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/suppliers/:id
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    
    // Check if supplier is linked to any POs
    const hasPOs = await db("purchase_orders").where("supplier_id", id).first();
    if (hasPOs) {
      return res.status(400).json({ success: false, error: "Cannot delete supplier. They have existing Purchase Orders." });
    }

    // Check if supplier is linked to any GRNs
    const hasGRNs = await db("goods_receipt_notes").where("supplier_id", id).first();
    if (hasGRNs) {
      return res.status(400).json({ success: false, error: "Cannot delete supplier. They have existing Goods Receipt Notes." });
    }

    const deletedCount = await db("suppliers").where("id", id).del();
    if (deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Supplier not found." });
    }

    publish("supplier-events", { type: "supplier.delete", id: parseInt(id) });
    res.json({ success: true, message: "Supplier deleted successfully." });
  } catch (err) {
    next(err);
  }
}

// GET /api/suppliers/:id/performance
async function getPerformance(req, res, next) {
  try {
    const { id } = req.params;
    const supplier = await db("suppliers").where("id", id).first();
    if (!supplier) {
      return res.status(404).json({ success: false, error: "Supplier not found." });
    }

    // 1. PO stats
    const poStats = await db("purchase_orders")
      .where("supplier_id", id)
      .select(
        db.raw("COUNT(id) as total_pos"),
        db.raw("COALESCE(SUM(total_amount), 0) as total_spend"),
        db.raw("COUNT(id) FILTER (WHERE status = 'Received') as completed_pos"),
        db.raw("COUNT(id) FILTER (WHERE status = 'Sent') as pending_pos")
      )
      .first();

    // 2. Recent POs
    const recentPOs = await db("purchase_orders")
      .where("supplier_id", id)
      .select("id", "po_number", "date", "status", "total_amount")
      .orderBy("date", "desc")
      .limit(5);

    // 3. Unique Items supplied with last price
    // We can pull from stock batches where supplier_id = id or matching supplier name
    const itemsSupplied = await db("stock")
      .where("supplier_id", id)
      .orWhereRaw("LOWER(supplier) = LOWER(?)", [supplier.name])
      .select("name", "item_code", "unit")
      .max("date as last_purchase_date")
      .avg("price as avg_price")
      .max("price as last_price")
      .count("id as total_batches")
      .groupBy("name", "item_code", "unit")
      .orderBy("name", "asc");

    // 4. Fulfillment metrics
    const perfStats = await db("goods_receipt_notes")
      .leftJoin("purchase_orders", "goods_receipt_notes.po_id", "purchase_orders.id")
      .leftJoin("goods_receipt_items", "goods_receipt_notes.id", "goods_receipt_items.grn_id")
      .where("goods_receipt_notes.supplier_id", id)
      .select(
        db.raw("AVG(CASE WHEN goods_receipt_notes.po_id IS NOT NULL AND goods_receipt_notes.date >= purchase_orders.date THEN (goods_receipt_notes.date - purchase_orders.date) ELSE NULL END) as avg_lead_time_days"),
        db.raw("ROUND((COALESCE(SUM(goods_receipt_items.qty_accepted), 0) / NULLIF(SUM(goods_receipt_items.qty_ordered), 0) * 100)::numeric, 1) as fulfillment_rate")
      )
      .first();

    // 5. Price history records for this supplier to build trend visualizers
    const priceHistory = await db("stock")
      .where("supplier_id", id)
      .orWhereRaw("LOWER(supplier) = LOWER(?)", [supplier.name])
      .select("name", "price", "date")
      .whereNotNull("price")
      .orderBy("date", "desc");

    let leadTimeScore = 100;
    if (perfStats && perfStats.avg_lead_time_days !== null) {
      const days = parseFloat(perfStats.avg_lead_time_days);
      if (days <= 2) leadTimeScore = 100;
      else if (days === 3) leadTimeScore = 80;
      else if (days === 4) leadTimeScore = 60;
      else leadTimeScore = 40;
    }
    const fulfillmentRate = perfStats && perfStats.fulfillment_rate ? parseFloat(perfStats.fulfillment_rate) : 100;
    const score = Math.round(0.4 * leadTimeScore + 0.6 * fulfillmentRate);

    res.json({
      success: true,
      data: {
        supplier: {
          ...supplier,
          reliability_score: score
        },
        stats: {
          total_pos: parseInt(poStats.total_pos || 0),
          total_spend: parseFloat(poStats.total_spend || 0),
          completed_pos: parseInt(poStats.completed_pos || 0),
          pending_pos: parseInt(poStats.pending_pos || 0),
          avg_lead_time_days: perfStats && perfStats.avg_lead_time_days ? Math.round(parseFloat(perfStats.avg_lead_time_days) * 10) / 10 : null,
          fulfillment_rate: perfStats && perfStats.fulfillment_rate ? parseFloat(perfStats.fulfillment_rate) : null,
          reliability_score: score
        },
        recentPOs,
        itemsSupplied,
        priceHistory
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, getPerformance };
