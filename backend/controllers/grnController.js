const db = require("../db");
const { publish } = require("../services/kafkaProducer");
const { auditLog } = require("../services/auditService");
const stockLedgerService = require("../services/stockLedgerService");

// Helper to generate a unique GRN number: GRN-YYYYMMDD-XXXX
async function generateGRNNumber(dateStr) {
  const dateObj = new Date(dateStr);
  const formattedDate = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
  
  const [{ count }] = await db("goods_receipt_notes")
    .where("date", dateStr)
    .count("id as count");
  
  const seq = parseInt(count || 0) + 1;
  const seqStr = String(seq).padStart(4, "0");
  return `GRN-${formattedDate}-${seqStr}`;
}

// GET /api/grn
async function list(req, res, next) {
  try {
    const { supplier_id, po_id, date_from, date_to, q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const filter = (qb) => {
      if (supplier_id) qb.where("goods_receipt_notes.supplier_id", supplier_id);
      if (po_id) qb.where("goods_receipt_notes.po_id", po_id);
      if (date_from) qb.where("goods_receipt_notes.date", ">=", date_from);
      if (date_to) qb.where("goods_receipt_notes.date", "<=", date_to);
      if (q) {
        qb.where("goods_receipt_notes.grn_number", "ilike", `%${q}%`)
          .orWhere("suppliers.name", "ilike", `%${q}%`)
          .orWhere("goods_receipt_notes.invoice_no", "ilike", `%${q}%`);
      }
    };

    const [{ count }] = await db("goods_receipt_notes")
      .join("suppliers", "goods_receipt_notes.supplier_id", "suppliers.id")
      .modify(filter)
      .count("goods_receipt_notes.id as count");

    const rows = await db("goods_receipt_notes")
      .join("suppliers", "goods_receipt_notes.supplier_id", "suppliers.id")
      .leftJoin("purchase_orders", "goods_receipt_notes.po_id", "purchase_orders.id")
      .modify(filter)
      .select("goods_receipt_notes.*", "suppliers.name as supplier_name", "purchase_orders.po_number as po_number")
      .orderBy(sort ? `goods_receipt_notes.${sort}` : "goods_receipt_notes.date", order || "desc").orderBy("goods_receipt_notes.id", "desc")
      .offset(offset)
      .limit(limit);

    res.json({ success: true, data: rows, total: parseInt(count), page: req.pagination.page, limit });
  } catch (err) {
    next(err);
  }
}

// GET /api/grn/:id
async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    const grn = await db("goods_receipt_notes")
      .join("suppliers", "goods_receipt_notes.supplier_id", "suppliers.id")
      .leftJoin("purchase_orders", "goods_receipt_notes.po_id", "purchase_orders.id")
      .where("goods_receipt_notes.id", id)
      .select("goods_receipt_notes.*", "suppliers.name as supplier_name", "purchase_orders.po_number as po_number")
      .first();

    if (!grn) {
      return res.status(404).json({ success: false, error: "Goods Receipt Note not found." });
    }

    const items = await db("goods_receipt_items")
      .where("grn_id", id)
      .select("*")
      .orderBy("id", "asc");

    res.json({ success: true, data: { ...grn, items } });
  } catch (err) {
    next(err);
  }
}

