import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import Btn from "../Btn";
import * as api from "../../api";
import UnitDimensionBadge from "../UnitDimensionBadge";
import {
  X, MapPin, Building2, Calendar, Clock, DollarSign,
  Package, AlertTriangle, CheckCircle, Printer, Edit3,
  PlusCircle, FileText, ArrowRight, Layers, Tag, ShieldCheck,
  TrendingDown, TrendingUp, RefreshCw, ShoppingCart
} from "lucide-react";

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
                  fontSize: 13,
                  background: "var(--color-gold-dim)",
                  color: "var(--color-gold)",
                  border: "1px solid rgba(232, 168, 56, 0.4)",
                  padding: "2px 8px",
                  borderRadius: 4
                }}
              >
                {item?.item_code || "KPL-SKU"}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "var(--color-info)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  padding: "2px 8px",
                  borderRadius: 12
                }}
              >
                {item?.category || "General"}
              </span>
              {item?.unit && <UnitDimensionBadge unit={item.unit} />}
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: healthBadge.bg,
                  color: healthBadge.fg,
                  border: `1px solid ${healthBadge.border}`,
                  padding: "2px 8px",
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
                fontWeight: 700,
                color: "var(--text-main)",
                fontFamily: "'DM Serif Display', Georgia, serif"
              }}
            >
              {item?.name || "Loading Item..."}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: "var(--border-color)",
                border: "1px solid var(--border-color)",
                color: "#cbd5e1",
                borderRadius: 8,
                padding: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Dossier Tabs Navigation */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "8px 24px",
            background: "#111827",
            borderBottom: "1px solid var(--border-color)",
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
                background: activeTab === tab.id ? "var(--color-gold-dim)" : "transparent",
                color: activeTab === tab.id ? "var(--color-gold)" : "var(--text-muted)",
                border: activeTab === tab.id ? "1px solid var(--color-gold-glow)" : "1px solid transparent",
                borderRadius: 6,
                padding: "7px 12px",
                fontSize: 12.5,
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                transition: "all 0.15s ease"
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Available Stock</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>
                        {remaining.toLocaleString()} <span style={{ fontSize: 14, color: "var(--color-gold)", fontWeight: 500 }}>{item.unit}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        Reorder Point: {reorder > 0 ? `${reorder} ${item.unit}` : "Not configured"}
                      </div>
                    </div>

                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Unit Rate</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>
                        ₹{price.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        Base purchase price per {item.unit}
                      </div>
                    </div>

                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Valuation</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#4ade80", marginTop: 4 }}>
                        ₹{totalValuation.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        Across {batches.length} active batch(es)
                      </div>
                    </div>
                  </div>

                  {/* Warehouse Rack Loading Position Card */}
                  <div
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      borderRadius: 10,
                      padding: "16px 20px"
                    }}
                  >
                    <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "#93c5fd", display: "flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={16} style={{ color: "var(--color-info)" }} /> Warehouse Loading Coordinates & Facility
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Storage Zone</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginTop: 4 }}>
                          {item.storage_zone || "General Store & Provisions"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Rack Loading Position</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-gold)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ background: "var(--color-gold-dim)", padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(232, 168, 56, 0.4)" }}>
                            {item.rack_location || "Unassigned Rack"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vendor & Entry Telemetry */}
                  <div
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 10,
                      padding: "16px 20px"
                    }}
                  >
                    <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Building2 size={16} style={{ color: "var(--color-gold)" }} /> Supplier & Inward Entry Audit
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Primary Supplier</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)", marginTop: 3 }}>
                          {item.supplier || supplier?.name || "Direct Vendor"}
                        </div>
                        {supplier?.phone && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Contact: {supplier.phone}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Invoice / Bill Reference</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginTop: 3 }}>
                          {item.invoice_no || "INV-GEN-DIRECT"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Receipt Time</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-info)", marginTop: 3 }}>
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
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                        <TrendingDown size={16} style={{ color: "#f87171" }} /> Kitchen & Department Issuance Traceability
                      </h4>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{recentIssuances.length} recent issuances</span>
                    </div>

                    {recentIssuances.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No departmental issuances recorded yet for this item.</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                              <th style={{ padding: "8px 6px" }}>Ref #</th>
                              <th style={{ padding: "8px 6px" }}>Date</th>
                              <th style={{ padding: "8px 6px" }}>Department</th>
                              <th style={{ padding: "8px 6px", textAlign: "right" }}>Issued Qty</th>
                              <th style={{ padding: "8px 6px", textAlign: "right" }}>Unit Rate</th>
                              <th style={{ padding: "8px 6px", textAlign: "right" }}>Total Value</th>
                              <th style={{ padding: "8px 6px" }}>Operational Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentIssuances.map((iss, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "var(--color-gold)", fontWeight: 700 }}>
                                  {iss.reference_no}
                                </td>
                                <td style={{ padding: "8px 6px", color: "#cbd5e1" }}>
                                  {formatDate(iss.date)}
                                </td>
                                <td style={{ padding: "8px 6px", fontWeight: 600, color: "var(--text-main)" }}>
                                  {iss.dept}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#f87171" }}>
                                  -{parseFloat(iss.issued_qty).toFixed(2)} {iss.unit}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", color: "#cbd5e1" }}>
                                  ₹{parseFloat(iss.unit_price).toFixed(2)}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#f87171" }}>
                                  ₹{parseFloat(iss.total_value).toFixed(2)}
                                </td>
                                <td style={{ padding: "8px 6px", color: "var(--text-muted)", fontSize: 11.5 }}>
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
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                        <ShoppingCart size={16} style={{ color: "var(--color-info)" }} /> Department Indents & Requisitions
                      </h4>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{recentIndents.length} recent indents</span>
                    </div>

                    {recentIndents.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No department indents raised yet for this item.</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                              <th style={{ padding: "8px 6px" }}>Indent #</th>
                              <th style={{ padding: "8px 6px" }}>Date</th>
                              <th style={{ padding: "8px 6px" }}>Department</th>
                              <th style={{ padding: "8px 6px", textAlign: "right" }}>Requested</th>
                              <th style={{ padding: "8px 6px", textAlign: "right" }}>Est. Value</th>
                              <th style={{ padding: "8px 6px" }}>Status</th>
                              <th style={{ padding: "8px 6px" }}>Remarks / Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentIndents.map((ind, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "var(--color-info)", fontWeight: 700 }}>
                                  {ind.reference_no}
                                </td>
                                <td style={{ padding: "8px 6px", color: "#cbd5e1" }}>
                                  {formatDate(ind.date)}
                                </td>
                                <td style={{ padding: "8px 6px", fontWeight: 600, color: "var(--text-main)" }}>
                                  {ind.dept}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#facc15" }}>
                                  {parseFloat(ind.requested_qty).toFixed(2)} {ind.unit}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#4ade80" }}>
                                  ₹{parseFloat(ind.estimated_value).toFixed(2)}
                                </td>
                                <td style={{ padding: "8px 6px" }}>
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      textTransform: "uppercase",
                                      background: ind.status === "approved" || ind.status === "issued" ? "rgba(74, 222, 128, 0.15)" : "rgba(250, 204, 21, 0.15)",
                                      color: ind.status === "approved" || ind.status === "issued" ? "#4ade80" : "#facc15",
                                      border: ind.status === "approved" || ind.status === "issued" ? "1px solid rgba(74, 222, 128, 0.3)" : "1px solid rgba(250, 204, 21, 0.3)"
                                    }}
                                  >
                                    {ind.status}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 6px", color: "var(--text-muted)", fontSize: 11.5 }}>
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
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                      <RefreshCw size={16} style={{ color: "var(--color-info)" }} /> Double-Entry Movement Ledger ({movements.length} Transactions)
                    </h4>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Chronological order</span>
                  </div>

                  {movements.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No ledger movements recorded yet.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                            <th style={{ padding: "8px 6px" }}>Time</th>
                            <th style={{ padding: "8px 6px" }}>Type</th>
                            <th style={{ padding: "8px 6px", textAlign: "right" }}>Qty</th>
                            <th style={{ padding: "8px 6px", textAlign: "right" }}>Rate</th>
                            <th style={{ padding: "8px 6px", textAlign: "right" }}>Total Value</th>
                            <th style={{ padding: "8px 6px", textAlign: "right" }}>Balance After</th>
                            <th style={{ padding: "8px 6px" }}>Party / Dept</th>
                            <th style={{ padding: "8px 6px" }}>Ref #</th>
                            <th style={{ padding: "8px 6px" }}>Notes / Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movements.map((m) => {
                            const isOut = ["OUTWARD_ISSUE", "ADJUSTMENT_DEDUCT", "RETURN_TO_VENDOR"].includes(m.transaction_type);
                            return (
                              <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                <td style={{ padding: "8px 6px", color: "#cbd5e1" }}>
                                  {formatDateTime(m.created_at)}
                                </td>
                                <td style={{ padding: "8px 6px" }}>
                                  <span
                                    style={{
                                      fontFamily: "monospace",
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: isOut ? "rgba(239, 68, 68, 0.15)" : "rgba(74, 222, 128, 0.15)",
                                      color: isOut ? "#f87171" : "#4ade80",
                                      border: isOut ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(74, 222, 128, 0.3)"
                                    }}
                                  >
                                    {m.transaction_type}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: isOut ? "#f87171" : "#4ade80" }}>
                                  {isOut ? "-" : "+"}{parseFloat(m.qty).toFixed(2)} {m.unit}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", color: "#cbd5e1" }}>
                                  ₹{parseFloat(m.unit_price || 0).toFixed(2)}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: isOut ? "#f87171" : "#4ade80" }}>
                                  ₹{parseFloat(m.total_value || 0).toFixed(2)}
                                </td>
                                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "var(--text-main)" }}>
                                  {parseFloat(m.balance_qty_after || 0).toFixed(2)} {m.unit}
                                </td>
                                <td style={{ padding: "8px 6px", color: "var(--text-main)", fontWeight: 500 }}>
                                  {m.department || m.supplier || "Central Store"}
                                </td>
                                <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "var(--color-gold)" }}>
                                  {m.reference_doc_no || m.reference_doc_type || "—"}
                                </td>
                                <td style={{ padding: "8px 6px", color: "var(--text-muted)", fontSize: 11 }}>
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
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Layers size={16} style={{ color: "#4ade80" }} /> Active Batch Breakdown ({batches.length} Batches)
                    </h4>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>FEFO Depletion Order</span>
                  </div>

                  {batches.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No active warehouse batches found.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                            <th style={{ padding: "8px 6px" }}>Batch #</th>
                            <th style={{ padding: "8px 6px" }}>Date</th>
                            <th style={{ padding: "8px 6px" }}>Expiry</th>
                            <th style={{ padding: "8px 6px", textAlign: "right" }}>Remaining</th>
                            <th style={{ padding: "8px 6px", textAlign: "right" }}>Rate</th>
                            <th style={{ padding: "8px 6px", textAlign: "right" }}>Batch Valuation</th>
                            <th style={{ padding: "8px 6px" }}>Rack Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batches.map((b) => (
                            <tr key={b.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                              <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "var(--color-gold)", fontWeight: 700 }}>
                                {b.batch_no || `BAT-${b.id}`}
                              </td>
                              <td style={{ padding: "8px 6px", color: "#cbd5e1" }}>
                                {b.date ? formatDate(b.date) : "—"}
                              </td>
                              <td style={{ padding: "8px 6px" }}>
                                {b.expiry_date ? (
                                  <span style={{ color: new Date(b.expiry_date) < new Date() ? "#f87171" : "#4ade80", fontWeight: 600 }}>
                                    {formatDate(b.expiry_date)}
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>Non-perishable</span>
                                )}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "var(--text-main)" }}>
                                {parseFloat(b.remaining).toFixed(2)} {b.unit}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: "#cbd5e1" }}>
                                ₹{parseFloat(b.price || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#4ade80" }}>
                                ₹{(parseFloat(b.remaining) * parseFloat(b.price || 0)).toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 6px", color: "var(--color-gold)", fontSize: 11.5 }}>
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
    </div>
  );
}
