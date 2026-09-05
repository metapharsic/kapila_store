import React from "react";
import { COLORS } from "../../styles/colors";
import Pagination from "../../components/Pagination";

const LedgerTab = ({ ledgerLoading, ledgerData, ledgerPage, ledgerTotal, limit, onPage, filters = {}, onFilterChange = () => {}, onExport = () => {} }) => {
  const handleChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const FilterBar = () => (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
      <input
        type="text"
        value={filters.q || ""}
        onChange={(e) => handleChange("q", e.target.value)}
        placeholder="Search item…"
        style={{ padding: "6px 10px", fontSize: 12.5, borderRadius: 6, border: `1px solid ${COLORS.border}`, minWidth: 160 }}
      />
      <select
        value={filters.type || ""}
        onChange={(e) => handleChange("type", e.target.value)}
        style={{ padding: "6px 10px", fontSize: 12.5, borderRadius: 6, border: `1px solid ${COLORS.border}` }}
      >
        <option value="">All Types</option>
        <option value="Purchase">Purchase</option>
        <option value="Issue">Issue</option>
        <option value="Leftover">Leftover</option>
        <option value="Adjustment">Adjustment</option>
      </select>
      <input
        type="date"
        value={filters.date_from || ""}
        onChange={(e) => handleChange("date_from", e.target.value)}
        style={{ padding: "6px 10px", fontSize: 12.5, borderRadius: 6, border: `1px solid ${COLORS.border}` }}
      />
      <span style={{ color: COLORS.muted, fontSize: 12 }}>to</span>
      <input
        type="date"
        value={filters.date_to || ""}
        onChange={(e) => handleChange("date_to", e.target.value)}
        style={{ padding: "6px 10px", fontSize: 12.5, borderRadius: 6, border: `1px solid ${COLORS.border}` }}
      />
      <button
        onClick={onExport}
        style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text, cursor: "pointer" }}
      >
        Export CSV
      </button>
    </div>
  );

  if (ledgerLoading) {
    return (
      <div>
        <FilterBar />
        <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading ledger…</p>
      </div>
    );
  }

  if (!ledgerData || ledgerData.length === 0) {
    return (
      <div>
        <FilterBar />
        <p style={{ color: COLORS.muted, textAlign: "center", padding: 40 }}>No stock movement recorded matching these filters.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <FilterBar />
      <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: "0 6px", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ background: "transparent", textAlign: "left" }}>Date</th>
              <th style={{ background: "transparent", textAlign: "left" }}>Item</th>
              <th style={{ background: "transparent", textAlign: "left" }}>Action</th>
              <th style={{ background: "transparent", textAlign: "left" }}>Qty</th>
              <th style={{ background: "transparent", textAlign: "left" }}>Value</th>
              <th style={{ background: "transparent", textAlign: "left" }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {ledgerData.map((item, index) => {
              const isPurchase = item.type === "Purchase";
              const isIssue = item.type === "Issue";
              const typeColor = isPurchase ? COLORS.teal : isIssue ? COLORS.accent : COLORS.purple;
              const typeBg = isPurchase ? COLORS.teal + "15" : isIssue ? COLORS.accent + "15" : COLORS.purple + "15";

              return (
                <tr key={index} style={{ background: COLORS.bg + "44" }}>
                  <td style={{ color: COLORS.muted, padding: "10px 14px" }}>{item.date}</td>
                  <td style={{ fontWeight: 600, padding: "10px 14px" }}>
                    <span style={{ color: COLORS.accent, fontSize: 10, display: "block", fontWeight: 600 }}>{item.item_code || "KPL-NEW"}</span>
                    {item.name}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="badge" style={{ background: typeBg, color: typeColor, textTransform: "uppercase", fontSize: 10 }}>
                      {item.type}
                    </span>
                  </td>
                  <td style={{ color: isPurchase ? COLORS.success : isIssue ? COLORS.coral : COLORS.text, fontWeight: 500, padding: "10px 14px" }}>
                    {isPurchase ? "+" : isIssue ? "-" : ""}{item.qty} {item.unit && <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400 }}>{item.unit}</span>}
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: COLORS.text }}>
                    {item.value != null ? `₹${parseFloat(item.value).toFixed(2)}` : "—"}
                  </td>
                  <td style={{ color: COLORS.muted, fontSize: 12, padding: "10px 14px" }}>
                    {isPurchase ? `From ${item.detail || "Unknown"}` : isIssue ? `Issued to ${item.detail}` : `Detail: ${item.detail}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${COLORS.border}` }}>
        <Pagination page={ledgerPage} total={ledgerTotal} limit={limit} onPage={onPage} />
      </div>
    </div>
  );
};

export default LedgerTab;
