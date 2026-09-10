import { useState, useEffect, useMemo } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import ErrorMsg from "../../components/ErrorMsg";
import MasterDataAgentStatusBar from "../../components/agents/MasterDataAgentStatusBar";
import { useAppContext } from "../../context/AppContext";
import { COLORS, RADIUS, SPACING } from "../../styles/colors";
import { Search, Building2, UserCheck, ArrowRight, Utensils, ArrowLeftRight, ChefHat, CheckCircle2 } from "lucide-react";
import * as api from "../../api";

const empty = { name: "", code: "", chef_name: "" };

export default function DepartmentsScreen() {
  const { setCurrentScreen } = useAppContext();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null); // id of department being edited
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  const loadDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.departments.list();
      if (res.success) {
        setItems(res.data);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 3000);
  };

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) return flash("Department name is required.", COLORS.coral);
    if (!form.code.trim()) return flash("Department code is required.", COLORS.coral);
    
    try {
      if (editing) {
        await api.departments.update(editing, form);
        flash("Department updated ✓");
      } else {
        await api.departments.create(form);
        flash("Department created ✓");
      }
      setForm(empty);
      setEditing(null);
      loadDepartments();
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  const startEdit = (d) => {
    setForm({ name: d.name, code: d.code, chef_name: d.chef_name || "" });
    setEditing(d.id);
  };

  const cancelEdit = () => {
    setForm(empty);
    setEditing(null);
  };

  const remove = async (id) => {
    if (!confirm("Delete this department? This cannot be undone.")) return;
    try {
      await api.departments.remove(id);
      flash("Department deleted.");
      loadDepartments();
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.chef_name && d.chef_name.toLowerCase().includes(q))
    );
  }, [items, search]);

  const assignedChefsCount = useMemo(() => {
    return items.filter((d) => d.chef_name && d.chef_name.trim().length > 0).length;
  }, [items]);

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Section title="Departments" sub="Manage kitchen units, dining rooms, operational routing, and head chef scoping">
      {/* Multi-Agent Governance Bar */}
      <MasterDataAgentStatusBar entityType="departments" />

      {/* KPI Stats Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: SPACING.md,
          marginBottom: SPACING.xl,
        }}
      >
        <Card style={{ padding: "14px 18px", border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Configured Units
            </span>
            <Building2 size={16} color={COLORS.accent} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>
            {items.length}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Active operational cost centers</span>
        </Card>

        <Card style={{ padding: "14px 18px", border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Kitchen Leads Assigned
            </span>
            <ChefHat size={16} color={COLORS.success} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.success, marginTop: 4 }}>
            {assignedChefsCount} / {items.length}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Designated Head Chefs / In-Charge</span>
        </Card>

        <Card style={{ padding: "14px 18px", border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Cross-Module Routing
            </span>
            <ArrowLeftRight size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6", marginTop: 4 }}>
            Active
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Linked to Indent, Issuance & Transfers</span>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
        {/* Form Card */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
              {editing ? "Edit Department" : "Add New Department"}
            </span>
            {editing && (
              <span style={{ fontSize: 10, background: `${COLORS.accent}22`, color: COLORS.accent, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                Editing ID #{editing}
              </span>
            )}
          </div>

          <Input 
            label="Department Name *" 
            value={form.name} 
            onChange={f("name")} 
            placeholder="e.g. Continental Kitchen" 
          />
          <Input 
            label="Code (Short identifier) *" 
            value={form.code} 
            onChange={f("code")} 
            placeholder="e.g. CON" 
          />
          <Input 
            label="Head Chef / Manager" 
            value={form.chef_name} 
            onChange={f("chef_name")} 
            placeholder="e.g. Chef Anthony" 
          />

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <Btn onClick={submit} style={{ flex: 1 }}>
              {editing ? "Save Changes" : "Add Department"}
            </Btn>
            {editing && (
              <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
            )}
          </div>
          {msg && (
            <p style={{ color: msg.color, fontSize: 12, marginTop: 10, textAlign: "center", fontWeight: 600 }}>
              {msg.text}
            </p>
          )}
        </Card>

        {/* List Card */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                Active Departments
              </span>
              <span style={{ color: COLORS.muted, fontSize: 12 }}>
                ({filteredItems.length} of {items.length} units)
              </span>
            </div>

            {/* Search Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                padding: "4px 10px",
                width: 220,
              }}
            >
              <Search size={14} color={COLORS.muted} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search units or chefs…"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: COLORS.text,
                  fontSize: 12,
                  width: "100%",
                }}
              />
            </div>
          </div>

          {loading ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading departments…</p>
          ) : error ? (
            <ErrorMsg error={error} />
          ) : filteredItems.length === 0 ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>
              {search ? "No departments match your filter." : "No departments configured."}
            </p>
          ) : (
            <div className="resp-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Department</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Code</th>
                    <th style={{ padding: "10px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Head Chef / Mgr</th>
                    <th style={{ padding: "10px 16px", textAlign: "center", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Operational Routing</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((d) => (
                    <tr 
                      key={d.id} 
                      style={{ borderBottom: `1px solid ${COLORS.border}22` }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surface; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: COLORS.text }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Utensils size={14} color={COLORS.accent} />
                          <span>{d.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, background: COLORS.bg, color: COLORS.accent, padding: "3px 7px", borderRadius: 4, border: `1px solid ${COLORS.border}` }}>
                          {d.code}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {d.chef_name ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: `${COLORS.success}22`,
                                border: `1px solid ${COLORS.success}`,
                                color: COLORS.success,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              {getInitials(d.chef_name)}
                            </div>
                            <span style={{ color: COLORS.text, fontSize: 12 }}>{d.chef_name}</span>
                          </div>
                        ) : (
                          <span style={{ color: COLORS.muted, fontSize: 12, fontStyle: "italic" }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            type="button"
                            onClick={() => setCurrentScreen("indent")}
                            title="Go to Indent Requests"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: `${COLORS.accent}15`,
                              border: `1px solid ${COLORS.accent}44`,
                              color: COLORS.accent,
                              padding: "3px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            <span>Indents</span>
                            <ArrowRight size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentScreen("transfers")}
                            title="Go to Stock Transfers"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: "rgba(59, 130, 246, 0.12)",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                              color: "#3b82f6",
                              padding: "3px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            <span>Transfers</span>
                            <ArrowRight size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentScreen("production_planner")}
                            title="Go to Production Planner"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: "rgba(16, 185, 129, 0.12)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              color: COLORS.success,
                              padding: "3px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            <span>Production</span>
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <Btn small variant="ghost" onClick={() => startEdit(d)}>Edit</Btn>
                          <Btn small variant="danger" onClick={() => remove(d.id)}>Delete</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Section>
  );
}

