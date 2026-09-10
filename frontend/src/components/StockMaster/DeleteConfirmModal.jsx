import { useState } from "react";
import Btn from "../Btn";
import { AlertTriangle, Trash2, X } from "lucide-react";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  item,
  onConfirm
}) {
  if (!isOpen || !item) return null;

  const [reason, setReason] = useState("Damaged / Spoilage Write-Off");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const remaining = parseFloat(item.remaining || 0);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (onConfirm) {
        await onConfirm(item.id, `${reason}: ${notes}`);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      backdropFilter: "blur(6px)",
      zIndex: 1200,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 16
    }}>
      <div style={{
        background: "var(--color-surface, var(--bg-card))",
        border: "1px solid rgba(239, 68, 68, 0.4)",
        borderRadius: 12,
        width: "100%",
        maxWidth: 480,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.9)",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          background: "rgba(239, 68, 68, 0.12)",
          borderBottom: "1px solid rgba(239, 68, 68, 0.25)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={22} style={{ color: "#ef4444" }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
              Delete Stock Item Confirmation
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>You are about to delete:</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
              {item.name} <span style={{ fontFamily: "monospace", color: "var(--color-gold)" }}>({item.item_code})</span>
            </div>
          </div>

          {remaining > 0 && (
            <div style={{
              padding: 12,
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 8,
              fontSize: 13,
              color: "#f59e0b",
              lineHeight: 1.4
            }}>
              <strong>Caution:</strong> This item currently has <strong>{remaining} {item.unit}</strong> remaining in active inventory. Deleting this record will remove it from available warehouse stock.
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
              Reason for Deletion *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                color: "var(--text-main)",
                fontSize: 13
              }}
            >
              <option value="Damaged / Spoilage Write-Off">Damaged / Spoilage Write-Off</option>
              <option value="Duplicate Entry Correction">Duplicate Entry Correction</option>
              <option value="Supplier Return">Supplier Return</option>
              <option value="Audit Reconciliation Disposal">Audit Reconciliation Disposal</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
              Additional Audit Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide context for the store audit log..."
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                color: "var(--text-main)",
                fontSize: 13,
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* Footer buttons */}
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 6,
            paddingTop: 12,
            borderTop: "1px solid var(--border-color)"
          }}>
            <Btn variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Btn>
            <button
              onClick={handleConfirm}
              disabled={loading}
              style={{
                background: "#ef4444",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: loading ? 0.7 : 1
              }}
            >
              <Trash2 size={16} />
              {loading ? "Deleting…" : "Confirm Deletion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
