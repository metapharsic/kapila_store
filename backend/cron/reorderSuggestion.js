const db = require("../db");
const { publish } = require("../services/kafkaProducer");
const { sendNotification } = require("../controllers/notificationController");
const { resolveRoleId, RECIPIENT_ROLE_KEYS } = require("../services/cronNotifyRecipients");

// #1 smart reorder suggestion — beyond static min_alert_qty. Uses real 15-day
// issuance consumption to compute avg daily use, suggests a 7-day reorder qty
// for items whose remaining stock covers fewer than COVER_DAYS days forward.
const COVER_DAYS = 5;      // alert if stock lasts < 5 days
const REORDER_DAYS = 7;    // suggest topping up to 7 days

async function suggestReorders() {
  console.log("[ReorderSuggestion] Computing consumption-based reorders...");
  try {
    const rows = await db.raw(
      `SELECT s.item_code, s.name,
              SUM(s.remaining) AS remaining,
              COALESCE((
                SELECT SUM(ii.issued) FROM issuance_items ii
                JOIN issuances i ON i.id = ii.issuance_id
                WHERE ii.item_code = s.item_code AND i.date >= CURRENT_DATE - 15
              ), 0) AS issued_15d
       FROM stock s WHERE s.remaining > 0
       GROUP BY s.item_code, s.name`
    );

    const suggestions = [];
    for (const r of rows.rows) {
      const avgDaily = (parseFloat(r.issued_15d) || 0) / 15;
      if (avgDaily <= 0) continue; // no consumption history, skip
      const remaining = parseFloat(r.remaining) || 0;
      const daysLeft = remaining / avgDaily;
      if (daysLeft < COVER_DAYS) {
        const suggestQty = Math.ceil(avgDaily * REORDER_DAYS - remaining);
        if (suggestQty > 0) {
          suggestions.push({ item_code: r.item_code, name: r.name, days_left: +daysLeft.toFixed(1), suggest_qty: suggestQty });
        }
      }
    }

    if (suggestions.length) {
      await publish("stock-events", { type: "stock.reorder_suggestion", count: suggestions.length, items: suggestions.slice(0, 20) });

      // Resolve role ONCE before sending — not inside a per-item loop
      const recipientId = await resolveRoleId(RECIPIENT_ROLE_KEYS.manager, "ReorderSuggestion");
      if (recipientId) {
        const top = suggestions.slice(0, 10).map((s) => `${s.name}: buy ~${s.suggest_qty} (${s.days_left}d left)`).join("; ");
        await sendNotification({
          recipient_role_id: recipientId,
          title: `Reorder suggestions — ${suggestions.length} item(s)`,
          message: top + (suggestions.length > 10 ? ` +${suggestions.length - 10} more` : ""),
          type: "reorder_suggestion",
          severity: "info",
          metadata: { count: suggestions.length },
        });
      }
    }
    console.log(`[ReorderSuggestion] Done. ${suggestions.length} suggestion(s).`);
  } catch (err) {
    console.error("[ReorderSuggestion] Error:", err);
  }
}

module.exports = suggestReorders;
