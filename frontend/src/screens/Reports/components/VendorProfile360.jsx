import React, { useState, useCallback, useEffect } from "react";
import { authedGet } from "../../../api/client";
import { COLORS } from "../../../styles/colors";
import { Building2, TrendingUp, Package, ShoppingCart, AlertCircle, Star, Sparkles, ShieldCheck, Zap } from "lucide-react";

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 18px", minWidth: 130, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: COLORS.muted }}>{label}</div>
        {icon && <div style={{ color: color || COLORS.muted }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || COLORS.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SparkLine({ data, color = "#f4c84b", height = 36 }) {
  if (!data || data.length < 2) return <span style={{ fontSize: 10, color: COLORS.muted }}>—</span>;
  const vals = data.map(d => d.y);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 120, h = height;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.y - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts.split(" ").pop().split(",")[0]} cy={pts.split(" ").pop().split(",")[1]} r="3" fill={color} />
    </svg>
  );
}

export default function VendorProfile360({ dimensions, onAgentUpdate, initialSupplierId }) {
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const vendors = dimensions?.vendors || [];

  const loadProfile = useCallback(async (vendor) => {
    setSelectedVendor(vendor);
    setData(null);
    setError(null);
    setLoading(true);

    const t0 = Date.now();

    onAgentUpdate?.("sentinel", { status: "done", count: 1 });
    onAgentUpdate?.("scout",    { status: "done", count: vendors.length });
    onAgentUpdate?.("pogrn",    { status: "running" });
    onAgentUpdate?.("tracer",   { status: "running" });
    onAgentUpdate?.("ledger",   { status: "running" });
    onAgentUpdate?.("analyst",  { status: "running" });
    onAgentUpdate?.("veritas",  { status: "running" });

    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);

      const res = await authedGet(`/api/reports/vendor-profile/${vendor.id}?${params}`).then(r => r.json());
      const elapsed = Date.now() - t0;

      if (!res.success) throw new Error(res.error || "Failed");

      onAgentUpdate?.("pogrn",    { status: "done", count: (res.data.pos?.length || 0) + (res.data.grns?.length || 0), ms: elapsed });
      onAgentUpdate?.("tracer",   { status: "done", count: res.data.price_history?.length || 0 });
      onAgentUpdate?.("ledger",   { status: "done", count: res.data.item_breakdown?.length || 0 });
      onAgentUpdate?.("analyst",  { status: "done", count: 1 });
      onAgentUpdate?.("veritas",  { status: "done", count: 1 });
      onAgentUpdate?.("composer", { status: "done", count: 1, ms: elapsed });

      setData(res.data);
    } catch (e) {
      setError(e.message);
      onAgentUpdate?.("pogrn",    { status: "error", error: e.message });
      onAgentUpdate?.("tracer",   { status: "error" });
      onAgentUpdate?.("ledger",   { status: "error" });
      onAgentUpdate?.("analyst",  { status: "error" });
      onAgentUpdate?.("composer", { status: "error" });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, vendors.length, onAgentUpdate]);

  // Handle deep-link
  useEffect(() => {
    if (initialSupplierId && vendors.length > 0) {
      const match = vendors.find(v => v.id === parseInt(initialSupplierId, 10));
      if (match) loadProfile(match);
    }
  }, [initialSupplierId, vendors, loadProfile]);

  // Build price trend per item
  const priceTrends = data ? (() => {
    const byItem = {};
    (data.price_history || []).forEach(p => {
      if (!byItem[p.item_code]) byItem[p.item_code] = { name: p.name, points: [] };
      byItem[p.item_code].points.push({ x: p.date, y: parseFloat(p.unit_price || 0) });
    });
    return Object.entries(byItem).map(([code, v]) => ({ code, name: v.name, points: v.points }));
  })() : [];

  const TABS = [
    { id: "overview",    label: "Overview" },
    { id: "items",       label: `Items (${data?.item_breakdown?.length || 0})` },
    { id: "po",          label: `POs (${data?.pos?.length || 0})` },
    { id: "grn",         label: `GRNs (${data?.grns?.length || 0})` },
    { id: "price_trend", label: "Price Trend" },
  ];

  const fillRate = data?.summary?.fill_rate ?? 100;
  const isFillRateLow = fillRate < 90;

  return (
    <div style={{ height: "100%", display: "flex", gap: 16 }}>
      {/* Vendor picker sidebar */}
      <div style={{
        width: 240, background: "#fff", border: `1px solid ${COLORS.border}`,
        borderRadius: 12, overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700, fontSize: 13 }}>
          Suppliers ({vendors.length})
        </div>
        {vendors.map(v => (
          <button key={v.id} onClick={() => loadProfile(v)} style={{
            width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start",
            padding: "10px 14px", border: "none", borderBottom: `1px solid ${COLORS.border}`,
            background: selectedVendor?.id === v.id ? "#18181b" : "transparent",
            cursor: "pointer", textAlign: "left",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: selectedVendor?.id === v.id ? "#f4c84b" : COLORS.text }}>{v.name}</span>
            {v.phone && <span style={{ fontSize: 10, color: selectedVendor?.id === v.id ? "#71717a" : COLORS.muted }}>{v.phone}</span>}
          </button>
        ))}
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, minWidth: 0, overflowY: "auto" }}>
        {/* Date filters */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Filter by date:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
          {selectedVendor && <button onClick={() => loadProfile(selectedVendor)} style={{ padding: "8px 14px", background: "#18181b", color: "#f4c84b", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Apply</button>}
        </div>

        {!selectedVendor && !loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: COLORS.muted }}>
            <Building2 size={48} strokeWidth={1} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Select a vendor</div>
            <div style={{ fontSize: 12 }}>Full 360° profile: spend, categories, POs, GRNs, price trends</div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
            <div style={{ fontSize: 28, marginBottom: 8, animation: "spin 1s infinite linear" }}>◎</div>
            <div>Synthesizing 360° profile for <strong>{selectedVendor?.name}</strong>…</div>
          </div>
        )}

        {error && <div style={{ background: "#FEF2F2", border: "1px solid #fecaca", borderRadius: 8, padding: 14, color: "#991b1b", display: "flex", gap: 8 }}><AlertCircle size={16} />{error}</div>}

        {data && !loading && (
          <>
            {/* Vendor header */}
            <div style={{ background: "#18181b", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <Building2 size={32} color="#f4c84b" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{data.supplier?.name}</div>
                <div style={{ fontSize: 12, color: "#71717a" }}>
                  {data.supplier?.contact_name && `Contact: ${data.supplier.contact_name} · `}
                  {data.supplier?.phone && `Phone: ${data.supplier.phone} · `}
                  GSTIN: {data.supplier?.gstin || "—"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "4px 10px", borderRadius: 6, background: isFillRateLow ? "#ef444422" : "#10b98122", color: isFillRateLow ? "#ef4444" : "#10b981", fontSize: 11, fontWeight: 700, border: `1px solid ${isFillRateLow ? "#ef444444" : "#10b98144"}` }}>
                  {isFillRateLow ? "⚠ Fill-Rate Alert" : "✓ Preferred Vendor"}
                </span>
              </div>
            </div>

            {/* Agent Composer Vendor Insight Card */}
            <div style={{
              background: "#fff",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: "12px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 800 }}>
                <Sparkles size={14} color="#f59e0b" />
                <span>Agent Composer Supplier Intelligence</span>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
                <div style={{ padding: "6px 10px", background: "#fafafa", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                  <strong>Fill Reliability:</strong> {fillRate}% on-time / complete delivery
                </div>
                <div style={{ padding: "6px 10px", background: "#fafafa", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                  <strong>Item Diversity:</strong> Supplies {data.item_breakdown?.length || 0} unique SKUs
                </div>
                <div style={{ padding: "6px 10px", background: "#fafafa", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                  <strong>Total Lifetime Spend:</strong> ₹{(data.summary?.total_spend || 0).toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <StatCard label="Total Spend" value={`₹${data.summary?.total_spend?.toFixed(2) || "0.00"}`} color="#f4c84b" />
              <StatCard label="POs Raised"  value={data.summary?.total_pos || 0} />
              <StatCard label="GRNs Received" value={data.summary?.total_grns || 0} color="#10b981" />
              <StatCard label="Fill Rate"   value={`${data.summary?.fill_rate || 0}%`} color={(data.summary?.fill_rate || 0) >= 90 ? "#10b981" : "#ef4444"} />
              <StatCard label="SKUs Supplied" value={data.item_breakdown?.length || 0} />
            </div>

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 2 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: activeTab === t.id ? "#18181b" : "transparent",
                  color: activeTab === t.id ? "#f4c84b" : COLORS.muted,
                  borderRadius: "6px 6px 0 0",
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Category spend bar */}
                <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Spend by Category</div>
                  {Object.entries(data.summary?.category_spend || {}).map(([cat, val]) => (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 12 }}>
                        <span>{cat}</span>
                        <span style={{ fontWeight: 700 }}>₹{val.toFixed(2)}</span>
                      </div>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(val / (data.summary?.total_spend || 1)) * 100}%`, background: "#f4c84b" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Items */}
            {activeTab === "items" && (
              <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: "#fafafa" }}>{["Item","Category","Total Qty","Unit","Total Spend","Latest Price"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(data.item_breakdown || []).map((item, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "8px 10px", fontWeight: 700 }}>{item.name}</td>
                        <td style={{ padding: "8px 10px", color: COLORS.muted }}>{item.category}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 700 }}>{item.total_qty}</td>
                        <td style={{ padding: "8px 10px" }}>{item.unit}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: "#f4c84b" }}>₹{item.total_spend?.toFixed(2)}</td>
                        <td style={{ padding: "8px 10px", color: "#10b981" }}>₹{item.latest_price?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: POs */}
            {activeTab === "po" && (
              <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: "#fafafa" }}>{["PO No","Date","Status","Items","Total Qty"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(data.pos || []).map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: "#3b82f6" }}>{p.po_number}</td>
                        <td style={{ padding: "8px 10px" }}>{p.date}</td>
                        <td style={{ padding: "8px 10px" }}><span style={{ padding: "2px 7px", borderRadius: 4, background: p.status === "Received" ? "#dcfce7" : "#fef9c3", color: p.status === "Received" ? "#166534" : "#854d0e", fontWeight: 700, fontSize: 10 }}>{p.status}</span></td>
                        <td style={{ padding: "8px 10px" }}>{p.item_count} items</td>
                        <td style={{ padding: "8px 10px", fontWeight: 700 }}>{p.total_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: GRNs */}
            {activeTab === "grn" && (
              <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: "#fafafa" }}>{["GRN No","Date","Items","Total Received","Total Accepted","Landed Value"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(data.grns || []).map((g, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: "#10b981" }}>{g.grn_number}</td>
                        <td style={{ padding: "8px 10px" }}>{g.date}</td>
                        <td style={{ padding: "8px 10px" }}>{g.item_count} items</td>
                        <td style={{ padding: "8px 10px" }}>{g.total_received}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: "#10b981" }}>{g.total_accepted}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: "#f4c84b" }}>₹{parseFloat(g.total_landed || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Price Trend */}
            {activeTab === "price_trend" && (
              <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Price Trends Over Time (by item)</div>
                {priceTrends.length === 0 && <div style={{ fontSize: 12, color: COLORS.muted }}>Not enough price history points to render sparklines.</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {priceTrends.map(pt => (
                    <div key={pt.code} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{pt.name}</div>
                      <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 8 }}>{pt.points.length} price points</div>
                      <SparkLine data={pt.points} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
