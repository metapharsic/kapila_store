const db = require("../db");

// Thresholds are env-overridable so ops can tune per deployment without a code change.
const AMOUNT_THRESHOLD = parseFloat(process.env.HIGH_VALUE_ALERT_AMOUNT || "") || 20000;
const QTY_THRESHOLD = parseFloat(process.env.HIGH_VALUE_ALERT_QTY || "") || 100;

// Fires a CRITICAL in-app notification to both admin and store_manager roles
// when an indent/issuance breaches an absolute value or quantity threshold.
// Non-blocking by design — a false positive must never trap a legitimate order.
async function checkHighValueAlert({ module, id, dept, creatorUserId, lineItems, occurredAt }) {
  try {
    const totalValue = lineItems.reduce((sum, it) => sum + (parseFloat(it.value) || 0), 0);
    const totalQty = lineItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);
    const topItem = lineItems.reduce(
      (max, it) => ((parseFloat(it.value) || 0) > (parseFloat(max?.value) || 0) ? it : max),
      null
    );

    const breached = totalValue > AMOUNT_THRESHOLD || totalQty > QTY_THRESHOLD;
    if (!breached) return;

    const creator = creatorUserId ? await db("users").where("id", creatorUserId).first() : null;
    const managerName = creator ? creator.name : "Unknown";
    const time = (occurredAt ? new Date(occurredAt) : new Date()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const label = module === "indent" ? "Indent" : "Issuance";

    const message =
      `HIGH VALUE ${label.toUpperCase()} ALERT\n` +
      `Department: ${dept}\n` +
      `${label} #: ${id}\n` +
      `Manager: ${managerName}\n` +
      `Time: ${time}\n` +
      `Items: ${lineItems.length}\n` +
      `Total Value: Rs.${totalValue.toFixed(2)}` +
      (topItem ? `\nHigh Value Item: ${topItem.name} (Rs.${(parseFloat(topItem.value) || 0).toFixed(2)})` : "");

    const { sendNotification } = require("../controllers/notificationController");
    const [adminRole, smRole] = await Promise.all([
      db("roles").where({ key: "admin" }).first(),
      db("roles").where({ key: "store_manager" }).first(),
    ]);

    const metadata = {
      module,
      id,
      dept,
      managerName,
      time,
      itemCount: lineItems.length,
      totalValue,
      totalQty,
      highValueItem: topItem ? { name: topItem.name, value: parseFloat(topItem.value) || 0 } : null,
    };

    const title = `High Value ${label} Alert — ${label} #${id}`;
    const sends = [];
    if (adminRole) {
      sends.push(sendNotification({ recipient_role_id: adminRole.id, title, message, type: `${module}_high_value`, severity: "critical", metadata }));
    }
    if (smRole) {
      sends.push(sendNotification({ recipient_role_id: smRole.id, title, message, type: `${module}_high_value`, severity: "critical", metadata }));
    }
    await Promise.all(sends);
  } catch (err) {
    console.error(`[HighValueAlert] Failed to raise alert for ${module} #${id}:`, err.message);
  }
}

module.exports = {
  checkHighValueAlert,
  AMOUNT_THRESHOLD,
  QTY_THRESHOLD,
};
