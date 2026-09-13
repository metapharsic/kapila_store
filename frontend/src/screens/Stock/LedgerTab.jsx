import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import Pagination from "../../components/Pagination";
import {
  FileSpreadsheet,
  Download,
  ArrowDownRight,
  ArrowUpRight,
  Sliders,
  RotateCcw,
  Database,
  Building2,
  Calendar,
  Layers,
  Search,
  Filter
} from "lucide-react";

const DEPARTMENTS = [
  "TIFFINS",
  "STAFF",
  "SI-MEALS",
  "NORTH INDIAN",
  "CHAT & SOFTY",
  "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL",
  "RESTAURANT",
  "ROOM SERVICE",
  "CENTRAL STORE"
];

const getInitialsAvatar = (name) => {
  if (!name) return { text: "??", bg: "#f1f5f9", fg: "#64748b" };
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  let text = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : "ST");
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    { bg: "#eff6ff", fg: "#1d4ed8" },
    { bg: "#ecfdf5", fg: "#047857" },
    { bg: "#fef3c7", fg: "#b45309" },
    { bg: "#fff1f2", fg: "#be123c" },
    { bg: "#f5f3ff", fg: "#6d28d9" }
  ];
  return { text, ...colors[Math.abs(hash) % colors.length] };
};

const getTransactionBadge = (type) => {
  switch (type) {
    case "INWARD_GRN":
      return {
        label: "GRN Inward",
        icon: <ArrowDownRight size={12} />,
        bg: "rgba(16, 185, 129, 0.15)",
        fg: "#10b981",
        border: "rgba(16, 185, 129, 0.3)"
      };
    case "INWARD_PURCHASE":
      return {
        label: "Direct Purchase",
        icon: <ArrowDownRight size={12} />,
        bg: "rgba(52, 211, 153, 0.15)",
        fg: "#34d399",
        border: "rgba(52, 211, 153, 0.3)"
      };
    case "OUTWARD_ISSUE":
      return {
        label: "Dept Issue",
        icon: <ArrowUpRight size={12} />,
        bg: "rgba(59, 130, 246, 0.15)",
        fg: "#60a5fa",
        border: "rgba(59, 130, 246, 0.3)"
      };
    case "ADJUSTMENT_ADD":
      return {
        label: "Audit Credit (+)",
        icon: <Sliders size={12} />,
        bg: "rgba(234, 179, 8, 0.15)",
        fg: "#facc15",
        border: "rgba(234, 179, 8, 0.3)"
      };
    case "ADJUSTMENT_DEDUCT":
      return {
        label: "Audit Debit (-)",
        icon: <Sliders size={12} />,
        bg: "rgba(249, 115, 22, 0.15)",
        fg: "#fb923c",
        border: "rgba(249, 115, 22, 0.3)"
      };
    case "RETURN_TO_VENDOR":
      return {
        label: "Vendor Return",
        icon: <RotateCcw size={12} />,
        bg: "rgba(239, 68, 68, 0.15)",
        fg: "#f87171",
        border: "rgba(239, 68, 68, 0.3)"
      };
    case "OPENING_BALANCE":
      return {
        label: "Opening Balance",
        icon: <Database size={12} />,
        bg: "rgba(168, 85, 247, 0.15)",
        fg: "#c084fc",
        border: "rgba(168, 85, 247, 0.3)"
      };
    default:
      return {
        label: type || "Movement",
        icon: <Sliders size={12} />,
        bg: "rgba(148, 163, 184, 0.15)",
        fg: "#94a3b8",
        border: "rgba(148, 163, 184, 0.3)"
      };
  }
};

