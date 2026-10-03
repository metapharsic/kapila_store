import { useState, useEffect, useRef, useCallback } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import { COLORS } from "../../styles/colors";
import { useAppContext } from "../../context/AppContext";
import * as api from "../../api";
import ItemSearchCombobox from "./ItemSearchCombobox";
import ReconciliationHistoryPanel from "./ReconciliationHistoryPanel";
import { today } from "../../utils/dates";

const REASONS = ["Audit Correction", "Damage", "Theft", "Expiry Write-off", "Spoiled / Spilled", "Pest Damage", "Other"];
const CATEGORIES = ["All", "Vegetables", "Dairy", "Grocery", "Spices", "Bakery", "Beverages", "Disposables", "Meat", "Dry", "Cleaning"];

const emptyRow = () => ({ _id: Math.random(), item: null, physical_qty: "", reason: REASONS[0], notes: "", expanded: false });

export default function ReconciliationScreen() {
  const { stocks, refreshStockNames } = useAppContext();

  const [tab, setTab]               = useState("physical-count");
  const [sessionName, setSessionName] = useState("Physical Count — " + today());
  const [conductedBy, setConductedBy] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [loadMode, setLoadMode]     = useState("custom");
  const [selectedCat, setSelectedCat] = useState("All");
  const [rows, setRows]             = useState([emptyRow()]);
  const barcodeRef                  = useRef(null);
  const [barcodeVal, setBarcodeVal] = useState("");
  const [barcodeFlash, setBarcodeFlash] = useState(null);
  const [msg, setMsg]               = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [auditRows, setAuditRows]   = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState({ reason: "", date_from: "", date_to: "" });
  const [auditOffset, setAuditOffset] = useState(0);

  // Build item_code -> aggregated map
  const stockMap = {};
  stocks.forEach((s) => {
    if (!stockMap[s.item_code]) stockMap[s.item_code] = { remaining: 0, price: parseFloat(s.price || 0), unit: s.unit, name: s.name, category: s.category || "Other" };
    stockMap[s.item_code].remaining += parseFloat(s.remaining || 0);
  });

  // Category load mode: pre-fill all items of selected category
  useEffect(() => {
    if (loadMode !== "category") return;
    const grouped = {};
    stocks.forEach((s) => {
      if (!grouped[s.item_code]) grouped[s.item_code] = { name: s.name, item_code: s.item_code, unit: s.unit, category: s.category || "Other", remaining: 0, price: parseFloat(s.price || 0) };
      grouped[s.item_code].remaining += parseFloat(s.remaining || 0);
    });
    const filtered = Object.values(grouped).filter((it) => selectedCat === "All" || it.category === selectedCat);
    setRows(filtered.map((it) => ({ ...emptyRow(), item: it, physical_qty: it.remaining.toFixed(2) })));
  }, [loadMode, selectedCat, stocks]);

  useEffect(() => { if (loadMode === "custom") setRows([emptyRow()]); }, [loadMode]);

  // Agent Scanner: barcode keyboard-wedge handler
  const handleBarcode = useCallback((e) => {
    if (e.key !== "Enter") return;
    const code = barcodeVal.trim().toUpperCase();
    setBarcodeVal("");
    if (!code) return;
    const match = stockMap[code] || Object.values(stockMap).find((it) => it.name.toUpperCase() === code);
    if (!match) { setBarcodeFlash('❌ "' + code + '" not found'); setTimeout(() => setBarcodeFlash(null), 2500); return; }
    if (rows.some((r) => r.item?.item_code === match.item_code)) {
      setBarcodeFlash("⚡ " + match.name + " already listed");
      setTimeout(() => setBarcodeFlash(null), 2500); return;
    }
    setRows((prev) => [...prev, { ...emptyRow(), item: match }]);
    setBarcodeFlash("✅ " + match.name + " added");
    setTimeout(() => setBarcodeFlash(null), 2000);
  }, [barcodeVal, stockMap, rows]);

  const updateRow = (id, key, val) => setRows((prev) => prev.map((r) => r._id === id ? { ...r, [key]: val } : r));
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r._id !== id));
  const addRow    = () => setRows((prev) => [...prev, emptyRow()]);

  const sysQty    = (row) => row.item ? (stockMap[row.item.item_code]?.remaining ?? 0) : null;
  const variance  = (row) => { const s = sysQty(row); const p = parseFloat(row.physical_qty); return (s === null || isNaN(p)) ? null : p - s; };
  const valImpact = (row) => { const v = variance(row); const price = stockMap[row.item?.item_code]?.price ?? 0; return v === null ? null : v * price; };
  // Agent Veritas: flag if swing >15% AND >5 units absolute
  const isAnomaly = (row) => { const s = sysQty(row); const v = variance(row); return s && s > 0 && v !== null && Math.abs(v / s) > 0.15 && Math.abs(v) > 5; };

  const validRows      = rows.filter((r) => r.item && r.physical_qty !== "");
  const surplusRows    = validRows.filter((r) => (variance(r) ?? 0) > 0.0001);
  const shortageRows   = validRows.filter((r) => (variance(r) ?? 0) < -0.0001);
  const matchedRows    = validRows.filter((r) => Math.abs(variance(r) ?? 1) < 0.0001);
  const anomalyRows    = validRows.filter((r) => isAnomaly(r));
  const totalSurplusVal  = surplusRows.reduce((s, r) => s + (valImpact(r) ?? 0), 0);
  const totalShortageVal = shortageRows.reduce((s, r) => s + Math.abs(valImpact(r) ?? 0), 0);

  const flash = (text, color = COLORS.success) => { setMsg({ text, color }); setTimeout(() => setMsg(null), 4000); };

  const submit = async () => {
    if (validRows.length === 0) return flash("Add at least one item with a count.", COLORS.coral);
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const res = await api.stock.reconcile({
        session_name: sessionName,
        conducted_by: conductedBy || undefined,
        notes: sessionNotes || undefined,
        items: validRows.map((r) => ({
          item_code: r.item.item_code,
          physical_qty: parseFloat(r.physical_qty),
          reason: r.reason,
          notes: r.notes || null,
        })),
      });
      flash("✓ Session #" + res.session_id + " saved — " + validRows.length + " items processed.");
      await refreshStockNames();
      setRows([emptyRow()]);
      setSessionName("Physical Count — " + today());
      setSessionNotes("");
      setTab("history");
    } catch (e) { flash(e.message || "Reconciliation failed.", COLORS.coral); }
    finally { setSubmitting(false); }
  };

  const loadAudit = useCallback(async (offset = 0) => {
    setAuditLoading(true);
    try {
      const params = { limit: 50, offset, ...auditFilter };
      Object.keys(params).forEach((k) => { if (!params[k] && params[k] !== 0) delete params[k]; });
      const r = await api.stock.adjustments(params);
      setAuditRows(r.data || []);
      setAuditTotal(r.total || 0);
      setAuditOffset(offset);
    } catch (_) {}
    finally { setAuditLoading(false); }
  }, [auditFilter]);

  useEffect(() => { if (tab === "audit-trail") loadAudit(0); }, [tab]);

  const varColor = (v) => v === null ? COLORS.muted : Math.abs(v) < 0.0001 ? COLORS.success : v > 0 ? COLORS.teal : COLORS.coral;

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)}
      style={{ padding: "8px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.18s",
        background: tab === id ? "#e8a838" : "transparent", color: tab === id ? "#1a1207" : COLORS.muted }}>
      {label}
    </button>
  );

  return (
    <Section title="Stock Reconciliation" sub="Multi-agent physical count — FIFO with session tracking, ₹ value impact & anomaly detection">

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: COLORS.bg, borderRadius: 10, padding: 4, border: `1px solid ${COLORS.border}`, width: "fit-content" }}>
        {tabBtn("physical-count", "⚖️  Physical Count")}
        {tabBtn("history",        "📋  Session History")}
        {tabBtn("audit-trail",   "🔍  Audit Trail")}
      </div>

      {/* ──────────── TAB 1: PHYSICAL COUNT ──────────── */}
      {tab === "physical-count" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Session metadata */}
            <Card style={{ padding: 18 }}>
              <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Session Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Session Name *", val: sessionName, set: setSessionName, ph: "Morning Count — Sept 10" },
                  { label: "Conducted By", val: conductedBy, set: setConductedBy, ph: "Store Manager / Storekeeper" },
                  { label: "Session Notes", val: sessionNotes, set: setSessionNotes, ph: "Monthly audit, shift handoff…" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label}>
                    <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>{label}</label>
                    <input value={val} onChange={(e) => set(e.target.value)} placeholder={ph}
                      style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Load mode + barcode */}
            <Card style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Load Mode</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["custom", "Custom List"], ["category", "By Category"]].map(([id, label]) => (
                      <button key={id} onClick={() => setLoadMode(id)}
                        style={{ padding: "6px 14px", borderRadius: 6,
                          border: `1px solid ${loadMode === id ? "#e8a838" : COLORS.border}`,
                          background: loadMode === id ? "#e8a83822" : "transparent",
                          color: loadMode === id ? "#e8a838" : COLORS.muted,
                          cursor: "pointer", fontSize: 12, fontWeight: loadMode === id ? 700 : 400 }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {loadMode === "category" && (
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Category</label>
                    <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "7px 12px", fontSize: 13 }}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                {/* Agent Scanner barcode input */}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                    🔍 Barcode / QR Scanner — scan or type SKU then Enter
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input ref={barcodeRef} value={barcodeVal}
                      onChange={(e) => setBarcodeVal(e.target.value)} onKeyDown={handleBarcode}
                      placeholder="Scan barcode or type KPL-### and press Enter…"
                      style={{ flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "7px 10px", fontSize: 12, boxSizing: "border-box" }} />
                    {barcodeFlash && <span style={{ fontSize: 12, color: barcodeFlash.startsWith("✅") ? COLORS.success : COLORS.coral, whiteSpace: "nowrap" }}>{barcodeFlash}</span>}
                  </div>
                </div>
              </div>
            </Card>

            {/* Count table */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {validRows.length} of {rows.length} row(s) filled
                  </p>
                  {anomalyRows.length > 0 && (
                    <span style={{ background: COLORS.coral + "22", color: COLORS.coral, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                      ⚠ {anomalyRows.length} Anomaly{anomalyRows.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {loadMode === "custom" && <Btn small variant="ghost" onClick={addRow}>+ Add Row</Btn>}
              </div>

              {msg && (
                <div style={{ padding: "10px 18px", background: msg.color + "18", borderBottom: `1px solid ${msg.color}33` }}>
                  <p style={{ color: msg.color, fontSize: 13, fontWeight: 600 }}>{msg.text}</p>
                </div>
              )}

              <div className="resp-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: "#ffffff06" }}>
                      {["Item", "System Qty", "Physical Qty", "Variance", "₹ Impact", "Reason", "", ""].map((h, i) => (
                        <th key={i} style={{ padding: "9px 12px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const sys  = sysQty(row);
                      const v    = variance(row);
                      const val  = valImpact(row);
                      const anom = isAnomaly(row);
                      const unit = row.item ? (stockMap[row.item.item_code]?.unit || row.item.unit || "pcs") : "pcs";
                      return (
                        <tr key={row._id} style={{ borderBottom: `1px solid ${COLORS.border}22`, background: anom ? COLORS.coral + "08" : "transparent" }}>
                          <td style={{ padding: "8px 10px", minWidth: 220 }}>
                            <ItemSearchCombobox stocks={stocks} value={row.item} onChange={(it) => updateRow(row._id, "item", it)} placeholder="Search item…" />
                            {anom && <div style={{ fontSize: 10, color: COLORS.coral, marginTop: 3, fontWeight: 600 }}>⚠ Agent Veritas: Large variance (&gt;15%)</div>}
                          </td>
                          <td style={{ padding: "8px 10px", color: COLORS.muted, fontWeight: 500, whiteSpace: "nowrap" }}>
                            {sys !== null ? sys.toFixed(2) + " " + unit : <span style={{ color: COLORS.coral, fontSize: 11 }}>not found</span>}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <button onClick={() => updateRow(row._id, "physical_qty", Math.max(0, (parseFloat(row.physical_qty) || 0) - 1).toString())}
                                style={{ width: 26, height: 26, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>−</button>
                              <input type="number" min="0" step="any" value={row.physical_qty}
                                onChange={(e) => updateRow(row._id, "physical_qty", e.target.value)}
                                style={{ width: 80, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "5px 8px", fontSize: 13, textAlign: "center" }} />
                              <button onClick={() => updateRow(row._id, "physical_qty", ((parseFloat(row.physical_qty) || 0) + 1).toString())}
                                style={{ width: 26, height: 26, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>
                            </div>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {v === null ? <span style={{ color: COLORS.muted }}>—</span> : (
                              <span style={{ background: varColor(v) + "20", color: varColor(v), borderRadius: 20, padding: "3px 10px", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
                                {Math.abs(v) < 0.0001 ? "✓" : (v > 0 ? "+" : "") + v.toFixed(2) + " " + unit}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {val === null ? <span style={{ color: COLORS.muted }}>—</span> : (
                              <span style={{ color: Math.abs(val) < 0.01 ? COLORS.success : val > 0 ? COLORS.teal : COLORS.coral }}>
                                {val > 0 ? "+" : ""}₹{Math.abs(val).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <select value={row.reason} onChange={(e) => updateRow(row._id, "reason", e.target.value)}
                              style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "5px 8px", fontSize: 12, minWidth: 130 }}>
                              {REASONS.map((r) => <option key={r}>{r}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            <button onClick={() => updateRow(row._id, "expanded", !row.expanded)}
                              style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>
                              {row.expanded ? "▲ Notes" : "▼ Notes"}
                            </button>
                            {row.expanded && (
                              <input value={row.notes} onChange={(e) => updateRow(row._id, "notes", e.target.value)} placeholder="Optional note…"
                                style={{ marginTop: 4, width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "5px 8px", fontSize: 12, boxSizing: "border-box" }} />
                            )}
                          </td>
                          <td style={{ padding: "8px 6px" }}>
                            {rows.length > 1 && (
                              <button onClick={() => removeRow(row._id)}
                                style={{ background: COLORS.coral + "18", border: `1px solid ${COLORS.coral}44`, color: COLORS.coral, borderRadius: 4, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: "14px 18px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 12, alignItems: "center" }}>
                {loadMode === "custom" && <Btn small variant="ghost" onClick={addRow}>+ Add Row</Btn>}
                <div style={{ flex: 1 }} />
                <Btn onClick={() => { if (validRows.length === 0) return flash("Add at least one item.", COLORS.coral); setShowConfirm(true); }}
                  disabled={submitting}
                  style={{ minWidth: 220, background: "#e8a838", color: "#1a1207", fontWeight: 700 }}>
                  {submitting ? "Applying…" : "Apply Reconciliation (" + validRows.length + " items)"}
                </Btn>
              </div>
            </Card>
          </div>

          {/* Right summary panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 80 }}>
            <Card style={{ padding: 18 }}>
              <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Live Session Summary</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Items on list", val: rows.filter((r) => r.item).length, color: COLORS.text },
                  { label: "Filled rows", val: validRows.length, color: COLORS.text },
                  { label: "✅ Matched", val: matchedRows.length, color: COLORS.success },
                  { label: "📈 Surplus items", val: surplusRows.length, color: COLORS.teal },
                  { label: "📉 Shortage items", val: shortageRows.length, color: COLORS.coral },
                  { label: "⚠ Anomalies (>15%)", val: anomalyRows.length, color: COLORS.coral },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: COLORS.muted }}>{label}</span>
                    <span style={{ fontWeight: 700, color, fontSize: 15 }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: "12px 14px", background: "#ffffff08", borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>Surplus Value</span>
                  <span style={{ fontWeight: 700, color: COLORS.teal }}>+₹{totalSurplusVal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>Shortage Value</span>
                  <span style={{ fontWeight: 700, color: COLORS.coral }}>-₹{totalShortageVal.toFixed(2)}</span>
                </div>
                <div style={{ height: 1, background: COLORS.border, margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>Net Impact</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: (totalSurplusVal - totalShortageVal) >= 0 ? COLORS.success : COLORS.coral }}>
                    {(totalSurplusVal - totalShortageVal) >= 0 ? "+" : ""}₹{(totalSurplusVal - totalShortageVal).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
            <Card style={{ padding: 16 }}>
              <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>How It Works</p>
              <ul style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.8, paddingLeft: 16 }}>
                <li>Scan barcode or search by name / SKU</li>
                <li>Shortages — FIFO deduction, oldest batch first</li>
                <li>Surpluses — added to newest batch</li>
                <li>Every adjustment logged with session ID</li>
                <li>⚠ Agent Veritas flags swings &gt;15% / &gt;5 units</li>
              </ul>
            </Card>
            <Card style={{ padding: 14, background: COLORS.coral + "12", border: `1px solid ${COLORS.coral}33` }}>
              <p style={{ fontSize: 11, color: COLORS.coral, fontWeight: 600, marginBottom: 6 }}>⚠ Irreversible Action</p>
              <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
                Applying reconciliation directly adjusts warehouse stock. Review all variances before submitting.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ──────────── TAB 2: HISTORY ──────────── */}
      {tab === "history" && (
        <Card style={{ padding: 20 }}>
          <ReconciliationHistoryPanel key="hist" />
        </Card>
      )}

      {/* ──────────── TAB 3: AUDIT TRAIL ──────────── */}
      {tab === "audit-trail" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 10, color: COLORS.muted, display: "block", marginBottom: 3 }}>Reason</label>
              <select value={auditFilter.reason} onChange={(e) => setAuditFilter((p) => ({ ...p, reason: e.target.value }))}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
                <option value="">All Reasons</option>
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: COLORS.muted, display: "block", marginBottom: 3 }}>From Date</label>
              <input type="date" value={auditFilter.date_from} onChange={(e) => setAuditFilter((p) => ({ ...p, date_from: e.target.value }))}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "6px 10px", fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: COLORS.muted, display: "block", marginBottom: 3 }}>To Date</label>
              <input type="date" value={auditFilter.date_to} onChange={(e) => setAuditFilter((p) => ({ ...p, date_to: e.target.value }))}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "6px 10px", fontSize: 12 }} />
            </div>
            <Btn small onClick={() => loadAudit(0)}>Apply Filter</Btn>
            <Btn small variant="ghost" onClick={() => { setAuditFilter({ reason: "", date_from: "", date_to: "" }); setTimeout(() => loadAudit(0), 100); }}>Clear</Btn>
            <span style={{ fontSize: 12, color: COLORS.muted }}>{auditTotal} total adjustments</span>
          </div>
          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: "#ffffff06" }}>
                  {["Date", "Item", "SKU", "±Qty", "Unit", "₹ Impact", "Reason", "Session", "Notes"].map((h) => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLoading && <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Loading…</td></tr>}
                {!auditLoading && auditRows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>No adjustments found.</td></tr>}
                {auditRows.map((adj) => {
                  const impact = parseFloat(adj.qty) * parseFloat(adj.price || 0);
                  return (
                    <tr key={adj.id} style={{ borderBottom: `1px solid ${COLORS.border}11` }}>
                      <td style={{ padding: "8px 12px", color: COLORS.muted, whiteSpace: "nowrap", fontSize: 11 }}>{adj.date}</td>
                      <td style={{ padding: "8px 12px", color: COLORS.text, fontWeight: 500 }}>{adj.name}</td>
                      <td style={{ padding: "8px 12px", color: COLORS.teal, fontFamily: "monospace", fontSize: 11 }}>{adj.item_code}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: parseFloat(adj.qty) >= 0 ? COLORS.teal : COLORS.coral }}>
                        {parseFloat(adj.qty) >= 0 ? "+" : ""}{parseFloat(adj.qty).toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 12px", color: COLORS.muted }}>{adj.unit}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: impact >= 0 ? COLORS.teal : COLORS.coral }}>
                        {impact >= 0 ? "+" : ""}₹{Math.abs(impact).toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 12px", color: COLORS.muted, fontSize: 11 }}>{adj.reason}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {adj.session_name
                          ? <span style={{ background: "#e8a83818", color: "#e8a838", borderRadius: 4, padding: "2px 6px", fontSize: 10 }}>{adj.session_name}</span>
                          : <span style={{ color: COLORS.muted }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 12px", color: COLORS.muted, fontSize: 11 }}>{adj.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {auditTotal > 50 && (
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
              <Btn small variant="ghost" disabled={auditOffset === 0} onClick={() => loadAudit(Math.max(0, auditOffset - 50))}>← Prev</Btn>
              <span style={{ fontSize: 12, color: COLORS.muted }}>{auditOffset + 1}–{Math.min(auditOffset + 50, auditTotal)} of {auditTotal}</span>
              <Btn small variant="ghost" disabled={auditOffset + 50 >= auditTotal} onClick={() => loadAudit(auditOffset + 50)}>Next →</Btn>
            </div>
          )}
        </Card>
      )}

      {/* ──────────── Confirm Modal ──────────── */}
      {showConfirm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}
        >
          <Card
            style={{ padding: 28, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", borderRadius: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>⚖️ Confirm Reconciliation</p>
            <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 18, lineHeight: 1.6 }}>
              Applying <strong style={{ color: COLORS.text }}>{validRows.length} item(s)</strong> — net stock value impact:{" "}
              <strong style={{ color: (totalSurplusVal - totalShortageVal) >= 0 ? COLORS.teal : COLORS.coral }}>
                {(totalSurplusVal - totalShortageVal) >= 0 ? "+" : ""}₹{(totalSurplusVal - totalShortageVal).toFixed(2)}
              </strong>.
              {anomalyRows.length > 0 && <span style={{ color: COLORS.coral }}> ⚠ {anomalyRows.length} anomaly row(s) — please double-check.</span>}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Surplus Items", val: surplusRows.length, sub: "+₹" + totalSurplusVal.toFixed(2), color: COLORS.teal },
                { label: "Shortage Items", val: shortageRows.length, sub: "-₹" + totalShortageVal.toFixed(2), color: COLORS.coral },
                { label: "Matched", val: matchedRows.length, sub: "No change", color: COLORS.success },
              ].map(({ label, val, sub, color }) => (
                <div key={label} style={{ background: "#ffffff08", borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
                  <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color }}>{val}</p>
                  <p style={{ fontSize: 11, color: COLORS.muted }}>{sub}</p>
                </div>
              ))}
            </div>
            <div style={{ maxHeight: 150, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, background: COLORS.bg }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.muted, margin: "0 0 6px" }}>
                Agent Veritas — Double-Entry Ledger Impact Preview:
              </p>
              {validRows.filter(r => Math.abs(variance(r) || 0) > 0.0001).length === 0 ? (
                <p style={{ fontSize: 11, color: COLORS.muted, margin: 0 }}>All items match theoretical on-hand balances. Zero ledger adjustments needed.</p>
              ) : (
                validRows.filter(r => Math.abs(variance(r) || 0) > 0.0001).map((r, i) => {
                  const v = variance(r);
                  const isAdd = v > 0;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "3px 0", borderBottom: `1px solid ${COLORS.border}22` }}>
                      <span>
                        <code style={{ color: isAdd ? COLORS.teal : COLORS.coral, fontSize: 10, fontWeight: 700, marginRight: 6 }}>
                          {isAdd ? "ADJUSTMENT_ADD" : "ADJUSTMENT_DEDUCT"}
                        </code>
                        {r.item?.name}
                      </span>
                      <span style={{ fontWeight: 600, color: isAdd ? COLORS.teal : COLORS.coral }}>
                        {isAdd ? "+" : ""}{v.toFixed(2)} {r.item?.unit} (₹{Math.abs(valImpact(r) || 0).toFixed(2)})
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <p style={{ fontSize: 11, color: COLORS.coral, marginBottom: 16 }}>⚠ This action is irreversible and atomically commits adjustments to the inventory ledger.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={submit} style={{ flex: 1, background: "#e8a838", color: "#1a1207", fontWeight: 700 }}>✓ Confirm &amp; Apply</Btn>
              <Btn variant="ghost" onClick={() => setShowConfirm(false)} style={{ flex: 1 }}>Cancel</Btn>
            </div>
          </Card>
        </div>
      )}
    </Section>
  );
}
