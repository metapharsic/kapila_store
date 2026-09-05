import db from "../db";

export interface AuditLogEntry {
  action: string;
  resource: string;
  resourceId?: number | string;
  departmentId?: number | string;
  departmentName?: string;
  before?: any;
  after?: any;
  metadata?: any;
}

export async function auditLog(req: any, entry: AuditLogEntry): Promise<void> {
  try {
    await db("audit_logs").insert({
      actor_user_id: req.user?.id || null,
      actor_name: req.user?.name || null,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId ? String(entry.resourceId) : null,
      department_id: entry.departmentId || null,
      department_name: entry.departmentName || null,
      before: entry.before || null,
      after: entry.after || null,
      metadata: entry.metadata || null,
      ip_address: req.ip || null,
      user_agent: req.get?.("user-agent") || null,
    });
  } catch (err: any) {
    console.error("Audit log failed:", err.message);
  }
}
