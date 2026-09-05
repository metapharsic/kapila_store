const db = require("../db");
const { getDepartmentNames } = require("../services/permissionService");

async function list(req, res, next) {
  try {
    const { actor_user_id, action, resource, date_from, date_to } = req.query;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const offset = (page - 1) * limit;

    const deptNames = !req.user.isAdmin ? await getDepartmentNames(req.user) : null;

    const filter = (qb) => {
      if (actor_user_id) qb.where("actor_user_id", actor_user_id);
      if (action) qb.where("action", action);
      if (resource) qb.where("resource", resource);
      if (date_from) qb.where("created_at", ">=", date_from);
      if (date_to) qb.where("created_at", "<=", date_to);

      if (!req.user.isAdmin) {
        if (deptNames && deptNames.length) {
          qb.whereIn("department_name", deptNames);
        } else {
          qb.whereRaw("1 = 0");
        }
      }
    };
    const [{ count }] = await db("audit_logs").modify(filter).count("id as count");
    const rows = await db("audit_logs").modify(filter)
      .orderBy([
        { column: "created_at", order: "desc" },
        { column: "id", order: "desc" }
      ])
      .offset(offset).limit(limit);
    res.json({ success: true, data: rows, total: parseInt(count), page, limit });
  } catch (err) { next(err); }
}

module.exports = { list };
