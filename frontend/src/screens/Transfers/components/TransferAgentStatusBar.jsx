import { useState } from "react";
import {
  Bot,
  Route,
  Coins,
  ShieldCheck,
  Scale,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { COLORS } from "../../../styles/colors";

export default function TransferAgentStatusBar({ telemetry = null, style = {} }) {
  const [expanded, setExpanded] = useState(false);

  const agents = [
    {
      id: "routeur",
      icon: <Route size={13} color={COLORS.teal} />,
      name: "Agent Routeur",
      role: "Path & Stock Guard",
      badge: "Non-Overdraft",
      badgeColor: "rgba(34, 197, 94, 0.2)",
      textColor: "#22c55e",
      desc: "Validates transfer route permissions (Store ➔ Dept, Dept ➔ Dept, Dept ➔ Store) and verifies source on-hand balances before dispatch.",
    },
    {
      id: "valuator",
      icon: <Coins size={13} color={COLORS.gold || COLORS.accent} />,
      name: "Agent Valuator",
      role: "Costing & Unit Harmonizer",
      badge: "Auto-Valued",
      badgeColor: "rgba(232, 168, 56, 0.2)",
      textColor: COLORS.gold || COLORS.accent,
      desc: "Resolves SKU unit prices, pack-to-base conversions, and computes inter-department debit/credit valuations.",
    },
    {
      id: "gatekeeper",
      icon: <ShieldCheck size={13} color={COLORS.purple} />,
      name: "Agent Gatekeeper",
      role: "Handshake & Challan Engine",
      badge: "2-Stage Handshake",
      badgeColor: "rgba(168, 85, 247, 0.2)",
      textColor: COLORS.purple,
      desc: "Coordinates the 2-stage dispatch & acknowledgment handshake, prints Delivery Challans, and logs transit shrinkage.",
    },
    {
      id: "veritas",
      icon: <Scale size={13} color={COLORS.blue || "#3b82f6"} />,
      name: "Agent Veritas",
      role: "Double-Entry Ledger",
      badge: "Atomic Sync",
      badgeColor: "rgba(59, 130, 246, 0.2)",
      textColor: "#3b82f6",
      desc: "Posts atomic double-entry records in stock_ledger (TRANSFER_OUT, TRANSFER_IN, TRANSFER_LOSS) and guarantees non-negative balances.",
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
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
            <span>Multi-Agent Engine (4 Active)</span>
          </div>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            Real-time inter-departmental logistics & double-entry ledger orchestration
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
              {ag.icon}
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
