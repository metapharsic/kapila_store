const db = require("../db");
const { publish } = require("../services/kafkaProducer");
const { sendNotification } = require("../controllers/notificationController");
const { resolveRoleId, RECIPIENT_ROLE_KEYS } = require("../services/cronNotifyRecipients");

async function checkPredictiveStockouts() {
  console.log("[PredictiveStockout] Checking for items running out in under 3 days...");
  try {
    const rows = await db.raw(
      `SELECT s.item_code, s.name, s.unit,
              SUM(s.remaining) AS remaining,
              COALESCE((
                SELECT SUM(ii.issued) FROM issuance_items ii
                JOIN issuances i ON i.id = ii.issuance_id
                WHERE ii.item_code = s.item_code AND i.date >= CURRENT_DATE - 15
              ), 0) AS issued_15d
       FROM stock s WHERE s.remaining > 0
       GROUP BY s.item_code, s.name, s.unit`
    );

    const alerts = [];
    for (const r of rows.rows) {
      const avgDaily = (parseFloat(r.issued_15d) || 0) / 15;
      if (avgDaily <= 0) continue; // no consumption history, skip
      const remaining = parseFloat(r.remaining) || 0;
      const daysLeft = remaining / avgDaily;
      if (daysLeft < 3.0) {
        alerts.push({
          item_code: r.item_code,
          name: r.name,
          unit: r.unit,
          remaining: +remaining.toFixed(2),
          days_left: +daysLeft.toFixed(1),
          daily_rate: +avgDaily.toFixed(2)
        });
      }
    }

    if (alerts.length) {
      await publish("stock-events", { type: "stock.predictive_stockout_alert", count: alerts.length, items: alerts });

      // Resolve role ONCE before the alerts loop — not inside the loop
      const recipientId = await resolveRoleId(RECIPIENT_ROLE_KEYS.manager, "PredictiveStockout");

      for (const alert of alerts) {
        if (recipientId) {
          await sendNotification({
            recipient_role_id: recipientId,
            title: `Predictive Stockout Alert: ${alert.name}`,
            message: `${alert.name} will run out in ${alert.days_left} days! Remaining: ${alert.remaining} ${alert.unit} (Daily Usage: ${alert.daily_rate} ${alert.unit}).`,
            type: "predictive_stockout",
            severity: "critical",
            metadata: alert
          });
        }
      }
    }
    console.log(`[PredictiveStockout] Done. Generated ${alerts.length} critical alert(s).`);
  } catch (err) {
    console.error("[PredictiveStockout] Error:", err);
  }
}

module.exports = checkPredictiveStockouts;
