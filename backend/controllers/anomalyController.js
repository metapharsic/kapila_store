const db = require("../db");

// GET /api/anomalies
async function list(req, res, next) {
  try {
    const { status } = req.query;
    
    let qb = db("anomaly_alerts").orderBy("created_at", "desc");
    if (status) {
      qb = qb.where("status", status);
    }
    
    const alerts = await qb;
    res.json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/anomalies/:id
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!["UNREAD", "ACKNOWLEDGED", "RESOLVED"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status." });
    }

    const updates = { status };
    if (status === "RESOLVED") {
      updates.resolved_at = db.fn.now();
    }

    const [alert] = await db("anomaly_alerts").where({ id }).update(updates).returning("*");
    
    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found." });
    }

    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, update };
