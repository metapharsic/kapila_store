/**
 * 20261002040000_add_indent_pending_alert.js
 * Minute-level WhatsApp alerting for indents stuck in "pending" (not yet
 * approved), distinct from staleIndentEscalation (approved-but-not-issued)
 * and approvalEscalation (generic approval_requests, 4h SLA). Ad-hoc indents
 * get a much shorter threshold since they're time-sensitive by nature.
 *
 * - report_settings: indent_pending_alert_minutes (routine) and
 *   indent_pending_alert_adhoc_minutes (ad-hoc), admin-configurable like the
 *   existing price_spike_pct / dormancy_days settings.
 * - indents.pending_alert_notified_at: last time this indent's pending-alert
 *   fired, so the cron re-notifies only after a cooldown instead of every run.
 */
exports.up = async (knex) => {
  await knex("report_settings")
    .insert([
      { key: "indent_pending_alert_minutes", value: JSON.stringify(30) },
      { key: "indent_pending_alert_adhoc_minutes", value: JSON.stringify(15) },
    ])
    .onConflict("key")
    .ignore();

  const hasCol = await knex.schema.hasColumn("indents", "pending_alert_notified_at");
  if (!hasCol) {
    await knex.schema.alterTable("indents", (t) => {
      t.timestamp("pending_alert_notified_at").nullable();
    });
  }
};

exports.down = async (knex) => {
  await knex("report_settings")
    .whereIn("key", ["indent_pending_alert_minutes", "indent_pending_alert_adhoc_minutes"])
    .del();

  const hasCol = await knex.schema.hasColumn("indents", "pending_alert_notified_at");
  if (hasCol) {
    await knex.schema.alterTable("indents", (t) => {
      t.dropColumn("pending_alert_notified_at");
    });
  }
};
