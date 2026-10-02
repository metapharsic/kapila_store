import React, { useState } from "react";
import { COLORS } from "../../styles/colors";
import { security } from "../../api";
import { LogOut, AlertCircle, X, Check, Clock } from "lucide-react";

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
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px"
    }}>
      <div style={{
        background: "var(--bg-modal)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "14px",
        width: "100%",
        maxWidth: "480px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        color: "var(--text-main)"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%)"
        }}>
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
              <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>
                Log Vehicle Outward Exit
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                Pass #{pass.pass_number} • {pass.vehicle_number}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

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

        <form onSubmit={handleSubmit} style={{ padding: "18px 20px" }}>
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
      </div>
    </div>
  );
}
