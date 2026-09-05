const db = require("../db");
const { generateShiftHandoffSummary } = require("../services/localAI");

async function getLatest(req, res, next) {
  try {
    const latest = await db("shift_handoffs")
      .orderBy("created_at", "desc")
      .first();
    res.json({ success: true, data: latest || null });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { shift_type, note } = req.body;
    if (!shift_type || !note) {
      return res.status(400).json({ success: false, error: "shift_type and note are required." });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const userId = req.user?.id || null;

    // Aggregate today's activities to feed the AI Summary
    const [issuances, grns, indents] = await Promise.all([
      db("issuances")
        .where("date", todayStr)
        .select("id", "dept"),
      db("goods_receipt_notes")
        .where("date", todayStr)
        .select("id", "supplier_id"),
      db("indents")
        .whereRaw("date = ?", [todayStr])
        .select("id", "dept", "status")
    ]);

    const activities = [
      ...issuances.map(i => `Material Issuance issued to department ${i.dept}`),
      ...grns.map(g => `Goods Receipt Note recorded for supplier ID ${g.supplier_id}`),
      ...indents.map(ind => `Indent request from ${ind.dept} is currently ${ind.status}`)
    ];

    // Generate AI Summary of system activities combined with user comments
    const ai_summary = await generateShiftHandoffSummary(activities, note);

    const [inserted] = await db("shift_handoffs")
      .insert({
        shift_date: todayStr,
        shift_type,
        user_id: userId,
        note,
        ai_summary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .onConflict(["shift_date", "shift_type"])
      .merge(["note", "ai_summary", "user_id", "updated_at"])
      .returning("*");

    res.json({
      success: true,
      data: inserted || { shift_date: todayStr, shift_type, note, ai_summary }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLatest, create };
