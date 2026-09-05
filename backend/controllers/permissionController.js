const db = require("../db");

async function list(req, res, next) {
  try {
    const rows = await db("permissions").orderBy(["resource", "action"]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

module.exports = { list };
