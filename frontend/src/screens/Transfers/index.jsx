import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Plus,
  Printer,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Building2,
  Package,
  Layers,
  FileText,
  Clock,
} from "lucide-react";
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
import { today } from "../../utils/dates";
import * as api from "../../api";

import TransferAgentStatusBar from "./components/TransferAgentStatusBar";
import TransferChallanModal from "./components/TransferChallanModal";
import AcknowledgeTransferModal from "./components/AcknowledgeTransferModal";
import InterDeptCostMatrix from "./components/InterDeptCostMatrix";

const LIMIT = 15;
const LOCATIONS = ["Store", ...DEPARTMENTS];
const emptyItem = { item_code: "", name: "", qty: "", unit: UNITS[0], batch_no: "", unit_price: 0, rack: "", available: null };

const STATUS_BADGES = {
  Pending:  { bg: "rgba(232, 168, 56, 0.15)", text: COLORS.accent, border: "rgba(232, 168, 56, 0.4)", label: "In-Transit" },
  Accepted: { bg: "rgba(16, 185, 129, 0.15)", text: COLORS.success, border: "rgba(16, 185, 129, 0.4)", label: "Accepted ✓" },
  Rejected: { bg: "rgba(239, 68, 68, 0.15)",  text: COLORS.coral, border: "rgba(239, 68, 68, 0.4)", label: "Rejected" },
};

