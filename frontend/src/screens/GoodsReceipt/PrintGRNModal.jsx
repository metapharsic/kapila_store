import React, { useRef } from "react";
import { COLORS } from "../../styles/colors";
import { X, Printer } from "lucide-react";

export default function PrintGRNModal({ open, onClose, grn }) {
  const printRef = useRef();

  if (!open || !grn) return null;

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
          maxWidth: 850,
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
              PRINT PREVIEW: {grn.grn_number}
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
          className="print-grn-sheet"
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
              borderBottom: "2px solid #10b981",
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
                }}
              >
                HOTEL KAPILA
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: "#52525b" }}>
                Central Receiving & Quality Assurance
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#71717a" }}>
                GSTIN: 36AAACH1234F1Z9 · Inward Goods Inspection
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  background: "#d1fae5",
                  border: "1px solid #10b981",
                  color: "#065f46",
                  padding: "4px 12px",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 12,
                  display: "inline-block",
                  marginBottom: 6,
                }}
              >
                GOODS RECEIPT NOTE (GRN)
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#18181b" }}>
                {grn.grn_number}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#52525b" }}>
                Date: {new Date(grn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
              {grn.po_number && (
                <p style={{ margin: 0, fontSize: 11, color: "#b45309", fontWeight: 600 }}>
                  PO Ref: {grn.po_number}
                </p>
              )}
            </div>
          </div>

          {/* Details Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 16,
              marginBottom: 24,
              padding: "12px 16px",
              background: "#f4f4f5",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            <div>
              <p style={{ margin: 0, color: "#71717a", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>Supplier</p>
              <p style={{ margin: "2px 0 0 0", fontWeight: 700, color: "#18181b" }}>{grn.supplier_name}</p>
            </div>
            <div>
              <p style={{ margin: 0, color: "#71717a", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>Invoice Number</p>
              <p style={{ margin: "2px 0 0 0", fontWeight: 600, color: "#18181b" }}>{grn.invoice_no || "N/A"}</p>
            </div>
            <div>
              <p style={{ margin: 0, color: "#71717a", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>Received By</p>
              <p style={{ margin: "2px 0 0 0", fontWeight: 600, color: "#18181b" }}>{grn.received_by || "Central Receiving Store"}</p>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", marginBottom: 24 }}>
          <table
            style={{
              width: "100%",
              minWidth: 640,
              borderCollapse: "collapse",
              fontSize: 11,
            }}
          >
            <thead>
              <tr style={{ background: "#27272a", color: "#ffffff" }}>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>#</th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Item Code</th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Description</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Ordered</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Rcvd</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Acc</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Rej</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Rate (₹)</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Total (₹)</th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Batch/Exp</th>
              </tr>
            </thead>
            <tbody>
              {(grn.items || []).map((it, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #e4e4e7" }}>
                  <td style={{ padding: "8px 6px", color: "#71717a" }}>{idx + 1}</td>
                  <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "#059669" }}>
                    {it.item_code}
                  </td>
                  <td style={{ padding: "8px 6px", fontWeight: 600 }}>{it.name}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "#71717a" }}>
                    {it.qty_ordered ?? "—"} {it.unit}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{it.qty_received}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                    {it.qty_accepted}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: it.qty_rejected > 0 ? "#dc2626" : "#71717a", fontWeight: it.qty_rejected > 0 ? 700 : 400 }}>
                    {it.qty_rejected || 0}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>₹{fmt(it.unit_price)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>₹{fmt(it.landed_cost)}</td>
                  <td style={{ padding: "8px 6px", fontSize: 10, color: "#52525b" }}>
                    {it.batch_no ? `${it.batch_no}` : ""} {it.expiry_date ? `(exp: ${it.expiry_date})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #18181b" }}>
                <td colSpan={7}></td>
                <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, fontSize: 12 }}>
                  Landed Total:
                </td>
                <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 800, fontSize: 13, color: "#059669" }}>
                  ₹{fmt(grn.total_amount)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          </div>

          {/* Signatures */}
          <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ textAlign: "center", borderTop: "1px solid #71717a", width: 150 }}>
              <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#71717a" }}>Inspecting Storekeeper</p>
            </div>
            <div style={{ textAlign: "center", borderTop: "1px solid #71717a", width: 150 }}>
              <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#71717a" }}>Executive Chef / QA Sign</p>
            </div>
            <div style={{ textAlign: "center", borderTop: "1px solid #71717a", width: 150 }}>
              <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#71717a" }}>Accounts Gate Entry</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
