import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import * as api from "../../api";
import { useAppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { ChevronRight, ArrowLeft, TrendingUp, TrendingDown, Info } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

export default function ChefStatsScreen() {
  const { setCurrentScreen } = useAppContext();
  const { roles = [] } = useAuth();
  const isChef = roles.some((r) => r.key === "chef");
  const [view, setView] = useState("overview"); // 'overview' | 'detail'
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data states
  const [overviewData, setOverviewData] = useState([]);
  const [detailData, setDetailData] = useState(null);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.chefStats.overview({ date_from: dateFrom, date_to: dateTo });
      if (res.success) {
        setOverviewData(res.data);
      } else {
        throw new Error(res.error || "Failed to load overview");
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (deptId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.chefStats.detail(deptId, { date_from: dateFrom, date_to: dateTo });
      if (res.success) {
        setDetailData(res.data);
      } else {
        throw new Error(res.error || "Failed to load detail");
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === "overview") {
      loadOverview();
    } else if (view === "detail" && selectedDeptId) {
      loadDetail(selectedDeptId);
    }
  }, [view, selectedDeptId, dateFrom, dateTo]);

  const handleDeptClick = (id) => {
    setSelectedDeptId(id);
    setView("detail");
  };

  const handleBack = () => {
    setView("overview");
    setSelectedDeptId(null);
    setDetailData(null);
  };

  const exportToCSV = () => {
    if (!overviewData || !overviewData.length) return;
    
    const headers = [
      "Department", "Chef Name", "Plates Produced", "Items Issued", 
      "Material Cost (Rs)", "Cost/Plate (Rs)", "Waste Rate (%)", 
      "Total Anomalies", "Efficiency Score"
    ];
    
    const rows = overviewData.map(d => [
      d.dept_name,
      d.chef_name,
      d.total_plates,
      d.total_items_issued,
      d.estimated_cost,
      d.cost_per_plate,
      d.waste_rate_pct,
      d.total_anomalies,
      d.efficiency_score
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `chef_stats_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFilters = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: COLORS.muted }}>From</label>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ 
              background: COLORS.surface, 
              border: `1px solid ${COLORS.border}`, 
              color: COLORS.text, 
              padding: "8px 12px", 
              borderRadius: 6,
              outline: "none"
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: COLORS.muted }}>To</label>
          <input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)}
            style={{ 
              background: COLORS.surface, 
              border: `1px solid ${COLORS.border}`, 
              color: COLORS.text, 
              padding: "8px 12px", 
              borderRadius: 6,
              outline: "none"
            }}
          />
        </div>
      </div>
      {view === "overview" && overviewData.length > 0 && (
        <button 
          onClick={exportToCSV}
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
            padding: "8px 16px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Export CSV
        </button>
      )}
    </div>
  );

  const renderOverview = () => {
    if (loading) return <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading overview…</p>;
    if (error) return <ErrorMsg error={error} />;
    if (!overviewData.length) return <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>No department data available.</p>;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {overviewData.map((dept) => (
            <Card key={dept.dept_id} style={{ cursor: "pointer", transition: "transform 0.2s" }} onClick={() => handleDeptClick(dept.dept_id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>{dept.dept_name}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>Chef: <strong style={{ color: COLORS.text }}>{dept.chef_name}</strong></p>
                </div>
                <ChevronRight size={20} color={COLORS.muted} />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Plates</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: COLORS.accent, margin: 0 }}>{dept.total_plates}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Waste</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: dept.waste_rate_pct > 10 ? COLORS.coral : COLORS.success, margin: 0 }}>
                    {dept.waste_rate_pct}%
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Anomalies</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: dept.unresolved_anomalies > 0 ? COLORS.coral : COLORS.success, margin: 0 }}>
                    {dept.total_anomalies} <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.muted }}>({dept.unresolved_anomalies} open)</span>
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Items Issued</p>
                  <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{dept.total_items_issued}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Cost/Plate</p>
                  <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>₹{dept.cost_per_plate}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Total Cost</p>
                  <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>₹{dept.estimated_cost}</p>
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 12, margin: 0, color: COLORS.muted }}>Average Daily Plates</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{dept.avg_daily_plates}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderDetail = () => {
    if (loading) return <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading details…</p>;
    if (error) return <ErrorMsg error={error} />;
    if (!detailData) return null;

    const { department, summary, material_breakdown, daily_trend, indent_fulfillment, recent_indents } = detailData;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <button 
          onClick={handleBack} 
          style={{ 
            display: "flex", alignItems: "center", gap: 8, 
            background: "transparent", border: "none", 
            color: COLORS.muted, cursor: "pointer", padding: 0,
            width: "fit-content", fontSize: 14
          }}
        >
          <ArrowLeft size={16} /> Back to Overview
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 24, margin: "0 0 8px" }}>{department.name} <span style={{ fontSize: 14, color: COLORS.muted, fontWeight: 400 }}>({department.code})</span></h2>
            <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>Chef in Charge: <strong style={{ color: COLORS.text }}>{department.chef_name}</strong></p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Efficiency Score</p>
            <h3 style={{ fontSize: 28, margin: 0, color: summary.efficiency_score > 80 ? COLORS.success : summary.efficiency_score > 50 ? COLORS.accent : COLORS.coral }}>
              {summary.efficiency_score}
            </h3>
          </div>
        </div>

        {/* Top KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          <Card>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Total Plates Produced</p>
            <h2 style={{ fontSize: 24, color: COLORS.accent, margin: 0 }}>{summary.total_plates} <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400 }}>plates</span></h2>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: "8px 0 0" }}>~{summary.avg_daily_plates} / day</p>
          </Card>
          <Card>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Leftovers & Waste</p>
            <h2 style={{ fontSize: 24, color: summary.waste_rate_pct > 10 ? COLORS.coral : COLORS.text, margin: 0 }}>
              {summary.total_leftover_qty} <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400 }}>plates</span>
            </h2>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: "8px 0 0" }}>{summary.waste_rate_pct}% waste rate</p>
          </Card>
          <Card>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Anomalies</p>
            <h2 style={{ fontSize: 24, color: summary.unresolved_anomalies > 0 ? COLORS.coral : COLORS.success, margin: 0 }}>
              {summary.total_anomalies} <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400 }}>detected</span>
            </h2>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: "8px 0 0" }}>{summary.unresolved_anomalies} currently open</p>
          </Card>
          <Card>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Material Cost</p>
            <h2 style={{ fontSize: 24, margin: 0 }}>₹{summary.estimated_cost}</h2>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: "8px 0 0" }}>from {summary.total_items_issued} items issued</p>
          </Card>
          <Card>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Cost Per Plate</p>
            <h2 style={{ fontSize: 24, margin: 0 }}>₹{summary.cost_per_plate}</h2>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: "8px 0 0" }}>average material cost</p>
          </Card>
          <Card>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", margin: "0 0 4px" }}>Indent Fulfillment</p>
            <h2 style={{ fontSize: 24, margin: 0 }}>
              {indent_fulfillment.total > 0 ? ((indent_fulfillment.issued / indent_fulfillment.total) * 100).toFixed(0) : 0}%
            </h2>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: "8px 0 0" }}>
              {indent_fulfillment.issued} issued / {indent_fulfillment.total} total
            </p>
          </Card>
        </div>

        {/* Charts Section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 16px" }}>Daily Production vs Waste</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer minWidth={1} minHeight={1}>
                <LineChart data={daily_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="date" stroke={COLORS.muted} fontSize={12} tickMargin={10} />
                  <YAxis yAxisId="left" stroke={COLORS.muted} fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke={COLORS.coral} fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 8 }}
                    itemStyle={{ color: COLORS.text }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="plates" name="Plates Produced" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="leftover_qty" name="Leftovers" stroke={COLORS.coral} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 16px" }}>Material Requisitions vs Issues</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer minWidth={1} minHeight={1}>
                <BarChart data={material_breakdown.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="name" stroke={COLORS.muted} fontSize={10} tickMargin={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke={COLORS.muted} fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 8 }}
                    itemStyle={{ color: COLORS.text }}
                    cursor={{ fill: COLORS.border, opacity: 0.2 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, marginTop: 10 }} />
                  <Bar dataKey="total_requested" name="Requested Qty" fill={COLORS.muted} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_issued" name="Issued Qty" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Detailed Tables */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 16px" }}>Top Materials Consumed (Cost)</h3>
            <div className="resp-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={{ textAlign: "left", padding: "12px 8px", color: COLORS.muted, fontWeight: 500 }}>Item Name</th>
                    <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.muted, fontWeight: 500 }}>Req Qty</th>
                    <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.muted, fontWeight: 500 }}>Issued Qty</th>
                    <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.muted, fontWeight: 500 }}>Avg Price</th>
                    <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.muted, fontWeight: 500 }}>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {material_breakdown.map((mb, i) => (
                    <tr key={mb.item_code || i} style={{ borderBottom: `1px solid ${COLORS.border}40` }}>
                      <td style={{ padding: "12px 8px" }}>
                        {mb.name} <span style={{ color: COLORS.muted, fontSize: 12 }}>({mb.unit})</span>
                      </td>
                      <td style={{ textAlign: "right", padding: "12px 8px" }}>{mb.total_requested}</td>
                      <td style={{ textAlign: "right", padding: "12px 8px" }}>{mb.total_issued}</td>
                      <td style={{ textAlign: "right", padding: "12px 8px" }}>₹{mb.avg_price}</td>
                      <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 500 }}>₹{mb.estimated_cost}</td>
                    </tr>
                  ))}
                  {material_breakdown.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: "center", padding: 20, color: COLORS.muted }}>No materials issued in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 16px" }}>Recent Indents</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recent_indents.map((ind) => (
                <div key={ind.id} style={{ padding: 12, background: COLORS.background, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>ID: {ind.id}</span>
                    <span style={{ 
                      fontSize: 10, padding: "2px 6px", borderRadius: 10, textTransform: "uppercase", fontWeight: 600,
                      background: ind.status === "issued" ? `${COLORS.success}20` : ind.status === "cancelled" ? `${COLORS.coral}20` : `${COLORS.accent}20`,
                      color: ind.status === "issued" ? COLORS.success : ind.status === "cancelled" ? COLORS.coral : COLORS.accent
                    }}>
                      {ind.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, margin: "0 0 4px", color: COLORS.muted }}>Date: {ind.date}</p>
                  <p style={{ fontSize: 13, margin: 0 }}>{ind.items.length} items requested</p>
                </div>
              ))}
              {recent_indents.length === 0 && (
                <p style={{ color: COLORS.muted, textAlign: "center", fontSize: 13 }}>No recent indents.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <Section 
      title="Chef Statistics" 
      sub="Department-wise kitchen performance, consumption, and efficiency metrics"
      onBack={isChef ? () => setCurrentScreen("chef_home") : () => setCurrentScreen("dashboard")}
    >
      {renderFilters()}
      {view === "overview" ? renderOverview() : renderDetail()}
    </Section>
  );
}
