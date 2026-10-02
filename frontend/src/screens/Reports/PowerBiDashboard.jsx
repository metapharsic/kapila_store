import { useState, useEffect, useCallback, useReducer } from "react";
import { useAppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../styles/colors";
import { authedGet, authedDownload } from "../../api/client";
import {
  BarChart2, Package, Building2, ClipboardList,
  Grid, Shield, ShoppingBag, TrendingUp, ArrowUpRight,
  FileSpreadsheet, RefreshCw, Sparkles, CalendarCheck,
  CheckCircle2, XCircle, ChevronDown
} from "lucide-react";

import AgentStatusBar          from "./components/AgentStatusBar";
import CrossModuleIntelligence from "./components/CrossModuleIntelligence";
import ItemIntelligence        from "./components/ItemIntelligence";
import VendorProfile360        from "./components/VendorProfile360";
import IndentTrace             from "./components/IndentTrace";
import CategoryDishLens        from "./components/CategoryDishLens";
import AdminControlPanel       from "./components/AdminControlPanel";
import SpendAnalytics          from "./components/SpendAnalytics";
import ConsumptionAnalytics     from "./components/ConsumptionAnalytics";
import VarianceAnalytics       from "./components/VarianceAnalytics";
import ExportReportModal       from "../../components/ExportReportModal";

// ── Initial 9-agent state ──────────────────────────────────────────────────────
const INITIAL_AGENTS = {
  sentinel: { status: "idle" },
  scout:    { status: "idle" },
  tracer:   { status: "idle" },
  ledger:   { status: "idle" },
  pogrn:    { status: "idle" },
  indent:   { status: "idle" },
  analyst:  { status: "idle" },
  veritas:  { status: "idle" },
  composer: { status: "idle" },
};

function agentReducer(state, action) {
  // action = { agentId, update: { status, count, ms, error } }
  return { ...state, [action.agentId]: { ...state[action.agentId], ...action.update } };
}

// ── EOD report granularity options ────────────────────────────────────────────
const EOD_GRANULARITY_OPTIONS = [
  { value: "overall",    label: "Overall" },
  { value: "department", label: "By Department" },
  { value: "category",   label: "By Category" },
  { value: "supplier",   label: "By Supplier" },
];

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: "intel",    label: "Intelligence Hub",   icon: <Sparkles size={14} />,      adminOnly: false },
  { id: "item",     label: "Item Intelligence",  icon: <Package size={14} />,       adminOnly: false },
  { id: "vendor",   label: "Vendor 360°",         icon: <Building2 size={14} />,     adminOnly: false },
  { id: "indent",   label: "Indent Trace",        icon: <ClipboardList size={14} />, adminOnly: false },
  { id: "category", label: "Category Lens",       icon: <Grid size={14} />,          adminOnly: false },
  { id: "admin",    label: "Admin Console",       icon: <Shield size={14} />,        adminOnly: true  },
  { id: "spend",    label: "Procurement & Spend", icon: <ShoppingBag size={14} />,   adminOnly: false },
  { id: "yield",    label: "Consumption Yield",   icon: <TrendingUp size={14} />,    adminOnly: false },
  { id: "variance", label: "Variance & Anomaly",  icon: <ArrowUpRight size={14} />,  adminOnly: false },
];

