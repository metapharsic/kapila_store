import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS, UNITS } from "../../styles/colors";
import { useAppContext } from "../../context/AppContext";
import * as api from "../../api";

const REASONS = ["Audit Correction", "Damage", "Theft", "Expiry Write-off", "Other"];
import { today } from "../../utils/dates";
const emptyItem = { item_code: "", name: "", physical_qty: "", reason: REASONS[0], notes: "" };

export default function ReconciliationScreen() {
  const { stocks, refreshStockNames } = useAppContext();
  const [items, setItems]   = useState([{ ...emptyItem }]);
  const [stockMap, setStockMap] = useState({});
  const [msg, setMsg]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Build item_code → total_remaining map from context stocks
  useEffect(() => {
    const map = {};
    stocks.forEach((s) => {
      if (!map[s.item_code]) map[s.item_code] = { remaining: 0, unit: s.unit, name: s.name };
      map[s.item_code].remaining += parseFloat(s.remaining || 0);
    });
    setStockMap(map);
  }, [stocks]);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 3000);
  };

  const updateItem = (idx, key, val) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      // Auto-fill name when item_code changes
      if (key === "item_code" && stockMap[val]) {
        next[idx].name = stockMap[val].name;
      }
      // Auto-fill item_code when name selected from stock
      if (key === "name") {
        const match = stocks.find((s) => s.name.toLowerCase() === val.toLowerCase());
        if (match) next[idx].item_code = match.item_code;
      }
      return next;
    });
  };

  const addItem    = () => setItems((p) => [...p, { ...emptyItem }]);
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const systemQty = (item_code) => stockMap[item_code]?.remaining ?? null;
  const unit      = (item_code) => stockMap[item_code]?.unit ?? "pcs";

  const variance = (item) => {
    const sys = systemQty(item.item_code);
    const phy = parseFloat(item.physical_qty);
    if (sys === null || isNaN(phy)) return null;
    const diff = phy - sys;
    return Math.abs(diff) < 0.0001 ? 0 : diff;
  };

  const submit = async () => {
    const valid = items.filter((it) => it.item_code && it.physical_qty !== "");
    if (valid.length === 0) return flash("Add at least one item with physical count.", COLORS.coral);

    setSubmitting(true);
    try {
      await api.stock.reconcile({
        items: valid.map((it) => ({
          item_code: it.item_code,
          physical_qty: parseFloat(it.physical_qty),
          reason: it.reason,
          notes: it.notes || null,
        })),
      });
      flash(`Reconciliation complete — ${valid.length} item(s) adjusted ✓`);
      await refreshStockNames();
      setItems([{ ...emptyItem }]);
    } catch (e) {
      flash(e.message, COLORS.coral);
    } finally {
      setSubmitting(false);
    }
  };

  const totalVariance = items.reduce((sum, it) => {
    const v = variance(it);
    return v !== null ? sum + v : sum;
  }, 0);

  return (
    <Section title="Stock Reconciliation" sub="Enter physical counts — system calculates variances and adjusts FIFO">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>

        {/* Main reconciliation table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Physical Count Entry — {today()}</p>
            <Btn small variant="ghost" onClick={addItem}>+ Add Item</Btn>
          </div>

          {msg && <p style={{ color: msg.color, fontSize: 12, margin: "10px 20px" }}>{msg.text}</p>}

          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {["Item Name", "Item Code", "System Qty", "Physical Qty", "Unit", "Variance", "Reason", "Notes", ""].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const sys = systemQty(it.item_code);
                  const v   = variance(it);
                  const u   = unit(it.item_code);
                  return (
                    <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          list="stock-names-rec"
                          value={it.name}
                          onChange={(e) => updateItem(idx, "name", e.target.value)}
                          placeholder="Item name"
                          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 150 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          value={it.item_code}
                          onChange={(e) => updateItem(idx, "item_code", e.target.value)}
                          placeholder="KPL-###"
                          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.teal, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 90, fontFamily: "monospace" }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px", color: COLORS.muted, fontWeight: 500 }}>
                        {sys !== null ? `${sys.toFixed(2)} ${u}` : <span style={{ color: COLORS.coral, fontSize: 11 }}>not found</span>}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="number" min="0" step="any"
                          value={it.physical_qty}
                          onChange={(e) => updateItem(idx, "physical_qty", e.target.value)}
                          placeholder="0"
                          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 85 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px", color: COLORS.muted, fontSize: 12 }}>{u}</td>
                      <td style={{ padding: "6px 10px", fontWeight: 700, fontSize: 13 }}>
                        {v === null ? (
                          <span style={{ color: COLORS.muted }}>—</span>
                        ) : (
                          <span style={{ color: v === 0 ? COLORS.success : v > 0 ? COLORS.teal : COLORS.coral }}>
                            {v > 0 ? "+" : ""}{v.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <select
                          value={it.reason}
                          onChange={(e) => updateItem(idx, "reason", e.target.value)}
                          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 140 }}
                        >
                          {REASONS.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          value={it.notes}
                          onChange={(e) => updateItem(idx, "notes", e.target.value)}
                          placeholder="Optional…"
                          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 120 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        {items.length > 1 && <Btn small variant="danger" onClick={() => removeItem(idx)}>✕</Btn>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <datalist id="stock-names-rec">
            {stocks.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>

          <div style={{ padding: "14px 20px", borderTop: `1px solid ${COLORS.border}` }}>
            <Btn onClick={submit} disabled={submitting} style={{ width: "100%" }}>
              {submitting ? "Applying adjustments…" : "Apply Reconciliation"}
            </Btn>
          </div>
        </Card>

        {/* Summary panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Variance Summary</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Items entered", value: items.filter((i) => i.item_code).length, color: COLORS.text },
                { label: "Total variance", value: `${totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(2)}`, color: Math.abs(totalVariance) < 0.0001 ? COLORS.success : totalVariance > 0 ? COLORS.teal : COLORS.coral },
                { label: "Items surplus", value: items.filter((i) => (variance(i) ?? 0) > 0).length, color: COLORS.teal },
                { label: "Items short", value: items.filter((i) => (variance(i) ?? 0) < 0).length, color: COLORS.coral },
                { label: "Items matching", value: items.filter((i) => variance(i) === 0).length, color: COLORS.success },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>{label}</span>
                  <span style={{ fontWeight: 700, color, fontSize: 15 }}>{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>How it works</p>
            <ul style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.7, paddingLeft: 16 }}>
              <li>Enter physical count per item</li>
              <li>System auto-calculates variance</li>
              <li>Short items — oldest batches deducted first (FIFO)</li>
              <li>Surplus items — added to newest batch</li>
              <li>All adjustments logged in audit trail</li>
            </ul>
          </Card>

          <Card style={{ background: COLORS.coral + "12", border: `1px solid ${COLORS.coral}33` }}>
            <p style={{ fontSize: 11, color: COLORS.coral, fontWeight: 600, marginBottom: 6 }}>⚠ Irreversible</p>
            <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
              Applying reconciliation directly adjusts stock levels. Review all variances before submitting.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
