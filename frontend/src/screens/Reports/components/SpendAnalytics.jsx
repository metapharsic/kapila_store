import { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../../../context/AppContext";
import { COLORS } from "../../../styles/colors";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import Card from "../../../components/Card";
import * as api from "../../../api";

export default function SpendAnalytics({ filters, onSupplierClick }) {
  const { stocks } = useAppContext();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPOs() {
      try {
        setLoading(true);
        const res = await api.purchaseOrders.list({ limit: 1000 });
        setPurchaseOrders(res.data || []);
      } catch (err) {
        console.error("Failed to load POs", err);
      } finally {
        setLoading(false);
      }
    }
    loadPOs();
  }, []);

  // Compute spend Data from stocks context (snapshot)
  const spendData = useMemo(() => {
    let filteredStocks = stocks;
    if (filters?.globalSupplier) {
      filteredStocks = filteredStocks.filter(s => s.supplier === filters.globalSupplier);
    }
    
    // Group by Supplier
    const bySupplier = filteredStocks.reduce((acc, curr) => {
      const sup = curr.supplier || "Unknown";
      if (!acc[sup]) acc[sup] = { name: sup, totalSpend: 0, itemsCount: 0 };
      acc[sup].totalSpend += (curr.price || 0) * (curr.qty || 1);
      acc[sup].itemsCount += 1;
      return acc;
    }, {});

    return Object.values(bySupplier).sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 5);
  }, [stocks, filters]);

  // Compute trend data from actual historical purchase orders
  const trendData = useMemo(() => {
    let pos = purchaseOrders;
    if (filters?.globalSupplier) {
      pos = pos.filter(po => po.supplier_name === filters.globalSupplier);
    }

    // Since mock MVP dates may be recent, let's group by day/month based on actual data
    const timeMap = {};
    const topSupNames = new Set(spendData.slice(0, 3).map(s => s.name));

    pos.forEach(po => {
      const date = po.date || po.created_at || new Date().toISOString().split('T')[0];
      const month = date.slice(0, 7); // YYYY-MM
      
      if (!timeMap[month]) timeMap[month] = { month };
      
      const sup = po.supplier_name || "Unknown";
      const total = po.total_amount || 0;
      
      if (!timeMap[month][sup]) timeMap[month][sup] = 0;
      timeMap[month][sup] += total;
    });

    const results = Object.values(timeMap).sort((a, b) => a.month.localeCompare(b.month));
    
    // If no PO history, show a flat 0 line to avoid crash
    if (results.length === 0) {
      return [{ month: new Date().toISOString().slice(0, 7) }];
    }
    return results;
  }, [purchaseOrders, spendData, filters]);

  if (loading) {
    return <div style={{ padding: 20, color: COLORS.muted }}>Loading actual spend data...</div>;
  }

  const topSuppliersForChart = spendData.slice(0, 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        
        {/* KPI CARDS */}
        <Card style={{ padding: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Total Managed Spend</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, color: COLORS.text }}>₹{spendData.reduce((sum, s) => sum + s.totalSpend, 0).toLocaleString()}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.success, fontWeight: 600 }}>Calculated from current catalog</p>
        </Card>

        <Card style={{ padding: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Active Suppliers</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, color: COLORS.text }}>{spendData.length}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.muted }}>Supplying {stocks.length} catalog items</p>
        </Card>

      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        
        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: COLORS.text }}>Top Suppliers by Spend</h3>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={spendData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.border} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: COLORS.bg }} formatter={(value) => `₹${value.toFixed(0)}`} />
                <Bar dataKey="totalSpend" radius={[0, 4, 4, 0]} onClick={(data) => onSupplierClick && onSupplierClick(data.name)} style={{ cursor: "pointer" }}>
                  {spendData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={filters?.globalSupplier === entry.name ? COLORS.brand : COLORS.accent} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: 11, color: COLORS.muted, textAlign: "center", marginTop: 8 }}>* Click on a bar to cross-filter the entire dashboard by Supplier</p>
        </Card>

        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: COLORS.text }}>Historical Spend Trend</h3>
          <div style={{ width: "100%", height: 300 }}>
            {purchaseOrders.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => `₹${value.toFixed(0)}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {topSuppliersForChart.map((sup, idx) => (
                    <Line 
                      key={sup.name} 
                      type="monotone" 
                      dataKey={sup.name} 
                      stroke={idx === 0 ? COLORS.brand : COLORS.coral} 
                      strokeWidth={3} 
                      dot={{ r: 4 }} 
                      activeDot={{ r: 6 }} 
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.muted }}>
                No historical Purchase Orders found.
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
