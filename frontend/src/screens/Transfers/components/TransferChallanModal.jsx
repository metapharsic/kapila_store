import { useRef } from "react";
import { Printer, X, Building2, CheckCircle2, ShieldAlert } from "lucide-react";
import Btn from "../../../components/Btn";
import { COLORS } from "../../../styles/colors";

export default function TransferChallanModal({ transfer, onClose }) {
  const printRef = useRef(null);

  if (!transfer) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalValue = (transfer.items || []).reduce(
    (sum, it) => sum + (parseFloat(it.total_value) || (parseFloat(it.qty) * parseFloat(it.unit_price || 0))),
    0
  );

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
          maxWidth: 780,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Modal Top Bar */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: COLORS.surface,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.accent }}>
              HOTEL KAPILA — MATERIAL TRANSFER CHALLAN
            </span>
            <span
              style={{
                fontFamily: "monospace",
                background: "rgba(20, 184, 166, 0.15)",
                color: COLORS.teal,
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {transfer.transfer_number}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Btn small onClick={handlePrint}>
              <Printer size={13} style={{ marginRight: 5 }} /> Print Challan
            </Btn>
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
        </div>

        {/* Printable Area */}
        <div
          ref={printRef}
          className="print-challan-container"
          style={{
            padding: 24,
            overflowY: "auto",
            flex: 1,
            color: COLORS.text,
            background: COLORS.surface,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: `2px solid ${COLORS.border}`,
              paddingBottom: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: 18, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.04em" }}>
                HOTEL KAPILA RESIDENCY & RESTAURANTS
              </h2>
              <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted }}>
                Central Stores & Food Production Logistics Management System
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: 11, color: COLORS.textMuted }}>
                GSTIN: 36AAACH7492C1Z4 · Internal Material Movement Voucher
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  border: `1px solid ${COLORS.teal}`,
                  borderRadius: 6,
                  color: COLORS.teal,
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.05em",
                }}
              >
                {transfer.transfer_number}
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: COLORS.textMuted }}>
                Date: <strong>{transfer.date}</strong>
              </p>
              <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted }}>
                Type: <strong>{transfer.transfer_type || "STORE_TO_DEPT"}</strong>
              </p>
            </div>
          </div>

          {/* Movement Flow Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
              padding: 12,
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div>
              <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Dispatched From
              </span>
              <p style={{ margin: "3px 0 0 0", fontSize: 13, fontWeight: 700, color: COLORS.gold || COLORS.accent }}>
                {transfer.from_location}
              </p>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                By: {transfer.initiated_by || "Storekeeper"}
              </span>
            </div>

            <div>
              <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Destination Department
              </span>
              <p style={{ margin: "3px 0 0 0", fontSize: 13, fontWeight: 700, color: COLORS.teal }}>
                {transfer.to_location}
              </p>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                Status: <strong>{transfer.status}</strong>
              </span>
            </div>

            <div>
              <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Verification & Acceptance
              </span>
              <p style={{ margin: "3px 0 0 0", fontSize: 13, fontWeight: 700, color: transfer.status === "Accepted" ? COLORS.success : COLORS.coral }}>
                {transfer.status === "Accepted" ? "Verified & Received ✓" : "In-Transit / Awaiting Sign-off"}
              </p>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                Accepted By: {transfer.accepted_by || "—"}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: COLORS.bg, borderBottom: `2px solid ${COLORS.border}` }}>
                {["#", "SKU / Code", "Item Description", "Rack/Bin", "Dispatched Qty", "Received Qty", "Rate (₹)", "Total (₹)"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: COLORS.textMuted, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(transfer.items || []).map((it, idx) => (
                <tr key={it.id || idx} style={{ borderBottom: `1px solid ${COLORS.border}44` }}>
                  <td style={{ padding: "8px 10px", color: COLORS.textMuted }}>{idx + 1}</td>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", color: COLORS.teal, fontSize: 11 }}>
                    {it.item_code}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: COLORS.text }}>
                    {it.name}
                    {it.batch_no && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: COLORS.purple, fontFamily: "monospace" }}>
                        ({it.batch_no})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", color: COLORS.textMuted, fontSize: 11 }}>
                    {it.rack ? `${it.rack}/${it.shelf || "-"}/${it.bin || "-"}` : "Central"}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: COLORS.accent }}>
                    {it.qty} {it.unit}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: it.received_qty != null && it.received_qty < it.qty ? COLORS.coral : COLORS.success }}>
                    {it.received_qty != null ? `${it.received_qty} ${it.unit}` : `${it.qty} ${it.unit}`}
                  </td>
                  <td style={{ padding: "8px 10px", color: COLORS.textMuted }}>
                    ₹{(parseFloat(it.unit_price) || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: COLORS.text }}>
                    ₹{(parseFloat(it.total_value) || (it.qty * (it.unit_price || 0))).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${COLORS.border}`, background: COLORS.bg }}>
                <td colSpan={6} style={{ padding: "10px", fontWeight: 700, textAlign: "right", color: COLORS.textMuted, textTransform: "uppercase" }}>
                  Estimated Transfer Valuation Total:
                </td>
                <td colSpan={2} style={{ padding: "10px", fontWeight: 700, fontSize: 14, color: COLORS.gold || COLORS.accent }}>
                  ₹{totalValue.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>

          {transfer.remarks && (
            <div style={{ padding: 10, background: COLORS.bg, borderRadius: 6, border: `1px solid ${COLORS.border}`, marginBottom: 16, fontSize: 11 }}>
              <span style={{ fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase" }}>Remarks / Purpose: </span>
              <span style={{ color: COLORS.text }}>{transfer.remarks}</span>
            </div>
          )}

          {/* Signatures & Handshake Block */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              marginTop: 24,
              paddingTop: 16,
              borderTop: `1px dashed ${COLORS.border}`,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ height: 40, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 6 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text }}>
                {transfer.initiated_by || "Storekeeper"}
              </span>
              <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted }}>Dispatched By / Signature</p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ height: 40, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 6 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text }}>
                Security / Transit Check
              </span>
              <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted }}>Gate Pass / Handover Sign</p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ height: 40, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 6 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text }}>
                {transfer.accepted_by || "Receiving Chef / Mgr"}
              </span>
              <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted }}>Received & Verified By</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