export default function TransfersScreen() {
  const { stocks } = useAppContext();
  const [activeTab, setActiveTab] = useState("transfers"); // "transfers" | "matrix"
  const [view, setView] = useState("list"); // "list" | "create" | "detail"
  const [detail, setDetail] = useState(null);
  const [msg, setMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [summary, setSummary] = useState(null);

  // Available stock catalog for autocomplete & live on-hand checks
  const [catalog, setCatalog] = useState([]);

  // Modals state
  const [challanTransfer, setChallanTransfer] = useState(null);
  const [ackTransfer, setAckTransfer] = useState(null);

  // Transfer Form State
  const [transferType, setTransferType] = useState("STORE_TO_DEPT");
  const [form, setForm] = useState({
    date: today(),
    from_location: "Store",
    to_location: DEPARTMENTS[0],
    initiated_by: "",
    remarks: "",
  });
  const [lineItems, setLineItems] = useState([{ ...emptyItem }]);

  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.transfers.list);

  const loadTransfers = useCallback((overrides = {}) => {
    fetch({
      limit: LIMIT,
      sort: "date",
      order: "desc",
      status: statusFilter || undefined,
      transfer_type: typeFilter || undefined,
      ...overrides,
    });
  }, [fetch, statusFilter, typeFilter]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.transfers.summary();
      if (res.success) setSummary(res.data);
    } catch {
      // Fallback
    }
  }, []);

  const loadCatalog = useCallback(async (location) => {
    try {
      const res = await api.transfers.availableStock({ from_location: location });
      if (res.success) setCatalog(res.data || []);
    } catch {
      setCatalog([]);
    }
  }, []);

  useEffect(() => {
    loadTransfers();
    loadSummary();
    loadCatalog("Store");
  }, [loadTransfers, loadSummary, loadCatalog]);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 3500);
  };

  const handleArchetypeSelect = (type) => {
    setTransferType(type);
    if (type === "STORE_TO_DEPT") {
      setForm((p) => ({ ...p, from_location: "Store", to_location: DEPARTMENTS[0] }));
      loadCatalog("Store");
    } else if (type === "DEPT_TO_DEPT") {
      setForm((p) => ({ ...p, from_location: DEPARTMENTS[0], to_location: DEPARTMENTS[1] }));
      loadCatalog(DEPARTMENTS[0]);
    } else if (type === "DEPT_TO_STORE") {
      setForm((p) => ({ ...p, from_location: DEPARTMENTS[0], to_location: "Store" }));
      loadCatalog(DEPARTMENTS[0]);
    }
    setLineItems([{ ...emptyItem }]);
  };

  // ── Line Items Updates ──────────────────────────────────────
  const updateLine = (idx, key, val) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };

      if (key === "name") {
        const match = catalog.find((c) => c.name.toLowerCase() === val.toLowerCase()) ||
                      stocks.find((s) => s.name.toLowerCase() === val.toLowerCase());
        if (match) {
          next[idx].item_code = match.item_code;
          next[idx].unit = match.unit || next[idx].unit;
          next[idx].unit_price = parseFloat(match.avg_unit_price || match.price || 0);
          next[idx].rack = match.rack || "";
          next[idx].available = match.available_qty != null ? parseFloat(match.available_qty) : (match.remaining != null ? parseFloat(match.remaining) : null);
        }
      }
      return next;
    });
  };

  const addLine = () => setLineItems((p) => [...p, { ...emptyItem }]);
  const removeLine = (idx) => setLineItems((p) => p.filter((_, i) => i !== idx));

  // ── Submit New Transfer ─────────────────────────────────────
  const submitTransfer = async () => {
    if (form.from_location === form.to_location) {
      return flash("Source and Destination locations must be different.", COLORS.coral);
    }
    const valid = lineItems.filter((it) => it.name && parseFloat(it.qty) > 0);
    if (valid.length === 0) {
      return flash("Add at least one valid item with quantity greater than zero.", COLORS.coral);
    }

    // Overdraft check if from Store
    if (form.from_location === "Store") {
      for (const it of valid) {
        if (it.available != null && parseFloat(it.qty) > it.available) {
          return flash(
            `Agent Routeur Error: Requested ${it.qty} ${it.unit} for '${it.name}' exceeds available on-hand stock (${it.available} ${it.unit}).`,
            COLORS.coral
          );
        }
      }
    }

    try {
      const payload = {
        date: form.date,
        from_location: form.from_location,
        to_location: form.to_location,
        initiated_by: form.initiated_by || undefined,
        remarks: form.remarks || undefined,
        items: valid.map((it) => ({
          item_code: it.item_code || it.name.toUpperCase().replace(/\s+/g, "-").slice(0, 20),
          name: it.name,
          qty: parseFloat(it.qty),
          unit: it.unit,
          batch_no: it.batch_no || undefined,
          unit_price: parseFloat(it.unit_price) || 0,
          rack: it.rack || undefined,
        })),
      };

      const res = await api.transfers.create(payload);
      flash(`Transfer ${res.data.transfer_number} dispatched ✓ — Delivery Challan ready.`);
      setForm({ date: today(), from_location: "Store", to_location: DEPARTMENTS[0], initiated_by: "", remarks: "" });
      setLineItems([{ ...emptyItem }]);
      setView("list");
      loadTransfers({ page: 1 });
      loadSummary();
    } catch (e) {
      flash(e.message || "Failed to create transfer.", COLORS.coral);
    }
  };

  // ── Open Detail ─────────────────────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await api.transfers.getOne(id);
      setDetail(res.data);
      setView("detail");
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  // ── Confirm Receipt Handshake ───────────────────────────────
  const handleAcknowledgeConfirm = async (payload) => {
    try {
      const res = await api.transfers.accept(ackTransfer.id, payload);
      flash(`Transfer ${res.data.transfer_number} accepted & ledger posted ✓`);
      setAckTransfer(null);
      if (detail && detail.id === ackTransfer.id) {
        setDetail(res.data);
      }
      loadTransfers({ page: 1 });
      loadSummary();
    } catch (e) {
      throw e;
    }
  };

  const rejectTransfer = async (id) => {
    const reason = prompt("Enter reason for rejecting this transfer:");
    if (reason === null) return;
    try {
      await api.transfers.reject(id, { remarks: reason });
      flash("Transfer rejected.");
      loadTransfers({ page: 1 });
      loadSummary();
      if (detail && detail.id === id) {
        openDetail(id);
      }
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  const deleteTransfer = async (id) => {
    if (!confirm("Are you sure you want to delete this pending transfer?")) return;
    try {
      await api.transfers.remove(id);
      flash("Transfer deleted.");
      setView("list");
      loadTransfers({ page: 1 });
      loadSummary();
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  const calculatedTotalValue = lineItems.reduce(
    (sum, it) => sum + ((parseFloat(it.qty) || 0) * (parseFloat(it.unit_price) || 0)),
    0
  );

  // ────────────────────────────────────────────────────────────
  // DETAIL VIEW
  // ────────────────────────────────────────────────────────────
  if (view === "detail" && detail) {
    const totalVal = (detail.items || []).reduce(
      (sum, it) => sum + (parseFloat(it.total_value) || (parseFloat(it.qty) * (parseFloat(it.unit_price) || 0))),
      0
    );

    const badge = STATUS_BADGES[detail.status] || STATUS_BADGES.Pending;

    return (
      <Section
        title={`Stock Transfer — ${detail.transfer_number}`}
        sub={`${detail.from_location} ➔ ${detail.to_location} · Dispatched on ${detail.date}`}
      >
        <TransferAgentStatusBar telemetry={summary?.agents_telemetry} />

        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              background: badge.bg,
              color: badge.text,
              border: `1px solid ${badge.border}`,
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {badge.label}
          </span>

          <span
            style={{
              background: "rgba(20, 184, 166, 0.15)",
              color: COLORS.teal,
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {detail.transfer_type || "STORE_TO_DEPT"}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn small onClick={() => setChallanTransfer(detail)}>
              <Printer size={13} style={{ marginRight: 5 }} /> Delivery Challan
            </Btn>

            {detail.status === "Pending" && (
              <>
                <Btn small onClick={() => setAckTransfer(detail)}>
                  <ShieldCheck size={13} style={{ marginRight: 5 }} /> Receive & Acknowledge
                </Btn>
                <Btn small variant="danger" onClick={() => rejectTransfer(detail.id)}>
                  Reject
                </Btn>
                <Btn small variant="ghost" onClick={() => deleteTransfer(detail.id)}>
                  Delete
                </Btn>
              </>
            )}

            <Btn small variant="ghost" onClick={() => setView("list")}>
              ← Back to List
            </Btn>
          </div>
        </div>

        {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 12 }}>{msg.text}</p>}

        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <div>
              <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Source Location
              </span>
              <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 700, color: COLORS.gold || COLORS.accent }}>
                {detail.from_location}
              </p>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>By: {detail.initiated_by || "—"}</span>
            </div>

            <div>
              <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Destination Location
              </span>
              <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 700, color: COLORS.teal }}>
                {detail.to_location}
              </p>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>Accepted By: {detail.accepted_by || "—"}</span>
            </div>

            <div>
              <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Transfer Valuation
              </span>
              <p style={{ margin: "4px 0 0 0", fontSize: 16, fontWeight: 800, color: COLORS.accent }}>
                ₹{totalVal.toFixed(2)}
              </p>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>Agent Valuator Evaluation</span>
            </div>

            <div>
              <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Transit Handshake Status
              </span>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, fontWeight: 700, color: detail.transit_status === "PARTIAL" ? COLORS.coral : COLORS.text }}>
                {detail.transit_status || "DISPATCHED"}
              </p>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                {detail.received_at ? `Received: ${new Date(detail.received_at).toLocaleTimeString()}` : "In-Transit"}
              </span>
            </div>
          </div>

          {detail.remarks && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: COLORS.textMuted }}>Remarks / Reason: </span>
              <span style={{ color: COLORS.text }}>{detail.remarks}</span>
            </div>
          )}

          {detail.rejection_reason && (
            <div style={{ marginTop: 10, padding: 10, background: "rgba(239, 68, 68, 0.12)", border: `1px solid ${COLORS.coral}`, borderRadius: 6, fontSize: 12, color: COLORS.coral }}>
              <strong>Rejection Reason:</strong> {detail.rejection_reason}
            </div>
          )}
        </Card>

        {/* Itemized Table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                {["Item Name", "Item Code", "Dispatched", "Received Qty", "Variance", "Unit Rate", "Total (₹)", "Condition"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: COLORS.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(detail.items || []).map((it) => {
                const variance = Math.max(0, it.qty - (it.received_qty != null ? it.received_qty : it.qty));
                return (
                  <tr key={it.id} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: COLORS.text }}>
                      {it.name}
                      {it.batch_no && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: COLORS.purple, fontFamily: "monospace" }}>
                          ({it.batch_no})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", fontFamily: "monospace", color: COLORS.teal, fontSize: 11 }}>
                      {it.item_code}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: COLORS.accent }}>
                      {it.qty} {it.unit}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: it.received_qty != null && it.received_qty < it.qty ? COLORS.coral : COLORS.success }}>
                      {it.received_qty != null ? `${it.received_qty} ${it.unit}` : `${it.qty} ${it.unit}`}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: variance > 0 ? COLORS.coral : COLORS.textMuted }}>
                      {variance > 0 ? `-${variance.toFixed(2)} ${it.unit}` : "0.00"}
                    </td>
                    <td style={{ padding: "12px 14px", color: COLORS.textMuted }}>
                      ₹{(parseFloat(it.unit_price) || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: COLORS.text }}>
                      ₹{(parseFloat(it.total_value) || (it.qty * (it.unit_price || 0))).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          background: it.condition_status === "Good" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: it.condition_status === "Good" ? COLORS.success : COLORS.coral,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {it.condition_status || "Good"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {challanTransfer && (
          <TransferChallanModal transfer={challanTransfer} onClose={() => setChallanTransfer(null)} />
        )}
        {ackTransfer && (
          <AcknowledgeTransferModal transfer={ackTransfer} onConfirm={handleAcknowledgeConfirm} onClose={() => setAckTransfer(null)} />
        )}
      </Section>
    );
  }

  // ────────────────────────────────────────────────────────────
  // CREATE TRANSFER VIEW
  // ────────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <Section title="Initiate Stock Transfer" sub="Multi-Agent non-overdraft logistics dispatcher">
        <TransferAgentStatusBar telemetry={summary?.agents_telemetry} />

        <Card style={{ maxWidth: 900 }}>
          {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 14 }}>{msg.text}</p>}

          {/* Archetype Selector */}
          <div style={{ marginBottom: 18 }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, display: "block", marginBottom: 8 }}>
              Select Transfer Route Archetype
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { id: "STORE_TO_DEPT", label: "Store ➔ Kitchen", sub: "Stock Distribution to Dept" },
                { id: "DEPT_TO_DEPT",  label: "Kitchen ➔ Kitchen", sub: "Inter-Kitchen Borrowing" },
                { id: "DEPT_TO_STORE", label: "Kitchen ➔ Store", sub: "Surplus Material Return" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleArchetypeSelect(t.id)}
                  style={{
                    padding: "10px 14px",
                    background: transferType === t.id ? "rgba(232, 168, 56, 0.15)" : COLORS.surface,
                    border: `1.5px solid ${transferType === t.id ? COLORS.accent : COLORS.border}`,
                    borderRadius: 8,
                    textAlign: "left",
                    cursor: "pointer",
                    color: COLORS.text,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: transferType === t.id ? COLORS.accent : COLORS.text }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 2 }}>{t.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Form Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
            <Input label="Transfer Date" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />

            <div>
              <label style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
                From (Source Location) *
              </label>
              <select
                value={form.from_location}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((p) => ({ ...p, from_location: val, to_location: p.to_location === val ? LOCATIONS.find(l => l !== val) : p.to_location }));
                  loadCatalog(val);
                }}
                style={{ width: "100%", padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 13 }}
              >
                {transferType === "STORE_TO_DEPT" ? (
                  <option value="Store">Store (Central Inventory)</option>
                ) : (
                  DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)
                )}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
                To (Destination) *
              </label>
              <select
                value={form.to_location}
                onChange={(e) => setForm((p) => ({ ...p, to_location: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 13 }}
              >
                {transferType === "DEPT_TO_STORE" ? (
                  <option value="Store">Store (Central Inventory)</option>
                ) : (
                  DEPARTMENTS.filter((d) => d !== form.from_location).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))
                )}
              </select>
            </div>

            <Input
              label="Initiated By / Officer"
              value={form.initiated_by}
              onChange={(e) => setForm((p) => ({ ...p, initiated_by: e.target.value }))}
              placeholder="e.g. Head Chef / Storekeeper"
            />

            <div style={{ gridColumn: "2 / -1" }}>
              <label style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>
                Remarks / Business Justification
              </label>
              <input
                value={form.remarks}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                placeholder="Reason for transfer (Daily Prep, Emergency Borrowing, Surplus Return…)"
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "8px 12px", width: "100%", fontSize: 13 }}
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
              Items to Transfer (Agent Routeur Live Balance Validation)
            </span>
            <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 700 }}>
              Estimated Total: ₹{calculatedTotalValue.toFixed(2)}
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                {["Item Name", "SKU", "On-Hand Stock", "Transfer Qty", "Unit", "Unit Rate (₹)", "Batch / Rack", ""].map((h) => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: "left", color: COLORS.textMuted, fontWeight: 600, fontSize: 10.5, textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, idx) => {
                const isOverdraft = it.available != null && parseFloat(it.qty) > it.available;
                return (
                  <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        list="transfer-catalog-list"
                        value={it.name}
                        onChange={(e) => updateLine(idx, "name", e.target.value)}
                        placeholder="Search item name…"
                        style={{
                          background: COLORS.bg,
                          border: `1px solid ${COLORS.border}`,
                          color: COLORS.text,
                          borderRadius: 4,
                          padding: "6px 8px",
                          fontSize: 12,
                          width: 170,
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        value={it.item_code}
                        onChange={(e) => updateLine(idx, "item_code", e.target.value)}
                        placeholder="KPL-###"
                        style={{
                          background: COLORS.bg,
                          border: `1px solid ${COLORS.border}`,
                          color: COLORS.teal,
                          borderRadius: 4,
                          padding: "6px 8px",
                          fontSize: 11,
                          width: 85,
                          fontFamily: "monospace",
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {it.available != null ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: isOverdraft ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: isOverdraft ? COLORS.coral : COLORS.success,
                          }}
                        >
                          {it.available} {it.unit}
                        </span>
                      ) : (
                        <span style={{ color: COLORS.textMuted, fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={it.qty}
                        onChange={(e) => updateLine(idx, "qty", e.target.value)}
                        style={{
                          background: COLORS.bg,
                          border: `1px solid ${isOverdraft ? COLORS.coral : COLORS.border}`,
                          color: isOverdraft ? COLORS.coral : COLORS.text,
                          borderRadius: 4,
                          padding: "6px 8px",
                          fontSize: 12,
                          fontWeight: 700,
                          width: 80,
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <select
                        value={it.unit}
                        onChange={(e) => updateLine(idx, "unit", e.target.value)}
                        style={{
                          background: COLORS.bg,
                          border: `1px solid ${COLORS.border}`,
                          color: COLORS.text,
                          borderRadius: 4,
                          padding: "6px 8px",
                          fontSize: 11,
                          width: 65,
                        }}
                      >
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.unit_price}
                        onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                        placeholder="₹0.00"
                        style={{
                          background: COLORS.bg,
                          border: `1px solid ${COLORS.border}`,
                          color: COLORS.text,
                          borderRadius: 4,
                          padding: "6px 8px",
                          fontSize: 11,
                          width: 70,
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input
                        value={it.batch_no}
                        onChange={(e) => updateLine(idx, "batch_no", e.target.value)}
                        placeholder="Batch/Rack"
                        style={{
                          background: COLORS.bg,
                          border: `1px solid ${COLORS.border}`,
                          color: COLORS.purple,
                          borderRadius: 4,
                          padding: "6px 8px",
                          fontSize: 11,
                          width: 90,
                          fontFamily: "monospace",
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {lineItems.length > 1 && (
                        <Btn small variant="danger" onClick={() => removeLine(idx)}>✕</Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <datalist id="transfer-catalog-list">
            {catalog.map((c, i) => (
              <option key={i} value={c.name}>
                {c.item_code} · {c.available_qty} {c.unit} on-hand {c.rack ? `[Rack ${c.rack}]` : ""}
              </option>
            ))}
          </datalist>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn small variant="ghost" onClick={addLine}>+ Add Item</Btn>
            <div style={{ flex: 1 }} />
            <Btn onClick={submitTransfer}>Initiate Transfer & Generate Challan</Btn>
            <Btn variant="ghost" onClick={() => setView("list")}>Cancel</Btn>
          </div>
        </Card>
      </Section>
    );
  }

  // ────────────────────────────────────────────────────────────
  // LIST VIEW (DEFAULT)
  // ────────────────────────────────────────────────────────────
  return (
    <Section title="Stock Transfers" sub="Multi-Agent inter-departmental logistics & double-entry tracking">
      <TransferAgentStatusBar telemetry={summary?.agents_telemetry} />

      {/* KPI Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Card style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              In-Transit Active
            </span>
            <Clock size={16} color={COLORS.accent} />
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: 22, fontWeight: 800, color: COLORS.accent }}>
            {summary?.in_transit_count || 0}
          </p>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Awaiting Handshake</span>
        </Card>

        <Card style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Today's Dispatched
            </span>
            <ArrowRight size={16} color={COLORS.teal} />
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: 22, fontWeight: 800, color: COLORS.teal }}>
            ₹{(summary?.today_valuation || 0).toFixed(2)}
          </p>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Agent Valuator Total</span>
        </Card>

        <Card style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              MTD Received & Posted
            </span>
            <CheckCircle2 size={16} color={COLORS.success} />
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: 22, fontWeight: 800, color: COLORS.text }}>
            ₹{(summary?.mtd_accepted_valuation || 0).toFixed(2)}
          </p>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Double-Entry Ledger Verified</span>
        </Card>

        <Card style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Discrepancies / Variances
            </span>
            <AlertTriangle size={16} color={COLORS.coral} />
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: 22, fontWeight: 800, color: COLORS.coral }}>
            {summary?.discrepancies_count || 0}
          </p>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Transit Loss Logs</span>
        </Card>
      </div>

      {/* Tabs & Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: COLORS.surface, padding: 3, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
          <button
            type="button"
            onClick={() => setActiveTab("transfers")}
            style={{
              padding: "6px 14px",
              background: activeTab === "transfers" ? COLORS.accent : "transparent",
              color: activeTab === "transfers" ? "#111" : COLORS.text,
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            All Transfers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            style={{
              padding: "6px 14px",
              background: activeTab === "matrix" ? COLORS.accent : "transparent",
              color: activeTab === "matrix" ? "#111" : COLORS.text,
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Inter-Dept Flow Matrix
          </button>
        </div>

        {activeTab === "transfers" && (
          <>
            <SearchBar onSearch={(v) => loadTransfers({ page: 1, q: v })} placeholder="Search TRF# or SKU…" />

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                loadTransfers({ page: 1, status: e.target.value || undefined });
              }}
              style={{ padding: "7px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 12 }}
            >
              <option value="">All Statuses</option>
              {["Pending", "Accepted", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                loadTransfers({ page: 1, transfer_type: e.target.value || undefined });
              }}
              style={{ padding: "7px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 12 }}
            >
              <option value="">All Types</option>
              <option value="STORE_TO_DEPT">Store ➔ Dept</option>
              <option value="DEPT_TO_DEPT">Dept ➔ Dept</option>
              <option value="DEPT_TO_STORE">Dept ➔ Store</option>
            </select>
          </>
        )}

        <div style={{ marginLeft: "auto" }}>
          <Btn onClick={() => setView("create")}>
            <Plus size={14} style={{ marginRight: 4 }} /> Initiate Transfer
          </Btn>
        </div>
      </div>

      {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 10 }}>{msg.text}</p>}

      {activeTab === "matrix" ? (
        <InterDeptCostMatrix summary={summary} />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <p style={{ color: COLORS.textMuted, textAlign: "center", padding: 32 }}>Loading transfers…</p>
          ) : error ? (
            <ErrorMsg error={error} />
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <ArrowLeftRight size={32} color={COLORS.textMuted} style={{ marginBottom: 10 }} />
              <p style={{ color: COLORS.textMuted, margin: 0, fontSize: 13 }}>No transfers found matching filters.</p>
            </div>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                    {["Transfer #", "Date", "Route", "Items", "Valuation (₹)", "Status", "Handshake", ""].map((h) => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", color: COLORS.textMuted, fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const badge = STATUS_BADGES[t.status] || STATUS_BADGES.Pending;
                    return (
                      <tr
                        key={t.id}
                        style={{ borderBottom: `1px solid ${COLORS.border}22`, cursor: "pointer" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => openDetail(t.id)}
                      >
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", color: COLORS.teal, fontWeight: 700 }}>
                          {t.transfer_number}
                        </td>
                        <td style={{ padding: "12px 16px", color: COLORS.textMuted, fontSize: 12 }}>
                          {t.date}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontWeight: 600, color: t.from_location === "Store" ? COLORS.gold || COLORS.accent : COLORS.text }}>
                              {t.from_location}
                            </span>
                            <ArrowRight size={12} color={COLORS.textMuted} />
                            <span style={{ fontWeight: 600, color: t.to_location === "Store" ? COLORS.gold || COLORS.accent : COLORS.teal }}>
                              {t.to_location}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontWeight: 600, color: COLORS.text }}>
                            {t.items_count || 1} item{t.items_count > 1 ? "s" : ""}
                          </span>
                          {t.items_summary && (
                            <div style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.items_summary}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: COLORS.accent }}>
                          ₹{(parseFloat(t.total_value) || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {t.status === "Pending" ? (
                            <Btn
                              small
                              onClick={(e) => {
                                e.stopPropagation();
                                setAckTransfer(t);
                              }}
                            >
                              Receive ✓
                            </Btn>
                          ) : (
                            <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                              {t.accepted_by || "Verified"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            type="button"
                            title="Print Delivery Challan"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChallanTransfer(t);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: COLORS.textMuted,
                              cursor: "pointer",
                              padding: 4,
                              marginRight: 6,
                            }}
                          >
                            <Printer size={15} />
                          </button>
                          <Btn
                            small
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(t.id);
                            }}
                          >
                            View →
                          </Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => loadTransfers({ page: p })} />
            </>
          )}
        </Card>
      )}

      {challanTransfer && (
        <TransferChallanModal transfer={challanTransfer} onClose={() => setChallanTransfer(null)} />
      )}
      {ackTransfer && (
        <AcknowledgeTransferModal transfer={ackTransfer} onConfirm={handleAcknowledgeConfirm} onClose={() => setAckTransfer(null)} />
      )}
    </Section>
  );
}
