import { useState, useEffect, useRef } from "react";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Pagination from "../../components/Pagination";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS, UNITS } from "../../styles/colors";
import { getCompatibleUnits, areUnitsCompatible } from "../../utils/units";
import { usePaginatedApi } from "../../hooks/useApi";
import { useAppContext } from "../../context/AppContext";
import { Plus, ArrowLeft, FileText, Truck, CheckCircle, XCircle, Clock, ChevronRight, Mic, FileImage, Loader, Camera, Scale, Share2, Copy, Printer, AlertTriangle } from "lucide-react";
import RateComparisonModal from "./RateComparisonModal";
import PrintPOModal from "./PrintPOModal";
import P2PAgentStatusBar from "../../components/agents/P2PAgentStatusBar";
import { PO_STATUS_CONFIG, PO_STATUSES } from "../../utils/poStatus";

const LIMIT = 20;
import { today } from "../../utils/dates";
import { useLocalSpeech } from "../../hooks/useLocalSpeech";

// Icons layered on top of the shared color config (utils/poStatus.js) — colors
// stay in one place so every screen's badge agrees; only the icon choice
// (a purely visual, screen-local flourish) lives here.
const STATUS_ICONS = {
  Draft: <Clock size={11} />,
  Pending: <Clock size={11} />,
  Approved: <CheckCircle size={11} />,
  Sent: <FileText size={11} />,
  Received: <CheckCircle size={11} />,
  Cancelled: <XCircle size={11} />,
  Rejected: <XCircle size={11} />,
};
const STATUS_CONFIG = Object.fromEntries(
  PO_STATUSES.map((s) => [s, { ...PO_STATUS_CONFIG[s], icon: STATUS_ICONS[s] }])
);

const emptyItem = { item_code: "", name: "", qty: "", unit: UNITS[0], unit_price: "" };

