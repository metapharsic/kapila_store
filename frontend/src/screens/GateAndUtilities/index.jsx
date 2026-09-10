import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { security, utility } from "../../api";
import { 
  Shield, Truck, Gauge, Flame, Zap, Droplets, Plus, Download, 
  Search, RefreshCw, CheckCircle2, Clock, AlertTriangle, LogOut, 
  PackageCheck, FileSpreadsheet, ArrowUpRight, ArrowDownLeft, Activity, Eye
} from "lucide-react";
import NewGatePassModal from "./NewGatePassModal";
import RecordExitModal from "./RecordExitModal";
import ReconcileRgpModal from "./ReconcileRgpModal";
import RecordUtilityReadingModal from "./RecordUtilityReadingModal";
import GatePassDetailModal from "./GatePassDetailModal";

export default function GateAndUtilitiesScreen() {
  const [activeTab, setActiveTab] = useState("gate_passes"); // "gate_passes", "rgp_reconciler", "lpg_energy", "water_facility"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Data
  const [passes, setPasses] = useState([]);
  const [gateStats, setGateStats] = useState({ total_all: 0, in_premises: 0, rgp_pending: 0, today_entries: 0 });
  const [readings, setReadings] = useState([]);
  const [utilitySummary, setUtilitySummary] = useState({});
  const [latestUtility, setLatestUtility] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  // Filters
  const [gateSearch, setGateSearch] = useState("");
  const [gateTypeFilter, setGateTypeFilter] = useState("");
  const [gateStatusFilter, setGateStatusFilter] = useState("");
  const [utilityShiftFilter, setUtilityShiftFilter] = useState("");

  // Modals
  const [isNewPassModalOpen, setIsNewPassModalOpen] = useState(false);
  const [selectedPassForExit, setSelectedPassForExit] = useState(null);
  const [selectedPassForRgp, setSelectedPassForRgp] = useState(null);
  const [isUtilityModalOpen, setIsUtilityModalOpen] = useState(false);
  const [selectedPassForDetail, setSelectedPassForDetail] = useState(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "gate_passes" || activeTab === "rgp_reconciler") {
        const isRgpOnly = activeTab === "rgp_reconciler";
        const res = await security.listPasses({
          search: gateSearch,
          pass_type: isRgpOnly ? "RGP_RETURNABLE" : gateTypeFilter,
          status: gateStatusFilter,
          returnable_only: isRgpOnly
        });
        setPasses(res.rows || []);
        if (res.stats) setGateStats(res.stats);
      } else {
        const res = await utility.listReadings({ shift: utilityShiftFilter });
        setReadings(res.rows || []);
        if (res.summary) setUtilitySummary(res.summary);
        if (res.latest) setLatestUtility(res.latest);

        const aRes = await utility.analytics({ days: 30 });
        setAnalytics(aRes.data || null);
      }
    } catch (err) {
      console.error(err);
      setMsg("Failed to fetch data: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      if (activeTab === "gate_passes" || activeTab === "rgp_reconciler") {
        await security.exportExcel();
      } else {
        await utility.exportExcel();
      }
      setMsg("Excel report downloaded successfully.");
      setTimeout(() => setMsg(""), 4000);
    } catch (err) {
      setMsg("Export failed: " + (err.message || "Unknown error"));
      setTimeout(() => setMsg(""), 5000);
    }
  };

  const computeDuration = (inTime, outTime) => {
    if (!inTime) return "-";
    const start = new Date(inTime);
    const end = outTime ? new Date(outTime) : new Date();
    const diffMins = Math.max(1, Math.round((end - start) / 60000));
    if (diffMins < 60) return `${diffMins}m`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1600px", margin: "0 auto", color: "var(--text-main)" }}>
      {/* Toast */}
      {msg && (
        <div style={{
          marginBottom: "16px",
          padding: "12px 18px",
          background: "var(--color-gold-dim)",
          border: "1px solid rgba(232, 168, 56, 0.4)",
          borderRadius: "8px",
          color: "var(--color-gold)",
          fontSize: "13px",
          fontWeight: "600",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>{msg}</span>
          <button onClick={() => setMsg("")} style={{ background: "transparent", border: "none", color: "var(--color-gold)", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px",
        marginBottom: "24px"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "var(--color-gold-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-gold)"
            }}>
              <Shield size={22} />
            </div>
            <div>
              <h1 style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "26px",
                fontWeight: "700",
                color: "var(--color-gold)",
                margin: 0,
                letterSpacing: "-0.02em"
              }}>
                Security Gate & Kitchen Utilities
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                Commercial vehicle tracking, returnable container reconciler (LPG/crates/cans), and kitchen energy telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => setIsNewPassModalOpen(true)}
            style={{
              padding: "9px 16px",
              background: "linear-gradient(135deg, var(--color-gold) 0%, #ca8a04 100%)",
              border: "none",
              borderRadius: "8px",
              color: "var(--bg-modal)",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 12px rgba(232, 168, 56, 0.25)"
            }}
          >
            <Plus size={16} />
            Log Vehicle Entry
          </button>
          <button
            onClick={() => setIsUtilityModalOpen(true)}
            style={{
              padding: "9px 16px",
              background: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.35)",
              borderRadius: "8px",
              color: "#60A5FA",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Gauge size={16} />
            Record Utility Reading
          </button>
          <button
            onClick={handleExportExcel}
            style={{
              padding: "9px 16px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              color: "#34D399",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <FileSpreadsheet size={16} />
            Export Excel
          </button>
          <button
            onClick={loadData}
            style={{
              padding: "9px 14px",
              background: "rgba(30, 41, 59, 0.6)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              color: "var(--text-muted)",
              cursor: "pointer"
            }}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Telemetry Ribbon */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "14px",
        marginBottom: "24px"
      }}>
        <div style={{
          background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-modal) 100%)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
              In Premises
            </span>
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: gateStats.in_premises > 0 ? "#10B981" : "var(--text-muted)",
              boxShadow: gateStats.in_premises > 0 ? "0 0 10px #10B981" : "none"
            }} />
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-main)", marginTop: "8px" }}>
            {gateStats.in_premises}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Vehicles currently in compound
          </div>
        </div>

        <div style={{
          background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-modal) 100%)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
              Open RGPs Pending
            </span>
            <PackageCheck size={16} color="#F59E0B" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#F59E0B", marginTop: "8px" }}>
            {gateStats.rgp_pending}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Empty LPG cylinders / crates due
          </div>
        </div>

        <div style={{
          background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-modal) 100%)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
              LPG Manifold
            </span>
            <Flame size={16} color="var(--color-gold)" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--color-gold)", marginTop: "8px" }}>
            {latestUtility ? `${latestUtility.lpg_active_cylinders} Active` : "8 Active"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {latestUtility ? `${latestUtility.lpg_pressure_bar} Bar • ${latestUtility.lpg_full_cylinders} full in reserve` : "Pressure steady"}
          </div>
        </div>

        <div style={{
          background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-modal) 100%)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
              Avg Daily LPG Burn
            </span>
            <Activity size={16} color="#34D399" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#34D399", marginTop: "8px" }}>
            {analytics?.averages?.avg_daily_lpg_kg ? `${analytics.averages.avg_daily_lpg_kg} kg` : "98.0 kg"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            ~2 commercial cylinders / day
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border-color)",
        gap: "8px",
        marginBottom: "20px"
      }}>
        {[
          { id: "gate_passes", label: "Security Gate Register", icon: Truck },
          { id: "rgp_reconciler", label: "Returnable Containers (RGP)", icon: PackageCheck },
          { id: "lpg_energy", label: "LPG & Power Telemetry", icon: Flame },
          { id: "water_facility", label: "Water & Facilities Log", icon: Droplets }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 18px",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid var(--color-gold)" : "2px solid transparent",
                color: isActive ? "var(--color-gold)" : "var(--text-muted)",
                fontSize: "13px",
                fontWeight: isActive ? "700" : "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s"
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GATE REGISTER */}
      {activeTab === "gate_passes" && (
        <div>
          {/* Filters Bar */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
              <div style={{ position: "relative", minWidth: "260px" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search vehicle, driver, vendor, purpose, challan..."
                  value={gateSearch}
                  onChange={(e) => setGateSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadData()}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "var(--text-main)",
                    fontSize: "13px"
                  }}
                />
              </div>

              <select
                value={gateTypeFilter}
                onChange={(e) => { setGateTypeFilter(e.target.value); setTimeout(loadData, 0); }}
                style={{
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              >
                <option value="">All Pass Types</option>
                <option value="INWARD_MATERIAL">INWARD MATERIAL</option>
                <option value="RGP_RETURNABLE">RGP (Returnable Gate Pass)</option>
                <option value="OUTWARD_RTV">OUTWARD RTV</option>
                <option value="NRGP_NON_RETURNABLE">NRGP (Non-Returnable)</option>
                <option value="VISITOR_CONTRACTOR">VISITOR / CONTRACTOR</option>
              </select>

              <select
                value={gateStatusFilter}
                onChange={(e) => { setGateStatusFilter(e.target.value); setTimeout(loadData, 0); }}
                style={{
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              >
                <option value="">All Statuses</option>
                <option value="IN_PREMISES">IN PREMISES</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>

            <button
              onClick={loadData}
              style={{
                padding: "8px 14px",
                background: "rgba(232, 168, 56, 0.12)",
                border: "1px solid rgba(232, 168, 56, 0.3)",
                borderRadius: "8px",
                color: "var(--color-gold)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Apply Filter
            </button>
          </div>

          {/* Table */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            overflowX: "auto"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.7)", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Pass Number</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Type</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Vehicle & Driver</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Vendor / Purpose</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Challan / Invoice</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>In Time / Out Time</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Status</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {passes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "36px", textAlign: "center", color: "var(--text-muted)" }}>
                      No gate passes found matching current filters.
                    </td>
                  </tr>
                ) : (
                  passes.map((p) => {
                    const isInPremises = p.status === "IN_PREMISES";
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <button
                            onClick={() => setSelectedPassForDetail(p)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--color-gold)", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 5, textDecoration: "underline", textUnderlineOffset: 3 }}
                            title="View pass details & manage items"
                          >
                            {p.pass_number}
                          </button>
                          {(p.items_count > 0) && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{p.items_count} item{p.items_count !== 1 ? "s" : ""}</div>}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: p.pass_type === "RGP_RETURNABLE" ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.15)",
                            color: p.pass_type === "RGP_RETURNABLE" ? "#F59E0B" : "#60A5FA"
                          }}>
                            {(p.pass_type || "").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: "600", color: "var(--text-main)" }}>{p.vehicle_number}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {p.driver_name} {p.driver_phone ? `(${p.driver_phone})` : ""}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", maxWidth: "260px" }}>
                          <div style={{ fontWeight: "600", color: "#CBD5E1" }}>{p.vendor_name || "General Entry"}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.purpose}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {p.challan_number ? `DC: ${p.challan_number}` : "-"}
                          </div>
                          {p.invoice_number && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              Inv: {p.invoice_number}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontSize: "12px", color: "var(--text-main)" }}>
                            In: {p.in_time ? new Date(p.in_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}
                          </div>
                          <div style={{ fontSize: "11px", color: p.out_time ? "#34D399" : "#F87171" }}>
                            {p.out_time 
                              ? `Out: ${new Date(p.out_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} (${computeDuration(p.in_time, p.out_time)})`
                              : `Stay: ${computeDuration(p.in_time, null)}`
                            }
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: isInPremises ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.2)",
                            color: isInPremises ? "#34D399" : "var(--text-muted)"
                          }}>
                            {isInPremises ? "IN PREMISES" : "COMPLETED"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          {isInPremises && (
                            <button
                              onClick={() => setSelectedPassForExit(p)}
                              style={{
                                padding: "6px 12px",
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: "6px",
                                color: "#F87171",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <LogOut size={13} />
                              Log Exit
                            </button>
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

      {/* TAB 2: RETURNABLE RECONCILER (RGP) */}
      {activeTab === "rgp_reconciler" && (
        <div>
          <div style={{
            background: "rgba(232, 168, 56, 0.08)",
            border: "1px solid rgba(232, 168, 56, 0.2)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }}>
            <PackageCheck size={24} color="var(--color-gold)" />
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-gold)" }}>
                Active Returnable Containers (LPG Commercial Cylinders, Milk Cans, Crates)
              </div>
              <div style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "2px" }}>
                Whenever empty commercial LPG cylinders (47.5 kg) or milk cans leave the property, an RGP is generated. When refills or returns arrive, reconcile the count in 1 click to avoid container deposit disputes.
              </div>
            </div>
          </div>

          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            overflowX: "auto"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.7)", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Pass Number</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Dispatched Date</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Vendor Name</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Container Asset Type</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>Dispatched (Out)</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>Returned (In)</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>Balance Due</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Due Date</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Status</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((p) => {
                  const isSettled = p.is_return_completed || p.returnable_balance_due === 0;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => setSelectedPassForDetail(p)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--color-gold)", fontWeight: 700, fontSize: 13, textDecoration: "underline", textUnderlineOffset: 3 }}
                          title="View pass details"
                        >
                          {p.pass_number}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#CBD5E1" }}>
                        {p.in_time ? new Date(p.in_time).toISOString().slice(0, 10) : "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: "600", color: "var(--text-main)" }}>
                        {p.vendor_name || "Commercial Vendor"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                        {p.returnable_item_type || "47.5kg Commercial LPG Cylinders"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>
                        {p.returnable_qty_out}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#34D399" }}>
                        {p.returnable_qty_in}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700", color: isSettled ? "var(--text-muted)" : "#F87171" }}>
                        {p.returnable_balance_due}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#CBD5E1" }}>
                        {p.return_due_date ? new Date(p.return_due_date).toISOString().slice(0, 10) : "Open"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "700",
                          background: isSettled ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: isSettled ? "#34D399" : "#F87171"
                        }}>
                          {isSettled ? "SETTLED" : "RETURN DUE"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {!isSettled && (
                          <button
                            onClick={() => setSelectedPassForRgp(p)}
                            style={{
                              padding: "6px 12px",
                              background: "rgba(16, 185, 129, 0.15)",
                              border: "1px solid rgba(16, 185, 129, 0.35)",
                              borderRadius: "6px",
                              color: "#34D399",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <CheckCircle2 size={13} />
                            Reconcile Return
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LPG & POWER TELEMETRY */}
      {activeTab === "lpg_energy" && (
        <div>
          {/* Manifold Gauge Strip */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            marginBottom: "20px"
          }}>
            <div style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, var(--bg-page) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "12px",
              padding: "18px 22px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Flame size={22} color="#F59E0B" />
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#F59E0B" }}>
                  LPG Manifold Pressure
                </span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-main)", marginTop: "10px" }}>
                {latestUtility?.lpg_pressure_bar ? `${latestUtility.lpg_pressure_bar} Bar` : "1.50 Bar"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                Optimal line pressure: 1.40 - 1.65 Bar (Commercial high pressure)
              </div>
            </div>

            <div style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, var(--bg-page) 100%)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "12px",
              padding: "18px 22px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Zap size={22} color="#60A5FA" />
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#60A5FA" }}>
                  DG Backup Diesel Level
                </span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-main)", marginTop: "10px" }}>
                {latestUtility?.dg_diesel_stock_litres ? `${latestUtility.dg_diesel_stock_litres} L` : "480 L"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                Day tank safe buffer: &gt; 250 Litres (125kVA Generator)
              </div>
            </div>
          </div>

          {/* Shift Readings Table */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            overflowX: "auto"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.7)", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Date</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Shift</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>LPG Start / End</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>LPG Consumed</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>Manifold Bar</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>EB kWh Units</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>DG Hours</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "700", color: "var(--color-gold)" }}>
                      {r.reading_date ? new Date(r.reading_date).toISOString().slice(0, 10) : "-"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "700",
                        background: r.shift === "MORNING" ? "var(--color-gold-dim)" : "rgba(147, 51, 234, 0.15)",
                        color: r.shift === "MORNING" ? "var(--color-gold)" : "#C084FC"
                      }}>
                        {r.shift}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#CBD5E1" }}>
                      {r.lpg_start_kg} kg → {r.lpg_end_kg} kg
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700", color: "#F59E0B" }}>
                      {r.lpg_consumed_kg} kg
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600" }}>
                      {r.lpg_pressure_bar} bar
                    </td>
                    <td style={{ padding: "12px 16px", color: "#60A5FA", fontWeight: "600" }}>
                      {r.eb_units_consumed} kWh
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                      {r.dg_run_hours} hrs ({r.dg_diesel_consumed_litres} L)
                    </td>
                    <td style={{ padding: "12px 16px", color: "#CBD5E1" }}>
                      {r.recorded_by || "Supervisor"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: WATER SUPPLY & FACILITY */}
      {activeTab === "water_facility" && (
        <div>
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            overflowX: "auto"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.7)", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Date</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Shift</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>Water Tankers</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>Tanker Volume (L)</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>Municipal Water (KL)</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600", textAlign: "center" }}>Kitchen RO Yield (L)</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-muted)", fontWeight: "600" }}>Shift Observations</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "700", color: "var(--color-gold)" }}>
                      {r.reading_date ? new Date(r.reading_date).toISOString().slice(0, 10) : "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                      {r.shift}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700", color: r.water_tanker_count > 0 ? "#34D399" : "var(--text-muted)" }}>
                      {r.water_tanker_count}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#60A5FA" }}>
                      {Number(r.water_tanker_litres).toLocaleString("en-IN")} L
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "#CBD5E1" }}>
                      {r.municipal_water_kl} KL
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "600", color: "#34D399" }}>
                      {Number(r.ro_plant_output_litres).toLocaleString("en-IN")} L
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                      {r.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      <NewGatePassModal
        isOpen={isNewPassModalOpen}
        onClose={() => setIsNewPassModalOpen(false)}
        onSuccess={() => {
          loadData();
          setMsg("Security gate pass generated successfully.");
          setTimeout(() => setMsg(""), 4000);
        }}
      />

      <RecordExitModal
        isOpen={!!selectedPassForExit}
        pass={selectedPassForExit}
        onClose={() => setSelectedPassForExit(null)}
        onSuccess={() => {
          loadData();
          setMsg("Vehicle outward departure logged successfully.");
          setTimeout(() => setMsg(""), 4000);
        }}
      />

      <ReconcileRgpModal
        isOpen={!!selectedPassForRgp}
        pass={selectedPassForRgp}
        onClose={() => setSelectedPassForRgp(null)}
        onSuccess={() => {
          loadData();
          setMsg("Returnable container receipt reconciled successfully.");
          setTimeout(() => setMsg(""), 4000);
        }}
      />

      <RecordUtilityReadingModal
        isOpen={isUtilityModalOpen}
        onClose={() => setIsUtilityModalOpen(false)}
        onSuccess={() => {
          loadData();
          setMsg("Shift utility reading recorded successfully.");
          setTimeout(() => setMsg(""), 4000);
        }}
      />

      <GatePassDetailModal
        isOpen={!!selectedPassForDetail}
        passId={selectedPassForDetail?.id}
        pass={selectedPassForDetail}
        onClose={() => setSelectedPassForDetail(null)}
        onUpdated={() => {
          loadData();
          setMsg("Gate pass updated.");
          setTimeout(() => setMsg(""), 3000);
        }}
      />
    </div>
  );
}
