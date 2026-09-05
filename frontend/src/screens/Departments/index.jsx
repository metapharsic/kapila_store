import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import * as api from "../../api";

const empty = { name: "", code: "", chef_name: "" };

export default function DepartmentsScreen() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null); // id of department being edited
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState("");

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
    setTimeout(() => setMsg(""), 2500);
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

  return (
    <Section title="Departments" sub="Manage kitchen units, dining rooms, and head chef routing">
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        {/* Form Card */}
        <Card>
          <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {editing ? "Edit Department" : "Add Department"}
          </p>

          <Input 
            label="Department Name *" 
            value={form.name} 
            onChange={f("name")} 
            placeholder="e.g. Continental Kitchen" 
          />
          <Input 
            label="Code (Short) *" 
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

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn onClick={submit} style={{ flex: 1 }}>
              {editing ? "Save Changes" : "Add Department"}
            </Btn>
            {editing && (
              <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
            )}
          </div>
          {msg && (
            <p style={{ color: msg.color, fontSize: 12, marginTop: 8, textAlign: "center" }}>
              {msg.text}
            </p>
          )}
        </Card>

        {/* List Card */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Active Departments</span>
            <span style={{ color: COLORS.muted, fontSize: 12 }}>{items.length} units</span>
          </div>

          {loading ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading…</p>
          ) : error ? (
            <ErrorMsg error={error} />
          ) : items.length === 0 ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>No departments configured.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Department</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Code</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Head Chef / Mgr</th>
                  <th style={{ padding: "10px 16px", textAlign: "right", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr 
                    key={d.id} 
                    style={{ borderBottom: `1px solid ${COLORS.border}22` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surface; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: COLORS.text }}>{d.name}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, background: COLORS.bg, color: COLORS.accent, padding: "2px 6px", borderRadius: 4 }}>
                        {d.code}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: COLORS.muted }}>{d.chef_name || "—"}</td>
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
          )}
        </Card>
      </div>
    </Section>
  );
}
