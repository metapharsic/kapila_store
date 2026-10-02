import React, { useState, useCallback, useEffect } from "react";
import { authedGet } from "../../../api/client";
import { COLORS, STOCK_CATEGORIES } from "../../../styles/colors";
import { Grid, AlertCircle, TrendingDown, Package } from "lucide-react";

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden", width: 80 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
    </div>
  );
}

export default function CategoryDishLens({ dimensions, onAgentUpdate }) {
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("total_spend");
  const [sortDir, setSortDir] = useState("desc");

  const DEPTS = ["TIFFINS","STAFF","SI-MEALS","NORTH INDIAN","CHAT & SOFTY","CHINESE & DOSA","MOCKTAILS & CONTINENTAL","RESTAURANT","ROOM SERVICE"];

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    setLoading(true);

    const t0 = Date.now();

    onAgentUpdate?.("sentinel", { status: "done" });
    onAgentUpdate?.("scout",    { status: "running" });
    onAgentUpdate?.("tracer",   { status: "running" });
    onAgentUpdate?.("ledger",   { status: "running" });
    onAgentUpdate?.("pogrn",    { status: "idle" });
    onAgentUpdate?.("indent",   { status: "idle" });

    try {
      const params = new URLSearchParams();
      if (category)   params.set("category", category);
      if (department) params.set("department", department);
      if (dateFrom)   params.set("dateFrom", dateFrom);
      if (dateTo)     params.set("dateTo", dateTo);

      const res = await authedGet(`/api/reports/category-lens?${params}`);
      const elapsed = Date.now() - t0;

      if (!res.success) throw new Error(res.error || "Failed");

      onAgentUpdate?.("scout",    { status: "done", count: res.data.items?.length || 0, ms: elapsed });
      onAgentUpdate?.("tracer",   { status: "done", count: res.data.total_ledger_entries });
      onAgentUpdate?.("ledger",   { status: "done", count: res.data.summary?.total_ledger_entries || 0 });
      onAgentUpdate?.("composer", { status: "done", ms: elapsed });

      setData(res.data);
    } catch (e) {
      setError(e.message);
      onAgentUpdate?.("scout",    { status: "error", error: e.message });
      onAgentUpdate?.("tracer",   { status: "error" });
      onAgentUpdate?.("ledger",   { status: "error" });
      onAgentUpdate?.("composer", { status: "error" });
    } finally {
      setLoading(false);
    }
  }, [category, department, dateFrom, dateTo, onAgentUpdate]);

  // Auto-load on mount
  useEffect(() => { load(); }, []);

  const sortedItems = data ? [...(data.items || [])].sort((a, b) => {
    const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  }) : [];

  const maxSpend   = Math.max(...sortedItems.map(i => i.total_spend || 0), 1);
  const maxOutward = Math.max(...sortedItems.map(i => i.total_outward || 0), 1);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortHeader = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {label} {sortBy === col ? (sortDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12, minWidth: 160 }}>
          <option value="">All Categories</option>
          {STOCK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={department} onChange={e => setDepartment(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12, minWidth: 160 }}>
          <option value="">All Departments</option>
          {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
        <span style={{ color: COLORS.muted, fontSize: 11 }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
        <button onClick={load} style={{ padding: "9px 18px", background: "#18181b", color: "#f4c84b", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          ↺ Apply Filter
        </button>
        {(category || department || dateFrom || dateTo) && (
          <button onClick={() => { setCategory(""); setDepartment(""); setDateFrom(""); setDateTo(""); }} style={{ padding: "9px 14px", background: "transparent", color: "#ef4444", border: `1px solid #fecaca`, borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Clear</button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>◎</div>
          <div>Running category lens for <strong>{category || "All Categories"}</strong>…</div>
        </div>
      )}

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #fecaca", borderRadius: 8, padding: 14, color: "#991b1b", display: "flex", gap: 8 }}><AlertCircle size={16} />{error}</div>}

      {data && !loading && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Summary strip */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Items", value: data.summary?.total_items, color: COLORS.text },
              { label: "Total Spend", value: `₹${(data.summary?.total_spend || 0).toFixed(0)}`, color: "#10b981" },
              { label: "Total Issued", value: `${(data.summary?.total_outward || 0).toFixed(1)} units`, color: "#ef4444" },
              { label: "Ledger Entries", value: data.summary?.total_ledger_entries, color: "#8b5cf6" },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 10, color: COLORS.muted }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Two-column: dept breakdown + supplier breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Dept Consumption</div>
              {(data.dept_consumption || []).slice(0, 9).map((dept, i) => {
                const maxV = Math.max(...(data.dept_consumption || []).map(d => d.value), 1);
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{dept.dept}</span>
                      <span style={{ fontSize: 10, color: COLORS.muted }}>₹{dept.value?.toFixed(0)} · {dept.qty?.toFixed(1)} u</span>
                    </div>
                    <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${(dept.value / maxV) * 100}%`, background: "#f4c84b", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
              {(data.dept_consumption || []).length === 0 && <div style={{ fontSize: 11, color: COLORS.muted }}>No consumption data in range.</div>}
            </div>

            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Supplier Spend</div>
              {(data.supplier_breakdown || []).slice(0, 8).map((sup, i) => {
                const maxV = Math.max(...(data.supplier_breakdown || []).map(s => s.total_value), 1);
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{sup.supplier}</span>
                      <span style={{ fontSize: 10, color: COLORS.muted }}>₹{sup.total_value?.toFixed(0)} · {sup.item_count} items</span>
                    </div>
                    <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${(sup.total_value / maxV) * 100}%`, background: "#3b82f6", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
              {(data.supplier_breakdown || []).length === 0 && <div style={{ fontSize: 11, color: COLORS.muted }}>No supplier data in range.</div>}
            </div>
          </div>

          {/* Item table */}
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Item Detail ({sortedItems.length})</div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>Click column headers to sort</div>
            </div>
            <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", minWidth: 800 }}>
                <thead style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 1 }}>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    <SortHeader col="name" label="Item" />
                    <th style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 600 }}>Category</th>
                    <SortHeader col="total_spend" label="Total Spend" />
                    <SortHeader col="total_inward" label="Inward" />
                    <SortHeader col="total_outward" label="Issued" />
                    <SortHeader col="current_stock" label="Current Stock" />
                    <SortHeader col="avg_price" label="Avg Price" />
                    <th style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 600 }}>Suppliers</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: COLORS.muted, fontWeight: 600 }}>Depts</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? "transparent" : "#fafafa" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</td>
                      <td style={{ padding: "8px 10px" }}><span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "#f1f5f9", color: "#475569" }}>{item.category || "—"}</span></td>
                      <td style={{ padding: "8px 10px" }}>
                        <div>₹{(item.total_spend || 0).toFixed(0)}</div>
                        <MiniBar value={item.total_spend || 0} max={maxSpend} color="#10b981" />
                      </td>
                      <td style={{ padding: "8px 10px" }}>{(item.total_inward || 0).toFixed(2)} {item.unit}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <div>{(item.total_outward || 0).toFixed(2)} {item.unit}</div>
                        <MiniBar value={item.total_outward || 0} max={maxOutward} color="#ef4444" />
                      </td>
                      <td style={{ padding: "8px 10px", color: item.current_stock <= 0 ? "#ef4444" : "#10b981", fontWeight: 700 }}>{(item.current_stock || 0).toFixed(2)} {item.unit}</td>
                      <td style={{ padding: "8px 10px" }}>₹{(item.avg_price || 0).toFixed(2)}</td>
                      <td style={{ padding: "8px 10px", color: COLORS.muted, fontSize: 10 }}>{(item.suppliers || []).slice(0, 2).join(", ")}{(item.suppliers || []).length > 2 ? ` +${(item.suppliers || []).length - 2}` : ""}</td>
                      <td style={{ padding: "8px 10px", color: COLORS.muted, fontSize: 10 }}>{(item.departments || []).slice(0, 2).join(", ")}{(item.departments || []).length > 2 ? ` +${(item.departments || []).length - 2}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
