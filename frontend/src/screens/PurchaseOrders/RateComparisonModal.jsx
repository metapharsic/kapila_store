import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { Scale, X, Send, Trophy } from "lucide-react";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import * as api from "../../api";

export default function RateComparisonModal({ open, onClose, stocks = [] }) {
  const [itemCode, setItemCode] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [quotedRate, setQuotedRate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const uniqueItems = Array.from(new Map(stocks.map((s) => [s.item_code, s])).values())
    .sort((a, b) => a.name.localeCompare(b.name));

  const load = async (code) => {
    if (!code) return;
    setLoading(true);
    setErr("");
    try {
      const res = await api.rateQuotes.compare(code);
      setReport(res.data);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setItemCode("");
      setReport(null);
      setSupplierName("");
      setQuotedRate("");
      setNotes("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const selected = uniqueItems.find((s) => s.item_code === itemCode);

  const addQuote = async () => {
    if (!itemCode || !supplierName.trim() || !(parseFloat(quotedRate) > 0)) return;
    setSaving(true);
    setErr("");
    try {
      await api.rateQuotes.create({
        item_code: itemCode,
        item_name: selected.name,
        unit: selected.unit,
        supplier_name: supplierName.trim(),
        quoted_rate: parseFloat(quotedRate),
        notes: notes.trim() || null,
      });
      setSupplierName("");
      setQuotedRate("");
      setNotes("");
      await load(itemCode);
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  const shareWhatsApp = () => {
    if (!report) return;
    let text = `*RATE COMPARISON — ${report.item_name}*\n(current stock rate: ₹${report.current_price ?? "—"}/${report.unit})\n\n`;
    report.rows.forEach((r, i) => {
      const tag = i === 0 ? "🏆 " : "";
      text += `${tag}${r.supplier} — ₹${r.rate.toFixed(2)}/${report.unit}${r.source === "quote" ? " (new quote)" : " (past purchase)"}\n`;
    });
    if (report.cheapest) {
      text += `\nCheapest: *${report.cheapest.supplier}* @ ₹${report.cheapest.rate.toFixed(2)}`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
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
          width: 560, maxWidth: "94%", maxHeight: "88vh", background: COLORS.surface,
          border: `1px solid ${COLORS.border}`, borderRadius: 12,
          boxShadow: "0 8px 32px rgba(15,23,42,0.15)",
          display: "flex", flexDirection: "column", padding: 24, overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
            <Scale size={18} /> Vendor Rate Comparison
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 18 }}>
          Pick item, add new vendor quotes, compare against past purchase rates.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Item</label>
          <select
            value={itemCode}
            onChange={(e) => { setItemCode(e.target.value); load(e.target.value); }}
            style={{ width: "100%", padding: "8px 12px", fontSize: 13, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6 }}
          >
            <option value="">Select item…</option>
            {uniqueItems.map((s) => <option key={s.item_code} value={s.item_code}>{s.name} ({s.item_code})</option>)}
          </select>
        </div>

        {itemCode && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 10, marginBottom: 8 }}>
              <Input label="Vendor / Supplier Name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="e.g. Sri Balaji Traders" />
              <Input label={`Quoted Rate (₹/${selected?.unit || "unit"})`} type="number" step="0.01" value={quotedRate} onChange={(e) => setQuotedRate(e.target.value)} placeholder="0.00" />
            </div>
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — call notes, MOQ, delivery terms…" />
            <Btn small onClick={addQuote} disabled={saving || !supplierName.trim() || !(parseFloat(quotedRate) > 0)} style={{ marginTop: 10, marginBottom: 18 }}>
              {saving ? "Adding…" : "Add Quote"}
            </Btn>

            {loading && <p style={{ fontSize: 12, color: COLORS.muted }}>Loading comparison…</p>}

            {report && !loading && (
              <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: COLORS.bg + "44", fontSize: 12, color: COLORS.muted, display: "flex", justifyContent: "space-between" }}>
                  <span>{report.item_name}</span>
                  <span>Current stock rate: ₹{report.current_price != null ? parseFloat(report.current_price).toFixed(2) : "—"}/{report.unit}</span>
                </div>
                {report.rows.length === 0 ? (
                  <p style={{ fontSize: 12, color: COLORS.muted, padding: 16, textAlign: "center" }}>No quotes or purchase history yet.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ fontSize: 11, color: COLORS.muted, textAlign: "left" }}>
                        <th style={{ padding: "6px 12px" }}>Supplier</th>
                        <th style={{ padding: "6px 12px" }}>Rate</th>
                        <th style={{ padding: "6px 12px" }}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}`, background: i === 0 ? COLORS.success + "11" : "transparent" }}>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: i === 0 ? 700 : 500 }}>
                            {i === 0 && <Trophy size={12} style={{ color: COLORS.success, marginRight: 4, verticalAlign: "middle" }} />}
                            {r.supplier}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: i === 0 ? COLORS.success : COLORS.text }}>₹{r.rate.toFixed(2)}</td>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: COLORS.muted }}>{r.source === "quote" ? "New quote" : "Past purchase"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}

        {err && <p style={{ color: COLORS.coral, fontSize: 12, marginTop: 12 }}>{err}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Btn onClick={shareWhatsApp} disabled={!report || report.rows.length === 0} icon={<Send size={14} />} style={{ flex: 1 }}>
            Share to WhatsApp
          </Btn>
          <Btn variant="ghost" onClick={onClose} style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}>
            Close
          </Btn>
        </div>
      </div>
    </div>
  );
}
