import { useState, useEffect } from "react";
import { COLORS, UNITS, STOCK_CATEGORIES } from "../../styles/colors";
import { Edit3, X, PlusCircle, Trash2, PenSquare } from "lucide-react";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import * as api from "../../api";

const MODES = [
  { id: "modify", label: "Modify", icon: <PenSquare size={13} /> },
  { id: "append", label: "Append Stock", icon: <PlusCircle size={13} /> },
  { id: "delete", label: "Delete", icon: <Trash2 size={13} /> },
];

export default function EditItemDrawer({ item, onClose, onSaved }) {
  const [mode, setMode] = useState("modify");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [minAlert, setMinAlert] = useState("");
  const [appendQty, setAppendQty] = useState("");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!item) return;
    setMode("modify");
    setName(item.name || "");
    setUnit(item.unit || "kg");
    setCategory(item.category || STOCK_CATEGORIES[0]);
    setPrice(item.price != null ? String(item.price) : "");
    setMinAlert(item.min_alert_qty != null ? String(item.min_alert_qty) : "");
    setAppendQty("");
    setJustification("");
    setErr("");
  }, [item]);

  if (!item) return null;

  const valid = mode === "delete"
    ? justification.trim().length > 0
    : mode === "append"
      ? parseFloat(appendQty) > 0 && justification.trim().length > 0
      : name.trim() && unit && parseFloat(price) >= 0 && justification.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setErr("");
    try {
      if (mode === "delete") {
        await api.stock.remove(item.id, justification.trim());
      } else if (mode === "append") {
        const newRemaining = (parseFloat(item.remaining) || 0) + parseFloat(appendQty);
        await api.stock.update(item.id, {
          remaining: newRemaining,
          reason: "Stock Appended",
          notes: justification.trim(),
        });
      } else {
        await api.stock.update(item.id, {
          name: name.trim(),
          unit,
          category: category || null,
          price: parseFloat(price) || 0,
          min_alert_qty: minAlert.trim() === "" ? null : parseFloat(minAlert),
          reason: "Item Modified",
          notes: justification.trim(),
        });
      }
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
      background: "rgba(15, 23, 42, 0.65)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div
        style={{
          width: 440, maxWidth: "90%", maxHeight: "88vh", background: COLORS.surface,
          border: `1px solid ${COLORS.border}`, borderRadius: 12,
          boxShadow: "0 8px 32px rgba(15,23,42,0.15)",
          display: "flex", flexDirection: "column", padding: 24, overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
            <Edit3 size={18} /> Edit Item
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 18 }}>
          <span style={{ color: COLORS.purple, fontWeight: "bold" }}>{item.item_code}</span> · {item.name} · current: {parseFloat(item.remaining).toFixed(2)} {item.unit}
        </p>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                padding: "8px 6px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                border: `1px solid ${mode === m.id ? COLORS.brand : COLORS.border}`,
                background: mode === m.id ? COLORS.brand + "15" : "transparent",
                color: mode === m.id ? COLORS.brand : (m.id === "delete" ? COLORS.coral : COLORS.muted),
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {mode === "modify" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Item Name" value={name} onChange={(e) => setName(e.target.value)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Unit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6 }}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <Input label="Price per Unit (₹)" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6 }}>
                {STOCK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <Input label="Min Alert Qty" type="number" step="0.01" value={minAlert} onChange={(e) => setMinAlert(e.target.value)} placeholder="Optional reorder threshold" />
          </div>
        )}

        {mode === "append" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label={`Qty to Append (${item.unit})`} type="number" step="0.01" value={appendQty} onChange={(e) => setAppendQty(e.target.value)} placeholder="e.g. new delivery qty" />
            {parseFloat(appendQty) > 0 && (
              <div style={{ background: COLORS.teal + "11", border: `1px dashed ${COLORS.teal}44`, borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
                New total: <b>{((parseFloat(item.remaining) || 0) + parseFloat(appendQty)).toFixed(2)} {item.unit}</b>
              </div>
            )}
          </div>
        )}

        {mode === "delete" && (
          <div style={{ background: COLORS.coral + "11", border: `1px dashed ${COLORS.coral}44`, borderRadius: 6, padding: "10px 12px", fontSize: 12, color: COLORS.coral }}>
            This removes <b>{item.name}</b> ({item.item_code}) permanently. Cannot be undone.
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>
            Justification {mode === "delete" ? "(required — why delete)" : "(required — why this change)"}
          </label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="e.g. Correcting OCR price error, physical recount, duplicate entry..."
            rows={3}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 12,
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.text, borderRadius: 6, resize: "vertical",
            }}
          />
        </div>

        {err && <p style={{ color: COLORS.coral, fontSize: 12, marginTop: 12 }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Btn
            onClick={save}
            disabled={!valid || saving}
            variant={mode === "delete" ? "danger" : "primary"}
            style={{ flex: 1 }}
          >
            {saving ? "Saving…" : mode === "delete" ? "Confirm Delete" : mode === "append" ? "Append Stock" : "Save Changes"}
          </Btn>
          <Btn variant="ghost" onClick={onClose} style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}>
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  );
}
