import { useState } from "react";
import { Bot, Bell, ShieldAlert, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { COLORS } from "../../styles/colors";

export default function ReorderAgentStatusBar({ style = {} }) {
  const [expanded, setExpanded] = useState(false);

  const agents = [
    {
      id: "sentinel",
      name: "Agent Stockout Sentinel",
      role: "Threshold Breach Detection",
      badge: "Real-Time Watch",
      badgeColor: "rgba(239, 68, 68, 0.2)",
      textColor: COLORS.coral,
      desc: "Monitors store stock on-hand balances against defined safety buffers (min_qty); fires instant visual and WhatsApp alerts upon breach.",
    },
    {
      id: "autodraft",
      name: "Agent Auto-Draft Broker",
      role: "One-Click PO Drafting",
      badge: "Vendor Pre-Fill",
      badgeColor: "rgba(232, 168, 56, 0.2)",
      textColor: COLORS.accent,
      desc: "Automatically prepares draft Purchase Orders pre-filled with the preferred vendor, lead-time safety buffer, and optimal reorder quantity.",
    },
    {
      id: "predictive",
      name: "Agent Predictive Run-Rate",
      role: "Depletion Forecasting",
      badge: "Lead-Time Aware",
      badgeColor: "rgba(16, 185, 129, 0.2)",
      textColor: COLORS.success,
      desc: "Computes 7-day kitchen consumption run-rates and alerts 72 hours before stockouts based on vendor lead times.",
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
            <span>Reorder Point Sentinel (3 Active)</span>
          </div>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            Predictive stockout prevention, lead-time modeling, and 1-click automated PO generation
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
