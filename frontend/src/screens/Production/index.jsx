import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Select from "../../components/Select";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS, DEPARTMENTS } from "../../styles/colors";
import { usePaginatedApi } from "../../hooks/useApi";
import * as api from "../../api";
import { useAppContext } from "../../context/AppContext";
import { Utensils, ArchiveRestore, BarChart3 } from "lucide-react";

import { today } from "../../utils/dates";
import LeftoverScreen from "../Leftovers";
import WasteAnalyticsScreen from "../WasteAnalytics";
import { useAuth } from "../../context/AuthContext";
import ProtectedScreen from "../../components/ProtectedScreen";

const LIMIT = 20;

export default function ProductionScreen() {
  const { hasPermission, roles } = useAuth();
  const { setCurrentScreen } = useAppContext();
  const isChef = roles.some((r) => r.key === "chef");

  const tabs = [];
  if (hasPermission("production.view")) {
    tabs.push({ id: "production", label: "Daily Production", icon: <Utensils size={16} /> });
  }
  if (hasPermission("leftovers.view")) {
    tabs.push({ id: "leftovers", label: "Leftovers Logs", icon: <ArchiveRestore size={16} /> });
  }
  if (hasPermission("waste_analytics.view")) {
    tabs.push({ id: "waste", label: "Waste Analytics", icon: <BarChart3 size={16} /> });
  }

  const [activeTab, setActiveTab] = useState(() => {
    return tabs[0]?.id || "";
  });

  if (tabs.length === 0) {
    return (
      <ProtectedScreen permission="production.view">
        <div />
      </ProtectedScreen>
    );
  }

  // Production Form & List state (originally from ProductionScreen)
  const [form, setForm] = useState({ dept: DEPARTMENTS[0], date: today(), item_name: "", plates: "", notes: "" });
  const [msg, setMsg]   = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.production.list);

  const load = (overrides = {}) =>
    fetch({ limit: LIMIT, sort: "date", order: "desc", dept: deptFilter, ...overrides });

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.item_name || form.plates === "" || form.plates === null || form.plates === undefined) return;
    try {
      await api.production.create({ ...form, plates: parseInt(form.plates) });
      setForm({ dept: DEPARTMENTS[0], date: today(), item_name: "", plates: "", notes: "" });
      setMsg("Production logged ✓");
      setTimeout(() => setMsg(""), 2000);
      load({ page: 1 });
    } catch (e) { setMsg("Error: " + e.message); }
  };

  return (
    <Section 
      title="Daily Production & Waste" 
      sub="Log finished plates, record leftovers, and manage food waste"
      onBack={isChef ? () => setCurrentScreen("chef_home") : null}
    >
      {/* Tabs Menu */}
      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 24, gap: 8, flexShrink: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? `2px solid ${COLORS.brand}` : "2px solid transparent",
              color: activeTab === tab.id ? COLORS.text : COLORS.muted,
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {activeTab === "production" && (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
            <Card>
              <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Log production</p>
              <Select label="Department" value={form.dept} onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))}>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </Select>
              <Input label="Date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              <Input label="Dish / Item Name" value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} placeholder="e.g. Idli, Chicken Curry" />
              <Input label="Plates / portions prepared" type="number" value={form.plates} onChange={(e) => setForm((f) => ({ ...f, plates: e.target.value }))} placeholder="0" />
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "8px 12px", width: "100%", fontFamily: "'DM Sans',sans-serif", fontSize: 13, resize: "vertical" }} />
              </div>
              <Btn onClick={submit} style={{ width: "100%" }}>Log Production</Btn>
              {msg && <p style={{ color: COLORS.success, fontSize: 12, marginTop: 8, textAlign: "center" }}>{msg}</p>}
            </Card>

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 10, alignItems: "center" }}>
                <SearchBar onSearch={(q) => load({ page: 1, q })} placeholder="Search notes or items…" />
                <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); load({ page: 1, dept: e.target.value }); }}
                  style={{ width: 150, padding: "7px 10px", fontSize: 12 }}>
                  <option value="">All depts</option>
                  {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>

              {loading ? (
                <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading…</p>
              ) : error ? (
                <ErrorMsg error={error} />
              ) : items.length === 0 ? (
                <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>No production logged yet</p>
              ) : (
                <>
                  <div style={{ overflowY: "auto", maxHeight: 400 }}>
                    {items.map((p) => (
                      <div key={p.id} style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}22` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <div>
                            <span style={{ fontWeight: 600, color: COLORS.text, display: "block", fontSize: 15 }}>{p.item_name}</span>
                            <span style={{ fontWeight: 600, color: COLORS.accent, fontSize: 12 }}>{p.dept}</span>
                            <span style={{ color: COLORS.muted, fontSize: 12, marginLeft: 10 }}>
                              &nbsp;{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <span style={{ fontFamily: "'DM Serif Display'", fontSize: 20, color: COLORS.teal }}>{p.plates} plates</span>
                        </div>
                        {p.notes && <p style={{ fontSize: 12, color: COLORS.muted }}>{p.notes}</p>}
                      </div>
                    ))}
                  </div>
                  <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
                </>
              )}
            </Card>
          </div>
        )}

        {activeTab === "leftovers" && (
          <LeftoverScreen noSection={true} />
        )}

        {activeTab === "waste" && (
          <WasteAnalyticsScreen noSection={true} />
        )}
      </div>
    </Section>
  );
}
