const db = require("../db");

// GET /api/temperature-logs
async function list(req, res, next) {
  try {
    const { location, limit = 50, offset = 0 } = req.query;
    const query = db("temperature_logs");
    if (location) {
      query.where("storage_location", "like", `%${location}%`);
    }
    const logs = await query.orderBy("created_at", "desc").limit(limit).offset(offset);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

// POST /api/temperature-logs
async function create(req, res, next) {
  try {
    const { storage_location, temperature } = req.body;
    if (!storage_location || temperature === undefined) {
      return res.status(400).json({ success: false, error: "storage_location and temperature are required." });
    }

    const recorded_by = req.user ? (req.user.name || req.user.username || req.user.email || "System") : "System";
    const [log] = await db("temperature_logs")
      .insert({
        storage_location,
        temperature: parseFloat(temperature),
        recorded_by
      })
      .returning("*");

    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create };
