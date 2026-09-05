import { useState, useEffect } from "react";
import Pagination from "../../../components/Pagination";
import ErrorMsg from "../../../components/ErrorMsg";
import { COLORS } from "../../../styles/colors";
import SourceBadge from "../../../components/SourceBadge";
import KplCodeBadge from "../../../components/KplCodeBadge";
import { Search, ChevronDown, ChevronUp, Eye, X, Download } from "lucide-react";
import Btn from "../../../components/Btn";


const formatIssuanceDate = (isoString) => {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

const TH = ({ children, style = {} }) => (
  <th
    style={{
      padding: "11px 16px",
      fontSize: 11,
      fontWeight: 600,
      color: COLORS.muted,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      textAlign: "left",
      backgroundColor: "#f8fafc",
      borderBottom: "1px solid #e2e8f0",
      ...style,
    }}
  >
    {children}
  </th>
);

export default function IssuanceHistory({ items, total, page, loading, error, onPageChange, LIMIT, style, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedIss, setSelectedIss] = useState(null);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);


  const filteredItems = items.filter((iss) => {
    const matchesSearch =
      !searchQuery ||
      iss.dept?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      iss.items?.some((it) => it.name?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSource =
      sourceFilter === "all" ||
      (sourceFilter === "scanned" && iss.scanned) ||
      (sourceFilter === "manual" && !iss.scanned);

    return matchesSearch && matchesSource;
  });

  const downloadSlip = (iss) => {
    const escapeHtml = (unsafe) => {
      return (unsafe || "").toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const formatSlipDate = (isoString) => {
      try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        return d.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      } catch {
        return isoString;
      }
    };

    const itemsHtml = (iss.items || [])
      .map(it => {
        const reqQty = it.qty !== null && it.qty !== undefined ? `${it.qty} ${it.unit || "kg"}` : "—";
        const price = parseFloat(it.unit_price) || 0;
        const total = (parseFloat(it.issued) || 0) * price;
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${escapeHtml(it.item_code || "N/A")}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${escapeHtml(it.name)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${escapeHtml(reqQty)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; color: #16a34a;">${escapeHtml(it.issued)} ${escapeHtml(it.unit || "kg")}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${price.toFixed(2)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">₹${total.toFixed(2)}</td>
          </tr>
        `;
      }).join("");

    const grandTotal = (iss.items || []).reduce((sum, it) => sum + (parseFloat(it.issued) || 0) * (parseFloat(it.unit_price) || 0), 0);

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Store Issuance Slip - ${escapeHtml(iss.dept)}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
            .logo-container { background: #1E293B; border-radius: 8px; padding: 8px 20px; display: inline-flex; align-items: center; justify-content: center; }
            .details { margin-bottom: 20px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f2f2f2; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; }
            .footer { text-align: center; font-size: 12px; color: #777; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              <img src="/kapila-logo.png" alt="Kapila" style="height: 32px; display: block;" />
            </div>
            <h3 style="margin: 6px 0 0; font-size: 16px; letter-spacing: 0.05em; color: #475569; text-transform: uppercase;">Store Issuance Slip</h3>
            <span style="display:inline-block; margin-top:4px; padding: 3px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; background: #DCFCE7; color: #166534; border: 1px solid #86EFAC">✓ COMPLETED</span>
          </div>
          <div class="details">
            <p><strong>Department:</strong> ${escapeHtml(iss.dept)}</p>
            <p><strong>Date Issued:</strong> ${escapeHtml(formatSlipDate(iss.date))}</p>
            <p><strong>Indent Reference:</strong> ${escapeHtml(iss.indent_id ? '#' + iss.indent_id : "Manual / Direct Issuance")}</p>
            <p><strong>Source:</strong> ${escapeHtml(iss.scanned ? "Scanned Slip" : "Manual System Entry")}</p>
            <p><strong>Printed At:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Item Name</th>
                <th style="text-align: right;">Req. Qty</th>
                <th style="text-align: right;">Issued Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="border-top: 2px solid #333;">
                <td colspan="5" style="padding: 12px 8px; text-align: right; font-weight: bold;">Grand Total:</td>
                <td style="padding: 12px 8px; text-align: right; font-weight: bold; font-size: 15px;">₹${grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <div class="footer">
            <p>Hotel Kapila Inventory Management System</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        backgroundColor: "#ffffff",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Header — matches Indent History header exactly */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
          backgroundColor: "#ffffff",
        }}
      >
        <button
          onClick={() => setIsExpanded((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0 }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, margin: 0 }}>
            Issuance History
          </h2>
          {isExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
        </button>

        {isExpanded && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                style={{
                  padding: "7px 10px 7px 30px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  background: "#f8fafc",
                  fontSize: 12,
                  outline: "none",
                  width: 180,
                  color: COLORS.text,
                }}
              />
            </div>

            {/* Source filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{
                padding: "7px 28px 7px 10px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#f8fafc",
                fontSize: 12,
                outline: "none",
                color: COLORS.text,
                appearance: "none",
                cursor: "pointer",
              }}
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual</option>
              <option value="scanned">Scanned</option>
            </select>
          </div>
        )}
      </div>

      {/* Body */}
      {isExpanded && (
        <>
          {loading ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 32, margin: 0 }}>Loading…</p>
          ) : error ? (
            <div style={{ padding: 20 }}>
              <ErrorMsg error={error} />
            </div>
          ) : filteredItems.length === 0 ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 32, margin: 0, fontSize: 13 }}>
              No issuances recorded{searchQuery ? " matching your search" : ""}
            </p>
          ) : (
            <>
              <div className="resp-table-wrap" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <TH>Date</TH>
                      <TH>Department</TH>
                      <TH>Type</TH>
                      <TH>Items Issued</TH>
                      <TH>Total Cost</TH>
                      <TH>Source</TH>
                      <TH style={{ textAlign: "center" }}>Action</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((iss) => {
                      const totalCost = (iss.items || []).reduce(
                        (acc, it) => acc + (parseFloat(it.issued) || 0) * (parseFloat(it.unit_price) || 0),
                        0
                      );
                      const source = iss.scanned ? "scanned" : "manual";

                      return (
                        <tr
                          key={iss.id}
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <td style={{ padding: "12px 16px", fontSize: 13, color: COLORS.text, whiteSpace: "nowrap" }}>
                            {formatIssuanceDate(iss.date)}
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                            {iss.dept}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {(() => {
                              const isAdhoc = (iss.indent_type || "routine") === "adhoc";
                              return (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                                  background: isAdhoc ? "#FEF3C7" : "#D1FAE5",
                                  color: isAdhoc ? "#92400E" : "#065F46",
                                  border: `1px solid ${isAdhoc ? "#FCD34D" : "#6EE7B7"}`,
                                  whiteSpace: "nowrap",
                                }}>
                                  {isAdhoc ? "⚡ Ad-Hoc" : "✓ Routine"}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {(iss.items || []).slice(0, 3).map((it, i) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    color: COLORS.text,
                                  }}
                                >
                                  <KplCodeBadge code={it.item_code} />
                                  {it.name}
                                </div>
                              ))}
                              {(iss.items || []).length > 3 && (
                                <span style={{ fontSize: 12, color: COLORS.muted, padding: "2px 4px" }}>
                                  +{iss.items.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                            ₹{totalCost.toFixed(2)}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <SourceBadge source={source} />
                          </td>
                           <td style={{ padding: "12px 16px", textAlign: "center" }}>
                             <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                               <button
                                 onClick={() => setSelectedIss(iss)}
                                 style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
                                 title="View details"
                               >
                                 <Eye size={16} />
                               </button>
                               <button
                                 onClick={() => downloadSlip(iss)}
                                 style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
                                 title="Download Slip"
                               >
                                 <Download size={16} />
                               </button>
                             </div>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Pagination page={page} total={total} limit={LIMIT} onPage={onPageChange} />
              </div>
            </>
          )}
        </>
      )}

      {/* Details Modal */}
      {selectedIss && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.65)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: 24, width: 600, maxWidth: "95%",
            boxShadow: `0 10px 25px rgba(0,0,0,0.15)`,
            display: "flex", flexDirection: "column", maxHeight: "85vh"
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Eye size={18} color={COLORS.brand} /> Indent Details (Issued)
                </h3>
                <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                  {selectedIss.dept} · {formatIssuanceDate(selectedIss.date)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedIss(null)} 
                style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Metadata Grid */}
            <div style={{ 
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, 
              padding: 16, background: COLORS.bg, borderRadius: 8, marginBottom: 20 
            }}>
              <div>
                <p style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Indent Ref</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 2 }}>
                  {selectedIss.indent_id ? `#${selectedIss.indent_id}` : "Manual / Direct Issuance"}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Source</p>
                <div style={{ marginTop: 2 }}>
                  <SourceBadge source={selectedIss.scanned ? "scanned" : "manual"} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Items Count</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 2 }}>
                  {(selectedIss.items || []).length} items
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Cost</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, marginTop: 2 }}>
                  ₹{(selectedIss.items || []).reduce((sum, it) => sum + (parseFloat(it.issued) || 0) * (parseFloat(it.unit_price) || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ flex: 1, overflowY: "auto", marginBottom: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Code</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Item Name</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Req. Qty</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Issued Qty</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Price</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedIss.items || []).map((it, idx) => {
                    const price = parseFloat(it.unit_price) || 0;
                    const total = (parseFloat(it.issued) || 0) * price;
                    return (
                      <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                          <KplCodeBadge code={it.item_code} />
                        </td>
                        <td style={{ padding: "10px 12px", color: COLORS.text, fontWeight: 500, verticalAlign: "middle" }}>
                          {it.name}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: COLORS.muted, verticalAlign: "middle" }}>
                          {it.qty !== null && it.qty !== undefined ? `${it.qty} ${it.unit || "kg"}` : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: COLORS.success, fontWeight: 600, verticalAlign: "middle" }}>
                          {it.issued} {it.unit || "kg"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: COLORS.muted, verticalAlign: "middle" }}>
                          ₹{price.toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: COLORS.text, fontWeight: 600, verticalAlign: "middle" }}>
                          ₹{total.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${COLORS.border}` }}>
                    <td colSpan={5} style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: COLORS.text }}>Total Cost:</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: COLORS.accent }}>
                      ₹{(selectedIss.items || []).reduce((sum, it) => sum + (parseFloat(it.issued) || 0) * (parseFloat(it.unit_price) || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
              <Btn onClick={() => downloadSlip(selectedIss)} variant="secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Download size={14} /> Download Slip
              </Btn>
              <Btn onClick={() => setSelectedIss(null)} variant="ghost">Close</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
