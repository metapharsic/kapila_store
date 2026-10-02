const db = require("../db");
const { getDepartmentNames } = require("../services/permissionService");

// Severity tier derived from action verb — purely rule-based, no LLM
const SEVERITY_MAP = {
  delete: "critical", destroy: "critical", reset: "critical", purge: "critical",
  remove: "high",    reject: "high",     revoke: "high",    ban: "high",
  update: "medium",  edit: "medium",     approve: "medium", patch: "medium",
  create: "low",     add: "low",         import: "low",     export: "low",
  view:   "info",    list: "info",       login: "info",     logout: "info",
};

function deriveSeverity(action = "") {
  const verb = (action || "").toLowerCase().split(".").pop().split("_")[0];
  return SEVERITY_MAP[verb] || "info";
}

function buildFilter(qb, params, deptNames, isAdmin) {
  const { actor_user_id, action, resource, severity, date_from, date_to,
          ip_address, department_name, search } = params;

  if (actor_user_id) qb.where("actor_user_id", actor_user_id);
  if (action)        qb.where("action", action);
  if (resource)      qb.where("resource", resource);
  if (ip_address)    qb.where("ip_address", ip_address);
  if (department_name) qb.where("department_name", department_name);

  if (date_from) qb.where("created_at", ">=", date_from);
  if (date_to)   qb.where("created_at", "<=", date_to + " 23:59:59");

  // Free-text search across actor_name, action, resource, resource_id, ip_address
  if (search) {
    const like = `%${search}%`;
    qb.where((sub) =>
      sub.whereILike("actor_name", like)
         .orWhereILike("action", like)
         .orWhereILike("resource", like)
         .orWhereILike("resource_id", like)
         .orWhereILike("ip_address", like)
         .orWhereILike("department_name", like)
    );
  }

  // Severity filter — derived from action verb at query time
  if (severity) {
    const severityActions = Object.entries(SEVERITY_MAP)
      .filter(([, s]) => s === severity)
      .map(([verb]) => verb);
    if (severityActions.length) {
      qb.where((sub) => {
        severityActions.forEach((verb) => {
          sub.orWhereILike("action", `%${verb}%`);
        });
      });
    }
  }

  // Non-admin: scoped to own departments only
  if (!isAdmin) {
    if (deptNames && deptNames.length) {
      qb.whereIn("department_name", deptNames);
    } else {
      qb.whereRaw("1 = 0");
    }
  }
}

// GET /api/audit-logs
async function list(req, res, next) {
  try {
    const page  = Math.max(parseInt(req.query.page  || "1",   10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 500);
    const offset = (page - 1) * limit;
    const isAdmin = req.user.isAdmin;
    const deptNames = !isAdmin ? await getDepartmentNames(req.user) : null;

    const filter = (qb) => buildFilter(qb, req.query, deptNames, isAdmin);

    const [{ count }] = await db("audit_logs").modify(filter).count("id as count");
    const rows = await db("audit_logs")
      .modify(filter)
      .orderBy([{ column: "created_at", order: "desc" }, { column: "id", order: "desc" }])
      .offset(offset).limit(limit)
      .select(
        "id", "actor_user_id", "actor_name", "action", "resource",
        "resource_id", "department_id", "department_name",
        "before", "after", "metadata", "ip_address", "user_agent", "created_at"
      );

    // Attach severity to each row
    const enriched = rows.map((r) => ({ ...r, severity: deriveSeverity(r.action) }));

    res.json({ success: true, data: enriched, total: parseInt(count), page, limit });
  } catch (err) { next(err); }
}

// GET /api/audit-logs/stats  — KPI telemetry for dashboard cards
async function stats(req, res, next) {
  try {
    const isAdmin = req.user.isAdmin;
    const deptNames = !isAdmin ? await getDepartmentNames(req.user) : null;
    const filter = (qb) => {
      if (!isAdmin && deptNames?.length) qb.whereIn("department_name", deptNames);
      else if (!isAdmin)                qb.whereRaw("1 = 0");
    };

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
    const monthAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);

    const [total, todayCount, weekCount, monthCount] = await Promise.all([
      db("audit_logs").modify(filter).count("id as c").first(),
      db("audit_logs").modify(filter).where("created_at", ">=", today).count("id as c").first(),
      db("audit_logs").modify(filter).where("created_at", ">=", weekAgo).count("id as c").first(),
      db("audit_logs").modify(filter).where("created_at", ">=", monthAgo).count("id as c").first(),
    ]);

    // Top actors (last 30 days)
    const topActors = await db("audit_logs")
      .modify(filter)
      .where("created_at", ">=", monthAgo)
      .whereNotNull("actor_name")
      .groupBy("actor_name")
      .select("actor_name")
      .count("id as actions")
      .orderBy("actions", "desc")
      .limit(5);

    // Top resources (last 30 days)
    const topResources = await db("audit_logs")
      .modify(filter)
      .where("created_at", ">=", monthAgo)
      .groupBy("resource")
      .select("resource")
      .count("id as hits")
      .orderBy("hits", "desc")
      .limit(6);

    // Action breakdown by severity buckets (last 30 days)
    const actionBreakdown = await db("audit_logs")
      .modify(filter)
      .where("created_at", ">=", monthAgo)
      .groupBy("action")
      .select("action")
      .count("id as count")
      .orderBy("count", "desc")
      .limit(20);

    // Daily activity last 14 days
    const dailyActivity = await db("audit_logs")
      .modify(filter)
      .where("created_at", ">=", new Date(now - 14 * 86400000).toISOString().slice(0, 10))
      .select(db.raw("DATE(created_at) as day"))
      .count("id as count")
      .groupByRaw("DATE(created_at)")
      .orderBy("day", "asc");

    // Severity breakdown
    const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    actionBreakdown.forEach(({ action, count: c }) => {
      const sev = deriveSeverity(action);
      severityBreakdown[sev] = (severityBreakdown[sev] || 0) + parseInt(c);
    });

    res.json({
      success: true,
      data: {
        total: parseInt(total.c),
        today: parseInt(todayCount.c),
        thisWeek: parseInt(weekCount.c),
        thisMonth: parseInt(monthCount.c),
        topActors,
        topResources,
        dailyActivity,
        severityBreakdown,
        actionBreakdown: actionBreakdown.map((a) => ({
          ...a,
          count: parseInt(a.count),
          severity: deriveSeverity(a.action),
        })),
      },
    });
  } catch (err) { next(err); }
}

