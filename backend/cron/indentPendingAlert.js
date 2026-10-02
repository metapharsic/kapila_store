const db = require("../db");
const { sendWhatsApp } = require("../services/whatsapp");

// Distinct from staleIndentEscalation (approved-but-not-issued) and
// approvalEscalation (generic approval_requests, 4h SLA to Admin only): this
// watches indents still sitting in "pending" (not yet approved) and pings
// BOTH Admin and Store Manager on WhatsApp once they've aged past threshold.
// Ad-hoc indents are time-sensitive by nature, so they get HALF the normal
// threshold and an urgent 🚨 prefix — genuinely more aggressive, not just
// cosmetic.
const DEFAULT_MINUTES = 30;
const DEFAULT_ADHOC_MINUTES = 15;
const RENOTIFY_COOLDOWN_MINUTES = 30; // don't re-spam the same indent every run

async function loadThresholds() {
  const thresholds = { routine: DEFAULT_MINUTES, adhoc: DEFAULT_ADHOC_MINUTES };
  try {
    const rows = await db("report_settings").whereIn("key", [
      "indent_pending_alert_minutes",
      "indent_pending_alert_adhoc_minutes",
    ]);
    rows.forEach((row) => {
      const raw = row.value;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const num = Number(parsed);
      if (!Number.isNaN(num)) {
        if (row.key === "indent_pending_alert_minutes") thresholds.routine = num;
        if (row.key === "indent_pending_alert_adhoc_minutes") thresholds.adhoc = num;
      }
    });
  } catch (err) {
    console.error("[indentPendingAlert] Failed to load report_settings, using defaults:", err.message);
  }
  return thresholds;
}

async function alertPendingIndents() {
  const thresholds = await loadThresholds();

  const pending = await db("indents")
    .where("status", "pending")
    .select("id", "dept", "created_at", "indent_type", "pending_alert_notified_at");

  const now = Date.now();
  const renotifyCutoff = new Date(now - RENOTIFY_COOLDOWN_MINUTES * 60 * 1000);
  const recipients = [process.env.ADMIN_WHATSAPP_NUMBER, process.env.STORE_MANAGER_WHATSAPP_NUMBER].filter(Boolean);

  let alertCount = 0;

  for (const indent of pending) {
    const isAdhoc = indent.indent_type === "adhoc";
    const thresholdMinutes = isAdhoc ? thresholds.adhoc : thresholds.routine;
    const ageMinutes = (now - new Date(indent.created_at).getTime()) / 60000;

    if (ageMinutes < thresholdMinutes) continue;

    // Dedup: skip if we already alerted on this indent within the cooldown window
    if (indent.pending_alert_notified_at && new Date(indent.pending_alert_notified_at) > renotifyCutoff) continue;

    const raisedAt = new Date(indent.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const roundedAge = Math.round(ageMinutes);
    const prefix = isAdhoc ? "🚨 URGENT — Ad-hoc" : "Indent";
    const message = `${prefix} Indent #${indent.id} raised by ${indent.dept} at ${raisedAt} is still pending after ${roundedAge} minutes.${
      isAdhoc ? " Ad-hoc requests need immediate action." : ""
    }`;

    if (recipients.length) {
      for (const number of recipients) {
        await sendWhatsApp(number, message).catch((e) =>
          console.error(`[indentPendingAlert] WhatsApp send failed for ${number}:`, e.message)
        );
      }
    } else {
      console.log(`[indentPendingAlert] (No WhatsApp numbers configured) ${message}`);
    }

    await db("indents").where({ id: indent.id }).update({ pending_alert_notified_at: db.fn.now() });
    alertCount++;
  }

  if (alertCount) {
    console.log(`[CRON] Indent pending alert: notified on ${alertCount} pending indent(s).`);
  }
}

module.exports = alertPendingIndents;
