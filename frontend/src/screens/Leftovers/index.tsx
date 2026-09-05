import React, { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Select from "../../components/Select";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS, DEPARTMENTS } from "../../styles/colors";
import { useLeftoverStore } from "../../store/leftoverStore";
import { leftoverSchema } from "../../utils/leftoverValidation";
import { today } from "../../utils/dates";

const LIMIT = 20;

interface LeftoverScreenProps {
  noSection?: boolean;
}

export default function LeftoverScreen({ noSection }: LeftoverScreenProps) {
  const { items, total, page, loading, error, fetchLeftovers, createLeftover } = useLeftoverStore();
  const [form, setForm] = useState({
    dept: DEPARTMENTS[0],
    date: today(),
    item: "",
    qty: "",
    unit: "plates",
    carriedForward: true
  });
  const [msg, setMsg] = useState("");
  const [msgColor, setMsgColor] = useState(COLORS.success);
  const [deptFilter, setDeptFilter] = useState("");

  const load = (overrides = {}) => {
    fetchLeftovers({ limit: LIMIT, sort: "date", order: "desc", dept: deptFilter, ...overrides });
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    const qtyNum = parseFloat(form.qty);
    
    // Validate with Zod
    const validationResult = leftoverSchema.safeParse({
      ...form,
      qty: qtyNum
    });

    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors[0]?.message || "Validation failed";
      setMsgColor(COLORS.coral || "#f44336");
      setMsg(errorMsg);
      return;
    }

    try {
      await createLeftover({
        ...form,
        qty: qtyNum
      });
      setForm({ dept: DEPARTMENTS[0], date: today(), item: "", qty: "", unit: "plates", carriedForward: true });
      setMsgColor(COLORS.success);
      setMsg("Leftover recorded ✓");
      setTimeout(() => setMsg(""), 2000);
      load({ page: 1 });
    } catch (e: any) {
      setMsgColor(COLORS.coral || "#f44336");
      setMsg("Error: " + e.message);
    }
  };

  const content = (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
      <Card>
        <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>Record leftover</p>
        <Select label="Department" value={form.dept} onChange={(e: any) => setForm((f) => ({ ...f, dept: e.target.value }))}>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <Input label="Date" type="date" value={form.date} onChange={(e: any) => setForm((f) => ({ ...f, date: e.target.value }))} />
        <Input label="Item / dish" value={form.item} onChange={(e: any) => setForm((f) => ({ ...f, item: e.target.value }))} placeholder="e.g. Idli batter, Curry" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="Quantity" type="number" value={form.qty} onChange={(e: any) => setForm((f) => ({ ...f, qty: e.target.value }))} placeholder="0" />
          <Select label="Unit" value={form.unit} onChange={(e: any) => setForm((f) => ({ ...f, unit: e.target.value }))}>
            {["plates", "portions", "kg", "L", "pcs"].map((u) => <option key={u}>{u}</option>)}
          </Select>
        </div>
        <Select label="Disposition" value={form.carriedForward ? "carry_forward" : "waste"} onChange={(e: any) => setForm((f) => ({ ...f, carriedForward: e.target.value === "carry_forward" }))}>
          <option value="carry_forward">Carry Forward (Reuse)</option>
          <option value="waste">Discard (Waste)</option>
        </Select>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <Btn onClick={submit} style={{ flex: 1 }}>Record Leftover</Btn>
          <Btn variant="ghost" onClick={() => setForm({ dept: DEPARTMENTS[0], date: today(), item: "", qty: "", unit: "plates", carriedForward: true })}>Clear</Btn>
        </div>
        {msg && <p style={{ color: msgColor, fontSize: 12, marginTop: 8, textAlign: "center" }}>{msg}</p>}
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 10, alignItems: "center" }}>
          <SearchBar onSearch={(q) => load({ page: 1, q })} placeholder="Search items…" />
          <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); load({ page: 1, dept: e.target.value }); }}
            style={{ width: 150, padding: "7px 10px", fontSize: 12, background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
            <option value="" style={{ background: "#1a1a1a" }}>All depts</option>
            {DEPARTMENTS.map((d) => <option key={d} style={{ background: "#1a1a1a" }}>{d}</option>)}
          </select>
        </div>

        {loading ? (
          <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading…</p>
        ) : error ? (
          <ErrorMsg error={error} />
        ) : items.length === 0 ? (
          <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>No leftovers recorded</p>
        ) : (
          <>
            <table>
              <thead><tr><th>Date</th><th>Dept</th><th>Item</th><th>Qty</th><th>Status</th></tr></thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    <td style={{ color: COLORS.muted }}>{new Date(l.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td style={{ color: COLORS.accent, fontWeight: 500 }}>{l.dept}</td>
                    <td>{l.item}</td>
                    <td>{l.qty} {l.unit}</td>
                    <td>
                      {l.carriedForward !== false ? (
                        <span className="badge" style={{ background: "#1a2a1a", color: COLORS.success }}>Carried forward</span>
                      ) : (
                        <span className="badge" style={{ background: "#2a1a1a", color: COLORS.coral }}>Discarded (Waste)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
          </>
        )}
      </Card>
    </div>
  );

  if (noSection) return content;

  return (
    <Section title="Leftover Tracking" sub="Count unsold prepared food and carry forward to next day">
      {content}
    </Section>
  );
}
