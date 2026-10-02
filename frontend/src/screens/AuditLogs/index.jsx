import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "../../api";
import { COLORS } from "../../styles/colors";
import {
  Shield, Search, Filter, Download, RefreshCw, ChevronDown,
  ChevronRight, AlertTriangle, AlertOctagon, Info, CheckCircle,
  Clock, User, Database, Globe, Activity, X, BarChart2,
  Calendar, Zap, TrendingUp, FileText,
} from "lucide-react";

/* ─── Severity config ─────────────────────────────────────────── */
const SEV = {
  critical: { label: "CRITICAL", color: "#ef4444", bg: "#fef2f2", border: "#fca5a5", icon: AlertOctagon },
  high:     { label: "HIGH",     color: "#f97316", bg: "#fff7ed", border: "#fdba74", icon: AlertTriangle },
  medium:   { label: "MEDIUM",   color: "#eab308", bg: "#fefce8", border: "#fde047", icon: AlertTriangle },
  low:      { label: "LOW",      color: "#22c55e", bg: "#f0fdf4", border: "#86efac", icon: CheckCircle  },
  info:     { label: "INFO",     color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd", icon: Info         },
};
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

function SeverityBadge({ severity }) {
  const s = SEV[severity] || SEV.info;
  const Icon = s.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      <Icon size={10} /> {s.label}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color = COLORS.gold }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--color-border)",
      borderRadius: 12, padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 160,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>{value ?? "—"}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MiniBar({ label, count, max, severity }) {
  const s = SEV[severity] || SEV.info;
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{count.toLocaleString()}</span>
      </div>
      <div style={{ height: 5, background: "var(--color-border)", borderRadius: 999 }}>
        <div style={{ height: 5, width: `${pct}%`, background: s.color, borderRadius: 999, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function DiffViewer({ before, after }) {
  if (!before && !after) return <div style={{ color: "var(--text-muted)", fontSize: 12 }}>No change data captured.</div>;
  const renderObj = (obj, side) => {
    if (!obj) return <div style={{ fontSize: 11, color: "var(--text-muted)", padding: 8 }}>—</div>;
    const parsed = typeof obj === "string" ? JSON.parse(obj) : obj;
    return (
      <pre style={{
        margin: 0, padding: "10px 12px", fontSize: 11, lineHeight: 1.7, fontFamily: "monospace",
        color: side === "before" ? "#ef4444" : "#22c55e",
        background: side === "before" ? "#fef2f2" : "#f0fdf4",
        borderRadius: 6, overflowX: "auto", maxHeight: 220,
      }}>
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 4, letterSpacing: "0.05em" }}>BEFORE</div>
        {renderObj(before, "before")}
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", marginBottom: 4, letterSpacing: "0.05em" }}>AFTER</div>
        {renderObj(after, "after")}
      </div>
    </div>
  );
}

function LogRow({ row, onExpand, expanded }) {
  const s = SEV[row.severity] || SEV.info;
  const ts = new Date(row.created_at);
  return (
    <>
      <tr
        onClick={onExpand}
        style={{ borderTop: "1px solid var(--color-border)", cursor: "pointer", background: expanded ? s.bg : "transparent" }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = "var(--bg-hover,#ffffff08)"; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        <td style={TD}><SeverityBadge severity={row.severity} /></td>
        <td style={TD}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
            {ts.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </td>
        <td style={TD}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: COLORS.gold + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: COLORS.gold, flexShrink: 0 }}>
              {(row.actor_name || "S").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{row.actor_name || "System"}</div>
              {row.ip_address && <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}><Globe size={9} /> {row.ip_address}</div>}
            </div>
          </div>
        </td>
        <td style={TD}>
          <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: "monospace" }}>
            {row.action}
          </span>
        </td>
        <td style={TD}>
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{row.resource}</span>
          {row.resource_id && <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>#{row.resource_id}</span>}
        </td>
        <td style={TD}>
          {row.department_name
            ? <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: "#e8a83818", color: COLORS.gold, fontWeight: 600 }}>{row.department_name}</span>
            : <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>}
        </td>
        <td style={{ ...TD, width: 30, textAlign: "center" }}>
          {expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: "0 16px 16px", background: "var(--bg-card)" }}>
            <div style={{ border: `1px solid ${s.border}`, borderRadius: 10, overflow: "hidden", borderTop: `3px solid ${s.color}` }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--color-border)", background: s.bg }}>
                {[
                  { label: "Log ID", value: `#${row.id}` },
                  { label: "Timestamp", value: ts.toLocaleString("en-IN") },
                  { label: "Actor", value: row.actor_name || "System" },
                  { label: "Actor ID", value: row.actor_user_id || "—" },
                  { label: "IP Address", value: row.ip_address || "—" },
                  { label: "Department", value: row.department_name || "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600, fontFamily: "monospace" }}>{value}</div>
                  </div>
                ))}
              </div>
              {row.user_agent && (
                <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--bg-card)" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>USER AGENT</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>{row.user_agent}</div>
                </div>
              )}
              {row.metadata && (
                <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--bg-card)" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>METADATA</div>
                  <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "var(--text-primary)", background: "var(--bg-surface)", padding: "8px 10px", borderRadius: 6, overflowX: "auto", maxHeight: 120 }}>
                    {JSON.stringify(typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {(row.before || row.after) && (
                <div style={{ padding: "12px 16px", background: "var(--bg-card)" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>CHANGE DIFF</div>
                  <DiffViewer before={row.before} after={row.after} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SelectFilter({ value, onChange, placeholder, children }) {
  return (
    <div style={{ position: "relative", flex: "1 1 130px" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        width: "100%", padding: "7px 28px 7px 10px", borderRadius: 8,
        border: `1px solid ${value ? COLORS.gold + "80" : "var(--color-border)"}`,
        background: value ? `${COLORS.gold}08` : "var(--bg-surface)",
        color: value ? "var(--text-primary)" : "var(--text-muted)",
        fontSize: 12, outline: "none", appearance: "none", cursor: "pointer",
      }}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }} />
    </div>
  );
}

const LIMIT = 50;

export default function AuditLogsScreen() {
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [statsData, setStats]   = useState(null);
  const [distinct, setDistinct] = useState({ actions: [], resources: [], departments: [], actors: [] });
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setTab]     = useState("logs");

  const [search,     setSearch]    = useState("");
  const [fAction,    setFAction]   = useState("");
  const [fRes,       setFRes]      = useState("");
  const [fDept,      setFDept]     = useState("");
  const [fActor,     setFActor]    = useState("");
  const [fSev,       setFSev]      = useState("");
  const [dateFrom,   setDateFrom]  = useState("");
  const [dateTo,     setDateTo]    = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const timerRef    = useRef(null);
  const searchTimer = useRef(null);

  const buildParams = useCallback((pg = 1) => ({
    page: pg, limit: LIMIT,
    ...(search   && { search }),
    ...(fAction  && { action: fAction }),
    ...(fRes     && { resource: fRes }),
    ...(fDept    && { department_name: fDept }),
    ...(fActor   && { actor_user_id: fActor }),
    ...(fSev     && { severity: fSev }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo   && { date_to: dateTo }),
  }), [search, fAction, fRes, fDept, fActor, fSev, dateFrom, dateTo]);

  const fetchLogs = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const res = await api.auditLogs.list(buildParams(pg));
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPage(pg);
    } finally { setLoading(false); }
  }, [buildParams]);

  const fetchStats    = useCallback(async () => { try { const r = await api.auditLogs.stats();    setStats(r.data); } catch {} }, []);
  const fetchDistinct = useCallback(async () => { try { const r = await api.auditLogs.distinct(); setDistinct(r.data || {}); } catch {} }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchLogs(1), 380);
    return () => clearTimeout(searchTimer.current);
  }, [search, fAction, fRes, fDept, fActor, fSev, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); fetchDistinct(); }, []);

  useEffect(() => {
    if (autoRefresh) timerRef.current = setInterval(() => fetchLogs(page), 30000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, page, fetchLogs]);

  const handleExport = async () => {
    const res = await fetch(`/api/audit-logs/export?${new URLSearchParams(buildParams(1))}`, { credentials: "include" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `kapila-audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setSearch(""); setFAction(""); setFRes(""); setFDept(""); setFActor(""); setFSev(""); setDateFrom(""); setDateTo(""); };
  const hasFilters = search || fAction || fRes || fDept || fActor || fSev || dateFrom || dateTo;
  const totalPages = Math.ceil(total / LIMIT);
  const maxSevCount = statsData ? Math.max(...SEVERITY_ORDER.map((s) => statsData.severityBreakdown[s] || 0), 1) : 1;
  const maxActionCount = statsData ? Math.max(...(statsData.actionBreakdown || []).map((a) => a.count), 1) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#1e293b,#334155)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
            <Shield size={22} color={COLORS.gold} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Audit Logs</h1>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Tamper-evident system activity trail · {total.toLocaleString()} records</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setAutoRefresh((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-border)", background: autoRefresh ? "#22c55e18" : "var(--bg-card)", color: autoRefresh ? "#22c55e" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Zap size={13} /> {autoRefresh ? "Live ●" : "Auto-Refresh"}
          </button>
          <button onClick={() => { fetchLogs(page); fetchStats(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleExport} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: `1px solid ${COLORS.gold}40`, background: `${COLORS.gold}15`, color: COLORS.gold, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {statsData && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <KpiCard icon={Activity}     label="Total Events"  value={statsData.total?.toLocaleString()}     sub="All time"      color="#3b82f6" />
          <KpiCard icon={Clock}        label="Today"         value={statsData.today?.toLocaleString()}     sub="Last 24 hrs"   color="#22c55e" />
          <KpiCard icon={Calendar}     label="This Week"     value={statsData.thisWeek?.toLocaleString()}  sub="Last 7 days"   color={COLORS.gold} />
          <KpiCard icon={TrendingUp}   label="This Month"    value={statsData.thisMonth?.toLocaleString()} sub="Last 30 days"  color="#8b5cf6" />
          <KpiCard icon={AlertOctagon} label="Critical"      value={(statsData.severityBreakdown?.critical || 0).toLocaleString()} sub="High-risk events" color="#ef4444" />
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--color-border)" }}>
        {[{ id: "logs", label: "Event Log", icon: FileText }, { id: "analytics", label: "Analytics", icon: BarChart2 }].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", border: "none", cursor: "pointer", background: "transparent", fontSize: 13, fontWeight: 600, color: activeTab === id ? COLORS.gold : "var(--text-muted)", borderBottom: activeTab === id ? `2px solid ${COLORS.gold}` : "2px solid transparent", marginBottom: -1 }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ─── LOGS TAB ─── */}
      {activeTab === "logs" && (<>
        {/* Filter Bar */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flex: "2 1 220px" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actor, action, resource, IP…"
                style={{ width: "100%", paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
            </div>
            <SelectFilter value={fSev}    onChange={setFSev}    placeholder="Severity">
              {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{SEV[s].label}</option>)}
            </SelectFilter>
            <SelectFilter value={fAction} onChange={setFAction} placeholder="Action">
              {(distinct.actions || []).map((a) => <option key={a} value={a}>{a}</option>)}
            </SelectFilter>
            <SelectFilter value={fRes}    onChange={setFRes}    placeholder="Resource">
              {(distinct.resources || []).map((r) => <option key={r} value={r}>{r}</option>)}
            </SelectFilter>
            <SelectFilter value={fDept}   onChange={setFDept}   placeholder="Department">
              {(distinct.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
            </SelectFilter>
            <SelectFilter value={fActor}  onChange={setFActor}  placeholder="Actor">
              {(distinct.actors || []).map((a) => <option key={a.actor_user_id} value={a.actor_user_id}>{a.actor_name}</option>)}
            </SelectFilter>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" style={datePicker} />
            <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   title="To date"   style={datePicker} />
            {hasFilters && (
              <button onClick={clearFilters} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--bg-surface)", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                <X size={11} /> Clear
              </button>
            )}
          </div>
          {hasFilters && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {[
                { k: "search", v: search,   label: `"${search}"` },
                { k: "sev",    v: fSev,     label: `Severity: ${fSev}` },
                { k: "action", v: fAction,  label: `Action: ${fAction}` },
                { k: "res",    v: fRes,     label: `Resource: ${fRes}` },
                { k: "dept",   v: fDept,    label: `Dept: ${fDept}` },
                { k: "actor",  v: fActor,   label: `Actor: ${fActor}` },
                { k: "from",   v: dateFrom, label: `From: ${dateFrom}` },
                { k: "to",     v: dateTo,   label: `To: ${dateTo}` },
              ].filter((f) => f.v).map(({ k, label }) => (
                <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, fontSize: 11, background: `${COLORS.gold}18`, color: COLORS.gold, fontWeight: 600 }}>
                  <Filter size={9} /> {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden" }}>
          {loading && <div style={{ height: 3, background: `linear-gradient(90deg,${COLORS.gold},transparent)` }} />}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-surface)" }}>
                  {["Severity", "Time", "Actor", "Action", "Resource", "Department", ""].map((h) => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                      <Shield size={32} style={{ opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
                      {hasFilters ? "No logs match your filters." : "No audit events recorded yet."}
                    </td>
                  </tr>
                ) : rows.map((row) => (
                  <LogRow key={row.id} row={row} expanded={expanded === row.id} onExpand={() => setExpanded(expanded === row.id ? null : row.id)} />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--color-border)", background: "var(--bg-surface)", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()} events
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { label: "← Prev", disabled: page <= 1, fn: () => fetchLogs(page - 1) },
                  ...Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    return { label: String(p), fn: () => fetchLogs(p), active: p === page };
                  }),
                  { label: "Next →", disabled: page >= totalPages, fn: () => fetchLogs(page + 1) },
                ].map(({ label, disabled, fn, active }) => (
                  <button key={label} onClick={fn} disabled={disabled} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: disabled ? "default" : "pointer", border: active ? `1px solid ${COLORS.gold}` : "1px solid var(--color-border)", background: active ? `${COLORS.gold}20` : "var(--bg-card)", color: active ? COLORS.gold : disabled ? "var(--text-muted)" : "var(--text-primary)", fontWeight: active ? 700 : 400, opacity: disabled ? 0.4 : 1 }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </>)}

      {/* ─── ANALYTICS TAB ─── */}
      {activeTab === "analytics" && statsData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>

          <div style={analyticsCard}>
            <h3 style={cardTitle}><AlertTriangle size={14} color={COLORS.gold} /> Severity Breakdown (30 days)</h3>
            {SEVERITY_ORDER.map((sev) => (
              <MiniBar key={sev} label={SEV[sev].label} count={statsData.severityBreakdown[sev] || 0} max={maxSevCount} severity={sev} />
            ))}
          </div>

          <div style={analyticsCard}>
            <h3 style={cardTitle}><Activity size={14} color="#3b82f6" /> Top Actions (30 days)</h3>
            {(statsData.actionBreakdown || []).slice(0, 8).map(({ action, count, severity }) => (
              <MiniBar key={action} label={action} count={count} max={maxActionCount} severity={severity} />
            ))}
          </div>

          <div style={analyticsCard}>
            <h3 style={cardTitle}><User size={14} color="#8b5cf6" /> Most Active Users (30 days)</h3>
            {(statsData.topActors || []).map(({ actor_name, actions }, i) => {
              const clr = ["#3b82f6","#8b5cf6",COLORS.gold,"#22c55e","#ef4444"][i % 5];
              return (
                <div key={actor_name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: clr + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: clr, flexShrink: 0 }}>
                    {actor_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{actor_name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{parseInt(actions).toLocaleString()} events</span>
                    </div>
                    <div style={{ height: 4, background: "var(--color-border)", borderRadius: 999 }}>
                      <div style={{ height: 4, borderRadius: 999, background: clr, width: `${(parseInt(actions) / parseInt(statsData.topActors[0]?.actions || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={analyticsCard}>
            <h3 style={cardTitle}><Database size={14} color="#22c55e" /> Most Accessed Resources (30 days)</h3>
            {(statsData.topResources || []).map(({ resource, hits }) => (
              <div key={resource} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "monospace" }}>{resource}</span>
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "#22c55e18", color: "#22c55e" }}>{parseInt(hits).toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Daily Sparkline */}
          <div style={{ ...analyticsCard, gridColumn: "span 2" }}>
            <h3 style={cardTitle}><TrendingUp size={14} color={COLORS.gold} /> Daily Activity (Last 14 Days)</h3>
            {(() => {
              const data = statsData.dailyActivity || [];
              const mx = Math.max(...data.map((d) => parseInt(d.count)), 1);
              return (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90, paddingBottom: 20, position: "relative" }}>
                  {data.map(({ day, count }) => (
                    <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                      <div title={`${day}: ${count} events`} style={{ width: "100%", background: `linear-gradient(to top,${COLORS.gold},${COLORS.gold}80)`, height: `${Math.max((parseInt(count) / mx) * 70, 4)}px`, borderRadius: "3px 3px 0 0", minWidth: 4, transition: "height 0.5s ease" }} />
                      <div style={{ fontSize: 8, color: "var(--text-muted)", transform: "rotate(-40deg)", transformOrigin: "top right", whiteSpace: "nowrap", marginTop: 4 }}>{day.slice(5)}</div>
                    </div>
                  ))}
                  {data.length === 0 && <div style={{ flex: 1, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No activity data yet</div>}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

const TH = { textAlign: "left", padding: "10px 14px", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" };
const TD = { padding: "11px 14px", verticalAlign: "middle" };
const datePicker = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 12, outline: "none", cursor: "pointer", flex: "1 1 130px" };
const analyticsCard = { background: "var(--bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "18px 20px" };
const cardTitle = { margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 };
