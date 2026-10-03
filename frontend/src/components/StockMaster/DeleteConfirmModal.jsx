import { useState } from "react";
import Btn from "../Btn";
import ModalShell from "../ui/ModalShell";
import { AlertTriangle, Trash2 } from "lucide-react";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  item,
  onConfirm,
  onSuccess
}) {
  const [reason, setReason] = useState("Damaged / Spoilage Write-Off");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const remaining = parseFloat(item.remaining || 0);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (onConfirm) {
        await onConfirm(item.id, `${reason}: ${notes}`);
      }
      if (onSuccess) onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={20} style={{ color: "#ef4444" }} />
          Delete Stock Item Confirmation
        </span>
      }
      onClose={onClose}
      size="compact"
      zIndex={1200}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              boxSizing: "border-box",
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
    </ModalShell>
  );
}
