const db = require("../db");
const { sendWhatsApp } = require("./whatsapp");

/**
 * ============================================================================
 * Automatic Alert Service — Real-Time Intimation to Admin & Store Manager
 * 
 * Automatically sends:
 * 1. In-App Notifications (stored in `notifications` for 'admin' & 'store_manager' roles)
 * 2. WhatsApp Direct Intimation (if phone numbers configured in .env)
 * 
 * Triggers:
 * - On Indent Raised: notifies immediately with item count and estimated value.
 * - On Issuance Completed: notifies immediately with item count and issued value.
 * ============================================================================
 */

/**
 * Intimates Admin & Store Manager immediately when an indent is raised.
 */
async function notifyIndentRaised({
  indent,
  items = [],
  totalValue = null,
  itemCount = null,
  user = null,
  dept = null,
  shift = null,
  priority = null,
  remarks = null,
}) {
  try {
    const indentId = indent?.id;
    const cleanDept = (dept || indent?.dept || "KITCHEN").toUpperCase().trim();
    const count = itemCount != null ? itemCount : (items.length || 0);

    // Compute total value if not provided
    let val = totalValue;
    if (val == null) {
      val = items.reduce((sum, it) => {
        const qty = parseFloat(it.qty) || 0;
        const rate = parseFloat(it.unit_price || it.price || it.default_cost || it.estimated_rate || 0);
        return sum + (qty * rate);
      }, 0);
    }
    const totalValNum = parseFloat(val) || 0;
    const formattedVal = totalValNum.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const creatorName = user?.name || user?.username || indent?.submittedBy || "Chef / Kitchen Station";
    const shiftName = shift || indent?.shift || "NIGHT_INDENT";
    const priorityName = (priority || indent?.priority || "NORMAL").toUpperCase();
    const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    // 1. In-app notifications to Admin and Store Manager roles
    const targetRoles = await db("roles")
      .whereIn("key", ["admin", "store_manager"])
      .select("id", "key");

    for (const role of targetRoles) {
      await db("notifications").insert({
        recipient_role_id: role.id,
        title: `📋 New Indent: ${cleanDept} (#${indentId})`,
        message: `${creatorName} raised indent #${indentId} for ${cleanDept} with ${count} items valued at ₹${formattedVal} awaiting Store action.${remarks ? ` Note: "${remarks.trim()}"` : ""}`,
        type: "approval_pending",
        severity: priorityName === "URGENT" || priorityName === "EMERGENCY" ? "critical" : "info",
        is_read: false,
        metadata: JSON.stringify({
          module: "indents",
          resource_id: indentId,
          dept: cleanDept,
          item_count: count,
          total_value: totalValNum,
          shift: shiftName,
          priority: priorityName,
          created_at: new Date().toISOString(),
        }),
        created_at: new Date(),
        updated_at: new Date(),
      }).catch((e) => console.warn(`[AutoAlert] Failed to insert indent notification for ${role.key}:`, e.message));
    }

    // 2. WhatsApp Direct Intimation to Admin and Store Manager
    const whatsappMsg = [
      `📋 *HOTEL KAPILA — NEW INDENT RAISED*`,
      `• Department: *${cleanDept}*`,
      `• Indent ID: *#${indentId}*`,
      `• Items Count: *${count} items*`,
      `• Total Value: *₹${formattedVal}*`,
      `• Shift: *${shiftName}*`,
      `• Priority: *${priorityName}*`,
      `• Raised By: *${creatorName}*`,
      `• Time: *${timeStr}*`,
      remarks ? `• Notes: _"${remarks.trim()}"_` : null,
      ``,
      `👉 _Automatically intimated to Admin & Store Manager._`,
    ].filter(Boolean).join("\n");

    const recipients = [
      { label: "admin", number: process.env.ADMIN_WHATSAPP_NUMBER },
      { label: "store_manager", number: process.env.STORE_MANAGER_WHATSAPP_NUMBER },
    ].filter((r) => r.number);

    for (const r of recipients) {
      try {
        await sendWhatsApp(r.number, whatsappMsg);
      } catch (err) {
        console.warn(`[AutoAlert] WhatsApp send to ${r.label} failed:`, err.message);
      }
    }

    return { success: true, count, totalValue: totalValNum, intimated: true };
  } catch (err) {
    console.error("[AutoAlert] notifyIndentRaised error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Intimates Admin & Store Manager immediately when an issuance is completed.
 */
async function notifyIssuanceCompleted({
  issuance,
  items = [],
  totalIssuedValue = null,
  itemCount = null,
  user = null,
  dept = null,
  indentId = null,
  issueSlipNumber = null,
}) {
  try {
    const issuanceId = issuance?.id;
    const cleanDept = (dept || issuance?.dept || "KITCHEN").toUpperCase().trim();
    const effectiveIndentId = indentId || issuance?.indent_id;
    const slipNo = issueSlipNumber || issuance?.reference_doc_no || `ISS-${issuanceId}`;

    // Filter items with positive issued quantities
    const positiveItems = items.filter((it) => (parseFloat(it.issued ?? it.qty) || 0) > 0);
    const count = itemCount != null ? itemCount : (positiveItems.length || items.length || 0);

    // Compute total issued value if not provided
    let val = totalIssuedValue;
    if (val == null) {
      val = items.reduce((sum, it) => {
        const qty = parseFloat(it.issued ?? it.qty) || 0;
        const rate = parseFloat(it.unit_price || it.price || 0);
        return sum + (qty * rate);
      }, 0);
    }
    const totalValNum = parseFloat(val) || 0;
    const formattedVal = totalValNum.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const issuerName = user?.name || user?.username || "Storekeeper / Central Store";
    const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    // 1. In-app notifications to Admin and Store Manager roles
    const targetRoles = await db("roles")
      .whereIn("key", ["admin", "store_manager"])
      .select("id", "key");

    for (const role of targetRoles) {
      await db("notifications").insert({
        recipient_role_id: role.id,
        title: `📦 Materials Issued: ${cleanDept} (#${issuanceId})`,
        message: `Central Store issued ${count} items valued at ₹${formattedVal} to ${cleanDept} (${slipNo}${effectiveIndentId ? `, Indent #${effectiveIndentId}` : ""}) by ${issuerName}.`,
        type: "approval_action",
        severity: "info",
        is_read: false,
        metadata: JSON.stringify({
          module: "issuances",
          resource_id: issuanceId,
          indent_id: effectiveIndentId,
          dept: cleanDept,
          item_count: count,
          total_value: totalValNum,
          issue_slip: slipNo,
          issued_at: new Date().toISOString(),
        }),
        created_at: new Date(),
        updated_at: new Date(),
      }).catch((e) => console.warn(`[AutoAlert] Failed to insert issuance notification for ${role.key}:`, e.message));
    }

    // 2. WhatsApp Direct Intimation to Admin and Store Manager
    const whatsappMsg = [
      `📦 *HOTEL KAPILA — MATERIAL ISSUANCE COMPLETED*`,
      `• Department: *${cleanDept}*`,
      `• Issuance Slip: *${slipNo}* (#${issuanceId})`,
      effectiveIndentId ? `• Linked Indent: *#${effectiveIndentId}*` : `• Dispatch Type: *Direct Store Draw*`,
      `• Items Issued: *${count} items*`,
      `• Total Issued Value: *₹${formattedVal}*`,
      `• Dispatched By: *${issuerName}*`,
      `• Time: *${timeStr}*`,
      ``,
      `👉 _Stock ledger and station balances updated automatically._`,
    ].join("\n");

    const recipients = [
      { label: "admin", number: process.env.ADMIN_WHATSAPP_NUMBER },
      { label: "store_manager", number: process.env.STORE_MANAGER_WHATSAPP_NUMBER },
    ].filter((r) => r.number);

    for (const r of recipients) {
      try {
        await sendWhatsApp(r.number, whatsappMsg);
      } catch (err) {
        console.warn(`[AutoAlert] WhatsApp send to ${r.label} failed:`, err.message);
      }
    }

    return { success: true, count, totalIssuedValue: totalValNum, intimated: true };
  } catch (err) {
    console.error("[AutoAlert] notifyIssuanceCompleted error:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  notifyIndentRaised,
  notifyIssuanceCompleted,
};
