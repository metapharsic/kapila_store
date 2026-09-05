import { useEffect, useMemo, useState } from "react";
import * as api from "../../api";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import StoreLiveMonitorCard from "../../components/StoreLiveMonitorCard";
import { COLORS } from "../../styles/colors";
import { useAuth } from "../../context/AuthContext";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  employee_code: "",
  temporary_password: "ChangeMe123!",
  role_ids: [],
  department_ids: [],
  is_active: true,
};

export default function UserManagementScreen() {
  const { refreshSession } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const [activityUser, setActivityUser] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);

  const [allPermissions, setAllPermissions] = useState([]);
  const [matrixEdits, setMatrixEdits] = useState({});
  const [savingMatrix, setSavingMatrix] = useState(false);

  const selectedRoleNames = useMemo(() => new Set(form.role_ids.map(Number)), [form.role_ids]);

  const load = async () => {
    const [usersRes, rolesRes, deptRes, permsRes] = await Promise.all([
      api.users.list({ limit: 100 }),
      api.roles.list(),
      api.departments.list(),
      api.permissions.list(),
    ]);
    setUsers(usersRes.data || []);
    setRoles(rolesRes.data || []);
    setDepartments(deptRes.data || []);
    setAllPermissions(permsRes.data || []);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const toggleArray = (key, id) => {
    setForm((prev) => {
      const idNum = Number(id);
      const current = new Set((prev[key] || []).map(Number));
      current.has(idNum) ? current.delete(idNum) : current.add(idNum);
      return { ...prev, [key]: Array.from(current) };
    });
  };

  const startEdit = (user) => {
    setEditing(user.id);
    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      employee_code: user.employee_code || "",
      temporary_password: "ChangeMe123!",
      role_ids: (user.roles || []).map((r) => r.id),
      department_ids: (user.departments || []).map((d) => d.id),
      is_active: user.is_active,
    });
  };

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
  };

  const submit = async () => {
    setError("");
    try {
      if (editing) {
        await api.users.update(editing, {
          name: form.name,
          phone: form.phone,
          role_ids: form.role_ids,
          department_ids: form.department_ids,
          is_active: form.is_active,
        });
      } else {
        await api.users.create(form);
      }
      reset();
      await load();
      await refreshSession();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (user) => {
    await api.users.setActive(user.id, !user.is_active);
    await load();
  };

  const resetPassword = async (user) => {
    const temp = window.prompt(`Temporary password for ${user.name}`, "ChangeMe123!");
    if (!temp) return;
    await api.users.resetPassword(user.id, temp);
    await load();
  };

  const viewActivity = async (user) => {
    setActivityUser(user);
    setLoadingActivity(true);
    setActivityLogs([]);
    try {
      const res = await api.users.activity(user.id);
      if (res.success) setActivityLogs(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingActivity(false);
    }
  };

  const openRoleMatrix = () => {
    const edits = {};
    roles.forEach(r => {
      edits[r.id] = new Set(r.permissions?.map(p => p.id) || []);
    });
    setMatrixEdits(edits);
    setShowRoleMatrix(true);
  };

  const toggleMatrixPermission = (roleId, permissionId) => {
    setMatrixEdits(prev => {
      const current = new Set(prev[roleId]);
      if (current.has(permissionId)) current.delete(permissionId);
      else current.add(permissionId);
      return { ...prev, [roleId]: current };
    });
  };

  const saveMatrix = async () => {
    setSavingMatrix(true);
    setError("");
    try {
      await Promise.all(
        roles.map(r => {
          if (r.key === 'admin') return Promise.resolve(); // Never modify admin
          const permission_ids = Array.from(matrixEdits[r.id] || []);
          return api.roles.update(r.id, { permission_ids });
        })
      );
      setShowRoleMatrix(false);
      await load();
      await refreshSession();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingMatrix(false);
    }
  };

  return (
    <Section title="User Management" sub="Create users, assign roles, departments, and account status">
      {error && <div style={{ color: COLORS.danger, marginBottom: 12 }}>{error}</div>}
      <StoreLiveMonitorCard />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 18, alignItems: "start" }}>
        <Card>
          <h3 style={{ marginTop: 0, color: COLORS.text }}>{editing ? "Edit User" : "Create User"}</h3>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {!editing && <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {!editing && <Input label="Employee Code" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />}
          {!editing && <Input label="Temporary Password" value={form.temporary_password} onChange={(e) => setForm({ ...form, temporary_password: e.target.value })} />}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={label}>Roles</div>
            <button onClick={openRoleMatrix} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>View Permissions Matrix</button>
          </div>
          <div style={chipGrid}>
            {roles.map((role) => (
              <button key={role.id} onClick={() => toggleArray("role_ids", role.id)} style={chip(selectedRoleNames.has(role.id))}>
                {role.name}
              </button>
            ))}
          </div>

          <div style={label}>Departments (Data Scoping)</div>
          <div style={chipGrid}>
            {departments.map((dept) => (
              <button key={dept.id} onClick={() => toggleArray("department_ids", dept.id)} style={chip(form.department_ids.map(Number).includes(dept.id))}>
                {dept.name}
              </button>
            ))}
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "14px 0", color: COLORS.text }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active user
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={submit} style={{ flex: 1 }}>{editing ? "Save Changes" : "Create User"}</Btn>
            {editing && <Btn variant="ghost" onClick={reset}>Cancel</Btn>}
          </div>
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: COLORS.text, fontSize: 13 }}>
            <thead>
              <tr style={{ background: COLORS.surface }}>
                {["User", "Role", "Department", "Status", "Last Login", "Actions"].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{user.name}</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>{user.email}</div>
                  </td>
                  <td style={td}>{(user.roles || []).map((r) => r.name).join(", ") || "-"}</td>
                  <td style={td}>{(user.departments || []).map((d) => d.name).join(", ") || "All / unassigned"}</td>
                  <td style={td}>{user.is_active ? "Active" : "Inactive"}</td>
                  <td style={td}>{user.last_login_at ? new Date(user.last_login_at).toLocaleString('en-IN') : "-"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Btn small variant="ghost" onClick={() => startEdit(user)}>Edit</Btn>
                      <Btn small variant="ghost" onClick={() => viewActivity(user)}>Activity Log</Btn>
                      <Btn small variant="ghost" onClick={() => resetPassword(user)}>Reset Password</Btn>
                      <Btn small variant={user.is_active ? "danger" : "success"} onClick={() => toggleActive(user)}>
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Activity Log Modal */}
      {activityUser && (
        <div style={modalOverlay} onClick={() => setActivityUser(null)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: COLORS.text }}>Activity Log: {activityUser.name}</h3>
              <button onClick={() => setActivityUser(null)} style={closeBtn}>&times;</button>
            </div>
            {loadingActivity ? <p style={{ color: COLORS.muted }}>Loading logs...</p> : (
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                {activityLogs.length === 0 ? <p style={{ color: COLORS.muted }}>No recent activity.</p> : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: COLORS.text }}>
                    <thead><tr style={{ background: COLORS.surface }}><th style={th}>Date</th><th style={th}>Action</th><th style={th}>Resource</th><th style={th}>Details</th></tr></thead>
                    <tbody>
                      {activityLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: `1px solid ${COLORS.border}55` }}>
                          <td style={td}>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                          <td style={td}><span style={{ color: COLORS.accent, fontWeight: 600 }}>{log.action}</span></td>
                          <td style={td}>{log.resource} {log.resource_id ? `#${log.resource_id}` : ""}</td>
                          <td style={td}>
                            {log.department_name && <span style={{ background: COLORS.border, padding: "2px 6px", borderRadius: 4, marginRight: 6 }}>{log.department_name}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Permissions Matrix Modal */}
      {showRoleMatrix && (
        <div style={modalOverlay} onClick={() => setShowRoleMatrix(false)}>
          <div style={{...modalContent, maxWidth: 800}} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: COLORS.text }}>Role Permissions Matrix</h3>
              <button onClick={() => setShowRoleMatrix(false)} style={closeBtn}>&times;</button>
            </div>
            <div style={{ maxHeight: 500, overflowY: "auto", marginBottom: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: COLORS.text }}>
                <thead>
                  <tr style={{ background: COLORS.surface }}>
                    <th style={{...th, minWidth: 200}}>Permission</th>
                    {roles.map(r => <th key={r.id} style={{...th, textAlign: "center"}}>{r.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {allPermissions.map(perm => (
                    <tr key={perm.id} style={{ borderBottom: `1px solid ${COLORS.border}55` }}>
                      <td style={{...td, fontWeight: 500}}>
                        {perm.label}
                        <div style={{fontSize: 10, color: COLORS.muted}}>{perm.key}</div>
                      </td>
                      {roles.map(r => {
                        const isChecked = matrixEdits[r.id]?.has(perm.id);
                        const disabled = r.key === 'admin';
                        return (
                          <td key={r.id} style={{...td, textAlign: "center"}}>
                            <input 
                              type="checkbox" 
                              checked={!!isChecked} 
                              disabled={disabled}
                              onChange={() => toggleMatrixPermission(r.id, perm.id)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setShowRoleMatrix(false)}>Cancel</Btn>
              <Btn onClick={saveMatrix} disabled={savingMatrix}>{savingMatrix ? "Saving..." : "Save Permissions"}</Btn>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

const label = { color: COLORS.muted, fontSize: 12, fontWeight: 700, margin: "12px 0 8px" };
const chipGrid = { display: "flex", flexWrap: "wrap", gap: 8 };
const chip = (active) => ({
  border: `1px solid ${active ? COLORS.brand || COLORS.accent : COLORS.border}`,
  background: active ? `${COLORS.brand || COLORS.accent}22` : COLORS.surface,
  color: active ? COLORS.brand || COLORS.accent : COLORS.text,
  borderRadius: 8,
  padding: "7px 10px",
  cursor: "pointer",
  fontSize: 12,
});
const th = { textAlign: "left", padding: "12px 14px", color: COLORS.muted, fontSize: 11, textTransform: "uppercase" };
const td = { padding: "12px 14px", verticalAlign: "top" };

// Modal Styles
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const modalContent = { background: COLORS.bg, borderRadius: 12, padding: 24, width: "100%", maxWidth: 600, border: `1px solid ${COLORS.border}`, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" };
const closeBtn = { background: "none", border: "none", color: COLORS.muted, fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 };
