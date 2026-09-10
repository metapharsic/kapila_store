import { useState } from "react";
import { Bot, ClipboardCheck, Clock, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { COLORS } from "../../styles/colors";

export default function ApprovalsAgentStatusBar({ style = {} }) {
  const [expanded, setExpanded] = useState(false);

  const agents = [
    {
      id: "escalator",
      name: "Agent Threshold Escalator",
      role: "Financial Limit Enforcement",
      badge: "₹10,000 Cap",
      badgeColor: "rgba(232, 168, 56, 0.2)",
      textColor: COLORS.accent,
      desc: "Intercepts all purchase orders and write-offs exceeding authorization limits (> ₹10,000) and holds them for Admin / Store Manager approval.",
    },
    {
      id: "sla_tracker",
      name: "Agent SLA Guardian",
      role: "Countdown & Escalation Timer",
      badge: "SLA Active",
      badgeColor: "rgba(59, 130, 246, 0.2)",
      textColor: "#3b82f6",
      desc: "Tracks turnaround times; auto-escalates requests pending past 2 hours to prevent kitchen bottlenecks.",
    },
    {
      id: "policy_auditor",
      name: "Agent Policy Auditor",
      role: "Compliance & Budget Guard",
      badge: "Strict Audit",
      badgeColor: "rgba(16, 185, 129, 0.2)",
      textColor: COLORS.success,
      desc: "Performs budget tolerance checks, duplicate order matching, and logs immutable sign-off records into audit_logs.",
    },
  ];

  return (
    <div
      style={{
        background: "rgba(22, 22, 26, 0.75)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: "8px 14px",
        marginBottom: 16,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              borderRadius: 6,
              background: COLORS.surface,
              border: `1px solid ${COLORS.accent}44`,
              color: COLORS.accent,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <Bot size={13} />
            <span>Governance & Approvals Swarm (3 Active)</span>
          </div>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            Multi-tier corporate authorization, SLA timer tracking, and automated threshold routing
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {agents.map((ag) => (
            <div
              key={ag.id}
              title={`${ag.name}: ${ag.role}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                borderRadius: 6,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                fontSize: 11,
              }}
            >
              <span style={{ fontWeight: 600, color: COLORS.text }}>{ag.name}</span>
              <span
                style={{
                  background: ag.badgeColor,
                  color: ag.textColor,
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 9.5,
                  fontWeight: 700,
                }}
              >
                {ag.badge}
              </span>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: "transparent",
              border: "none",
              color: COLORS.textMuted,
              cursor: "pointer",
              padding: "2px 6px",
              fontSize: 11,
            }}
          >
            <span>{expanded ? "Hide" : "Details"}</span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px dashed ${COLORS.border}`,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {agents.map((ag) => (
            <div
              key={ag.id}
              style={{
                padding: "8px 10px",
                background: COLORS.bg,
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 11, color: ag.textColor }}>
                  {ag.name}
                </span>
                <span style={{ fontSize: 9, color: COLORS.teal, fontWeight: 700 }}>
                  ACTIVE
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.35 }}>
                {ag.desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
