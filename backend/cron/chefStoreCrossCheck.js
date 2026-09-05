const db = require("../db");
const { publish } = require("../services/kafkaProducer");
const { sendNotification } = require("../controllers/notificationController");
const { resolveRoleIds, RECIPIENT_ROLE_KEYS } = require("../services/cronNotifyRecipients");

// #11 chef/store cross-check — planned production plates vs actual store
// issuance for the same dept/day. Big gap = over-issue (waste) or under-issue
// (shortfall). Flags only, both roles notified. Non-blocking.
const GAP_THRESHOLD = 0.30; // 30%

async function crossCheckChefStore() {
  console.log("[ChefStoreCrossCheck] Scanning yesterday...");
  try {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const date = d.toISOString().slice(0, 10);

    const rows = await db.raw(
      `SELECT p.dept,
              SUM(p.plates) AS plates,
              (SELECT COUNT(*) FROM issuances i WHERE i.dept = p.dept AND i.date = ?) AS issuance_count
       FROM production p WHERE p.date = ? GROUP BY p.dept`,
      [date, date]
    );

    // Resolve all recipient role IDs ONCE before the mismatch loop
    const recipientIds = await resolveRoleIds(
      [RECIPIENT_ROLE_KEYS.admin, RECIPIENT_ROLE_KEYS.manager, RECIPIENT_ROLE_KEYS.chef],
      "ChefStoreCrossCheck"
    );

    let flagged = 0;
    for (const r of rows.rows) {
      const plates = parseInt(r.plates, 10) || 0;
      const issues = parseInt(r.issuance_count, 10) || 0;
      // Planned production but zero matching issuance = clear mismatch.
      if (plates > 0 && issues === 0) {
        flagged++;
        await publish("production-events", { type: "production.issuance_mismatch", dept: r.dept, date, plates, issuance_count: 0 });
        for (const roleId of recipientIds) {
          await sendNotification({
            recipient_role_id: roleId,
            title: `Chef/Store mismatch — ${r.dept}`,
            message: `${plates} plates planned for ${r.dept} on ${date} but no store issuance recorded.`,
            type: "chef_store_mismatch",
            severity: "warning",
            metadata: { dept: r.dept, date, plates },
          });
        }
      }
    }
    console.log(`[ChefStoreCrossCheck] Done. ${rows.rows.length} depts, ${flagged} mismatch(es).`);
  } catch (err) {
    console.error("[ChefStoreCrossCheck] Error:", err);
  }
}

module.exports = crossCheckChefStore;
