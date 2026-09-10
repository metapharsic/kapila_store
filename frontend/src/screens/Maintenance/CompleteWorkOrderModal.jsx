import React, { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";

export default function CompleteWorkOrderModal({ isOpen, onClose, workOrder, onSubmit }) {
  const [actionTaken, setActionTaken] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [laborCost, setLaborCost] = useState("0");
  const [assignedTo, setAssignedTo] = useState(workOrder?.assigned_to || "");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !workOrder) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        action_taken: actionTaken.trim() || "Maintenance service executed and tested.",
        root_cause: rootCause.trim() || null,
        labor_cost: parseFloat(laborCost) || 0,
        assigned_to: assignedTo.trim() || "Maintenance Engineer"
      });
      onClose();
    } catch (err) {
      alert("Failed to complete work order: " + (err.message || "Error"));
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
          background: "rgba(16, 185, 129, 0.08)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "rgba(16, 185, 129, 0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981"
            }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                Complete Work Order & Close Ticket
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                {workOrder.wo_number} • {workOrder.asset_name}
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
              Action Taken / Resolution *
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Cleared burner nozzle blockage, replaced pigtail brass connector, tested flame stability..."
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none", resize: "vertical"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
              Root Cause (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Grease carbon accumulation / Voltage spike / Wear & tear"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Technician / Assigned To
              </label>
              <input
                type="text"
                placeholder="Technician name"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Labor / Service Cost (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>
          </div>

          <div style={{
            background: "rgba(15, 23, 42, 0.6)", padding: "10px 14px", borderRadius: 8,
            border: "1px solid #334155", fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between"
          }}>
            <span>Parts Consumed Cost: <strong>₹{parseFloat(workOrder.parts_cost || 0).toFixed(2)}</strong></span>
            <span>Total WO Cost: <strong style={{ color: "#10b981" }}>₹{(parseFloat(workOrder.parts_cost || 0) + (parseFloat(laborCost) || 0)).toFixed(2)}</strong></span>
          </div>

          {/* Footer */}
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
                padding: "9px 20px", borderRadius: 8, background: "#10b981",
                border: "none", color: "#ffffff", fontWeight: 700, fontSize: 13,
                cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <CheckCircle2 size={16} />
              {submitting ? "Closing..." : "Mark Completed & Operational"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