const LedgerTab = ({
  ledgerLoading,
  ledgerData = [],
  ledgerPage = 1,
  ledgerTotal = 0,
  ledgerSummary = null,
  limit = 20,
  onPage = () => {},
  filters = {},
  onFilterChange = () => {},
  onExport = () => {},
  onExportExcel = () => {}
}) => {
  const [searchTerm, setSearchTerm] = useState(filters.q || "");

  useEffect(() => {
    setSearchTerm(filters.q || "");
  }, [filters.q]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if ((filters.q || "") !== searchTerm) {
        onFilterChange({ ...filters, q: searchTerm });
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const handleReset = () => {
    setSearchTerm("");
    onFilterChange({ type: "", department: "", q: "", date_from: "", date_to: "" });
  };

  const hasActiveFilters = Boolean(filters.type || filters.department || filters.q || filters.date_from || filters.date_to);

  const FilterBar = () => (
    <div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
      padding: "14px 20px",
      borderBottom: `1px solid ${COLORS.border}`,
      background: "rgba(15, 23, 42, 0.4)"
    }}>
      {/* Search Input */}
      <div style={{ display: "flex", alignItems: "center", position: "relative", minWidth: 220, flex: 1 }}>
        <Search size={14} style={{ position: "absolute", left: 10, color: COLORS.muted }} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search SKU, item name, ref #, invoice…"
          style={{
            width: "100%",
            padding: "7px 12px 7px 32px",
            fontSize: 12.5,
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            color: COLORS.text
          }}
        />
      </div>

      {/* Transaction Type Filter */}
      <select
        value={filters.type || ""}
        onChange={(e) => handleChange("type", e.target.value)}
        style={{
          padding: "7px 12px",
          fontSize: 12.5,
          borderRadius: 6,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
          color: COLORS.text,
          cursor: "pointer"
        }}
      >
        <option value="">All Movement Types</option>
        <option value="INWARD_GRN">INWARD GRN (Receipts)</option>
        <option value="INWARD_PURCHASE">INWARD Direct Purchases</option>
        <option value="OUTWARD_ISSUE">OUTWARD Issues (Kitchens)</option>
        <option value="ADJUSTMENT_ADD">AUDIT Credits (+)</option>
        <option value="ADJUSTMENT_DEDUCT">AUDIT Debits / Spoilage (-)</option>
        <option value="RETURN_TO_VENDOR">RETURN to Vendor (RTV)</option>
        <option value="OPENING_BALANCE">OPENING Balances</option>
      </select>

      {/* Department Filter */}
      <select
        value={filters.department || ""}
        onChange={(e) => handleChange("department", e.target.value)}
        style={{
          padding: "7px 12px",
          fontSize: 12.5,
          borderRadius: 6,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
          color: COLORS.text,
          cursor: "pointer"
        }}
      >
        <option value="">All Departments</option>
        {DEPARTMENTS.map((dept) => (
          <option key={dept} value={dept}>{dept}</option>
        ))}
      </select>

      {/* Date Range */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="date"
          value={filters.date_from || ""}
          onChange={(e) => handleChange("date_from", e.target.value)}
          style={{
            padding: "6px 10px",
            fontSize: 12,
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            color: COLORS.text
          }}
          title="Date from"
        />
        <span style={{ color: COLORS.muted, fontSize: 12 }}>to</span>
        <input
          type="date"
          value={filters.date_to || ""}
          onChange={(e) => handleChange("date_to", e.target.value)}
          style={{
            padding: "6px 10px",
            fontSize: 12,
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            color: COLORS.text
          }}
          title="Date to"
        />
      </div>

      {/* Reset Filters button */}
      {hasActiveFilters && (
        <button
          onClick={handleReset}
          style={{
            padding: "6px 10px",
            fontSize: 12,
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: "rgba(239, 68, 68, 0.1)",
            color: "#f87171",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4
          }}
          title="Reset all filters"
        >
          <RotateCcw size={12} /> Reset
        </button>
      )}

      {/* Export Actions */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          onClick={onExport}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: "transparent",
            color: COLORS.text,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5
          }}
          title="Export filtered records to CSV"
        >
          <Download size={13} /> CSV
        </button>
        <button
          onClick={onExportExcel}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: "1px solid #059669",
            background: "#065f46",
            color: "#ffffff",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5
          }}
          title="Download styled Double-Entry Ledger Excel spreadsheet (.xlsx)"
        >
          <FileSpreadsheet size={13} style={{ color: "#34d399" }} /> Export Ledger (.xlsx)
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <FilterBar />

      {/* Financial Telemetry Banner */}
      {ledgerSummary && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "rgba(30, 41, 59, 0.6)",
          borderBottom: `1px solid ${COLORS.border}55`,
          fontSize: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ color: "#94a3b8" }}>
              Total Movements: <strong style={{ color: "#f8fafc" }}>{ledgerTotal}</strong>
            </span>
            <span style={{ color: "#10b981", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ArrowDownRight size={14} /> Total Inflow: <strong>₹{parseFloat(ledgerSummary.totalInflowValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
            </span>
            <span style={{ color: "#60a5fa", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ArrowUpRight size={14} /> Total Outflow: <strong>₹{parseFloat(ledgerSummary.totalOutflowValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
          <div style={{ color: COLORS.muted, fontSize: 11, fontStyle: "italic" }}>
            Double-Entry Financial Ledger (P2P Foundation)
          </div>
        </div>
      )}

      {/* Main Table Content */}
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {ledgerLoading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.muted }}>
            <Layers size={32} className="spin" style={{ margin: "0 auto 12px", opacity: 0.5, color: "#e8a838" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>Loading double-entry stock ledger…</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Reconciling debit and credit movement balances.</p>
          </div>
        ) : !ledgerData || ledgerData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.muted }}>
            <Database size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>No stock movement records found</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Adjust your search query or filter criteria.</p>
          </div>
        ) : (
          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Timestamp</th>
                  <th style={{ minWidth: 140 }}>Movement Type</th>
                  <th style={{ minWidth: 200 }}>Item & SKU</th>
                  <th style={{ minWidth: 160 }}>Destination / Party</th>
                  <th style={{ minWidth: 120 }}>Quantity</th>
                  <th style={{ minWidth: 110 }}>Rate (₹)</th>
                  <th style={{ minWidth: 130 }}>Movement Value</th>
                  <th style={{ minWidth: 160 }}>Balance Audit Trail</th>
                  <th style={{ minWidth: 130 }}>Reference Doc</th>
                  <th style={{ minWidth: 180 }}>User & Reason</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.map((item, index) => {
                  const badge = getTransactionBadge(item.transaction_type);
                  const isOutflow = ["OUTWARD_ISSUE", "ADJUSTMENT_DEDUCT", "RETURN_TO_VENDOR"].includes(item.transaction_type);
                  const avatar = getInitialsAvatar(item.item_name || item.name);
                  const movementQty = parseFloat(item.qty || 0);
                  const unitPrice = parseFloat(item.unit_price || item.price || 0);
                  const totalVal = parseFloat(item.total_value || item.value || (movementQty * unitPrice));
                  const before = item.balance_qty_before !== undefined && item.balance_qty_before !== null ? parseFloat(item.balance_qty_before).toFixed(2) : "—";
                  const after = item.balance_qty_after !== undefined && item.balance_qty_after !== null ? parseFloat(item.balance_qty_after).toFixed(2) : "—";

                  const formattedDate = item.created_at
                    ? new Date(item.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                      })
                    : (item.date || "—");

                  return (
                    <tr
                      key={item.id || index}
                      style={{
                        borderBottom: `1px solid ${COLORS.border}44`,
                        transition: "background 0.15s ease"
                      }}
                    >
                      {/* 1. Timestamp */}
                      <td style={{ fontSize: 11.5, color: "#cbd5e1" }}>
                        {formattedDate}
                      </td>

                      {/* 2. Movement Type Badge */}
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 5,
                            fontSize: 10.5,
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.fg,
                            border: `1px solid ${badge.border}`,
                            letterSpacing: "0.02em",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {badge.icon} {badge.label}
                        </span>
                      </td>

                      {/* 3. Item Description & SKU */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: avatar.bg,
                            color: avatar.fg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {avatar.text}
                          </div>
                          <div>
                            <span style={{
                              color: "#e8a838",
                              fontSize: 10.5,
                              display: "block",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              fontFamily: "monospace"
                            }}>
                              {item.item_code || "KPL-STK"}
                            </span>
                            <span style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600 }}>
                              {item.item_name || item.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Destination / Party */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                          <Building2 size={13} style={{ color: isOutflow ? "#60a5fa" : "#34d399", flexShrink: 0 }} />
                          <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
                            {item.department || item.supplier || item.detail || "Central Store"}
                          </span>
                        </div>
                        {item.batch_no && (
                          <span style={{ fontSize: 10, color: "#94a3b8", display: "block", paddingLeft: 18, fontFamily: "monospace" }}>
                            Batch: {item.batch_no}
                          </span>
                        )}
                      </td>

                      {/* 5. Movement Quantity */}
                      <td>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 13.5,
                          color: isOutflow ? "#f87171" : "#34d399"
                        }}>
                          {isOutflow ? "–" : "+"}{movementQty.toFixed(2)}
                        </span>
                        <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>
                          {item.unit}
                        </span>
                      </td>

                      {/* 6. Rate */}
                      <td style={{ fontSize: 12, color: "#cbd5e1" }}>
                        {unitPrice > 0 ? `₹${unitPrice.toFixed(2)}` : "—"}
                      </td>

                      {/* 7. Movement Total Value */}
                      <td style={{ fontWeight: 700, fontSize: 13, color: isOutflow ? "#f87171" : COLORS.teal }}>
                        ₹{totalVal.toFixed(2)}
                      </td>

                      {/* 8. Balance Audit Trail */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                          <span style={{ color: "#94a3b8" }}>{before}</span>
                          <span style={{ color: "#64748b" }}>→</span>
                          <span style={{ color: "#f8fafc", fontWeight: 700 }}>{after}</span>
                          <span style={{ fontSize: 10, color: "#64748b" }}>{item.unit}</span>
                        </div>
                      </td>

                      {/* 9. Reference Document */}
                      <td>
                        <span style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "#c084fc",
                          background: "rgba(168, 85, 247, 0.12)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          display: "inline-block"
                        }}>
                          {item.reference_doc_no || item.reference_doc_type || "STK"}
                        </span>
                        {item.invoice_no && (
                          <span style={{ display: "block", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                            Inv #{item.invoice_no}
                          </span>
                        )}
                      </td>

                      {/* 10. User & Reason */}
                      <td>
                        <span style={{ fontSize: 12, color: "#f1f5f9", display: "block" }}>
                          {item.reason || item.notes || "Store Movement"}
                        </span>
                        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
                          By: {item.created_by || "System"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${COLORS.border}`, background: "rgba(15, 23, 42, 0.6)" }}>
        <Pagination page={ledgerPage} total={ledgerTotal} limit={limit} onPage={onPage} />
      </div>
    </div>
  );
};

export default LedgerTab;
