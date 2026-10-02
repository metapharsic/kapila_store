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
      // Standard Database-backed Password login (supports email, employee_code, or username)
      const identifier = (req.body.username || req.body.email || req.body.employee_code || "").trim();
      userRow = await db("users")
        .where((qb) => {
          qb.whereRaw("LOWER(email) = LOWER(?)", [identifier])
            .orWhereRaw("LOWER(employee_code) = LOWER(?)", [identifier]);
        })
        .first();

      if (!userRow || !userRow.is_active || !(await comparePassword(password || "", userRow.password_hash))) {
        await auditLog(req, {
          action: "auth.login_failed",
          resource: "auth",
          metadata: { identifier },
        });
        return res.status(401).json({ success: false, error: "Invalid username/email or password" });
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

async function stations(req, res, next) {
  try {
    // Multi-threaded parallel query execution: active users with roles, shifts, terminal config
    const [usersWithRoles, rawShifts] = await Promise.all([
      db("users")
        .join("user_roles", "users.id", "user_roles.user_id")
        .join("roles", "user_roles.role_id", "roles.id")
        .where("users.is_active", true)
        .select(
          "users.id",
          "users.employee_code",
          "users.name",
          "users.email",
          "users.pin_hash",
          "roles.key as role_key",
          "roles.name as role_name"
        )
        .orderBy("users.id", "asc"),

      db("shift_patterns")
        .where("is_active", true)
        .orderBy("start_time", "asc"),
    ]);

    let shifts = rawShifts;
    if (!shifts || shifts.length === 0) {
      // Auto-seed canonical shifts if table is empty
      const defaultShifts = [
        { name: "Morning Shift", shift_type: "MORNING", start_time: "06:00:00", end_time: "14:00:00", department: "Central Store", is_active: true },
        { name: "Evening Shift", shift_type: "EVENING", start_time: "14:00:00", end_time: "22:00:00", department: "Central Store", is_active: true },
        { name: "Night Shift", shift_type: "NIGHT", start_time: "22:00:00", end_time: "06:00:00", department: "Central Store", is_active: true },
        { name: "General Shift", shift_type: "GENERAL", start_time: "08:00:00", end_time: "17:00:00", department: "Central Store", is_active: true },
      ];
      try {
        await db("shift_patterns").insert(defaultShifts);
        shifts = await db("shift_patterns").where("is_active", true).orderBy("start_time", "asc");
      } catch (e) {
        shifts = defaultShifts.map((s, idx) => ({ id: idx + 1, ...s }));
      }
    }

    const ROLE_THEMES = {
      chef: {
        icon: "ChefHat",
        color: "#10b981",
        bg: "rgba(16, 185, 129, 0.14)",
        border: "rgba(16, 185, 129, 0.4)",
        glow: "rgba(16, 185, 129, 0.25)",
        dept: "Kitchen & Production",
        routeHint: "Direct to Kitchen Station",
        landingTab: "chef_home",
      },
      store_manager: {
        icon: "Store",
        color: "#e8a838",
        bg: "rgba(232, 168, 56, 0.14)",
        border: "rgba(232, 168, 56, 0.4)",
        glow: "rgba(232, 168, 56, 0.25)",
        dept: "Central Store",
        routeHint: "Direct to Store Manager Hub",
        landingTab: "store_manager_home",
      },
      admin: {
        icon: "ShieldCheck",
        color: "#3b82f6",
        bg: "rgba(59, 130, 246, 0.14)",
        border: "rgba(59, 130, 246, 0.4)",
        glow: "rgba(59, 130, 246, 0.25)",
        dept: "Executive Office",
        routeHint: "Direct to Master Dashboard",
        landingTab: "inventory",
      },
      manager: {
        icon: "Building2",
        color: "#8b5cf6",
        bg: "rgba(139, 92, 246, 0.14)",
        border: "rgba(139, 92, 246, 0.4)",
        glow: "rgba(139, 92, 246, 0.25)",
        dept: "Operations",
        routeHint: "Direct to Operations Hub",
        landingTab: "inventory",
      },
      employee: {
        icon: "Cpu",
        color: "#64748b",
        bg: "rgba(100, 116, 139, 0.14)",
        border: "rgba(100, 116, 139, 0.4)",
        glow: "rgba(100, 116, 139, 0.25)",
        dept: "Floor Operations",
        routeHint: "Direct to Floor Tasks",
        landingTab: "inventory",
      },
    };

    const stations = usersWithRoles.map((u) => {
      const theme = ROLE_THEMES[u.role_key] || ROLE_THEMES.employee;
      return {
        id: u.id,
        code: u.employee_code || `EMP-${u.id}`,
        label: u.name,
        email: u.email,
        role: u.role_name,
        roleKey: u.role_key,
        dept: theme.dept,
        routeHint: theme.routeHint,
        landingTab: theme.landingTab,
        icon: theme.icon,
        color: theme.color,
        bg: theme.bg,
        border: theme.border,
        glow: theme.glow,
        hasPin: Boolean(u.pin_hash),
      };
    });

    res.json({
      success: true,
      data: {
        stations,
        shifts: shifts.map((s) => ({
          id: s.id,
          name: s.name,
          shift_type: s.shift_type,
          start_time: s.start_time,
          end_time: s.end_time,
          department: s.department || "Central Store",
        })),
        defaultTerminal: "STORE-KIOSK-01",
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, heartbeat, me, refresh, logout, changePassword, stations };
