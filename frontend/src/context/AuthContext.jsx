import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../api";
import { clearAccessToken, setAccessToken, setUnauthorizedHandler } from "../api/authToken";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionTerminatedNotice, setSessionTerminatedNotice] = useState("");

  const permissions = useMemo(() => new Set(user?.permissions || []), [user]);
  const roles = user?.roles || [];
  const departments = user?.departments || [];

  const applySession = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    if (session.user?.sessionId) {
      sessionStorage.setItem("kapila_session_id", String(session.user.sessionId));
    }
  }, []);

  const clearSession = useCallback((terminationReason = "") => {
    clearAccessToken();
    setUser(null);
    sessionStorage.removeItem("kapila_active_session");
    sessionStorage.removeItem("kapila_session_id");
    if (terminationReason) {
      setSessionTerminatedNotice(terminationReason);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => clearSession("Session expired or terminated by administrator"));
    
    let isReloadOrHistory = false;
    try {
      const navigationEntries = performance.getEntriesByType("navigation");
      if (navigationEntries.length > 0) {
        const type = navigationEntries[0].type;
        isReloadOrHistory = type === "reload" || type === "back_forward";
      } else if (window.performance && window.performance.navigation) {
        const type = window.performance.navigation.type;
        isReloadOrHistory = type === 1 || type === 2; // 1: TYPE_RELOAD, 2: TYPE_BACK_FORWARD
      }
    } catch (e) {
      // Default to false if performance API is unavailable
    }

    if (isReloadOrHistory && sessionStorage.getItem("kapila_active_session") === "true") {
      api.auth.refresh()
        .then((res) => applySession(res.data))
        .catch(() => {
          clearSession();
          fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
        })
        .finally(() => setLoading(false));
    } else {
      clearSession();
      setLoading(false);
    }
  }, [applySession, clearSession]);

  // Periodic heartbeat every 30 seconds for active presence & remote kill detection
  useEffect(() => {
    if (!user || !user.sessionId) return;

    const ping = async () => {
      try {
        const res = await api.auth.heartbeat(user.sessionId);
        if (res.data?.terminated || res.terminated) {
          clearSession(res.data?.reason || "Session terminated by administrator");
        }
      } catch (err) {
        if (err.status === 401 || err.response?.status === 401) {
          clearSession("Session terminated by administrator");
        }
      }
    };

    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [user, clearSession]);

  const login = async (credentials) => {
    setSessionTerminatedNotice("");
    let body = {};
    if (typeof credentials === "string") {
      // legacy signature login(email, password)
      body = { email: arguments[0], password: arguments[1] };
    } else {
      body = credentials;
    }

    const res = await api.auth.login(body);
    applySession(res.data);
    sessionStorage.setItem("kapila_active_session", "true");
    return res.data.user;
  };

  const logout = async () => {
    try {
      await api.auth.logout({ sessionId: user?.sessionId });
    } finally {
      clearSession();
    }
  };

  const refreshSession = async () => {
    const res = await api.auth.me();
    setUser(res.data);
    return res.data;
  };

  const hasPermission = useCallback((permission) => {
    if (!permission) return true;
    if (roles.some((role) => role.key === "admin")) return true;
    if (Array.isArray(permission)) {
      return permission.some((p) => permissions.has(p));
    }
    return permissions.has(permission);
  }, [permissions, roles]);

  const hasAnyPermission = useCallback((items) => items.some((permission) => hasPermission(permission)), [hasPermission]);

  const canAccessDepartment = useCallback((deptName) => {
    if (!deptName || roles.some((role) => role.key === "admin" || role.key === "manager")) return true;
    return departments.some((dept) => dept.name?.toLowerCase() === String(deptName).toLowerCase());
  }, [departments, roles]);

  return (
    <AuthContext.Provider value={{
      user,
      roles,
      permissions,
      departments,
      sessionId: user?.sessionId,
      shiftType: user?.shiftType,
      terminalCode: user?.terminalCode,
      isAuthenticated: !!user,
      loading,
      sessionTerminatedNotice,
      clearTerminationNotice: () => setSessionTerminatedNotice(""),
      login,
      logout,
      refreshSession,
      hasPermission,
      hasAnyPermission,
      canAccessDepartment,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
