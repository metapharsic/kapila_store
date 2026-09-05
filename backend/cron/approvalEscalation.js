const db = require("../db");
const { sendNotification } = require("../controllers/notificationController");

const ESCALATION_HOURS = 4;
const REESCALATE_HOURS = 4; // don't spam — re-notify at most once per window

// Runs periodically: any approval_request stuck pending past ESCALATION_HOURS
// gets escalated to Admin so a store-manager-out-of-hotel never blocks the chain.
async function escalateStaleApprovals() {
  const adminRole = await db("roles").where({ key: "admin" }).first();
  if (!adminRole) return;

  const cutoff = new Date(Date.now() - ESCALATION_HOURS * 3600 * 1000).toISOString();
  const reescalateCutoff = new Date(Date.now() - REESCALATE_HOURS * 3600 * 1000).toISOString();

  const stale = await db("approval_requests")
    .where("status", "pending")
    .andWhere("created_at", "<=", cutoff)
    .andWhere((qb) => {
      qb.whereNull("escalated_at").orWhere("escalated_at", "<=", reescalateCutoff);
    });

  for (const request of stale) {
    await sendNotification({
      recipient_role_id: adminRole.id,
      title: `Approval Overdue (${ESCALATION_HOURS}h+)`,
      message: `${request.module} request (ID: ${request.resource_id}) has been pending ${ESCALATION_HOURS}+ hours with no action. Escalated to Admin.`,
      type: "approval_escalation",
      severity: "critical",
      metadata: { module: request.module, resource_id: request.resource_id, request_id: request.id },
    });
    await db("approval_requests").where({ id: request.id }).update({ escalated_at: db.fn.now() });
  }

  if (stale.length) {
    console.log(`[CRON] Escalated ${stale.length} stale approval request(s) to Admin.`);
  }
}

module.exports = escalateStaleApprovals;
