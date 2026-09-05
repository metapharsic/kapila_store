const db = require("../db");
const { publish } = require("../services/kafkaProducer");
const { auditLog } = require("../services/auditService");

async function generateReturnNumber(dateStr) {
  const dateObj = new Date(dateStr);
  const formattedDate = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
  const [{ count }] = await db("returns").where("date", dateStr).count("id as count");
  const seq = parseInt(count || 0) + 1;
  const seqStr = String(seq).padStart(4, "0");
  return `RET-${formattedDate}-${seqStr}`;
}

async function list(req, res, next) {
  try {
    const { department, status, limit = 50, offset = 0 } = req.query;
    const query = db("returns");
    if (department) query.where("department", department);
    if (status) query.where("status", status);
    const result = await query.orderBy("created_at", "desc").limit(limit).offset(offset);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    const ret = await db("returns").where("id", id).first();
    if (!ret) return res.status(404).json({ success: false, error: "Return not found." });
    const items = await db("return_items").where("return_id", id);
    res.json({ success: true, data: { ...ret, items } });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { date, department, items, remarks } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: "At least one item is required." });
    }

    const return_number = await generateReturnNumber(date || new Date().toISOString().slice(0, 10));
    const initiated_by = req.user ? (req.user.name || req.user.username || req.user.email) : "System";

    const result = await db.transaction(async (trx) => {
      const [ret] = await trx("returns")
        .insert({
          return_number,
          date: date || trx.fn.now(),
          department,
          status: "Pending",
          remarks: remarks || null,
          initiated_by
        })
        .returning("*");

      const itemsToInsert = items.map(it => ({
        return_id: ret.id,
        item_code: it.item_code,
        name: it.name,
        qty: parseFloat(it.qty),
        unit: it.unit
      }));

      const saved = await trx("return_items").insert(itemsToInsert).returning("*");
      return { ...ret, items: saved };
    });

    publish("return-events", { type: "return.create", id: result.id, return_number: result.return_number });
    await auditLog(req, { action: "returns.create", resource: "returns", resourceId: result.id, after: result });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function approve(req, res, next) {
  try {
    const { id } = req.params;
    const ret = await db("returns").where("id", id).first();
    if (!ret) return res.status(404).json({ success: false, error: "Return not found." });
    if (ret.status !== "Pending") {
      return res.status(400).json({ success: false, error: `Return is already ${ret.status}.` });
    }

    const items = await db("return_items").where("return_id", id);

    const result = await db.transaction(async (trx) => {
      // Approve the return
      const [updated] = await trx("returns")
        .where("id", id)
        .update({ status: "Approved", updated_at: trx.fn.now() })
        .returning("*");

      // Add stock back into store inventory
      for (const it of items) {
        // Find latest batch price to use as cost basis
        const latestBatch = await trx("stock")
          .where("item_code", it.item_code)
          .orderBy("date", "desc")
          .first();

        const price = latestBatch ? parseFloat(latestBatch.price) : 0.0;

        await trx("stock").insert({
          name: it.name,
          item_code: it.item_code,
          qty: it.qty,
          remaining: it.qty,
          unit: it.unit,
          date: ret.date,
          price,
          supplier: `Return from ${ret.department}`
        });
      }

      return { ...updated, items };
    });

    publish("return-events", { type: "return.approve", id: result.id, return_number: result.return_number });
    await auditLog(req, { action: "returns.approve", resource: "returns", resourceId: result.id, after: result });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, approve };
