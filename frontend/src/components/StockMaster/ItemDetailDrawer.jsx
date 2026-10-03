import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import Btn from "../Btn";
import * as api from "../../api";
import UnitDimensionBadge from "../UnitDimensionBadge";
import {
  X, MapPin, Building2, Calendar, Clock, DollarSign,
  Package, AlertTriangle, CheckCircle, Printer, Edit3,
  PlusCircle, FileText, ArrowRight, Layers, Tag, ShieldCheck,
  TrendingDown, TrendingUp, RefreshCw, ShoppingCart, ClipboardList
} from "lucide-react";
import RaiseIndentItemModal from "../chef/RaiseIndentItemModal";

export default function ItemDetailDrawer({
  isOpen,
  onClose,
  itemId,
  item: propItem,
  onEdit,
  onEditItem,
  onAppend,
  onAppendBatch,
  onPrint,
  onPrintItem
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // "overview", "movements", "issuances_indents", "batches"
  const [raiseIndentOpen, setRaiseIndentOpen] = useState(false);

  const effectiveOpen = isOpen !== undefined ? Boolean(isOpen) : Boolean(propItem);
  const effectiveItemId = itemId || propItem?.id;

  useEffect(() => {
    if (effectiveOpen && effectiveItemId) {
      loadDetails(effectiveItemId);
    } else {
      setData(null);
      setActiveTab("overview");
    }
  }, [effectiveOpen, effectiveItemId]);

  const loadDetails = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.stock.details(id);
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load item details.");
    } finally {
      setLoading(false);
    }
  };

  if (!effectiveOpen) return null;

  const item = data?.item || propItem;
  const batches = data?.batches || [];
  const recentIssuances = data?.recentIssuances || [];
  const recentIndents = data?.recentIndents || [];
  const movements = data?.movements || [];
  const supplier = data?.supplierDetails;

  const handleEdit = onEditItem || onEdit;
  const handleAppend = onAppendBatch || onAppend;
  const handlePrint = onPrintItem || onPrint;

  const formatDateTime = (ts) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return String(ts);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const remaining = parseFloat(data?.totalRemaining !== undefined ? data.totalRemaining : (item?.remaining || 0));
  const reorder = parseFloat(item?.min_alert_qty || 0);
  const price = parseFloat(item?.price || 0);
  const totalValuation = parseFloat(data?.totalValuation || (remaining * price));

  let healthBadge = { label: "Healthy Stock", bg: "rgba(16, 185, 129, 0.15)", fg: "#34d399", border: "rgba(16, 185, 129, 0.3)" };
  if (remaining <= 0) {
    healthBadge = { label: "Stock Depleted", bg: "rgba(239, 68, 68, 0.15)", fg: "#f87171", border: "rgba(239, 68, 68, 0.3)" };
  } else if (reorder > 0 && remaining <= reorder) {
    healthBadge = { label: "Low Stock Alert", bg: "rgba(245, 158, 11, 0.15)", fg: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" };
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "drawerBackdropFade 0.25s ease-out"
      }}
      onClick={onClose}
    >
      <style>
        {`
          @keyframes drawerBackdropFade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalPopUp {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}
      </style>
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          background: "var(--bg-modal)",
          border: "1px solid var(--color-gold-glow)",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
          overflowY: "auto",
          animation: "modalPopUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 12.5,
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fde68a",
                  padding: "3px 9px",
                  borderRadius: 6
                }}
              >
                {item?.item_code || "KPL-SKU"}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  padding: "3px 9px",
                  borderRadius: 12
                }}
              >
                {item?.category || "General"}
              </span>
              {item?.unit && <UnitDimensionBadge unit={item.unit} />}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  background: healthBadge.bg,
                  color: healthBadge.fg,
                  border: `1px solid ${healthBadge.border}`,
                  padding: "3px 9px",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                {healthBadge.label}
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: "#0f172a",
                fontFamily: "var(--font-sans)",
                letterSpacing: "-0.015em"
              }}
            >
              {item?.name || "Loading Item..."}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                color: "#334155",
                borderRadius: 8,
                padding: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#0f172a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#334155"; }}
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Dossier Tabs Navigation */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "8px 24px",
            background: "#0f172a",
            borderBottom: "1px solid #1e293b",
            overflowX: "auto"
          }}
        >
          {[
            { id: "overview", label: "360° Overview", icon: <Layers size={14} /> },
            {
              id: "issuances_indents",
              label: `Issuances & Indents (${recentIssuances.length + recentIndents.length})`,
              icon: <FileText size={14} />
            },
            {
              id: "movements",
              label: `Stock Ledger Movements (${movements.length})`,
              icon: <RefreshCw size={14} />
            },
            {
              id: "batches",
              label: `Active Batches (${batches.length})`,
              icon: <Layers size={14} />
            }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? "rgba(244, 200, 75, 0.2)" : "transparent",
                color: activeTab === tab.id ? "#facc15" : "#cbd5e1",
                border: activeTab === tab.id ? "1px solid rgba(244, 200, 75, 0.45)" : "1px solid transparent",
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                whiteSpace: "nowrap",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = "#cbd5e1";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              <div className="spin" style={{ display: "inline-block", marginBottom: 12 }}>
                <Layers size={32} style={{ color: "var(--color-gold)" }} />
              </div>
              <p style={{ margin: 0, fontSize: 14 }}>Fetching 360° warehouse telemetry for SKU...</p>
            </div>
          ) : error ? (
            <div
              style={{
                padding: 16,
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#f87171",
                borderRadius: 8
              }}
            >
              {error}
            </div>
          ) : item ? (
            <>
              {/* Quick Actions Bar */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  background: "var(--bg-card)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)"
                }}
              >
                <Btn
                  variant="primary"
                  icon={<ClipboardList size={14} />}
                  onClick={() => setRaiseIndentOpen(true)}
                  style={{
                    fontSize: 12,
                    padding: "6px 14px",
                    background: "linear-gradient(135deg, #e8a838 0%, #b45309 100%)",
                    color: "#080c14",
                    fontWeight: 800,
                    border: "none",
                    boxShadow: "0 2px 8px rgba(232, 168, 56, 0.35)"
                  }}
                >
                  Raise Indent
                </Btn>
                <Btn
                  variant="primary"
                  icon={<PlusCircle size={14} />}
                  onClick={() => handleAppend && handleAppend(item)}
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  Append Stock-In
                </Btn>
                <Btn
                  variant="secondary"
                  icon={<Edit3 size={14} />}
                  onClick={() => handleEdit && handleEdit(item)}
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  Edit Item
                </Btn>
                <Btn
                  variant="secondary"
                  icon={<Printer size={14} />}
                  onClick={() => handlePrint && handlePrint(item)}
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  Print Label / QR
                </Btn>
              </div>

              {/* TAB 1: 360° OVERVIEW */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* KPI Metrics Strip */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: 11.5, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>Available Stock</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 4, display: "flex", alignItems: "baseline", gap: 6 }}>
                        {remaining.toLocaleString()} <span style={{ fontSize: 15, color: "#b45309", fontWeight: 700 }}>{item.unit}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 500 }}>
                        Reorder Point: {reorder > 0 ? `${reorder} ${item.unit}` : "Not configured"}
                      </div>
                    </div>

                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: 11.5, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>Unit Rate</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                        ₹{price.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 500 }}>
                        Base purchase price per {item.unit}
                      </div>
                    </div>

                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: 11.5, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>Total Valuation</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#059669", marginTop: 4 }}>
                        ₹{totalValuation.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 500 }}>
                        Across {batches.length} active batch(es)
                      </div>
                    </div>
                  </div>

                  {/* Warehouse Rack Loading Position Card */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #bfdbfe",
                      borderRadius: 10,
                      padding: "16px 20px"
                    }}
                  >
                    <h4 style={{ margin: "0 0 14px 0", fontSize: 14, fontWeight: 700, color: "#1e40af", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.01em" }}>
                      <MapPin size={17} style={{ color: "#2563eb" }} /> Warehouse Loading Coordinates & Facility
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11.5, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>Storage Zone</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                          {item.storage_zone || "General Store & Provisions"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11.5, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>Rack Loading Position</div>
                        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "4px 12px", borderRadius: 6, fontWeight: 700, fontSize: 13.5 }}>
                            {item.rack_location || "Unassigned Rack"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vendor & Entry Telemetry */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "16px 20px"
                    }}
                  >
                    <h4 style={{ margin: "0 0 14px 0", fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.01em" }}>
                      <Building2 size={17} style={{ color: "#d97706" }} /> Supplier & Inward Entry Audit
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 11.5, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>Primary Supplier</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                          {item.supplier || supplier?.name || "Direct Vendor"}
                        </div>
                        {supplier?.phone && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, fontWeight: 500 }}>Contact: {supplier.phone}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 11.5, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>Invoice / Bill Reference</div>
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: "monospace", background: "#f1f5f9", padding: "4px 8px", borderRadius: 5, border: "1px solid #cbd5e1", display: "inline-block" }}>
                            {item.invoice_no || "INV-GEN-DIRECT"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11.5, color: "#475569", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>Receipt Time</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginTop: 4 }}>
                          {formatDateTime(item.purchase_time || item.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ISSUANCES & INDENTS */}
              {activeTab === "issuances_indents" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Department Issuances */}
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.01em" }}>
                        <TrendingDown size={17} style={{ color: "#dc2626" }} /> Kitchen & Department Issuance Traceability
                      </h4>
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{recentIssuances.length} recent issuances</span>
                    </div>

                    {recentIssuances.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>No departmental issuances recorded yet for this item.</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#475569", background: "#f8fafc", textAlign: "left" }}>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Ref #</th>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Date</th>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Department</th>
                              <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Issued Qty</th>
                              <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Unit Rate</th>
                              <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Total Value</th>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Operational Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentIssuances.map((iss, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "#92400e", fontWeight: 700 }}>
                                  {iss.reference_no}
                                </td>
                                <td style={{ padding: "10px 8px", color: "#334155", fontWeight: 500 }}>
                                  {formatDate(iss.date)}
                                </td>
                                <td style={{ padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                                  {iss.dept}
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                                  -{parseFloat(iss.issued_qty).toFixed(2)} {iss.unit}
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", color: "#0f172a", fontWeight: 600 }}>
                                  ₹{parseFloat(iss.unit_price).toFixed(2)}
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                                  ₹{parseFloat(iss.total_value).toFixed(2)}
                                </td>
                                <td style={{ padding: "10px 8px", color: "#64748b", fontSize: 12 }}>
                                  {iss.notes || "Standard kitchen consumption"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Department Indents */}
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.01em" }}>
                        <ShoppingCart size={17} style={{ color: "#2563eb" }} /> Department Indents & Requisitions
                      </h4>
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{recentIndents.length} recent indents</span>
                    </div>

                    {recentIndents.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>No department indents raised yet for this item.</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#475569", background: "#f8fafc", textAlign: "left" }}>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Indent #</th>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Date</th>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Department</th>
                              <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Requested</th>
                              <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Est. Value</th>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Status</th>
                              <th style={{ padding: "10px 8px", fontWeight: 700 }}>Remarks / Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentIndents.map((ind, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "#1d4ed8", fontWeight: 700 }}>
                                  {ind.reference_no}
                                </td>
                                <td style={{ padding: "10px 8px", color: "#334155", fontWeight: 500 }}>
                                  {formatDate(ind.date)}
                                </td>
                                <td style={{ padding: "10px 8px", fontWeight: 700, color: "#0f172a" }}>
                                  {ind.dept}
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#b45309" }}>
                                  {parseFloat(ind.requested_qty).toFixed(2)} {ind.unit}
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                                  ₹{parseFloat(ind.estimated_value).toFixed(2)}
                                </td>
                                <td style={{ padding: "10px 8px" }}>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "3px 8px",
                                      borderRadius: 5,
                                      textTransform: "uppercase",
                                      background: ind.status === "approved" || ind.status === "issued" ? "#ecfdf5" : "#fef3c7",
                                      color: ind.status === "approved" || ind.status === "issued" ? "#047857" : "#b45309",
                                      border: ind.status === "approved" || ind.status === "issued" ? "1px solid #a7f3d0" : "1px solid #fde68a"
                                    }}
                                  >
                                    {ind.status}
                                  </span>
                                </td>
                                <td style={{ padding: "10px 8px", color: "#64748b", fontSize: 12 }}>
                                  {ind.notes || "Routine requisition"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: STOCK LEDGER MOVEMENTS */}
              {activeTab === "movements" && (
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.01em" }}>
                      <RefreshCw size={17} style={{ color: "#2563eb" }} /> Double-Entry Movement Ledger ({movements.length} Transactions)
                    </h4>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Chronological order</span>
                  </div>

                  {movements.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>No ledger movements recorded yet.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#475569", background: "#f8fafc", textAlign: "left" }}>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Time</th>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Type</th>
                            <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Qty</th>
                            <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Rate</th>
                            <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Total Value</th>
                            <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Balance After</th>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Party / Dept</th>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Ref #</th>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Notes / Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movements.map((m) => {
                            const isOut = ["OUTWARD_ISSUE", "ADJUSTMENT_DEDUCT", "RETURN_TO_VENDOR"].includes(m.transaction_type);
                            return (
                              <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "10px 8px", color: "#334155", fontWeight: 500, fontSize: 11.5 }}>
                                  {formatDateTime(m.created_at)}
                                </td>
                                <td style={{ padding: "10px 8px" }}>
                                  <span
                                    style={{
                                      fontFamily: "monospace",
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: "3px 6px",
                                      borderRadius: 4,
                                      background: isOut ? "#fef2f2" : "#ecfdf5",
                                      color: isOut ? "#dc2626" : "#047857",
                                      border: isOut ? "1px solid #fecaca" : "1px solid #a7f3d0"
                                    }}
                                  >
                                    {m.transaction_type}
                                  </span>
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: isOut ? "#dc2626" : "#047857" }}>
                                  {isOut ? "-" : "+"}{parseFloat(m.qty).toFixed(2)} {m.unit}
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", color: "#0f172a", fontWeight: 600 }}>
                                  ₹{parseFloat(m.unit_price || 0).toFixed(2)}
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: isOut ? "#dc2626" : "#047857" }}>
                                  ₹{parseFloat(m.total_value || 0).toFixed(2)}
                                </td>
                                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                                  {parseFloat(m.balance_qty_after || 0).toFixed(2)} {m.unit}
                                </td>
                                <td style={{ padding: "10px 8px", color: "#0f172a", fontWeight: 600 }}>
                                  {m.department || m.supplier || "Central Store"}
                                </td>
                                <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "#92400e", fontWeight: 700 }}>
                                  {m.reference_doc_no || m.reference_doc_type || "—"}
                                </td>
                                <td style={{ padding: "10px 8px", color: "#64748b", fontSize: 12 }}>
                                  {m.notes || m.reason || "Standard entry"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ACTIVE BATCHES */}
              {activeTab === "batches" && (
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.01em" }}>
                      <Layers size={17} style={{ color: "#059669" }} /> Active Batch Breakdown ({batches.length} Batches)
                    </h4>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>FEFO Depletion Order</span>
                  </div>

                  {batches.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>No active warehouse batches found.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#475569", background: "#f8fafc", textAlign: "left" }}>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Batch #</th>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Date</th>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Expiry</th>
                            <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Remaining</th>
                            <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Rate</th>
                            <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>Batch Valuation</th>
                            <th style={{ padding: "10px 8px", fontWeight: 700 }}>Rack Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batches.map((b) => (
                            <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "#92400e", fontWeight: 700 }}>
                                {b.batch_no || `BAT-${b.id}`}
                              </td>
                              <td style={{ padding: "10px 8px", color: "#334155", fontWeight: 500 }}>
                                {b.date ? formatDate(b.date) : "—"}
                              </td>
                              <td style={{ padding: "10px 8px" }}>
                                {b.expiry_date ? (
                                  <span style={{ color: new Date(b.expiry_date) < new Date() ? "#dc2626" : "#059669", fontWeight: 700 }}>
                                    {formatDate(b.expiry_date)}
                                  </span>
                                ) : (
                                  <span style={{ color: "#64748b", fontWeight: 500 }}>Non-perishable</span>
                                )}
                              </td>
                              <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                                {parseFloat(b.remaining).toFixed(2)} {b.unit}
                              </td>
                              <td style={{ padding: "10px 8px", textAlign: "right", color: "#0f172a", fontWeight: 600 }}>
                                ₹{parseFloat(b.price || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                                ₹{(parseFloat(b.remaining) * parseFloat(b.price || 0)).toFixed(2)}
                              </td>
                              <td style={{ padding: "10px 8px", color: "#92400e", fontWeight: 600 }}>
                                {b.rack_location || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Chef Touch Raise Indent Modal */}
      {raiseIndentOpen && (
        <RaiseIndentItemModal
          item={item}
          isOpen={raiseIndentOpen}
          onClose={() => setRaiseIndentOpen(false)}
          onSuccess={() => {
            setRaiseIndentOpen(false);
            if (effectiveItemId) loadDetails(effectiveItemId);
          }}
        />
      )}
    </div>
  );
}
