import React, { useState } from "react";
import { COLORS, STOCK_CATEGORIES } from "../../../styles/colors";
import { authedGet, api } from "../../../api/client";
import {
  Shield, Download, RefreshCw, Terminal, AlertTriangle, Activity,
  ShieldCheck, CheckCircle2, AlertOctagon, HelpCircle, Settings, Save
} from "lucide-react";

const DEPTS = ["TIFFINS","STAFF","SI-MEALS","NORTH INDIAN","CHAT & SOFTY","CHINESE & DOSA","MOCKTAILS & CONTINENTAL","RESTAURANT","ROOM SERVICE"];

/**
 * AdminControlPanel — Admin-privilege-gated control surface.
 * Shows global filter controls, granular Excel export, Agent Veritas System Integrity, and agent diagnostic console.
 * All state is React state only — no DOM mutations.
 */
export default function AdminControlPanel({ isAdmin, agents, onGlobalFilterChange }) {
  const [globalFilters, setGlobalFilters] = useState({
    category: "", department: "", dateFrom: "", dateTo: "", vendor: "",
  });
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportResult, setExportResult] = useState(null);

  // Veritas on-demand audit state
  const [veritasAudit, setVeritasAudit] = useState(null);
  const [veritasLoading, setVeritasLoading] = useState(false);

  // Report threshold settings (admin-configurable)
  const [reportSettings, setReportSettings] = useState({ price_spike_pct: "", dormancy_days: "" });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsResult, setSettingsResult] = useState(null);

  React.useEffect(() => {
    let active = true;
    setSettingsLoading(true);
    authedGet("/api/reports/settings")
      .then((r) => r.json())
      .then((res) => {
        if (active && res.success) {
          setReportSettings({
            price_spike_pct: res.data.price_spike_pct,
            dormancy_days: res.data.dormancy_days,
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setSettingsLoading(false); });
    return () => { active = false; };
  }, []);

  const saveReportSettings = async () => {
    setSettingsSaving(true);
    setSettingsResult(null);
    try {
      const res = await api.put("/api/reports/settings", {
        price_spike_pct: Number(reportSettings.price_spike_pct),
        dormancy_days: Number(reportSettings.dormancy_days),
      });
      setReportSettings({
        price_spike_pct: res.data.price_spike_pct,
        dormancy_days: res.data.dormancy_days,
      });
      setSettingsResult({ ok: true, msg: "Thresholds saved." });
    } catch (e) {
      setSettingsResult({ ok: false, msg: e.message });
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: COLORS.muted }}>
        <Shield size={52} strokeWidth={1} color="#ef4444" />
        <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b" }}>Admin Access Required</div>
        <div style={{ fontSize: 12, textAlign: "center", maxWidth: 340 }}>
          This panel is restricted to users with the <strong>Admin</strong> role.<br />
          Contact your system administrator to request access.
        </div>
      </div>
    );
  }

  const updateFilter = (key, val) => {
    const next = { ...globalFilters, [key]: val };
    setGlobalFilters(next);
  };

  const applyFilters = () => onGlobalFilterChange?.(globalFilters);
  const clearFilters = () => {
    const cleared = { category: "", department: "", dateFrom: "", dateTo: "", vendor: "" };
    setGlobalFilters(cleared);
    onGlobalFilterChange?.(cleared);
  };

  const exportGranularExcel = async () => {
    setExportLoading(true);
    setExportResult(null);
    try {
      const params = new URLSearchParams();
      if (globalFilters.category)   params.set("category", globalFilters.category);
      if (globalFilters.department) params.set("department", globalFilters.department);
      const res = await authedGet(`/api/reports/inventory-excel?${params}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `Kapila_Granular_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExportResult({ ok: true, msg: "Export downloaded successfully." });
    } catch (e) {
      setExportResult({ ok: false, msg: e.message });
    } finally {
      setExportLoading(false);
    }
  };

  const runVeritasAudit = async () => {
    setVeritasLoading(true);
    try {
      const res = await authedGet("/api/reports/data-quality-audit").then(r => r.json());
      if (res.success) {
        setVeritasAudit(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVeritasLoading(false);
    }
  };

  // Agent diagnostic summary
  const agentIds = Object.keys(agents || {});
  const agentDiag = agentIds.map(id => {
    const a = agents[id] || {};
    return { id, ...a };
  });

  return (
    <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Admin banner */}
      <div style={{ background: "linear-gradient(135deg, #18181b, #1c1917)", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 14, alignItems: "center" }}>
        <Shield size={32} color="#f4c84b" />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Admin Intelligence Console</div>
          <div style={{ fontSize: 11, color: "#71717a" }}>Full system access · All modules visible · Unrestricted multi-agent diagnostics</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
          <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* Agent Veritas System Integrity Radar */}
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} color="#10b981" />
            <span style={{ fontWeight: 800, fontSize: 13, color: COLORS.text }}>
              Agent Veritas — System Integrity & Reconciliation Health
            </span>
          </div>
          <button
            onClick={runVeritasAudit}
            disabled={veritasLoading}
            style={{
              padding: "6px 14px",
              background: "#18181b",
              color: "#f4c84b",
              border: "none",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: veritasLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <RefreshCw size={12} style={{ animation: veritasLoading ? "spin 1s infinite linear" : undefined }} />
            {veritasLoading ? "Auditing Database…" : "Run Veritas Audit"}
          </button>
        </div>

        {veritasAudit ? (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ background: "#fafafa", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 10, color: COLORS.muted }}>Integrity Score</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: veritasAudit.integrity_score >= 90 ? "#10b981" : "#ef4444" }}>
                  {veritasAudit.integrity_score}%
                </div>
                <div style={{ fontSize: 10, color: COLORS.muted }}>Status: {veritasAudit.status}</div>
              </div>
              <div style={{ background: "#fafafa", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 10, color: COLORS.muted }}>Total Discrepancies</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: veritasAudit.total_issues_found === 0 ? "#10b981" : "#f59e0b" }}>
                  {veritasAudit.total_issues_found}
                </div>
                <div style={{ fontSize: 10, color: COLORS.muted }}>Across all double-entry ledger items</div>
              </div>
            </div>

            {veritasAudit.issues && veritasAudit.issues.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {veritasAudit.issues.map((iss, i) => (
                  <div key={i} style={{ padding: "8px 12px", background: iss.severity === "CRITICAL" ? "#fef2f2" : "#fffbeb", borderRadius: 6, border: `1px solid ${iss.severity === "CRITICAL" ? "#fecaca" : "#fde68a"}`, fontSize: 11 }}>
                    <span style={{ fontWeight: 700, color: iss.severity === "CRITICAL" ? "#991b1b" : "#92400e" }}>
                      [{iss.severity}] {iss.title} ({iss.count} occurrences):
                    </span>{" "}
                    <span style={{ color: COLORS.text }}>{iss.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: COLORS.muted }}>
            Click "Run Veritas Audit" to scan physical stock ledger, indent-issuance alignment, and phantom balances.
          </div>
        )}
      </div>

      {/* Report Threshold Settings */}
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Settings size={15} color="#3b82f6" /> Intelligence Report Thresholds
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
          Controls the Cross-Module Intelligence Hub's cost-spike and dormancy detection sensitivity.
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
              Price Spike Threshold (%)
            </label>
            <input
              type="number"
              min="1"
              value={reportSettings.price_spike_pct}
              disabled={settingsLoading}
              onChange={(e) => setReportSettings((s) => ({ ...s, price_spike_pct: e.target.value }))}
              style={{ width: 140, padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, fontSize: 12, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
              Dormancy Window (days)
            </label>
            <input
              type="number"
              min="1"
              value={reportSettings.dormancy_days}
              disabled={settingsLoading}
              onChange={(e) => setReportSettings((s) => ({ ...s, dormancy_days: e.target.value }))}
              style={{ width: 140, padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, fontSize: 12, boxSizing: "border-box" }}
            />
          </div>
          <button
            onClick={saveReportSettings}
            disabled={settingsSaving || settingsLoading}
            style={{
              padding: "9px 18px", background: settingsSaving ? "#71717a" : "#18181b", color: "#f4c84b",
              border: "none", borderRadius: 8, cursor: settingsSaving ? "not-allowed" : "pointer",
              fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6
            }}
          >
            <Save size={13} /> {settingsSaving ? "Saving…" : "Save Thresholds"}
          </button>
          {settingsResult && (
            <span style={{ fontSize: 12, color: settingsResult.ok ? "#10b981" : "#ef4444" }}>
              {settingsResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Global Filter Controls */}
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={15} color="#f4c84b" /> Global Report Filters
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>Category</label>
            <select value={globalFilters.category} onChange={e => updateFilter("category", e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, fontSize: 12 }}>
              <option value="">All Categories</option>
              {STOCK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>Department</label>
            <select value={globalFilters.department} onChange={e => updateFilter("department", e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, fontSize: 12 }}>
              <option value="">All Departments</option>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>Date From</label>
            <input type="date" value={globalFilters.dateFrom} onChange={e => updateFilter("dateFrom", e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, fontSize: 12, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>Date To</label>
            <input type="date" value={globalFilters.dateTo} onChange={e => updateFilter("dateTo", e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, fontSize: 12, boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={applyFilters} style={{ padding: "9px 20px", background: "#18181b", color: "#f4c84b", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Apply to All Tabs</button>
          <button onClick={clearFilters} style={{ padding: "9px 16px", background: "transparent", color: "#ef4444", border: `1px solid #fecaca`, borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Clear All</button>
        </div>
      </div>

      {/* Granular Export */}
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Download size={15} color="#10b981" /> Granular Excel Export
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
          Exports full inventory with: stock batches, ledger, GRNs, PO linkages, department consumption, and reorder points. Applies the global filters above.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={exportGranularExcel}
            disabled={exportLoading}
            style={{ padding: "10px 22px", background: exportLoading ? "#71717a" : "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: exportLoading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
          >
            {exportLoading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Download size={14} /> Download Excel</>}
          </button>
          {exportResult && (
            <span style={{ fontSize: 12, color: exportResult.ok ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
              {exportResult.ok ? "✓" : <AlertTriangle size={14} />} {exportResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Agent Diagnostic Console */}
      <div style={{ background: "#111113", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
        <button onClick={() => setConsoleOpen(o => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
          <span style={{ color: "#f4c84b", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Terminal size={14} /> 9-Agent Diagnostic Console
          </span>
          <span style={{ color: "#52525b", fontSize: 11 }}>{consoleOpen ? "▲ Collapse" : "▼ Expand"}</span>
        </button>

        {consoleOpen && (
          <div style={{ marginTop: 12, fontFamily: "monospace", fontSize: 11 }}>
            <div style={{ color: "#52525b", marginBottom: 8 }}>// Real-time agent state — pure React state (zero DOM mutations)</div>
            {agentDiag.length === 0 && <div style={{ color: "#52525b" }}>No agent activity yet. Run any report tab.</div>}
            {agentDiag.map(a => {
              const statusColor = { idle: "#52525b", running: "#f59e0b", done: "#10b981", error: "#ef4444" }[a.status || "idle"];
              return (
                <div key={a.id} style={{ display: "flex", gap: 12, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: statusColor, minWidth: 70 }}>[{(a.status || "idle").toUpperCase()}]</span>
                  <span style={{ color: "#d4d4d8", minWidth: 100 }}>Agent.{a.id}</span>
                  <span style={{ color: "#71717a" }}>
                    {a.count !== undefined ? `payload=${a.count}` : ""}
                    {a.ms   !== undefined ? ` · ${a.ms}ms` : ""}
                    {a.error ? ` · ERR: ${a.error}` : ""}
                  </span>
                </div>
              );
            })}
            <div style={{ marginTop: 10, color: "#3f3f46", fontSize: 9 }}>
              STATE MEMO: All agent status driven by useReducer hook in PowerBiDashboard.jsx — zero document.querySelector or getElementById calls.
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
