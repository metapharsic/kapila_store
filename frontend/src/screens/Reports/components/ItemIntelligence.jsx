import React, { useState, useCallback, useEffect, useRef } from "react";
import { authedGet } from "../../../api/client";
import { COLORS } from "../../../styles/colors";
import {
  Search, Package, TrendingUp, ShoppingCart, ArrowRight, ChevronDown,
  ChevronRight, AlertCircle, CheckCircle, Clock, Zap, ShieldAlert, Sparkles
} from "lucide-react";
import { useAppContext } from "../../../context/AppContext";

const SECTION_COLORS = {
  po:       { bg: "rgba(59,130,246,0.07)",  border: "rgba(59,130,246,0.2)",  tag: "#3b82f6",  label: "PO"      },
  grn:      { bg: "rgba(16,185,129,0.07)",  border: "rgba(16,185,129,0.2)",  tag: "#10b981",  label: "GRN"     },
  ledger:   { bg: "rgba(139,92,246,0.07)",  border: "rgba(139,92,246,0.2)",  tag: "#8b5cf6",  label: "LEDGER"  },
  issuance: { bg: "rgba(244,200,75,0.07)",  border: "rgba(244,200,75,0.2)",  tag: "#f4c84b",  label: "ISSUED"  },
  indent:   { bg: "rgba(249,115,22,0.07)",  border: "rgba(249,115,22,0.2)",  tag: "#f97316",  label: "INDENT"  },
};

