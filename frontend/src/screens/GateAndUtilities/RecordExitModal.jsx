import { useState } from "react";
import ModalShell from "../../components/ui/ModalShell";
import { security } from "../../api";
import { LogOut, AlertCircle, Check, Clock } from "lucide-react";

export default function RecordExitModal({ isOpen, pass, onClose, onSuccess }) {
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !pass) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await security.recordExit(pass.id, { remarks });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to log vehicle exit");
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
            background: "rgba(239, 68, 68, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#F87171"
          }}>
            <LogOut size={18} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700" }}>
              Log Vehicle Outward Exit
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
              Pass #{pass.pass_number} • {pass.vehicle_number}
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
            padding: "12px",
            background: "var(--bg-page)",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "12px",
            color: "#CBD5E1",
            lineHeight: "1.6"
          }}>
            <div><strong>Driver:</strong> {pass.driver_name} ({pass.driver_phone || "No phone"})</div>
            <div><strong>Vendor:</strong> {pass.vendor_name || "N/A"}</div>
            <div><strong>In Time:</strong> {pass.in_time ? new Date(pass.in_time).toLocaleString("en-IN") : "-"}</div>
            <div><strong>Purpose:</strong> {pass.purpose}</div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
              Exit Remarks / Verification Note
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Unloading verified by storekeeper Suresh. Empty vehicle leaving gate."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
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
                background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
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
              {loading ? "Recording Exit..." : "Confirm Vehicle Exit"}
            </button>
          </div>
      </form>
    </ModalShell>
  );
}
