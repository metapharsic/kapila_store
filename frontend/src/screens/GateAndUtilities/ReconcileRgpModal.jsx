import { useState } from "react";
import ModalShell from "../../components/ui/ModalShell";
import { security } from "../../api";
import { AlertCircle, Check, Clock, PackageCheck } from "lucide-react";

export default function ReconcileRgpModal({ isOpen, pass, onClose, onSuccess }) {
  const [qtyReturned, setQtyReturned] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !pass) return null;

  const currentBalance = pass.returnable_balance_due || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(qtyReturned, 10);
    if (isNaN(qty) || qty <= 0) {
      setError("Please enter a valid returned quantity (> 0)");
      return;
    }
    if (qty > currentBalance) {
      setError(`Cannot return more than the balance due (${currentBalance})`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await security.reconcileRgp(pass.id, {
        qty_returned: qty,
        notes: notes.trim()
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to reconcile returnable container receipt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="compact"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: "rgba(16, 185, 129, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#34D399"
          }}>
            <PackageCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700" }}>
              Reconcile Returnable Containers (RGP)
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
              Pass #{pass.pass_number} • {pass.vendor_name || "Vendor"}
            </p>
          </div>
        </div>
      }
    >
      {error && (
          <div style={{
            margin: "14px 20px 0",
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#FCA5A5",
            fontSize: "12px"
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

      <form onSubmit={handleSubmit}>
        <div style={{
          padding: "14px",
          background: "var(--bg-page)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          marginBottom: "16px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
            gap: "10px",
            textAlign: "center"
          }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Dispatched</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", marginTop: "2px" }}>
                {pass.returnable_qty_out}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Already Returned</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: "#34D399", marginTop: "2px" }}>
                {pass.returnable_qty_in}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Balance Due</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: "#F87171", marginTop: "2px" }}>
                {pass.returnable_balance_due}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
              Container Type
            </label>
            <input
              type="text"
              disabled
              value={pass.returnable_item_type || "Not specified"}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-page)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "13px"
              }}
            />
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
              Quantity Returned by Vendor Now *
            </label>
            <input
              type="number"
              min="1"
              max={currentBalance}
              value={qtyReturned}
              onChange={(e) => setQtyReturned(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-main)",
                fontSize: "14px",
                fontWeight: "700"
              }}
            />
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
              New Remaining Balance: {Math.max(0, currentBalance - (parseInt(qtyReturned, 10) || 0))} units
            </span>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
              Inspection & Delivery Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Received 12 refilled HP Gas commercial cylinders with safety cap intact."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-main)",
                fontSize: "13px",
                resize: "vertical"
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 18px",
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                border: "none",
                borderRadius: "8px",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: "700",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {loading ? <Clock size={15} /> : <Check size={15} />}
              {loading ? "Reconciling..." : "Save Container Receipt"}
            </button>
          </div>
      </form>
    </ModalShell>
  );
}
