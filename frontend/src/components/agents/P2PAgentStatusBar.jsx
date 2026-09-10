import { useState } from "react";
import { Bot, ShoppingCart, ShieldCheck, Scale, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { COLORS } from "../../styles/colors";

export default function P2PAgentStatusBar({ activeModule = "po", style = {} }) {
  const [expanded, setExpanded] = useState(false);

  const agents = [
    {
      id: "sourcing",
      name: "Agent Sourcing Broker",
      role: "Vendor Intelligence & Rate Matching",
      badge: "Cheapest Rate",
      badgeColor: "rgba(232, 168, 56, 0.2)",
      textColor: COLORS.accent,
      desc: "Evaluates historical purchase rates, GSTIN validity, and active supplier catalogs to recommend lowest-cost certified vendors.",
    },
    {
      id: "qa_guard",
      name: "Agent QA & Landed Cost Guard",
      role: "GRN Physical Inspection",
      badge: "10% Price Cap",
      badgeColor: "rgba(16, 185, 129, 0.2)",
      textColor: COLORS.success,
      desc: "Guards against price creep by enforcing a 10% unit price variance limit against POs, tracking rejected goods, and creating warehouse batches.",
    },
    {
      id: "ledger_sync",
      name: "Agent Veritas P2P",
      role: "Double-Entry Inward Sync",
      badge: "INWARD_GRN",
      badgeColor: "rgba(59, 130, 246, 0.2)",
      textColor: "#3b82f6",
      desc: "Automatically registers double-entry INWARD_GRN transactions in stock_ledger, updating on-hand valuation and audit timestamps.",
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
            <span>P2P Procurement Swarm (3 Active)</span>
          </div>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            {activeModule === "po"
              ? "Autonomous purchase order drafting, rate optimization, and approval threshold enforcement"
              : "Goods receipt note verification, landed cost tolerance, and double-entry stock ledger posting"}
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
