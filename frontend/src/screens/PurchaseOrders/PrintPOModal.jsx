import React, { useRef } from "react";
import { COLORS } from "../../styles/colors";
import { X, Printer, CheckCircle } from "lucide-react";

export default function PrintPOModal({ open, onClose, po }) {
  const printRef = useRef();

  if (!open || !po) return null;

  const handlePrint = () => {
    window.print();
  };

  const fmt = (n) => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#18181b",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          width: "100%",
          maxWidth: 800,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Header Actions */}
        <div
          style={{
            padding: "12px 20px",
            background: "#111113",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 13 }}>
              PRINT PREVIEW: {po.po_number}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handlePrint}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                background: COLORS.accent,
                color: "#18181b",
                fontWeight: 700,
                fontSize: 12,
                border: "none",
                cursor: "pointer",
              }}
            >
              <Printer size={14} /> Print Now
            </button>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: COLORS.muted,
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Document Content */}
        <div
          ref={printRef}
          className="print-po-sheet"
          style={{
            padding: "36px 40px",
            overflowY: "auto",
            background: "#ffffff",
            color: "#18181b",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {/* Hotel Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid #e8a838",
              paddingBottom: 20,
              marginBottom: 24,
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "'DM Serif Display', Georgia, serif",
                  fontSize: 26,
                  margin: "0 0 4px 0",
                  color: "#18181b",
                  letterSpacing: "0.02em",
                }}
              >
                HOTEL KAPILA
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: "#52525b" }}>
                Procurement & Central Store Operations
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#71717a" }}>
                GSTIN: 36AAACH1234F1Z9 · Central Warehouse, Kitchen Dept
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #f59e0b",
                  color: "#92400e",
                  padding: "4px 12px",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 12,
                  display: "inline-block",
                  marginBottom: 6,
                }}
              >
                PURCHASE ORDER
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#18181b" }}>
                {po.po_number}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#52525b" }}>
                Date: {new Date(po.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#71717a" }}>
                Status: <strong>{po.status}</strong>
              </p>
            </div>
          </div>

          {/* Supplier Info */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 24,
              padding: "14px 16px",
              background: "#f4f4f5",
              borderRadius: 8,
            }}
          >
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#71717a" }}>
                SUPPLIER DETAILS
              </p>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#18181b" }}>
                {po.supplier_name}
              </h3>
              <p style={{ margin: "0 0 2px 0", fontSize: 12, color: "#52525b" }}>
                GSTIN: {po.supplier_gstin || "N/A"}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#52525b" }}>
                Phone: {po.supplier_phone || "N/A"}
              </p>
            </div>
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#71717a" }}>
                DELIVERY ADDRESS & INSTRUCTIONS
              </p>
              <p style={{ margin: "0 0 2px 0", fontSize: 12, fontWeight: 600, color: "#18181b" }}>
                Central Receiving Dock, Hotel Kapila
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#52525b" }}>
                Deliver goods between 06:00 AM – 11:00 AM with Original Tax Invoice.
              </p>
              {po.notes && (
                <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "#d97706", fontStyle: "italic" }}>
                  Notes: {po.notes}
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div style={{ overflowX: "auto", marginBottom: 24 }}>
          <table
            style={{
              width: "100%",
              minWidth: 520,
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ background: "#27272a", color: "#ffffff" }}>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>#</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Item Code</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Description</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Quantity</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Unit Price (₹)</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map((it, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #e4e4e7" }}>
                  <td style={{ padding: "8px 10px", color: "#71717a" }}>{idx + 1}</td>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#b45309" }}>
                    {it.item_code || "—"}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{it.name}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    {it.qty} {it.unit}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    ₹{fmt(it.unit_price)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>
                    ₹{fmt(it.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #18181b" }}>
                <td colSpan={4}></td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                  Grand Total:
                </td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 800, fontSize: 14, color: "#b45309" }}>
                  ₹{fmt(po.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>

          {/* Terms and Signatures */}
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: 11, fontWeight: 700, color: "#71717a" }}>
                TERMS & CONDITIONS
              </p>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: "#52525b", lineHeight: 1.4 }}>
                <li>Items are subject to physical inspection and QA temperature approval.</li>
                <li>Invoice rate must strictly conform to agreed PO contract rate (max 10% tolerance).</li>
                <li>Payment processed via double-entry bank transfer within 15 days of GRN.</li>
              </ul>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 30 }}>
              <div style={{ textAlign: "center", borderTop: "1px solid #71717a", width: 140 }}>
                <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#71717a" }}>Storekeeper Signature</p>
              </div>
              <div style={{ textAlign: "center", borderTop: "1px solid #71717a", width: 140 }}>
                <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#71717a" }}>Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
