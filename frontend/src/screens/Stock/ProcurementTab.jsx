import React from "react";
import { COLORS } from "../../styles/colors";
import { poStatusStyle } from "../../utils/poStatus";
import { useAppContext } from "../../context/AppContext";

const ProcurementTab = ({ procurementLoading, procurementData }) => {
  const { setCurrentScreen } = useAppContext();
  if (procurementLoading) {
    return <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading procurement data…</p>;
  }

  if (!procurementData) {
    return <p style={{ color: COLORS.muted, textAlign: "center", padding: 40 }}>No procurement data yet</p>;
  }

  return (
    <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, overflowY: "auto", maxHeight: 420 }}>
      {/* Recent POs */}
      <div>
        <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Recent Purchase Orders</p>
        {(procurementData.recentPOs || []).length === 0 ? (
          <p style={{ color: COLORS.muted, fontSize: 12 }}>No POs yet.</p>
        ) : (
          <table style={{ fontSize: 12 }}>
            <thead><tr><th>PO Number</th><th>Supplier</th><th>Date</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {(procurementData.recentPOs || []).map((po) => {
                const sc = poStatusStyle(po.status);
                return (
                  <tr key={po.id} onClick={() => setCurrentScreen("pos")} style={{ cursor: "pointer" }} title="Open in Purchase Orders">
                    <td style={{ fontFamily: "monospace", color: COLORS.teal, fontSize: 11 }}>{po.po_number}</td>
                    <td style={{ fontWeight: 500 }}>{po.supplier_name}</td>
                    <td style={{ color: COLORS.muted }}>{po.date}</td>
                    <td><span style={{ background: sc.bg, color: sc.text, padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{po.status}</span></td>
                    <td style={{ color: COLORS.accent, fontWeight: 600 }}>₹{parseFloat(po.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent GRNs */}
      <div>
        <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Recent Goods Receipts</p>
        {(procurementData.recentGRNs || []).length === 0 ? (
          <p style={{ color: COLORS.muted, fontSize: 12 }}>No GRNs yet.</p>
        ) : (
          <table style={{ fontSize: 12 }}>
            <thead><tr><th>GRN #</th><th>Supplier</th><th>Date</th><th>Invoice</th><th>Total</th></tr></thead>
            <tbody>
              {(procurementData.recentGRNs || []).map((g) => (
                <tr key={g.id}>
                  <td style={{ fontFamily: "monospace", color: COLORS.teal, fontSize: 11 }}>{g.grn_number}</td>
                  <td style={{ fontWeight: 500 }}>{g.supplier_name}</td>
                  <td style={{ color: COLORS.muted }}>{g.date}</td>
                  <td style={{ color: COLORS.muted, fontSize: 11 }}>{g.invoice_no || "—"}</td>
                  <td style={{ color: COLORS.accent, fontWeight: 600 }}>₹{parseFloat(g.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Supplier master summary */}
      <div style={{ gridColumn: "1 / -1" }}>
        <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Registered Suppliers</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {(procurementData.suppliers || []).length === 0 ? (
            <p style={{ color: COLORS.muted, fontSize: 12 }}>No suppliers registered. Go to Suppliers to add vendors.</p>
          ) : (
            (procurementData.suppliers || []).map((s) => (
              <div key={s.id} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", minWidth: 160 }}>
                <p style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{s.name}</p>
                {s.phone && <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 3 }}>📞 {s.phone}</p>}
                {s.gstin && <p style={{ fontSize: 10, color: COLORS.teal, marginTop: 3, fontFamily: "monospace" }}>{s.gstin}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcurementTab;
