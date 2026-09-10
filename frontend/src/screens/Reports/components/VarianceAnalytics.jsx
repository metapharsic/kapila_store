import { useMemo } from "react";
import { useAppContext } from "../../../context/AppContext";
import { COLORS } from "../../../styles/colors";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Card from "../../../components/Card";

export default function VarianceAnalytics({ filters }) {
  const { stocks } = useAppContext();

  // Compute Variance & Leakage Tracking from actual stocks
  const { varianceReasons, highVarianceItems, totalShrinkage } = useMemo(() => {
    let filteredStocks = stocks;
    // Apply cross-filters if any (e.g., department, supplier)
    if (filters?.globalSupplier) {
      filteredStocks = filteredStocks.filter(s => s.supplier === filters.globalSupplier);
    }
    
    let shrinkage = 0;
    const reasonsMap = {};
    const varianceList = [];

    filteredStocks.forEach(item => {
      // Calculate variance as physical (remaining) - system (qty)
      const variance = (item.remaining || 0) - (item.qty || 0);
      
      // If there's a negative variance (shrinkage)
      if (variance < 0) {
        const costLost = Math.abs(variance) * (item.price || 0);
        shrinkage += costLost;

        const reason = item.reason || "Unspecified Leakage";
        if (!reasonsMap[reason]) reasonsMap[reason] = { name: reason, value: 0, color: getReasonColor(reason) };
        reasonsMap[reason].value += costLost;

        varianceList.push({
          name: item.name,
          code: item.item_code || `KPL-${item.id}`,
          sysQty: item.qty || 0,
          phyQty: item.remaining || 0,
          variance: variance,
          unit: item.unit || "kg",
          cost: costLost
        });
      }
    });

    return {
      totalShrinkage: shrinkage,
      varianceReasons: Object.values(reasonsMap),
      highVarianceItems: varianceList.sort((a, b) => b.cost - a.cost).slice(0, 5) // Top 5
    };
  }, [stocks, filters]);

  function getReasonColor(reason) {
    if (reason.toLowerCase().includes("damage")) return COLORS.coral;
    if (reason.toLowerCase().includes("expiry")) return COLORS.accent;
    if (reason.toLowerCase().includes("audit")) return COLORS.purple;
    if (reason.toLowerCase().includes("theft")) return COLORS.danger;
    return COLORS.border;
  }

  // Calculate total inventory value to find % shrinkage
  const totalInventoryValue = useMemo(() => {
    return stocks.reduce((acc, item) => acc + ((item.qty || 0) * (item.price || 0)), 0);
  }, [stocks]);

  const shrinkagePercent = totalInventoryValue > 0 ? ((totalShrinkage / totalInventoryValue) * 100).toFixed(1) : 0;
  
  // Find top reason
  const topReason = varianceReasons.length > 0 
    ? [...varianceReasons].sort((a, b) => b.value - a.value)[0] 
    : { name: "None", value: 0 };
  const topReasonPercent = totalShrinkage > 0 ? ((topReason.value / totalShrinkage) * 100).toFixed(0) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        
        {/* KPI CARDS */}
        <Card style={{ padding: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Total Inventory Shrinkage</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, color: COLORS.text }}>₹{totalShrinkage.toLocaleString(undefined, {maximumFractionDigits: 0})}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.danger, fontWeight: 600 }}>{shrinkagePercent}% of Total Inventory Value</p>
        </Card>

        <Card style={{ padding: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Top Leakage Reason</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, color: COLORS.text }}>{topReason.name}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.muted }}>Accounting for {topReasonPercent}% of all shrinkage</p>
        </Card>

      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        
        {/* Pie Chart */}
        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: COLORS.text }}>Shrinkage by Reason</h3>
          <div style={{ width: "100%", height: 300, display: "flex", justifyContent: "center" }}>
            {varianceReasons.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={varianceReasons}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {varianceReasons.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${value.toFixed(0)}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.muted }}>
                No shrinkage data found
              </div>
            )}
          </div>
        </Card>

        {/* High Variance Items Table */}
        <Card style={{ padding: 20, overflowY: "auto", maxHeight: 400 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: COLORS.text }}>Top 5 High-Variance Items</h3>
          {highVarianceItems.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, textAlign: "left" }}>
                  <th style={{ padding: "0 0 12px 0", fontWeight: 600 }}>Item</th>
                  <th style={{ padding: "0 0 12px 0", fontWeight: 600 }}>Mismatch</th>
                  <th style={{ padding: "0 0 12px 0", fontWeight: 600, textAlign: "right" }}>Value Lost</th>
                </tr>
              </thead>
              <tbody>
                {highVarianceItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.bg}`, transition: "background 0.2s", cursor: "pointer" }}>
                    <td style={{ padding: "12px 0", color: COLORS.text }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{item.code}</div>
                    </td>
                    <td style={{ padding: "12px 0", color: COLORS.danger, fontWeight: 600 }}>
                      {item.variance.toFixed(1)} {item.unit}
                    </td>
                    <td style={{ padding: "12px 0", textAlign: "right", color: COLORS.text, fontWeight: 600 }}>
                      ₹{item.cost.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: COLORS.muted }}>
              No high variance items found.
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
