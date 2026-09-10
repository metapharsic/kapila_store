import React, { useState, useEffect, useRef } from "react";
import { security } from "../../api";
import {
  X, Plus, Trash2, Printer, Package,
  CheckCircle2, AlertCircle, Shield, RefreshCw
} from "lucide-react";

const PASS_TYPE_LABELS = {
  INWARD_MATERIAL: "INWARD MATERIAL",
  RGP_RETURNABLE: "RGP (Returnable Gate Pass)",
  OUTWARD_RTV: "OUTWARD RTV",
  NRGP_NON_RETURNABLE: "NRGP (Non-Returnable)",
  VISITOR_CONTRACTOR: "VISITOR / CONTRACTOR",
};

const UNIT_OPTIONS = [
  "units","kg","g","litre","ml","nos","box","crate","bag",
  "sack","bundle","roll","set","pair","pcs","dozen","bottle",
  "can","drum","cylinder"
];

const IS = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--bg-modal)",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  color: "var(--text-main)",
  fontSize: 12.5,
  outline: "none",
};

const LABEL_STYLE = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export default function GatePassDetailModal({
  passId,
  pass: propPass,
  isOpen,
  onClose,
  onUpdated,
}) {
  const [pass, setPass] = useState(propPass || null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addItemName, setAddItemName] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addUnit, setAddUnit] = useState("units");
  const [addPackageType, setAddPackageType] = useState("");
  const [addRemarks, setAddRemarks] = useState("");
  const [addIsReturnable, setAddIsReturnable] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const printRef = useRef();

  const effectivePassId = passId || propPass?.id;

  useEffect(() => {
    if (isOpen && effectivePassId) {
      loadPass();
    } else {
      setPass(propPass || null);
      setItems(propPass?.items || []);
      setShowAddForm(false);
      setMsg("");
      setErr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, effectivePassId]);

  const loadPass = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await security.getPass(effectivePassId);
      const p = res.data || res;
      setPass(p);
      setItems(Array.isArray(p.items) ? p.items : []);
    } catch (e) {
      setErr(e.message || "Failed to load gate pass details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!addItemName.trim()) { setErr("Item name is required."); return; }
    const qty = parseFloat(addQty);
    if (isNaN(qty) || qty <= 0) { setErr("Quantity must be greater than 0."); return; }
    setAddLoading(true);
    setErr("");
    try {
      await security.appendItem(effectivePassId, {
        item_name: addItemName.trim(),
        qty,
        unit: addUnit,
        package_type: addPackageType.trim() || null,
        remarks: addRemarks.trim() || null,
        is_returnable: addIsReturnable,
      });
      await loadPass();
      setAddItemName("");
      setAddQty("");
      setAddUnit("units");
      setAddPackageType("");
      setAddRemarks("");
      setAddIsReturnable(false);
      setShowAddForm(false);
      setMsg("Item added successfully");
      setTimeout(() => setMsg(""), 3000);
      if (onUpdated) onUpdated();
    } catch (e) {
      setErr(e.message || "Failed to add item.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Remove this item from the gate pass?")) return;
    setDeletingItemId(itemId);
    setErr("");
    try {
      await security.deleteItem(effectivePassId, itemId);
      await loadPass();
      setMsg("Item removed");
      setTimeout(() => setMsg(""), 3000);
      if (onUpdated) onUpdated();
    } catch (e) {
      setErr(e.message || "Failed to delete item.");
    } finally {
      setDeletingItemId(null);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const passNum = pass && pass.pass_number ? pass.pass_number : "GP";
    const win = window.open("", "_blank", "width=820,height=1000");
    const css = [
      "*{margin:0;padding:0;box-sizing:border-box}",
      "body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#000}",
      ".hdr{text-align:center;border-bottom:3px double #000;padding-bottom:14px;margin-bottom:16px}",
      ".hname{font-size:22px;font-weight:900;letter-spacing:1px}",
      ".hsub{font-size:11px;color:#444;margin-top:3px}",
      ".ptitle{display:inline-block;border:2px solid #000;padding:4px 20px;margin-top:10px;font-weight:800;font-size:13px;letter-spacing:2px;text-transform:uppercase}",
      ".grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;margin:14px 0}",
      ".mr{display:flex;gap:6px;font-size:11.5px}",
      ".ml{font-weight:700;min-width:130px;color:#333}",
      ".sec{margin-top:14px}",
      ".stitle{font-weight:800;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:10px;font-size:12px}",
      "table{width:100%;border-collapse:collapse;font-size:11px}",
      "th{background:#000;color:#fff;padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}",
      "td{padding:5px 8px;border-bottom:1px solid #ccc}",
      "tr:nth-child(even) td{background:#f5f5f5}",
      ".sigs{margin-top:36px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}",
      ".sig{text-align:center;border-top:1.5px solid #000;padding-top:8px;font-size:10.5px;font-weight:700}",
      ".foot{margin-top:14px;border-top:1px dashed #bbb;padding-top:8px;font-size:9.5px;color:#666;text-align:center}",
      ".rmk{margin-top:12px;padding:8px 12px;border:1px solid #999;border-radius:3px;background:#f9f9f9;font-size:11.5px}",
      "@media print{.no-print{display:none!important}}",
    ].join("");
    win.document.write(
      "<!DOCTYPE html><html><head><title>Gate Pass - " + passNum + "</title>" +
      "<style>" + css + "</style></head><body>" +
      content.innerHTML +
      "<script>window.onload=function(){window.print();window.close();}<" + "/script>" +
      "</body></html>"
    );
    win.document.close();
  };

  if (!isOpen) return null;

  const p = pass;
  const fmt = (d) => {
    if (!d) return "Open";
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };
  const typeLabel = p ? (PASS_TYPE_LABELS[p.pass_type] || p.pass_type || "") : "";
  const isInPremises = p && p.status === "IN_PREMISES";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      zIndex: 9999, padding: "20px", overflowY: "auto",
      animation: "modalBackdropFade 0.2s ease-out"
    }}>
      <style>
        {`
          @keyframes modalBackdropFade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalPopUp {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}
      </style>
      <div style={{
        background: "var(--bg-modal)",
        border: "1px solid rgba(232,168,56,0.3)",
        borderRadius: 14, width: "100%", maxWidth: 880,
        color: "var(--text-main)", boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
        animation: "modalPopUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(135deg,var(--bg-page),rgba(15,23,42,0.9))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "var(--color-gold-dim)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-gold)",
            }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  {loading ? "Loading..." : (p?.pass_number || "Gate Pass Details")}
                </h2>
                {p && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 5,
                    fontSize: 10.5, fontWeight: 700,
                    background: isInPremises ? "rgba(16,185,129,0.15)" : "rgba(100,116,139,0.2)",
                    color: isInPremises ? "#34D399" : "var(--text-muted)",
                    border: isInPremises
                      ? "1px solid rgba(16,185,129,0.35)"
                      : "1px solid rgba(100,116,139,0.3)",
                  }}>
                    {isInPremises ? "IN PREMISES" : "COMPLETED"}
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{typeLabel}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {p && (
              <button
                onClick={loadPass}
                title="Refresh"
                style={{ background: "var(--border-color)", border: "1px solid var(--border-color)", borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
              >
                <RefreshCw size={15} />
              </button>
            )}
            {p && (
              <button
                onClick={handlePrint}
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 7, padding: "6px 12px", cursor: "pointer", color: "#34D399", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12 }}
              >
                <Printer size={14} /> Print
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: "var(--border-color)", border: "1px solid var(--border-color)", borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Toasts ── */}
        {msg && (
          <div style={{ margin: "12px 24px 0", padding: "10px 14px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, color: "#34D399", fontSize: 13, fontWeight: 600 }}>
            ✓ {msg}
          </div>
        )}
        {err && (
          <div style={{ margin: "12px 24px 0", padding: "10px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#F87171", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={14} /> {err}
          </div>
        )}

        {/* ── Body ── */}
        {loading ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
            <RefreshCw size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading gate pass…</p>
          </div>
        ) : p ? (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Pass Info Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "16px 20px" }}>
              {[
                { label: "Vehicle", value: `${p.vehicle_number || ""} (${(p.vehicle_type || "").replace(/_/g, " ")})` },
                { label: "Driver", value: `${p.driver_name || ""}${p.driver_phone ? " — " + p.driver_phone : ""}` },
                { label: "Vendor / Supplier", value: p.vendor_name || "General Entry" },
                { label: "Purpose of Entry", value: p.purpose || "—" },
                { label: "Challan / DC #", value: p.challan_number || "—" },
                { label: "Invoice #", value: p.invoice_number || "—" },
                { label: "PO Number", value: p.po_number || "—" },
                { label: "Security Guard", value: p.security_guard_name || "Main Gate" },
                { label: "IN Time", value: fmt(p.in_time), color: "var(--color-gold)" },
                { label: "OUT Time", value: fmt(p.out_time), color: p.out_time ? "#34D399" : "#F87171" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: r.color || "var(--text-main)" }}>{r.value || "—"}</div>
                </div>
              ))}
              {p.remarks && (
                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Remarks</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{p.remarks}</div>
                </div>
              )}
            </div>

            {/* Items Section */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, overflow: "hidden" }}>
              {/* Items Header */}
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Package size={16} color="var(--color-gold)" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Material Items ({items.length})</span>
                </div>
                <button
                  onClick={() => { setShowAddForm(!showAddForm); setErr(""); }}
                  style={{
                    padding: "6px 14px",
                    background: showAddForm ? "rgba(239,68,68,0.15)" : "var(--color-gold-dim)",
                    border: `1px solid ${showAddForm ? "rgba(239,68,68,0.35)" : "var(--color-gold-glow)"}`,
                    borderRadius: 7, cursor: "pointer",
                    color: showAddForm ? "#F87171" : "var(--color-gold)",
                    fontSize: 12, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {showAddForm ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Add Item</>}
                </button>
              </div>

              {/* Add Item Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddItem}
                  style={{ padding: "16px 18px", background: "rgba(232,168,56,0.05)", borderBottom: "1px solid rgba(232,168,56,0.2)", display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={LABEL_STYLE}>Item / Material Name *</label>
                      <input
                        type="text" required value={addItemName}
                        onChange={(e) => setAddItemName(e.target.value)}
                        placeholder="e.g. Tomatoes, LPG Cylinder 47.5kg"
                        style={IS}
                      />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>Quantity *</label>
                      <input
                        type="number" required min="0.001" step="any"
                        value={addQty} onChange={(e) => setAddQty(e.target.value)}
                        placeholder="15" style={IS}
                      />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>Unit</label>
                      <select value={addUnit} onChange={(e) => setAddUnit(e.target.value)} style={IS}>
                        {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 10, alignItems: "flex-end" }}>
                    <div>
                      <label style={LABEL_STYLE}>Package Type</label>
                      <input
                        type="text" value={addPackageType}
                        onChange={(e) => setAddPackageType(e.target.value)}
                        placeholder="e.g. Crate, Bag, Sack" style={IS}
                      />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>Remarks / Notes</label>
                      <input
                        type="text" value={addRemarks}
                        onChange={(e) => setAddRemarks(e.target.value)}
                        placeholder="e.g. Received in good condition" style={IS}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 2 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer" }}>
                        <input
                          type="checkbox" checked={addIsReturnable}
                          onChange={(e) => setAddIsReturnable(e.target.checked)}
                        />
                        Returnable
                      </label>
                      <button
                        type="submit" disabled={addLoading}
                        style={{ padding: "8px 18px", background: "linear-gradient(135deg,var(--color-gold),#ca8a04)", border: "none", borderRadius: 7, color: "var(--bg-modal)", fontSize: 12, fontWeight: 700, cursor: addLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                      >
                        {addLoading ? "Adding…" : "Add Item"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Items Table */}
              {items.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "var(--text-muted)" }}>
                  <Package size={28} style={{ marginBottom: 8, opacity: 0.35 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No structured items added yet.</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    Material summary: <em>{p.material_description || "—"}</em>
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "rgba(15,23,42,0.6)", borderBottom: "1px solid var(--border-color)" }}>
                        {["#", "Item / Material Name", "Qty", "Unit", "Package", "Remarks", "Returnable", "Action"].map((h) => (
                          <th key={h} style={{ padding: "10px 14px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11.5, textAlign: h === "Action" ? "right" : h === "Qty" || h === "Returnable" ? "center" : "left" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 11 }}>{idx + 1}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-main)" }}>{it.item_name}</td>
                          <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "var(--color-gold)" }}>
                            {parseFloat(it.qty).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{it.unit}</td>
                          <td style={{ padding: "10px 14px", color: "#CBD5E1" }}>{it.package_type || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 11.5 }}>{it.remarks || "—"}</td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {it.is_returnable
                              ? <CheckCircle2 size={14} color="#34D399" />
                              : <span style={{ color: "#475569", fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            <button
                              onClick={() => handleDeleteItem(it.id)}
                              disabled={deletingItemId === it.id}
                              style={{ padding: "4px 10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 5, color: "#F87171", fontSize: 11, fontWeight: 600, cursor: deletingItemId === it.id ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Trash2 size={11} />
                              {deletingItemId === it.id ? "…" : "Remove"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Material Description bar */}
            {p.material_description && (
              <div style={{ padding: "10px 14px", background: "rgba(232,168,56,0.06)", border: "1px solid rgba(232,168,56,0.2)", borderRadius: 8, fontSize: 12, color: "#CBD5E1" }}>
                <span style={{ fontWeight: 700, color: "var(--color-gold)" }}>Material Description: </span>
                {p.material_description}
              </div>
            )}

            {/* Footer Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={{ padding: "9px 18px", background: "transparent", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Close
              </button>
              <button onClick={handlePrint} style={{ padding: "9px 20px", background: "linear-gradient(135deg,#10B981,#059669)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}>
                <Printer size={15} /> Print Gate Pass
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "#F87171" }}>
            <AlertCircle size={24} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>{err || "Gate pass not found."}</p>
          </div>
        )}

        {/* ── Hidden Print Template ── */}
        <div ref={printRef} style={{ display: "none" }}>
          {p && <PrintTemplate pass={p} items={items} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Printable Template ─── */
function PrintTemplate({ pass: p, items }) {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
      : "Open";

  const typeLabel =
    {
      INWARD_MATERIAL: "INWARD MATERIAL",
      RGP_RETURNABLE: "RGP (Returnable Gate Pass)",
      OUTWARD_RTV: "OUTWARD RTV",
      NRGP_NON_RETURNABLE: "NRGP (Non-Returnable)",
      VISITOR_CONTRACTOR: "VISITOR / CONTRACTOR",
    }[p.pass_type] || p.pass_type;

  const metaRows = [
    ["Pass Number", p.pass_number],
    ["Pass Type", typeLabel],
    ["Vehicle Number", p.vehicle_number],
    ["Vehicle Type", (p.vehicle_type || "").replace(/_/g, " ")],
    ["Driver Name", p.driver_name],
    ["Driver Phone", p.driver_phone || "—"],
    ["Vendor / Supplier", p.vendor_name || "General Entry"],
    ["Purpose of Entry", p.purpose],
    ["Challan / DC #", p.challan_number || "—"],
    ["Invoice #", p.invoice_number || "—"],
    ["PO Number", p.po_number || "—"],
    ["Security Guard", p.security_guard_name || "Main Gate"],
    ["IN Time", fmt(p.in_time)],
    ["OUT Time", fmt(p.out_time)],
  ];

  return (
    <div>
      <div className="hdr">
        <div className="hname">HOTEL KAPILA</div>
        <div className="hsub">Security Gate Pass Register — Material Movement Control</div>
        <div className="ptitle">{typeLabel}</div>
      </div>

      <div className="grid">
        {metaRows.map(([l, v]) => (
          <div key={l} className="mr">
            <span className="ml">{l}:</span>
            <span>{v}</span>
          </div>
        ))}
      </div>

      <div className="sec">
        <div className="stitle">Material Items / Goods Received ({items.length})</div>
        {items.length === 0 ? (
          <p style={{ fontStyle: "italic", color: "#555", marginBottom: 8 }}>
            Material Description: {p.material_description || "Not specified"}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                {["#", "Item Name", "Qty", "Unit", "Package", "Returnable", "Remarks"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{it.item_name}</td>
                  <td style={{ fontWeight: 700 }}>{parseFloat(it.qty).toLocaleString()}</td>
                  <td>{it.unit}</td>
                  <td>{it.package_type || "—"}</td>
                  <td>{it.is_returnable ? "YES" : "No"}</td>
                  <td style={{ fontSize: 10 }}>{it.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {p.remarks && (
        <div className="rmk">
          <strong>Notes / Remarks: </strong>{p.remarks}
        </div>
      )}

      <div className="sigs">
        {["Security Guard Signature", "Store Incharge Signature", "Driver / Authorized Person"].map((s) => (
          <div key={s} className="sig">{s}</div>
        ))}
      </div>

      <div className="foot">
        Generated by Kapila Inventory Management System &bull;{" "}
        {new Date().toLocaleString("en-IN")}
      </div>
    </div>
  );
}
