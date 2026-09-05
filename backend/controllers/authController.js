const db = require("../db");
const bcrypt = require("bcryptjs");
const { comparePassword, hashPassword } = require("../services/passwordService");
const { getUserAuthContext } = require("../services/permissionService");
const {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshTokens,
  cookieOptions,
  publicUser,
} = require("../services/authService");
const { auditLog } = require("../services/auditService");

let monitoringController;
try {
  monitoringController = require("./monitoringController");
} catch (e) {}

const REFRESH_COOKIE = "kapila_refresh";

async function login(req, res, next) {
  try {
    const { email, password, employee_code, pin, shift_type, terminal_code } = req.body;
    let userRow = null;

    if (pin && (employee_code || email)) {
      // PIN-based fast login for store / kitchen kiosk
      userRow = await db("users")
        .where((qb) => {
          if (employee_code) qb.whereRaw("LOWER(employee_code) = LOWER(?)", [employee_code.trim()]);
          if (email) qb.orWhereRaw("LOWER(email) = LOWER(?)", [email.trim()]);
        })
        .first();

      if (!userRow || !userRow.is_active || !userRow.pin_hash || !(await bcrypt.compare(String(pin).trim(), userRow.pin_hash))) {
        await auditLog(req, {
          action: "auth.login_failed_pin",
          resource: "auth",
          metadata: { employee_code, email, terminal_code },
        });
        return res.status(401).json({ success: false, error: "Invalid Employee Code or PIN" });
      }
    } else {
      // Standard Email + Password login
      userRow = await db("users").whereRaw("LOWER(email) = LOWER(?)", [(email || "").trim()]).first();

      if (!userRow || !userRow.is_active || !(await comparePassword(password || "", userRow.password_hash))) {
        await auditLog(req, {
          action: "auth.login_failed",
          resource: "auth",
          metadata: { email },
        });
        return res.status(401).json({ success: false, error: "Invalid email or password" });
      }
    }

    await db("users").where("id", userRow.id).update({ last_login_at: db.fn.now() });
    const user = await getUserAuthContext(userRow.id);

    // Create / Record active store session
    let storeSession = null;
    try {
      // Close previous unclosed sessions for this user on this terminal
      await db("store_sessions")
        .where({ user_id: userRow.id, status: "ACTIVE" })
        .update({ status: "CLOSED", logout_at: db.fn.now() });

      const [insertedSession] = await db("store_sessions").insert({
        user_id: userRow.id,
        terminal_code: terminal_code || "STORE-MAIN-TAB-01",
        shift_type: shift_type || "Morning",
        status: "ACTIVE",
        ip_address: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
        user_agent: req.headers["user-agent"] || "unknown",
        login_at: db.fn.now(),
        last_ping_at: db.fn.now(),
      }).returning("*");
      storeSession = insertedSession;
    } catch (sessionErr) {
      console.warn("Could not record store_session:", sessionErr.message);
    }

    const sessionId = storeSession?.id;
    const accessToken = signAccessToken(user, sessionId);
    const refresh = await issueRefreshToken(user.id, req);

    res.cookie(REFRESH_COOKIE, refresh.token, cookieOptions());
    await auditLog({ ...req, user }, {
      action: "auth.login",
      resource: "auth",
      metadata: { sessionId, shift_type: shift_type || "Morning", terminal_code: terminal_code || "STORE-MAIN-TAB-01" },
    });

    if (monitoringController?.broadcastMonitoringEvent) {
      monitoringController.broadcastMonitoringEvent("session.login", {
        sessionId,
        user: publicUser(user),
        terminal_code: terminal_code || "STORE-MAIN-TAB-01",
        shift_type: shift_type || "Morning",
      });
    }

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          ...publicUser(user),
          sessionId,
          shiftType: shift_type || "Morning",
          terminalCode: terminal_code || "STORE-MAIN-TAB-01",
        },
      },
    });

    // Anomaly check
    (async () => {
      try {
        const priors = await db("audit_logs")
          .where({ actor_user_id: userRow.id, action: "auth.login" })
          .select("created_at", "ip_address", "user_agent")
          .orderBy("created_at", "desc")
          .limit(20);

        if (priors.length >= 3) {
          const currentLogin = {
            hour: new Date().getHours(),
            ip_address: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
            user_agent: req.headers["user-agent"] || "unknown",
          };

          const history = priors.map((p) => ({
            hour: new Date(p.created_at).getHours(),
            ip_address: p.ip_address,
            user_agent: p.user_agent,
          }));

          const { checkLoginAnomalyAI } = require("../services/localAI");
          const aiResult = await checkLoginAnomalyAI(history, currentLogin);

          if (aiResult.is_anomaly) {
            const { publish } = require("../services/kafkaProducer");
            const { sendNotification } = require("./notificationController");

            publish("stock-events", {
              type: "auth.login_anomaly",
              user_id: userRow.id,
              email: userRow.email,
              reason: aiResult.reason,
              confidence: aiResult.confidence,
            });

            await sendNotification({
              recipient_role_id: 1,
              title: `AI Security Warning: Unusual Login — ${userRow.email}`,
              message: `${aiResult.reason} (Confidence: ${aiResult.confidence}%)`,
              type: "login_anomaly",
              severity: "warning",
              metadata: { user_id: userRow.id, aiResult },
            });
          }
        }
      } catch (e) {
        console.error("[Auth] login anomaly check failed (non-blocking):", e.message);
      }
    })();
  } catch (err) {
    next(err);
  }
}

