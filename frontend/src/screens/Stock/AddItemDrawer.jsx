import { useState } from "react";
import { COLORS, UNITS, STOCK_CATEGORIES } from "../../styles/colors";
import { PackagePlus, X } from "lucide-react";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import * as api from "../../api";
import { today } from "../../utils/dates";

const emptyForm = {
  name: "", qty: "", unit: UNITS[0], category: STOCK_CATEGORIES[0], price: "", supplier: "",
  expiry_date: "", min_alert_qty: "", date: today(),
};

export default function AddItemDrawer({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const valid = form.name.trim() && parseFloat(form.qty) > 0 && form.unit && parseFloat(form.price) >= 0;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setErr("");
    try {
      await api.stock.create({
        name: form.name.trim(),
        qty: parseFloat(form.qty),
        unit: form.unit,
        date: form.date,
        price: parseFloat(form.price) || 0,
        category: form.category || null,
        supplier: form.supplier.trim() || null,
        expiry_date: form.expiry_date || null,
        min_alert_qty: form.min_alert_qty.trim() === "" ? null : parseFloat(form.min_alert_qty),
      });
      setForm(emptyForm);
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.45)", zIndex: 1000,
      display: "flex", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div
        style={{
          width: 420, maxWidth: "92%", height: "100%", background: COLORS.surface,
          borderLeft: `1px solid ${COLORS.border}`, boxShadow: "-8px 0 32px rgba(15,23,42,0.18)",
          display: "flex", flexDirection: "column", padding: 24, overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
            <PackagePlus size={18} /> Add New Item
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 18 }}>
          New item not in stock yet. Item code auto-assigned.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Item Name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Atukulu" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Opening Qty" type="number" step="0.01" value={form.qty} onChange={(e) => set("qty", e.target.value)} placeholder="0.00" />
            <div>
              <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Unit</label>
              <select
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6 }}
              >
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <Input label="Price per Unit (₹)" type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />

          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Category</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              style={{ width: "100%", padding: "8px 12px", fontSize: 13, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6 }}
            >
              {STOCK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <Input label="Supplier" value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Optional" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Purchase Date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
          </div>

          <Input label="Min Alert Qty" type="number" step="0.01" value={form.min_alert_qty} onChange={(e) => set("min_alert_qty", e.target.value)} placeholder="Optional reorder threshold" />
        </div>

        {err && <p style={{ color: COLORS.coral, fontSize: 12, marginTop: 14 }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <Btn onClick={save} disabled={!valid || saving} style={{ flex: 1 }}>
            {saving ? "Saving…" : "Add Item"}
          </Btn>
          <Btn variant="ghost" onClick={onClose} style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}>
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  );
}