function Tag({ color, label }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em"
    }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", minWidth: 120 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || COLORS.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CollapsibleSection({ title, color, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const c = SECTION_COLORS[color] || {};
  return (
    <div style={{ border: `1px solid ${c.border || COLORS.border}`, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: c.bg || "#fff", border: "none", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Tag color={c.tag || "#666"} label={c.label || color} />
          <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>{title}</span>
          <span style={{ fontSize: 11, color: COLORS.muted, background: COLORS.border, borderRadius: 20, padding: "1px 8px" }}>{count}</span>
        </div>
        {open ? <ChevronDown size={14} color={COLORS.muted} /> : <ChevronRight size={14} color={COLORS.muted} />}
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}

function TimelineRow({ type, date, qty, unit, price, label, sub, meta }) {
  const c = SECTION_COLORS[type] || {};
  return (
    <div style={{
      display: "flex", gap: 12, padding: "9px 0",
      borderBottom: `1px solid ${COLORS.border}`, alignItems: "flex-start",
    }}>
      <div style={{ marginTop: 2 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.tag || "#999", boxShadow: `0 0 0 3px ${(c.tag || "#999") + "22"}` }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Tag color={c.tag || "#666"} label={c.label || type} />
          <span style={{ fontWeight: 600, fontSize: 12, color: COLORS.text }}>{label}</span>
          <span style={{ fontSize: 11, color: COLORS.muted }}>{date}</span>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 3, flexWrap: "wrap" }}>
          {qty !== undefined && <span style={{ fontSize: 11, color: COLORS.text }}><strong>{qty}</strong> {unit}</span>}
          {price !== undefined && <span style={{ fontSize: 11, color: "#10b981" }}>₹{typeof price === "number" ? price.toFixed(2) : price}</span>}
          {sub && <span style={{ fontSize: 11, color: COLORS.muted }}>{sub}</span>}
        </div>
        {meta && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{meta}</div>}
      </div>
    </div>
  );
}

export default function ItemIntelligence({ onAgentUpdate, initialItemCode }) {
  const { stocks } = useAppContext();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);
  const debounceRef = useRef(null);

  // Suggest from local stocks context (instant)
  const handleSearch = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => {
      const lower = val.toLowerCase();
      const matches = (stocks || []).filter(s =>
        s.name?.toLowerCase().includes(lower) || s.item_code?.toLowerCase().includes(lower)
      ).slice(0, 12);
      setSuggestions(matches);
    }, 150);
  };

  const handleSelect = useCallback(async (item) => {
    setSelected(item);
    setSuggestions([]);
    setQuery(item.name);
    setData(null);
    setError(null);
    setLoading(true);

    const t0 = Date.now();

    try {
      // Fire agents in parallel
      onAgentUpdate?.("sentinel", { status: "done", count: 1 });
      onAgentUpdate?.("scout",    { status: "done", count: 1 });
      onAgentUpdate?.("tracer",   { status: "running" });
      onAgentUpdate?.("ledger",   { status: "running" });
      onAgentUpdate?.("pogrn",    { status: "running" });
      onAgentUpdate?.("indent",   { status: "running" });
      onAgentUpdate?.("analyst",  { status: "running" });
      onAgentUpdate?.("veritas",  { status: "running" });

      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);

      const res = await authedGet(
        `/api/reports/item-history/${encodeURIComponent(item.item_code)}?${params}`
      ).then(r => r.json());

      const elapsed = Date.now() - t0;

      if (!res.success) throw new Error(res.error || "Failed");

      onAgentUpdate?.("tracer",  { status: "done", count: res.data.ledger?.length || 0, ms: elapsed });
      onAgentUpdate?.("ledger",  { status: "done", count: res.data.ledger?.length || 0 });
      onAgentUpdate?.("pogrn",   { status: "done", count: (res.data.po_chain?.length || 0) + (res.data.grn_chain?.length || 0) });
      onAgentUpdate?.("indent",  { status: "done", count: res.data.indent_lines?.length || 0 });
      onAgentUpdate?.("analyst", { status: "done", count: 1 });
      onAgentUpdate?.("veritas", { status: "done", count: 1 });
      onAgentUpdate?.("composer",{ status: "done", count: 1, ms: elapsed });

      setData(res.data);
    } catch (e) {
      setError(e.message);
      onAgentUpdate?.("tracer",  { status: "error", error: e.message });
      onAgentUpdate?.("ledger",  { status: "error" });
      onAgentUpdate?.("pogrn",   { status: "error" });
      onAgentUpdate?.("indent",  { status: "error" });
      onAgentUpdate?.("analyst", { status: "error" });
      onAgentUpdate?.("veritas", { status: "error" });
      onAgentUpdate?.("composer",{ status: "error" });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, onAgentUpdate]);

  // Deep-link auto-select
  useEffect(() => {
    if (initialItemCode && stocks && stocks.length > 0) {
      const match = stocks.find(s => s.item_code === initialItemCode);
      if (match) {
        handleSelect(match);
      } else {
        handleSelect({ item_code: initialItemCode, name: initialItemCode });
      }
    }
  }, [initialItemCode, stocks, handleSelect]);

  const deptEntries = data ? Object.entries(data.summary?.dept_consumption || {}).sort((a,b) => b[1]-a[1]) : [];
  const totalDeptQty = deptEntries.reduce((a, [, v]) => a + v, 0);

  // Compute Composer Insights for this item
  const grnPrices = (data?.grn_chain || []).map(g => parseFloat(g.landed_cost || g.unit_price || 0)).filter(p => p > 0);
  const latestPrice = grnPrices.length > 0 ? grnPrices[0] : null;
  const oldestPrice = grnPrices.length > 1 ? grnPrices[grnPrices.length - 1] : null;
  const priceInflation = (latestPrice && oldestPrice && oldestPrice > 0)
    ? Math.round(((latestPrice - oldestPrice) / oldestPrice) * 100)
    : 0;

  const topDept = deptEntries.length > 0 ? deptEntries[0] : null;

  // Build unified timeline
  const timeline = data ? [
    ...(data.grn_chain || []).map(g => ({ type: "grn",      date: g.grn_date,   qty: g.qty_accepted, unit: g.unit, price: g.landed_cost, label: g.grn_number, sub: g.supplier_name, meta: `Batch: ${g.batch_no || "—"} | Invoice: ${g.invoice_no || "—"}` })),
    ...(data.po_chain  || []).map(p => ({ type: "po",       date: p.po_date,    qty: p.qty,          unit: p.unit, price: p.total_price,  label: p.po_number,  sub: p.supplier_name, meta: `Status: ${p.po_status}` })),
    ...(data.issuances || []).map(i => ({ type: "issuance", date: i.date,       qty: i.qty_issued,   unit: i.unit, price: undefined,       label: `To ${i.dept}`, sub: i.issued_by })),
    ...(data.indent_lines || []).map(i => ({ type: "indent", date: i.date,      qty: i.qty,          unit: i.unit, price: undefined,       label: `Indent #${i.indent_id} — ${i.dept}`, sub: `Status: ${i.status}`, meta: `Issued: ${i.issued_qty ?? "—"} ${i.unit}` })),
    ...(data.ledger || []).filter(l => l.transaction_type === "OUTWARD_ISSUE").map(l => ({
      type: "ledger", date: l.created_at?.slice(0,10), qty: l.qty, unit: l.unit, price: undefined,
      label: `Issued → ${l.department || "—"}`, sub: `${l.balance_qty_before} → ${l.balance_qty_after}`, meta: `Batch: ${l.batch_no || "—"}`,
    })),
  ].sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1) : [];

  // Scout Quick Select Chips from local stock
  const popularChips = (stocks || []).slice(0, 5);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Scout Quick Select Chips */}
      {popularChips.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
            <Zap size={12} color="#f4c84b" /> Agent Scout Suggestions:
          </span>
          {popularChips.map(s => (
            <button
              key={s.id || s.item_code}
              onClick={() => handleSelect(s)}
              style={{
                padding: "3px 9px",
                background: selected?.item_code === s.item_code ? "#18181b" : "#fff",
                color: selected?.item_code === s.item_code ? "#f4c84b" : COLORS.text,
                border: `1px solid ${selected?.item_code === s.item_code ? "#18181b" : COLORS.border}`,
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Search + Date filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }} />
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search item name or code (e.g. Chicken, KPL-CHK, Paneer)…"
            style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13, boxSizing: "border-box" }}
          />
          {suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 260, overflowY: "auto" }}>
              {suggestions.map(s => (
                <button key={s.id || s.item_code} onClick={() => handleSelect(s)} style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: COLORS.muted }}>{s.item_code} · {s.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "10px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "10px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
        {selected && <button onClick={() => handleSelect(selected)} style={{ padding: "10px 16px", background: "#18181b", color: "#f4c84b", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>↺ Refresh</button>}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
          <div style={{ fontSize: 28, marginBottom: 8, animation: "spin 1s infinite linear" }}>◎</div>
          <div>Synthesizing multi-agent lineage for <strong>{selected?.name}</strong>…</div>
        </div>
      )}

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #fecaca", borderRadius: 8, padding: 14, color: "#991b1b", display: "flex", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {data && !loading && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Item header */}
          <div style={{ background: "#18181b", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Package size={32} color="#f4c84b" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{data.item?.name}</div>
                <div style={{ fontSize: 12, color: "#71717a" }}>{data.item?.item_code} · {data.item?.category} · {data.item?.unit}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(244,200,75,0.15)", color: "#f4c84b", fontSize: 11, fontWeight: 700, border: "1px solid rgba(244,200,75,0.3)" }}>
                Verified By Agent Ledger
              </span>
            </div>
          </div>

          {/* Agent Composer Executive Bulletin */}
          <div style={{
            background: "#fff",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: "12px 16px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 800 }}>
              <Sparkles size={14} color="#f59e0b" />
              <span>Agent Composer Executive Summary</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 11 }}>
              <div style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                <span style={{ color: COLORS.muted }}>Consumption Driver: </span>
                <strong style={{ color: COLORS.text }}>
                  {topDept ? `${topDept[0]} (${Math.round((topDept[1] / (totalDeptQty || 1)) * 100)}% of demand)` : "No outward issues"}
                </strong>
              </div>
              <div style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                <span style={{ color: COLORS.muted }}>Price Volatility: </span>
                <strong style={{ color: priceInflation > 10 ? "#ef4444" : "#10b981" }}>
                  {latestPrice ? `Latest ₹${latestPrice.toFixed(2)} (${priceInflation >= 0 ? `+${priceInflation}%` : `${priceInflation}%`})` : "No GRN baseline"}
                </strong>
              </div>
              <div style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                <span style={{ color: COLORS.muted }}>Audit State: </span>
                <strong style={{ color: (data.summary?.current_balance || 0) < 0 ? "#ef4444" : "#10b981" }}>
                  {(data.summary?.current_balance || 0) < 0 ? "⚠ Negative Balance Alert" : "✓ Physical Balance Reconciled"}
                </strong>
              </div>
            </div>
          </div>

          {/* Summary stat cards */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard label="Total Inward" value={`${data.summary.total_inward} ${data.item?.unit}`} color="#10b981" />
            <StatCard label="Total Issued" value={`${data.summary.total_outward} ${data.item?.unit}`} color="#ef4444" />
            <StatCard label="Current Balance" value={`${data.summary.current_balance} ${data.item?.unit}`} color="#3b82f6" />
            <StatCard label="Total Spend" value={`₹${data.summary.total_spend?.toFixed(2)}`} color="#f4c84b" />
            <StatCard label="POs Raised" value={data.summary.total_po_count} />
            <StatCard label="GRNs Done" value={data.summary.total_grn_count} />
          </div>

          {/* Department consumption bar */}
          {deptEntries.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Department Consumption Breakdown</div>
              {deptEntries.map(([dept, qty]) => (
                <div key={dept} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{dept}</span>
                    <span style={{ fontSize: 11, color: COLORS.muted }}>{qty} {data.item?.unit} ({totalDeptQty > 0 ? Math.round(qty / totalDeptQty * 100) : 0}%)</span>
                  </div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${totalDeptQty > 0 ? (qty / totalDeptQty * 100) : 0}%`, background: "#f4c84b", borderRadius: 3, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Timeline toggle */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowTimeline(t => !t)} style={{ padding: "8px 16px", background: showTimeline ? "#18181b" : "#fff", color: showTimeline ? "#f4c84b" : COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              {showTimeline ? "▼ Unified Timeline" : "▶ Unified Timeline"} ({timeline.length} events)
            </button>
          </div>

          {showTimeline && (
            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px", maxHeight: 320, overflowY: "auto" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Complete Timeline (PO → GRN → Batch → Issue)</div>
              {timeline.map((ev, i) => <TimelineRow key={i} {...ev} />)}
            </div>
          )}

          {/* Collapsible sections */}
          <CollapsibleSection title="Purchase Orders" color="po" count={data.po_chain?.length || 0} defaultOpen>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginTop: 8 }}>
              <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>{["PO No","Date","Supplier","Qty","Unit","Unit Price","Total","Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: COLORS.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {(data.po_chain || []).map((p, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "7px 8px", fontWeight: 700, color: "#3b82f6" }}>{p.po_number}</td>
                    <td style={{ padding: "7px 8px" }}>{p.po_date}</td>
                    <td style={{ padding: "7px 8px" }}>{p.supplier_name}</td>
                    <td style={{ padding: "7px 8px" }}>{p.qty}</td>
                    <td style={{ padding: "7px 8px" }}>{p.unit}</td>
                    <td style={{ padding: "7px 8px" }}>₹{parseFloat(p.unit_price || 0).toFixed(2)}</td>
                    <td style={{ padding: "7px 8px" }}>₹{parseFloat(p.total_price || 0).toFixed(2)}</td>
                    <td style={{ padding: "7px 8px" }}><span style={{ padding: "2px 8px", borderRadius: 4, background: p.po_status === "Received" ? "#dcfce7" : "#fef9c3", color: p.po_status === "Received" ? "#166534" : "#854d0e", fontSize: 10, fontWeight: 700 }}>{p.po_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleSection>

          <CollapsibleSection title="Goods Receipt Notes" color="grn" count={data.grn_chain?.length || 0} defaultOpen>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginTop: 8 }}>
              <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>{["GRN No","Date","Supplier","Received","Accepted","Rejected","Unit Price","Landed Cost","Batch","Expiry"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: COLORS.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {(data.grn_chain || []).map((g, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "7px 8px", fontWeight: 700, color: "#10b981" }}>{g.grn_number}</td>
                    <td style={{ padding: "7px 8px" }}>{g.grn_date}</td>
                    <td style={{ padding: "7px 8px" }}>{g.supplier_name}</td>
                    <td style={{ padding: "7px 8px" }}>{g.qty_received}</td>
                    <td style={{ padding: "7px 8px", color: "#10b981", fontWeight: 700 }}>{g.qty_accepted}</td>
                    <td style={{ padding: "7px 8px", color: g.qty_rejected > 0 ? "#ef4444" : COLORS.muted }}>{g.qty_rejected}</td>
                    <td style={{ padding: "7px 8px" }}>₹{parseFloat(g.unit_price || 0).toFixed(2)}</td>
                    <td style={{ padding: "7px 8px", fontWeight: 700 }}>₹{parseFloat(g.landed_cost || 0).toFixed(2)}</td>
                    <td style={{ padding: "7px 8px", color: COLORS.muted }}>{g.batch_no || "—"}</td>
                    <td style={{ padding: "7px 8px", color: g.expiry_date ? "#f97316" : COLORS.muted }}>{g.expiry_date || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleSection>

          <CollapsibleSection title="Stock Ledger (Double-Entry)" color="ledger" count={data.ledger?.length || 0}>
            <div style={{ maxHeight: 300, overflowY: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>{["Date","Type","Qty","Unit","Price","Total","Before","After","Dept","Batch"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: COLORS.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {(data.ledger || []).map((l, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? "transparent" : "#fafafa" }}>
                      <td style={{ padding: "6px 8px" }}>{l.created_at?.slice(0,10)}</td>
                      <td style={{ padding: "6px 8px" }}><span style={{ fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 3, background: l.transaction_type?.startsWith("INWARD") ? "#dcfce7" : l.transaction_type?.startsWith("OUTWARD") ? "#fee2e2" : "#f1f5f9", color: l.transaction_type?.startsWith("INWARD") ? "#166534" : l.transaction_type?.startsWith("OUTWARD") ? "#991b1b" : "#475569" }}>{l.transaction_type}</span></td>
                      <td style={{ padding: "6px 8px", fontWeight: 700 }}>{l.qty}</td>
                      <td style={{ padding: "6px 8px" }}>{l.unit}</td>
                      <td style={{ padding: "6px 8px" }}>₹{parseFloat(l.unit_price || 0).toFixed(2)}</td>
                      <td style={{ padding: "6px 8px" }}>₹{parseFloat(l.total_value || 0).toFixed(2)}</td>
                      <td style={{ padding: "6px 8px", color: COLORS.muted }}>{l.balance_qty_before}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 700, color: "#3b82f6" }}>{l.balance_qty_after}</td>
                      <td style={{ padding: "6px 8px" }}>{l.department || "—"}</td>
                      <td style={{ padding: "6px 8px", color: COLORS.muted }}>{l.batch_no || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Indent Requests" color="indent" count={data.indent_lines?.length || 0}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginTop: 8 }}>
              <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>{["Indent #","Date","Dept","Requested","Issued","Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: COLORS.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {(data.indent_lines || []).map((l, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "7px 8px", fontWeight: 700, color: "#f97316" }}>#{l.indent_id}</td>
                    <td style={{ padding: "7px 8px" }}>{l.date}</td>
                    <td style={{ padding: "7px 8px" }}>{l.dept}</td>
                    <td style={{ padding: "7px 8px", fontWeight: 700 }}>{l.qty} {l.unit}</td>
                    <td style={{ padding: "7px 8px" }}>{l.issued_qty ?? "—"} {l.unit}</td>
                    <td style={{ padding: "7px 8px" }}><span style={{ padding: "2px 8px", borderRadius: 4, background: l.status === "Approved" ? "#dcfce7" : "#f1f5f9", color: l.status === "Approved" ? "#166534" : "#475569", fontSize: 10, fontWeight: 700 }}>{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleSection>
        </div>
      )}

      {!data && !loading && !error && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: COLORS.muted }}>
          <Package size={48} strokeWidth={1} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Search any inventory item</div>
          <div style={{ fontSize: 12, textAlign: "center", maxWidth: 360 }}>
            Type an item name or code above to see the complete chain:<br />
            PO → GRN → Stock Batch → Ledger → Issuance → Department
          </div>
        </div>
      )}
    </div>
  );
}
