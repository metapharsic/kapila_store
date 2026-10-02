import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "../../../styles/colors";
import { Activity, ShieldCheck, Zap, AlertTriangle, CheckCircle, Database, HelpCircle, X } from "lucide-react";

export const AGENT_META = {
  sentinel: { label: "Sentinel", role: "Privilege & Security Guard", icon: "🛡️" },
  scout:    { label: "Scout",    role: "SKU & Directory Indexer",   icon: "🔍" },
  tracer:   { label: "Tracer",   role: "Granular History Lineage",  icon: "🧬" },
  ledger:   { label: "Ledger",   role: "Double-Entry Ledger Engine",icon: "📒" },
  pogrn:    { label: "PO-GRN",   role: "PO-Receipt Match Linker",   icon: "📦" },
  indent:   { label: "Indent",   role: "Kitchen Demand & Issuance", icon: "📋" },
  analyst:  { label: "Analyst",  role: "Anomaly & Cost Detector",   icon: "⚡" },
  veritas:  { label: "Veritas",  role: "Data Quality & Integrity",  icon: "⚖️" },
  composer: { label: "Composer", role: "Executive AI Synthesis",    icon: "🧠" },
};

const STATUS_COLOR = {
  idle:    "#52525b",
  running: "#f59e0b",
  done:    "#10b981",
  error:   "#ef4444",
};

const STATUS_DOT = {
  idle:    "⬤",
  running: "◉",
  done:    "●",
  error:   "✕",
};

/**
 * AgentStatusBar — Multi-Agent Orchestration Telemetry.
 * ZERO DOM mutations. Pure React state.
 *
 * Props:
 *   agents: { [agentId]: { status: 'idle'|'running'|'done'|'error', count?: number, ms?: number, error?: string, details?: any } }
 *   compact: boolean — mini strip vs full telemetry deck
 *   onAgentClick?: (agentId) => void
 */
