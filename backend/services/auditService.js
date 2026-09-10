const db = require("../db");

/**
 * Standard enterprise audit log writer
 * Persists action history to audit_logs table
 */
async function auditLog(req, entry) {
  try {
    await db("audit_logs").insert({
      actor_user_id: req?.user?.id || null,
      actor_name: req?.user?.name || null,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId ? String(entry.resourceId) : null,
      department_id: entry.departmentId || null,
      department_name: entry.departmentName || null,
      before: entry.before ? JSON.stringify(entry.before) : null,
      after: entry.after ? JSON.stringify(entry.after) : null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      ip_address: req?.ip || null,
      user_agent: req?.get ? req.get("user-agent") : null,
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

module.exports = { auditLog };
