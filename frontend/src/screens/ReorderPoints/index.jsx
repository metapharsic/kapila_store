import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import { usePaginatedApi } from "../../hooks/useApi";
import { useAppContext } from "../../context/AppContext";
import * as api from "../../api";

const LIMIT = 30;
const empty = { item_code: "", name: "", min_qty: "", reorder_qty: "", lead_time_days: "3", preferred_supplier_id: "", notes: "" };

export default function ReorderPointsScreen() {
  const { stocks }       = useAppContext();
  const [form, setForm]  = useState(empty);
  const [editing, setEditing] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [alerts, setAlerts]   = useState([]);
  const [msg, setMsg]    = useState("");

  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.reorderPoints.list);
  const load = (overrides = {}) => fetch({ limit: LIMIT, sort: "name", order: "asc", ...overrides });

  useEffect(() => { load(); loadAlerts(); }, []);

  useEffect(() => {
    api.suppliers.list({ limit: 200, sort: "name", order: "asc" })
      .then((r) => setSuppliers(r.data || [])).catch(() => {});
  }, []);

  const loadAlerts = () =>
    api.reorderPoints.alerts().then((r) => setAlerts(r.data || [])).catch(() => {});

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 2500);
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // Auto-fill name when item_code typed
  const handleItemCode = (e) => {
    const val = e.target.value;
    setForm((p) => {
      const match = stocks.find((s) => s.item_code === val);
      return { ...p, item_code: val, name: match ? match.name : p.name };
    });
  };

  const handleName = (e) => {
    const val = e.target.value;
    setForm((p) => {
      const match = stocks.find((s) => s.name.toLowerCase() === val.toLowerCase());
      return { ...p, name: val, item_code: match ? match.item_code : p.item_code };
    });
  };

  const submit = async () => {
    if (!form.item_code || !form.min_qty || !form.reorder_qty)
      return flash("Item code, min qty, and reorder qty are required.", COLORS.coral);
    try {
      const payload = {
        item_code: form.item_code.trim(),
        name: form.name || form.item_code,
        min_qty: parseFloat(form.min_qty),
        reorder_qty: parseFloat(form.reorder_qty),
        lead_time_days: parseInt(form.lead_time_days) || 3,
        preferred_supplier_id: form.preferred_supplier_id ? parseInt(form.preferred_supplier_id) : null,
        notes: form.notes || null,
      };
      if (editing) {
        await api.reorderPoints.update(editing, payload);
        flash("Reorder point updated ✓");
      } else {
        await api.reorderPoints.create(payload);
        flash("Reorder point added ✓");
      }
      setForm(empty);
      setEditing(null);
      load({ page: 1 });
      loadAlerts();
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const startEdit = (r) => {
    setForm({
      item_code: r.item_code, name: r.name, min_qty: String(r.min_qty), reorder_qty: String(r.reorder_qty),
      lead_time_days: String(r.lead_time_days), preferred_supplier_id: r.preferred_supplier_id ? String(r.preferred_supplier_id) : "",
      notes: r.notes || "",
    });
    setEditing(r.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleActive = async (r) => {
    try {
      await api.reorderPoints.update(r.id, { is_active: !r.is_active });
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this reorder point?")) return;
    try {
      await api.reorderPoints.remove(id);
      flash("Deleted.");
      load({ page: 1 });
      loadAlerts();
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const autoDraftPO = async (r) => {
    if (!r.preferred_supplier_id) return flash("No preferred supplier set for this item.", COLORS.coral);
    try {
      await api.purchaseOrders.autoDraft(r.preferred_supplier_id);
      flash("Auto-draft PO created for low stock items ✓");
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  return (
    <Section title="Reorder Points" sub="Set minimum stock thresholds — get alerts before you run out">

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div style={{ background: COLORS.coral + "18", border: `1px solid ${COLORS.coral}44`, borderRadius: 10, padding: "14px 20px", marginBottom: 20 }}>
          <p style={{ color: COLORS.coral, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            ⚠ {alerts.length} item{alerts.length > 1 ? "s" : ""} below reorder threshold
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {alerts.map((a) => (
              <span key={a.id} style={{ background: COLORS.coral + "22", color: COLORS.coral, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>
                {a.name} — {a.current_stock.toFixed(1)} / {a.min_qty} {a.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>

        {/* Form */}
        <Card>
          <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {editing ? "Edit Reorder Point" : "Add Reorder Point"}
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Item Name</label>
            <input list="stock-names-ro" value={form.name} onChange={handleName} placeholder="Select or type item"
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "8px 12px", width: "100%", fontSize: 13 }} />
            <datalist id="stock-names-ro">
              {stocks.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Item Code</label>
            <input value={form.item_code} onChange={handleItemCode} placeholder="KPL-###"
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.teal, borderRadius: 6, padding: "8px 12px", width: "100%", fontSize: 13, fontFamily: "monospace" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Min Qty *" type="number" min="0" step="any" value={form.min_qty} onChange={f("min_qty")} placeholder="e.g. 5" />
            <Input label="Reorder Qty *" type="number" min="0.01" step="any" value={form.reorder_qty} onChange={f("reorder_qty")} placeholder="e.g. 20" />
          </div>
          <Input label="Lead Time (days)" type="number" min="1" value={form.lead_time_days} onChange={f("lead_time_days")} placeholder="3" />

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Preferred Supplier</label>
            <select value={form.preferred_supplier_id} onChange={f("preferred_supplier_id")}
              style={{ width: "100%", padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 13 }}>
              <option value="">— None —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <Input label="Notes" value={form.notes} onChange={f("notes")} placeholder="Storage location, notes…" />

          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={submit} style={{ flex: 1 }}>{editing ? "Save" : "Add Reorder Point"}</Btn>
            {editing && <Btn variant="ghost" onClick={() => { setForm(empty); setEditing(null); }}>Cancel</Btn>}
          </div>
          {msg && <p style={{ color: msg.color, fontSize: 12, marginTop: 8, textAlign: "center" }}>{msg.text}</p>}
        </Card>

        {/* List */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 10, alignItems: "center" }}>
            <SearchBar onSearch={(v) => load({ page: 1, q: v })} placeholder="Search item…" />
            <span style={{ color: COLORS.muted, fontSize: 12, whiteSpace: "nowrap" }}>{total} rules</span>
          </div>

          {loading ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading…</p>
          ) : error ? (
            <ErrorMsg error={error} />
          ) : items.length === 0 ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>No reorder points set. Add your first rule.</p>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    {["Item", "Code", "Min Qty", "Reorder Qty", "Current Stock", "Lead (days)", "Supplier", "Status", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const needsReorder = r.needs_reorder;
                    return (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${COLORS.border}22`, opacity: r.is_active ? 1 : 0.45 }}
                        onMouseEnter={(e) => e.currentTarget.style.background = COLORS.surface}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: COLORS.text }}>{r.name}</td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", color: COLORS.teal, fontSize: 12 }}>{r.item_code}</td>
                        <td style={{ padding: "10px 14px", color: COLORS.muted }}>{r.min_qty}</td>
                        <td style={{ padding: "10px 14px", color: COLORS.accent, fontWeight: 600 }}>{r.reorder_qty}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: needsReorder ? COLORS.coral : COLORS.success }}>
                          {r.current_stock !== null ? r.current_stock.toFixed(1) : "—"}
                          {needsReorder && <span style={{ fontSize: 10, marginLeft: 4 }}>⚠</span>}
                        </td>
                        <td style={{ padding: "10px 14px", color: COLORS.muted }}>{r.lead_time_days}d</td>
                        <td style={{ padding: "10px 14px", color: COLORS.muted, fontSize: 12 }}>{r.supplier_name || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ background: r.is_active ? COLORS.success + "22" : COLORS.muted + "22", color: r.is_active ? COLORS.success : COLORS.muted, padding: "2px 8px", borderRadius: 20, fontSize: 11 }}>
                            {r.is_active ? "Active" : "Off"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 5 }}>
                            {needsReorder && r.preferred_supplier_id && (
                              <Btn small variant="success" onClick={() => autoDraftPO(r)}>Draft PO</Btn>
                            )}
                            <Btn small variant="ghost" onClick={() => startEdit(r)}>Edit</Btn>
                            <Btn small variant="ghost" onClick={() => toggleActive(r)} style={{ fontSize: 11 }}>
                              {r.is_active ? "Disable" : "Enable"}
                            </Btn>
                            <Btn small variant="danger" onClick={() => remove(r.id)}>✕</Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
            </>
          )}
        </Card>
      </div>
    </Section>
  );
}
