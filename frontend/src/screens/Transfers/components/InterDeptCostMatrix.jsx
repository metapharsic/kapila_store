import { ArrowRight, Layers, ArrowLeftRight } from "lucide-react";
import Card from "../../../components/Card";
import { COLORS } from "../../../styles/colors";

export default function InterDeptCostMatrix({ summary = null, onSelectPair = null }) {
  const matrix = summary?.inter_dept_matrix || [];

  if (matrix.length === 0) {
    return (
      <Card style={{ textAlign: "center", padding: 32 }}>
        <ArrowLeftRight size={24} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
        <p style={{ margin: 0, color: COLORS.textMuted, fontSize: 13 }}>
          No accepted transfers recorded yet for inter-department movement analytics.
        </p>
      </Card>
    );
  }

  const totalInterDeptValue = matrix.reduce((sum, m) => sum + (parseFloat(m.value) || 0), 0);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
            Inter-Department Material Flow & Cost Transfer Matrix
          </h3>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: COLORS.textMuted }}>
            Agent Valuator: Total inter-department movement volume evaluated at{" "}
            <strong style={{ color: COLORS.gold || COLORS.accent }}>
              ₹{totalInterDeptValue.toFixed(2)}
            </strong>
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
        }}
      >
        {matrix.map((row, idx) => (
          <div
            key={idx}
            style={{
              padding: "14px 16px",
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    background: row.from === "Store" ? "rgba(232, 168, 56, 0.15)" : "rgba(59, 130, 246, 0.15)",
                    color: row.from === "Store" ? COLORS.gold || COLORS.accent : "#3b82f6",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {row.from}
                </span>
                <ArrowRight size={13} color={COLORS.textMuted} />
                <span
                  style={{
                    background: row.to === "Store" ? "rgba(232, 168, 56, 0.15)" : "rgba(20, 184, 166, 0.15)",
                    color: row.to === "Store" ? COLORS.gold || COLORS.accent : COLORS.teal,
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {row.to}
                </span>
              </div>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                {row.count} completed transfer{row.count > 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent }}>
                ₹{parseFloat(row.value).toFixed(2)}
              </span>
              <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted }}>Total Valuation</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
