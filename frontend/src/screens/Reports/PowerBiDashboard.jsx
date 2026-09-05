import { useState, useMemo } from "react";
import { useAppContext } from "../../context/AppContext";
import { COLORS } from "../../styles/colors";
import { BarChart2, ShoppingBag, ArrowUpRight, TrendingUp, Filter, Download, FileSpreadsheet } from "lucide-react";
import { useBreakpoint } from "../../styles/responsive";

import SpendAnalytics from "./components/SpendAnalytics";
import ConsumptionAnalytics from "./components/ConsumptionAnalytics";
import VarianceAnalytics from "./components/VarianceAnalytics";
import ExportReportModal from "../../components/ExportReportModal";

export default function PowerBiDashboard() {
  const { stocks } = useAppContext();
  const { isMobile } = useBreakpoint();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Cross-filtering States
  const [activeLens, setActiveLens] = useState("procurement");
  const [globalSupplier, setGlobalSupplier] = useState("");
  const [globalDepartment, setGlobalDepartment] = useState("");
  const [dateRange, setDateRange] = useState("ytd"); // 'mtd', 'ytd', 'custom'

  // Extract dimensions for Slicers
  const uniqueSuppliers = useMemo(() => Array.from(new Set(stocks.map(s => s.supplier).filter(Boolean))), [stocks]);
  
  // For MVP, using hardcoded departments to match the spec
  const departments = ["TIFFINS", "STAFF", "SI-MEALS", "NORTH INDIAN", "CHAT & SOFTY", "CHINESE & DOSA", "MOCKTAILS & CONTINENTAL", "RESTAURANT", "ROOM SERVICE"];

  const renderActiveLens = () => {
    const filters = { globalSupplier, globalDepartment, dateRange };
    switch (activeLens) {
      case "procurement":
        return <SpendAnalytics filters={filters} onSupplierClick={setGlobalSupplier} />;
      case "yield":
        return <ConsumptionAnalytics filters={filters} onDepartmentClick={setGlobalDepartment} />;
      case "variance":
        return <VarianceAnalytics filters={filters} />;
      default:
        return <SpendAnalytics filters={filters} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: COLORS.bg }}>
      
      {/* HEADER */}
      <div style={{ padding: "16px 24px", backgroundColor: "#fff", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, color: COLORS.text, display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart2 size={24} style={{ color: COLORS.brand }} /> 
            Enterprise BI Studio
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>Interactive cross-filtering reporting module</p>
        </div>
        <button 
          onClick={() => setIsExportModalOpen(true)}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 8, 
            padding: "9px 18px", 
            backgroundColor: "#0F172A", 
            color: "#FFFFFF", 
            border: "none", 
            borderRadius: 8, 
            cursor: "pointer", 
            fontSize: 13, 
            fontWeight: 600,
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}
        >
          <FileSpreadsheet size={16} color="#FBBF24" /> Export Complete Inventory (Excel)
        </button>
      </div>

      <ExportReportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        
        {/* SLICER PANEL (LEFT SIDEBAR) */}
        {!isMobile && (
          <div style={{ width: 260, backgroundColor: "#fff", borderRight: `1px solid ${COLORS.border}`, padding: 20, overflowY: "auto" }}>
            <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.muted, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={14} /> Global Slicers
            </h3>

            {/* Time Slicer */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8, display: "block" }}>Time Period</label>
              <select 
                value={dateRange} 
                onChange={e => setDateRange(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13 }}
              >
                <option value="mtd">Month to Date (MTD)</option>
                <option value="ytd">Year to Date (YTD)</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Supplier Slicer */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8, display: "block" }}>Supplier Pivot</label>
              <select 
                value={globalSupplier} 
                onChange={e => setGlobalSupplier(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13 }}
              >
                <option value="">All Suppliers</option>
                {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {globalSupplier && (
                <button onClick={() => setGlobalSupplier("")} style={{ fontSize: 11, color: COLORS.danger, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginTop: 4 }}>Clear Supplier Filter</button>
              )}
            </div>

            {/* Department Slicer */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8, display: "block" }}>Department Pivot</label>
              <select 
                value={globalDepartment} 
                onChange={e => setGlobalDepartment(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13 }}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {globalDepartment && (
                <button onClick={() => setGlobalDepartment("")} style={{ fontSize: 11, color: COLORS.danger, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginTop: 4 }}>Clear Department Filter</button>
              )}
            </div>
          </div>
        )}

        {/* MAIN DASHBOARD AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          
          {/* Dashboard Tabs */}
          <div style={{ display: "flex", padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}`, backgroundColor: "#fff", gap: 8, overflowX: "auto" }}>
            {[
              { id: "procurement", label: "Procurement & Spend", icon: <ShoppingBag size={14} /> },
              { id: "yield", label: "Consumption Yield", icon: <TrendingUp size={14} /> },
              { id: "variance", label: "Variance & Anomalies", icon: <ArrowUpRight size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveLens(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 13,
                  fontWeight: activeLens === tab.id ? 600 : 500,
                  color: activeLens === tab.id ? "#fff" : COLORS.muted,
                  backgroundColor: activeLens === tab.id ? COLORS.brand : "transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Render Active Dashboard content */}
          <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
            {renderActiveLens()}
          </div>

        </div>
      </div>
    </div>
  );
}
