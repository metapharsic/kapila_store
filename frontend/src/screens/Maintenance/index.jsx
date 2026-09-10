import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { maintenance, departments as deptApi } from "../../api";
import { 
  Wrench, AlertTriangle, Calendar, BarChart3, Plus, Download, 
  Search, ShieldCheck, CheckCircle2, Clock, FileSpreadsheet, RefreshCw, 
  Tag, ExternalLink, QrCode
} from "lucide-react";
import ReportBreakdownModal from "./ReportBreakdownModal";
import RegisterAssetModal from "./RegisterAssetModal";
import ConsumePartsModal from "./ConsumePartsModal";
import CompleteWorkOrderModal from "./CompleteWorkOrderModal";

export default function MaintenanceScreen() {
  const [activeTab, setActiveTab] = useState("assets"); // "assets", "work_orders", "schedules", "analytics"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Data states
  const [assets, setAssets] = useState([]);
  const [assetStats, setAssetStats] = useState({ total: 0, operational: 0, breakdown: 0, underMaintenance: 0 });
  const [workOrders, setWorkOrders] = useState([]);
  const [woSummary, setWoSummary] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [departmentsList, setDepartmentsList] = useState([]);

  // Filters
  const [assetSearch, setAssetSearch] = useState("");
  const [assetDeptFilter, setAssetDeptFilter] = useState("");
  const [woStatusFilter, setWoStatusFilter] = useState("");
  const [woSearch, setWoSearch] = useState("");

  // Modals
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [isRegisterAssetModalOpen, setIsRegisterAssetModalOpen] = useState(false);
  const [selectedWoForParts, setSelectedWoForParts] = useState(null);
  const [selectedWoForComplete, setSelectedWoForComplete] = useState(null);
  const [qrModalAsset, setQrModalAsset] = useState(null);

  useEffect(() => {
    loadDepartments();
    loadActiveTabData();
  }, [activeTab]);

  const loadDepartments = async () => {
    try {
      const res = await deptApi.list();
      setDepartmentsList(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadActiveTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === "assets") {
        const res = await maintenance.listAssets({ q: assetSearch, department: assetDeptFilter });
        setAssets(res.rows || []);
        if (res.stats) setAssetStats(res.stats);
      } else if (activeTab === "work_orders") {
        const res = await maintenance.listWorkOrders({ q: woSearch, status: woStatusFilter });
        setWorkOrders(res.rows || []);
        if (res.summary) setWoSummary(res.summary);
      } else if (activeTab === "schedules") {
        const res = await maintenance.listSchedules();
        setSchedules(res.rows || []);
        if (res.summary) setScheduleSummary(res.summary);
      } else if (activeTab === "analytics") {
        const res = await maintenance.analytics();
        setAnalytics(res.data || null);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleReportBreakdown = async (payload) => {
    await maintenance.createWorkOrder(payload);
    setMsg("Breakdown ticket logged successfully! Equipment marked down.");
    setTimeout(() => setMsg(""), 4000);
    loadActiveTabData();
  };

  const handleRegisterAsset = async (payload) => {
    await maintenance.createAsset(payload);
    setMsg("Equipment asset registered into CMMS successfully!");
    setTimeout(() => setMsg(""), 4000);
    loadActiveTabData();
  };

  const handleConsumeParts = async (partsList) => {
    await maintenance.consumeParts(selectedWoForParts.id, partsList);
    setMsg("Store spare parts issued and deducted from inventory ledger ✓");
    setTimeout(() => setMsg(""), 4000);
    loadActiveTabData();
  };

  const handleCompleteWorkOrder = async (completionData) => {
    await maintenance.completeWorkOrder(selectedWoForComplete.id, completionData);
    setMsg("Work order closed! Equipment restored to OPERATIONAL status ✓");
    setTimeout(() => setMsg(""), 4000);
    loadActiveTabData();
  };

  const handleCompleteSchedule = async (scheduleId) => {
    if (!window.confirm("Mark this preventive maintenance routine as completed for today?")) return;
    try {
      await maintenance.completeSchedule(scheduleId, { action_taken: "Routine inspection completed" });
      setMsg("Preventive routine completed and next due date updated ✓");
      setTimeout(() => setMsg(""), 4000);
      loadActiveTabData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleExportExcel = async () => {
    try {
      setMsg("Generating and streaming CMMS Excel export...");
      await maintenance.exportExcel();
      setMsg("CMMS Excel exported successfully ✓");
      setTimeout(() => setMsg(""), 3500);
    } catch (err) {
      setMsg("Export failed: " + err.message);
      setTimeout(() => setMsg(""), 4000);
    }
  };

  // Status Badge helpers
  const renderStatusBadge = (status) => {
    const config = {
      OPERATIONAL: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
      BREAKDOWN: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
      UNDER_MAINTENANCE: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
      STANDBY: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.3)" },
      DECOMMISSIONED: { bg: "rgba(148, 163, 184, 0.15)", text: "var(--text-muted)", border: "rgba(148, 163, 184, 0.3)" },
      OPEN: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
      IN_PROGRESS: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
      PARTS_AWAITING: { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", border: "rgba(168, 85, 247, 0.3)" },
      COMPLETED: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" }
    }[status] || { bg: "rgba(148, 163, 184, 0.15)", text: "var(--text-muted)", border: "rgba(148, 163, 184, 0.3)" };

    return (
      <span style={{
        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: config.bg, color: config.text, border: `1px solid ${config.border}`,
        letterSpacing: "0.04em", display: "inline-block"
      }}>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const renderPriorityBadge = (priority) => {
    const config = {
      CRITICAL: { color: "#ef4444", label: "CRITICAL" },
      HIGH: { color: "#f97316", label: "HIGH" },
      MEDIUM: { color: "#eab308", label: "MEDIUM" },
      LOW: { color: "#10b981", label: "LOW" }
    }[priority] || { color: "var(--text-muted)", label: priority };

    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: config.color }}>
        ● {config.label}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, color: "var(--text-main)" }}>
      {/* Toast Notification */}
      {msg && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, background: "#10b98120",
          border: "1px solid #10b98150", color: "#10b981", fontSize: 13,
          fontWeight: 600, display: "flex", alignItems: "center", gap: 8
        }}>
          <CheckCircle2 size={16} /> {msg}
        </div>
      )}

      {/* Title & Action Bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        flexWrap: "wrap", gap: 16
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: "DM Serif Display, serif" }}>
              Commercial Kitchen & Facility CMMS
            </h1>
            <span style={{
              padding: "2px 8px", borderRadius: 6, background: "var(--color-gold-dim)",
              color: "var(--color-gold)", border: "1px solid rgba(232, 168, 56, 0.3)", fontSize: 11, fontWeight: 700
            }}>
              P2P SPARES LINKED
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Asset Registry, Breakdown Work Orders, Preventive Schedules & Store Inventory Ledger Integration
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setIsBreakdownModalOpen(true)}
            style={{
              padding: "9px 16px", borderRadius: 8, background: "#ef4444",
              border: "none", color: "#ffffff", fontWeight: 600, fontSize: 13,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
            }}
          >
            <AlertTriangle size={15} /> Report Breakdown
          </button>

          <button
            onClick={() => setIsRegisterAssetModalOpen(true)}
            style={{
              padding: "9px 16px", borderRadius: 8, background: "var(--color-gold)",
              border: "none", color: "var(--bg-modal)", fontWeight: 700, fontSize: 13,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            <Plus size={16} /> Add Equipment
          </button>

          <button
            onClick={handleExportExcel}
            style={{
              padding: "9px 16px", borderRadius: 8, background: "var(--bg-card)",
              border: "1px solid #334155", color: "var(--text-main)", fontWeight: 600, fontSize: 13,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            <FileSpreadsheet size={15} color="#10b981" /> Export CMMS (.xlsx)
          </button>
        </div>
      </div>

      {/* Top Telemetry Strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12
      }}>
        {/* Card 1: Equipment Health */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 6
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Operational Equipment
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>
              {assetStats.operational}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              / {assetStats.total} assets ({assetStats.total > 0 ? Math.round((assetStats.operational / assetStats.total) * 100) : 100}%)
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Commercial cold rooms, ranges & utilities
          </span>
        </div>

        {/* Card 2: Active Breakdowns */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 6
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Active Breakdown Tickets
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: assetStats.breakdown > 0 ? "#ef4444" : "var(--text-main)" }}>
              {assetStats.breakdown}
            </span>
            <span style={{ fontSize: 12, color: assetStats.breakdown > 0 ? "#ef4444" : "#10b981" }}>
              {assetStats.breakdown > 0 ? "Immediate Attention Required" : "All Lines Normal"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Open corrective maintenance tickets
          </span>
        </div>

        {/* Card 3: PM Routines Overdue */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 6
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Overdue PM Routines
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: (scheduleSummary.overdueCount || 0) > 0 ? "#f59e0b" : "#10b981" }}>
              {scheduleSummary.overdueCount || 0}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              routines ({scheduleSummary.dueThisWeekCount || 0} due this week)
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Condenser cleaning, hood degreasing & RO
          </span>
        </div>

        {/* Card 4: Total Maintenance Spend */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px",
          display: "flex", flexDirection: "column", gap: 6
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Maintenance Cost
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--color-gold)" }}>
              ₹{(woSummary.totalSpent || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Spares: ₹{(woSummary.totalPartsCost || 0).toFixed(0)} • Labor: ₹{(woSummary.totalLaborCost || 0).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: "flex", gap: 8, borderBottom: "1px solid #334155", paddingBottom: 2
      }}>
        {[
          { id: "assets", label: "Equipment Registry", icon: <Wrench size={15} /> },
          { id: "work_orders", label: "Breakdown & Work Orders", icon: <AlertTriangle size={15} /> },
          { id: "schedules", label: "Preventive Maintenance (PM)", icon: <Calendar size={15} /> },
          { id: "analytics", label: "Cost & Spares Telemetry", icon: <BarChart3 size={15} /> }
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
                borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
                background: isActive ? "var(--bg-card)" : "transparent",
                color: isActive ? "var(--color-gold)" : "var(--text-muted)",
                fontWeight: isActive ? 700 : 500, fontSize: 13,
                borderBottom: isActive ? "2px solid var(--color-gold)" : "2px solid transparent",
                transition: "all 0.15s"
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: 1. ASSET REGISTRY */}
      {activeTab === "assets" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter Bar */}
          <div style={{
            display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
            background: "var(--bg-card)", padding: "12px 16px", borderRadius: 8, border: "1px solid #334155"
          }}>
            <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
              <input
                type="text"
                placeholder="Search by equipment name, code, model or serial #..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") loadActiveTabData(); }}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 6, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <select
              value={assetDeptFilter}
              onChange={(e) => { setAssetDeptFilter(e.target.value); setTimeout(loadActiveTabData, 10); }}
              style={{
                padding: "8px 12px", borderRadius: 6, background: "var(--bg-modal)",
                border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
              }}
            >
              <option value="">All Departments</option>
              {departmentsList.map(d => (
                <option key={d.id || d.name} value={d.name}>{d.name}</option>
              ))}
              <option value="FACILITY & MAINTENANCE">FACILITY & MAINTENANCE</option>
            </select>

            <button
              onClick={loadActiveTabData}
              style={{
                padding: "8px 14px", borderRadius: 6, background: "#334155",
                border: "none", color: "var(--text-main)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Assets Table */}
          <div style={{
            background: "var(--bg-card)", borderRadius: 10, border: "1px solid #334155", overflow: "hidden"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-modal)", borderBottom: "1px solid #334155", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Code</th>
                  <th style={{ padding: "12px 16px" }}>Equipment Name</th>
                  <th style={{ padding: "12px 16px" }}>Department / Location</th>
                  <th style={{ padding: "12px 16px" }}>Category</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>Criticality</th>
                  <th style={{ padding: "12px 16px" }}>AMC / Service Vendor</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                      No equipment records found matching the filter.
                    </td>
                  </tr>
                ) : (
                  assets.map((a, idx) => (
                    <tr
                      key={a.id}
                      style={{
                        borderBottom: "1px solid #334155",
                        background: idx % 2 === 0 ? "transparent" : "rgba(15, 23, 42, 0.3)"
                      }}
                    >
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--color-gold)", fontWeight: 700 }}>
                        {a.asset_code}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {a.manufacturer || "Standard Brand"} {a.model_no ? `• ${a.model_no}` : ""}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-muted)" }}>{a.department}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.location || "-"}</div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#cbd5e1" }}>
                        {(a.category || "").replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {renderStatusBadge(a.status)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {renderPriorityBadge(a.criticality)}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 12 }}>
                        {a.amc_vendor || "In-House Maintenance"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={() => setQrModalAsset(a)}
                            title="View Asset QR"
                            style={{
                              padding: "4px 8px", borderRadius: 4, background: "#334155",
                              border: "none", color: "var(--text-main)", cursor: "pointer"
                            }}
                          >
                            <QrCode size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. WORK ORDERS */}
      {activeTab === "work_orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter Bar */}
          <div style={{
            display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
            background: "var(--bg-card)", padding: "12px 16px", borderRadius: 8, border: "1px solid #334155"
          }}>
            <input
              type="text"
              placeholder="Search WO #, description, machine..."
              value={woSearch}
              onChange={(e) => setWoSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") loadActiveTabData(); }}
              style={{
                flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 6, background: "var(--bg-modal)",
                border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
              }}
            />

            <select
              value={woStatusFilter}
              onChange={(e) => { setWoStatusFilter(e.target.value); setTimeout(loadActiveTabData, 10); }}
              style={{
                padding: "8px 12px", borderRadius: 6, background: "var(--bg-modal)",
                border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
              }}
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open Tickets</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PARTS_AWAITING">Awaiting Parts</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <button
              onClick={loadActiveTabData}
              style={{
                padding: "8px 14px", borderRadius: 6, background: "#334155",
                border: "none", color: "var(--text-main)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Work Orders List */}
          <div style={{
            background: "var(--bg-card)", borderRadius: 10, border: "1px solid #334155", overflow: "hidden"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-modal)", borderBottom: "1px solid #334155", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>WO #</th>
                  <th style={{ padding: "12px 16px" }}>Date & Time</th>
                  <th style={{ padding: "12px 16px" }}>Equipment & Dept</th>
                  <th style={{ padding: "12px 16px" }}>Type / Priority</th>
                  <th style={{ padding: "12px 16px" }}>Issue Description</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>Cost (₹)</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                      No maintenance work orders found matching the filter.
                    </td>
                  </tr>
                ) : (
                  workOrders.map((wo, idx) => (
                    <tr
                      key={wo.id}
                      style={{
                        borderBottom: "1px solid #334155",
                        background: idx % 2 === 0 ? "transparent" : "rgba(15, 23, 42, 0.3)"
                      }}
                    >
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#f59e0b", fontWeight: 700 }}>
                        {wo.wo_number}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 12 }}>
                        {new Date(wo.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{wo.asset_name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{wo.department} • {wo.asset_code}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>{wo.order_type}</div>
                        <div>{renderPriorityBadge(wo.priority)}</div>
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: 280 }}>
                        <div style={{ color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {wo.issue_description}
                        </div>
                        {wo.action_taken && (
                          <div style={{ fontSize: 11, color: "#10b981", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            ↳ {wo.action_taken}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {renderStatusBadge(wo.status)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>₹{parseFloat(wo.total_cost || 0).toFixed(2)}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Parts: ₹{parseFloat(wo.parts_cost || 0).toFixed(0)}</div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {wo.status !== "COMPLETED" && (
                            <>
                              <button
                                onClick={() => setSelectedWoForParts(wo)}
                                title="Issue Store Spares"
                                style={{
                                  padding: "5px 10px", borderRadius: 6, background: "#3b82f6",
                                  border: "none", color: "#ffffff", fontSize: 11, fontWeight: 600,
                                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                                }}
                              >
                                Spares
                              </button>
                              <button
                                onClick={() => setSelectedWoForComplete(wo)}
                                title="Mark Completed"
                                style={{
                                  padding: "5px 10px", borderRadius: 6, background: "#10b981",
                                  border: "none", color: "#ffffff", fontSize: 11, fontWeight: 600,
                                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                                }}
                              >
                                Close
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 3. PREVENTIVE SCHEDULES */}
      {activeTab === "schedules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: 10, border: "1px solid #334155", overflow: "hidden"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-modal)", borderBottom: "1px solid #334155", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Equipment</th>
                  <th style={{ padding: "12px 16px" }}>Preventive Routine Title</th>
                  <th style={{ padding: "12px 16px" }}>Frequency</th>
                  <th style={{ padding: "12px 16px" }}>Last Executed</th>
                  <th style={{ padding: "12px 16px" }}>Next Due Date</th>
                  <th style={{ padding: "12px 16px" }}>Assigned Tech</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s, idx) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: "1px solid #334155",
                      background: s.is_overdue ? "rgba(239, 68, 68, 0.08)" : (idx % 2 === 0 ? "transparent" : "rgba(15, 23, 42, 0.3)")
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{s.asset_name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.department} • {s.asset_code}</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#cbd5e1" }}>
                      {s.title}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: "#334155", color: "#e2e8f0"
                      }}>
                        {s.frequency}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                      {s.last_performed_at ? new Date(s.last_performed_at).toLocaleDateString("en-IN") : "Pending First Run"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontWeight: 700,
                        color: s.is_overdue ? "#ef4444" : "#10b981"
                      }}>
                        {new Date(s.next_due_date).toLocaleDateString("en-IN")}
                        {s.is_overdue && " (OVERDUE)"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                      {s.assigned_to || "Facility Tech"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <button
                        onClick={() => handleCompleteSchedule(s.id)}
                        style={{
                          padding: "6px 12px", borderRadius: 6, background: "#10b981",
                          border: "none", color: "#ffffff", fontWeight: 600, fontSize: 11,
                          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
                        }}
                      >
                        <CheckCircle2 size={13} /> Mark Performed
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 4. COST & SPARES TELEMETRY */}
      {activeTab === "analytics" && analytics && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Department Cost Breakdown */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 10, padding: 18
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>
              Maintenance Spend by Department
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {analytics.costByDepartment.map((d, i) => (
                <div key={i} style={{
                  background: "var(--bg-modal)", border: "1px solid #334155", borderRadius: 8, padding: 12,
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{d.department}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {d.workOrdersCount} tickets • Spares: ₹{d.partsCost.toFixed(0)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-gold)" }}>
                      ₹{d.totalCost.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Labor: ₹{d.laborCost.toFixed(0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top High-Maintenance Equipment */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 10, padding: 18
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>
              Top High-Maintenance Equipment (Highest Lifetime Cost)
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-modal)", borderBottom: "1px solid #334155", color: "var(--text-muted)", fontSize: 11 }}>
                  <th style={{ padding: "10px 14px" }}>Code</th>
                  <th style={{ padding: "10px 14px" }}>Equipment Name</th>
                  <th style={{ padding: "10px 14px" }}>Department</th>
                  <th style={{ padding: "10px 14px" }}>Work Orders</th>
                  <th style={{ padding: "10px 14px" }}>Downtime (Mins)</th>
                  <th style={{ padding: "10px 14px" }}>Total Spend (₹)</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topCostingMachines.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--color-gold)" }}>{m.asset_code}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-main)" }}>{m.name}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{m.department}</td>
                    <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>{m.woCount}</td>
                    <td style={{ padding: "10px 14px", color: "#f59e0b" }}>{m.downtimeMinutes}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#10b981" }}>₹{m.totalSpend.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <ReportBreakdownModal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        assets={assets}
        onSubmit={handleReportBreakdown}
      />

      <RegisterAssetModal
        isOpen={isRegisterAssetModalOpen}
        onClose={() => setIsRegisterAssetModalOpen(false)}
        departments={departmentsList}
        onSubmit={handleRegisterAsset}
      />

      <ConsumePartsModal
        isOpen={!!selectedWoForParts}
        onClose={() => setSelectedWoForParts(null)}
        workOrder={selectedWoForParts}
        onSubmit={handleConsumeParts}
      />

      <CompleteWorkOrderModal
        isOpen={!!selectedWoForComplete}
        onClose={() => setSelectedWoForComplete(null)}
        workOrder={selectedWoForComplete}
        onSubmit={handleCompleteWorkOrder}
      />

      {/* Simple QR modal */}
      {qrModalAsset && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100, backgroundColor: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 12, padding: 24,
            width: "100%", maxWidth: 360, textAlign: "center"
          }}>
            <h3 style={{ margin: "0 0 6px", color: "var(--text-main)" }}>{qrModalAsset.name}</h3>
            <p style={{ margin: "0 0 16px", color: "var(--color-gold)", fontFamily: "monospace", fontSize: 13 }}>
              {qrModalAsset.asset_code}
            </p>
            <div style={{
              background: "#ffffff", padding: 16, borderRadius: 8, display: "inline-block", margin: "0 auto 16px"
            }}>
              <QrCode size={160} color="var(--bg-modal)" />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
              Scan with Kapila Mobile App for equipment logs & rapid breakdown reporting.
            </div>
            <button
              onClick={() => setQrModalAsset(null)}
              style={{
                padding: "8px 20px", borderRadius: 6, background: "#334155",
                border: "none", color: "var(--text-main)", cursor: "pointer", fontSize: 13
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
