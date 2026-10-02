import React, { useState } from "react";
import { COLORS } from "../../styles/colors";
import { AlertTriangle, X, Wrench } from "lucide-react";

export default function ReportBreakdownModal({ isOpen, onClose, assets = [], onSubmit }) {
  const [assetId, setAssetId] = useState(assets[0]?.id || "");
  const [priority, setPriority] = useState("HIGH");
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assetId || !description.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        asset_id: parseInt(assetId, 10),
        order_type: "BREAKDOWN",
        priority,
        issue_description: description.trim(),
        reported_by: reportedBy.trim() || "Kitchen Team"
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 12,
        width: "100%", maxWidth: 520, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #334155",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(239, 68, 68, 0.1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "rgba(239, 68, 68, 0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444"
            }}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                Report Kitchen / Facility Breakdown
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Direct emergency work order dispatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
              Select Machine / Equipment *
            </label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              required
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
              }}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.asset_code}] {a.name} ({a.department})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Priority Level *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              >
                <option value="CRITICAL">🔴 Critical (Immediate Service Stop)</option>
                <option value="HIGH">🟠 High (Impacting Output)</option>
                <option value="MEDIUM">🟡 Medium (Partial Functional)</option>
                <option value="LOW">🟢 Low (Minor Defect)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Reported By
              </label>
              <input
                type="text"
                placeholder="e.g. Chef Ramesh / Shift Incharge"
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
              Fault Symptoms / Issue Description *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Describe what happened: e.g. Freezing temperature dropped to 8°C, burner flame sputtering with yellow smoke, gas smell detected..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none", resize: "vertical"
              }}
            />
          </div>

          {/* Footer actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 16px", borderRadius: 8, background: "transparent",
                border: "1px solid #334155", color: "var(--text-muted)", fontSize: 13, cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "9px 20px", borderRadius: 8, background: "#ef4444",
                border: "none", color: "#ffffff", fontWeight: 600, fontSize: 13,
                cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Wrench size={15} />
              {submitting ? "Logging Ticket..." : "Dispatch Breakdown Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
