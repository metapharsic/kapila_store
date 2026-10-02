import React, { useState, useEffect, useMemo } from "react";
import kapilaLogo from "../../assets/kapila-logo.png";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Bell, User, CheckCircle, AlertTriangle, Info, ArrowRight, Activity, Package, Layers, TrendingUp, Clock, ClipboardList, Send, ChefHat, ArchiveRestore, Trash2, ClipboardCheck } from "lucide-react";
import * as api from "../../api";
import { useAppContext } from "../../context/AppContext";

import { COLORS as THEME } from "../../styles/colors";

// --- UTILS ---
const todayStr = () => new Date().toISOString().slice(0, 10);
const toTitleCase = (str) => {
  if (!str) return "";
  return str.trim().toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

// --- ANIMATED NUMBER COUNTER ---
const AnimatedNumber = ({ value, formatter = (v) => v }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const duration = 1000;
    const finalValue = parseFloat(value) || 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(easeProgress * finalValue);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(finalValue);
      }
    };
    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{formatter(displayValue)}</span>;
};

// --- COMPONENTS ---
const Card = ({ children, style, className = "", onClick }) => (
  <div
    className={className}
    onClick={onClick}
    style={{
      backgroundColor: THEME.card,
      border: `1px solid ${THEME.border}`,
      borderRadius: "12px",
      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      padding: "16px 20px",
      cursor: onClick ? "pointer" : "default",
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ title }) => (
  <div style={{ paddingBottom: "12px", borderBottom: `1px solid ${THEME.border}`, marginBottom: "16px" }}>
    <h3 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: THEME.text, fontWeight: 600 }}>
      {title}
    </h3>
  </div>
);