export default function AgentStatusBar({ agents = {}, compact = false, onAgentClick }) {
  const agentIds = Object.keys(AGENT_META);
  const runningCount = agentIds.filter(id => agents[id]?.status === "running").length;
  const doneCount    = agentIds.filter(id => agents[id]?.status === "done").length;
  const errorCount   = agentIds.filter(id => agents[id]?.status === "error").length;
  const allDone      = doneCount === agentIds.length;

  const [activeInspector, setActiveInspector] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(null);

  // Live timer for running agents
  useEffect(() => {
    let timer;
    if (runningCount > 0) {
      if (!startRef.current) startRef.current = Date.now();
      timer = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current);
      }, 80);
    } else {
      startRef.current = null;
    }
    return () => clearInterval(timer);
  }, [runningCount]);

  if (compact) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px", background: "#111113",
        borderRadius: 8, fontSize: 11, border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <span style={{ color: "#f4c84b", fontWeight: 700, fontSize: 10, letterSpacing: "0.08em" }}>
          AGENTS [{agentIds.length}]
        </span>
        {agentIds.map(id => {
          const st = agents[id]?.status || "idle";
          return (
            <span
              key={id}
              onClick={() => setActiveInspector(id)}
              title={`${AGENT_META[id].label}: ${st}`}
              style={{
                color: STATUS_COLOR[st],
                cursor: "pointer",
                fontSize: st === "running" ? 13 : 11,
                animation: st === "running" ? "pulse 0.9s infinite" : undefined,
                transition: "transform 0.15s ease",
              }}
            >
              {STATUS_DOT[st]}
            </span>
          );
        })}
        {runningCount > 0 && (
          <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 600 }}>
            {runningCount} active ({elapsedMs}ms)
          </span>
        )}
        {allDone && <span style={{ color: "#10b981", fontSize: 10, fontWeight: 700 }}>✓ All Synced</span>}
        {errorCount > 0 && <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700 }}>{errorCount} error(s)</span>}
      </div>
    );
  }

  return (
    <div style={{
      background: "#111113",
      borderRadius: 12,
      padding: "12px 18px",
      marginBottom: 16,
      border: "1px solid rgba(244,200,75,0.18)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    }}>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: runningCount > 0 ? "#f59e0b" : allDone ? "#10b981" : "#52525b",
            boxShadow: runningCount > 0 ? "0 0 10px #f59e0b" : allDone ? "0 0 8px #10b981" : "none",
            animation: runningCount > 0 ? "pulse 1s infinite" : undefined,
          }} />
          <span style={{ color: "#f4c84b", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em" }}>
            ◈ KAPILA MULTI-AGENT ORCHESTRATION PIPELINE
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, color: "#71717a" }}>
          {runningCount > 0 && (
            <span style={{ color: "#f59e0b", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              ⚡ PARALLEL SYNC: {elapsedMs}ms
            </span>
          )}
          <span>
            {doneCount}/{agentIds.length} Agents Verified
          </span>
          <span style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
            background: runningCount > 0 ? "rgba(245,158,11,0.15)" : allDone ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
            color: runningCount > 0 ? "#f59e0b" : allDone ? "#10b981" : "#71717a",
            border: `1px solid ${runningCount > 0 ? "#f59e0b44" : allDone ? "#10b98144" : "transparent"}`
          }}>
            {runningCount > 0 ? "STREAMING" : allDone ? "ALL READY" : "IDLE"}
          </span>
        </div>
      </div>

      {/* 9-Agent Deck */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 8,
      }}>
        {agentIds.map((id, idx) => {
          const st = agents[id]?.status || "idle";
          const info = agents[id] || {};
          const meta = AGENT_META[id];
          const isRunning = st === "running";
          const isDone = st === "done";
          const isErr = st === "error";

          return (
            <div
              key={id}
              onClick={() => {
                setActiveInspector(id);
                onAgentClick?.(id);
              }}
              style={{
                display: "flex", flexDirection: "column",
                background: isRunning
                  ? "rgba(245,158,11,0.1)"
                  : isDone
                  ? "rgba(16,185,129,0.06)"
                  : isErr
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${isRunning
                  ? "rgba(245,158,11,0.4)"
                  : isDone
                  ? "rgba(16,185,129,0.25)"
                  : isErr
                  ? "rgba(239,68,68,0.4)"
                  : "rgba(255,255,255,0.08)"}`,
                borderRadius: 8,
                padding: "8px 10px",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {/* Shimmer laser while running */}
              {isRunning && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, transparent, #f59e0b, transparent)",
                  animation: "shimmer 1.1s infinite",
                }} />
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11 }}>{meta.icon}</span>
                  <span style={{ color: "#ffffff", fontSize: 11, fontWeight: 700 }}>
                    {meta.label}
                  </span>
                </div>
                <span style={{
                  color: STATUS_COLOR[st],
                  fontSize: 7,
                  animation: isRunning ? "blink 0.8s infinite" : undefined,
                }}>
                  {STATUS_DOT[st]}
                </span>
              </div>

              <span style={{ color: "#71717a", fontSize: 9, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {meta.role}
              </span>

              {/* Status details */}
              <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9 }}>
                {isDone && (
                  <span style={{ color: "#10b981", fontWeight: 600 }}>
                    {info.count !== undefined ? `${info.count} rec` : "Verified"}
                  </span>
                )}
                {isDone && info.ms !== undefined && (
                  <span style={{ color: "#52525b" }}>{info.ms}ms</span>
                )}
                {isRunning && (
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>Syncing…</span>
                )}
                {isErr && (
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>Failed</span>
                )}
                {st === "idle" && (
                  <span style={{ color: "#3f3f46" }}>Standby</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspector Modal / Popover */}
      {activeInspector && (
        <div style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "rgba(0,0,0,0.6)",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          animation: "fadeIn 0.2s ease"
        }}>
          <div>
            <span style={{ color: "#f4c84b", fontWeight: 700, marginRight: 8 }}>
              {AGENT_META[activeInspector]?.icon} Agent {AGENT_META[activeInspector]?.label}
            </span>
            <span style={{ color: "#a1a1aa" }}>{AGENT_META[activeInspector]?.role}</span>
            <span style={{ marginLeft: 12, color: STATUS_COLOR[agents[activeInspector]?.status || "idle"], fontWeight: 700 }}>
              Status: {(agents[activeInspector]?.status || "idle").toUpperCase()}
            </span>
            {agents[activeInspector]?.count !== undefined && (
              <span style={{ marginLeft: 10, color: "#10b981" }}>
                Payload: {agents[activeInspector].count} records
              </span>
            )}
            {agents[activeInspector]?.ms !== undefined && (
              <span style={{ marginLeft: 10, color: "#71717a" }}>
                Latency: {agents[activeInspector].ms}ms
              </span>
            )}
            {agents[activeInspector]?.error && (
              <span style={{ marginLeft: 10, color: "#ef4444" }}>
                Error: {agents[activeInspector].error}
              </span>
            )}
          </div>
          <button
            onClick={() => setActiveInspector(null)}
            style={{
              background: "none", border: "none", color: "#71717a", cursor: "pointer",
              display: "flex", alignItems: "center", padding: 4
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn  { from{opacity:0; transform:translateY(-4px)} to{opacity:1; transform:translateY(0)} }
      `}</style>
    </div>
  );
}