async function heartbeat(req, res, next) {
  try {
    const sessionId = req.body?.sessionId || req.get("x-session-id") || req.user?.sessionId;
    if (!sessionId) {
      return res.json({ success: true, status: "NO_SESSION" });
    }

    const session = await db("store_sessions").where("id", sessionId).first();
    if (!session) {
      return res.json({ success: true, status: "NOT_FOUND" });
    }

    if (session.status === "TERMINATED_BY_ADMIN") {
      return res.status(401).json({
        success: false,
        terminated: true,
        reason: session.terminated_reason || "Session terminated by administrator",
      });
    }

    await db("store_sessions").where("id", sessionId).update({
      last_ping_at: db.fn.now(),
      status: "ACTIVE",
    });

    res.json({ success: true, status: "ACTIVE" });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await getUserAuthContext(req.user.id);
    res.json({ success: true, data: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ success: false, error: "Refresh token required" });
    const result = await rotateRefreshToken(token, req);
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
    res.json({ success: true, data: { accessToken: result.accessToken, user: publicUser(result.user) } });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const sessionId = req.body?.sessionId || req.get("x-session-id") || req.user?.sessionId;
    if (sessionId) {
      await db("store_sessions").where("id", sessionId).update({
        status: "CLOSED",
        logout_at: db.fn.now(),
      });
    } else if (req.user?.id) {
      await db("store_sessions")
        .where({ user_id: req.user.id, status: "ACTIVE" })
        .update({ status: "CLOSED", logout_at: db.fn.now() });
    }

    if (monitoringController?.broadcastMonitoringEvent) {
      monitoringController.broadcastMonitoringEvent("session.logout", {
        sessionId,
        userId: req.user?.id,
      });
    }

    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    await auditLog(req, { action: "auth.logout", resource: "auth" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password, new_pin } = req.body;
    const userRow = await db("users").where("id", req.user.id).first();

    if (new_password) {
      if (!req.user.must_change_password && !(await comparePassword(current_password || "", userRow.password_hash))) {
        return res.status(400).json({ success: false, error: "Current password is incorrect" });
      }
      const password_hash = await hashPassword(new_password);
      await db("users").where("id", req.user.id).update({
        password_hash,
        must_change_password: false,
        password_changed_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
    }

    if (new_pin) {
      const pin_hash = await bcrypt.hash(String(new_pin).trim(), 10);
      await db("users").where("id", req.user.id).update({
        pin_hash,
        updated_at: db.fn.now(),
      });
    }

    await revokeUserRefreshTokens(req.user.id);
    await auditLog(req, { action: "auth.credentials_updated", resource: "auth" });
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, heartbeat, me, refresh, logout, changePassword };
