import { useState } from "react";
import {
  Bot,
  Bell,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  TrendingDown,
  RefreshCw,
  ShoppingBag,
  Sliders,
  DollarSign
} from "lucide-react";
import { COLORS } from "../../styles/colors";

export default function ReorderAgentStatusBar({
  telemetry = null,
  isSyncing = false,
  pendingSyncCount = 0,
  onFilterBreached,
  onFilterCritical,
  onRecalibrate,
  onBatchDraftPOs,
  onRefresh,
  style = {}
}) {
  const [expanded, setExpanded] = useState(false);

  const sentinel = telemetry?.agent_sentinel;
  const forecaster = telemetry?.agent_forecaster;
  const strategist = telemetry?.agent_strategist;
  const dispatcher = telemetry?.agent_dispatcher;

  const breachedCount = sentinel?.breached_count || 0;
  const criticalCount = sentinel?.critical_count || 0;
  const totalSpend = strategist?.total_spend_required || 0;

  const agents = [
    {
      id: "sentinel",
      name: "Agent Stockout Sentinel",
      role: "Safety Buffer & Breach Detection",
      badge: criticalCount > 0
        ? `${criticalCount} Critical Stockouts`
        : breachedCount > 0
        ? `${breachedCount} Breached Buffers`
        : "Buffers Secure ✓",
      badgeColor: criticalCount > 0
        ? "rgba(239, 68, 68, 0.2)"
        : breachedCount > 0
        ? "rgba(245, 158, 11, 0.2)"
        : "rgba(16, 185, 129, 0.2)",
      textColor: criticalCount > 0 ? COLORS.danger : breachedCount > 0 ? COLORS.warning : COLORS.success,
      desc: "Monitors on-hand inventory against safety buffers in real-time. Detects threshold breaches and issues alerts immediately.",
      actionLabel: breachedCount > 0 ? "Filter Breached SKUs" : null,
      onAction: onFilterBreached
    },
    {
      id: "forecaster",
      name: "Agent Velocity Forecaster",
      role: "14-Day Depletion Run-Rate Modeling",
      badge: forecaster?.urgent_stockouts_48h > 0
        ? `${forecaster.urgent_stockouts_48h} Depleting <48h`
        : "Depletion Stable",
      badgeColor: "rgba(59, 130, 246, 0.2)",
      textColor: "#3b82f6",
      desc: "Computes 14-day kitchen burn velocity and models dynamic days-to-stockout (DTS). Alerts before lead-time starvation occurs.",
      actionLabel: forecaster?.urgent_stockouts_48h > 0 ? "Inspect 48h Risks" : null,
      onAction: onFilterCritical
    },
    {
      id: "strategist",
      name: "Agent Vendor Strategist",
      role: "Sourcing & Price Sentinel",
      badge: `Replenish: ₹${totalSpend.toLocaleString("en-IN")}`,
      badgeColor: "rgba(232, 168, 56, 0.2)",
      textColor: COLORS.accent,
      desc: "Evaluates certified vendors, historical purchase rates, and delivery reliability to recommend optimal suppliers and project capital requirements."
    },
    {
      id: "dispatcher",
      name: "Agent Auto-Draft Dispatcher",
      role: "Autonomous Multi-Supplier PO Generator",
      badge: dispatcher?.ready_for_dispatch
        ? `${dispatcher.pending_pos_to_draft} POs Ready`
        : "Standing By",
      badgeColor: "rgba(168, 85, 247, 0.2)",
      textColor: "#a855f7",
      desc: "Groups breached items by vendor, checks managerial approval gates, and drafts consolidated purchase orders in one atomic action.",
      actionLabel: dispatcher?.ready_for_dispatch && onBatchDraftPOs ? "1-Click Auto-Draft POs" : null,
      onAction: onBatchDraftPOs
    }
  ];

  return (
    <div
      style={{
        background: "rgba(20, 22, 28, 0.92)",
        backdropFilter: "blur(10px)",
        border: `1px solid ${criticalCount > 0 ? `${COLORS.danger}66` : breachedCount > 0 ? "rgba(232, 168, 56, 0.35)" : COLORS.border}`,
        borderRadius: 12,
        padding: "12px 18px",
        marginBottom: 18,
        boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
        ...style
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        {/* Swarm Title & Multi-threading Telemetry */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(232, 168, 56, 0.12)",
              border: `1px solid ${COLORS.accent}55`,
              color: COLORS.accent,
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}
          >
            <Cpu size={14} className="pulse" />
            <span>Reorder Swarm (4 Active Agents)</span>
          </div>

          {/* Parallel Worker Concurrency Status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 8,
              background: isSyncing ? "rgba(59, 130, 246, 0.15)" : "rgba(16, 185, 129, 0.1)",
              border: `1px solid ${isSyncing ? "#3b82f6" : "rgba(16, 185, 129, 0.3)"}`,
              fontSize: 11,
              fontWeight: 600,
              color: isSyncing ? "#60a5fa" : COLORS.success
            }}
          >
            <Zap size={12} className={isSyncing ? "pulse" : ""} />
            <span>
              {isSyncing
                ? `Parallel Worker: Syncing ${pendingSyncCount} rule(s) concurrently…`
                : "Parallel Concurrency: In Sync ✓"}
            </span>
          </div>
        </div>

        {/* Right Badges & Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {onRecalibrate && (
            <button
              onClick={onRecalibrate}
              title="Automatically recalculate safety buffers and reorder quantities based on real 14-day consumption velocity"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(232, 168, 56, 0.12)",
                border: `1px solid ${COLORS.accent}44`,
                color: COLORS.accent,
                borderRadius: 8,
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <Sparkles size={13} />
              <span>Smart Recalibrate</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh Agent Telemetry"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                borderRadius: 8,
                padding: "6px 8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center"
              }}
            >
              <RefreshCw size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <span>{expanded ? "Hide Telemetry" : "Agent Swarm"}</span>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Real-time Status Chips */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {agents.map((ag) => (
          <div
            key={ag.id}
            title={`${ag.name}: ${ag.role}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${COLORS.border}`,
              fontSize: 11
            }}
          >
            <span style={{ fontWeight: 600, color: COLORS.text }}>{ag.name}</span>
            <span
              style={{
                background: ag.badgeColor,
                color: ag.textColor,
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700
              }}
            >
              {ag.badge}
            </span>
          </div>
        ))}
      </div>

      {/* Expanded Swarm Details Drawer */}
      {expanded && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid rgba(255,255,255,0.07)`,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12
          }}
        >
          {agents.map((ag) => (
            <div
              key={ag.id}
              style={{
                padding: "10px 12px",
                background: "rgba(28, 31, 38, 0.7)",
                borderRadius: 8,
                border: `1px solid rgba(255,255,255,0.06)`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: COLORS.text }}>
                    {ag.name}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: ag.badgeColor,
                      color: ag.textColor
                    }}
                  >
                    {ag.badge}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: COLORS.accent, fontWeight: 600, marginBottom: 4 }}>
                  {ag.role}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
                  {ag.desc}
                </p>
              </div>

              {ag.actionLabel && ag.onAction && (
                <button
                  onClick={ag.onAction}
                  style={{
                    background: "transparent",
                    border: `1px solid ${ag.textColor}66`,
                    color: ag.textColor,
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    alignSelf: "flex-start",
                    transition: "all 0.2s ease"
                  }}
                >
                  {ag.actionLabel} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
