import { useState } from "react";
import { X, Check, Send, ArrowRight, AlertTriangle, Package } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import * as api from "../../../api";

export default function CompilePreviewModal({ items, dept, date, stocks = [], onLoadToManual, onClose, onSubmitSuccess }) {
  const [editableItems, setEditableItems] = useState(
    items.map((it) => ({ ...it, included: true }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitError, setSubmitError] = useState("");

  const stockMap = Object.fromEntries(
    stocks.map((s) => [s.name.toLowerCase(), s])
  );

  const getStockStatus = (item) => {
    const s = stockMap[item.name.toLowerCase()];
    if (!s) return null;
    const needed = parseFloat(item.qty) || 0;
    const avail  = parseFloat(s.remaining || 0);
    if (avail >= needed)     return { label: `${avail} ${s.unit} available`, color: "#10B981", icon: "✓" };
    if (avail > 0)           return { label: `Only ${avail} ${s.unit} in stock`, color: "#F59E0B", icon: "⚠" };
    return                          { label: "Out of stock", color: "#EF4444", icon: "✗" };
  };

  const activeItems = editableItems.filter((it) => it.included);

  const handleQtyChange = (idx, val) => {
    setEditableItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, qty: val } : it))
    );
  };

  const handleToggle = (idx) => {
    setEditableItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, included: !it.included } : it))
    );
  };

  const handleLoadToManual = () => {
    onLoadToManual(activeItems.map(({ included, ...rest }) => rest));
    onClose();
  };

  const handleSubmitDirect = async () => {
    if (activeItems.length === 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = {
        dept,
        date,
        indent_type: "smart",
        items: activeItems.map((it) => ({
          name: it.name,
          qty: parseFloat(it.qty) || 0,
          unit: it.unit || "kg",
          item_code: it.item_code || "KPL-NEW",
        })),
      };
      await api.indents.create(payload);
      setSubmitMsg(`✓ Indent submitted for ${dept} on ${date}`);
      setTimeout(() => {
        onSubmitSuccess?.();
        onClose();
      }, 1800);
    } catch (err) {
      setSubmitError(err.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "white", borderRadius: "16px",
        width: "100%", maxWidth: "720px",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #E5E7EB",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          background: "#1E293B",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "white" }}>
              ⚡ Compiled Indent Preview
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94A3B8" }}>
              {dept} · {date} · {activeItems.length} items · Review, edit, then submit or load to manual
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}
          >
            <X size={18} color="white" />
          </button>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {submitMsg ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={28} color="#10B981" />
              </div>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#065F46", margin: 0 }}>{submitMsg}</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase" }}>✓</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase" }}>Item</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase" }}>Src</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase" }}>Qty</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase" }}>Unit</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase" }}>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {editableItems.map((item, idx) => {
                  const status = getStockStatus(item);
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        opacity: item.included ? 1 : 0.4,
                        background: item.included ? "white" : "#F8FAFC",
                        transition: "all 0.15s",
                      }}
                    >
                      <td style={{ padding: "8px 10px" }}>
                        <input
                          type="checkbox"
                          checked={item.included}
                          onChange={() => handleToggle(idx)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 600, color: "#1E293B" }}>{item.name}</div>
                        <div style={{ fontSize: "10px", color: "#94A3B8" }}>{item.item_code}</div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        {item.source === "both"   && <span style={{ fontSize: 9, fontWeight: 800, background: "#EDE9FE", color: "#6D28D9", padding: "1px 5px", borderRadius: 3 }}>R+T</span>}
                        {item.source === "recipe" && <span style={{ fontSize: 9, fontWeight: 800, background: "#DBEAFE", color: "#1D4ED8", padding: "1px 5px", borderRadius: 3 }}>R</span>}
                        {item.source === "trend"  && <span style={{ fontSize: 9, fontWeight: 800, background: "#D1FAE5", color: "#065F46", padding: "1px 5px", borderRadius: 3 }}>T</span>}
                        {!item.source             && <span style={{ fontSize: 10, color: "#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={item.qty}
                          disabled={!item.included}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          style={{
                            width: "72px", padding: "4px 8px",
                            fontSize: "13px", fontWeight: 700,
                            textAlign: "right",
                            border: "1px solid #CBD5E1", borderRadius: "6px",
                            background: item.included ? "white" : "#F1F5F9",
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px 10px", color: "#64748B", fontWeight: 500 }}>{item.unit}</td>
                      <td style={{ padding: "8px 10px" }}>
                        {status ? (
                          <span style={{
                            fontSize: "11px", fontWeight: 600, color: status.color,
                            background: status.color + "15",
                            padding: "2px 8px", borderRadius: "20px",
                            display: "inline-flex", alignItems: "center", gap: 4,
                          }}>
                            {status.icon} {status.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#CBD5E1" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {submitError && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 8, color: "#BE123C", fontSize: "13px", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={14} /> {submitError}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!submitMsg && (
          <div style={{
            padding: "14px 24px", borderTop: "1px solid #E5E7EB",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "#F8FAFC", gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              <strong style={{ color: "#1E293B" }}>{activeItems.length}</strong> of {editableItems.length} items selected
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleLoadToManual}
                disabled={activeItems.length === 0}
                style={{
                  padding: "9px 18px", borderRadius: "8px",
                  border: "1px solid #CBD5E1", background: "white",
                  fontSize: "13px", fontWeight: 600, color: "#475569",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  opacity: activeItems.length === 0 ? 0.5 : 1,
                }}
              >
                <ArrowRight size={14} /> Review in Manual Tab
              </button>
              <button
                onClick={handleSubmitDirect}
                disabled={submitting || activeItems.length === 0}
                style={{
                  padding: "9px 20px", borderRadius: "8px",
                  border: "none", background: "#e8a838",
                  fontSize: "13px", fontWeight: 700, color: "#1E293B",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  opacity: (submitting || activeItems.length === 0) ? 0.6 : 1,
                  boxShadow: "0 2px 8px rgba(232,168,56,0.35)",
                }}
              >
                {submitting ? (
                  <><div style={{ width: 14, height: 14, border: "2px solid #1E293B40", borderTopColor: "#1E293B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Submitting…</>
                ) : (
                  <><Send size={14} /> Compile & Submit Directly</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
