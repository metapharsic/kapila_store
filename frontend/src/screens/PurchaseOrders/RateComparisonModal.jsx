import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { Scale, X, Send, Trophy, Plus, CheckCircle, TrendingDown, Clock, Building2, Sparkles, Filter } from "lucide-react";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import * as api from "../../api";

export default function RateComparisonModal({
  open,
  onClose,
  stocks = [],
  initialItemCode = "",
  onSelectSupplierRate
}) {
  const [activeTab, setActiveTab] = useState("matrix"); // "matrix" | "record"
  const [itemCode, setItemCode] = useState(initialItemCode || "");
  const [searchFilter, setSearchFilter] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // New quote form state
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [quotedRate, setQuotedRate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const uniqueItems = Array.from(new Map(stocks.map((s) => [s.item_code, s])).values())
    .sort((a, b) => a.name.localeCompare(b.name));

  const selected = uniqueItems.find((s) => s.item_code === itemCode);

  useEffect(() => {
    if (open) {
      setItemCode(initialItemCode || (uniqueItems[0]?.item_code || ""));
      setActiveTab("matrix");
      setMsg("");
      setErr("");
      api.suppliers.list({ limit: 100, sort: "name", order: "asc" })
        .then((res) => setSuppliers(res.data || []))
        .catch(() => {});
    }
  }, [open, initialItemCode]);

  const load = async (code) => {
    if (!code) return;
    setLoading(true);
    setErr("");
    try {
      const res = await api.rateQuotes.compare(code);
      setReport(res.data);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && itemCode) {
      load(itemCode);
    }
  }, [open, itemCode]);

  if (!open) return null;

  const handleSupplierSelect = (supId) => {
    setSelectedSupplierId(supId);
    const sup = suppliers.find((s) => String(s.id) === String(supId));
    if (sup) {
      setSupplierName(sup.name);
    }
  };

  const addQuote = async () => {
    const finalSupplierName = supplierName.trim();
    if (!itemCode || !finalSupplierName || !(parseFloat(quotedRate) > 0)) {
      setErr("Item, vendor name, and a valid rate are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.rateQuotes.create({
        item_code: itemCode,
        item_name: selected?.name || report?.item_name || itemCode,
        unit: selected?.unit || report?.unit || "kg",
        supplier_name: finalSupplierName,
        supplier_id: selectedSupplierId ? parseInt(selectedSupplierId) : null,
        quoted_rate: parseFloat(quotedRate),
        notes: notes.trim() || null,
      });
      setMsg("Quote recorded successfully ✓");
      setTimeout(() => setMsg(""), 3000);
      setSupplierName("");
      setSelectedSupplierId("");
      setQuotedRate("");
      setNotes("");
      setActiveTab("matrix");
      await load(itemCode);
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  const shareWhatsApp = () => {
    if (!report) return;
    let text = `*RATE COMPARISON MATRIX — ${report.item_name}*\n(Current Inventory Baseline: ₹${report.current_price != null ? parseFloat(report.current_price).toFixed(2) : "—"}/${report.unit})\n\n`;
    report.rows.forEach((r, i) => {
      const tag = i === 0 ? "🏆 [BEST] " : "• ";
      text += `${tag}*${r.supplier}*: ₹${r.rate.toFixed(2)}/${report.unit} (${r.source === "quote" ? "Live Quote" : "Past Inward"})\n`;
      if (r.notes) text += `   Note: ${r.notes}\n`;
    });
    if (report.cheapest) {
      text += `\n*Recommended Order:* ${report.cheapest.supplier} @ ₹${report.cheapest.rate.toFixed(2)}/${report.unit}\nAuthorized by Hotel Kapila Procurement Swarm.`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Filtered rows
  const filteredRows = (report?.rows || []).filter((r) =>
    !searchFilter ? true : r.supplier.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const highestRate = report?.rows?.length ? Math.max(...report.rows.map((r) => r.rate)) : 0;
  const lowestRate = report?.cheapest?.rate || 0;
  const maxSavings = highestRate > lowestRate ? (highestRate - lowestRate).toFixed(2) : 0;
  const savingsPct = highestRate > 0 && maxSavings > 0 ? Math.round((maxSavings / highestRate) * 100) : 0;

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(10, 10, 14, 0.82)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 720, maxWidth: "95%", maxHeight: "90vh", background: COLORS.surface,
          border: `1px solid ${COLORS.border}`, borderRadius: 14,
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
          display: "flex", flexDirection: "column", padding: 0, overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div style={{
          padding: "16px 22px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: "rgba(255,255,255,0.02)",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "rgba(232, 168, 56, 0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: COLORS.accent
            }}>
              <Scale size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                Vendor Rate Comparison Engine
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>
                Multi-supplier price intelligence & rate optimization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: COLORS.muted, padding: 6, borderRadius: 6, display: "flex"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: "flex", borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bg, padding: "0 20px"
        }}>
          <button
            onClick={() => setActiveTab("matrix")}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: activeTab === "matrix" ? 700 : 500,
              color: activeTab === "matrix" ? COLORS.accent : COLORS.muted,
              border: "none",
              borderBottom: activeTab === "matrix" ? `2px solid ${COLORS.accent}` : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Trophy size={14} /> Price Matrix & Quotes ({report?.rows?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("record")}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: activeTab === "record" ? 700 : 500,
              color: activeTab === "record" ? COLORS.accent : COLORS.muted,
              border: "none",
              borderBottom: activeTab === "record" ? `2px solid ${COLORS.accent}` : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Plus size={14} /> Record New Vendor Quote
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
          {/* Item Selector Bar */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto", gap: 12,
            marginBottom: 16, alignItems: "flex-end"
          }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                Select Inventory Item to Compare
              </label>
              <select
                value={itemCode}
                onChange={(e) => { setItemCode(e.target.value); load(e.target.value); }}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13,
                  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                  color: COLORS.text, borderRadius: 8, fontWeight: 500
                }}
              >
                <option value="">— Select an inventory item —</option>
                {uniqueItems.map((s) => (
                  <option key={s.item_code} value={s.item_code}>
                    {s.name} ({s.item_code}) — Current: ₹{parseFloat(s.price || 0).toFixed(2)}/{s.unit}
                  </option>
                ))}
              </select>
            </div>

            {report && (
              <div style={{
                background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: "8px 12px", textAlign: "right"
              }}>
                <span style={{ fontSize: 11, color: COLORS.muted, display: "block" }}>Stock Baseline</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
                  ₹{report.current_price != null ? parseFloat(report.current_price).toFixed(2) : "0.00"}
                  <span style={{ fontSize: 11, color: COLORS.muted }}>/{report.unit}</span>
                </span>
              </div>
            )}
          </div>

          {msg && (
            <div style={{ background: "rgba(16, 185, 129, 0.12)", border: `1px solid ${COLORS.success}44`, color: COLORS.success, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
              {msg}
            </div>
          )}

          {err && (
            <div style={{ background: "rgba(239, 68, 68, 0.12)", border: `1px solid ${COLORS.danger}44`, color: COLORS.danger, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
              {err}
            </div>
          )}

          {/* TAB 1: PRICE MATRIX */}
          {activeTab === "matrix" && (
            <div>
              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
                  Fetching multi-vendor quotes and purchase history…
                </div>
              ) : !itemCode ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
                  Please select an item from the dropdown above to view vendor rates.
                </div>
              ) : report ? (
                <>
                  {/* KPI Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
                    <div style={{ background: "rgba(16, 185, 129, 0.08)", border: `1px solid ${COLORS.success}33`, borderRadius: 10, padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, color: COLORS.success, fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                        <Trophy size={13} /> Cheapest Vendor
                      </span>
                      <p style={{ margin: "6px 0 2px", fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                        {report.cheapest ? report.cheapest.supplier : "N/A"}
                      </p>
                      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.success }}>
                        {report.cheapest ? `₹${report.cheapest.rate.toFixed(2)}/${report.unit}` : "—"}
                      </span>
                    </div>

                    <div style={{ background: "rgba(232, 168, 56, 0.08)", border: `1px solid ${COLORS.accent}33`, borderRadius: 10, padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                        <TrendingDown size={13} /> Potential Savings
                      </span>
                      <p style={{ margin: "6px 0 2px", fontSize: 16, fontWeight: 700, color: COLORS.accent }}>
                        ₹{maxSavings}/{report.unit}
                      </p>
                      <span style={{ fontSize: 11.5, color: COLORS.muted }}>
                        {savingsPct > 0 ? `${savingsPct}% cheaper than peak quote` : "Single quote on file"}
                      </span>
                    </div>

                    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>
                        Quotes on File
                      </span>
                      <p style={{ margin: "6px 0 2px", fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                        {report.rows.length} Vendors
                      </p>
                      <span style={{ fontSize: 11.5, color: COLORS.muted }}>
                        Active quotes & past receipts
                      </span>
                    </div>
                  </div>

                  {/* Filter & Search */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Search vendors in matrix…"
                        style={{
                          width: "100%", padding: "7px 12px", background: COLORS.bg,
                          border: `1px solid ${COLORS.border}`, borderRadius: 6,
                          fontSize: 12, color: COLORS.text
                        }}
                      />
                    </div>
                  </div>

                  {/* Matrix Table */}
                  <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: COLORS.bg, textAlign: "left", color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
                          <th style={{ padding: "8px 12px" }}>Rank & Supplier</th>
                          <th style={{ padding: "8px 12px" }}>Rate</th>
                          <th style={{ padding: "8px 12px" }}>Source & Date</th>
                          <th style={{ padding: "8px 12px" }}>Notes</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: 24, textAlign: "center", color: COLORS.muted }}>
                              No quotes recorded for this item yet. Switch to "Record New Vendor Quote" to add one!
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((r, i) => {
                            const isCheapest = i === 0;
                            return (
                              <tr
                                key={i}
                                style={{
                                  borderBottom: `1px solid ${COLORS.border}`,
                                  background: isCheapest ? "rgba(16, 185, 129, 0.06)" : "transparent",
                                  transition: "background 0.15s"
                                }}
                              >
                                <td style={{ padding: "10px 12px", fontWeight: isCheapest ? 700 : 500, color: COLORS.text }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {isCheapest ? (
                                      <span style={{
                                        background: "rgba(16, 185, 129, 0.2)", color: COLORS.success,
                                        padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700
                                      }}>
                                        #1 BEST
                                      </span>
                                    ) : (
                                      <span style={{ color: COLORS.muted, fontSize: 11 }}>#{i + 1}</span>
                                    )}
                                    <span>{r.supplier}</span>
                                  </div>
                                </td>
                                <td style={{ padding: "10px 12px", fontWeight: 700, color: isCheapest ? COLORS.success : COLORS.text }}>
                                  ₹{r.rate.toFixed(2)}
                                  <span style={{ fontSize: 10, fontWeight: 400, color: COLORS.muted }}>/{report.unit}</span>
                                </td>
                                <td style={{ padding: "10px 12px", color: COLORS.muted }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{
                                      padding: "1px 6px", borderRadius: 4, fontSize: 10,
                                      background: r.source === "quote" ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.06)",
                                      color: r.source === "quote" ? "#60a5fa" : COLORS.textMuted
                                    }}>
                                      {r.source === "quote" ? "Live Quote" : "Past Inward"}
                                    </span>
                                    {r.date && (
                                      <span style={{ fontSize: 11 }}>
                                        {new Date(r.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: "10px 12px", color: COLORS.muted, fontSize: 11.5, maxWidth: 160 }}>
                                  {r.notes || "—"}
                                </td>
                                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                  {onSelectSupplierRate ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onSelectSupplierRate({
                                          supplier_name: r.supplier,
                                          rate: r.rate,
                                          item_code: itemCode
                                        });
                                        onClose();
                                      }}
                                      style={{
                                        padding: "4px 10px", fontSize: 11, fontWeight: 600,
                                        borderRadius: 6, border: "none", cursor: "pointer",
                                        background: isCheapest ? COLORS.success : COLORS.surface,
                                        color: isCheapest ? "#fff" : COLORS.text,
                                        boxShadow: isCheapest ? "0 2px 6px rgba(16, 185, 129, 0.25)" : "none"
                                      }}
                                    >
                                      Use in PO
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 11, color: COLORS.muted }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* TAB 2: RECORD NEW QUOTE */}
          {activeTab === "record" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{
                background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: "12px 16px"
              }}>
                <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Building2 size={15} /> Recording Quote For:
                </span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
                  {selected?.name || "Select an item first"} ({itemCode || "—"})
                </p>
              </div>

              <div>
                <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                  Quick Select Existing Supplier
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13
                  }}
                >
                  <option value="">— Or type custom supplier name below —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} (Phone: {s.phone || "—"})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                <Input
                  label="Vendor / Supplier Name *"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Metro Cash & Carry"
                />
                <Input
                  label={`Quoted Rate (₹/${selected?.unit || "unit"}) *`}
                  type="number"
                  step="0.01"
                  value={quotedRate}
                  onChange={(e) => setQuotedRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <Input
                label="Terms & Negotiation Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Delivery included, valid till month-end, MOQ 50kg..."
              />

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <Btn
                  onClick={addQuote}
                  disabled={saving || !supplierName.trim() || !(parseFloat(quotedRate) > 0)}
                  style={{ flex: 1 }}
                >
                  {saving ? "Recording Quote…" : "Save Quote to Matrix"}
                </Btn>
                <Btn variant="ghost" onClick={() => setActiveTab("matrix")} style={{ border: `1px solid ${COLORS.border}` }}>
                  Cancel
                </Btn>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div style={{
          padding: "12px 22px",
          borderTop: `1px solid ${COLORS.border}`,
          background: "rgba(255,255,255,0.02)",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span style={{ fontSize: 11.5, color: COLORS.muted }}>
            Integrated with Hotel Kapila Procurement Swarm
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn
              variant="ghost"
              onClick={shareWhatsApp}
              disabled={!report || report.rows.length === 0}
              icon={<Send size={13} />}
              style={{ fontSize: 12, border: `1px solid ${COLORS.border}` }}
            >
              Share via WhatsApp
            </Btn>
            <Btn variant="ghost" onClick={onClose} style={{ fontSize: 12, border: `1px solid ${COLORS.border}` }}>
              Close
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

