import { useState, Fragment } from "react";
import Btn from "../Btn";
import Pagination from "../Pagination";
import ErrorMsg from "../ErrorMsg";
import { COLORS } from "../../styles/colors";
import { CheckCircle, AlertTriangle, ClipboardList, AlertCircle, Printer, Edit3, Clock, ChevronDown } from "lucide-react";
import { today } from "../../utils/dates";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
};

const getInitialsAvatar = (name) => {
  if (!name) return { text: "??", bg: "#f1f5f9", fg: "#64748b" };
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  let text = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : "ST");
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    { bg: "#eff6ff", fg: "#1d4ed8" },
    { bg: "#ecfdf5", fg: "#047857" },
    { bg: "#fef3c7", fg: "#b45309" },
    { bg: "#fff1f2", fg: "#be123c" },
    { bg: "#f5f3ff", fg: "#6d28d9" }
  ];
  return { text, ...colors[Math.abs(hash) % colors.length] };
};

export function StockTable({
  items = [],
  loading = false,
  error = null,
  page = 1,
  total = 0,
  limit = 20,
  onPage = () => {},
  groupByItem = false,
  readOnly = false,
  isMobile = false,
  
  // Actions required if not read-only
  setPrintModalItem = () => {},
  setAdjustModalItem = () => {},
  setAdjustQty = () => {},
  setAdjustMinAlert = () => {},
  setAdjustReason = () => {},
  setAdjustNotes = () => {},
  remove = () => {},
  editingId = null,
  startEdit = () => {},
  saveEdit = () => {},
  editRemaining = "",
  setEditRemaining = () => {},
  editMinAlert = "",
  setEditMinAlert = () => {},
  editReason = "Audit Correction",
  setEditReason = () => {},
  editNotes = "",
  setEditNotes = () => {},
  editName = "",
  setEditName = () => {},
  editUnit = "",
  setEditUnit = () => {},
  editPrice = "",
  setEditPrice = () => {},
  editItemCode = "",
  setEditItemCode = () => {}
}) {
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedCards, setExpandedCards] = useState({});

  const toggleCard = (id) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleExpandItem = (name) => {
    setExpandedItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const getExpiryBadge = (expiryDate) => {
    if (!expiryDate) return null;
    const todayVal = new Date(today());
    const expiryVal = new Date(expiryDate);
    const diffTime = expiryVal - todayVal;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <span className="status-badge" style={{ background: "var(--color-accent-red-light)", color: "var(--color-accent-red)" }}><AlertCircle size={12} /> Expired ({expiryDate})</span>;
    }
    if (diffDays <= 3) {
      return <span className="status-badge" style={{ background: "var(--color-accent-amber-light)", color: "var(--color-accent-amber)" }}><Clock size={12} /> Expiring soon ({diffDays}d)</span>;
    }
    return <span className="status-badge" style={{ background: "var(--color-accent-green-light)", color: "var(--color-accent-green)" }}><CheckCircle size={12} /> Fresh ({expiryDate})</span>;
  };

  // Group items by name for the "Group by Item" view
  const groupedItems = (() => {
    const map = {};
    items.forEach((b) => {
      const key = b.name.toLowerCase();
      if (!map[key]) {
        map[key] = {
          name: b.name,
          item_code: b.item_code,
          unit: b.unit,
          category: b.category,
          remaining: 0,
          totalCost: 0,
          batchCount: 0,
          batches: [],
        };
      }
      map[key].remaining   += parseFloat(b.remaining || 0);
      map[key].totalCost   += parseFloat(b.price || 0) * parseFloat(b.qty || 0);
      map[key].batchCount  += 1;
      map[key].batches.push(b);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  })();

  if (loading) {
    return <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading…</p>;
  }

  if (error) {
    return <ErrorMsg error={error} />;
  }

  if (items.length === 0) {
    return <p style={{ color: COLORS.muted, textAlign: "center", padding: 40 }}>No stock recorded yet</p>;
  }

  return (
    <>
      {groupByItem ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            <div className="resp-table-wrap">
              <table>
                <thead>
                  <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Total Batches</th>
                  <th>Total Remaining</th>
                  <th>Avg Cost</th>
                  <th>Total Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groupedItems.map((item, idx) => {
                  const isExpanded = !!expandedItems[item.name.toLowerCase()];
                  const healthy = item.batches.every(b => {
                    const pct = b.qty > 0 ? (b.remaining / b.qty) * 100 : 0;
                    return b.min_alert_qty !== null ? b.remaining > b.min_alert_qty : pct >= 25;
                  });
                  const totalVal = item.batches.reduce((sum, b) => sum + (b.remaining * (b.price || 0)), 0);
                  const avgCost = item.batchCount > 0 ? (item.totalCost / item.batchCount) : 0;

                  return (
                    <Fragment key={idx}>
                      <tr onClick={() => toggleExpandItem(item.name)} style={{ cursor: "pointer", transition: "background 0.2s" }}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 10, color: COLORS.muted }}>{isExpanded ? "▼" : "▶"}</span>
                            {(() => {
                              const avatar = getInitialsAvatar(item.name);
                              return (
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: avatar.bg,
                                  color: avatar.fg,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  flexShrink: 0
                                }}>
                                  {avatar.text}
                                </div>
                              );
                            })()}
                            <div>
                              <span style={{ color: COLORS.accent, fontSize: 10, display: "block", fontWeight: 600, letterSpacing: "0.04em" }}>{item.item_code}</span>
                              <span style={{ fontSize: "14px", color: COLORS.text }}>{item.name}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {item.category ? (
                            <span className="chip" style={{ fontSize: 11, cursor: "default" }}>{item.category}</span>
                          ) : (
                            <span style={{ fontSize: 11, color: COLORS.muted }}>—</span>
                          )}
                        </td>
                        <td>{item.batches.length} batch(es)</td>
                        <td style={{ fontWeight: 500, color: healthy ? COLORS.success : COLORS.danger }}>
                          {item.remaining.toFixed(2)} {item.unit}
                        </td>
                        <td>{avgCost > 0 ? `₹${avgCost.toFixed(2)}` : "—"}</td>
                        <td style={{ fontWeight: 600, color: COLORS.teal }}>₹{totalVal.toFixed(2)}</td>
                        <td>
                          <span className="status-badge" style={{ background: healthy ? "var(--color-accent-green-light)" : "var(--color-accent-red-light)", color: healthy ? "var(--color-accent-green)" : "var(--color-accent-red)" }}>
                            {healthy ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                            {healthy ? "Healthy" : "Low Stock"}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" style={{ padding: "10px 14px 16px 30px", background: COLORS.bg + "22" }}>
                            <div style={{ border: `1px solid ${COLORS.border}55`, borderRadius: 8, padding: "14px 20px", background: COLORS.surface + "aa" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
                                  <ClipboardList size={14} /> FIFO Batch Pipeline & Expiry Log
                                </p>
                                <span style={{ fontSize: 10, color: COLORS.muted, fontStyle: "italic" }}>Oldest batches are consumed first (FIFO order)</span>
                              </div>

                              <div style={{ position: "relative", borderLeft: `2px solid ${COLORS.border}`, paddingLeft: 20, marginLeft: 6, display: "flex", flexDirection: "column", gap: 12 }}>
                                {item.batches.map((b) => {
                                  const bPct = b.qty > 0 ? (b.remaining / b.qty) * 100 : 0;
                                  const bColor = bPct > 50 ? COLORS.success : bPct > 20 ? COLORS.accent : COLORS.danger;
                                  
                                  let dotColor = COLORS.success;
                                  if (b.remaining <= 0) dotColor = COLORS.muted;
                                  else if (bPct < 25) dotColor = COLORS.danger;
                                  else if (bPct < 50) dotColor = COLORS.accent;
                                  
                                  const todayVal = new Date(today());
                                  const isExpired = b.expiry_date && new Date(b.expiry_date) < todayVal;
                                  if (isExpired && b.remaining > 0) dotColor = COLORS.danger;

                                  return (
                                    <div key={b.id} style={{ position: "relative" }}>
                                      <div style={{
                                        position: "absolute",
                                        left: "-26px",
                                        top: "16px",
                                        width: "10px",
                                        height: "10px",
                                        borderRadius: "50%",
                                        background: dotColor,
                                        border: `2px solid ${COLORS.bg}`,
                                        boxShadow: `0 0 6px ${dotColor}`
                                      }} />

                                      <div style={{
                                        background: COLORS.bg + "88",
                                        border: `1px solid ${COLORS.border}44`,
                                        borderRadius: 6,
                                        padding: "12px 16px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 20
                                      }}>
                                        <div>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.purple, background: COLORS.purple + "18", padding: "2px 6px", borderRadius: 4 }}>{b.item_code}</span>
                                            <span style={{ fontSize: 11, color: COLORS.muted }}>Recd: {b.date}</span>
                                            {b.expiry_date && (
                                              <span className="status-badge" style={{ 
                                                background: isExpired ? "var(--color-accent-red-light)" : "var(--color-accent-green-light)", 
                                                color: isExpired ? "var(--color-accent-red)" : "var(--color-accent-green)",
                                                fontSize: 10,
                                                padding: "2px 6px"
                                              }}>
                                                {isExpired ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                                                {isExpired ? "Expired" : `Exp: ${b.expiry_date}`}
                                              </span>
                                            )}
                                          </div>
                                          <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 6 }}>Supplier: {b.supplier || "—"}</p>
                                        </div>

                                        <div style={{ flex: 1, maxWidth: 220, display: "flex", flexDirection: "column", gap: 4 }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                            <span style={{ color: bColor, fontWeight: 600 }}>{parseFloat(b.remaining).toFixed(1)} / {b.qty} {b.unit}</span>
                                            <span style={{ color: COLORS.muted }}>({bPct.toFixed(0)}%)</span>
                                          </div>
                                          <div style={{ height: 6, background: COLORS.border + "55", borderRadius: 3, overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${bPct}%`, background: bColor }} />
                                          </div>
                                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.muted }}>
                                            <span>Landed cost: {b.price ? `₹${parseFloat(b.price).toFixed(2)}` : "—"}</span>
                                            {b.min_alert_qty !== null && <span>Min: {b.min_alert_qty}</span>}
                                          </div>
                                        </div>

                                        {!readOnly && (
                                          <div style={{ display: "flex", gap: 6 }}>
                                            <Btn variant="ghost" small onClick={() => setPrintModalItem(b)} title="Print Label" style={{ padding: "6px 8px", border: `1px solid ${COLORS.border}` }}>
                                              <Printer size={14} />
                                            </Btn>
                                            <Btn variant="ghost" small onClick={() => {
                                              setAdjustModalItem(b);
                                              setAdjustQty(b.remaining.toString());
                                              setAdjustMinAlert(b.min_alert_qty !== null ? b.min_alert_qty.toString() : "");
                                              setAdjustReason("Audit Correction");
                                              setAdjustNotes("");
                                            }} title="Adjust Qty" style={{ padding: "6px 8px" }}>
                                              <Edit3 size={14} />
                                            </Btn>
                                            <Btn variant="danger" small onClick={() => remove(b.id)}>✕</Btn>
                                          </div>
                                        )}

                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          <Pagination page={page} total={total} limit={limit} onPage={onPage} />
        </div>
      ) : isMobile ? (
        /* ─── MOBILE FLAT VIEW: Item Cards ─────────────── */
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => {
              const pct = item.qty > 0 ? (item.remaining / item.qty) * 100 : 0;
              const isLow = item.min_alert_qty !== null ? item.remaining <= item.min_alert_qty : pct < 25;
              const color = pct > 50 ? COLORS.success : pct > 20 ? COLORS.accent : COLORS.danger;
              const isExp = expandedCards[item.id];
              const todayVal = new Date(today());
              const isExpired = item.expiry_date && new Date(item.expiry_date) < todayVal;
              const avatar = getInitialsAvatar(item.name);

              return (
                <div
                  key={item.id}
                  className={`mob-item-card${isLow ? " low-stock" : ""}`}
                  onClick={() => toggleCard(item.id)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Card Header */}
                  <div className="mob-item-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: avatar.bg, color: avatar.fg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, flexShrink: 0
                      }}>
                        {avatar.text}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 9, color: COLORS.accent, display: "block", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 1 }}>{item.item_code}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
                        {isLow && (
                          <span style={{ color: COLORS.danger, fontSize: 10, display: "flex", alignItems: "center", gap: 3, marginTop: 2, fontWeight: 700 }}>
                            <AlertCircle size={10} /> LOW STOCK
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color }}>{parseFloat(item.remaining).toFixed(1)}</span>
                        <span style={{ fontSize: 11, color: COLORS.muted }}> {item.unit}</span>
                      </div>
                      <ChevronDown size={16} style={{ color: COLORS.muted, transition: "transform 0.2s", transform: isExp ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </div>
                  </div>

                  {/* Progress bar always visible */}
                  <div style={{ height: 5, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 4, borderTop: `1px solid ${COLORS.border}`, marginTop: 2 }} onClick={e => e.stopPropagation()}>
                      <div>
                        <p style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600, marginBottom: 2 }}>SUPPLIER</p>
                        <p style={{ fontSize: 13, color: COLORS.text }}>{item.supplier || "—"}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600, marginBottom: 2 }}>UNIT COST</p>
                        <p style={{ fontSize: 13, color: COLORS.text }}>{item.price ? `₹${parseFloat(item.price).toFixed(2)}` : "—"}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600, marginBottom: 2 }}>BATCH</p>
                        <p style={{ fontSize: 13, color: COLORS.text, fontFamily: "monospace" }}>{item.batch_no || "—"}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600, marginBottom: 2 }}>EXPIRY</p>
                        {item.expiry_date ? (
                          <span className="status-badge" style={{
                            background: isExpired ? "var(--color-accent-red-light)" : "var(--color-accent-green-light)",
                            color: isExpired ? "var(--color-accent-red)" : "var(--color-accent-green)",
                            fontSize: 11, padding: "2px 6px"
                          }}>
                            {isExpired ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                            {item.expiry_date}
                          </span>
                        ) : <span style={{ fontSize: 13, color: COLORS.muted }}>—</span>}
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600, marginBottom: 2 }}>DATE RECEIVED</p>
                        <p style={{ fontSize: 13, color: COLORS.text }}>{formatDate(item.date)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600, marginBottom: 2 }}>ORIG QTY</p>
                        <p style={{ fontSize: 13, color: COLORS.text }}>{item.qty} {item.unit}</p>
                      </div>
                      {!readOnly && (
                        <div style={{ gridColumn: "span 2", display: "flex", gap: 8, marginTop: 10 }}>
                          <Btn variant="ghost" small onClick={() => setPrintModalItem(item)} style={{ flex: 1, padding: "8px", border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "center", alignItems: "center" }}>
                            <Printer size={14} style={{ marginRight: 6 }} /> Label
                          </Btn>
                          <Btn variant="ghost" small onClick={() => {
                            setAdjustModalItem(item);
                            setAdjustQty(item.remaining.toString());
                            setAdjustMinAlert(item.min_alert_qty !== null ? item.min_alert_qty.toString() : "");
                            setAdjustReason("Audit Correction");
                            setAdjustNotes("");
                          }} style={{ flex: 1, padding: "8px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                            <ClipboardList size={14} style={{ marginRight: 6 }} /> Adjust
                          </Btn>
                          <Btn variant="danger" small onClick={() => remove(item.id)} style={{ padding: "8px 12px" }}>✕</Btn>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination page={page} total={total} limit={limit} onPage={onPage} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            <div className="resp-table-wrap">
              <table>
                <thead>
                  <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Batch</th>
                  <th>Original Qty</th>
                  <th>Remaining</th>
                  <th>Unit Cost</th>
                  <th>Value (Rem / Orig)</th>
                  <th>Supplier</th>
                  <th>Expiry</th>
                  <th>Date</th>
                  {!readOnly && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const pct = item.qty > 0 ? (item.remaining / item.qty) * 100 : 0;
                  const isLow = item.min_alert_qty !== null ? item.remaining <= item.min_alert_qty : pct < 25;
                  const color = pct > 50 ? COLORS.success : pct > 20 ? COLORS.accent : COLORS.danger;
                  
                  const origCost = item.price ? item.qty * item.price : 0;
                  const remCost = item.price ? item.remaining * item.price : 0;

                  return (
                    <tr key={item.id} style={{ 
                      background: isLow ? "var(--color-accent-red-light)" : "transparent",
                      transition: "background 0.2s"
                    }}>
                      <td style={{ fontWeight: 500, borderLeft: isLow ? `3px solid ${COLORS.danger}` : "3px solid transparent", paddingLeft: 11 }}>
                        {editingId === item.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 9, color: COLORS.muted }}>Item Code:</label>
                            <input
                              type="text"
                              value={editItemCode}
                              onChange={(e) => setEditItemCode(e.target.value)}
                              style={{ padding: "4px 8px", fontSize: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, width: "100%" }}
                            />
                            <label style={{ fontSize: 9, color: COLORS.muted }}>Item Name:</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              style={{ padding: "4px 8px", fontSize: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, width: "100%" }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {(() => {
                              const avatar = getInitialsAvatar(item.name);
                              return (
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: avatar.bg,
                                  color: avatar.fg,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  flexShrink: 0
                                }}>
                                  {avatar.text}
                                </div>
                              );
                            })()}
                            <div>
                              <span style={{ color: COLORS.accent, fontSize: 10, display: "block", fontWeight: 600, letterSpacing: "0.04em" }}>{item.item_code}</span>
                              <span style={{ fontSize: "14px" }}>{item.name}</span>
                              {isLow && (
                                <span style={{ color: COLORS.danger, fontSize: 10, display: "flex", alignItems: "center", gap: 3, marginTop: 2, fontWeight: 600, letterSpacing: "0.04em" }}>
                                  <AlertCircle size={10} /> LOW STOCK
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        {item.category
                          ? <span className="chip" style={{ fontSize: 11, cursor: "default" }}>{item.category}</span>
                          : <span style={{ color: COLORS.muted, fontSize: 11 }}>—</span>}
                      </td>
                      <td>
                        {item.batch_no
                          ? <span style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.purple, background: COLORS.purple + "18", padding: "2px 6px", borderRadius: 4 }}>{item.batch_no}</span>
                          : <span style={{ color: COLORS.muted, fontSize: 11 }}>—</span>}
                      </td>
                      <td>
                        {editingId === item.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, color: COLORS.muted }}>Orig Qty: {item.qty}</span>
                            <select
                              value={editUnit}
                              onChange={(e) => setEditUnit(e.target.value)}
                              style={{ padding: "4px 8px", fontSize: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, width: "100%" }}
                            >
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="pcs">pcs</option>
                              <option value="box">box</option>
                              <option value="l">l</option>
                              <option value="ml">ml</option>
                              <option value="packet">packet</option>
                              <option value="bottle">bottle</option>
                            </select>
                          </div>
                        ) : (
                          <>{item.qty} {item.unit}</>
                        )}
                      </td>
                      <td>
                        {editingId === item.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 9, color: COLORS.muted }}>Remaining:</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editRemaining}
                              onChange={(e) => setEditRemaining(e.target.value)}
                              style={{ width: 80, padding: "4px 8px", fontSize: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4 }}
                            />
                            <label style={{ fontSize: 9, color: COLORS.muted }}>Min Alert:</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editMinAlert}
                              onChange={(e) => setEditMinAlert(e.target.value)}
                              style={{ width: 80, padding: "4px 8px", fontSize: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4 }}
                            />
                            <label style={{ fontSize: 9, color: COLORS.muted }}>Reason:</label>
                            <select
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              style={{ width: 80, padding: "2px 4px", fontSize: 10, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4 }}
                            >
                              <option value="Audit Correction">Audit Correction</option>
                              <option value="Spoiled / Spilled">Spoiled / Spilled</option>
                              <option value="Pest Damage">Pest Damage</option>
                              <option value="Kitchen Theft">Kitchen Theft</option>
                            </select>
                            <label style={{ fontSize: 9, color: COLORS.muted }}>Notes:</label>
                            <input
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Notes"
                              style={{ width: 80, padding: "4px 8px", fontSize: 10, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4 }}
                            />
                          </div>
                        ) : (
                          <>
                            <span style={{ color, fontWeight: 500 }}>{parseFloat(item.remaining).toFixed(2)}</span>
                            <div style={{ height: 6, background: COLORS.border, borderRadius: 3, marginTop: 6, width: 80, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: color }} />
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        {editingId === item.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 9, color: COLORS.muted }}>Unit Price (₹):</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              style={{ width: 80, padding: "4px 8px", fontSize: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4 }}
                            />
                          </div>
                        ) : (
                          item.price ? `₹${parseFloat(item.price).toFixed(2)} / ${item.unit}` : "—"
                        )}
                      </td>
                      <td>
                        {item.price ? (
                          <>
                            <span style={{ fontWeight: 500, color: color }}>₹{remCost.toFixed(2)}</span>
                            <span style={{ display: "block", fontSize: 10, color: COLORS.muted, marginTop: 2 }}>of ₹{origCost.toFixed(2)}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td style={{ color: COLORS.muted }}>{item.supplier || "—"}</td>
                      <td>{getExpiryBadge(item.expiry_date) || "—"}</td>
                      <td style={{ color: COLORS.muted }}>{formatDate(item.date)}</td>
                      {!readOnly && (
                        <td>
                          {editingId === item.id ? (
                            <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
                              <Btn variant="success" small onClick={() => saveEdit(item.id)}>Save</Btn>
                              <Btn variant="ghost" small onClick={() => startEdit(null)} style={{ border: `1px solid ${COLORS.border}`, fontSize: 11, padding: "4px 8px" }}>Cancel</Btn>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 4 }}>
                              <Btn variant="ghost" small onClick={() => setPrintModalItem(item)} title="Print Label" style={{ padding: "6px 8px", border: `1px solid ${COLORS.border}` }}>
                                <Printer size={14} />
                              </Btn>
                              <Btn variant="ghost" small onClick={() => {
                                setAdjustModalItem(item);
                                setAdjustQty(item.remaining.toString());
                                setAdjustMinAlert(item.min_alert_qty !== null ? item.min_alert_qty.toString() : "");
                                setAdjustReason("Audit Correction");
                                setAdjustNotes("");
                              }} title="Adjust Qty / Discrepancy" style={{ padding: "6px 8px", border: `1px solid ${COLORS.border}` }}>
                                <ClipboardList size={14} />
                              </Btn>
                              <Btn variant="ghost" small onClick={() => startEdit(item)} style={{ padding: "6px 8px" }} title="Edit Item Details">
                                <Edit3 size={14} />
                              </Btn>
                              <Btn variant="danger" small onClick={() => remove(item.id)}>✕</Btn>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          <Pagination page={page} total={total} limit={limit} onPage={onPage} />
        </div>
      )}
    </>
  );
}
