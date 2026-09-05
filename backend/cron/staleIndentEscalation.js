const db = require("../db");
const { sendNotification } = require("../controllers/notificationController");

// approved-but-never-issued is a silent dead end today (5 real indents proved
// it: 2+ days stuck, zero issuances, nothing surfaced anywhere). Two-stage
// nudge: Store Manager first, Admin if it's still stuck after that.
const SM_NOTIFY_HOURS = 2;
const ADMIN_NOTIFY_HOURS = 8;

async function escalateStaleIndents() {
  const smRole = await db("roles").where({ key: "store_manager" }).first();
  const adminRole = await db("roles").where({ key: "admin" }).first();
  if (!smRole || !adminRole) return;

  const stuck = await db("indents as i")
    .where("i.status", "approved")
    .whereNotExists(function () {
      this.select("*").from("issuances as iss").whereRaw("iss.indent_id = i.id");
    })
    .select("i.id", "i.dept", "i.created_at", "i.sm_notified_at", "i.admin_notified_at");

  const now = Date.now();
  let smCount = 0, adminCount = 0;

  for (const indent of stuck) {
    const ageHours = (now - new Date(indent.created_at).getTime()) / 3600000;

    if (ageHours >= ADMIN_NOTIFY_HOURS && !indent.admin_notified_at) {
      await sendNotification({
        recipient_role_id: adminRole.id,
        title: `Indent Stuck ${ADMIN_NOTIFY_HOURS}h+ — Never Issued`,
        message: `Indent #${indent.id} (${indent.dept}) was approved ${Math.round(ageHours)}h ago and still has no issuance. Store manager was already notified — needs admin attention.`,
        type: "indent_stale",
        severity: "critical",
        metadata: { indent_id: indent.id },
      });
      await db("indents").where({ id: indent.id }).update({ admin_notified_at: db.fn.now() });
      adminCount++;
    } else if (ageHours >= SM_NOTIFY_HOURS && !indent.sm_notified_at) {
      await sendNotification({
        recipient_role_id: smRole.id,
        title: `Indent Ready to Issue`,
        message: `Indent #${indent.id} (${indent.dept}) was approved ${Math.round(ageHours)}h ago and is waiting for issuance.`,
        type: "indent_stale",
        severity: "warning",
        metadata: { indent_id: indent.id },
      });
      await db("indents").where({ id: indent.id }).update({ sm_notified_at: db.fn.now() });
      smCount++;
    }
  }

  if (smCount || adminCount) {
    console.log(`[CRON] Stale indent escalation: ${smCount} SM notice(s), ${adminCount} Admin escalation(s).`);
  }
}

module.exports = escalateStaleIndents;
