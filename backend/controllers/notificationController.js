const db = require("../db");

// GET /api/notifications
async function list(req, res, next) {
  try {
    const userId = req.user.id;
    
    // Get user's roles
    const userRoles = await db("user_roles")
      .join("roles", "user_roles.role_id", "roles.id")
      .where("user_roles.user_id", userId)
      .select("roles.id as role_id");
    const roleIds = userRoles.map((r) => r.role_id);

    const query = db("notifications")
      .where((qb) => {
        qb.where("recipient_user_id", userId)
          .orWhereIn("recipient_role_id", roleIds)
          .orWhere((sub) => {
            sub.whereNull("recipient_user_id").whereNull("recipient_role_id");
          });
      })
      .orderBy("created_at", "desc")
      .limit(50); // Keep it lightweight

    const alerts = await query;
    res.json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (id === "all") {
      // Mark all user notifications as read
      const userRoles = await db("user_roles").where("user_id", userId).select("role_id");
      const roleIds = userRoles.map(r => r.role_id);

      await db("notifications")
        .where((qb) => {
          qb.where("recipient_user_id", userId)
            .orWhereIn("recipient_role_id", roleIds)
            .orWhere((sub) => {
              sub.whereNull("recipient_user_id").whereNull("recipient_role_id");
            });
        })
        .update({ is_read: true });

      return res.json({ success: true, message: "All notifications marked as read." });
    }

    const [alert] = await db("notifications")
      .where({ id })
      .update({ is_read: true })
      .returning("*");

    if (!alert) {
      return res.status(404).json({ success: false, error: "Notification not found." });
    }

    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

// Helper to create notifications internally within backend
async function sendNotification({ recipient_user_id = null, recipient_role_id = null, title, message, type, severity = "info", metadata = null }) {
  try {
    const [inserted] = await db("notifications")
      .insert({
        recipient_user_id,
        recipient_role_id,
        title,
        message,
        type,
        severity,
        metadata: metadata ? JSON.stringify(metadata) : null
      })
      .returning("*");
    return inserted;
  } catch (err) {
    console.error("[NotificationService] Error creating notification:", err);
  }
}

module.exports = { list, markRead, sendNotification };