export default function PowerBiDashboard() {
  const { stocks, currentUser } = useAppContext();
  const { hasPermission } = useAuth();
  const isAdmin = !!(
    currentUser?.isAdmin ||
    currentUser?.roles?.some?.(r => ["admin"].includes(r.key || r))
  );
  const canRunEod = hasPermission?.("reports.eod_run");
  const canRunIndentIntel = hasPermission?.("reports.indent_intelligence_run");

  const [activeTab, setActiveTab]         = useState("intel");
  const [agents, dispatch]                = useReducer(agentReducer, INITIAL_AGENTS);
  const [dimensions, setDimensions]       = useState(null);
  const [dimLoading, setDimLoading]       = useState(false);
  const [isExportOpen, setIsExportOpen]   = useState(false);

  // EOD report run state
  const [eodRunning, setEodRunning]       = useState(false);
  const [eodResult, setEodResult]         = useState(null); // { ok, whatsappSent, message }
  const [eodGranularity, setEodGranularity] = useState("overall");

  // Indent & Purchase Intelligence report run state
  const [indentIntelRunning, setIndentIntelRunning] = useState(false);
  const [indentIntelResult, setIndentIntelResult]   = useState(null); // { ok, whatsappSent, message }

  // Deep-linking navigation states across tabs
  const [deepItemCode, setDeepItemCode]     = useState(null);
  const [deepSupplierId, setDeepSupplierId] = useState(null);

  // Legacy BI Studio filters
  const [globalSupplier, setGlobalSupplier]     = useState("");
  const [globalDepartment, setGlobalDepartment] = useState("");
  const [dateRange, setDateRange]               = useState("ytd");

  // Update agent state from child components (no DOM mutation)
  const updateAgent = useCallback((agentId, update) => {
    dispatch({ agentId, update });
  }, []);

  // Pre-load admin dimensions (items, vendors, indents) once
  useEffect(() => {
    setDimLoading(true);
    updateAgent("scout", { status: "running" });
    authedGet("/api/reports/admin-dimensions")
      .then(res => {
        if (res.success) {
          setDimensions(res.data);
          updateAgent("scout", { status: "done", count: (res.data.items?.length || 0) + (res.data.vendors?.length || 0) });
        } else {
          updateAgent("scout", { status: "error", error: res.error });
        }
      })
      .catch(e => updateAgent("scout", { status: "error", error: e.message }))
      .finally(() => setDimLoading(false));
  }, []);

  // Reset agent states when tab changes
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    dispatch({ agentId: "tracer",  update: { status: "idle" } });
    dispatch({ agentId: "ledger",  update: { status: "idle" } });
    dispatch({ agentId: "pogrn",   update: { status: "idle" } });
    dispatch({ agentId: "indent",  update: { status: "idle" } });
    dispatch({ agentId: "analyst", update: { status: "idle" } });
    dispatch({ agentId: "veritas", update: { status: "idle" } });
    dispatch({ agentId: "composer",update: { status: "idle" } });
    dispatch({ agentId: "sentinel",update: { status: isAdmin ? "done" : "idle" } });
  };

  const handleNavigateItem = (itemCode) => {
    setDeepItemCode(itemCode);
    handleTabChange("item");
  };

  const handleNavigateVendor = (supplierId) => {
    setDeepSupplierId(supplierId);
    handleTabChange("vendor");
  };

  // Run the End-of-Day report: hits POST /api/reports/eod/run, which streams back an
  // Excel workbook and sets X-EOD-Whatsapp-Sent to say whether the WhatsApp digest fired.
  const handleRunEodReport = async () => {
    setEodRunning(true);
    setEodResult(null);
    try {
      const res = await authedDownload(`/api/reports/eod/run?granularity=${eodGranularity}`, { method: "POST" });
      if (!res.ok) {
        let errMsg = `Failed to run EOD report (HTTP ${res.status})`;
        try {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            errMsg = json.error || json.message || errMsg;
          } catch {
            // not JSON — ignore, keep default message
          }
        } catch {
          // ignore
        }
        if (res.status === 403) errMsg = "Permission denied: you don't have access to run the EOD report.";
        setEodResult({ ok: false, message: errMsg });
        return;
      }

      const whatsappSent = res.headers.get("X-EOD-Whatsapp-Sent") === "true";
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      const filename = eodGranularity === "overall"
        ? `EOD_Report_${today}.xlsx`
        : `EOD_Report_${eodGranularity}_${today}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      setEodResult({
        ok: true,
        whatsappSent,
        message: whatsappSent
          ? "Excel downloaded. WhatsApp digest: SENT"
          : "Excel downloaded. WhatsApp digest: NOT SENT (check WhatsApp credentials in backend .env)",
      });
    } catch (e) {
      setEodResult({ ok: false, message: e.message || "Failed to run EOD report." });
    } finally {
      setEodRunning(false);
    }
  };

  // Run the Indent & Purchase Intelligence report: hits POST
  // /api/reports/indent-intelligence/run, which streams back an Excel workbook
  // and sets X-Indent-Intelligence-Whatsapp-Sent to say whether the WhatsApp
  // digest fired. NOTE: header name mirrors the EOD pattern (X-EOD-Whatsapp-Sent);
  // confirm against backend/controllers/reportController.js once that endpoint lands.
  const handleRunIndentIntelReport = async () => {
    setIndentIntelRunning(true);
    setIndentIntelResult(null);
    try {
      const res = await authedDownload("/api/reports/indent-intelligence/run", { method: "POST" });
      if (!res.ok) {
        let errMsg = `Failed to run Indent & Purchase Intelligence report (HTTP ${res.status})`;
        try {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            errMsg = json.error || json.message || errMsg;
          } catch {
            // not JSON — ignore, keep default message
          }
        } catch {
          // ignore
        }
        if (res.status === 403) errMsg = "Permission denied: you don't have access to run the Indent & Purchase Intelligence report.";
        setIndentIntelResult({ ok: false, message: errMsg });
        return;
      }

      const whatsappSent = res.headers.get("X-Indent-Intelligence-Whatsapp-Sent") === "true";
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      const filename = `Indent_Intelligence_Report_${today}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      setIndentIntelResult({
        ok: true,
        whatsappSent,
        message: whatsappSent
          ? "Excel downloaded. WhatsApp digest sent to Admin & Store Manager"
          : "Excel downloaded. WhatsApp digest NOT sent (check credentials)",
      });
    } catch (e) {
      setIndentIntelResult({ ok: false, message: e.message || "Failed to run Indent & Purchase Intelligence report." });
    } finally {
      setIndentIntelRunning(false);
    }
  };

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  const renderContent = () => {
    const legacyFilters = { globalSupplier, globalDepartment, dateRange };
    switch (activeTab) {
      case "intel":
        return (
          <CrossModuleIntelligence
            onAgentUpdate={updateAgent}
            onNavigateItem={handleNavigateItem}
            onNavigateVendor={handleNavigateVendor}
          />
        );
      case "item":
        return (
          <ItemIntelligence
            onAgentUpdate={updateAgent}
            initialItemCode={deepItemCode}
          />
        );
      case "vendor":
        return (
          <VendorProfile360
            dimensions={dimensions}
            onAgentUpdate={updateAgent}
            initialSupplierId={deepSupplierId}
          />
        );
      case "indent":
        return <IndentTrace dimensions={dimensions} onAgentUpdate={updateAgent} />;
      case "category":
        return <CategoryDishLens dimensions={dimensions} onAgentUpdate={updateAgent} />;
      case "admin":
        return <AdminControlPanel isAdmin={isAdmin} agents={agents} />;
      case "spend":
        return <SpendAnalytics filters={legacyFilters} onSupplierClick={setGlobalSupplier} />;
      case "yield":
        return <ConsumptionAnalytics filters={legacyFilters} onDepartmentClick={setGlobalDepartment} isAdmin={isAdmin} />;
      case "variance":
        return <VarianceAnalytics filters={legacyFilters} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: COLORS.bg }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "14px 20px",
        background: "#fff",
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, color: COLORS.text, display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart2 size={22} style={{ color: COLORS.brand }} />
            Intelligence Reporting Studio
            {isAdmin && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "#fef9c3", color: "#854d0e", marginLeft: 6 }}>
                ADMIN PRIVILEGED
              </span>
            )}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: COLORS.muted }}>
            9-Agent Neural Pipeline · Anomaly Detection · Data Integrity & Lineage Trace
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canRunEod && (
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <select
                  value={eodGranularity}
                  onChange={(e) => setEodGranularity(e.target.value)}
                  disabled={eodRunning}
                  title="Choose how the End-of-Day report is grouped"
                  style={{
                    appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                    padding: "8px 26px 8px 10px", fontSize: 11, fontWeight: 700,
                    background: "#fef3c7", color: "#854d0e", border: "1px solid #fde68a",
                    borderRadius: "8px 0 0 8px", borderRight: "none",
                    cursor: eodRunning ? "wait" : "pointer",
                  }}
                >
                  {EOD_GRANULARITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={12} color="#854d0e" style={{ position: "absolute", right: 8, pointerEvents: "none" }} />
              </div>
              <button
                onClick={handleRunEodReport}
                disabled={eodRunning}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                  background: eodRunning ? "#92400e" : "#854d0e", color: "#fff", border: "none",
                  borderRadius: "0 8px 8px 0", cursor: eodRunning ? "wait" : "pointer", fontSize: 12, fontWeight: 700,
                  opacity: eodRunning ? 0.8 : 1,
                }}
                title="Generate the End-of-Day Excel report and send the WhatsApp digest"
              >
                {eodRunning
                  ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                  : <CalendarCheck size={14} color="#FBBF24" />}
                {eodRunning ? "Running EOD Report…" : "Run End-of-Day Report"}
              </button>
            </div>
          )}
          {canRunIndentIntel && (
            <button
              onClick={handleRunIndentIntelReport}
              disabled={indentIntelRunning}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                background: indentIntelRunning ? "#3730a3" : "#4338ca", color: "#fff", border: "none",
                borderRadius: 8, cursor: indentIntelRunning ? "wait" : "pointer", fontSize: 12, fontWeight: 700,
                opacity: indentIntelRunning ? 0.8 : 1,
              }}
              title="Generate the Indent & Purchase Intelligence Excel report and send the WhatsApp digest"
            >
              {indentIntelRunning
                ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                : <TrendingUp size={14} color="#A5B4FC" />}
              {indentIntelRunning ? "Running Indent Report…" : "Run Indent & Purchase Report"}
            </button>
          )}
          <button
            onClick={() => setIsExportOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#0F172A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            <FileSpreadsheet size={14} color="#FBBF24" /> Export Excel
          </button>
        </div>
      </div>

      {eodResult && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "10px 20px",
          background: eodResult.ok ? (eodResult.whatsappSent ? "#ecfdf5" : "#fff7ed") : "#fef2f2",
          borderBottom: `1px solid ${eodResult.ok ? (eodResult.whatsappSent ? "#a7f3d0" : "#fed7aa") : "#fecaca"}`,
          fontSize: 12,
          color: eodResult.ok ? (eodResult.whatsappSent ? "#065f46" : "#9a3412") : "#991b1b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {eodResult.ok
              ? <CheckCircle2 size={14} />
              : <XCircle size={14} />}
            {eodResult.message}
          </div>
          <button
            onClick={() => setEodResult(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", fontWeight: 700 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {indentIntelResult && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "10px 20px",
          background: indentIntelResult.ok ? (indentIntelResult.whatsappSent ? "#eef2ff" : "#fff7ed") : "#fef2f2",
          borderBottom: `1px solid ${indentIntelResult.ok ? (indentIntelResult.whatsappSent ? "#c7d2fe" : "#fed7aa") : "#fecaca"}`,
          fontSize: 12,
          color: indentIntelResult.ok ? (indentIntelResult.whatsappSent ? "#3730a3" : "#9a3412") : "#991b1b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {indentIntelResult.ok
              ? <CheckCircle2 size={14} />
              : <XCircle size={14} />}
            {indentIntelResult.message}
          </div>
          <button
            onClick={() => setIndentIntelResult(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", fontWeight: 700 }}
          >
            Dismiss
          </button>
        </div>
      )}

      <ExportReportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />

      {/* ── AGENT STATUS BAR ───────────────────────────────────────────────── */}
      <div style={{ padding: "10px 20px 0", background: "#fff", borderBottom: `1px solid ${COLORS.border}` }}>
        <AgentStatusBar agents={agents} compact={false} />
      </div>

      {/* ── TAB BAR ────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        padding: "0 20px",
        background: "#fff",
        borderBottom: `1px solid ${COLORS.border}`,
        gap: 2,
        overflowX: "auto",
      }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              border: "none",
              borderBottom: activeTab === tab.id ? `3px solid ${COLORS.brand}` : "3px solid transparent",
              background: "transparent",
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? COLORS.text : COLORS.muted,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            {tab.icon} {tab.label}
            {tab.adminOnly && (
              <Shield size={10} color="#f59e0b" />
            )}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {dimLoading && activeTab !== "spend" && activeTab !== "yield" && activeTab !== "variance" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
            background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 14, fontSize: 12, color: "#854d0e"
          }}>
            <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
            Agent Scout is indexing enterprise dimensions (items, vendors, indents, recipes)…
          </div>
        )}
        {renderContent()}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
