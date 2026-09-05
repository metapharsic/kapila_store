const db = require("../db");
const { sendNotification } = require("../controllers/notificationController");
const { resolveRoleId, RECIPIENT_ROLE_KEYS } = require("../services/cronNotifyRecipients");

// AI-standard enhancement #20: daily digest of yesterday's kafka_event_log
// activity, pushed as a real notification (not just an on-demand GET).
async function generateKafkaDigest() {
  console.log("[KafkaDigest] Building daily digest...");
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    const counts = await db("kafka_event_log")
      .whereRaw("produced_at::date = ?", [dateStr])
      .select("event_type")
      .count("id as count")
      .groupBy("event_type");

    if (counts.length === 0) {
      console.log(`[KafkaDigest] No kafka activity for ${dateStr}, skipping notification.`);
      return;
    }

    const lines = counts.map((c) => `${c.event_type}: ${c.count}`).join(", ");
    const totalEvents = counts.reduce((sum, c) => sum + parseInt(c.count, 10), 0);

    // Resolve role ONCE before sending
    const recipientId = await resolveRoleId(RECIPIENT_ROLE_KEYS.manager, "KafkaDigest");
    if (recipientId) {
      await sendNotification({
        recipient_role_id: recipientId,
        title: `Daily activity digest — ${dateStr}`,
        message: `${totalEvents} events yesterday: ${lines}`,
        type: "digest",
        severity: "info",
        metadata: { date: dateStr, counts },
      });
    }

    console.log(`[KafkaDigest] Digest sent for ${dateStr}: ${totalEvents} total events.`);
  } catch (err) {
    console.error("[KafkaDigest] Error building digest:", err);
  }
}

module.exports = generateKafkaDigest;
