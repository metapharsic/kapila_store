import { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Cpu,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Sliders,
  DollarSign,
  AlertOctagon,
  Scale
} from "lucide-react";
import { COLORS } from "../../styles/colors";

export default function AuditAgentStatusBar({
  telemetry,
  isSyncing = false,
  concurrentPendingCount = 0,
  onFilterAnomalies,
  onFilterDiscrepancies,
  onRefresh,
  style = {}
}) {
  const [expanded, setExpanded] = useState(false);

  const sentinel = telemetry?.agent_sentinel;
  const auditor = telemetry?.agent_auditor;
  const valuator = telemetry?.agent_valuator;
  const veritas = telemetry?.agent_veritas;

  const netVariance = valuator?.net_variance || 0;
  const isDeficit = netVariance < 0;
  const hasCritical = sentinel?.critical_anomalies?.length > 0;

  const agents = [
    {
      id: "sentinel",
      name: "Agent Sentinel",
      role: "Variance Anomaly Detector",
      badge: hasCritical
        ? `${sentinel?.critical_anomalies?.length} Critical Anomalies`
        : sentinel?.anomaly_count > 0
        ? `${sentinel?.anomaly_count} Variances Flagged`
        : "Zero Anomalies",
      badgeColor: hasCritical
        ? "rgba(239, 68, 68, 0.15)"
        : sentinel?.anomaly_count > 0
        ? "rgba(245, 158, 11, 0.15)"
        : "rgba(16, 185, 129, 0.15)",
      textColor: hasCritical
        ? COLORS.danger
        : sentinel?.anomaly_count > 0
        ? COLORS.warning
        : COLORS.success,
      status: sentinel?.status || "ACTIVE",
      desc: "Monitors real-time count inputs. Detects high percentage variances (≥15%), suspicious zero counts on active items, and high-value stock differences.",
      actionLabel: sentinel?.anomaly_count > 0 ? "Inspect Anomalies" : null,
      onAction: onFilterAnomalies
    },
    {
      id: "auditor",
      name: "Agent Auditor",
      role: "Theoretical Verifier",
      badge: `${auditor?.counted_skus || 0}/${auditor?.total_skus || 0} SKUs (${auditor?.progress_pct || 0}%)`,
      badgeColor: "rgba(59, 130, 246, 0.15)",
      textColor: "#3b82f6",
      status: auditor?.progress_pct === 100 ? "COMPLETE" : "COUNTING",
      desc: "Cross-references physical count inputs against frozen snapshot DB quantities. Tracks category coverage and identifies uncounted items.",
      actionLabel: auditor?.discrepancy_skus > 0 ? `View ${auditor?.discrepancy_skus} Variances` : null,
      onAction: onFilterDiscrepancies
    },
    {
      id: "valuator",
      name: "Agent Valuator",
      role: "Financial Telemetry",
      badge: `Net: ₹${Math.abs(netVariance).toLocaleString("en-IN")} ${isDeficit ? "Shrinkage" : "Surplus"}`,
      badgeColor: isDeficit ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
      textColor: isDeficit ? COLORS.danger : COLORS.success,
      status: "LIVE EVAL",
      desc: `Theoretical Value: ₹${(valuator?.theoretical_valuation || 0).toLocaleString("en-IN")} | Physical Value: ₹${(valuator?.physical_valuation || 0).toLocaleString("en-IN")}. Computes monetary impact using weighted batch FIFO prices.`
    },
    {
      id: "veritas",
      name: "Agent Veritas",
      role: "Atomic Ledger Adjuster",
      badge: veritas?.ready_for_finalise ? "Ready for Ledger Commit" : `${veritas?.pending_counts || 0} Pending Counts`,
      badgeColor: veritas?.ready_for_finalise ? "rgba(232, 168, 56, 0.15)" : "rgba(100, 116, 139, 0.15)",
      textColor: veritas?.ready_for_finalise ? COLORS.accent : COLORS.muted,
      status: veritas?.ready_for_finalise ? "READY" : "AWAITING",
      desc: "Guarantees double-entry ledger balance integrity. Generates atomic ADJUSTMENT_ADD and ADJUSTMENT_DEDUCT transactions into stock_ledger with zero duplication."
    }
  ];

  return (
    <div
      style={{
        background: "rgba(20, 22, 28, 0.92)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${hasCritical ? `${COLORS.danger}66` : "rgba(232, 168, 56, 0.25)"}`,
        borderRadius: 14,
        padding: "12px 18px",
        marginBottom: 18,
        boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
        transition: "all 0.3s ease",
        ...style
      }}
    >
      {/* Top Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        {/* Left: Swarm Title & Multi-threading status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "4px 10px",
              borderRadius: 8,
              background: "rgba(232, 168, 56, 0.12)",
              border: `1px solid ${COLORS.accent}55`,
              color: COLORS.accent,
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase"
            }}
          >
            <Cpu size={14} className="pulse" />
            <span>Audit Multi-Agent Engine (4 Agents)</span>
          </div>

          {/* Multi-thread worker state indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
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
                ? `Multi-Thread Worker: Syncing ${concurrentPendingCount} chunk(s) in parallel…`
                : "Parallel Concurrency: In Sync"}
            </span>
          </div>
        </div>

        {/* Right: Quick Telemetry Chips & Expand Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Net Financial Telemetry Chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 8,
              background: isDeficit ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
              border: `1px solid ${isDeficit ? "rgba(239, 68, 68, 0.35)" : "rgba(16, 185, 129, 0.35)"}`,
              color: isDeficit ? "#f87171" : "#4ade80",
              fontWeight: 700,
              fontSize: 12
            }}
          >
            {isDeficit ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            <span>Net Variance: ₹{Math.abs(netVariance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>

          {/* Refresh button */}
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
                alignItems: "center",
                transition: "all 0.2s ease"
              }}
            >
              <RefreshCw size={14} />
            </button>
          )}

          {/* Expand Toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "rgba(232, 168, 56, 0.12)",
              border: `1px solid ${COLORS.accent}44`,
              color: COLORS.accent,
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <span>{expanded ? "Hide Telemetry" : "Agent Swarm"}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Real-time Progress Bar */}
      <div style={{ marginTop: 10, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: COLORS.muted }}>
          <span>Physical Count Coverage ({auditor?.counted_skus || 0} / {auditor?.total_skus || 0} SKUs)</span>
          <span style={{ fontWeight: 700, color: COLORS.accent }}>{auditor?.progress_pct || 0}% Complete</span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              width: `${auditor?.progress_pct || 0}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${COLORS.accent}, #f59e0b)`,
              borderRadius: 3,
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
          />
        </div>
      </div>

      {/* Expandable Agent Cards Grid */}
      {expanded && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          {agents.map((ag) => (
            <div
              key={ag.id}
              style={{
                background: "rgba(28, 31, 38, 0.7)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{ag.name}</span>
                  <span
                    style={{
                      fontSize: 10,
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
                <div style={{ fontSize: 10, color: COLORS.accent, fontWeight: 600, marginBottom: 4 }}>{ag.role}</div>
                <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>{ag.desc}</div>
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
