import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS, DEPARTMENTS, UNITS } from "../../styles/colors";
import { usePaginatedApi } from "../../hooks/useApi";
import { useAppContext } from "../../context/AppContext";
import * as api from "../../api";

const LIMIT = 20;
import { today } from "../../utils/dates";
const LOCATIONS = ["Store", ...DEPARTMENTS];
const emptyItem = { item_code: "", name: "", qty: "", unit: UNITS[0], batch_no: "" };

const STATUS_COLORS = {
  Pending:  { bg: COLORS.accent + "22",  text: COLORS.accent },
  Accepted: { bg: COLORS.success + "22", text: COLORS.success },
  Rejected: { bg: COLORS.coral + "22",   text: COLORS.coral },
};

export default function TransfersScreen() {
  const { stocks }     = useAppContext();
  const [view, setView]   = useState("list"); // "list" | "create" | "detail"
  const [detail, setDetail] = useState(null);
  const [msg, setMsg]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm]   = useState({ date: today(), from_location: "Store", to_location: DEPARTMENTS[0], initiated_by: "", remarks: "" });
  const [lineItems, setLineItems] = useState([{ ...emptyItem }]);

  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.transfers.list);
  const load = (overrides = {}) => fetch({ limit: LIMIT, sort: "date", order: "desc", status: statusFilter, ...overrides });

  useEffect(() => { load(); }, []);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 2500);
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // ── Line items ─────────────────────────────────────────
  const updateLine = (idx, key, val) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      if (key === "name") {
        const match = stocks.find((s) => s.name.toLowerCase() === val.toLowerCase());
        if (match) { next[idx].item_code = match.item_code; next[idx].unit = match.unit || next[idx].unit; }
      }
      return next;
    });
  };
  const addLine    = () => setLineItems((p) => [...p, { ...emptyItem }]);
  const removeLine = (idx) => setLineItems((p) => p.filter((_, i) => i !== idx));

  // ── Submit ─────────────────────────────────────────────
  const submit = async () => {
    if (form.from_location === form.to_location) return flash("From and To locations must be different.", COLORS.coral);
    const valid = lineItems.filter((it) => it.name && it.qty);
    if (valid.length === 0) return flash("Add at least one item.", COLORS.coral);
    try {
      const payload = {
        date: form.date,
        from_location: form.from_location,
        to_location: form.to_location,
        initiated_by: form.initiated_by || null,
        remarks: form.remarks || null,
        items: valid.map((it) => ({
          item_code: it.item_code || it.name.toUpperCase().replace(/\s+/g, "-").slice(0, 20),
          name: it.name,
          qty: parseFloat(it.qty),
          unit: it.unit,
          batch_no: it.batch_no || null,
        })),
      };
      await api.transfers.create(payload);
      flash("Transfer initiated ✓ — awaiting acceptance");
      setForm({ date: today(), from_location: "Store", to_location: DEPARTMENTS[0], initiated_by: "", remarks: "" });
      setLineItems([{ ...emptyItem }]);
      setView("list");
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  // ── Detail ─────────────────────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await api.transfers.getOne(id);
      setDetail(res.data);
      setView("detail");
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const changeStatus = async (id, action) => {
    try {
      const fn = action === "accept" ? api.transfers.accept : api.transfers.reject;
      await fn(id, {});
      const res = await api.transfers.getOne(id);
      setDetail(res.data);
      load({ page: 1 });
      flash(action === "accept" ? "Transfer accepted — stock deducted ✓" : "Transfer rejected.");
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const deleteTransfer = async (id) => {
    if (!confirm("Delete this transfer?")) return;
    try {
      await api.transfers.remove(id);
      flash("Transfer deleted.");
      setView("list");
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const StatusBadge = ({ status }) => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.Pending;
    return <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{status}</span>;
  };

  // ──────────────────────────────────────────────────────
  // DETAIL VIEW
  // ──────────────────────────────────────────────────────
  if (view === "detail" && detail) {
    return (
      <Section title={`Transfer — ${detail.transfer_number}`} sub={`${detail.from_location} → ${detail.to_location} · ${detail.date}`}>
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <StatusBadge status={detail.status} />
          {detail.initiated_by && <span style={{ color: COLORS.muted, fontSize: 12 }}>by {detail.initiated_by}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {detail.status === "Pending" && (
              <>
                <Btn small onClick={() => changeStatus(detail.id, "accept")}>Accept Transfer</Btn>
                <Btn small variant="danger" onClick={() => changeStatus(detail.id, "reject")}>Reject</Btn>
                <Btn small variant="ghost" onClick={() => deleteTransfer(detail.id)}>Delete</Btn>
              </>
            )}
            <Btn small variant="ghost" onClick={() => setView("list")}>← Back</Btn>
          </div>
        </div>

        {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 10 }}>{msg.text}</p>}

        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
            {[
              ["From", detail.from_location],
              ["To", detail.to_location],
              ["Date", detail.date],
              ["Initiated By", detail.initiated_by || "—"],
              ["Accepted By", detail.accepted_by || "—"],
              ["Remarks", detail.remarks || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</p>
                <p style={{ color: COLORS.text, fontSize: 13, marginTop: 4 }}>{v}</p>
              </div>
            ))}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {["Item Name", "Item Code", "Qty", "Unit", "Batch No"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(detail.items || []).map((it) => (
                <tr key={it.id} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                  <td style={{ padding: "10px 12px", color: COLORS.text, fontWeight: 500 }}>{it.name}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: COLORS.teal, fontSize: 12 }}>{it.item_code}</td>
                  <td style={{ padding: "10px 12px", color: COLORS.accent, fontWeight: 600 }}>{it.qty}</td>
                  <td style={{ padding: "10px 12px", color: COLORS.muted }}>{it.unit}</td>
                  <td style={{ padding: "10px 12px", color: COLORS.purple, fontFamily: "monospace", fontSize: 11 }}>{it.batch_no || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    );
  }

  // ──────────────────────────────────────────────────────
  // CREATE VIEW
  // ──────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <Section title="New Stock Transfer" sub="Move inventory between store and departments">
        <Card style={{ maxWidth: 800 }}>
          {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 12 }}>{msg.text}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Input label="Date" type="date" value={form.date} onChange={f("date")} />
            <div>
              <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>From *</label>
              <select value={form.from_location} onChange={(e) => {
                  const val = e.target.value;
                  setForm(p => ({ ...p, from_location: val, to_location: p.to_location === val ? LOCATIONS.find(l => l !== val) : p.to_location }));
                }}
                style={{ width: "100%", padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 13 }}>
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>To *</label>
              <select value={form.to_location} onChange={f("to_location")}
                style={{ width: "100%", padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 13 }}>
                {LOCATIONS.map((l) => <option key={l} disabled={l === form.from_location}>{l}</option>)}
              </select>
            </div>
            <Input label="Initiated By" value={form.initiated_by} onChange={f("initiated_by")} placeholder="Your name" />
            <div style={{ gridColumn: "2 / -1" }}>
              <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Remarks</label>
              <input value={form.remarks} onChange={f("remarks")} placeholder="Reason for transfer…"
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "8px 12px", width: "100%", fontSize: 13 }} />
            </div>
          </div>

          <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Items to Transfer</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {["Item Name", "Item Code", "Qty", "Unit", "Batch No", ""].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                  <td style={{ padding: "5px 8px" }}>
                    <input list="stock-names-tr" value={it.name} onChange={(e) => updateLine(idx, "name", e.target.value)} placeholder="Item name"
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 150 }} />
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <input value={it.item_code} onChange={(e) => updateLine(idx, "item_code", e.target.value)} placeholder="KPL-###"
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.teal, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 90, fontFamily: "monospace" }} />
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <input type="number" min="0.01" step="any" value={it.qty} onChange={(e) => updateLine(idx, "qty", e.target.value)}
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 80 }} />
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <select value={it.unit} onChange={(e) => updateLine(idx, "unit", e.target.value)}
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 70 }}>
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <input value={it.batch_no} onChange={(e) => updateLine(idx, "batch_no", e.target.value)} placeholder="Optional"
                      style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.purple, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 100, fontFamily: "monospace" }} />
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    {lineItems.length > 1 && <Btn small variant="danger" onClick={() => removeLine(idx)}>✕</Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="stock-names-tr">
            {stocks.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn small variant="ghost" onClick={addLine}>+ Add Item</Btn>
            <div style={{ flex: 1 }} />
            <Btn onClick={submit}>Initiate Transfer</Btn>
            <Btn variant="ghost" onClick={() => setView("list")}>Cancel</Btn>
          </div>
        </Card>
      </Section>
    );
  }

  // ──────────────────────────────────────────────────────
  // LIST VIEW
  // ──────────────────────────────────────────────────────
  return (
    <Section title="Stock Transfers" sub="Move inventory between store and departments">
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar onSearch={(v) => load({ page: 1, q: v })} placeholder="Search TRF#…" />
        <select value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); load({ page: 1, status: e.target.value }); }}
          style={{ padding: "7px 10px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 12 }}>
          <option value="">All Statuses</option>
          {["Pending", "Accepted", "Rejected"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft: "auto" }}>
          <Btn onClick={() => setView("create")}>+ New Transfer</Btn>
        </div>
      </div>

      {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 10 }}>{msg.text}</p>}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading…</p>
        ) : error ? (
          <ErrorMsg error={error} />
        ) : items.length === 0 ? (
          <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>No transfers yet. Create one above.</p>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {["Transfer #", "Date", "From", "To", "Status", "Initiated By", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${COLORS.border}22`, cursor: "pointer" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = COLORS.surface}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    onClick={() => openDetail(t.id)}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", color: COLORS.teal, fontWeight: 600 }}>{t.transfer_number}</td>
                    <td style={{ padding: "12px 16px", color: COLORS.muted }}>{t.date}</td>
                    <td style={{ padding: "12px 16px", color: COLORS.text }}>{t.from_location}</td>
                    <td style={{ padding: "12px 16px", color: COLORS.text, fontWeight: 500 }}>{t.to_location}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: STATUS_COLORS[t.status]?.bg, color: STATUS_COLORS[t.status]?.text, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{t.status}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: COLORS.muted }}>{t.initiated_by || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <Btn small variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(t.id); }}>View →</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
          </>
        )}
      </Card>
    </Section>
  );
}
