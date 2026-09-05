const db = require("../db");
const { generateShiftHandoffSummary, suggestReorderQuantity } = require("../services/localAI");

async function getHandoffSummary(req, res, next) {
  try {
    const { userNotes = "" } = req.query;

    // Get events logged in the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const events = await db("kafka_event_log")
      .where("created_at", ">=", cutoff)
      .orderBy("created_at", "asc");

    // Clean up event payload list for Gemini context
    const activities = events.map(ev => {
      let payload = {};
      try {
        payload = typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload;
      } catch (e) {
        payload = { raw: ev.payload };
      }
      return {
        topic: ev.topic,
        type: payload.type,
        time: ev.created_at,
        details: payload
      };
    });

    const summary = await generateShiftHandoffSummary(activities, userNotes);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
}

async function getReorderSuggestion(req, res, next) {
  try {
    const { item_code } = req.params;

    const rp = await db("reorder_points").where("item_code", item_code).first();
    if (!rp) {
      return res.status(404).json({ success: false, error: "Reorder point configuration not found for this item." });
    }

    // Query 15-day stock levels history
    const cutoff = new Date(Date.now() - 15 * 86400 * 1000).toISOString().slice(0, 10);
    const history = await db("stock")
      .where("item_code", item_code)
      .where("date", ">=", cutoff)
      .select("date", "qty", "remaining", "price")
      .orderBy("date", "asc");

    const suggestion = await suggestReorderQuantity(history, rp);
    res.json({ success: true, data: suggestion });
  } catch (err) { next(err); }
}

module.exports = { getHandoffSummary, getReorderSuggestion };
