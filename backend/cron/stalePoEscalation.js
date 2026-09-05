const db = require("../db");
const { sendNotification } = require("../controllers/notificationController");

const SM_NOTIFY_HOURS = 2;
const ADMIN_NOTIFY_HOURS = 8;

async function escalateStalePOs() {
  const smRole = await db("roles").where({ key: "store_manager" }).first();
  const adminRole = await db("roles").where({ key: "admin" }).first();
  if (!smRole || !adminRole) return;

  const stuck = await db("purchase_orders")
    .where("status", "Pending")
    .select("id", "po_number", "created_at", "sm_notified_at", "admin_notified_at");

  const now = Date.now();
  let smCount = 0, adminCount = 0;

  for (const po of stuck) {
    const ageHours = (now - new Date(po.created_at).getTime()) / 3600000;

    if (ageHours >= ADMIN_NOTIFY_HOURS && !po.admin_notified_at) {
      await sendNotification({
        recipient_role_id: adminRole.id,
        title: `PO Stuck ${ADMIN_NOTIFY_HOURS}h+ — Pending Approval`,
        message: `PO #${po.po_number} was created ${Math.round(ageHours)}h ago and is still pending approval. Escalated to Admin.`,
        type: "po_stale",
        severity: "critical",
        metadata: { po_id: po.id },
      });
      await db("purchase_orders").where({ id: po.id }).update({ admin_notified_at: db.fn.now() });
      adminCount++;
    } else if (ageHours >= SM_NOTIFY_HOURS && !po.sm_notified_at) {
      await sendNotification({
        recipient_role_id: smRole.id,
        title: `PO Pending Approval Nudge`,
        message: `PO #${po.po_number} has been pending approval for ${Math.round(ageHours)}h.`,
        type: "po_stale",
        severity: "warning",
        metadata: { po_id: po.id },
      });
      await db("purchase_orders").where({ id: po.id }).update({ sm_notified_at: db.fn.now() });
      smCount++;
    }
  }

  if (smCount || adminCount) {
    console.log(`[CRON] Stale PO escalation: ${smCount} SM notice(s), ${adminCount} Admin escalation(s).`);
  }
}

module.exports = escalateStalePOs;
