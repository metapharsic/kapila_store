import React, { useState, useEffect, useCallback } from "react";
import { authedGet } from "../../../api/client";
import { COLORS } from "../../../styles/colors";
import {
  Sparkles, AlertTriangle, TrendingUp, DollarSign, ShieldAlert,
  ShieldCheck, ArrowUpRight, Clock, Package, Building2, CheckCircle2,
  RefreshCw, ArrowRight, Activity, Zap, Info, LineChart as LineChartIcon
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";

// Module-level cache so switching tabs away and back within ~45s doesn't
// re-trigger the full multi-agent scan from scratch. Cleared/bypassed by
// passing force=true to runMultiAgentScan (e.g. the "Re-run Agent Scan" button).
const SCAN_CACHE_TTL_MS = 45 * 1000;
let scanCache = null; // { data, veritasData, expiresAt }

function MetricCard({ title, value, sub, icon, color = COLORS.text, trend, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: "14px 18px",
        flex: 1,
        minWidth: 150,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>{title}</span>
        <span style={{ color: color }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        {trend && (
          <span style={{ fontSize: 10, fontWeight: 700, color: trend > 0 ? "#ef4444" : "#10b981" }}>
            {trend > 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
        <span style={{ fontSize: 11, color: COLORS.muted }}>{sub}</span>
      </div>
    </div>
  );
}

export default function CrossModuleIntelligence({ onAgentUpdate, onNavigateItem, onNavigateVendor }) {
  const [data, setData] = useState(null);
  const [veritasData, setVeritasData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState("anomalies");
  const [valuationTrend, setValuationTrend] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const runMultiAgentScan = useCallback(async (force = false) => {
    if (!force && scanCache && scanCache.expiresAt > Date.now()) {
      setData(scanCache.data);
      setVeritasData(scanCache.veritasData);
      onAgentUpdate?.("sentinel", { status: "done", count: 1 });
      onAgentUpdate?.("scout",    { status: "done", count: scanCache.data?.summary?.total_skus });
      onAgentUpdate?.("analyst",  { status: "done", count: (scanCache.data?.price_anomalies?.length || 0) + (scanCache.data?.cold_items?.length || 0) });
      onAgentUpdate?.("veritas",  { status: "done", count: scanCache.veritasData?.total_issues_found });
      onAgentUpdate?.("composer", { status: "done", count: 1 });
      return;
    }

    setLoading(true);
    setError(null);
    const t0 = Date.now();

    // Signal active agents to the orchestrator
    onAgentUpdate?.("sentinel", { status: "done", count: 1 });
    onAgentUpdate?.("scout",    { status: "running" });
    onAgentUpdate?.("analyst",  { status: "running" });
    onAgentUpdate?.("veritas",  { status: "running" });
    onAgentUpdate?.("composer", { status: "running" });

    try {
      const forceParam = force ? "?force=true" : "";
      const [intelRes, veritasRes] = await Promise.allSettled([
        authedGet(`/api/reports/cross-module-insights${forceParam}`).then(r => r.json()),
        authedGet(`/api/reports/data-quality-audit${forceParam}`).then(r => r.json()),
      ]);

      const elapsed = Date.now() - t0;

      if (intelRes.status === "fulfilled" && intelRes.value.success) {
        setData(intelRes.value.data);
        onAgentUpdate?.("scout",   { status: "done", count: intelRes.value.data.summary.total_skus });
        onAgentUpdate?.("analyst", { status: "done", count: intelRes.value.data.price_anomalies.length + intelRes.value.data.cold_items.length, ms: elapsed });
      } else {
        onAgentUpdate?.("analyst", { status: "error", error: "Insights failed" });
      }

      if (veritasRes.status === "fulfilled" && veritasRes.value.success) {
        setVeritasData(veritasRes.value.data);
        onAgentUpdate?.("veritas", { status: "done", count: veritasRes.value.data.total_issues_found, ms: elapsed });
      } else {
        onAgentUpdate?.("veritas", { status: "error", error: "Audit failed" });
      }

      onAgentUpdate?.("composer", { status: "done", count: 1, ms: elapsed });

      if (intelRes.status === "fulfilled" && intelRes.value.success &&
          veritasRes.status === "fulfilled" && veritasRes.value.success) {
        scanCache = {
          data: intelRes.value.data,
          veritasData: veritasRes.value.data,
          expiresAt: Date.now() + SCAN_CACHE_TTL_MS,
        };
      }
    } catch (e) {
      setError(e.message);
      onAgentUpdate?.("analyst",  { status: "error", error: e.message });
      onAgentUpdate?.("veritas",  { status: "error", error: e.message });
      onAgentUpdate?.("composer", { status: "error", error: e.message });
    } finally {
      setLoading(false);
    }
  }, [onAgentUpdate]);

  useEffect(() => {
    runMultiAgentScan();
  }, [runMultiAgentScan]);

  useEffect(() => {
    let active = true;
    setTrendLoading(true);
    authedGet("/api/reports/valuation-trend?days=30")
      .then((r) => r.json())
      .then((res) => {
        if (active && res.success) setValuationTrend(res.data.trend || []);
      })
      .catch(() => {})
      .finally(() => { if (active) setTrendLoading(false); });
    return () => { active = false; };
  }, []);

  const summary = data?.summary || {};
  const integrityScore = veritasData?.integrity_score ?? 100;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Banner & Control */}
      <div style={{
        background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
        borderRadius: 14,
        padding: "18px 22px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        border: "1px solid rgba(244,200,75,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            background: "rgba(244,200,75,0.15)",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(244,200,75,0.3)"
          }}>
            <Sparkles size={24} color="#f4c84b" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              Cross-Module Intelligence Hub
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#10b98122", color: "#10b981", border: "1px solid #10b98144" }}>
                AI MULTI-AGENT
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 2 }}>
              Coordinated neural synthesis across Procurement, Ledger, Kitchen Indents, and Stock Health
            </div>
          </div>
        </div>

        <button
          onClick={() => runMultiAgentScan(true)}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 16px",
            background: loading ? "#27272a" : "#f4c84b",
            color: loading ? "#71717a" : "#18181b",
            border: "none",
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 12,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s infinite linear" : undefined }} />
          {loading ? "Synthesizing Pipeline…" : "Re-run Agent Scan"}
        </button>
      </div>

      {/* High-Level KPI Deck */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <MetricCard
          title="STORE VALUATION"
          value={`₹${(summary.total_inventory_valuation || 0).toLocaleString("en-IN")}`}
          sub={`${summary.total_skus || 0} active SKUs tracked`}
          icon={<DollarSign size={18} />}
          color="#10b981"
        />
        <MetricCard
          title="DORMANT CAPITAL LOCKED"
          value={`₹${(summary.dormant_capital_locked || 0).toLocaleString("en-IN")}`}
          sub={`${summary.cold_items_count || 0} items inactive >7d`}
          icon={<Clock size={18} />}
          color="#f59e0b"
          onClick={() => setActiveSubTab("cold")}
        />
        <MetricCard
          title="COST SPIKE ALERTS"
          value={summary.price_anomalies_count || 0}
          sub="Items >12% price inflation"
          icon={<AlertTriangle size={18} />}
          color="#ef4444"
          onClick={() => setActiveSubTab("anomalies")}
        />
        <MetricCard
          title="VERITAS INTEGRITY SCORE"
          value={`${integrityScore}%`}
          sub={veritasData?.status || "Analyzing"}
          icon={<ShieldCheck size={18} />}
          color={integrityScore >= 90 ? "#10b981" : "#f59e0b"}
          onClick={() => setActiveSubTab("veritas")}
        />
        <MetricCard
          title="SUPPLIER ALERTS"
          value={summary.supplier_alerts_count || 0}
          sub="Fill-rate or rejection flags"
          icon={<Building2 size={18} />}
          color="#8b5cf6"
          onClick={() => setActiveSubTab("suppliers")}
        />
      </div>

      {/* Agent Composer Executive Synthesis Card */}
      {data?.composer_synthesis && data.composer_synthesis.length > 0 && (
        <div style={{
          background: "#fff",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: "16px 20px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.text }}>
              Agent Composer — Executive Synthesis & Strategic Briefing
            </span>
            <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: "auto" }}>
              Live Telemetry Snapshot
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 10,
          }}>
            {data.composer_synthesis.map((bullet, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: idx === 0 ? "rgba(239,68,68,0.05)" : idx === 1 ? "rgba(245,158,11,0.05)" : "#fafafa",
                  border: `1px solid ${idx === 0 ? "rgba(239,68,68,0.2)" : idx === 1 ? "rgba(245,158,11,0.2)" : COLORS.border}`,
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: idx === 0 ? "#ef4444" : idx === 1 ? "#f59e0b" : "#3b82f6",
                  marginTop: 6, flexShrink: 0
                }} />
                <span style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.4 }}>
                  {bullet}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tabs Selector */}
      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 2 }}>
        {[
          { id: "anomalies", label: `Price Spikes (${data?.price_anomalies?.length || 0})`, icon: <AlertTriangle size={13} /> },
          { id: "cold",      label: `Dormant Stock (${data?.cold_items?.length || 0})`,      icon: <Clock size={13} /> },
          { id: "hot",       label: `Kitchen Velocity (Top 15)`,                             icon: <TrendingUp size={13} /> },
          { id: "veritas",   label: `Veritas Integrity (${veritasData?.issues?.length || 0})`,icon: <ShieldAlert size={13} /> },
          { id: "suppliers", label: `Supplier Discrepancies (${data?.supplier_alerts?.length || 0})`, icon: <Building2 size={13} /> },
          { id: "trend",     label: `Valuation Trend (30d)`,                                   icon: <LineChartIcon size={13} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: activeSubTab === tab.id ? "#18181b" : "transparent",
              color: activeSubTab === tab.id ? "#f4c84b" : COLORS.muted,
              border: "none",
              borderRadius: "8px 8px 0 0",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-Tab Contents */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* 1. Price Spikes View */}
        {activeSubTab === "anomalies" && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Agent Analyst: Cost & Margin Spike Watch</span>
                <p style={{ margin: "2px 0 0 0", fontSize: 11, color: COLORS.muted }}>
                  Items with landed purchase cost exceeding recent moving average by 12% or more.
                </p>
              </div>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{data?.price_anomalies?.length || 0} flags</span>
            </div>

            {(!data?.price_anomalies || data.price_anomalies.length === 0) ? (
              <div style={{ textAlign: "center", padding: 30, color: COLORS.muted, fontSize: 12 }}>
                ✓ No price spike anomalies detected. Procurement prices are within normal variance thresholds.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.border}`, background: "#fafafa" }}>
                      {["Item Code & Name", "Latest Landed", "Historical Avg", "Inflation Jump", "Supplier", "Date", "Action"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 700, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.price_anomalies.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ fontWeight: 700, color: COLORS.text }}>{item.name}</div>
                          <div style={{ fontSize: 10, color: COLORS.muted }}>{item.item_code}</div>
                        </td>
                        <td style={{ padding: "10px 10px", fontWeight: 700, color: "#ef4444" }}>
                          ₹{item.latest_price}
                        </td>
                        <td style={{ padding: "10px 10px", color: COLORS.muted }}>
                          ₹{item.avg_historical_price}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{
                            padding: "3px 8px", borderRadius: 4, fontWeight: 800, fontSize: 10,
                            background: item.severity === "HIGH" ? "#fee2e2" : "#fef3c7",
                            color: item.severity === "HIGH" ? "#991b1b" : "#92400e",
                            border: `1px solid ${item.severity === "HIGH" ? "#fca5a5" : "#fcd34d"}`
                          }}>
                            +{item.spike_pct}%
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", color: COLORS.text }}>
                          {item.supplier_name}
                        </td>
                        <td style={{ padding: "10px 10px", color: COLORS.muted, fontSize: 11 }}>
                          {item.date || "—"}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => onNavigateItem?.(item.item_code)}
                              style={{
                                padding: "4px 8px", background: "#18181b", color: "#f4c84b",
                                border: "none", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer"
                              }}
                            >
                              Trace Item →
                            </button>
                            {item.supplier_id && (
                              <button
                                onClick={() => onNavigateVendor?.(item.supplier_id)}
                                style={{
                                  padding: "4px 8px", background: "#f4f4f5", color: COLORS.text,
                                  border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer"
                                }}
                              >
                                Vendor 360°
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. Dormant / Cold Stock */}
        {activeSubTab === "cold" && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Agent Analyst: Dormant Stock & Capital Lockup</span>
                <p style={{ margin: "2px 0 0 0", fontSize: 11, color: COLORS.muted }}>
                  Physical inventory holding positive units with zero kitchen issuance in recent cycle.
                </p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>
                Total Locked: ₹{Math.round(summary.dormant_capital_locked || 0).toLocaleString("en-IN")}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}`, background: "#fafafa" }}>
                    {["Item", "Category", "Quantity On Hand", "Unit Cost", "Capital Locked", "Dormancy Status", "Action"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.cold_items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontWeight: 700 }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: COLORS.muted }}>{item.item_code}</div>
                      </td>
                      <td style={{ padding: "10px 10px", color: COLORS.muted }}>{item.category}</td>
                      <td style={{ padding: "10px 10px", fontWeight: 700 }}>{item.remaining} {item.unit}</td>
                      <td style={{ padding: "10px 10px" }}>₹{item.unit_price}</td>
                      <td style={{ padding: "10px 10px", fontWeight: 800, color: "#f59e0b" }}>
                        ₹{item.value_locked?.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 600 }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <button
                          onClick={() => onNavigateItem?.(item.item_code)}
                          style={{
                            padding: "4px 8px", background: "#18181b", color: "#f4c84b",
                            border: "none", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer"
                          }}
                        >
                          Item History →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Kitchen Velocity (Top 15) */}
        {activeSubTab === "hot" && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Agent Scout: Kitchen Consumption Velocity Leaderboard</span>
                <p style={{ margin: "2px 0 0 0", fontSize: 11, color: COLORS.muted }}>
                  Fastest moving raw materials issued to kitchen departments over the last 7 days.
                </p>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}`, background: "#fafafa" }}>
                    {["Rank", "Item Code & Name", "Category", "7-Day Issued Qty", "Consumed Value", "Top Department", "Action"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.hot_velocity_items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "10px 10px", fontWeight: 800, color: idx < 3 ? "#f4c84b" : COLORS.muted }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontWeight: 700 }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: COLORS.muted }}>{item.item_code}</div>
                      </td>
                      <td style={{ padding: "10px 10px", color: COLORS.muted }}>{item.category}</td>
                      <td style={{ padding: "10px 10px", fontWeight: 800, color: "#10b981" }}>
                        {item.velocity_7d} {item.unit}
                      </td>
                      <td style={{ padding: "10px 10px", fontWeight: 700 }}>
                        ₹{item.value_consumed_7d?.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "10px 10px", color: "#3b82f6", fontWeight: 600 }}>
                        {item.top_department}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <button
                          onClick={() => onNavigateItem?.(item.item_code)}
                          style={{
                            padding: "4px 8px", background: "#18181b", color: "#f4c84b",
                            border: "none", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer"
                          }}
                        >
                          Deep Dive →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Veritas Integrity Radar */}
        {activeSubTab === "veritas" && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Agent Veritas: System Data Quality & Reconciliation Audit</span>
                <p style={{ margin: "2px 0 0 0", fontSize: 11, color: COLORS.muted }}>
                  Double-entry ledger integrity checks, phantom stock detection, and indent-issuance verification.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: COLORS.muted }}>Integrity Index:</span>
                <span style={{
                  fontSize: 16, fontWeight: 800,
                  color: integrityScore >= 95 ? "#10b981" : integrityScore >= 85 ? "#f59e0b" : "#ef4444"
                }}>
                  {integrityScore}% ({veritasData?.status || "PASS"})
                </span>
              </div>
            </div>

            {(!veritasData?.issues || veritasData.issues.length === 0) ? (
              <div style={{
                textAlign: "center", padding: 36, background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10
              }}>
                <CheckCircle2 size={32} color="#10b981" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>
                  100% Clean Audit — Zero Discrepancies
                </div>
                <div style={{ fontSize: 11, color: "#15803d", marginTop: 4 }}>
                  All ledger balances match physical stock levels. No orphaned entries or negative balances detected.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {veritasData.issues.map((iss, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: `1px solid ${iss.severity === "CRITICAL" ? "#fca5a5" : iss.severity === "WARNING" ? "#fcd34d" : "#e4e4e7"}`,
                      borderRadius: 10,
                      padding: 14,
                      background: iss.severity === "CRITICAL" ? "#fef2f2" : iss.severity === "WARNING" ? "#fffbeb" : "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 800,
                          background: iss.severity === "CRITICAL" ? "#ef4444" : iss.severity === "WARNING" ? "#f59e0b" : "#71717a",
                          color: "#fff"
                        }}>
                          {iss.severity}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>{iss.title}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted }}>
                        {iss.count} occurrence(s)
                      </span>
                    </div>

                    <p style={{ margin: "4px 0 8px 0", fontSize: 12, color: COLORS.text }}>
                      {iss.description}
                    </p>

                    <div style={{ display: "flex", gap: 16, fontSize: 11, flexWrap: "wrap", color: COLORS.muted }}>
                      <span><strong>Impact:</strong> {iss.impact}</span>
                      <span style={{ color: "#3b82f6" }}><strong>Remedy:</strong> {iss.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Supplier Discrepancies */}
        {activeSubTab === "suppliers" && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Agent PO-GRN: Supplier Fulfillment & Quality Shortfalls</span>
                <p style={{ margin: "2px 0 0 0", fontSize: 11, color: COLORS.muted }}>
                  Active suppliers recording delivery rejections or fill-rate shortfalls (&lt;92%).
                </p>
              </div>
            </div>

            {(!data?.supplier_alerts || data.supplier_alerts.length === 0) ? (
              <div style={{ textAlign: "center", padding: 30, color: COLORS.muted, fontSize: 12 }}>
                ✓ Clean supplier records. All active vendors have delivered &ge;92% of order quantities without rejections.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.border}`, background: "#fafafa" }}>
                      {["Supplier", "Received Units", "Accepted Units", "Rejected Units", "Fill Rate", "Flag Reason", "Action"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 700, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.supplier_alerts.map((sup, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "10px 10px", fontWeight: 700 }}>{sup.name}</td>
                        <td style={{ padding: "10px 10px" }}>{sup.total_received}</td>
                        <td style={{ padding: "10px 10px", color: "#10b981", fontWeight: 600 }}>{sup.total_accepted}</td>
                        <td style={{ padding: "10px 10px", color: sup.total_rejected > 0 ? "#ef4444" : COLORS.muted, fontWeight: 700 }}>
                          {sup.total_rejected}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{
                            padding: "2px 7px", borderRadius: 4, fontWeight: 800, fontSize: 10,
                            background: sup.fill_rate_pct < 85 ? "#fee2e2" : "#fef3c7",
                            color: sup.fill_rate_pct < 85 ? "#991b1b" : "#92400e"
                          }}>
                            {sup.fill_rate_pct}%
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", color: COLORS.muted }}>{sup.alert}</td>
                        <td style={{ padding: "10px 10px" }}>
                          <button
                            onClick={() => onNavigateVendor?.(sup.supplier_id)}
                            style={{
                              padding: "4px 8px", background: "#18181b", color: "#f4c84b",
                              border: "none", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer"
                            }}
                          >
                            Inspect Vendor →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* Valuation Trend View */}
        {activeSubTab === "trend" && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>Inventory Valuation Trend</span>
              <p style={{ margin: "2px 0 0 0", fontSize: 11, color: COLORS.muted }}>
                Daily stock ledger movement value over the last 30 days.
              </p>
            </div>
            {trendLoading ? (
              <div style={{ textAlign: "center", padding: 30, color: COLORS.muted, fontSize: 12 }}>Loading trend…</div>
            ) : valuationTrend.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: COLORS.muted, fontSize: 12 }}>
                No ledger activity recorded in this window.
              </div>
            ) : (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={valuationTrend} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="valuationFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.muted }} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Ledger Value"]} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#valuationFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
