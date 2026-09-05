const db = require("../db");
const { applyDepartmentScope, assertDepartmentAccess } = require("../services/permissionService");
const { publish } = require("../services/kafkaProducer");

// GET /api/leftovers
// Query params: dept, date_from, date_to, q, page, limit, sort, order
async function list(req, res, next) {
  try {
    const { dept, date_from, date_to, q } = req.query;
    const { offset, limit, sort, order } = req.pagination;

    const filter = (qb) => {
      if (dept)      qb.where("dept", dept);
      if (date_from) qb.where("date", ">=", date_from);
      if (date_to)   qb.where("date", "<=", date_to);
      if (q)         qb.whereRaw("search_vec @@ plainto_tsquery('english', ?)", [q]);
    };

    const countQuery = db("leftovers").modify(filter);
    await applyDepartmentScope(countQuery, req.user, "dept");
    const [{ count }] = await countQuery.count("id as count");
    const listQuery = db("leftovers").modify(filter);
    await applyDepartmentScope(listQuery, req.user, "dept");
    const rows = await listQuery
      .select("*").orderBy(sort, order).orderBy("id", "desc").offset(offset).limit(limit);

    res.json({ success: true, data: rows, total: parseInt(count), page: req.pagination.page, limit });
  } catch (err) { next(err); }
}

// POST /api/leftovers
async function create(req, res, next) {
  try {
    await assertDepartmentAccess(req.user, req.body.dept);
    const [row] = await db("leftovers")
      .insert({ ...req.body, carried_forward: true }).returning("*");
    publish("leftover-events", { type: "leftover.create", id: row.id, dept: row.dept });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
}

module.exports = { list, create };
