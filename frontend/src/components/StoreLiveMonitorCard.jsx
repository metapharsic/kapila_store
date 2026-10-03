import { useState, useEffect, useCallback } from "react";
import * as api from "../api";
import { COLORS } from "../styles/colors";
import { 
  ShieldAlert, Activity, User, Monitor, Clock, 
  PowerOff, RefreshCw, Radio, CheckCircle, AlertTriangle, 
  Lock, ShieldCheck
} from "lucide-react";
import Btn from "./Btn";

export default function StoreLiveMonitorCard() {
  const [sessions, setSessions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [terminatingId, setTerminatingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await api.monitoring.liveSessions();
      if (res.data) {
        setSessions(res.data.active_sessions || []);
        setRecentActivity(res.data.recent_activity || []);
      }
    } catch (e) {
      console.warn("Failed to load live sessions:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);

    // Setup SSE stream
    let eventSource = null;
    try {
      eventSource = new EventSource("/api/monitoring/stream");
      eventSource.onopen = () => setStreaming(true);
      eventSource.onerror = () => setStreaming(false);

      eventSource.addEventListener("session.login", () => loadData());
      eventSource.addEventListener("session.logout", () => loadData());
      eventSource.addEventListener("session.terminated", () => loadData());
    } catch (e) {
      console.warn("SSE not available, falling back to interval polling");
    }

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [loadData]);

  const handleTerminate = async (session) => {
    setTerminatingId(session.id);
    setError("");
    try {
      await api.monitoring.terminateSession(session.id, "Remotely terminated by Administrator");
      setConfirmModal(null);
      await loadData();
    } catch (e) {
      setError(e.message || "Failed to terminate session");
    } finally {
      setTerminatingId(null);
    }
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 14, 23, 0.98) 100%)",
      border: "1px solid rgba(232, 168, 56, 0.25)",
      borderRadius: 14,
      padding: "20px 22px",
      marginBottom: 24,
      boxShadow: "0 14px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(232, 168, 56, 0.05)",
      backdropFilter: "blur(12px)",
      fontFamily: "var(--font-sans)",
      color: "#f1f5f9",
    }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            background: "rgba(232, 168, 56, 0.15)",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(232, 168, 56, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <ShieldAlert size={22} color="#e8a838" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#ffffff",
                fontFamily: "var(--font-display)",
                letterSpacing: "0.3px",
              }}>
                Store Live Monitoring & Surveillance
              </h3>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 12,
                fontWeight: 800,
                background: streaming ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                color: streaming ? "#10b981" : "#f59e0b",
                border: `1px solid ${streaming ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
              }}>
                <Radio size={10} className={streaming ? "animate-pulse" : ""} />
                {streaming ? "LIVE SSE" : "POLLING"}
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
              Real-time telemetry and remote kill-switch control over active store terminals.
            </p>
          </div>
        </div>

        <Btn size="sm" variant="outline" onClick={loadData} style={{ fontSize: 12, border: "1px solid rgba(232, 168, 56, 0.3)", color: "#e8a838" }}>
          <RefreshCw size={13} style={{ marginRight: 4 }} /> Refresh
        </Btn>
      </div>

      {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* Main Grid: Active Storekeepers vs Live Activity Stream */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Column 1: On-Duty Storekeepers */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <User size={13} color="#e8a838" /> Active Store Keepers & Terminals ({sessions.length})
          </div>

          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading active sessions...</div>
          ) : sessions.length === 0 ? (
            <div style={{
              padding: "24px 16px",
              background: "rgba(0, 0, 0, 0.3)",
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}>
              <Lock size={24} style={{ margin: "0 auto 8px", opacity: 0.5, color: "#e8a838" }} />
              <div style={{ color: "#ffffff", fontWeight: 600 }}>No storekeepers currently logged into store terminals.</div>
              <div style={{ fontSize: 11, marginTop: 4, color: "#94a3b8" }}>Terminals are locked in secure kiosk mode.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sessions.map((s) => (
                <div key={s.id} style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(0, 0, 0, 0.35)",
                  border: `1.5px solid ${s.status === "ACTIVE" ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.1)"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: s.status === "ACTIVE" ? "#10b981" : "#f59e0b",
                        boxShadow: s.status === "ACTIVE" ? "0 0 8px #10b981" : "none",
                      }} />
                      <strong style={{ color: "#ffffff", fontSize: 14 }}>{s.user_name}</strong>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>({s.employee_code || s.user_email})</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: s.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                        color: s.status === "ACTIVE" ? "#10b981" : "#f59e0b",
                        border: `1px solid ${s.status === "ACTIVE" ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                      }}>
                        {s.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Monitor size={12} color="#e8a838" /> {s.terminal_code}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} /> {s.shift_type} Shift
                      </span>
                      <span>IP: {s.ip_address || "127.0.0.1"}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setConfirmModal(s)}
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#fca5a5",
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      transition: "all 0.15s",
                    }}
                  >
                    <PowerOff size={12} /> Terminate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Live Activity Feed */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={13} color="#e8a838" /> Live Store Operations Ticker
          </div>

          <div style={{
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: 10,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "10px 14px",
            maxHeight: 180,
            overflowY: "auto",
          }}>
            {recentActivity.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 10 }}>
                No recent activity recorded.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentActivity.slice(0, 6).map((act) => (
                  <div key={act.id} style={{ fontSize: 12, borderBottom: "1px solid rgba(255, 255, 255, 0.04)", paddingBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 10 }}>
                      <span>{new Date(act.created_at).toLocaleTimeString()}</span>
                      <strong style={{ color: "#e8a838" }}>{act.actor_name || "Store Staff"}</strong>
                    </div>
                    <div style={{ color: "#ffffff", marginTop: 2, fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{act.action}</span>
                      {act.resource && <span style={{ color: "#94a3b8" }}> on {act.resource}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Kill-Switch Modal */}
      {confirmModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.8)",
          zIndex: 9999,
          display: "grid",
          placeItems: "center",
          padding: 20,
          backdropFilter: "blur(6px)",
        }}>
          <div style={{
            background: "#0f172a",
            border: "1px solid #ef4444",
            borderRadius: 14,
            padding: 24,
            maxWidth: "min(440px, 90vw)",
            maxHeight: "90vh",
            overflowY: "auto",
            width: "100%",
            boxShadow: "0 25px 70px rgba(0,0,0,0.7), 0 0 30px rgba(239, 68, 68, 0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ef4444", marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h4 style={{ margin: 0, fontSize: 18, color: "#ffffff", fontFamily: "var(--font-display)" }}>
                Terminate Store Session?
              </h4>
            </div>
            <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5, margin: "0 0 16px" }}>
              Are you sure you want to forcibly terminate the active session for <strong style={{ color: "#ffffff" }}>{confirmModal.user_name}</strong> on terminal <strong style={{ color: "#e8a838" }}>{confirmModal.terminal_code}</strong>?
            </p>
            <div style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 12,
              color: "#fca5a5",
              marginBottom: 18,
            }}>
              ⚠️ The terminal will be immediately locked and all active authorization tokens will be invalidated.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Btn>
              <button
                disabled={!!terminatingId}
                onClick={() => handleTerminate(confirmModal)}
                style={{
                  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                  border: "none",
                  borderRadius: 8,
                  color: "#ffffff",
                  fontWeight: 700,
                  padding: "8px 16px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                }}
              >
                {terminatingId ? "Terminating..." : "Confirm & Lock Terminal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
