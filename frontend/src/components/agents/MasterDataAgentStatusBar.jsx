import { useState } from "react";
import { Bot, Building2, Users, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { COLORS } from "../../styles/colors";

export default function MasterDataAgentStatusBar({ entityType = "suppliers", style = {} }) {
  const [expanded, setExpanded] = useState(false);

  const agents = [
    {
      id: "custodian",
      name: "Agent Data Custodian",
      role: "Integrity & Referential Health",
      badge: "Validated",
      badgeColor: "rgba(16, 185, 129, 0.2)",
      textColor: COLORS.success,
      desc: "Maintains referential integrity across master entities; validates GSTIN formats, prevents orphan records, and audits active directory links.",
    },
    {
      id: "rbac_guard",
      name: "Agent RBAC Sentinel",
      role: "Role Scoping & Access Guard",
      badge: "Zero-Leak",
      badgeColor: "rgba(59, 130, 246, 0.2)",
      textColor: "#3b82f6",
      desc: "Guarantees departmental data isolation; automatically applies row-level scopes so chefs and clerks only view assigned departments.",
    },
    {
      id: "vendor_auditor",
      name: "Agent Vendor & Org Auditor",
      role: "Scorecard & Activity Logs",
      badge: "Live Logged",
      badgeColor: "rgba(232, 168, 56, 0.2)",
      textColor: COLORS.accent,
      desc: "Aggregates supplier performance ratings, delivery turnaround histories, and logs all administrative updates to audit_logs.",
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
            <span>Master Data Governance (3 Active)</span>
          </div>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            Referential data integrity, RBAC security scoping, and vendor scorecard tracking
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
