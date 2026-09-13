import { useState, useEffect } from "react";
import { COLORS, UNITS, STOCK_CATEGORIES } from "../../styles/colors";
import { Edit3, X, PlusCircle, Trash2, PenSquare, AlertCircle } from "lucide-react";
import Input from "../../components/Input";
import * as api from "../../api";
import UnitDimensionBadge from "../../components/UnitDimensionBadge";
import { getDimensionConfig, getUnitDimension } from "../../utils/units";

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
  const [packSize, setPackSize] = useState("");
  const [minAlert, setMinAlert] = useState("");
  const [rackLocation, setRackLocation] = useState("");
  const [storageZone, setStorageZone] = useState("");
  const [supplier, setSupplier] = useState("");
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
    setPackSize(item.pack_size != null ? String(item.pack_size) : "1");
    setMinAlert(item.min_alert_qty != null ? String(item.min_alert_qty) : "");
    setRackLocation(item.rack_location || "");
    setStorageZone(item.storage_zone || "");
    setSupplier(item.supplier || "");
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
          pack_size: packSize ? parseFloat(packSize) : 1,
          min_alert_qty: minAlert.trim() === "" ? null : parseFloat(minAlert),
          rack_location: rackLocation.trim() || null,
          storage_zone: storageZone.trim() || null,
          supplier: supplier.trim() || null,
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
      background: "rgba(0, 0, 0, 0.8)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(6px)",
      padding: "20px",
      animation: "drawerBackdropFade 0.25s ease-out"
    }} onClick={onClose}>
      <style>
        {`
          @keyframes drawerBackdropFade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalPopUp {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}
      </style>
      <div
        style={{
          width: "100%", maxWidth: 850, maxHeight: "90vh", background: "var(--bg-modal)",
          border: "1px solid var(--color-gold-glow)", borderRadius: 14,
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
          display: "flex", flexDirection: "column", overflowY: "auto",
          animation: "modalPopUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-color)",
          background: "linear-gradient(135deg, var(--bg-page), rgba(15,23,42,0.95))",
          position: "sticky", top: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Serif Display', Georgia, serif" }}>
              <Edit3 size={22} style={{ color: "var(--color-gold)" }} /> Maintain Item Record: {item.name}
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--color-gold)" }}>{item.item_code}</strong> · Current Balance: <strong style={{ color: "#10b981" }}>{parseFloat(item.remaining).toFixed(2)} {item.unit}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: "var(--border-color)", border: "1px solid var(--border-color)", borderRadius: 6, padding: 6, cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Mode Tabs */}
          <div style={{ display: "flex", gap: 8, padding: 4, background: "var(--bg-page)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 12px", fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${mode === m.id ? (m.id === "delete" ? "#ef4444" : "var(--color-gold)") : "transparent"}`,
                  background: mode === m.id ? (m.id === "delete" ? "rgba(239,68,68,0.15)" : "var(--color-gold-dim)") : "transparent",
                  color: mode === m.id ? (m.id === "delete" ? "#ef4444" : "var(--color-gold)") : "var(--text-muted)",
                  transition: "all 0.2s"
                }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {mode === "modify" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gold)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Item Identity</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Input label="Item Name" value={name} onChange={(e) => setName(e.target.value)} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500 }}>Base Unit</label>
                          <UnitDimensionBadge unit={unit} />
                        </div>
                        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: "var(--bg-page)", border: "1px solid var(--border-color)", color: "var(--text-main)", borderRadius: 6 }}>
                          {UNITS.map((u) => <option key={u}>{u}</option>)}
                        </select>
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>Used for recipe scaling.</span>
                          <span style={{ color: getDimensionConfig(unit).color, fontWeight: 600 }}>
                            {getDimensionConfig(unit).description}
                          </span>
                        </div>
                        {item?.unit && unit && getUnitDimension(item.unit) !== getUnitDimension(unit) && (
                          <div style={{
                            fontSize: 10.5,
                            color: "#f87171",
                            background: "rgba(239, 68, 68, 0.12)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            marginTop: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                          }}>
                            <AlertCircle size={12} style={{ flexShrink: 0 }} />
                            <span>Dimension mismatch: {getDimensionConfig(item.unit).label} → {getDimensionConfig(unit).label} breaks history!</span>
                          </div>
                        )}
                        <div style={{ fontSize: 10.5, color: "#ef4444", marginTop: 4 }}>Warning: Changing unit breaks historical reports.</div>
                      </div>
                      <Input label="Unit Price (₹)" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4, fontWeight: 500 }}>Category</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: "var(--bg-page)", border: "1px solid var(--border-color)", color: "var(--text-main)", borderRadius: 6 }}>
                          {STOCK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <Input
                        label="Pack Size (Qty per Unit)"
                        type="number"
                        min="0"
                        step="0.1"
                        value={packSize}
                        onChange={(e) => setPackSize(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-info)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Location & Controls</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Input label="Storage Zone" value={storageZone} onChange={(e) => setStorageZone(e.target.value)} placeholder="e.g. General Store" />
                    <Input label="Rack Loading Position" value={rackLocation} onChange={(e) => setRackLocation(e.target.value)} placeholder="e.g. Rack A-01 / Shelf 2" />
                    <Input label="Primary Vendor" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier Name" />
                    <div>
                      <Input label="Minimum Alert Qty" type="number" step="0.01" value={minAlert} onChange={(e) => setMinAlert(e.target.value)} placeholder="Low stock threshold" />
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>Triggers automated purchasing alerts.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === "append" && (
            <div style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>Append Stock (Quick Add)</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Use this to quickly inward new deliveries without filling a full stock GRN form.</p>
              <Input label={`Quantity to Add (${item.unit})`} type="number" step="0.01" value={appendQty} onChange={(e) => setAppendQty(e.target.value)} placeholder="Enter numeric quantity" autoFocus />
              {parseFloat(appendQty) > 0 && (
                <div style={{ background: "rgba(16,185,129,0.15)", border: "1px dashed rgba(16,185,129,0.4)", borderRadius: 8, padding: "12px", fontSize: 14, color: "#34d399", display: "flex", alignItems: "center", gap: 8 }}>
                  <PlusCircle size={18} /> New Ledger Balance: <strong>{((parseFloat(item.remaining) || 0) + parseFloat(appendQty)).toFixed(2)} {item.unit}</strong>
                </div>
              )}
            </div>
          )}

          {mode === "delete" && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px dashed rgba(239, 68, 68, 0.4)", borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center" }}>
              <Trash2 size={32} style={{ color: "#ef4444", marginBottom: 8 }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>DANGER: Irreversible Deletion</div>
              <p style={{ fontSize: 13, color: "var(--text-main)", margin: 0, maxWidth: 400 }}>
                This will permanently delete the ledger for <strong>{item.name}</strong> ({item.item_code}). It will vanish from all recipes and future reports. This cannot be undone.
              </p>
            </div>
          )}

          {/* Audit Justification */}
          <div style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-gold)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <PenSquare size={14} /> Audit Trail Justification <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={mode === "delete" ? "Explain why you are deleting this ledger..." : "Explain the reason for this manual ledger intervention..."}
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13,
                background: "rgba(15,23,42,0.5)", border: "1px solid var(--border-color)",
                color: "var(--text-main)", borderRadius: 8, resize: "vertical",
              }}
            />
          </div>

          {err && (
            <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#ef4444", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={18} /> {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <Btn
              onClick={save}
              disabled={!valid || saving}
              variant={mode === "delete" ? "danger" : "primary"}
              style={{ flex: 1, padding: "14px", fontSize: 15, fontWeight: 600, background: valid ? (mode === "delete" ? "#ef4444" : "var(--color-gold)") : "var(--border-color)", color: valid ? (mode === "delete" ? "#fff" : "#000") : "#666" }}
            >
              {saving ? "Processing..." : mode === "delete" ? "Confirm Permanent Deletion" : mode === "append" ? "Execute Stock Append" : "Commit Changes"}
            </Btn>
            <Btn variant="ghost" onClick={onClose} style={{ border: "1px solid var(--border-color)", color: "var(--text-muted)", padding: "14px 24px", fontSize: 14 }}>
              Cancel
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