const fmt = (n) => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function PurchaseOrdersScreen() {
  const { stocks, setCurrentScreen, poPreFill, setPoPreFill, setGrnPreFill } = useAppContext();
  const [view, setView]         = useState("list"); // "list" | "create" | "detail"
  const [detail, setDetail]     = useState(null);
  const [supplierList, setSupplierList] = useState([]);
  const [msg, setMsg]           = useState("");
  const [filters, setFilters]   = useState({ status: "", supplier_id: "", q: "" });

  // Form state
  const [form, setForm]         = useState({ supplier_id: "", date: today(), notes: "" });
  const [lineItems, setLineItems] = useState([{ ...emptyItem }]);
  const [submitting, setSubmitting] = useState(false);
  const [ratesCache, setRatesCache] = useState({});

  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const [scanningBill, setScanningBill] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const { listening, interimText, startRecording, stopRecording } = useLocalSpeech();

  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.purchaseOrders.list);

  const load = (overrides = {}) =>
    fetch({ limit: LIMIT, sort: "date", order: "desc", ...filters, ...overrides });

  useEffect(() => { load(); }, []);

  useEffect(() => {
    api.suppliers.list({ limit: 200, sort: "name", order: "asc" })
      .then((r) => setSupplierList(r.data || []))
      .catch(() => {});
  }, []);

  // Cross-module pipeline: Auto-populate PO from Reorder Points or Suppliers screen
  useEffect(() => {
    if (poPreFill) {
      setView("create");
      if (poPreFill.supplier_id) {
        setForm((f) => ({
          ...f,
          supplier_id: poPreFill.supplier_id.toString(),
          notes: poPreFill.notes || f.notes || "Drafted from Reorder Sentinel"
        }));
      }
      if (poPreFill.items && poPreFill.items.length > 0) {
        setLineItems(
          poPreFill.items.map((it) => ({
            item_code: it.item_code || "",
            name: it.name || "",
            qty: it.qty?.toString() || "1",
            unit: it.unit || UNITS[0],
            unit_price: it.unit_price?.toString() || it.price?.toString() || ""
          }))
        );
      }
      setMsg({ text: "Auto-drafted PO from cross-module pipeline ✓", color: COLORS.accent });
      setTimeout(() => setMsg(""), 3500);
      if (setPoPreFill) setPoPreFill(null);
    }
  }, [poPreFill, setPoPreFill]);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 3000);
  };

  const handleScanBill = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanningBill(true);
    flash("Scanning bill with AI...", COLORS.brand);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      try {
        const res = await api.scan.purchase(base64, file.type || "image/jpeg");
        if (res.success && res.data) {
          const parsed = res.data;
          // Match supplier
          if (parsed.supplier) {
            const matched = supplierList.find(s => s.name?.toLowerCase().includes(parsed.supplier.toLowerCase()) || parsed.supplier.toLowerCase().includes(s.name?.toLowerCase()));
            if (matched) {
              setForm(f => ({ ...f, supplier_id: matched.id.toString() }));
              flash(`Bill scanned! Selected supplier: ${matched.name} ✓`);
            } else {
              flash(`Bill scanned! Supplier "${parsed.supplier}" not found in registered suppliers.`, COLORS.warning);
            }
          } else {
            flash("Bill scanned successfully ✓");
          }

          if (parsed.items && parsed.items.length) {
            const imported = parsed.items.map(it => {
              const match = stocks.find(s => s.name?.toLowerCase() === it.name?.toLowerCase());
              return {
                item_code: it.item_code || match?.item_code || "",
                name: it.name || "",
                qty: it.qty?.toString() || "1",
                unit: it.unit || match?.unit || "kg",
                unit_price: it.price?.toString() || match?.price?.toString() || ""
              };
            });
            setLineItems(imported);
          }
        } else {
          flash("Failed to parse bill contents.", COLORS.coral);
        }
      } catch (err) {
        flash("Scan error: " + err.message, COLORS.coral);
      } finally {
        setScanningBill(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const startListening = () => {
    if (listening) {
      stopRecording((status) => flash(status));
    } else {
      startRecording(
        (text) => {
          setImportText((prev) => (prev.trim() ? prev.trim() + "\n" + text : text));
          flash("Transcription complete ✓");
        },
        (status) => flash(status)
      );
    }
  };

  const parseImportText = async () => {
    if (!importText.trim()) return;
    flash("Parsing text list with AI...", COLORS.brand);
    try {
      const res = await api.scan.text(importText);
      if (res.success && res.data) {
         const parsed = res.data;
         // Match supplier
         if (parsed.supplier) {
           const matched = supplierList.find(s => s.name?.toLowerCase().includes(parsed.supplier.toLowerCase()) || parsed.supplier.toLowerCase().includes(s.name?.toLowerCase()));
           if (matched) {
             setForm(f => ({ ...f, supplier_id: matched.id.toString() }));
           } else {
             flash(`Supplier "${parsed.supplier}" not found.`, COLORS.warning);
           }
         }
         if (parsed.items && parsed.items.length) {
           const imported = parsed.items.map(it => {
             const match = stocks.find(s => s.name?.toLowerCase() === it.name?.toLowerCase());
             return {
               item_code: it.item_code || match?.item_code || "",
               name: it.name || "",
               qty: it.qty?.toString() || "1",
               unit: it.unit || match?.unit || "kg",
               unit_price: it.price?.toString() || match?.price?.toString() || ""
             };
           });
           setLineItems(imported);
           flash("Items imported successfully ✓");
           setShowVoicePanel(false);
           setImportText("");
         } else {
           flash("No items could be extracted.", COLORS.coral);
         }
      } else {
        flash("Failed to parse text.", COLORS.coral);
      }
    } catch (err) {
      flash("Parse error: " + err.message, COLORS.coral);
    }
  };

  // ── Line item helpers ──────────────────────────────────
  const updateLine = (idx, key, val) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      if (key === "name") {
        const match = stocks.find((s) => s.name.toLowerCase() === val.toLowerCase());
        if (match) {
          next[idx].item_code = match.item_code;
          if (match.unit) next[idx].unit = match.unit;
          if (match.price && !next[idx].unit_price) next[idx].unit_price = match.price;
        }

        if (val.trim()) {
          const itemKey = val.toLowerCase();
          if (!ratesCache[itemKey]) {
            api.stock.supplierRates(val)
              .then(res => {
                if (res && res.success && res.data) {
                  setRatesCache(prev => ({ ...prev, [itemKey]: res.data }));
                }
              })
              .catch(err => console.error("Error fetching supplier rates:", err));
          }
        }
      }
      return next;
    });
  };
  const addLine    = () => setLineItems((p) => [...p, { ...emptyItem }]);
  const removeLine = (idx) => setLineItems((p) => p.filter((_, i) => i !== idx));

  const lineTotal = (it) => {
    const q = parseFloat(it.qty) || 0;
    const p = parseFloat(it.unit_price) || 0;
    return (q * p).toFixed(2);
  };
  const grandTotal = lineItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.unit_price) || 0), 0);

  // ── Submit ─────────────────────────────────────────────
  const submit = async () => {
    if (!form.supplier_id) return flash("Please select a supplier.", COLORS.coral);
    const validLines = lineItems.filter((it) => it.name && it.qty && it.unit_price);
    if (validLines.length === 0) return flash("Add at least one item.", COLORS.coral);

    const hasIncompatibleUnit = validLines.some((it) => {
      const match = stocks.find((s) => s.name && s.name.toLowerCase() === it.name.toLowerCase());
      return match?.unit && !areUnitsCompatible(it.unit, match.unit, it.name);
    });
    if (hasIncompatibleUnit) {
      return flash("Please fix items with dimensionally incompatible units before submitting PO.", COLORS.coral);
    }
    setSubmitting(true);
    try {
      const payload = {
        supplier_id: parseInt(form.supplier_id),
        date: form.date,
        notes: form.notes || null,
        items: validLines.map((it) => ({
          item_code: it.item_code || it.name.toUpperCase().replace(/\s+/g, "-").slice(0, 20),
          name: it.name,
          qty: parseFloat(it.qty),
          unit: it.unit,
          unit_price: parseFloat(it.unit_price),
        })),
      };
      await api.purchaseOrders.create(payload);
      flash("Purchase Order created ✓");
      setForm({ supplier_id: "", date: today(), notes: "" });
      setLineItems([{ ...emptyItem }]);
      setView("list");
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
    setSubmitting(false);
  };

  const autoDraft = async () => {
    if (!form.supplier_id) return flash("Select a supplier for auto-draft.", COLORS.coral);
    try {
      const res = await api.purchaseOrders.autoDraft(parseInt(form.supplier_id), true);
      if (res.data && res.data.items && res.data.items.length > 0) {
        setLineItems(res.data.items.map(it => ({
          ...it,
          id: Date.now() + Math.random()
        })));
        flash(`Populated ${res.data.items.length} low stock items. Please review and submit.`);
      } else {
        flash("No low stock items found to reorder.");
      }
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  // ── Detail view ────────────────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await api.purchaseOrders.getOne(id);
      setDetail(res.data);
      setView("detail");
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.purchaseOrders.update(id, { status });
      const res = await api.purchaseOrders.getOne(id);
      setDetail(res.data);
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const deletePO = async (id) => {
    if (!confirm("Delete this PO? This cannot be undone.")) return;
    try {
      await api.purchaseOrders.remove(id);
      flash("PO deleted.");
      setView("list");
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const lowStockItems = stocks.filter((item) => {
    const pct = item.qty > 0 ? (item.remaining / item.qty) * 100 : 0;
    return item.min_alert_qty !== null ? item.remaining <= item.min_alert_qty : pct < 25;
  });

  const expiringSoonItems = stocks.filter((item) => {
    if (!item.expiry_date || item.remaining <= 0) return false;
    const todayVal = new Date(today());
    const expiryVal = new Date(item.expiry_date);
    const diffTime = expiryVal - todayVal;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  });

  const handleReorderClick = (item) => {
    const needed = item.min_alert_qty ? (item.min_alert_qty * 2) : 10;
    const newItem = {
      item_code: item.item_code,
      name: item.name,
      qty: needed,
      unit: item.unit || UNITS[0],
      unit_price: item.price || ""
    };
    setLineItems((prev) => {
      if (prev.length === 1 && !prev[0].name && !prev[0].qty) {
        return [newItem];
      }
      return [...prev, newItem];
    });
    flash(`Added ${item.name} to PO items ✓`);
  };

  const generateWhatsAppPO = () => {
    if (lowStockItems.length === 0) return;
    const header = "*KAPILA INVENTORY - PURCHASE ORDER*\n\nGenerated: " + today() + "\n\n";
    const itemsText = lowStockItems.map((item, idx) => {
      const needed = item.min_alert_qty ? (item.min_alert_qty * 2) : 10;
      return `${idx + 1}. *${item.name}* - Needs approx. ${needed} ${item.unit} (Current: ${parseFloat(item.remaining).toFixed(1)} ${item.unit})`;
    }).join("\n");
    const footer = "\n\nPlease check pricing and confirm delivery date.";
    window.open(`https://wa.me/?text=${encodeURIComponent(header + itemsText + footer)}`, "_blank");
  };

  const copyPOToClipboard = () => {
    if (lowStockItems.length === 0) return;
    const header = "*KAPILA INVENTORY - PURCHASE ORDER*\n\nGenerated: " + today() + "\n\n";
    const itemsText = lowStockItems.map((item, idx) => {
      const needed = item.min_alert_qty ? (item.min_alert_qty * 2) : 10;
      return `${idx + 1}. *${item.name}* - Needs approx. ${needed} ${item.unit} (Current: ${parseFloat(item.remaining).toFixed(1)} ${item.unit})`;
    }).join("\n");
    const footer = "\n\nPlease check pricing and confirm delivery date.";
    navigator.clipboard.writeText(header + itemsText + footer);
    flash("PO copied to clipboard ✓");
  };

  // ── Status badge ───────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const c = STATUS_CONFIG[status] || STATUS_CONFIG.Draft;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: c.bg, color: c.text,
        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600
      }}>
        {c.icon} {status}
      </span>
    );
  };

  const shareDetailViaWhatsApp = (po) => {
    const lines = (po.items || []).map(
      (it, idx) => `${idx + 1}. *${it.name}* (${it.qty} ${it.unit}) @ ₹${parseFloat(it.unit_price || 0).toFixed(2)} = ₹${parseFloat(it.total_price || 0).toFixed(2)}`
    ).join("\n");
    const text = `*HOTEL KAPILA — PURCHASE ORDER*\n*PO:* ${po.po_number}\n*Supplier:* ${po.supplier_name}\n*Date:* ${new Date(po.date).toLocaleDateString("en-IN")}\n----------------------------\n${lines}\n----------------------------\n*Grand Total: ₹${fmt(po.total_amount)}*\n${po.notes ? `*Notes:* ${po.notes}\n` : ""}\nAuthorized by Hotel Kapila Procurement`;
    const phone = po.supplier_phone ? po.supplier_phone.replace(/[^0-9]/g, "") : "";
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const copyDetailToClipboard = (po) => {
    const lines = (po.items || []).map(
      (it, idx) => `${idx + 1}. *${it.name}* (${it.qty} ${it.unit}) @ ₹${parseFloat(it.unit_price || 0).toFixed(2)} = ₹${parseFloat(it.total_price || 0).toFixed(2)}`
    ).join("\n");
    const text = `*HOTEL KAPILA — PURCHASE ORDER*\n*PO:* ${po.po_number}\n*Supplier:* ${po.supplier_name}\n*Date:* ${new Date(po.date).toLocaleDateString("en-IN")}\n----------------------------\n${lines}\n----------------------------\n*Grand Total: ₹${fmt(po.total_amount)}*\n${po.notes ? `*Notes:* ${po.notes}\n` : ""}\nAuthorized by Hotel Kapila Procurement`;
    navigator.clipboard.writeText(text);
    flash("Purchase Order copied to clipboard ✓");
  };

  // ── DETAIL VIEW ────────────────────────────────────────
  if (view === "detail" && detail) {
    const sc = STATUS_CONFIG[detail.status] || STATUS_CONFIG.Draft;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Swarm Telemetry */}
        <P2PAgentStatusBar activeModule="po" />

        {/* Detail Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: 16, flexWrap: "wrap", flexShrink: 0
        }}>
          <button
            onClick={() => setView("list")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: `1px solid ${COLORS.border}`,
              color: COLORS.muted, padding: "6px 12px", borderRadius: 8,
              fontSize: 13, cursor: "pointer"
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{detail.po_number}</h1>
            <p style={{ fontSize: 12, color: COLORS.muted }}>{detail.supplier_name} · {new Date(detail.date).toLocaleDateString()}</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge status={detail.status} />
            {detail.status === "Draft" && (
              <Btn small onClick={() => changeStatus(detail.id, "Pending")}>Submit for Approval</Btn>
            )}
            {detail.status === "Approved" && (
              <Btn small onClick={() => changeStatus(detail.id, "Sent")}>Mark Sent</Btn>
            )}
            {["Approved", "Sent"].includes(detail.status) && (
              <Btn
                small
                onClick={() => {
                  if (setGrnPreFill) setGrnPreFill(detail);
                  if (setCurrentScreen) setCurrentScreen("grn");
                }}
                style={{ background: COLORS.accent, color: "#18181b", fontWeight: 700 }}
              >
                Receive via GRN
              </Btn>
            )}
            <Btn small variant="ghost" onClick={() => shareDetailViaWhatsApp(detail)} icon={<Share2 size={13} />}>
              WhatsApp
            </Btn>
            <Btn small variant="ghost" onClick={() => copyDetailToClipboard(detail)} icon={<Copy size={13} />}>
              Copy PO
            </Btn>
            <Btn small variant="ghost" onClick={() => setPrintModalOpen(true)} icon={<Printer size={13} />}>
              Print / PDF
            </Btn>
            {["Draft", "Sent"].includes(detail.status) && (
              <Btn small variant="danger" onClick={() => deletePO(detail.id)}>Delete PO</Btn>
            )}
          </div>
        </div>

        {msg && <p style={{ color: msg.color, fontSize: 12, marginBottom: 10 }}>{msg.text}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, flexShrink: 0 }}>
          {[
            ["Supplier", detail.supplier_name],
            ["PO Date", new Date(detail.date).toLocaleDateString()],
            ["GSTIN", detail.supplier_gstin || "—"],
            ["Phone", detail.supplier_phone || "—"],
            ["Total Amount", `₹${fmt(detail.total_amount)}`],
            ["Notes", detail.notes || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{k}</p>
              <p style={{ color: COLORS.text, fontSize: 14, fontWeight: 500 }}>{v}</p>
            </div>
          ))}
        </div>

        <Card style={{ padding: 0, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, background: "#f8fafc", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Order Items
            </span>
          </div>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table>
              <thead>
                <tr>
                  {["Item Code", "Name", "Qty", "Unit", "Unit Price", "Total"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((it) => (
                  <tr key={it.id}>
                    <td style={{ fontFamily: "monospace", color: COLORS.brand, fontSize: 12 }}>{it.item_code}</td>
                    <td style={{ fontWeight: 500 }}>{it.name}</td>
                    <td>{it.qty}</td>
                    <td style={{ color: COLORS.muted }}>{it.unit}</td>
                    <td>₹{parseFloat(it.unit_price).toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: COLORS.accent }}>₹{parseFloat(it.total_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${COLORS.border}` }}>
                  <td colSpan={5} style={{ textAlign: "right", fontWeight: 600, color: COLORS.muted, padding: "12px 16px" }}>Grand Total</td>
                  <td style={{ fontWeight: 700, color: COLORS.accent, fontSize: 16, padding: "12px 16px" }}>
                    ₹{fmt(detail.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Print PO Modal */}
        <PrintPOModal open={printModalOpen} onClose={() => setPrintModalOpen(false)} po={detail} />
      </div>
    );
  }

  // ── DEFAULT VIEW (Combined Create & List) ──────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 20, overflowY: "auto", paddingRight: 4 }}>
      {/* Page Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.02em" }}>Purchase Orders</h1>
          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>Track POs from draft to delivery</p>
        </div>
      </div>

      {/* Swarm Telemetry */}
      <P2PAgentStatusBar activeModule="po" />

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      {/* New PO Form (covers full width) */}
      <Card style={{ padding: "20px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: COLORS.text }}>
            New Purchase Order
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setCompareOpen(true)} icon={<Scale size={16} />} style={{ fontSize: 13, fontWeight: "bold", padding: "8px 12px" }}>
              Compare Vendor Rates
            </Btn>
            <Btn variant="ghost" onClick={() => setShowVoicePanel(!showVoicePanel)} icon={<Mic size={16} />} style={{ fontSize: 13, fontWeight: "bold", padding: "8px 12px" }}>
              {showVoicePanel ? "Standard" : "Voice Input"}
            </Btn>
            <Btn variant="ghost" onClick={() => fileInputRef.current.click()} icon={scanningBill ? <Loader size={16} className="spin" /> : <FileImage size={16} />} style={{ fontSize: 13, fontWeight: "bold", padding: "8px 12px" }} disabled={scanningBill}>
              {scanningBill ? "Scanning…" : "Scan Doc"}
            </Btn>
            <Btn variant="ghost" onClick={() => cameraInputRef.current.click()} icon={scanningBill ? <Loader size={16} className="spin" /> : <Camera size={16} />} style={{ fontSize: 13, fontWeight: "bold", padding: "8px 12px" }} disabled={scanningBill}>
              {scanningBill ? "Scanning…" : "Scan using Camera"}
            </Btn>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleScanBill} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleScanBill} />
          </div>
        </div>

        {/* Voice dictation panel */}
        {showVoicePanel && (
          <div style={{
            background: "#f8fafc",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 20
          }}>
            <p style={{ fontSize: 13, color: COLORS.accent, fontWeight: 600, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 6 }}>
              <Mic size={14} /> Quick Dictate / Text Import
            </p>
            <p style={{ fontSize: 11, color: COLORS.muted, margin: "0 0 12px 0" }}>
              Type, paste item lists, or use voice dictation in Telugu, Hindi, English, and other local languages.
            </p>

            {(() => {
              const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              if (!isSecure) {
                return (
                  <div style={{
                    background: COLORS.coral + "15",
                    border: `1px solid ${COLORS.coral}33`,
                    borderRadius: 6,
                    padding: "8px 10px",
                    fontSize: 11,
                    color: COLORS.coral,
                    marginBottom: 12,
                    lineHeight: 1.3
                  }}>
                    ⚠️ <strong>Security Restriction:</strong> Web Speech recognition requires a secure context. Because this app is accessed over HTTP on a custom IP, your browser has blocked the microphone. Please open <strong>http://localhost:5173</strong> (or setup HTTPS) to enable dictation.
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={startListening}
                  style={{
                    padding: "7px 14px",
                    fontSize: 12,
                    background: listening ? COLORS.coral : COLORS.bg,
                    border: `1px solid ${listening ? COLORS.coral : COLORS.border}`,
                    color: listening ? "#fff" : COLORS.text,
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                    transition: "all 0.2s",
                    height: "33px"
                  }}
                >
                  {listening ? "🛑 Stop" : "🎤 Speak"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Pasted Text or Transcribed Voice</label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="e.g. Rice 50 kg rate 45&#10;Tomatoes 20 kg price 30&#10;Oil 15 liter"
                rows={4}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 12,
                  background: "#fff",
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  borderRadius: 6,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
              {interimText && (
                <div style={{ 
                  fontSize: 12, 
                  color: COLORS.accent, 
                  marginTop: 6, 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 6,
                  padding: "6px 10px",
                  background: COLORS.accent + "11",
                  border: `1px dashed ${COLORS.accent}44`,
                  borderRadius: 4
                }}>
                  <span style={{ fontSize: 10 }}>🎙️</span>
                  <span style={{ fontStyle: "italic" }}>Hearing: "{interimText}"...</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Btn small onClick={parseImportText} disabled={!importText.trim()} style={{ flex: 1 }}>Parse & Import</Btn>
              <Btn small variant="ghost" onClick={() => { setShowVoicePanel(false); setImportText(""); }} style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}>Cancel</Btn>
            </div>
          </div>
        )}
        
        {/* Header fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Supplier *
            </label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13 }}
            >
              <option value="">— Select Supplier —</option>
              {supplierList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              PO Date *
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Notes
            </label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional instructions..."
              style={{ width: "100%", padding: "9px 12px", background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13 }}
            />
          </div>
        </div>

        {/* Line Items */}
        <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, fontWeight: 600 }}>
          Order Items
        </p>
        <div style={{ background: COLORS.bg, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                {["Item Name", "Item Code", "Qty", "Unit", "Unit Price (₹)", "Total", ""].map((h) => (
                  <th key={h} style={{ background: "#f1f5f9", padding: "9px 12px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "6px 10px", verticalAlign: "top" }}>
                    <div style={{ position: "relative" }}>
                      <input
                        list="stock-names"
                        value={it.name}
                        onChange={(e) => updateLine(idx, "name", e.target.value)}
                        placeholder="Item name"
                        style={{ background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "6px 10px", fontSize: 12, width: "100%", minWidth: 150 }}
                      />
                      {ratesCache[it.name?.toLowerCase()]?.length > 0 && (
                        <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>
                          Cheapest: <strong>{ratesCache[it.name.toLowerCase()][0].supplier}</strong> (₹{ratesCache[it.name.toLowerCase()][0].price})
                          <button onClick={() => {
                             updateLine(idx, "unit_price", ratesCache[it.name.toLowerCase()][0].price);
                             if (!form.supplier_id && ratesCache[it.name.toLowerCase()][0].supplier_id) {
                               setForm(f => ({ ...f, supplier_id: ratesCache[it.name.toLowerCase()][0].supplier_id.toString() }));
                             }
                          }} style={{ marginLeft: 6, cursor: "pointer", color: COLORS.brand, border: "none", background: "none", textDecoration: "underline", padding: 0 }}>Use Rate</button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input
                      value={it.item_code}
                      onChange={(e) => updateLine(idx, "item_code", e.target.value)}
                      placeholder="KPL-###"
                      style={{ background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.brand, borderRadius: 6, padding: "6px 10px", fontSize: 12, width: 90, fontFamily: "monospace" }}
                    />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input type="number" min="0.01" step="any" value={it.qty}
                      onChange={(e) => updateLine(idx, "qty", e.target.value)}
                      style={{ background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "6px 10px", fontSize: 12, width: 70 }}
                    />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    {(() => {
                      const match = stocks.find((s) => s.name && s.name.toLowerCase() === (it.name || "").toLowerCase());
                      const allowedUnits = match?.unit ? getCompatibleUnits(match.unit) : UNITS;
                      const isIncompatible = match?.unit && !areUnitsCompatible(it.unit, match.unit, it.name);

                      return (
                        <div>
                          <select value={it.unit} onChange={(e) => updateLine(idx, "unit", e.target.value)}
                            style={{
                              background: isIncompatible ? "#FEE2E2" : "#fff",
                              border: `1px solid ${isIncompatible ? COLORS.coral : COLORS.border}`,
                              color: COLORS.text,
                              borderRadius: 6,
                              padding: "6px 8px",
                              fontSize: 12,
                              width: 70
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
                  <td style={{ padding: "6px 10px" }}>
                    <input type="number" min="0" step="any" value={it.unit_price}
                      onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                      style={{ background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "6px 10px", fontSize: 12, width: 90 }}
                    />
                  </td>
                  <td style={{ padding: "6px 10px", color: COLORS.accent, fontWeight: 600, whiteSpace: "nowrap" }}>
                    ₹{lineTotal(it)}
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    {lineItems.length > 1 && (
                      <button
                        onClick={() => removeLine(idx)}
                        style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                      >×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="stock-names">
          {stocks.map((s) => <option key={s.id} value={s.name} />)}
        </datalist>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={addLine}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: `1px dashed ${COLORS.border}`,
              color: COLORS.muted, padding: "7px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer"
            }}
          >
            <Plus size={14} /> Add Item
          </button>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>GRAND TOTAL</p>
            <p style={{ fontWeight: 700, color: COLORS.accent, fontSize: 22, letterSpacing: "-0.02em" }}>
              ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {grandTotal > 10000 && (
          <div
            style={{
              background: "rgba(232, 168, 56, 0.12)",
              border: `1px solid ${COLORS.accent}66`,
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <AlertTriangle size={18} color={COLORS.accent} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600 }}>
              Threshold Notice: Orders exceeding ₹10,000 (currently ₹{fmt(grandTotal)}) require managerial authorization and will be automatically routed to the Approvals Queue upon submission.
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, paddingTop: 16, borderTop: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          <Btn onClick={submit} loading={submitting} style={{ flex: 1 }}>Create Purchase Order</Btn>
          <Btn variant="ghost" onClick={autoDraft}>Auto-Draft (Low Stock)</Btn>
          <Btn variant="ghost" onClick={generateWhatsAppPO} disabled={lowStockItems.length === 0} style={{ color: COLORS.success, borderColor: COLORS.success }}>
            Share via WhatsApp
          </Btn>
          <Btn variant="ghost" onClick={copyPOToClipboard} disabled={lowStockItems.length === 0} style={{ color: COLORS.accent, borderColor: COLORS.accent }}>
            Copy PO
          </Btn>
          <Btn variant="ghost" onClick={() => {
            setForm({ supplier_id: "", date: today(), notes: "" });
            setLineItems([{ ...emptyItem }]);
          }}>Clear Form</Btn>
        </div>
      </Card>

      {/* Recent POs Table */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flexShrink: 0 }}>
        <h3 style={{ margin: "10px 0 0", fontSize: "16px", fontWeight: 600, color: COLORS.text }}>
          Recent Purchase Orders
        </h3>

        {/* Filters Bar */}
        <div style={{
          display: "flex", gap: 10, alignItems: "center",
          flexWrap: "wrap", flexShrink: 0
        }}>
          <input
            value={filters.q}
            onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); load({ page: 1, q: e.target.value }); }}
            placeholder="Search PO# or supplier…"
            style={{
              flex: 1, minWidth: 200, padding: "8px 12px",
              border: `1px solid ${COLORS.border}`, borderRadius: 8,
              fontSize: 13, background: "#fff", color: COLORS.text
            }}
          />
          {/* Status pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {["", ...PO_STATUSES].map((s) => {
              const isActive = filters.status === s;
              const sc = s ? STATUS_CONFIG[s] : null;
              return (
                <button
                  key={s}
                  onClick={() => { setFilters((f) => ({ ...f, status: s })); load({ page: 1, status: s }); }}
                  style={{
                    padding: "6px 14px", fontSize: 12, fontWeight: 600,
                    borderRadius: 20, border: `1px solid ${isActive ? (sc?.dot || COLORS.brand) : COLORS.border}`,
                    background: isActive ? (sc?.bg || COLORS.brand + "15") : "transparent",
                    color: isActive ? (sc?.text || COLORS.brand) : COLORS.muted,
                    cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  {s || "All"}
                </button>
              );
            })}
          </div>
          <select
            value={filters.supplier_id}
            onChange={(e) => { setFilters((f) => ({ ...f, supplier_id: e.target.value })); load({ page: 1, supplier_id: e.target.value }); }}
            style={{ padding: "8px 12px", background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13, minWidth: 140 }}
          >
            <option value="">All Suppliers</option>
            {supplierList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {msg && msg.text && <p style={{ color: msg.color, fontSize: 12 }}>{msg.text}</p>}

        {/* PO Table */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: COLORS.muted, fontSize: 13 }}>
              Loading orders…
            </div>
          ) : error ? (
            <ErrorMsg error={error} />
          ) : items.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 12 }}>
              <div style={{ fontSize: 40 }}>📋</div>
              <p style={{ color: COLORS.muted, fontSize: 14, fontWeight: 500 }}>No purchase orders yet</p>
            </div>
          ) : (
            <>
              <div className="resp-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Items</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((po) => {
                      const sc = STATUS_CONFIG[po.status] || STATUS_CONFIG.Draft;
                      return (
                        <tr
                          key={po.id}
                          onClick={() => openDetail(po.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <span style={{ fontFamily: "monospace", color: COLORS.brand, fontWeight: 700, fontSize: 13 }}>
                              {po.po_number}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{po.supplier_name}</td>
                          <td style={{ color: COLORS.muted }}>{new Date(po.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              background: sc.bg, color: sc.text,
                              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600
                            }}>
                              {sc.icon} {po.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: COLORS.accent }}>
                            ₹{fmt(po.total_amount)}
                          </td>
                          <td style={{ color: COLORS.muted }}>
                            {po.item_count || "—"}
                          </td>
                          <td>
                            <ChevronRight size={16} color={COLORS.muted} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ borderTop: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
                <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
              </div>
            </>
          )}
        </Card>
      </div>

      <RateComparisonModal open={compareOpen} onClose={() => setCompareOpen(false)} stocks={stocks} />
    </div>
  );
}
