const db = require("../db");
const { revokeUserRefreshTokens } = require("../services/authService");
const { auditLog } = require("../services/auditService");

// In-memory registry of SSE subscribers for live admin monitoring
const sseClients = new Set();

function broadcastMonitoringEvent(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

async function listLiveSessions(req, res, next) {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const rows = await db("store_sessions as s")
      .join("users as u", "u.id", "s.user_id")
      .whereIn("s.status", ["ACTIVE", "IDLE"])
      .andWhere("s.last_ping_at", ">=", twoHoursAgo)
      .select(
        "s.id",
        "s.user_id",
        "s.terminal_code",
        "s.shift_type",
        "s.status",
        "s.ip_address",
        "s.user_agent",
        "s.login_at",
        "s.last_ping_at",
        "u.name as user_name",
        "u.employee_code",
        "u.email as user_email"
      )
      .orderBy("s.last_ping_at", "desc");

    const now = Date.now();
    const formatted = rows.map((session) => {
      const lastPingTime = new Date(session.last_ping_at).getTime();
      const diffSec = Math.floor((now - lastPingTime) / 1000);
      let calculatedStatus = session.status;
      if (diffSec > 90) {
        calculatedStatus = "IDLE";
      } else {
        calculatedStatus = "ACTIVE";
      }
      return {
        ...session,
        status: calculatedStatus,
        idle_seconds: diffSec,
      };
    });

    // Also fetch last 10 audit log activity for live stream
    const recentActivity = await db("audit_logs")
      .orderBy("created_at", "desc")
      .limit(10);

    res.json({
      success: true,
      data: {
        active_sessions: formatted,
        total_active: formatted.filter((s) => s.status === "ACTIVE").length,
        total_idle: formatted.filter((s) => s.status === "IDLE").length,
        recent_activity: recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function terminateSession(req, res, next) {
  try {
    const sessionId = parseInt(req.params.id, 10);
    const { reason = "Terminated by administrator" } = req.body;

    const session = await db("store_sessions").where("id", sessionId).first();
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    await db("store_sessions").where("id", sessionId).update({
      status: "TERMINATED_BY_ADMIN",
      terminated_by: req.user.id,
      terminated_reason: reason,
      logout_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

    // Revoke refresh tokens for this user
    await revokeUserRefreshTokens(session.user_id);

    // Broadcast SSE event immediately so terminal receives instant lock
    broadcastMonitoringEvent("session.terminated", {
      sessionId,
      userId: session.user_id,
      reason,
      terminatedBy: req.user.name,
    });

    await auditLog(req, {
      action: "auth.session_terminated",
      resource: "store_sessions",
      resourceId: sessionId,
      metadata: { target_user_id: session.user_id, reason },
    });

    res.json({ success: true, message: "Store session terminated successfully" });
  } catch (err) {
    next(err);
  }
}

function streamLiveMonitoring(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", time: new Date() })}\n\n`);

  sseClients.add(res);

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch (e) {
      clearInterval(keepAliveInterval);
      sseClients.delete(res);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAliveInterval);
    sseClients.delete(res);
  });
}

module.exports = {
  listLiveSessions,
  terminateSession,
  streamLiveMonitoring,
  broadcastMonitoringEvent,
};
