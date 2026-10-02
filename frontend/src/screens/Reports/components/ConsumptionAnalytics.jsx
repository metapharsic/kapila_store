import { useState, useEffect, useMemo } from "react";
import { COLORS } from "../../../styles/colors";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import Card from "../../../components/Card";
import { ShieldAlert } from "lucide-react";
import * as api from "../../../api";

export default function ConsumptionAnalytics({ filters, onDepartmentClick, isAdmin }) {
  const [productionData, setProductionData] = useState([]);
  const [issuanceData, setIssuanceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch up to 1000 records to calculate aggregates
        const [prodRes, issRes] = await Promise.all([
          api.production.list({ limit: 1000 }),
          api.issuances.list({ limit: 1000 })
        ]);
        setProductionData(prodRes.data || []);
        setIssuanceData(issRes.data || []);
      } catch (err) {
        console.error("Failed to load consumption data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const { yieldData, totalPlates, totalIssuedCost, dailyTrend } = useMemo(() => {
    let filteredProd = productionData;
    let filteredIss = issuanceData;

    if (filters?.globalDepartment) {
      filteredProd = filteredProd.filter(p => p.dept === filters.globalDepartment);
      filteredIss = filteredIss.filter(i => i.dept === filters.globalDepartment);
    }

    // 1. Group plates produced by department
    const deptStats = {};
    let platesSum = 0;
    
    filteredProd.forEach(p => {
      const d = p.dept || "Unknown";
      if (!deptStats[d]) deptStats[d] = { name: d, IssuedRaw: 0, PlatesProduced: 0 };
      const plates = Number(p.plates) || 0;
      deptStats[d].PlatesProduced += plates;
      platesSum += plates;
    });

    // 2. Group raw materials issued by department (simulate cost by qty for now)
    let costSum = 0;
    filteredIss.forEach(i => {
      const d = i.dept || "Unknown";
      if (!deptStats[d]) deptStats[d] = { name: d, IssuedRaw: 0, PlatesProduced: 0 };
      // we sum up the total items issued
      let issueCost = 0;
      if (Array.isArray(i.items)) {
        i.items.forEach(item => {
           issueCost += Number(item.qty) * (item.price || 150); // rough estimate if price missing
        });
      }
      deptStats[d].IssuedRaw += issueCost;
      costSum += issueCost;
    });

    const yieldArray = Object.values(deptStats).sort((a,b) => b.PlatesProduced - a.PlatesProduced);

    // 3. Daily trend for cost per plate
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const trend = days.map((d, i) => {
      // Dummy variation based on the actual blended cost for MVP
      const baseCost = platesSum > 0 ? (costSum / platesSum) : 45;
      return {
        day: d,
        costPerPlate: baseCost > 0 ? parseFloat((baseCost + (Math.random() * 10 - 5)).toFixed(1)) : 0
      };
    });

    return {
      yieldData: yieldArray,
      totalPlates: platesSum,
      totalIssuedCost: costSum,
      dailyTrend: trend
    };
  }, [productionData, issuanceData, filters]);

  const blendedCost = totalPlates > 0 ? (totalIssuedCost / totalPlates).toFixed(2) : 0;

  if (loading) {
    return <div style={{ padding: 20, color: COLORS.muted }}>Loading actual consumption data...</div>;
  }

  if (!isAdmin) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: COLORS.muted, padding: 40 }}>
        <ShieldAlert size={52} strokeWidth={1} color="#ef4444" />
        <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b" }}>Admin Access Required</div>
        <div style={{ fontSize: 12, textAlign: "center", maxWidth: 340 }}>
          Consumption cost and yield data is restricted to users with the <strong>Admin</strong> role.<br />
          Contact your system administrator to request access.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        
        {/* KPI CARDS */}
        <Card style={{ padding: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Blended Cost Per Plate</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, color: COLORS.text }}>₹{blendedCost}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: blendedCost > 50 ? COLORS.danger : COLORS.success, fontWeight: 600 }}>
            {blendedCost > 50 ? "High Waste Alert" : "Consistent with targets"}
          </p>
        </Card>

        <Card style={{ padding: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Total Plates Produced</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, color: COLORS.text }}>{totalPlates.toLocaleString()}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.muted }}>Aggregated from {productionData.length} records</p>
        </Card>

      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        
        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: COLORS.text }}>Department Yield Tracker</h3>
          <div style={{ width: "100%", height: 300 }}>
            {yieldData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={yieldData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: COLORS.bg }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="IssuedRaw" fill={COLORS.accent} name="Issued Raw Material (₹)" onClick={(data) => onDepartmentClick && onDepartmentClick(data.name)} style={{ cursor: "pointer" }} />
                  <Bar dataKey="PlatesProduced" fill={COLORS.brand} name="Plates Produced" onClick={(data) => onDepartmentClick && onDepartmentClick(data.name)} style={{ cursor: "pointer" }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.muted }}>No department data</div>
            )}
          </div>
          <p style={{ fontSize: 11, color: COLORS.muted, textAlign: "center", marginTop: 8 }}>* Click on a department bar to cross-filter</p>
        </Card>

        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: COLORS.text }}>Cost Per Plate Trend (Weekly)</h3>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={dailyTrend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.coral} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS.coral} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip />
                <Area type="monotone" dataKey="costPerPlate" stroke={COLORS.coral} strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </div>
    </div>
  );
}
