import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import * as api from "../../api";
import { useAppContext } from "../../context/AppContext";

export default function WasteAnalyticsScreen({ noSection }) {
  const { stocks } = useAppContext();
  const [productionList, setProductionList] = useState([]);
  const [leftoversList, setLeftoversList] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const prodRes = await api.production.list({ limit: 100 });
      const leftRes = await api.leftovers.list({ limit: 100 });
      const analRes = await api.productionPlans.analytics();
      if (prodRes.success) setProductionList(prodRes.data || []);
      if (leftRes.success) setLeftoversList(leftRes.data || []);
      if (analRes.success) setAnalyticsData(analRes.data || null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute metrics
  // Group production & waste by item
  const itemStats = {};
  productionList.forEach(p => {
    const name = p.item_name || "Unknown Dish";
    if (!itemStats[name]) {
      itemStats[name] = { dept: p.dept, plates: 0, leftovers: 0, waste: 0, wastePct: 0 };
    }
    itemStats[name].plates += parseFloat(p.plates_made || p.plates || 0);
  });

  leftoversList.forEach(l => {
    const name = l.item || "Unknown Dish";
    if (!itemStats[name]) {
      itemStats[name] = { dept: l.dept, plates: 0, leftovers: 0, waste: 0, wastePct: 0 };
    }
    const qty = parseFloat(l.qty || 0);
    if (l.carried_forward === false) {
      itemStats[name].waste += qty;
    } else {
      itemStats[name].leftovers += qty;
    }
  });

  Object.values(itemStats).forEach(stats => {
    stats.wastePct = stats.plates > 0 ? (stats.waste / stats.plates) * 100 : 0;
  });

  // Calculate waste cost
  // Fetch pricing from stock master or fallback to approximate pricing
  let totalLeftoverCost = 0;
  let totalWasteCost = 0;
  leftoversList.forEach(l => {
    let price = 0; // Default to 0 instead of arbitrary 50
    const name = l.item?.toLowerCase() || "";
    const stockMatch = stocks.find(s => s.name?.toLowerCase() === name);
    
    if (stockMatch && stockMatch.price) {
      price = parseFloat(stockMatch.price);
    }
    
    const cost = parseFloat(l.qty || 0) * price;
    if (l.carried_forward === false) {
      totalWasteCost += cost;
    } else {
      totalLeftoverCost += cost;
    }
  });

  const totalPlates = productionList.reduce((acc, curr) => acc + parseFloat(curr.plates_made || curr.plates || 0), 0);
  const totalWaste = leftoversList.filter(l => l.carried_forward === false).reduce((acc, curr) => acc + parseFloat(curr.qty || 0), 0);
  const averageWastePct = totalPlates > 0 ? (totalWaste / totalPlates) * 100 : 0;

  const content = loading ? (
    <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading metrics…</p>
  ) : error ? (
    <ErrorMsg error={error} />
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Key Metrics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <Card>
          <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Total Plates Cooked</p>
          <h2 style={{ fontSize: 28, color: COLORS.accent, fontWeight: 700, margin: 0 }}>{totalPlates} <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 400 }}>plates</span></h2>
        </Card>

        <Card>
          <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Average Plates Wasted (Discarded)</p>
          <h2 style={{ fontSize: 28, color: COLORS.coral, fontWeight: 700, margin: 0 }}>
            {averageWastePct.toFixed(1)}% 
            <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 400, marginLeft: 8 }}>({totalWaste} plates total)</span>
          </h2>
        </Card>

        <Card>
          <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Est. Cost of Discarded Waste</p>
          <h2 style={{ fontSize: 28, color: COLORS.coral, fontWeight: 700, margin: 0 }}>₹{totalWasteCost.toLocaleString()}</h2>
          <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>₹{totalLeftoverCost.toLocaleString()} saved (Carried forward)</p>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Item Waste Visualizer */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, margin: 0 }}>Waste Percentage by Dish</h3>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.keys(itemStats).length === 0 ? (
              <p style={{ color: COLORS.muted, textAlign: "center", margin: 20 }}>No item production logs found yet</p>
            ) : (
              Object.keys(itemStats).sort((a,b) => itemStats[b].wastePct - itemStats[a].wastePct).map(itemName => {
                const stats = itemStats[itemName];
                const pct = Math.min(100, stats.wastePct);
                return (
                  <div key={itemName} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: COLORS.text }}>{itemName} <span style={{ color: COLORS.muted, fontWeight: 400, fontSize: 10 }}>({stats.dept})</span></span>
                      <span style={{ color: COLORS.muted }}>
                        {stats.waste} discarded / {stats.plates} cooked (<strong>{stats.wastePct.toFixed(1)}%</strong>)
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: "100%", height: 8, background: COLORS.bg, borderRadius: 4, overflow: "hidden", border: `1px solid ${COLORS.border}55` }}>
                      <div style={{
                        width: `${pct}%`, height: "100%",
                        background: pct > 15 ? COLORS.coral : pct > 8 ? COLORS.accent : COLORS.success,
                        transition: "width 0.3s"
                      }}/>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Leftover Raw Materials Log */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, margin: 0 }}>Disposition Log</h3>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {leftoversList.length === 0 ? (
              <p style={{ color: COLORS.muted, textAlign: "center", padding: 24 }}>No items registered</p>
            ) : (
              leftoversList.map(l => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: `1px solid ${COLORS.border}22` }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, margin: 0 }}>{l.item}</p>
                    <p style={{ fontSize: 10, color: l.carried_forward === false ? COLORS.coral : COLORS.success, margin: 0, fontWeight: 600 }}>
                      {l.carried_forward === false ? "Discarded (Waste)" : "Carried Forward (Reuse)"}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, background: COLORS.border + "44", borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                    {l.qty} {l.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* AI Waste Reason Clustering */}
      {analyticsData && analyticsData.wasteClusters && Object.keys(analyticsData.wasteClusters).length > 0 && (
        <Card style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 15, color: COLORS.accent, fontWeight: 700, margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 6 }}>
            ✨ AI Waste Reason Breakdown (Recent 100 Plans)
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {Object.entries(analyticsData.wasteClusters).map(([category, reasonsList]) => (
              <div key={category} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{category}</span>
                  <span style={{ background: COLORS.accent + "18", color: COLORS.accent, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>
                    {reasonsList.length} occurrence(s)
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: COLORS.muted, display: "flex", flexDirection: "column", gap: 6 }}>
                  {reasonsList.map((reason, idx) => (
                    <li key={idx}>"{reason}"</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  if (noSection) return content;

  return (
    <Section title="Waste & Leftovers Cost Analytics" sub="Monetary cost analysis of kitchen waste and leftovers logs">
      {content}
    </Section>
  );
}
