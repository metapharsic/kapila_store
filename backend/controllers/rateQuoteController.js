const db = require("../db");
const { publish } = require("../services/kafkaProducer");

// POST /api/rate-quotes — store manager records a vendor's quoted rate for an item
async function create(req, res, next) {
  try {
    const { item_code, item_name, unit, supplier_name, supplier_id, quoted_rate, notes } = req.body;
    if (!item_code || !item_name || !unit || !supplier_name || !(parseFloat(quoted_rate) > 0)) {
      return res.status(400).json({ success: false, error: "item_code, item_name, unit, supplier_name and a positive quoted_rate are required." });
    }

    const [row] = await db("supplier_rate_quotes")
      .insert({
        item_code, item_name, unit, supplier_name,
        supplier_id: supplier_id || null,
        quoted_rate: parseFloat(quoted_rate),
        notes: notes || null,
        quoted_by: req.user.id,
      })
      .returning("*");

    publish("rate-quote-events", { type: "rate_quote.create", id: row.id, item_code, supplier_name, quoted_rate: row.quoted_rate });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
}

// GET /api/rate-quotes/compare?item_code=KPL-101
// Builds the comparison report: fresh vendor quotes + last-paid price per
// supplier from actual stock history, cheapest first.
async function compare(req, res, next) {
  try {
    const { item_code } = req.query;
    if (!item_code) return res.status(400).json({ success: false, error: "item_code is required." });

    const quotes = await db("supplier_rate_quotes")
      .leftJoin("users", "supplier_rate_quotes.quoted_by", "users.id")
      .where("item_code", item_code)
      .select(
        "supplier_rate_quotes.id", "supplier_rate_quotes.supplier_name", "supplier_rate_quotes.quoted_rate",
        "supplier_rate_quotes.unit", "supplier_rate_quotes.notes", "supplier_rate_quotes.created_at",
        "users.name as quoted_by_name"
      )
      .orderBy("supplier_rate_quotes.created_at", "desc");

    const historyRows = await db("stock")
      .select("supplier")
      .max("price as last_price")
      .max("date as last_date")
      .where("item_code", item_code)
      .whereNotNull("supplier")
      .groupBy("supplier");

    const item = await db("stock").where("item_code", item_code).orderBy("id", "desc").first();

    const combined = [
      ...quotes.map((q) => ({
        source: "quote", supplier: q.supplier_name, rate: parseFloat(q.quoted_rate),
        date: q.created_at, quoted_by: q.quoted_by_name, notes: q.notes,
      })),
      ...historyRows.map((h) => ({
        source: "history", supplier: h.supplier, rate: parseFloat(h.last_price),
        date: h.last_date, quoted_by: null, notes: null,
      })),
    ].sort((a, b) => a.rate - b.rate);

    res.json({
      success: true,
      data: {
        item_code,
        item_name: item?.name || null,
        unit: item?.unit || (quotes[0]?.unit) || null,
        current_price: item?.price || null,
        rows: combined,
        cheapest: combined[0] || null,
      },
    });
  } catch (err) { next(err); }
}

module.exports = { create, compare };
