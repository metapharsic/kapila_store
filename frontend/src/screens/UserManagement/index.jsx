import { useEffect, useMemo, useState } from "react";
import * as api from "../../api";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import StoreLiveMonitorCard from "../../components/StoreLiveMonitorCard";
import MasterDataAgentStatusBar from "../../components/agents/MasterDataAgentStatusBar";
import Pill from "../../components/ui/Pill";
import AvatarRow from "../../components/ui/AvatarRow";
import { COLORS, RADIUS, SPACING } from "../../styles/colors";
import { useAuth } from "../../context/AuthContext";
import { Users, ShieldCheck, UserCheck, Building2, Search, Filter } from "lucide-react";

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
  const { refreshSession, hasPermission } = useAuth();
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

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // System Reset (Danger Zone)
  const [resetGroups, setResetGroups] = useState([]);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [selectedResetGroups, setSelectedResetGroups] = useState([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [confirmTextInput, setConfirmTextInput] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(null);

  const selectedRoleNames = useMemo(() => new Set(form.role_ids.map(Number)), [form.role_ids]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.employee_code && u.employee_code.toLowerCase().includes(q));

      const matchesRole =
        roleFilter === "all" ||
        (u.roles || []).some((r) => String(r.id) === String(roleFilter));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? u.is_active : !u.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const activeUsersCount = useMemo(() => {
    return users.filter((u) => u.is_active).length;
  }, [users]);

  const getRoleBadgeStyle = (roleName = "") => {
    const lower = roleName.toLowerCase();
    if (lower.includes("admin")) return { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.4)", text: "#ef4444" };
    if (lower.includes("manager")) return { bg: "rgba(232, 168, 56, 0.15)", border: "rgba(232, 168, 56, 0.4)", text: COLORS.accent };
    if (lower.includes("chef")) return { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.4)", text: "#3b82f6" };
    if (lower.includes("keeper") || lower.includes("store")) return { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)", text: COLORS.success };
    return { bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.4)", text: "#a78bfa" };
  };

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


  const canSystemReset = hasPermission("system.reset");

  const loadResetGroups = async () => {
    setResetLoading(true);
    setResetError("");
    try {
      const res = await api.systemReset.listGroups();
      setResetGroups(res.data || []);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    if (canSystemReset) {
      loadResetGroups().catch((err) => setResetError(err.message));
    }
  }, [canSystemReset]);

  const toggleResetGroup = (key) => {
    setSelectedResetGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const openResetConfirm = () => {
    setConfirmTextInput("");
    setResetError("");
    setShowResetConfirm(true);
  };

  const submitReset = async () => {
    if (confirmTextInput !== "RESET") return;
    setResetSubmitting(true);
    setResetError("");
    try {
      const groupsToReset = resetGroups.filter((g) => selectedResetGroups.includes(g.key));
      await api.systemReset.reset(selectedResetGroups, confirmTextInput);
      setShowResetConfirm(false);
      setSelectedResetGroups([]);
      setResetSuccess(groupsToReset);
      await loadResetGroups();
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <Section title="User Management" sub="Create users, assign roles and departments, and manage account status">
      {/* Multi-Agent Governance Bar */}
      <MasterDataAgentStatusBar entityType="users" />

      {/* RBAC & Identity Health KPIs */}
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
              Total Accounts
            </span>
            <Users size={16} color={COLORS.accent} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>
            {users.length}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Registered operational staff</span>
        </Card>

        <Card style={{ padding: "14px 18px", border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Active Operators
            </span>
            <UserCheck size={16} color={COLORS.success} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.success, marginTop: 4 }}>
            {activeUsersCount} / {users.length}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Active login & shift access</span>
        </Card>

        <Card style={{ padding: "14px 18px", border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Security Roles
            </span>
            <ShieldCheck size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6", marginTop: 4 }}>
            {roles.length}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>RBAC privilege tiers configured</span>
        </Card>

        <Card style={{ padding: "14px 18px", border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Scoped Departments
            </span>
            <Building2 size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#8b5cf6", marginTop: 4 }}>
            {departments.length}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Data isolation units</span>
        </Card>
      </div>

      {error && (
        <div style={{ color: COLORS.danger, marginBottom: SPACING.md, fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xxl }}>
        <StoreLiveMonitorCard />

        {/* Primary workflow: create/edit user + user list, side by side */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 360px) 1fr",
            gap: SPACING.xl,
            alignItems: "start",
          }}
        >
          <Card>
            <h3 style={{ marginTop: 0, marginBottom: SPACING.lg, color: COLORS.text }}>
              {editing ? "Edit User" : "Create User"}
            </h3>

            {/* Identity fields */}
            <div style={sectionLabel}>Identity</div>
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {!editing && (
              <Input label="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            )}
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            {!editing && (
              <Input
                label="Employee Code"
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              />
            )}
            {!editing && (
              <Input
                label="Temporary Password *"
                value={form.temporary_password}
                onChange={(e) => setForm({ ...form, temporary_password: e.target.value })}
              />
            )}

            {/* Access fields */}
            <div style={{ ...sectionLabel, marginTop: SPACING.lg }}>Access</div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={label}>Roles</div>
              <button onClick={openRoleMatrix} style={linkBtn}>View Permissions Matrix</button>
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
                <button
                  key={dept.id}
                  onClick={() => toggleArray("department_ids", dept.id)}
                  style={chip(form.department_ids.map(Number).includes(dept.id))}
                >
                  {dept.name}
                </button>
              ))}
            </div>

            <label style={{ display: "flex", gap: SPACING.sm, alignItems: "center", margin: `${SPACING.lg}px 0`, color: COLORS.text, fontSize: 13 }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active user
            </label>

            <div style={{ display: "flex", gap: SPACING.sm }}>
              <Btn onClick={submit} style={{ flex: 1 }}>{editing ? "Save Changes" : "Create User"}</Btn>
              {editing && <Btn variant="ghost" onClick={reset}>Cancel</Btn>}
            </div>
          </Card>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            {/* Search and Filters Toolbar */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${COLORS.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                background: COLORS.surface,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  User Directory
                </span>
                <span style={{ color: COLORS.accent, fontSize: 11, background: `${COLORS.accent}15`, padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>
                  {filteredUsers.length} of {users.length}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/* Search Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    padding: "4px 8px",
                    width: 170,
                  }}
                >
                  <Search size={13} color={COLORS.muted} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users…"
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

                {/* Role filter dropdown */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: RADIUS.sm,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {/* Status filter dropdown */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: RADIUS.sm,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            <div className="resp-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", color: COLORS.text, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}` }}>
                    {["User", "Role", "Department", "Status", "Last Login", "Actions"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>
                        No users match the search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        style={{ borderTop: `1px solid ${COLORS.border}22` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surface; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={td}>
                          <AvatarRow name={user.name} label={user.email} />
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {(user.roles || []).length > 0 ? (
                              user.roles.map((r) => {
                                const badge = getRoleBadgeStyle(r.name);
                                return (
                                  <span
                                    key={r.id}
                                    style={{
                                      background: badge.bg,
                                      border: `1px solid ${badge.border}`,
                                      color: badge.text,
                                      padding: "2px 7px",
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {r.name}
                                  </span>
                                );
                              })
                            ) : (
                              <span style={{ color: COLORS.muted, fontStyle: "italic", fontSize: 11 }}>—</span>
                            )}
                          </div>
                        </td>
                        <td style={td}>{(user.departments || []).map((d) => d.name).join(", ") || "All / unassigned"}</td>
                        <td style={td}>
                          <Pill variant={user.is_active ? "success" : "neutral"}>
                            {user.is_active ? "Active" : "Inactive"}
                          </Pill>
                        </td>
                        <td style={td}>{user.last_login_at ? new Date(user.last_login_at).toLocaleString('en-IN') : "-"}</td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: SPACING.xs, flexWrap: "wrap" }}>
                            <Btn small variant="ghost" onClick={() => startEdit(user)}>Edit</Btn>
                            <Btn small variant="ghost" onClick={() => viewActivity(user)}>Activity Log</Btn>
                            <Btn small variant="ghost" onClick={() => resetPassword(user)}>Reset Password</Btn>
                            <Btn small variant={user.is_active ? "danger" : "success"} onClick={() => toggleActive(user)}>
                              {user.is_active ? "Deactivate" : "Activate"}
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Danger Zone — pushed to the bottom, visually separated from routine management */}
        {canSystemReset && (
          <Card style={{ border: `2px solid ${COLORS.danger}`, background: `${COLORS.danger}0d` }}>
            <h3 style={{ marginTop: 0, marginBottom: SPACING.xs, color: COLORS.danger, display: "flex", alignItems: "center", gap: SPACING.sm }}>
              <span aria-hidden>&#9888;</span> Danger Zone — System Reset
            </h3>
            <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 0, marginBottom: SPACING.lg }}>
              Permanently wipes the selected data groups from the system. This action cannot be undone. Only visible to admins with the "system.reset" permission.
            </p>

            {resetError && <div style={{ color: COLORS.danger, marginBottom: SPACING.md, fontSize: 13 }}>{resetError}</div>}

            {resetSuccess && (
              <div style={{ background: `${COLORS.success}22`, border: `1px solid ${COLORS.success}`, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.lg }}>
                <div style={{ fontWeight: 700, color: COLORS.success, marginBottom: SPACING.xs }}>Reset completed successfully</div>
                <div style={{ fontSize: 12, color: COLORS.text, marginBottom: SPACING.sm }}>
                  The following data groups were wiped: {resetSuccess.map((g) => g.label).join(", ")}
                </div>
                <Btn small variant="success" onClick={() => window.location.reload()}>Reload Page</Btn>
              </div>
            )}

            {resetLoading ? (
              <p style={{ color: COLORS.muted }}>Loading resettable data groups...</p>
            ) : (
              <div style={{ display: "grid", gap: SPACING.md }}>
                {resetGroups.map((group) => (
                  <label
                    key={group.key}
                    style={{
                      display: "flex",
                      gap: SPACING.md,
                      alignItems: "center",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.md,
                      padding: SPACING.lg,
                      cursor: "pointer",
                      background: COLORS.surface,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedResetGroups.includes(group.key)}
                      onChange={() => toggleResetGroup(group.key)}
                      style={{ flexShrink: 0, width: 18, height: 18, padding: 0, background: "auto" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: COLORS.text }}>{group.label}</span>
                        <Pill variant="danger">
                          {group.totalRows} row{group.totalRows === 1 ? "" : "s"}
                        </Pill>
                      </div>
                      <div style={{ color: COLORS.muted, fontSize: 12, margin: `${SPACING.xs}px 0` }}>{group.description}</div>
                      <div style={{ color: COLORS.muted, fontSize: 11 }}>
                        Tables: {(group.tables || []).map((t) => (typeof t === "string" ? t : t.table)).join(", ")}
                      </div>
                    </div>
                  </label>
                ))}
                {resetGroups.length === 0 && <p style={{ color: COLORS.muted, fontSize: 12 }}>No resettable data groups found.</p>}
              </div>
            )}

            <div style={{ marginTop: SPACING.lg }}>
              <Btn
                variant="danger"
                disabled={selectedResetGroups.length === 0}
                onClick={openResetConfirm}
              >
                Reset Selected
              </Btn>
            </div>
          </Card>
        )}
      </div>

      {/* Activity Log Modal */}
      {activityUser && (
        <div style={modalOverlay} onClick={() => setActivityUser(null)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xl }}>
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
                            {log.department_name && (
                              <Pill variant="neutral" style={{ borderRadius: RADIUS.sm }}>{log.department_name}</Pill>
                            )}
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
          <div style={{ ...modalContent, maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xl }}>
              <h3 style={{ margin: 0, color: COLORS.text }}>Role Permissions Matrix</h3>
              <button onClick={() => setShowRoleMatrix(false)} style={closeBtn}>&times;</button>
            </div>
            <div style={{ maxHeight: 500, overflowY: "auto", marginBottom: SPACING.xl }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: COLORS.text }}>
                <thead>
                  <tr style={{ background: COLORS.surface }}>
                    <th style={{ ...th, minWidth: 200 }}>Permission</th>
                    {roles.map(r => <th key={r.id} style={{ ...th, textAlign: "center" }}>{r.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {allPermissions.map(perm => (
                    <tr key={perm.id} style={{ borderBottom: `1px solid ${COLORS.border}55` }}>
                      <td style={{ ...td, fontWeight: 500 }}>
                        {perm.label}
                        <div style={{ fontSize: 10, color: COLORS.muted }}>{perm.key}</div>
                      </td>
                      {roles.map(r => {
                        const isChecked = matrixEdits[r.id]?.has(perm.id);
                        const disabled = r.key === 'admin';
                        return (
                          <td key={r.id} style={{ ...td, textAlign: "center" }}>
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
            <div style={{ display: "flex", justifyContent: "flex-end", gap: SPACING.sm }}>
              <Btn variant="ghost" onClick={() => setShowRoleMatrix(false)}>Cancel</Btn>
              <Btn onClick={saveMatrix} disabled={savingMatrix}>{savingMatrix ? "Saving..." : "Save Permissions"}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* System Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={modalOverlay} onClick={() => !resetSubmitting && setShowResetConfirm(false)}>
          <div style={{ ...modalContent, border: `2px solid ${COLORS.danger}` }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
              <h3 style={{ margin: 0, color: COLORS.danger }}>Confirm System Reset</h3>
              <button onClick={() => setShowResetConfirm(false)} style={closeBtn}>&times;</button>
            </div>

            <p style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>
              You are about to PERMANENTLY DELETE all data in the following groups:
            </p>
            <ul style={{ color: COLORS.text, fontSize: 13, paddingLeft: SPACING.xl }}>
              {resetGroups.filter((g) => selectedResetGroups.includes(g.key)).map((g) => (
                <li key={g.key} style={{ marginBottom: SPACING.sm }}>
                  <strong>{g.label}</strong> ({g.totalRows} rows)
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>Tables: {(g.tables || []).map((t) => (typeof t === "string" ? t : t.table)).join(", ")}</div>
                </li>
              ))}
            </ul>
            <p style={{ color: COLORS.danger, fontSize: 12, fontWeight: 600 }}>
              This action cannot be undone. Type RESET below to confirm.
            </p>
            <Input
              label='Type "RESET" to confirm'
              value={confirmTextInput}
              onChange={(e) => setConfirmTextInput(e.target.value)}
            />
            {resetError && <div style={{ color: COLORS.danger, fontSize: 12, marginTop: SPACING.sm }}>{resetError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Btn variant="ghost" onClick={() => setShowResetConfirm(false)} disabled={resetSubmitting}>Cancel</Btn>
              <Btn
                variant="danger"
                onClick={submitReset}
                disabled={confirmTextInput !== "RESET" || resetSubmitting}
              >
                {resetSubmitting ? "Resetting..." : "Confirm Reset"}
              </Btn>
            </div>
          </div>
        </div>
      )}

    </Section>
  );
}

const sectionLabel = {
  color: COLORS.muted,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: SPACING.sm,
};
const label = { color: COLORS.muted, fontSize: 12, fontWeight: 700, margin: `${SPACING.md}px 0 ${SPACING.sm}px` };
const linkBtn = { background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 11, fontWeight: 600 };
const chipGrid = { display: "flex", flexWrap: "wrap", gap: SPACING.sm };
const chip = (active) => ({
  border: `1px solid ${active ? COLORS.brand || COLORS.accent : COLORS.border}`,
  background: active ? `${COLORS.brand || COLORS.accent}22` : COLORS.surface,
  color: active ? COLORS.brand || COLORS.accent : COLORS.text,
  borderRadius: RADIUS.sm,
  padding: "7px 10px",
  cursor: "pointer",
  fontSize: 12,
});
const th = { textAlign: "left", padding: `${SPACING.md}px ${SPACING.lg}px`, color: COLORS.muted, fontSize: 11, textTransform: "uppercase" };
const td = { padding: `${SPACING.md}px ${SPACING.lg}px`, verticalAlign: "middle" };

// Modal Styles
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: SPACING.xl };
const modalContent = { background: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.xxl, width: "100%", maxWidth: 600, border: `1px solid ${COLORS.border}`, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" };
const closeBtn = { background: "none", border: "none", color: COLORS.muted, fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 };
