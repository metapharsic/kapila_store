import { useState } from "react";
import { X, CheckCircle2, AlertTriangle, ShieldCheck, Scale } from "lucide-react";
import Btn from "../../../components/Btn";
import Input from "../../../components/Input";
import { COLORS } from "../../../styles/colors";

export default function AcknowledgeTransferModal({ transfer, onConfirm, onClose }) {
  const [acceptedBy, setAcceptedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [itemsReceipt, setItemsReceipt] = useState(
    (transfer?.items || []).map((it) => ({
      id: it.id,
      item_code: it.item_code,
      name: it.name,
      dispatched_qty: parseFloat(it.qty) || 0,
      received_qty: parseFloat(it.received_qty != null ? it.received_qty : it.qty) || 0,
      unit: it.unit,
      condition_status: it.condition_status || "Good",
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!transfer) return null;

  const updateLine = (idx, key, val) => {
    setItemsReceipt((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  };

  const handleAcceptAllMatch = () => {
    setItemsReceipt((prev) =>
      prev.map((it) => ({
        ...it,
        received_qty: it.dispatched_qty,
        condition_status: "Good",
      }))
    );
  };

  const hasAnyShrinkage = itemsReceipt.some(
    (it) => parseFloat(it.received_qty) < parseFloat(it.dispatched_qty)
  );

  const handleSubmit = async () => {
    setError("");
    if (!acceptedBy.trim()) {
      return setError("Receiver name or signature is required.");
    }

    for (const it of itemsReceipt) {
      const rQty = parseFloat(it.received_qty);
      if (isNaN(rQty) || rQty < 0) {
        return setError(`Invalid received quantity for ${it.name}. Cannot be negative.`);
      }
      if (rQty > it.dispatched_qty) {
        return setError(`Received quantity for ${it.name} (${rQty}) cannot exceed dispatched quantity (${it.dispatched_qty}).`);
      }
    }

    try {
      setSubmitting(true);
      await onConfirm({
        accepted_by: acceptedBy.trim(),
        remarks: remarks.trim() || undefined,
        items: itemsReceipt.map((it) => ({
          id: it.id,
          item_code: it.item_code,
          received_qty: parseFloat(it.received_qty),
          condition_status: it.condition_status,
        })),
      });
    } catch (e) {
      setError(e.message || "Failed to acknowledge transfer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          background: COLORS.bg,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          maxWidth: 720,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: COLORS.surface,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} color={COLORS.teal} />
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
                Agent Gatekeeper — Receive & Acknowledge Handshake
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted }}>
                Transfer: <strong style={{ color: COLORS.teal }}>{transfer.transfer_number}</strong> ({transfer.from_location} ➔ {transfer.to_location})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: COLORS.textMuted,
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${COLORS.coral}`,
                borderRadius: 6,
                color: COLORS.coral,
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Verify Dispatched Line Items & Physical Condition
            </span>
            <Btn small variant="ghost" onClick={handleAcceptAllMatch}>
              ✓ Match All Dispatched Qty
            </Btn>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}>
                {["Item", "Dispatched", "Received Qty", "Variance", "Condition"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: COLORS.textMuted, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itemsReceipt.map((it, idx) => {
                const variance = Math.max(0, it.dispatched_qty - parseFloat(it.received_qty || 0));
                return (
                  <tr key={it.id || idx} style={{ borderBottom: `1px solid ${COLORS.border}33` }}>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontWeight: 600, color: COLORS.text }}>{it.name}</span>
                      <div style={{ fontSize: 10, color: COLORS.teal, fontFamily: "monospace" }}>{it.item_code}</div>
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: COLORS.textMuted }}>
                      {it.dispatched_qty} {it.unit}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input
                        type="number"
                        min="0"
                        max={it.dispatched_qty}
                        step="any"
                        value={it.received_qty}
                        onChange={(e) => updateLine(idx, "received_qty", e.target.value)}
                        style={{
                          width: 85,
                          padding: "6px 8px",
                          background: COLORS.bg,
                          border: `1px solid ${variance > 0 ? COLORS.coral : COLORS.border}`,
                          color: COLORS.text,
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      />
                      <span style={{ marginLeft: 5, fontSize: 11, color: COLORS.textMuted }}>{it.unit}</span>
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: variance > 0 ? COLORS.coral : COLORS.success }}>
                      {variance > 0 ? `-${variance.toFixed(2)} ${it.unit}` : "0.00 (100%)"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <select
                        value={it.condition_status}
                        onChange={(e) => updateLine(idx, "condition_status", e.target.value)}
                        style={{
                          padding: "5px 8px",
                          background: COLORS.bg,
                          border: `1px solid ${COLORS.border}`,
                          color: it.condition_status === "Good" ? COLORS.success : COLORS.coral,
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        <option value="Good">Good ✓</option>
                        <option value="Damaged">Damaged ⚠️</option>
                        <option value="Substandard">Substandard</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {hasAnyShrinkage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 11,
                color: "#d97706",
              }}
            >
              <AlertTriangle size={15} />
              <span>
                <strong>Transit Loss Notice:</strong> You have recorded a difference between dispatched and received quantities. Agent Veritas will automatically book the variance into the stock ledger under <strong>TRANSFER_LOSS</strong>.
              </span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Input
              label="Receiving Officer / Chef *"
              value={acceptedBy}
              onChange={(e) => setAcceptedBy(e.target.value)}
              placeholder="Your full name"
            />
            <div>
              <label style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", display: "block", marginBottom: 5, letterSpacing: "0.05em" }}>
                Receipt Notes / Remarks
              </label>
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Condition remarks or inspection comments…"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            background: COLORS.surface,
          }}
        >
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Btn>
          <Btn onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Posting to Ledger…" : "Confirm Receipt & Post Ledger ✓"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