// POST /api/grn
async function create(req, res, next) {
  try {
    const { po_id, supplier_id, date, invoice_no, received_by, remarks, items } = req.body;

    const supplier = await db("suppliers").where("id", supplier_id).first();
    if (!supplier) {
      return res.status(400).json({ success: false, error: "Supplier not found." });
    }

    if (invoice_no) {
      const existing = await db("goods_receipt_notes")
        .where("supplier_id", supplier_id)
        .andWhereRaw("LOWER(invoice_no) = LOWER(?)", [invoice_no.trim()])
        .first();
      if (existing) {
        return res.status(400).json({ success: false, error: `Invoice number '${invoice_no}' has already been processed for this supplier (GRN #${existing.grn_number}).` });
      }
    }

    if (po_id) {
      const po = await db("purchase_orders").where("id", po_id).first();
      if (!po) {
        return res.status(400).json({ success: false, error: "Associated Purchase Order not found." });
      }
    }

    const grn_number = await generateGRNNumber(date);

    // Compute total and prepare records
    let total_amount = 0;
    items.forEach(it => {
      total_amount += it.landed_cost;
    });

    const result = await db.transaction(async (trx) => {
      let poItems = [];
      if (po_id) {
        poItems = await trx("purchase_order_items").where("po_id", po_id).forUpdate();
      }

      // 1. Insert GRN header
      const [grn] = await trx("goods_receipt_notes")
        .insert({
          grn_number,
          po_id: po_id || null,
          supplier_id,
          date,
          invoice_no: invoice_no || null,
          received_by: received_by || null,
          remarks: remarks || null,
          total_amount
        })
        .returning("*");

      // 2. Insert GRN items and corresponding stock batches
      const savedItems = [];
      for (const it of items) {
        if (po_id) {
          const poItem = poItems.find(p => p.item_code === it.item_code || p.name.toLowerCase() === it.name.toLowerCase());
          if (!poItem) {
            throw new Error(`Item '${it.name || it.item_code}' is not part of Purchase Order #${po_id}.`);
          }

          // Qty Cap check
          const prevReceived = await trx("goods_receipt_items")
            .join("goods_receipt_notes", "goods_receipt_items.grn_id", "goods_receipt_notes.id")
            .where("goods_receipt_notes.po_id", po_id)
            .andWhere("goods_receipt_items.item_code", it.item_code)
            .sum("goods_receipt_items.qty_received as total");
          const totalPrev = parseFloat(prevReceived[0].total || 0);
          const maxAllowed = parseFloat(poItem.qty);
          if (totalPrev + parseFloat(it.qty_received) > maxAllowed) {
            throw new Error(`Cannot receive ${it.qty_received} units for '${it.name}'. Total received so far would be ${totalPrev + parseFloat(it.qty_received)}, which exceeds PO ordered quantity of ${maxAllowed}.`);
          }

          // Landed Cost unit price variance check (10% tolerance)
          if (parseFloat(it.unit_price) > parseFloat(poItem.unit_price) * 1.10) {
            throw new Error(`Unit price for '${it.name}' (${it.unit_price}) exceeds PO price (${poItem.unit_price}) by more than 10% tolerance.`);
          }
        }
        const [savedItem] = await trx("goods_receipt_items")
          .insert({
            grn_id: grn.id,
            item_code: it.item_code,
            name: it.name,
            qty_ordered: it.qty_ordered !== undefined ? it.qty_ordered : null,
            qty_received: it.qty_received,
            qty_accepted: it.qty_accepted,
            qty_rejected: it.qty_rejected,
            unit: it.unit,
            unit_price: it.unit_price,
            landed_cost: it.landed_cost,
            batch_no: it.batch_no || null,
            expiry_date: it.expiry_date || null
          })
          .returning("*");

        savedItems.push(savedItem);

        // 3. Add accepted quantities into stock as a tracked batch
        if (it.qty_accepted > 0) {
          const generatedBatch = it.batch_no || `BAT-${date.replace(/-/g, "")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const unitRate = it.qty_accepted > 0 ? (it.landed_cost / it.qty_accepted) : it.unit_price;
          
          const [stockBatch] = await trx("stock").insert({
            name: it.name,
            qty: it.qty_accepted,
            remaining: it.qty_accepted,
            unit: it.unit,
            date: date,
            price: unitRate,
            supplier: supplier.name,
            supplier_id: supplier.id,
            expiry_date: it.expiry_date || null,
            min_alert_qty: null,
            item_code: it.item_code,
            batch_no: generatedBatch,
            grn_item_id: savedItem.id,
            invoice_no: invoice_no || null
          }).returning("*");

          await stockLedgerService.recordEntry(trx, {
            stock_id: stockBatch.id,
            item_code: stockBatch.item_code,
            item_name: stockBatch.name,
            category: stockBatch.category,
            transaction_type: "INWARD_GRN",
            qty: parseFloat(stockBatch.qty),
            unit: stockBatch.unit,
            unit_price: parseFloat(stockBatch.price) || 0,
            batch_no: stockBatch.batch_no,
            department: "CENTRAL STORE",
            supplier: supplier.name,
            invoice_no: invoice_no || null,
            reference_doc_type: "GRN",
            reference_doc_id: grn.id,
            reference_doc_no: grn.grn_number,
            reason: po_id ? `Received against PO #${po_id}` : "Direct Inward GRN",
            notes: remarks || null,
            created_by: received_by || req.user?.name || "Storekeeper"
          });
        }
      }

      // 4. Update PO status if receiving against PO
      if (po_id) {
        await trx("purchase_orders")
          .where("id", po_id)
          .update({
            status: "Received",
            updated_at: trx.fn.now()
          });
      }

      return { ...grn, items: savedItems };
    });

    publish("grn-events", { type: "grn.create", id: result.id, grn_number: result.grn_number, total_amount: result.total_amount });
    publish("stock-events", { type: "stock.grn_receive", grn_id: result.id, items: result.items.map(i => ({ item_code: i.item_code, qty_accepted: i.qty_accepted })) });
    await auditLog(req, { action: "grn.create", resource: "grn", resourceId: result.id, after: result });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/grn/:id (Optional support to reverse receiving)
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const grn = await db("goods_receipt_notes").where("id", id).first();
    if (!grn) {
      return res.status(404).json({ success: false, error: "Goods Receipt Note not found." });
    }

    await db.transaction(async (trx) => {
      // Removing GRN automatically cascades to goods_receipt_items and deletes linked stock rows due to foreign key onDelete("CASCADE")
      await trx("goods_receipt_notes").where("id", id).del();
      
      // If was linked to PO, revert status back to Sent if there are no other GRNs for this PO
      if (grn.po_id) {
        const otherGrns = await trx("goods_receipt_notes").where("po_id", grn.po_id).whereNot("id", id).first();
        if (!otherGrns) {
          await trx("purchase_orders").where("id", grn.po_id).update({ status: "Sent" });
        }
      }
    });

    publish("grn-events", { type: "grn.delete", id: grn.id, grn_number: grn.grn_number });
    await auditLog(req, { action: "grn.delete", resource: "grn", resourceId: grn.id, before: grn });
    res.json({ success: true, message: "Goods Receipt Note deleted and stock levels reversed successfully." });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, remove };