// --- MAIN DASHBOARD ---
export default function Dashboard() {
  const { setCurrentScreen } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data States
  const [summaryData, setSummaryData] = useState(null);
  const [openAuditsCount, setOpenAuditsCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState([]);
  const [bestRates, setBestRates] = useState([]);
  const [priceTrend, setPriceTrend] = useState({ name: "Trend", data: [] });
  const [pendingPOs, setPendingPOs] = useState(0);
  const [anomalies, setAnomalies] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [indentFunnel, setIndentFunnel] = useState(null);
  
  // Clock Tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data
  const fetchAllData = async () => {
    try {
      // 1. Fetch main dashboard summary & audits summary
      const [summaryRes, auditSummaryRes, anomaliesRes, indentFunnelRes] = await Promise.all([
        api.dashboard.summary(todayStr()),
        api.audits.summary().catch(() => ({ data: { open: 0 } })),
        api.anomalies.list({ status: "UNREAD" }).catch(() => ({ data: [] })),
        api.dashboard.indentFunnel().catch(() => ({ data: null }))
      ]);
      setIndentFunnel(indentFunnelRes.data);
      
      // 2. Fetch recent lists to build activity feed & other widgets
      // We limit to 15 to get enough recent events to sort
      const [stockRes, indentsRes, issuancesRes, prodRes, leftRes, poRes] = await Promise.all([
        api.stock.list({ limit: 50, sort: "created_at", order: "desc" }).catch(() => ({ data: [] })),
        api.indents.list({ limit: 15, sort: "created_at", order: "desc" }).catch(() => ({ data: [] })),
        api.issuances.list({ limit: 15, sort: "created_at", order: "desc" }).catch(() => ({ data: [] })),
        api.production.list({ limit: 15, sort: "created_at", order: "desc" }).catch(() => ({ data: [] })),
        api.leftovers.list({ limit: 15, sort: "created_at", order: "desc" }).catch(() => ({ data: [] })),
        api.purchaseOrders.list({ status: "pending", limit: 50 }).catch(() => ({ data: [] }))
      ]);

      setSummaryData(summaryRes.data);
      setOpenAuditsCount(auditSummaryRes.data?.open || 0);
      setPendingPOs(poRes.data?.filter(po => po.status?.toLowerCase() === 'pending').length || 0);

      // Build Activity Feed
      const events = [];
      const addEvents = (items, type, color, msgFn) => {
        if (items && Array.isArray(items)) {
          items.forEach((item, idx) => {
            const itemId = item.id != null ? item.id : (item.name || idx);
            events.push({
              id: `${type}-${itemId}-${idx}`,
              type,
              color,
              timestamp: new Date(item.created_at || item.date || new Date()).getTime(),
              message: msgFn(item)
            });
          });
        }
      };

      addEvents(stockRes.data, "stock", THEME.success, (item) => `Received ${item.qty} ${item.unit} of ${item.name}`);
      addEvents(indentsRes.data, "indent", THEME.primary, (item) => `New indent requested by ${item.dept || item.department || "Unknown Department"}`);
      addEvents(issuancesRes.data, "issuance", THEME.neutral, (item) => `Issued items to ${item.dept || item.department || "Unknown Department"}`);
      addEvents(prodRes.data, "production", THEME.primary, (item) => `Produced ${item.plates || 0} plates for ${item.dept || item.department || "Unknown Department"}`);
      addEvents(leftRes.data, "leftover", THEME.warning, (item) => `Logged ${item.qty} leftover for ${item.item}`);
      
      // Add alerts as events
      if (summaryRes.data?.low_stock_items) {
        summaryRes.data.low_stock_items.forEach((alert, idx) => {
           const alertId = alert.id != null ? alert.id : `${alert.item_code || alert.name || "item"}-${idx}`;
           events.push({
             id: `alert-${alertId}-${idx}`,
             type: "alert",
             color: THEME.danger,
             timestamp: new Date().getTime(),
             message: `Critical: ${alert.name} running low (${alert.remaining} remaining)`
           });
        });
      }

      events.sort((a, b) => b.timestamp - a.timestamp);
      setRecentEvents(events.slice(0, 10)); // Top 10

      // Calculate Best Rates
      const uniqueStockMap = {};
      (stockRes.data || []).forEach(s => {
         if (s.price && s.supplier) {
             if (!uniqueStockMap[s.name] || s.price < uniqueStockMap[s.name].price) {
                 uniqueStockMap[s.name] = s;
             }
         }
      });
      const topRates = Object.values(uniqueStockMap).slice(0, 2);
      setBestRates(topRates);

      const trendName = topRates.length > 0 ? topRates[0].name : "Rice";
      const tData = (stockRes.data || [])
          .filter(s => s.name === trendName && s.price)
          .map(s => ({ val: parseFloat(s.price) }))
          .reverse();
      if (tData.length === 0) tData.push({val: 0});
      setPriceTrend({ name: trendName, data: tData });

      setPendingPOs(poRes.data?.filter(po => po.status !== "Received").length || 0);
      setAnomalies(anomaliesRes.data || []);

      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard data. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && !summaryData) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        height: "100vh", gap: 20,
        backgroundColor: THEME.bg
      }}>
        <div style={{
          background: "#1E293B",
          borderRadius: 16,
          padding: "18px 36px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          animation: "logoFadeIn 0.5s ease-out"
        }}>
          <img src={kapilaLogo} alt="Kapila" style={{ height: 40, width: "auto", display: "block" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: THEME.muted, fontSize: 13 }}>
          <span className="pulse" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: THEME.success }} />
          Loading dashboard…
        </div>
        <style>{`@keyframes logoFadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
      </div>
    );
  }
  if (error && !summaryData) {
    return <div style={{ padding: 40, backgroundColor: THEME.bg }}><p style={{ color: THEME.danger }}>{error}</p></div>;
  }

  // Derived Data
  const safeSummaryData = summaryData || {};
  const { 
    kpis = {}, 
    dept_stats = [], 
    low_stock_items = [], 
    weekly_waste = [] 
  } = safeSummaryData;
  const wasteRate = (kpis.today_plates || 0) > 0 ? ((kpis.today_leftovers || 0) / kpis.today_plates) * 100 : 0;
  
  // KPI Config
  const kpiCards = [
    { label: "Total Stock Items", value: kpis.total_stock || 0, color: THEME.primary, delta: "Active inventory", icon: <Package size={18} />, onClick: () => setCurrentScreen("stock") },
    { label: "Pending Indents", value: kpis.pending_indents || 0, color: (kpis.pending_indents || 0) > 0 ? THEME.warning : THEME.success, delta: (kpis.pending_indents || 0) > 0 ? "Requires action" : "All cleared", icon: <ClipboardList size={18} />, onClick: () => setCurrentScreen("indent") },
    { label: "Today's Issuances", value: kpis.today_issuances || 0, color: THEME.success, delta: "Issued today", icon: <Send size={18} />, onClick: () => setCurrentScreen("issuance") },
    { label: "Plates Produced", value: kpis.today_plates || 0, color: THEME.primary, delta: "Across all depts", icon: <ChefHat size={18} />, onClick: () => setCurrentScreen("production") },
    { label: "Leftover Qty", value: kpis.today_leftovers || 0, color: (kpis.today_leftovers || 0) > 0 ? THEME.warning : THEME.success, delta: "Recorded today", icon: <ArchiveRestore size={18} />, onClick: () => setCurrentScreen("production") },
    { label: "Overall Waste Rate", value: wasteRate, formatter: (v) => v.toFixed(1) + "%", color: (kpis.today_plates || 0) === 0 ? THEME.neutral : wasteRate > 2 ? THEME.danger : wasteRate > 1 ? THEME.warning : THEME.success, delta: (kpis.today_plates || 0) === 0 ? "No production" : wasteRate > 2 ? "Above target" : "On track", icon: <Trash2 size={18} /> },
    {
      label: "Open Audits",
      value: openAuditsCount,
      color: openAuditsCount > 0 ? THEME.warning : THEME.success,
      delta: openAuditsCount > 0 ? "Reconciliation active" : "Up to date",
      icon: <ClipboardCheck size={18} />,
      onClick: () => {
        localStorage.setItem("kapila_audit_filter", "in_progress");
        setCurrentScreen("audit");
      }
    }
  ];

  // Stock Health Pie Data
  const safeTotalStock = kpis.total_stock || 0;
  const healthyCount = safeTotalStock - (low_stock_items || []).length;
  const pieData = [
    { name: "Healthy", value: healthyCount > 0 ? healthyCount : 1, color: THEME.chart1 }, // default to 1 so pie renders even if empty realistically
    { name: "Low Stock", value: (low_stock_items || []).length, color: THEME.warning }
  ];
  if (safeTotalStock === 0) pieData[0].value = 0; // if actually 0
  const healthyPct = safeTotalStock > 0 ? Math.round((healthyCount / safeTotalStock) * 100) : 100;

  // Alerts merge
  const alertsList = [
    ...low_stock_items.map((s, idx) => ({
      id: `ls-${s.id || s.item_code || s.name}-${idx}`,
      title: "Low Stock",
      detail: `${s.name} is at ${parseFloat(s.remaining).toFixed(1)} ${s.unit} (${s.pct}% left)`,
      color: THEME.danger,
      icon: <AlertTriangle size={16} color={THEME.danger} />
    }))
  ];
  // Normally would add expiring items and pending indents here too, but we will fake pending indents if > 0
  if (kpis.pending_indents > 0) {
    alertsList.push({
      id: "pi-summary",
      title: "Pending Indents",
      detail: `${kpis.pending_indents} department requests awaiting approval.`,
      color: THEME.warning,
      icon: <Info size={16} color={THEME.warning} />
    });
  }

  // Dept max waste rate
  let maxWasteRateDept = "";
  let maxWasteVal = -1;
  dept_stats.forEach(d => {
    if (d.waste_rate_pct > maxWasteVal) {
      maxWasteVal = d.waste_rate_pct;
      maxWasteRateDept = d.dept;
    }
  });

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", backgroundColor: THEME.bg, minHeight: "100vh", paddingBottom: 40 }}>
      <div className="dash-main-container" style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1600px", margin: "0 auto" }}>
        
        {/* SECTION 1: WELCOME BANNER */}
        <Card style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {/* Logo pill */}
            <div style={{
              background: "#1E293B",
              borderRadius: 8,
              padding: "5px 14px",
              display: "flex", alignItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)"
            }}>
              <img src={kapilaLogo} alt="Kapila" style={{ height: 22, width: "auto", display: "block" }} />
            </div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: THEME.text }}>Hotel Kapila</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: THEME.muted, fontSize: "14px" }}>
              <Clock size={16} />
              <span>{currentTime.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} • {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ backgroundColor: `${THEME.primary}15`, color: THEME.primary, padding: "6px 16px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>Admin</span>
            {/* Live Pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: `${THEME.success}15`, color: THEME.success, padding: "6px 16px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>
              <div className="pulse-dot" style={{ width: 8, height: 8, backgroundColor: THEME.success, borderRadius: "50%" }}></div>
              System Live
            </div>
          </div>
        </Card>
        
        {/* SECTION 1.5: SECURITY & ANOMALIES */}
        {anomalies.length > 0 && (
          <Card style={{ padding: "16px 24px", borderLeft: `4px solid ${THEME.danger}`, backgroundColor: `${THEME.danger}08` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={20} color={THEME.danger} />
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: THEME.danger }}>Security & Anomalies Detected</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {anomalies.map(alert => (
                <div key={alert.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: THEME.card, padding: "12px 16px", borderRadius: 8, border: `1px solid ${THEME.border}` }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: THEME.text }}>{alert.department} - {alert.item}</div>
                    <div style={{ fontSize: 13, color: THEME.muted, marginTop: 4 }}>{alert.description}</div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await api.anomalies.update(alert.id, { status: "RESOLVED" });
                        setAnomalies(prev => prev.filter(a => a.id !== alert.id));
                      } catch(e) {
                        console.error("Failed to resolve alert", e);
                      }
                    }}
                    style={{
                      background: THEME.success, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {/* SECTION 2: KPI SUMMARY ROW */}
        <div className="dash-grid-auto-fit" style={{ display: "grid", gap: "20px" }}>
          {kpiCards.map((kpi, i) => {
            const isFeatured = i === 0;
            return (
              <Card 
                key={i} 
                onClick={kpi.onClick}
                style={{ 
                  display: "flex", gap: "16px", alignItems: "center", padding: "16px 20px",
                  ...(isFeatured ? {
                    background: `linear-gradient(135deg, ${THEME.brand} 0%, ${THEME.brandDark} 100%)`,
                    color: "#fff",
                    border: "none",
                  } : {}),
                  ...kpi.style
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: isFeatured ? "rgba(255,255,255,0.2)" : kpi.color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isFeatured ? "#fff" : kpi.color, flexShrink: 0
                }}>
                  {kpi.icon}
                </div>
                <div>
                  <p style={{ fontSize: 11, color: isFeatured ? "rgba(255,255,255,0.8)" : THEME.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                    {kpi.label}
                  </p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: isFeatured ? "#fff" : kpi.color, lineHeight: 1.2, fontVariantNumeric: "tabular-nums", margin: "4px 0" }}>
                    <AnimatedNumber value={kpi.value} formatter={kpi.formatter} />
                  </p>
                  <p style={{ fontSize: 11, color: isFeatured ? "rgba(255,255,255,0.7)" : THEME.muted, margin: 0 }}>
                    {kpi.delta}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* SECTION 3: ANALYTICS ROW */}
        <div className="dash-grid-2-1-1" style={{ display: "grid", gap: "20px" }}>
          {/* Panel A - Weekly Waste Trend */}
          <Card style={{ padding: "20px" }}>
            <SectionTitle title="Weekly Waste Trend" />
            <div style={{ height: 240, width: "100%", minHeight: 240, minWidth: 0, position: "relative" }}>
              {weekly_waste && weekly_waste.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={weekly_waste} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWaste" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME.brand} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={THEME.brand} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.border} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: THEME.muted }}
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { weekday: 'short' })}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: THEME.muted }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: `1px solid ${THEME.border}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      formatter={(value, name, props) => [`${value}%`, "Waste Rate"]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    />
                    <ReferenceLine y={2} stroke={THEME.danger} strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Target threshold 2%', fill: THEME.danger, fontSize: 10 }} />
                    <Area type="monotone" dataKey="waste_rate_pct" stroke={THEME.brand} strokeWidth={3} fillOpacity={1} fill="url(#colorWaste)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: THEME.muted, fontSize: "13px" }}>No data yet for this week</div>
              )}
            </div>
          </Card>

          {/* Panel B - Production by Dept */}
          <Card style={{ padding: "20px" }}>
            <SectionTitle title="Production by Dept" />
            <div style={{ height: 240, width: "100%", minHeight: 240, minWidth: 0, position: "relative" }}>
              {dept_stats && dept_stats.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dept_stats} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={THEME.border} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="dept" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: THEME.muted }}
                      width={110}
                      tickFormatter={(val) => toTitleCase(val)}
                    />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: `1px solid ${THEME.border}` }}/>
                    <Bar dataKey="total_plates" radius={[0, 4, 4, 0]} barSize={16}>
                      {dept_stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          index % 4 === 0 ? THEME.chart1 :
                          index % 4 === 1 ? THEME.chart2 :
                          index % 4 === 2 ? THEME.chart3 : THEME.chart4
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: THEME.muted, fontSize: "13px" }}>No production data today</div>
              )}
            </div>
          </Card>

          {/* Panel C - Stock Health Donut */}
          <Card style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
            <SectionTitle title="Stock Health" />
            <div style={{ height: 160, minHeight: 160, width: "100%", minWidth: 0, position: "relative" }}>
              {kpis.total_stock > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0,
                    height: 160,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none"
                  }}>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: THEME.text }}>{healthyPct}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "16px" }}>
                    {pieData.map(d => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: THEME.muted }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: d.color }}></div>
                        {d.name} ({d.value})
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: THEME.muted, fontSize: "13px" }}>No stock items</div>
              )}
            </div>
          </Card>
        </div>

        {/* SECTION 4: BOTTOM ROW */}
        <div className="dash-grid-2-1-1" style={{ display: "grid", gap: "20px" }}>
          
          {/* Panel D - Department Overview Table */}
          <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px" }}>
              <SectionTitle title="Department Overview" />
            </div>
            <div className="resp-table-wrap" style={{ flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ color: THEME.muted, fontSize: "11px", textTransform: "uppercase" }}>
                    <th style={{ padding: "0 20px 12px", fontWeight: 600, position: "sticky", top: 0, backgroundColor: THEME.card, zIndex: 1, borderBottom: `1px solid ${THEME.border}` }}>Department</th>
                    <th style={{ padding: "0 20px 12px", fontWeight: 600, position: "sticky", top: 0, backgroundColor: THEME.card, zIndex: 1, borderBottom: `1px solid ${THEME.border}` }}>Plates</th>
                    <th style={{ padding: "0 20px 12px", fontWeight: 600, position: "sticky", top: 0, backgroundColor: THEME.card, zIndex: 1, borderBottom: `1px solid ${THEME.border}` }}>Issuances</th>
                    <th style={{ padding: "0 20px 12px", fontWeight: 600, position: "sticky", top: 0, backgroundColor: THEME.card, zIndex: 1, borderBottom: `1px solid ${THEME.border}` }}>Leftover Qty</th>
                    <th style={{ padding: "0 20px 12px", fontWeight: 600, position: "sticky", top: 0, backgroundColor: THEME.card, zIndex: 1, borderBottom: `1px solid ${THEME.border}` }}>Waste Rate</th>
                    <th style={{ padding: "0 20px 12px", fontWeight: 600, position: "sticky", top: 0, backgroundColor: THEME.card, zIndex: 1, borderBottom: `1px solid ${THEME.border}` }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dept_stats && dept_stats.length > 0 ? dept_stats.map((d, i) => {
                    const isMaxWaste = (d.dept === maxWasteRateDept && d.waste_rate_pct > 0);
                    let statusColor = THEME.success;
                    let statusText = "On Track";
                    if (d.total_plates === 0) { statusColor = THEME.neutral; statusText = "No Prod"; }
                    else if (d.waste_rate_pct > 2) { statusColor = THEME.danger; statusText = "Critical"; }
                    else if (d.waste_rate_pct > 1) { statusColor = THEME.warning; statusText = "Watch"; }

                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${THEME.border}`, backgroundColor: isMaxWaste ? `${THEME.warning}0A` : 'transparent' }}>
                        <td style={{ padding: "14px 20px", fontWeight: 500, color: THEME.text }}>{toTitleCase(d.dept)}</td>
                        <td style={{ padding: "14px 20px", color: THEME.text }}>{d.total_plates}</td>
                        <td style={{ padding: "14px 20px", color: THEME.text }}>{d.total_issuances}</td>
                        <td style={{ padding: "14px 20px", color: d.total_leftover_qty > 0 ? THEME.warning : THEME.text, fontWeight: d.total_leftover_qty > 0 ? 600 : 400 }}>{d.total_leftover_qty}</td>
                        <td style={{ padding: "14px 20px", color: THEME.text }}>{d.waste_rate_pct}%</td>
                        <td style={{ padding: "14px 20px" }}>
                          <span style={{ backgroundColor: `${statusColor}15`, color: statusColor, padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="6" style={{ padding: "30px", textAlign: "center", color: THEME.muted }}>No department activity today</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Panel D2 - Indent Pipeline (funnel + stuck indents) */}
          {indentFunnel && (
            <Card style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
              <SectionTitle title="Indent Pipeline" />
              <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                {["pending", "approved", "partial", "issued", "cancelled"].map((s) => (
                  <div key={s} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s === "approved" && indentFunnel.stuck?.length ? THEME.danger : THEME.text }}>
                      {indentFunnel.funnel[s] || 0}
                    </div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: THEME.muted, letterSpacing: "0.05em" }}>{s}</div>
                  </div>
                ))}
              </div>
              {indentFunnel.stuck?.length > 0 && (
                <div style={{ flex: 1, overflowY: "auto", maxHeight: 200 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: THEME.danger, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                    Approved, Never Issued ({indentFunnel.stuck.length})
                  </p>
                  {indentFunnel.stuck.map((s, idx) => (
                    <div key={`${s.id || "stuck"}-${idx}`} onClick={() => setCurrentScreen("issuance")} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${THEME.border}`, cursor: "pointer" }}>
                      <span style={{ fontSize: 12.5, color: THEME.text }}>#{s.id} · {s.dept}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: s.age_hours >= 8 ? THEME.danger : THEME.warning }}>
                        {s.age_hours}h waiting{s.last_event ? ` · last: ${s.last_event}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Panel E - Alerts & Actions */}
          <Card style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
            <SectionTitle title="Alerts & Actions" />
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "280px", paddingRight: "8px" }}>
              {alertsList.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px", color: THEME.success }}>
                  <CheckCircle size={40} strokeWidth={1.5} />
                  <p style={{ fontWeight: 500, fontSize: "14px" }}>All systems healthy</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {alertsList.map(alert => (
                    <div key={alert.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "8px", backgroundColor: `${alert.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {alert.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: THEME.text, margin: "0 0 2px" }}>{alert.title}</p>
                        <p style={{ fontSize: "12px", color: THEME.muted, margin: 0, lineHeight: 1.4 }}>{alert.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Panel F - Recent Activity Feed */}
          <Card style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
            <SectionTitle title="Recent Activity" />
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "280px", paddingRight: "8px" }}>
              {recentEvents.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: THEME.muted, fontSize: "13px" }}>No recent events</div>
              ) : (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: "7px", top: 10, bottom: 10, width: "1px", backgroundColor: THEME.border, zIndex: 1 }}></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "relative", zIndex: 2 }}>
                    {recentEvents.map(ev => {
                      // Relative time
                      const diffMs = new Date().getTime() - ev.timestamp;
                      const diffMins = Math.floor(diffMs / 60000);
                      const timeStr = diffMins < 60 ? (diffMins <= 1 ? "Just now" : `${diffMins} mins ago`) : 
                                      diffMins < 1440 ? `${Math.floor(diffMins/60)} hrs ago` : `${Math.floor(diffMins/1440)} days ago`;
                      
                      return (
                        <div key={ev.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                          <div style={{ width: 15, height: 15, borderRadius: "50%", backgroundColor: THEME.card, border: `3px solid ${ev.color}`, marginTop: "2px", flexShrink: 0 }}></div>
                          <div>
                            <p style={{ fontSize: "13px", color: THEME.text, margin: "0 0 2px", lineHeight: 1.4 }}>{ev.message}</p>
                            <p style={{ fontSize: "11px", color: THEME.neutral, margin: 0 }}>{timeStr}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* SECTION 5: SUPPLIER INTELLIGENCE STRIP */}
        <Card style={{ padding: "20px" }}>
          <SectionTitle title="Intelligence & Procurement" />
          <div className="dash-grid-1-1-1" style={{ display: "grid", gap: "40px", alignItems: "center" }}>
            
            {/* Cheapest Supplier Mini-table */}
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: THEME.muted, marginBottom: "12px", textTransform: "uppercase" }}>Best Rates This Week</p>
              <table style={{ width: "100%", fontSize: "13px", textAlign: "left" }}>
                <tbody>
                  {bestRates.length > 0 ? bestRates.map((rate, i) => (
                    <tr key={i}>
                      <td style={{ padding: "6px 0", color: THEME.text, fontWeight: 500 }}>{rate.name}</td>
                      <td style={{ padding: "6px 0", color: THEME.muted }}>{rate.supplier}</td>
                      <td style={{ padding: "6px 0", color: THEME.success, fontWeight: 600 }}>₹{rate.price}/{rate.unit}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="3" style={{ padding: "6px 0", color: THEME.muted }}>No pricing data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pending POs */}
            <div className="dash-pending-po-col" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: THEME.muted, textTransform: "uppercase" }}>Pending Purchase Orders</span>
              <div style={{ fontSize: "36px", fontWeight: 700, color: THEME.primary, margin: "8px 0" }}>{pendingPOs}</div>
              <button style={{ backgroundColor: `${THEME.primary}15`, color: THEME.primary, border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                View POs <ArrowRight size={14} />
              </button>
            </div>

            {/* Price Trend Sparkline */}
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: THEME.muted, marginBottom: "8px", textTransform: "uppercase" }}>{priceTrend.name} Price Trend (Recent)</p>
              <div style={{ height: 60, width: "100%", minHeight: 60, minWidth: 0, position: "relative" }}>
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={priceTrend.data}>
                    <Line type="monotone" dataKey="val" stroke={THEME.primary} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </Card>

      </div>

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(29, 158, 117, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(29, 158, 117, 0); }
          100% { box-shadow: 0 0 0 0 rgba(29, 158, 117, 0); }
        }
        .pulse-dot {
          animation: pulse 2s infinite;
        }

        /* Responsive Grid Adjustments */
        .dash-main-container {
          padding: 32px;
        }
        .dash-grid-auto-fit {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
        .dash-grid-2-1-1 {
          grid-template-columns: 2fr 1fr 1fr;
        }
        .dash-grid-1-1-1 {
          grid-template-columns: 1fr 1fr 1fr;
        }
        .dash-pending-po-col {
          border-left: 1px solid ${THEME.border};
          border-right: 1px solid ${THEME.border};
          padding: 0 40px;
        }

        @media (max-width: 1280px) {
          .dash-grid-auto-fit {
            grid-template-columns: repeat(3, 1fr);
          }
          .dash-grid-2-1-1 {
            grid-template-columns: 1fr;
          }
          .dash-grid-1-1-1 {
            grid-template-columns: 1fr;
          }
          .dash-pending-po-col {
            border-left: none;
            border-right: none;
            border-top: 1px solid ${THEME.border};
            border-bottom: 1px solid ${THEME.border};
            padding: 20px 0;
            margin: 20px 0;
          }
        }
        @media (max-width: 768px) {
          .dash-grid-auto-fit {
            grid-template-columns: repeat(2, 1fr);
          }
          .dash-main-container {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
