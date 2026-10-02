import { useState, useEffect, useMemo } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import ErrorMsg from "../../components/ErrorMsg";
import ModalShell from "../../components/ui/ModalShell";
import Pill from "../../components/ui/Pill";
import { useAppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../styles/colors";
import {
  Search,
  Building2,
  ChefHat,
  Boxes,
  ArrowRight,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Plus,
  LayoutGrid,
} from "lucide-react";
import * as api from "../../api";

const empty = { name: "", code: "", chef_name: "" };

function StatCard({ label, value, caption, icon, color }) {
  return (
    <Card style={{ padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 11,
            color: COLORS.muted,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        {icon}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || COLORS.text, marginTop: 4 }}>
        {value}
      </div>
      <span style={{ fontSize: 11, color: COLORS.muted }}>{caption}</span>
    </Card>
  );
}

function DepartmentCardSkeleton() {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: RADIUS.md, background: COLORS.border }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: "60%", background: COLORS.border, borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 10, width: "40%", background: COLORS.border, borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ height: 10, width: "80%", background: COLORS.border, borderRadius: 4, marginTop: 16 }} />
    </Card>
  );
}

export default function DepartmentsScreen() {
  const { setCurrentScreen } = useAppContext();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null); // department object being edited
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  const canCreate = hasPermission("departments.create");
  const canEdit = hasPermission("departments.edit");
  const canDelete = hasPermission("departments.delete");
  const canManage = canCreate || canEdit || canDelete;

  const loadDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.departments.list();
      if (res.success) {
        setItems(res.data || []);
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

  const openCreate = () => {
    setForm(empty);
    setEditing(null);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (d) => {
    setForm({ name: d.name, code: d.code, chef_name: d.chef_name || "" });
    setEditing(d);
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(empty);
    setEditing(null);
    setFormError("");
  };

  const submit = async () => {
    if (!form.name.trim()) return setFormError("Department name is required.");
    if (!form.code.trim()) return setFormError("Department code is required.");

    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await api.departments.update(editing.id, form);
        flash("Department updated ✓");
      } else {
        await api.departments.create(form);
        flash("Department created ✓");
      }
      closeModal();
      loadDepartments();
    } catch (e) {
      setFormError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d) => {
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    try {
      await api.departments.remove(d.id);
      flash("Department deleted.");
      loadDepartments();
    } catch (e) {
      flash(e.message, COLORS.danger);
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

  const assignedChefsCount = useMemo(
    () => items.filter((d) => d.chef_name && d.chef_name.trim().length > 0).length,
    [items]
  );

  // itemsCount is wired from the real `/api/departments` response (enriched
  // server-side from indent_subcategories/indent_subcategory_items), not a
  // placeholder.
  const totalItems = useMemo(
    () => items.reduce((sum, d) => sum + (d.itemsCount || d.items_count || 0), 0),
    [items]
  );

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Section title="Departments" sub="Manage kitchen units, dining rooms, operational routing, and head chef scoping">
      {/* Summary stats — every figure below comes from the real /api/departments payload */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: SPACING.md,
          marginBottom: SPACING.xl,
        }}
      >
        <StatCard
          label="Configured Units"
          value={loading ? "—" : items.length}
          caption="Active operational cost centers"
          icon={<Building2 size={16} color={COLORS.accent} />}
        />
        <StatCard
          label="Catalog Items"
          value={loading ? "—" : totalItems}
          caption="Live items across all department templates"
          icon={<Boxes size={16} color="#3b82f6" />}
          color="#3b82f6"
        />
        <StatCard
          label="Kitchen Leads Assigned"
          value={loading ? "—" : `${assignedChefsCount} / ${items.length}`}
          caption="Designated Head Chefs / In-Charge"
          icon={<ChefHat size={16} color={COLORS.success} />}
          color={COLORS.success}
        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: SPACING.sm,
          marginBottom: SPACING.lg,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            padding: "7px 12px",
            width: 280,
            boxShadow: SHADOW.sm,
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
              fontSize: 13,
              width: "100%",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
          <span style={{ color: COLORS.muted, fontSize: 12 }}>
            {filteredItems.length} of {items.length} units
          </span>
          {canCreate && (
            <Btn icon={<Plus size={14} />} onClick={openCreate}>
              Add Department
            </Btn>
          )}
        </div>
      </div>

      {msg && (
        <p
          style={{
            color: msg.color,
            fontSize: 12,
            marginBottom: SPACING.md,
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          {msg.text}
        </p>
      )}

      {error ? (
        <Card style={{ borderColor: COLORS.danger }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <ErrorMsg error={error} />
            <Btn small variant="ghost" onClick={loadDepartments}>
              Retry
            </Btn>
          </div>
        </Card>
      ) : loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: SPACING.lg,
         }}
      >
          {Array.from({ length: 6 }).map((_, i) => (
            <DepartmentCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <LayoutGrid size={28} color={COLORS.muted} style={{ marginBottom: 10 }} />
          <p style={{ color: COLORS.muted, margin: 0 }}>
            {search ? "No departments match your filter." : "No departments configured yet."}
          </p>
          {!search && canCreate && (
            <Btn style={{ marginTop: 16 }} icon={<Plus size={14} />} onClick={openCreate}>
              Add the first department
            </Btn>
          )}
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: SPACING.lg,
          }}
        >
          {filteredItems.map((d) => (
            <Card key={d.id} variant="interactive" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: RADIUS.md,
                      background: d.bg || COLORS.brandLight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    {d.icon || "🍽️"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.name}
                    </div>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        background: COLORS.bg,
                        color: d.color || COLORS.accent,
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {d.code}
                    </span>
                  </div>
                </div>

                {(canEdit || canDelete) && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {canEdit && (
                      <button
                        type="button"
                        title="Edit department"
                        onClick={() => openEdit(d)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: COLORS.muted,
                          cursor: "pointer",
                          padding: 4,
                          borderRadius: 6,
                          display: "flex",
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        title="Delete department"
                        onClick={() => remove(d)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: COLORS.danger,
                          cursor: "pointer",
                          padding: 4,
                          borderRadius: 6,
                          display: "flex",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <p style={{ fontSize: 12, color: COLORS.muted, margin: 0, minHeight: 16 }}>{d.desc}</p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Pill variant="info">{d.itemsCount ?? d.items_count ?? 0} items</Pill>
                {d.chef_name ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: `${COLORS.success}22`,
                        border: `1px solid ${COLORS.success}`,
                        color: COLORS.success,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      {getInitials(d.chef_name)}
                    </div>
                    <span style={{ color: COLORS.text, fontSize: 11 }}>{d.chef_name}</span>
                  </div>
                ) : (
                  <span style={{ color: COLORS.muted, fontSize: 11, fontStyle: "italic" }}>Unassigned</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setCurrentScreen("indent")}
                  title="Go to Indent Requests"
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    background: `${COLORS.accent}15`,
                    border: `1px solid ${COLORS.accent}44`,
                    color: COLORS.accent,
                    padding: "5px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Indents <ArrowRight size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen("transfers")}
                  title="Go to Stock Transfers"
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    background: "rgba(59, 130, 246, 0.12)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    color: "#3b82f6",
                    padding: "5px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  <ArrowLeftRight size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen("production_planner")}
                  title="Go to Production Planner"
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: COLORS.success,
                    padding: "5px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Production <ArrowRight size={11} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && canManage && (
        <ModalShell title={editing ? `Edit ${editing.name}` : "Add New Department"} onClose={closeModal} size="compact">
          <Input label="Department Name *" value={form.name} onChange={f("name")} placeholder="e.g. Continental Kitchen" />
          <Input label="Code (Short identifier) *" value={form.code} onChange={f("code")} placeholder="e.g. CON" />
          <Input label="Head Chef / Manager" value={form.chef_name} onChange={f("chef_name")} placeholder="e.g. Chef Anthony" />

          {formError && <ErrorMsg error={formError} />}

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <Btn onClick={submit} loading={saving} style={{ flex: 1 }}>
              {editing ? "Save Changes" : "Add Department"}
            </Btn>
            <Btn variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Btn>
          </div>
        </ModalShell>
      )}
    </Section>
  );
}
