import { useState } from "react";
import { Bot, ChevronDown, ChevronUp, AlertTriangle, Sparkles, TrendingDown } from "lucide-react";
import { COLORS } from "../../styles/colors";

export default function P2PAgentStatusBar({
  activeModule = "po",
  onRunAudit,
  isAuditing = false,
  auditResults = null,
  style = {}
}) {
  const [expanded, setExpanded] = useState(false);

  const agents = [
    {
      id: "sourcing",
      name: "Agent Sourcing Broker",
      role: "Vendor Intelligence & Rate Matching",
      badge: "Best Rate Sentinel",
      badgeColor: "rgba(232, 168, 56, 0.15)",
      textColor: COLORS.accent,
      status: auditResults?.sourcingStatus || "OPTIMAL",
      desc: "Evaluates historical purchase rates, GSTIN validity, and active supplier catalogs to recommend lowest-cost certified vendors.",
    },
    {
      id: "qa_guard",
      name: "Agent Veritas Policy Guard",
      role: "Threshold & Compliance Sentinel",
      badge: "₹10,000 Cap & Units",
      badgeColor: "rgba(16, 185, 129, 0.15)",
      textColor: COLORS.success,
      status: auditResults?.veritasStatus || "PASSING",
      desc: "Enforces dimensional unit compatibility, checks ₹10,000 managerial threshold gate, and flags supplier delivery reliability variances.",
    },
    {
      id: "ledger_sync",
      name: "Agent Inward & GRN Dispatcher",
      role: "P2P Inward Pipeline Sync",
      badge: "GRN Auto-Bridge",
      badgeColor: "rgba(59, 130, 246, 0.15)",
      textColor: "#3b82f6",
      status: auditResults?.inwardStatus || "STANDBY",
      desc: "Pre-configures Goods Receipt Notes (GRN) from approved orders and prepares automated double-entry ledger postings upon receipt.",
    },
  ];

  return (
    <div
      style={{
        background: "rgba(22, 22, 26, 0.85)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${auditResults?.hasWarnings ? `${COLORS.warning}66` : COLORS.border}`,
        borderRadius: 12,
        padding: "10px 16px",
        marginBottom: 16,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        {/* Left: Swarm Title & Telemetry */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 8,
              background: COLORS.surface,
              border: `1px solid ${COLORS.accent}44`,
              color: COLORS.accent,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <Bot size={14} />
            <span>P2P Procurement Swarm (3 Active)</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.success, boxShadow: `0 0 8px ${COLORS.success}` }} />
            <span style={{ fontSize: 11.5, color: COLORS.textMuted }}>
              {activeModule === "po"
                ? "Autonomous vendor rate evaluation, unit dimension safeguarding & approval routing"
                : "Goods receipt verification, landed cost tolerance & double-entry ledger synchronization"}
            </span>
          </div>
        </div>

        {/* Right: Actions & Agent Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {onRunAudit && (
            <button
              type="button"
              onClick={onRunAudit}
              disabled={isAuditing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: isAuditing ? `${COLORS.brand}33` : "rgba(232, 168, 56, 0.12)",
                border: `1px solid ${COLORS.accent}66`,
                color: COLORS.accent,
                borderRadius: 7,
                padding: "4px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: isAuditing ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              <Sparkles size={12} className={isAuditing ? "spin" : ""} />
              {isAuditing ? "Auditing Draft..." : "Run Swarm Audit"}
            </button>
          )}

          {agents.map((ag) => (
            <div
              key={ag.id}
              title={`${ag.name}: ${ag.role}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 9px",
                borderRadius: 7,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                fontSize: 11,
              }}
            >
              <span style={{ fontWeight: 600, color: COLORS.text }}>{ag.name.split(" ")[1]}</span>
              <span
                style={{
                  background: ag.badgeColor,
                  color: ag.textColor,
                  padding: "1.5px 7px",
                  borderRadius: 5,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {ag.status}
              </span>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              color: COLORS.textMuted,
              cursor: "pointer",
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            <span>{expanded ? "Collapse" : "Swarm Diagnostics"}</span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Expanded Swarm Telemetry & Findings */}
      {expanded && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px dashed ${COLORS.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {auditResults?.recommendations?.length > 0 && (
            <div
              style={{
                background: "rgba(232, 168, 56, 0.08)",
                border: `1px solid ${COLORS.accent}44`,
                borderRadius: 8,
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.accent, fontSize: 12, fontWeight: 700 }}>
                <TrendingDown size={14} /> Swarm Savings & Rate Optimization Findings:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: COLORS.text, lineHeight: 1.5 }}>
                {auditResults.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {auditResults?.warnings?.length > 0 && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${COLORS.danger}44`,
                borderRadius: 8,
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.danger, fontSize: 12, fontWeight: 700 }}>
                <AlertTriangle size={14} /> Agent Veritas Policy Warnings:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: COLORS.text, lineHeight: 1.5 }}>
                {auditResults.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {agents.map((ag) => (
              <div
                key={ag.id}
                style={{
                  padding: "10px 12px",
                  background: COLORS.bg,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: ag.textColor }}>
                    {ag.name}
                  </span>
                  <span
                    style={{
                      background: ag.badgeColor,
                      color: ag.textColor,
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 9.5,
                      fontWeight: 700,
                    }}
                  >
                    {ag.badge}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: COLORS.textMuted, lineHeight: 1.4 }}>
                  {ag.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
