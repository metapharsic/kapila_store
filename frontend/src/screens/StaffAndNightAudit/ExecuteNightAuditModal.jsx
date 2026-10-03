import { useState, useEffect, useCallback } from "react";
import { COLORS } from "../../styles/colors";
import { nightAudit } from "../../api";
import { Moon, AlertTriangle, Lock, TrendingUp, TrendingDown } from "lucide-react";
import ModalShell from "../../components/ui/ModalShell";

function getYesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

export default function ExecuteNightAuditModal({ isOpen, onClose, onSuccess }) {
  const [auditDate, setAuditDate] = useState(getYesterdayStr);
  const [foodRevenue, setFoodRevenue] = useState("135000");
  const [rolloverNotes, setRolloverNotes] = useState("Daily store inventory closed. Material issuances and food waste balances frozen.");

  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    setError("");
    try {
      const res = await nightAudit.getPreview({
        date: auditDate,
        revenue: parseFloat(foodRevenue) || undefined
      });
      setPreview(res.data);
    } catch (err) {
      setError(err.message || "Failed to load audit preview");
    } finally {
      setLoadingPreview(false);
    }
  }, [auditDate, foodRevenue]);

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => loadPreview());
    }
  }, [isOpen, loadPreview]);

  if (!isOpen) return null;

  const handleExecute = async (e) => {
    e.preventDefault();
    if (!preview) return;

    setSubmitting(true);
    setError("");

    try {
      await nightAudit.execute({
        audit_date: auditDate,
        total_material_issued_cost: preview.total_material_issued_cost,
        total_food_waste_cost: preview.total_food_waste_cost,
        total_kitchen_direct_cost: preview.total_kitchen_direct_cost,
        total_food_revenue: parseFloat(foodRevenue) || preview.total_food_revenue,
        food_cost_percentage: preview.food_cost_percentage,
        target_food_cost_pct: preview.target_food_cost_pct,
        variance_pct: preview.variance_pct,
        department_breakdown: preview.department_breakdown,
        discrepancies_flagged: preview.discrepancies_flagged,
        audit_status: preview.suggested_status,
        rollover_notes: rolloverNotes.trim()
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to lock daily night audit");
    } finally {
      setSubmitting(false);
    }
  };

  const isFavorable = preview && preview.variance_pct <= 0;

  return (
    <ModalShell
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Moon size={20} color={COLORS.gold} />
          <span>Execute Midnight Food Cost Night Audit</span>
        </div>
      }
      onClose={onClose}
      size="expanded"
    >
      <form onSubmit={handleExecute} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              backgroundColor: "rgba(220, 53, 69, 0.15)",
              border: "1px solid #dc3545",
              color: "#ff6b6b",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Inputs: Date & Revenue */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
              Audit Date To Freeze *
            </label>
            <input
              type="date"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: COLORS.bgDark,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "6px",
                color: COLORS.text,
                fontSize: "0.88rem",
                boxSizing: "border-box"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
              Daily Food Sales Revenue (₹) *
            </label>
            <input
              type="number"
              step="100"
              min="1000"
              value={foodRevenue}
              onChange={(e) => setFoodRevenue(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                backgroundColor: COLORS.bgDark,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "6px",
                color: COLORS.gold,
                fontSize: "0.92rem",
                fontWeight: 600,
                boxSizing: "border-box"
              }}
            />
          </div>
        </div>

        {/* Already closed notification */}
        {preview && preview.is_already_closed && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              backgroundColor: "rgba(250, 173, 20, 0.12)",
              border: "1px solid #faad14",
              color: "#ffd666",
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <AlertTriangle size={16} />
            <span>Notice: A night audit for {auditDate} was already closed. Proceeding will re-calculate and overwrite the frozen figures.</span>
          </div>
        )}

        {/* KPI Cards Ribbon */}
        {preview && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
            {/* Kitchen Direct Cost */}
            <div
              style={{
                backgroundColor: "var(--border-color)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "8px",
                padding: "12px 14px",
                minWidth: 0
              }}
            >
              <span style={{ fontSize: "0.74rem", color: COLORS.textMuted, textTransform: "uppercase" }}>
                Total Kitchen Direct Cost
              </span>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: COLORS.text, marginTop: "2px" }}>
                ₹{preview.total_kitchen_direct_cost.toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "0.72rem", color: COLORS.textMuted, marginTop: "4px" }}>
                Issues: ₹{preview.total_material_issued_cost.toLocaleString("en-IN")} • Waste: ₹{preview.total_food_waste_cost.toLocaleString("en-IN")}
              </div>
            </div>

            {/* Food Cost % */}
            <div
              style={{
                backgroundColor: "var(--border-color)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "8px",
                padding: "12px 14px",
                minWidth: 0
              }}
            >
              <span style={{ fontSize: "0.74rem", color: COLORS.textMuted, textTransform: "uppercase" }}>
                Food Cost Percentage
              </span>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: isFavorable ? "#52c41a" : "#ff4d4f", marginTop: "2px" }}>
                {preview.food_cost_percentage}%
              </div>
              <div style={{ fontSize: "0.72rem", color: COLORS.textMuted, marginTop: "4px" }}>
                Target Benchmark: {preview.target_food_cost_pct}%
              </div>
            </div>

            {/* Variance */}
            <div
              style={{
                backgroundColor: "var(--border-color)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "8px",
                padding: "12px 14px",
                minWidth: 0
              }}
            >
              <span style={{ fontSize: "0.74rem", color: COLORS.textMuted, textTransform: "uppercase" }}>
                Budget Variance
              </span>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  color: isFavorable ? "#52c41a" : "#ff4d4f",
                  marginTop: "2px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                {isFavorable ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                {preview.variance_pct > 0 ? "+" : ""}{preview.variance_pct}%
              </div>
              <div style={{ fontSize: "0.72rem", color: isFavorable ? "#52c41a" : "#ff4d4f", marginTop: "4px" }}>
                {isFavorable ? "Under Target Budget" : "Budget Overrun Warning"}
              </div>
            </div>
          </div>
        )}

        {/* Department Breakdown Preview Table */}
        {preview && preview.department_breakdown.length > 0 && (
          <div>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted, display: "block", marginBottom: "6px" }}>
              Department Cost Allocations (Live Store Issues + Waste):
            </span>
            <div
              style={{
                backgroundColor: COLORS.bgDark,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "6px",
                maxHeight: "150px",
                overflowY: "auto",
                overflowX: "auto"
              }}
            >
              <table style={{ width: "100%", minWidth: "460px", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: "left", color: COLORS.textMuted }}>
                    <th style={{ padding: "8px 12px" }}>Department</th>
                    <th style={{ padding: "8px 12px" }}>Issued Cost (₹)</th>
                    <th style={{ padding: "8px 12px" }}>Waste (₹)</th>
                    <th style={{ padding: "8px 12px" }}>Total Cost (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.department_breakdown.map((d) => (
                    <tr key={d.department} style={{ borderBottom: `1px solid var(--border-color)` }}>
                      <td style={{ padding: "6px 12px", fontWeight: 600 }}>{d.department}</td>
                      <td style={{ padding: "6px 12px", color: COLORS.textMuted }}>₹{d.issued_cost.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "6px 12px", color: d.waste_cost > 500 ? "#ff7875" : COLORS.textMuted }}>
                        ₹{d.waste_cost.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "6px 12px", fontWeight: 600, color: COLORS.gold }}>
                        ₹{d.direct_cost.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rollover Notes */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
            Night Audit Remarks & Shift Sign-Off *
          </label>
          <textarea
            rows={2}
            value={rolloverNotes}
            onChange={(e) => setRolloverNotes(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: COLORS.bgDark,
              border: `1px solid ${COLORS.border}`,
              borderRadius: "6px",
              color: COLORS.text,
              fontSize: "0.85rem",
              resize: "vertical",
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            paddingTop: "16px",
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px"
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              backgroundColor: "transparent",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.textMuted,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || loadingPreview}
            style={{
              padding: "8px 22px",
              borderRadius: "6px",
              backgroundColor: COLORS.gold,
              border: "none",
              color: "#111",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: submitting ? 0.7 : 1
            }}
          >
            <Lock size={16} />
            {submitting ? "Locking Books..." : "Execute & Freeze Audit"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
