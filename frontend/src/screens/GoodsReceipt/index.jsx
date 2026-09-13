import React, { useState, useEffect, Fragment } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS, UNITS } from "../../styles/colors";
import { getCompatibleUnits, areUnitsCompatible } from "../../utils/units";
import { usePaginatedApi } from "../../hooks/useApi";
import { useAppContext } from "../../context/AppContext";
import * as api from "../../api";
import SupplierDocUpload from "./SupplierDocUpload";
import PrintGRNModal from "./PrintGRNModal";
import P2PAgentStatusBar from "../../components/agents/P2PAgentStatusBar";
import { Printer, CheckCheck, AlertTriangle } from "lucide-react";

const LIMIT = 20;
import { today } from "../../utils/dates";
const emptyItem = { item_code: "", name: "", qty_ordered: "", qty_received: "", qty_accepted: "", qty_rejected: "0", unit: UNITS[0], unit_price: "", landed_cost: "", batch_no: "", expiry_date: "", discrepancy_reason: "" };

export default function GoodsReceiptScreen() {
  const { stocks, refreshStockNames, grnPreFill, setGrnPreFill } = useAppContext();
  const [view, setView]         = useState("list"); // "list" | "create" | "detail"
  const [detail, setDetail]     = useState(null);
  const [supplierList, setSupplierList] = useState([]);
  const [poList, setPoList]     = useState([]);
  const [msg, setMsg]           = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Form
  const [form, setForm]         = useState({ po_id: "", supplier_id: "", date: today(), invoice_no: "", received_by: "", remarks: "" });
  const [lineItems, setLineItems] = useState([{ ...emptyItem }]);

  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.grn.list);

  const load = (overrides = {}) => fetch({ limit: LIMIT, sort: "date", order: "desc", ...overrides });

  useEffect(() => { load(); }, []);

  useEffect(() => {
    api.suppliers.list({ limit: 200, sort: "name", order: "asc" })
      .then((r) => setSupplierList(r.data || [])).catch(() => {});
  }, []);

  // Load POs for supplier when supplier changes
  useEffect(() => {
    if (!form.supplier_id) { setPoList([]); return; }
    api.purchaseOrders.list({ supplier_id: form.supplier_id, status: "Sent", limit: 100 })
      .then((r) => setPoList(r.data || [])).catch(() => {});
  }, [form.supplier_id]);

  // Pre-fill line items from PO when PO is selected
  useEffect(() => {
    if (!form.po_id) return;
    api.purchaseOrders.getOne(form.po_id).then((r) => {
      const poItems = (r.data.items || []).map((it) => ({
        item_code: it.item_code,
        name: it.name,
        qty_ordered: String(it.qty),
        qty_received: String(it.qty),
        qty_accepted: String(it.qty),
        qty_rejected: "0",
        unit: it.unit,
        unit_price: String(it.unit_price),
        landed_cost: String(it.qty * it.unit_price),
        batch_no: "",
        expiry_date: "",
        discrepancy_reason: "",
      }));
      setLineItems(poItems.length > 0 ? poItems : [{ ...emptyItem }]);
    }).catch(() => {});
  }, [form.po_id]);

  // Cross-module pipeline: Auto-populate GRN when routed from Purchase Orders
  useEffect(() => {
    if (grnPreFill) {
      setView("create");
      setForm((prev) => ({
        ...prev,
        supplier_id: grnPreFill.supplier_id ? grnPreFill.supplier_id.toString() : prev.supplier_id,
        po_id: grnPreFill.id ? grnPreFill.id.toString() : prev.po_id,
        remarks: grnPreFill.notes ? `Ref PO #${grnPreFill.po_number}: ${grnPreFill.notes}` : (prev.remarks || `Inward receipt for ${grnPreFill.po_number}`)
      }));
      if (grnPreFill.items && grnPreFill.items.length > 0) {
        const todayCode = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        const prefilled = grnPreFill.items.map((it, idx) => ({
          item_code: it.item_code || "",
          name: it.name || "",
          qty_ordered: String(it.qty || ""),
          qty_received: String(it.qty || ""),
          qty_accepted: String(it.qty || ""),
          qty_rejected: "0",
          unit: it.unit || UNITS[0],
          unit_price: String(it.unit_price || ""),
          landed_cost: String((parseFloat(it.qty || 0) * parseFloat(it.unit_price || 0)).toFixed(2)),
          batch_no: `BAT-${todayCode}-${String(idx + 1).padStart(2, "0")}`,
          expiry_date: "",
          discrepancy_reason: ""
        }));
        setLineItems(prefilled);
      }
      flash(`Receiving goods against PO ${grnPreFill.po_number} ✓`, COLORS.success);
      if (setGrnPreFill) setGrnPreFill(null);
    }
  }, [grnPreFill, setGrnPreFill]);

  const matchAllOrdered = () => {
    setLineItems((prev) =>
      prev.map((it) => {
        const ord = it.qty_ordered || it.qty_received || "0";
        const price = parseFloat(it.unit_price) || 0;
        return {
          ...it,
          qty_received: ord,
          qty_accepted: ord,
          qty_rejected: "0",
          landed_cost: (parseFloat(ord) * price).toFixed(2),
          discrepancy_reason: "",
        };
      })
    );
    flash("Matched all received quantities to ordered quantities ✓");
  };

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 3000);
  };

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  // ── Line item helpers ──────────────────────────────────
  const updateLine = (idx, key, val) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      // Auto-fill item_code
      if (key === "name") {
        const match = stocks.find((s) => s.name.toLowerCase() === val.toLowerCase());
        if (match) {
          next[idx].item_code = match.item_code;
          if (match.unit) next[idx].unit = match.unit;
          if (match.price && !next[idx].unit_price) next[idx].unit_price = String(match.price);
        }
      }
      // Auto-compute landed_cost when qty_accepted or unit_price changes
      if (key === "qty_accepted" || key === "unit_price") {
        const qty = key === "qty_accepted" ? parseFloat(val) || 0 : parseFloat(next[idx].qty_accepted) || 0;
        const price = key === "unit_price" ? parseFloat(val) || 0 : parseFloat(next[idx].unit_price) || 0;
        next[idx].landed_cost = (qty * price).toFixed(2);
      }
      // Auto-compute qty_rejected
      if (key === "qty_received" || key === "qty_accepted") {
        const rcv = key === "qty_received" ? parseFloat(val) || 0 : parseFloat(next[idx].qty_received) || 0;
        const acc = key === "qty_accepted" ? parseFloat(val) || 0 : parseFloat(next[idx].qty_accepted) || 0;
        next[idx].qty_rejected = String(Math.max(0, rcv - acc));
      }
      return next;
    });
  };
  const addLine    = () => setLineItems((p) => [...p, { ...emptyItem }]);
  const removeLine = (idx) => setLineItems((p) => p.filter((_, i) => i !== idx));

  const grandTotal = lineItems.reduce((s, it) => s + (parseFloat(it.landed_cost) || 0), 0);

  // ── Submit ─────────────────────────────────────────────
  const submit = async () => {
    if (!form.supplier_id) return flash("Please select a supplier.", COLORS.coral);
    const validLines = lineItems.filter((it) => it.name && it.qty_received && it.qty_accepted);
    if (validLines.length === 0) return flash("Add at least one item with received & accepted qty.", COLORS.coral);

    const hasUnexplainedDiscrepancy = validLines.some((it) => {
       const ordered = parseFloat(it.qty_ordered);
       const received = parseFloat(it.qty_received);
       if (!isNaN(ordered) && received !== ordered && !(it.discrepancy_reason || "").trim()) {
         return true;
       }
       return false;
    });

    if (hasUnexplainedDiscrepancy) {
      return flash("Please provide a reason for all quantity discrepancies.", COLORS.coral);
    }

    const hasIncompatibleUnit = validLines.some((it) => {
      const match = stocks.find((s) => s.name && s.name.toLowerCase() === it.name.toLowerCase());
      return match?.unit && !areUnitsCompatible(it.unit, match.unit, it.name);
    });
    if (hasIncompatibleUnit) {
      return flash("Cannot accept items with dimensionally incompatible units against warehouse stock.", COLORS.coral);
    }

    try {
      const payload = {
        po_id: form.po_id ? parseInt(form.po_id) : null,
        supplier_id: parseInt(form.supplier_id),
        date: form.date,
        invoice_no: form.invoice_no || null,
        received_by: form.received_by || null,
        remarks: form.remarks || null,
        items: validLines.map((it) => ({
          item_code: it.item_code || it.name.toUpperCase().replace(/\s+/g, "-").slice(0, 20),
          name: it.name,
          qty_ordered: it.qty_ordered ? parseFloat(it.qty_ordered) : null,
          qty_received: parseFloat(it.qty_received),
          qty_accepted: parseFloat(it.qty_accepted),
          qty_rejected: parseFloat(it.qty_rejected) || 0,
          unit: it.unit,
          unit_price: parseFloat(it.unit_price) || 0,
          landed_cost: parseFloat(it.landed_cost) || 0,
          batch_no: it.batch_no || null,
          expiry_date: it.expiry_date || null,
        })),
      };
      await api.grn.create(payload);
      flash("GRN created — stock levels updated ✓");
      await refreshStockNames(); // Sync AppContext after new stock created
      setForm({ po_id: "", supplier_id: "", date: today(), invoice_no: "", received_by: "", remarks: "" });
      setLineItems([{ ...emptyItem }]);
      setView("list");
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  // ── Detail view ────────────────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await api.grn.getOne(id);
      setDetail(res.data);
      setView("detail");
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const deleteGRN = async (id) => {
    if (!confirm("Delete this GRN? Stock levels will be reversed!")) return;
    try {
      await api.grn.remove(id);
      flash("GRN deleted and stock reversed.");
      await refreshStockNames();
      setView("list");
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  // ──────────────────────────────────────────────────────
  // DETAIL VIEW
  // ──────────────────────────────────────────────────────
  if (view === "detail" && detail) {
    const totalRejected = (detail.items || []).reduce((s, it) => s + (it.qty_rejected || 0), 0);
    return (
      <Section title={`GRN — ${detail.grn_number}`} sub={`${detail.supplier_name} · ${detail.date}`}>
        {/* Swarm Telemetry */}
        <P2PAgentStatusBar activeModule="grn" />

        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          {detail.po_number && (
            <span style={{ background: COLORS.accent + "22", color: COLORS.accent, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
              PO: {detail.po_number}
            </span>
          )}
          {totalRejected > 0 && (
            <span style={{ background: COLORS.coral + "22", color: COLORS.coral, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
              ⚠ {totalRejected} units rejected
            </span>
          )}
          <span style={{ color: COLORS.muted, fontSize: 13 }}>₹{parseFloat(detail.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Btn small variant="ghost" onClick={() => setPrintModalOpen(true)} icon={<Printer size={13} />}>
              Print Receipt Note
            </Btn>
            <Btn small variant="danger" onClick={() => deleteGRN(detail.id)}>Delete GRN</Btn>
            <Btn small variant="ghost" onClick={() => setView("list")}>← Back</Btn>
          </div>
        </div>

        {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 10 }}>{msg.text}</p>}

        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
            {[
              ["Supplier", detail.supplier_name],
              ["Date", detail.date],
              ["Invoice No", detail.invoice_no || "—"],
              ["Received By", detail.received_by || "—"],
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
                {["Item", "Item Code", "Ordered", "Received", "Accepted", "Rejected", "Unit", "Unit Price", "Landed Cost", "Batch / Expiry"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(detail.items || []).map((it) => (
                <tr key={it.id} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                  <td style={{ padding: "10px 10px", color: COLORS.text, fontWeight: 500 }}>{it.name}</td>
                  <td style={{ padding: "10px 10px", fontFamily: "monospace", color: COLORS.teal, fontSize: 12 }}>{it.item_code}</td>
                  <td style={{ padding: "10px 10px", color: COLORS.muted }}>{it.qty_ordered ?? "—"}</td>
                  <td style={{ padding: "10px 10px", color: COLORS.text }}>{it.qty_received}</td>
                  <td style={{ padding: "10px 10px", color: COLORS.success, fontWeight: 600 }}>{it.qty_accepted}</td>
                  <td style={{ padding: "10px 10px", color: it.qty_rejected > 0 ? COLORS.coral : COLORS.muted, fontWeight: it.qty_rejected > 0 ? 600 : 400 }}>{it.qty_rejected}</td>
                  <td style={{ padding: "10px 10px", color: COLORS.muted }}>{it.unit}</td>
                  <td style={{ padding: "10px 10px", color: COLORS.text }}>₹{parseFloat(it.unit_price).toFixed(2)}</td>
                  <td style={{ padding: "10px 10px", color: COLORS.accent, fontWeight: 600 }}>₹{parseFloat(it.landed_cost).toFixed(2)}</td>
                  <td style={{ padding: "10px 10px" }}>
                    {it.batch_no && <span style={{ fontSize: 11, color: COLORS.purple }}>{it.batch_no}</span>}
                    {it.expiry_date && <span style={{ fontSize: 11, color: COLORS.coral, marginLeft: 6 }}>exp {it.expiry_date}</span>}
                    {!it.batch_no && !it.expiry_date && <span style={{ color: COLORS.muted }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <td colSpan={8} style={{ padding: "10px 10px", textAlign: "right", color: COLORS.muted, fontWeight: 600 }}>Grand Total (Landed)</td>
                <td colSpan={2} style={{ padding: "10px 10px", fontWeight: 700, color: COLORS.accent, fontSize: 15 }}>
                  ₹{parseFloat(detail.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>

        {/* Print GRN Modal */}
        <PrintGRNModal open={printModalOpen} onClose={() => setPrintModalOpen(false)} grn={detail} />
      </Section>
    );
  }

  // ──────────────────────────────────────────────────────
  // CREATE VIEW
  // ──────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <Section title="New Goods Receipt Note" sub="Record goods received — auto-updates stock on save">
        {/* Swarm Telemetry */}
        <P2PAgentStatusBar activeModule="grn" />

        <Card style={{ maxWidth: 960 }}>
          {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 12 }}>{msg.text}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Supplier *</label>
              <select value={form.supplier_id} onChange={f("supplier_id")}
                style={{ width: "100%", padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 13 }}>
                <option value="">— Select Supplier —</option>
                {supplierList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Link to PO (optional)</label>
              <select value={form.po_id} onChange={f("po_id")}
                style={{ width: "100%", padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 13 }}>
                <option value="">— No PO —</option>
                {poList.map((p) => <option key={p.id} value={p.id}>{p.po_number} · ₹{parseFloat(p.total_amount || 0).toFixed(0)}</option>)}
              </select>
            </div>
            <Input label="Receipt Date *" type="date" value={form.date} onChange={f("date")} />
            <Input label="Invoice Number" value={form.invoice_no} onChange={f("invoice_no")} placeholder="INV-12345" />
            <Input label="Received By" value={form.received_by} onChange={f("received_by")} placeholder="Storekeeper name" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Remarks</label>
            <textarea value={form.remarks} onChange={f("remarks")} rows={2} placeholder="Condition notes, damage, partial delivery…"
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "8px 12px", width: "100%", fontFamily: "'DM Sans',sans-serif", fontSize: 13, resize: "vertical" }} />
          </div>

          {/* Line Items */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Items Received
              {form.po_id && <span style={{ color: COLORS.accent, marginLeft: 8 }}>← pre-filled from PO</span>}
            </p>
            {lineItems.some((it) => it.qty_ordered) && (
              <Btn
                small
                variant="ghost"
                onClick={matchAllOrdered}
                icon={<CheckCheck size={12} />}
                style={{ fontSize: 11, padding: "3px 8px", color: COLORS.success, borderColor: COLORS.success + "66" }}
              >
                Match All Ordered
              </Btn>
            )}
          </div>
          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {["Name", "Code", "Ordered", "Received", "Accepted", "Rejected", "Unit", "Unit Price", "Landed Cost", "Batch No", "Expiry", ""].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((it, idx) => {
                  const hasRowDiscrepancy = it.qty_ordered && parseFloat(it.qty_received) !== parseFloat(it.qty_ordered);
                  return (
                  <Fragment key={idx}>
                  <tr style={{ borderBottom: hasRowDiscrepancy ? "none" : `1px solid ${COLORS.border}22` }}>
                    <td style={{ padding: "4px 6px" }}>
                      <input list="stock-names" value={it.name} onChange={(e) => updateLine(idx, "name", e.target.value)} placeholder="Item name"
                        style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "5px 7px", fontSize: 12, width: 130 }} />
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      <input value={it.item_code} onChange={(e) => updateLine(idx, "item_code", e.target.value)} placeholder="KPL-###"
                        style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.teal, borderRadius: 4, padding: "5px 7px", fontSize: 11, width: 80, fontFamily: "monospace" }} />
                    </td>
                    {["qty_ordered", "qty_received", "qty_accepted"].map((key) => {
                      const isReceived = key === "qty_received";
                      const hasDiscrepancy = isReceived && it.qty_ordered && parseFloat(it.qty_received) !== parseFloat(it.qty_ordered);
                      return (
                        <td key={key} style={{ padding: "4px 6px", position: "relative" }}>
                          <input type="number" min="0" step="any" value={it[key]} onChange={(e) => updateLine(idx, key, e.target.value)}
                            style={{ 
                              background: hasDiscrepancy ? COLORS.coral + "22" : COLORS.bg, 
                              border: `1px solid ${hasDiscrepancy ? COLORS.coral : COLORS.border}`, 
                              color: hasDiscrepancy ? COLORS.coral : COLORS.text, 
                              borderRadius: 4, padding: "5px 7px", fontSize: 12, width: 65 
                            }} />
                          {hasDiscrepancy && (
                            <span title="Quantity mismatch from PO" style={{ position: "absolute", right: 10, top: 12, fontSize: 10 }}>⚠️</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding: "4px 8px", color: parseFloat(it.qty_rejected) > 0 ? COLORS.coral : COLORS.muted, fontWeight: 600, fontSize: 12 }}>
                      {it.qty_rejected || 0}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      {(() => {
                        const match = stocks.find((s) => s.name && s.name.toLowerCase() === (it.name || "").toLowerCase());
                        const allowedUnits = match?.unit ? getCompatibleUnits(match.unit) : UNITS;
                        const isIncompatible = match?.unit && !areUnitsCompatible(it.unit, match.unit, it.name);

                        return (
                          <div>
                            <select value={it.unit} onChange={(e) => updateLine(idx, "unit", e.target.value)}
                              style={{
                                background: isIncompatible ? "#FEE2E2" : COLORS.bg,
                                border: `1px solid ${isIncompatible ? COLORS.coral : COLORS.border}`,
                                color: COLORS.text,
                                borderRadius: 4,
                                padding: "5px 7px",
                                fontSize: 12,
                                width: 65
                              }}>
                              {allowedUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                            {isIncompatible && (
                              <div style={{ fontSize: 9, color: COLORS.coral, marginTop: 2 }}>Stock is {match.unit}</div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      <input type="number" min="0" step="any" value={it.unit_price} onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                        style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "5px 7px", fontSize: 12, width: 80 }} />
                    </td>
                    <td style={{ padding: "4px 8px", color: COLORS.accent, fontWeight: 600, fontSize: 12 }}>₹{it.landed_cost || "0.00"}</td>
                    <td style={{ padding: "4px 6px" }}>
                      <input value={it.batch_no} onChange={(e) => updateLine(idx, "batch_no", e.target.value)} placeholder="BAT-…"
                        style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.purple, borderRadius: 4, padding: "5px 7px", fontSize: 11, width: 80, fontFamily: "monospace" }} />
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      <input type="date" value={it.expiry_date} onChange={(e) => updateLine(idx, "expiry_date", e.target.value)}
                        style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, padding: "5px 7px", fontSize: 11, width: 120 }} />
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      {lineItems.length > 1 && <Btn small variant="danger" onClick={() => removeLine(idx)}>✕</Btn>}
                    </td>
                  </tr>
                  {hasRowDiscrepancy && (
                    <tr style={{ borderBottom: `1px solid ${COLORS.border}22`, background: COLORS.coral + "0A" }}>
                      <td colSpan={12} style={{ padding: "8px 12px 12px 12px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 16 }}>⚠️</span>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: COLORS.coral, fontWeight: 600, display: "block", marginBottom: 4 }}>Reason for Discrepancy *</label>
                            <input 
                              value={it.discrepancy_reason || ""} 
                              onChange={(e) => updateLine(idx, "discrepancy_reason", e.target.value)} 
                              placeholder="Why does the received quantity differ from the PO?"
                              style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: `1px solid ${COLORS.coral}88`, borderRadius: 4, background: COLORS.bg, color: COLORS.text }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )})}
              </tbody>
            </table>
          </div>
          <datalist id="stock-names">
            {stocks.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0" }}>
            <Btn small variant="ghost" onClick={addLine}>+ Add Item</Btn>
            <p style={{ fontWeight: 700, color: COLORS.accent, fontSize: 15 }}>
              Landed Total: ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={submit} style={{ flex: 1 }}>Save GRN & Update Stock</Btn>
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
    <Section title="Goods Receipt Notes" sub="Track all goods received from suppliers — auto-batches stock">
      {/* Swarm Telemetry */}
      <P2PAgentStatusBar activeModule="grn" />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar onSearch={(v) => load({ page: 1, q: v })} placeholder="Search GRN#, supplier, invoice…" />
        <select onChange={(e) => load({ page: 1, supplier_id: e.target.value })}
          style={{ padding: "7px 10px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, fontSize: 12 }}>
          <option value="">All Suppliers</option>
          {supplierList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          <Btn onClick={() => setShowUploadModal(true)} style={{ background: COLORS.brand }}>
            ✨ Scan Delivery Doc (AI)
          </Btn>
          <Btn onClick={() => setView("create")}>+ New GRN</Btn>
        </div>
      </div>

      {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 10 }}>{msg.text}</p>}

      <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading…</p>
        ) : error ? (
          <ErrorMsg error={error} />
        ) : items.length === 0 ? (
          <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>No goods receipts yet. Create a GRN above.</p>
        ) : (
          <>
            <div className="resp-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    {["GRN Number", "Supplier", "PO Ref", "Date", "Invoice No", "Total", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g.id} style={{ borderBottom: `1px solid ${COLORS.border}22`, cursor: "pointer" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = COLORS.surface}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      onClick={() => openDetail(g.id)}>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", color: COLORS.teal, fontWeight: 600 }}>{g.grn_number}</td>
                      <td style={{ padding: "12px 16px", color: COLORS.text, fontWeight: 500 }}>{g.supplier_name}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {g.po_number
                          ? <span style={{ background: COLORS.accent + "22", color: COLORS.accent, padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>{g.po_number}</span>
                          : <span style={{ color: COLORS.muted }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: COLORS.muted }}>{new Date(g.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ padding: "12px 16px", color: COLORS.muted }}>{g.invoice_no || "—"}</td>
                      <td style={{ padding: "12px 16px", color: COLORS.accent, fontWeight: 600 }}>
                        ₹{parseFloat(g.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Btn small variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(g.id); }}>View →</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
              <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
            </div>
          </>
        )}
      </Card>

      {showUploadModal && (
        <SupplierDocUpload
          supplierList={supplierList}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            load({ page: 1 });
          }}
        />
      )}
    </Section>
  );
}
