import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { foodSafety, waste } from "../../api";
import { 
  ShieldCheck, Thermometer, Trash2, Droplet, Sparkles, Plus, 
  Download, Search, RefreshCw, AlertTriangle, CheckCircle2, 
  XCircle, Clock, IndianRupee, Truck, Bug, FileSpreadsheet,
  Activity, ArrowUpRight
} from "lucide-react";

import NewInspectionModal from "./NewInspectionModal";
import LogFoodWasteModal from "./LogFoodWasteModal";
import LogRucoReadingModal from "./LogRucoReadingModal";
import LogPestAuditModal from "./LogPestAuditModal";

const DEPARTMENTS = [
  "ALL",
  "TIFFINS",
  "STAFF",
  "SI-MEALS",
  "NORTH INDIAN",
  "CHAT & SOFTY",
  "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL",
  "RESTAURANT",
  "ROOM SERVICE"
];

export default function FoodSafetyAndWasteScreen() {
  const [activeTab, setActiveTab] = useState("haccp_receiving"); // "haccp_receiving", "waste_tracking", "ruco_oil", "pest_hygiene"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // HACCP Data
  const [inspections, setInspections] = useState([]);
  const [qualityTelemetry, setQualityTelemetry] = useState({
    total_inspections: 0,
    passed_count: 0,
    rejected_count: 0,
    compliance_rate_pct: 100
  });

  // Waste Data
  const [wasteLogs, setWasteLogs] = useState([]);
  const [wasteSummary, setWasteSummary] = useState({
    total_records: 0,
    total_qty: 0,
    total_cost: 0
  });
  const [wasteAnalytics, setWasteAnalytics] = useState(null);

  // RUCO Data
  const [rucoLogs, setRucoLogs] = useState([]);
  const [rucoSummary, setRucoSummary] = useState({
    current_drum_stock_litres: 0,
    total_oil_discarded_litres: 0,
    total_oil_collected_litres: 0,
    total_revenue_recovered: 0
  });

  // Pest Control Data
  const [pestLogs, setPestLogs] = useState([]);
  const [pestTotal, setPestTotal] = useState(0);

  // Filters
  const [haccpStatusFilter, setHaccpStatusFilter] = useState("");
  const [haccpCategoryFilter, setHaccpCategoryFilter] = useState("");
  const [wasteDeptFilter, setWasteDeptFilter] = useState("ALL");
  const [wasteTypeFilter, setWasteTypeFilter] = useState("");
  const [rucoDeptFilter, setRucoDeptFilter] = useState("ALL");

  // Modals
  const [isHaccpModalOpen, setIsHaccpModalOpen] = useState(false);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [isRucoModalOpen, setIsRucoModalOpen] = useState(false);
  const [isPestModalOpen, setIsPestModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab, haccpStatusFilter, haccpCategoryFilter, wasteDeptFilter, wasteTypeFilter, rucoDeptFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "haccp_receiving") {
        const res = await foodSafety.listInspections({
          status: haccpStatusFilter || undefined,
          category: haccpCategoryFilter || undefined,
          limit: 50
        });
        setInspections(res.rows || []);
        const telem = await foodSafety.telemetry();
        setQualityTelemetry(telem);
      } else if (activeTab === "waste_tracking") {
        const res = await waste.listLogs({
          department: wasteDeptFilter !== "ALL" ? wasteDeptFilter : undefined,
          waste_type: wasteTypeFilter || undefined,
          limit: 50
        });
        setWasteLogs(res.rows || []);
        if (res.summary) setWasteSummary(res.summary);

        const aRes = await waste.analytics({ days: 30 });
        setWasteAnalytics(aRes);
      } else if (activeTab === "ruco_oil") {
        const res = await waste.listRuco({
          department: rucoDeptFilter !== "ALL" ? rucoDeptFilter : undefined,
          limit: 50
        });
        setRucoLogs(res.rows || []);
        if (res.summary) setRucoSummary(res.summary);
      } else if (activeTab === "pest_hygiene") {
        const res = await foodSafety.listPestLogs({ limit: 50 });
        setPestLogs(res.rows || []);
        setPestTotal(res.total || 0);
      }
    } catch (err) {
      console.error("Failed to load food safety / waste data:", err);
      setMsg("Error loading records: " + (err.message || "Network error"));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      if (activeTab === "haccp_receiving" || activeTab === "pest_hygiene") {
        await foodSafety.exportExcel();
      } else {
        await waste.exportExcel();
      }
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", color: COLORS.text, maxWidth: "1600px", margin: "0 auto" }}>
      {/* Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <ShieldCheck size={28} color={COLORS.gold} />
            <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 700, fontFamily: "DM Serif Display, serif" }}>
              Food Safety QC, RUCO & Waste Governance
            </h1>
          </div>
          <p style={{ margin: 0, color: COLORS.textMuted, fontSize: "0.9rem" }}>
            FSSAI Schedule IV & HACCP Cold-Chain Inbound Verifications, Kitchen Spoilage Valuation, and Repurpose Used Cooking Oil.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={loadData}
            title="Refresh Data"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 14px",
              backgroundColor: "var(--border-color)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "8px",
              color: COLORS.text,
              cursor: "pointer",
              fontSize: "0.85rem"
            }}
          >
            <RefreshCw size={15} className={loading ? "spin-animation" : ""} />
            Refresh
          </button>

          <button
            onClick={handleExport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 16px",
              backgroundColor: "rgba(232, 168, 56, 0.12)",
              border: `1px solid ${COLORS.gold}`,
              borderRadius: "8px",
              color: COLORS.gold,
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600
            }}
          >
            <FileSpreadsheet size={16} />
            Export Styled Excel
          </button>

          {/* Primary Modal Launchers */}
          {activeTab === "haccp_receiving" && (
            <button
              onClick={() => setIsHaccpModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                backgroundColor: COLORS.gold,
                border: "none",
                borderRadius: "8px",
                color: "#111",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <Plus size={16} />
              New Inbound Inspection
            </button>
          )}

          {activeTab === "waste_tracking" && (
            <button
              onClick={() => setIsWasteModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                backgroundColor: COLORS.gold,
                border: "none",
                borderRadius: "8px",
                color: "#111",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <Plus size={16} />
              Log Kitchen Waste
            </button>
          )}

          {activeTab === "ruco_oil" && (
            <button
              onClick={() => setIsRucoModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                backgroundColor: COLORS.gold,
                border: "none",
                borderRadius: "8px",
                color: "#111",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <Plus size={16} />
              Record TPC / RUCO Handover
            </button>
          )}

          {activeTab === "pest_hygiene" && (
            <button
              onClick={() => setIsPestModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                backgroundColor: COLORS.gold,
                border: "none",
                borderRadius: "8px",
                color: "#111",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <Plus size={16} />
              Log Pest / Deep Audit
            </button>
          )}
        </div>
      </div>

      {/* Top Telemetry KPI Ribbon */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px"
        }}
      >
        {/* KPI 1: HACCP Compliance Rate */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "10px",
            padding: "16px 20px",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              HACCP Inbound Pass Rate
            </span>
            <Thermometer size={18} color="#52c41a" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: COLORS.text }}>
              {qualityTelemetry.compliance_rate_pct}%
            </span>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
              ({qualityTelemetry.passed_count} of {qualityTelemetry.total_inspections} passed)
            </span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: qualityTelemetry.rejected_count > 0 ? "#ff4d4f" : "#52c41a" }}>
            {qualityTelemetry.rejected_count} consignments returned to vendor
          </div>
        </div>

        {/* KPI 2: Monthly Kitchen Waste Valuation */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "10px",
            padding: "16px 20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Kitchen Waste & Spoilage Cost
            </span>
            <IndianRupee size={18} color="#ff7875" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#ff7875" }}>
              ₹{wasteSummary.total_cost ? Number(wasteSummary.total_cost).toLocaleString("en-IN") : "0"}
            </span>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
              ({wasteSummary.total_qty || 0} kg logged)
            </span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: COLORS.textMuted }}>
            30-day cumulative across 9 kitchen stations
          </div>
        </div>

        {/* KPI 3: Current RUCO Drum Stock */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "10px",
            padding: "16px 20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              RUCO Drum Yard Stock
            </span>
            <Droplet size={18} color={COLORS.gold} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: COLORS.gold }}>
              {rucoSummary.current_drum_stock_litres || 0} L
            </span>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
              / 200 L Drum Capacity
            </span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: COLORS.textMuted }}>
            {rucoSummary.total_oil_collected_litres || 0} L handed over to biodiesel recyclers
          </div>
        </div>

        {/* KPI 4: Pest & Sanitary Rating */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "10px",
            padding: "16px 20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Sanitary Audit Health
            </span>
            <Sparkles size={18} color="#52c41a" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#52c41a" }}>
              {pestLogs.length > 0 ? pestLogs[0].hygiene_score : 95}/100
            </span>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
              Score (Latest Audit)
            </span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: COLORS.textMuted }}>
            {pestLogs.length > 0 ? `Activity: ${pestLogs[0].pest_activity_detected}` : "Zero critical infractions"}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${COLORS.border}`,
          marginBottom: "20px",
          gap: "8px"
        }}
      >
        <button
          onClick={() => setActiveTab("haccp_receiving")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "haccp_receiving" ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            color: activeTab === "haccp_receiving" ? COLORS.gold : COLORS.textMuted,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Thermometer size={17} />
          HACCP Inbound QC ({inspections.length})
        </button>

        <button
          onClick={() => setActiveTab("waste_tracking")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "waste_tracking" ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            color: activeTab === "waste_tracking" ? COLORS.gold : COLORS.textMuted,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Trash2 size={17} />
          Kitchen Food Waste & Spoilage ({wasteLogs.length})
        </button>

        <button
          onClick={() => setActiveTab("ruco_oil")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "ruco_oil" ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            color: activeTab === "ruco_oil" ? COLORS.gold : COLORS.textMuted,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Droplet size={17} />
          FSSAI RUCO Used Cooking Oil ({rucoLogs.length})
        </button>

        <button
          onClick={() => setActiveTab("pest_hygiene")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "pest_hygiene" ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            color: activeTab === "pest_hygiene" ? COLORS.gold : COLORS.textMuted,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Bug size={17} />
          Pest Control & Sanitary Audits ({pestLogs.length})
        </button>
      </div>

      {/* TAB 1: HACCP INBOUND RECEIVING INSPECTIONS */}
      {activeTab === "haccp_receiving" && (
        <div>
          {/* Filters Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <select
                value={haccpStatusFilter}
                onChange={(e) => setHaccpStatusFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              >
                <option value="">All Inspection Outcomes</option>
                <option value="PASSED">Passed Only</option>
                <option value="REJECTED">Rejected Consignments Only</option>
                <option value="ACCEPTED_CONDITIONALLY">Conditionally Accepted</option>
              </select>

              <select
                value={haccpCategoryFilter}
                onChange={(e) => setHaccpCategoryFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              >
                <option value="">All Categories</option>
                <option value="DAIRY">Dairy & Milk</option>
                <option value="MEAT_POULTRY">Meat & Poultry</option>
                <option value="SEAFOOD">Seafood & Fresh Fish</option>
                <option value="PRODUCE_VEG">Vegetables & Fresh Produce</option>
                <option value="FROZEN_PROCESSED">Frozen & Processed Goods</option>
                <option value="DRY_GROCERY">Dry Grocery & Grains</option>
              </select>
            </div>

            <span style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>
              Showing {inspections.length} inbound inspection records
            </span>
          </div>

          {/* Table */}
          <div
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: "10px",
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden"
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Date</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Item & Category</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Supplier & Challan</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Measured Temp</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>HACCP Threshold</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Sensory / Seal</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Inspector / Action</th>
                </tr>
              </thead>
              <tbody>
                {inspections.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: "32px", textAlign: "center", color: COLORS.textMuted }}>
                      No HACCP receiving inspection logs found matching filters.
                    </td>
                  </tr>
                ) : (
                  inspections.map((row) => {
                    const isPassed = row.status === "PASSED";
                    const isRejected = row.status === "REJECTED";
                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: `1px solid ${COLORS.border}`,
                          backgroundColor: isRejected ? "rgba(220, 53, 69, 0.05)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {row.inspection_date ? String(row.inspection_date).slice(0, 10) : "-"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: COLORS.text }}>{row.item_name}</div>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: "var(--border-color)",
                              color: COLORS.textMuted
                            }}
                          >
                            {row.category}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div>{row.supplier_name || "General Vendor"}</div>
                          <div style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>
                            Challan: {row.challan_number || "Direct Entry"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {row.receiving_temp_c !== null ? (
                            <span
                              style={{
                                fontWeight: 700,
                                color: row.temp_compliant ? "#52c41a" : "#ff4d4f",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <Thermometer size={14} />
                              {parseFloat(row.receiving_temp_c).toFixed(1)} °C
                            </span>
                          ) : (
                            <span style={{ color: COLORS.textMuted }}>Ambient / N/A</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", color: COLORS.textMuted, fontSize: "0.82rem" }}>
                          {row.temp_threshold_max_c !== null ? `Max ${row.temp_threshold_max_c} °C` : "Ambient Spec"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontSize: "0.8rem" }}>{row.sensory_rating}</div>
                          <div style={{ fontSize: "0.74rem", color: COLORS.textMuted }}>Seal: {row.packaging_seal}</div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              borderRadius: "12px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: isPassed
                                ? "rgba(82, 196, 26, 0.15)"
                                : isRejected
                                ? "rgba(255, 77, 79, 0.15)"
                                : "rgba(250, 173, 20, 0.15)",
                              color: isPassed ? "#52c41a" : isRejected ? "#ff4d4f" : "#faad14"
                            }}
                          >
                            {isPassed ? <CheckCircle2 size={12} /> : isRejected ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontSize: "0.82rem" }}>{row.action_taken || "-"}</div>
                          <div style={{ fontSize: "0.74rem", color: COLORS.textMuted }}>By: {row.inspector_name}</div>
                          {row.rejection_reason && (
                            <div style={{ fontSize: "0.74rem", color: "#ff7875", marginTop: "2px" }}>
                              Reason: {row.rejection_reason}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: KITCHEN FOOD WASTE & SPOILAGE */}
      {activeTab === "waste_tracking" && (
        <div>
          {/* Filters Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <select
                value={wasteDeptFilter}
                onChange={(e) => setWasteDeptFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "ALL" ? "All Kitchen Departments" : dept}
                  </option>
                ))}
              </select>

              <select
                value={wasteTypeFilter}
                onChange={(e) => setWasteTypeFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              >
                <option value="">All Waste Types</option>
                <option value="PREP_TRIMMING">Prep Trimming (Peels & Off-cuts)</option>
                <option value="OVER_PRODUCTION">Over Production (Unconsumed Cooked Batch)</option>
                <option value="SPOILAGE">Storage Spoilage (Expired / Mold)</option>
                <option value="PLATE_WASTE">Plate Waste / Customer Leftovers</option>
                <option value="BURNT_ACCIDENT">Burnt / Kitchen Accident</option>
              </select>
            </div>

            <div style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>
              30-Day Cost Total: <strong style={{ color: "#ff7875" }}>₹{wasteSummary.total_cost ? Number(wasteSummary.total_cost).toLocaleString("en-IN") : "0"}</strong>
            </div>
          </div>

          {/* Table */}
          <div
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: "10px",
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden"
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Date</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Department</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Type & Description</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Quantity</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Unit Cost (₹)</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Total Value Loss (₹)</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Disposal Channel</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {wasteLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: "32px", textAlign: "center", color: COLORS.textMuted }}>
                      No food waste logs recorded matching criteria.
                    </td>
                  </tr>
                ) : (
                  wasteLogs.map((row) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {row.waste_date ? String(row.waste_date).slice(0, 10) : "-"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--border-color)",
                            fontWeight: 600,
                            fontSize: "0.78rem"
                          }}
                        >
                          {row.department}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: COLORS.text }}>{row.item_name}</div>
                        <div style={{ fontSize: "0.74rem", color: COLORS.textMuted }}>
                          {row.waste_type} {row.reason ? `• ${row.reason}` : ""}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                        {parseFloat(row.qty).toFixed(2)} {row.unit}
                      </td>
                      <td style={{ padding: "12px 16px", color: COLORS.textMuted }}>
                        ₹{parseFloat(row.unit_cost || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#ff7875" }}>
                        ₹{parseFloat(row.total_cost || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.8rem", color: COLORS.textMuted }}>
                        {row.disposal_method || "Composting Bin"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.8rem" }}>
                        {row.logged_by}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FSSAI RUCO USED COOKING OIL */}
      {activeTab === "ruco_oil" && (
        <div>
          {/* Filters Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <select
                value={rucoDeptFilter}
                onChange={(e) => setRucoDeptFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "ALL" ? "All Kitchen Departments" : dept}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "20px", fontSize: "0.85rem" }}>
              <div>
                Drum Stock: <strong style={{ color: COLORS.gold }}>{rucoSummary.current_drum_stock_litres} Litres</strong>
              </div>
              <div>
                Dispatched to Biodiesel: <strong style={{ color: "#52c41a" }}>{rucoSummary.total_oil_collected_litres} Litres</strong>
              </div>
              <div>
                Revenue Recovered: <strong style={{ color: COLORS.gold }}>₹{rucoSummary.total_revenue_recovered}</strong>
              </div>
            </div>
          </div>

          {/* Table */}
          <div
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: "10px",
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden"
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Date</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Department & Fryer</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Oil Type</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>TPC Meter Reading</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Oil Status</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Litres Transferred</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Current Drum Stock</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Handover Manifest</th>
                </tr>
              </thead>
              <tbody>
                {rucoLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: "32px", textAlign: "center", color: COLORS.textMuted }}>
                      No RUCO cooking oil logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  rucoLogs.map((row) => {
                    const tpc = parseFloat(row.tpc_percentage);
                    const isOverLimit = tpc >= 25.0;
                    const isHandover = parseFloat(row.collected_litres || 0) > 0;
                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: `1px solid ${COLORS.border}`,
                          backgroundColor: isHandover ? "rgba(82, 196, 26, 0.04)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {row.log_date ? String(row.log_date).slice(0, 10) : "-"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: COLORS.text }}>{row.fryer_name}</div>
                          <span style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>{row.department}</span>
                        </td>
                        <td style={{ padding: "12px 16px", color: COLORS.textMuted }}>
                          {row.oil_type}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isOverLimit ? "#ff4d4f" : tpc >= 21.0 ? "#faad14" : "#52c41a"
                            }}
                          >
                            {tpc.toFixed(1)}% TPC
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: isOverLimit
                                ? "rgba(255, 77, 79, 0.15)"
                                : row.status === "TOP_UP_REQUIRED"
                                ? "rgba(250, 173, 20, 0.15)"
                                : "rgba(82, 196, 26, 0.15)",
                              color: isOverLimit ? "#ff4d4f" : row.status === "TOP_UP_REQUIRED" ? "#faad14" : "#52c41a"
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {parseFloat(row.discarded_litres) > 0 ? (
                            <span style={{ color: "#faad14", fontWeight: 600 }}>
                              +{parseFloat(row.discarded_litres).toFixed(1)} L (Drained)
                            </span>
                          ) : parseFloat(row.collected_litres) > 0 ? (
                            <span style={{ color: "#52c41a", fontWeight: 600 }}>
                              -{parseFloat(row.collected_litres).toFixed(1)} L (Dispatched)
                            </span>
                          ) : (
                            <span style={{ color: COLORS.textMuted }}>0.0 L</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: COLORS.gold }}>
                          {parseFloat(row.current_drum_stock_litres || 0).toFixed(1)} L
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {isHandover ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "#52c41a" }}>
                                {row.collection_vendor}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>
                                Cert: {row.collection_certificate_no} • ₹{row.revenue_recovered}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: COLORS.textMuted, fontSize: "0.78rem" }}>
                              {row.notes || `Logged by ${row.recorded_by}`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PEST CONTROL & SANITARY AUDITS */}
      {activeTab === "pest_hygiene" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px"
            }}
          >
            <span style={{ fontSize: "0.9rem", color: COLORS.textMuted }}>
              FSSAI Schedule IV Sanitary Maintenance & Verification Logbook
            </span>
            <span style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>
              Total Audits Recorded: <strong>{pestTotal}</strong>
            </span>
          </div>

          {/* Table */}
          <div
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: "10px",
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden"
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Service Date</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Service / Audit Type</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Agency & Technician</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Areas Covered</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Chemicals / Baits</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Traps</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Pest Activity</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Score & Signoff</th>
                </tr>
              </thead>
              <tbody>
                {pestLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: "32px", textAlign: "center", color: COLORS.textMuted }}>
                      No pest control or deep hygiene audits logged yet.
                    </td>
                  </tr>
                ) : (
                  pestLogs.map((row) => {
                    let areas = [];
                    try {
                      areas = Array.isArray(row.areas_covered)
                        ? row.areas_covered
                        : JSON.parse(row.areas_covered || "[]");
                    } catch {
                      areas = [String(row.areas_covered)];
                    }

                    return (
                      <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {row.service_date ? String(row.service_date).slice(0, 10) : "-"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "4px",
                              backgroundColor: "var(--border-color)",
                              fontWeight: 600,
                              fontSize: "0.78rem"
                            }}
                          >
                            {row.service_type}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: COLORS.text }}>{row.service_agency}</div>
                          <div style={{ fontSize: "0.74rem", color: COLORS.textMuted }}>
                            Tech: {row.technician_name || "Certified Operator"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "260px" }}>
                            {areas.slice(0, 3).map((a, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "var(--border-color)",
                                  color: COLORS.textMuted
                                }}
                              >
                                {a}
                              </span>
                            ))}
                            {areas.length > 3 && (
                              <span style={{ fontSize: "0.7rem", color: COLORS.gold }}>
                                +{areas.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "0.78rem", color: COLORS.textMuted, maxWidth: "160px" }}>
                          {row.chemicals_used || "Approved non-toxic gel/bait"}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                          {row.trap_count_installed}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor:
                                row.pest_activity_detected === "NONE"
                                  ? "rgba(82, 196, 26, 0.15)"
                                  : row.pest_activity_detected === "HIGH"
                                  ? "rgba(255, 77, 79, 0.15)"
                                  : "rgba(250, 173, 20, 0.15)",
                              color:
                                row.pest_activity_detected === "NONE"
                                  ? "#52c41a"
                                  : row.pest_activity_detected === "HIGH"
                                  ? "#ff4d4f"
                                  : "#faad14"
                            }}
                          >
                            {row.pest_activity_detected}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 700, color: row.hygiene_score >= 90 ? "#52c41a" : "#faad14" }}>
                            {row.hygiene_score}/100
                          </div>
                          <div style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>
                            Sign: {row.supervisor_signoff || "Executive Chef"}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Invocations */}
      <NewInspectionModal
        isOpen={isHaccpModalOpen}
        onClose={() => setIsHaccpModalOpen(false)}
        onSuccess={loadData}
      />

      <LogFoodWasteModal
        isOpen={isWasteModalOpen}
        onClose={() => setIsWasteModalOpen(false)}
        onSuccess={loadData}
      />

      <LogRucoReadingModal
        isOpen={isRucoModalOpen}
        onClose={() => setIsRucoModalOpen(false)}
        onSuccess={loadData}
        currentDrumStock={rucoSummary.current_drum_stock_litres || 0}
      />

      <LogPestAuditModal
        isOpen={isPestModalOpen}
        onClose={() => setIsPestModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