// GET /api/audit-logs/distinct  — dropdown population
async function distinct(req, res, next) {
  try {
    const isAdmin = req.user.isAdmin;
    const deptNames = !isAdmin ? await getDepartmentNames(req.user) : null;
    const filter = (qb) => {
      if (!isAdmin && deptNames?.length) qb.whereIn("department_name", deptNames);
      else if (!isAdmin)                qb.whereRaw("1 = 0");
    };

    const [actions, resources, departments, actors] = await Promise.all([
      db("audit_logs").modify(filter).distinct("action").whereNotNull("action").orderBy("action").pluck("action"),
      db("audit_logs").modify(filter).distinct("resource").whereNotNull("resource").orderBy("resource").pluck("resource"),
      db("audit_logs").modify(filter).distinct("department_name").whereNotNull("department_name").orderBy("department_name").pluck("department_name"),
      db("audit_logs").modify(filter).distinct("actor_name", "actor_user_id").whereNotNull("actor_name").orderBy("actor_name").select("actor_name", "actor_user_id"),
    ]);

    res.json({ success: true, data: { actions, resources, departments, actors } });
  } catch (err) { next(err); }
}

// GET /api/audit-logs/:id  — single log detail with full before/after diff
async function detail(req, res, next) {
  try {
    const row = await db("audit_logs").where("id", req.params.id).first();
    if (!row) return res.status(404).json({ success: false, message: "Audit log not found" });
    res.json({ success: true, data: { ...row, severity: deriveSeverity(row.action) } });
  } catch (err) { next(err); }
}

// GET /api/audit-logs/export  — CSV download
async function exportCsv(req, res, next) {
  try {
    const isAdmin = req.user.isAdmin;
    const deptNames = !isAdmin ? await getDepartmentNames(req.user) : null;
    const filter = (qb) => buildFilter(qb, req.query, deptNames, isAdmin);

    const rows = await db("audit_logs")
      .modify(filter)
      .orderBy("created_at", "desc")
      .limit(5000)
      .select("id", "created_at", "actor_name", "action", "resource",
              "resource_id", "department_name", "ip_address", "user_agent");

    const header = ["ID", "Timestamp", "Actor", "Action", "Resource", "Resource ID",
                    "Department", "Severity", "IP Address", "User Agent"];
    const csvRows = rows.map((r) => [
      r.id,
      new Date(r.created_at).toISOString(),
      r.actor_name || "System",
      r.action,
      r.resource,
      r.resource_id || "",
      r.department_name || "",
      deriveSeverity(r.action),
      r.ip_address || "",
      (r.user_agent || "").replace(/,/g, ";"),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [header.join(","), ...csvRows].join("\r\n");
    const filename = `kapila-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) { next(err); }
}

module.exports = { list, stats, distinct, detail, exportCsv };
