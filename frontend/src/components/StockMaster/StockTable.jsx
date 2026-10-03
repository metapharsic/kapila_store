import { useState, Fragment } from "react";
import Btn from "../Btn";
import Pagination from "../Pagination";
import ErrorMsg from "../ErrorMsg";
import { COLORS } from "../../styles/colors";
import {
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  AlertCircle,
  Printer,
  Edit3,
  Clock,
  ChevronDown,
  Eye,
  PlusCircle,
  Trash2,
  MapPin,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
  MoreHorizontal
} from "lucide-react";
import { today } from "../../utils/dates";
import StockSkeletonLoader from "./StockSkeletonLoader";
import UnitDimensionBadge from "../UnitDimensionBadge";
import RaiseIndentItemModal from "../chef/RaiseIndentItemModal";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr, timeStr) => {
  if (!dateStr && !timeStr) return "—";
  try {
    const d = new Date(timeStr || dateStr);
    if (isNaN(d.getTime())) return dateStr || "—";
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return dateStr || "—";
  }
};

const getInitialsAvatar = (name) => {
  if (!name) return { text: "??", bg: "#f1f5f9", fg: "var(--text-muted)" };
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

const getActionLinkStyle = (variant) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 9px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
    border: "1px solid",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
  };
  switch (variant) {
    case "view":
      return { ...base, background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
    case "edit":
      return { ...base, background: "#fefce8", color: "#a16207", borderColor: "#fde047" };
    case "append":
      return { ...base, background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" };
    case "print":
      return { ...base, background: "#faf5ff", color: "#7e22ce", borderColor: "#e9d5ff" };
    case "indent":
      return { ...base, background: "rgba(232, 168, 56, 0.15)", color: "#b45309", borderColor: "rgba(232, 168, 56, 0.4)" };
    case "delete":
      return { ...base, background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" };
    default:
      return base;
  }
};

// Compact icon-only button used by the row actions cluster.
const getIconBtnStyle = (variant) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 7,
    border: "1px solid",
    cursor: "pointer",
    transition: "all 0.15s ease",
    flexShrink: 0,
  };
  switch (variant) {
    case "view":
      return { ...base, background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
    case "more":
      return { ...base, background: "transparent", color: "#64748b", borderColor: "#e2e8f0" };
    default:
      return base;
  }
};

/**
 * RowActions — a primary "View" icon button plus a kebab menu holding the
 * remaining row operations (Append, Edit, Print, Indent, Delete, …).
 * Keeps dense tables scannable instead of a row of wide icon+label chips.
 */
function RowActions({ onView, viewTitle = "View details", menuItems = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
      <button onClick={onView} style={getIconBtnStyle("view")} title={viewTitle}>
        <Eye size={14} />
      </button>
      {menuItems.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          style={getIconBtnStyle("more")}
          title="More actions"
        >
          <MoreHorizontal size={15} />
        </button>
      )}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 31,
              background: "var(--bg-card, #fff)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              boxShadow: "0 10px 28px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)",
              minWidth: 168,
              padding: 5,
            }}
          >
            {menuItems.map((m, i) => (
              <button
                key={i}
                onClick={() => { setOpen(false); m.onClick(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 10px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: m.danger ? "#b91c1c" : "var(--text-main)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = m.danger ? "#fef2f2" : "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
  
  // New First-Class Enterprise Hyperlink Actions
  onView = () => {},
  onEditItem = null,
  onAppend = () => {},
  onDelete = null,
  onExportExcel = () => {},

  // Legacy / Existing Actions
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
  const [indentModalItem, setIndentModalItem] = useState(null);

  const toggleCard = (id) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleExpandItem = (name) => {
    setExpandedItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleEditClick = (item) => {
    if (onEditItem) {
      onEditItem(item);
    } else {
      startEdit(item);
    }
  };

  const handleDeleteClick = (item) => {
    if (onDelete) {
      onDelete(item);
    } else {
      remove(item.id);
    }
  };

  const getExpiryBadge = (expiryDate) => {
    if (!expiryDate) return null;
    const todayVal = new Date(today());
    const expiryVal = new Date(expiryDate);
    const diffTime = expiryVal - todayVal;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return (
        <span className="status-badge" style={{ background: "var(--color-accent-red-light)", color: "var(--color-accent-red)", fontSize: 10, padding: "2px 6px" }}>
          <AlertCircle size={10} /> Expired ({expiryDate})
        </span>
      );
    }
    if (diffDays <= 3) {
      return (
        <span className="status-badge" style={{ background: "var(--color-accent-amber-light)", color: "var(--color-accent-amber)", fontSize: 10, padding: "2px 6px" }}>
          <Clock size={10} /> Expiring ({diffDays}d)
        </span>
      );
    }
    return (
      <span className="status-badge" style={{ background: "var(--color-accent-green-light)", color: "var(--color-accent-green)", fontSize: 10, padding: "2px 6px" }}>
        <CheckCircle size={10} /> Fresh ({expiryDate})
      </span>
    );
  };

  // Group items by item_code (or name) for the "Group by Item" view
  const groupedItems = (() => {
    const map = {};
    items.forEach((b) => {
      const key = (b.item_code || b.name || "").toLowerCase().trim();
      if (!map[key]) {
        map[key] = {
          id: b.id,
          name: b.name || b.item_code,
          item_code: b.item_code,
          unit: b.unit,
          category: b.category,
          rack_location: b.rack_location,
          storage_zone: b.storage_zone,
          supplier: b.supplier,
          remaining: 0,
          totalQty: 0,
          totalCost: 0,
          batchCount: 0,
          batches: [],
        };
      }
      if (!map[key].name && b.name) map[key].name = b.name;
      if (!map[key].item_code && b.item_code) map[key].item_code = b.item_code;
      if (!map[key].category && b.category) map[key].category = b.category;
      if (!map[key].rack_location && b.rack_location) map[key].rack_location = b.rack_location;
      if (!map[key].storage_zone && b.storage_zone) map[key].storage_zone = b.storage_zone;
      map[key].remaining   += parseFloat(b.remaining || 0);
      map[key].totalQty    += parseFloat(b.qty || 0);
      map[key].totalCost   += parseFloat(b.price || 0) * parseFloat(b.qty || 0);
      map[key].batchCount  += 1;
      map[key].batches.push(b);
    });
    return Object.values(map).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  })();

  // Exceptional elaborated loading state
  if (loading) {
    return <StockSkeletonLoader />;
  }

  if (error) {
    return <ErrorMsg error={error} />;
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.muted }}>
        <Layers size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>No stock inventory records found</p>
        <p style={{ fontSize: 13, marginTop: 4 }}>Adjust your search filter or append inward delivery batches.</p>
      </div>
    );
  }

  return (
    <>
      {groupByItem ? (
        /* ─── GROUPED BY ITEM VIEW ───────────────────────────────── */
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            <div className="resp-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item & SKU</th>
                    <th>Category</th>
                    <th>Rack Location</th>
                    <th>Total Batches</th>
                    <th style={{ textAlign: "right" }}>Stock Available</th>
                    <th style={{ textAlign: "right" }}>Avg Cost</th>
                    <th style={{ textAlign: "right" }}>Total Value</th>
                    <th>Status</th>
                    {!readOnly && <th style={{ textAlign: "right", minWidth: 76 }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map((item, idx) => {
                    const isExpanded = !!expandedItems[(item.name || "").toLowerCase()];
                    const healthy = item.batches.every(b => {
                      const pct = b.qty > 0 ? (b.remaining / b.qty) * 100 : 0;
                      return b.min_alert_qty !== null ? b.remaining > b.min_alert_qty : pct >= 25;
                    });
                    const totalVal = item.batches.reduce((sum, b) => sum + (parseFloat(b.remaining || 0) * (parseFloat(b.price) || 0)), 0);
                    const avgCost = item.totalQty > 0 ? (item.totalCost / item.totalQty) : (item.batches[0]?.price ? parseFloat(item.batches[0].price) : 0);

                    return (
                      <Fragment key={idx}>
                        <tr style={{ cursor: "pointer", transition: "background 0.2s" }}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span 
                                onClick={() => toggleExpandItem(item.name)} 
                                style={{ fontSize: 11, color: COLORS.muted, cursor: "pointer", padding: "4px" }}
                                title="Toggle batch breakdown"
                              >
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              {(() => {
                                const avatar = getInitialsAvatar(item.name);
                                return (
                                  <div style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: "50%",
                                    background: avatar.bg,
                                    color: avatar.fg,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                    opacity: 0.85
                                  }}>
                                    {avatar.text}
                                  </div>
                                );
                              })()}
                              <div>
                                <a
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); onView(item.batches ? item.batches[0] : item); }}
                                  style={{
                                    color: "var(--color-gold)",
                                    fontSize: 10.5,
                                    display: "inline-block",
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textDecoration: "underline"
                                  }}
                                  title="Click to view 360° item audit dossier"
                                >
                                  {item.item_code}
                                </a>
                                <span 
                                  onClick={() => onView(item.batches ? item.batches[0] : item)}
                                  style={{ fontSize: 13.5, color: "var(--text-main)", fontWeight: 600, display: "block", cursor: "pointer", transition: "color 0.15s ease" }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-gold)"}
                                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-main)"}
                                  title="Click to view full item dossier"
                                >
                                  {item.name}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {item.category ? (
                              <span className="chip" style={{ fontSize: 11, fontWeight: 600, color: "#334155", background: "#f1f5f9", border: "1px solid #cbd5e1", cursor: "default" }}>{item.category}</span>
                            ) : (
                              <span style={{ fontSize: 11, color: COLORS.muted }}>—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-main)", fontWeight: 600 }}>
                              <MapPin size={13} style={{ color: "#d97706", flexShrink: 0 }} />
                              <span>{item.rack_location || "Main Store"}</span>
                            </div>
                            <span style={{ fontSize: 11, color: "#475569", display: "block", paddingLeft: 18, fontWeight: 500 }}>
                              {item.storage_zone || "General Zone"}
                            </span>
                          </td>
                          <td onClick={() => toggleExpandItem(item.name)}>
                            <span style={{ cursor: "pointer", color: "#2563eb", fontWeight: 600, textDecoration: "underline" }}>
                              {item.batches.length} batch(es)
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: healthy ? COLORS.success : COLORS.danger, textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                              <span>{item.remaining.toFixed(2)}</span>
                              <UnitDimensionBadge unit={item.unit} compact />
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>{avgCost > 0 ? `₹${avgCost.toFixed(2)}` : "—"}</td>
                          <td style={{ fontWeight: 700, color: COLORS.teal, textAlign: "right" }}>₹{totalVal.toFixed(2)}</td>
                          <td>
                            <span className="status-badge" style={{ background: healthy ? "var(--color-accent-green-light)" : "var(--color-accent-red-light)", color: healthy ? "var(--color-accent-green)" : "var(--color-accent-red)" }}>
                              {healthy ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                              {healthy ? "Healthy" : "Low Stock"}
                            </span>
                          </td>
                          {!readOnly && (
                            <td style={{ textAlign: "right" }}>
                              <RowActions
                                onView={() => onView(item.batches ? item.batches[0] : item)}
                                viewTitle="View complete stock and batch history"
                                menuItems={[
                                  { icon: <PlusCircle size={13} />, label: "Append Batch", onClick: () => onAppend(item) },
                                  { icon: <Edit3 size={13} />, label: "Edit Item", onClick: () => handleEditClick(item) },
                                ]}
                              />
                            </td>
                          )}
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={readOnly ? 8 : 9} style={{ padding: "10px 14px 16px 30px", background: COLORS.bg + "22" }}>
                              <div style={{ border: `1px solid ${COLORS.border}55`, borderRadius: 8, padding: "14px 20px", background: COLORS.surface + "aa" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                  <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
                                    <ClipboardList size={14} /> FIFO Batch Pipeline & Rack Locations
                                  </p>
                                  <span style={{ fontSize: 10, color: COLORS.muted, fontStyle: "italic" }}>FEFO / FIFO Dispatch order</span>
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
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                              <span style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.purple, background: COLORS.purple + "18", padding: "2px 6px", borderRadius: 4 }}>
                                                {b.batch_no || b.item_code}
                                              </span>
                                              <span style={{ fontSize: 11, color: COLORS.muted }}>
                                                Recd: {formatDateTime(b.date, b.purchase_time)}
                                              </span>
                                              {b.rack_location && (
                                                <span style={{ fontSize: 11, color: "var(--color-gold)", background: "rgba(232, 168, 56, 0.12)", padding: "2px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                  <MapPin size={10} /> {b.rack_location}
                                                </span>
                                              )}
                                              {getExpiryBadge(b.expiry_date)}
                                            </div>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 6 }}>
                                              Supplier: {b.supplier || "—"} {b.invoice_no ? `(Inv #${b.invoice_no})` : ""}
                                            </p>
                                          </div>

                                          <div style={{ flex: 1, maxWidth: 220, display: "flex", flexDirection: "column", gap: 4 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                              <span style={{ color: bColor, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                {parseFloat(b.remaining).toFixed(1)} / {b.qty} {b.unit}
                                                <UnitDimensionBadge unit={b.unit} compact />
                                              </span>
                                              <span style={{ color: COLORS.muted }}>({bPct.toFixed(0)}%)</span>
                                            </div>
                                            <div style={{ height: 6, background: COLORS.border + "55", borderRadius: 3, overflow: "hidden" }}>
                                              <div style={{ height: "100%", width: `${bPct}%`, background: bColor }} />
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.muted }}>
                                              <span>Cost: {b.price ? `₹${parseFloat(b.price).toFixed(2)}` : "—"}</span>
                                              {b.min_alert_qty !== null && <span>Min: {b.min_alert_qty}</span>}
                                            </div>
                                          </div>

                                          {!readOnly && (
                                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                              <button
                                                onClick={() => onView(b)}
                                                style={getActionLinkStyle("view")}
                                                title="View Batch Dossier"
                                              >
                                                <Eye size={12} /> View
                                              </button>
                                              <button
                                                onClick={() => setPrintModalItem(b)}
                                                style={getActionLinkStyle("print")}
                                                title="Print Label"
                                              >
                                                <Printer size={12} /> Print
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setAdjustModalItem(b);
                                                  setAdjustQty(b.remaining.toString());
                                                  setAdjustMinAlert(b.min_alert_qty !== null ? b.min_alert_qty.toString() : "");
                                                  setAdjustReason("Audit Correction");
                                                  setAdjustNotes("");
                                                }}
                                                style={getActionLinkStyle("edit")}
                                                title="Adjust Qty"
                                              >
                                                <Edit3 size={12} /> Adjust
                                              </button>
                                              <button
                                                onClick={() => handleDeleteClick(b)}
                                                style={getActionLinkStyle("delete")}
                                                title="Delete Batch"
                                              >
                                                <Trash2 size={12} /> Delete
                                              </button>
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
        /* ─── MOBILE VIEW: Expanded Enterprise Cards ─────────────── */
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((item) => {
              const pct = item.qty > 0 ? (item.remaining / item.qty) * 100 : 0;
              const isLow = item.min_alert_qty !== null ? item.remaining <= item.min_alert_qty : pct < 25;
              const color = pct > 50 ? COLORS.success : pct > 20 ? COLORS.accent : COLORS.danger;
              const isExp = expandedCards[item.id];
              const avatar = getInitialsAvatar(item.name);

              return (
                <div
                  key={item.id}
                  className={`mob-item-card${isLow ? " low-stock" : ""}`}
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${isLow ? "rgba(239, 68, 68, 0.4)" : COLORS.border}`,
                    borderRadius: 10,
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
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
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); onView(item.batches ? item.batches[0] : item); }}
                          style={{ fontSize: 10, color: COLORS.accent, display: "inline-block", fontWeight: 700, letterSpacing: "0.05em", textDecoration: "underline" }}
                        >
                          {item.item_code}
                        </a>
                        <span 
                          onClick={() => onView(item.batches ? item.batches[0] : item)}
                          style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, display: "block", cursor: "pointer" }}
                        >
                          {item.name}
                        </span>
                        {isLow && (
                          <span style={{ color: COLORS.danger, fontSize: 10, display: "flex", alignItems: "center", gap: 3, marginTop: 2, fontWeight: 700 }}>
                            <AlertCircle size={10} /> LOW STOCK
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color }}>{parseFloat(item.remaining).toFixed(1)}</span>
                        <span style={{ fontSize: 11, color: COLORS.muted }}> {item.unit}</span>
                      </div>
                      <div style={{ marginTop: 2, display: "flex", justifyContent: "flex-end" }}>
                        <UnitDimensionBadge unit={item.unit} compact />
                      </div>
                    </div>
                  </div>

                  {/* Rack & Zone Positioning Badge */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 11
                  }}>
                    <MapPin size={12} style={{ color: "var(--color-gold)" }} />
                    <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{item.rack_location || "Rack A-01 / Shelf 1"}</span>
                    <span style={{ color: "var(--text-muted)" }}>• {item.storage_zone || "Main Store"}</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 5, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3 }} />
                  </div>

                  {/* Quick Action Hyperlinks */}
                  {!readOnly && (
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      paddingTop: 6,
                      borderTop: `1px solid ${COLORS.border}44`
                    }}>
                      <button onClick={() => setIndentModalItem(item.batches ? item.batches[0] : item)} style={getActionLinkStyle("indent")}>
                        <ClipboardList size={12} /> Raise Indent
                      </button>
                      <button onClick={() => onView(item.batches ? item.batches[0] : item)} style={getActionLinkStyle("view")}>
                        <Eye size={12} /> View
                      </button>
                      <button onClick={() => onAppend(item)} style={getActionLinkStyle("append")}>
                        <PlusCircle size={12} /> Append
                      </button>
                      <button onClick={() => handleEditClick(item)} style={getActionLinkStyle("edit")}>
                        <Edit3 size={12} /> Edit
                      </button>
                      <button onClick={() => setPrintModalItem(item)} style={getActionLinkStyle("print")}>
                        <Printer size={12} /> Print
                      </button>
                      <button onClick={() => handleDeleteClick(item)} style={getActionLinkStyle("delete")}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination page={page} total={total} limit={limit} onPage={onPage} />
        </div>
      ) : (
        /* ─── DESKTOP ENTERPRISE TABLE VIEW ───────────────────────── */
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            <div className="resp-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 200 }}>Item Name & SKU</th>
                    <th>Category</th>
                    <th style={{ minWidth: 160 }}>Rack Loading Position</th>
                    <th style={{ minWidth: 120, textAlign: "right" }}>Stock Available</th>
                    <th style={{ minWidth: 140 }}>Vendor / Supplier</th>
                    <th style={{ textAlign: "right" }}>Unit Cost</th>
                    <th style={{ textAlign: "right" }}>Valuation</th>
                    <th style={{ minWidth: 130 }}>Entry Time</th>
                    <th>Batch & Expiry</th>
                    {!readOnly && <th style={{ textAlign: "right", minWidth: 76 }}>Actions</th>}
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
                        background: isLow ? "rgba(239, 68, 68, 0.06)" : "transparent",
                        transition: "background 0.15s ease"
                      }}>
                        {/* 1. Item Name & SKU with Initials Avatar */}
                        <td style={{ fontWeight: 500, borderLeft: isLow ? `3px solid ${COLORS.danger}` : "3px solid transparent", paddingLeft: 11 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {(() => {
                              const avatar = getInitialsAvatar(item.name);
                              return (
                                <div style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: "50%",
                                  background: avatar.bg,
                                  color: avatar.fg,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                  opacity: 0.85
                                }}>
                                  {avatar.text}
                                </div>
                              );
                            })()}
                            <div>
                              <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); onView(item.batches ? item.batches[0] : item); }}
                                style={{
                                  color: "#b45309",
                                  fontSize: 11.5,
                                  display: "inline-block",
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  textDecoration: "underline",
                                  textUnderlineOffset: "2px",
                                  cursor: "pointer"
                                }}
                                title="Click to view full item audit dossier"
                              >
                                {item.item_code || "KPL-STK"}
                              </a>
                              <span 
                                onClick={() => onView(item.batches ? item.batches[0] : item)}
                                style={{
                                  fontSize: "13.5px",
                                  color: "var(--text-main)",
                                  display: "block",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  marginTop: 1,
                                  transition: "color 0.15s ease"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = "#d97706"}
                                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-main)"}
                                title="Click to view full item dossier"
                              >
                                {item.name}
                              </span>
                              {isLow && (
                                <span style={{ color: "#dc2626", fontSize: 10, display: "flex", alignItems: "center", gap: 3, marginTop: 2, fontWeight: 700, letterSpacing: "0.04em" }}>
                                  <AlertCircle size={10} /> LOW STOCK
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Category */}
                        <td>
                          {item.category
                            ? <span className="chip" style={{ fontSize: 11, fontWeight: 600, color: "#334155", background: "#f1f5f9", border: "1px solid #cbd5e1", cursor: "default" }}>{item.category}</span>
                            : <span style={{ color: COLORS.muted, fontSize: 11 }}>—</span>}
                        </td>

                        {/* 3. Rack Loading Positioning */}
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-main)", fontSize: 12.5, fontWeight: 600 }}>
                              <MapPin size={13} style={{ color: "#d97706", flexShrink: 0 }} />
                              <span>{item.rack_location || "Unassigned Rack"}</span>
                            </div>
                            <span style={{ fontSize: 11, color: "#475569", paddingLeft: 18, fontWeight: 500 }}>
                              {item.storage_zone || "General Storage"}
                            </span>
                          </div>
                        </td>

                        {/* 4. Stock Available */}
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 5, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: color === "#10b981" ? "#047857" : color === "#f59e0b" ? "#b45309" : "#dc2626" }}>
                              {parseFloat(item.remaining || 0).toFixed(2)}
                            </span>
                            <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 600 }}>{item.unit}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                            <UnitDimensionBadge unit={item.unit} compact />
                          </div>
                          <div style={{ height: 5, background: "rgba(15, 23, 42, 0.08)", borderRadius: 3, width: 90, overflow: "hidden", marginLeft: "auto" }}>
                            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 2, width: 90, marginLeft: "auto", fontWeight: 500 }}>
                            <span>Orig: {parseFloat(item.qty || 0).toFixed(1)}</span>
                            <span>{pct.toFixed(0)}%</span>
                          </div>
                        </td>

                        {/* 5. Vendor / Supplier */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Building2 size={13} style={{ color: "#2563eb", flexShrink: 0 }} />
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: item.supplier ? "var(--text-main)" : "var(--text-muted)" }}>
                              {item.supplier || "Direct Vendor"}
                            </span>
                          </div>
                          {item.invoice_no && (
                            <div style={{ fontSize: 10.5, color: "#475569", marginTop: 2, paddingLeft: 19, fontWeight: 500 }}>
                              Inv: #{item.invoice_no}
                            </div>
                          )}
                        </td>

                        {/* 6. Unit Cost */}
                        <td style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 600, textAlign: "right" }}>
                          {item.price ? `₹${parseFloat(item.price).toFixed(2)} / ${item.unit}` : "—"}
                        </td>

                        {/* 7. Total Valuation */}
                        <td style={{ textAlign: "right" }}>
                          {item.price ? (
                            <>
                              <span style={{ fontWeight: 700, color: color === "#10b981" ? "#047857" : color === "#f59e0b" ? "#b45309" : "#dc2626", fontSize: 13.5 }}>
                                ₹{remCost.toFixed(2)}
                              </span>
                              <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)", marginTop: 1, fontWeight: 500 }}>
                                of ₹{origCost.toFixed(2)}
                              </span>
                            </>
                          ) : "—"}
                        </td>

                        {/* 8. Purchase / Entry Time */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#334155", fontWeight: 500 }}>
                            <Clock size={12} style={{ color: "#7c3aed", flexShrink: 0 }} />
                            <span>{formatDateTime(item.date, item.purchase_time)}</span>
                          </div>
                        </td>

                        {/* 9. Batch & Expiry */}
                        <td>
                          {item.batch_no && (
                            <div style={{ fontFamily: "monospace", fontSize: 10.5, color: "#7e22ce", background: "#f3e8ff", border: "1px solid #e9d5ff", padding: "2px 6px", borderRadius: 4, display: "inline-block", marginBottom: 3, fontWeight: 600 }}>
                              {item.batch_no}
                            </div>
                          )}
                          <div>{getExpiryBadge(item.expiry_date) || <span style={{ color: COLORS.muted, fontSize: 11 }}>—</span>}</div>
                        </td>

                        {/* 10. Operations & Action Hyperlinks */}
                        {!readOnly && (
                          <td style={{ textAlign: "right" }}>
                            <RowActions
                              onView={() => onView(item.batches ? item.batches[0] : item)}
                              viewTitle="View 360° Stock Details & Batches"
                              menuItems={[
                                { icon: <Edit3 size={13} />, label: "Edit Item", onClick: () => handleEditClick(item) },
                                { icon: <PlusCircle size={13} />, label: "Append Batch", onClick: () => onAppend(item) },
                                { icon: <Printer size={13} />, label: "Print Label", onClick: () => setPrintModalItem(item) },
                                { icon: <ClipboardList size={13} />, label: "Raise Indent", onClick: () => setIndentModalItem(item.batches ? item.batches[0] : item) },
                                { icon: <Trash2 size={13} />, label: "Decommission", onClick: () => handleDeleteClick(item), danger: true },
                              ]}
                            />
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

      {/* Chef Touch Raise Indent Modal */}
      {indentModalItem && (
        <RaiseIndentItemModal
          item={indentModalItem}
          isOpen={Boolean(indentModalItem)}
          onClose={() => setIndentModalItem(null)}
          onSuccess={() => setIndentModalItem(null)}
        />
      )}
    </>
  );
}
