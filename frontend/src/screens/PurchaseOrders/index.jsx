import { useState, useEffect, useRef, useMemo } from "react";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Pagination from "../../components/Pagination";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS, UNITS } from "../../styles/colors";
import { getCompatibleUnits, areUnitsCompatible } from "../../utils/units";
import { usePaginatedApi } from "../../hooks/useApi";
import { useAppContext } from "../../context/AppContext";
import * as api from "../../api";
import {
  Plus, ArrowLeft, FileText, CheckCircle, XCircle, Clock, ChevronRight,
  Mic, FileImage, Loader, Camera, Scale, Share2, Copy, Printer, AlertTriangle,
  Download, Search, RefreshCw, Send, CheckCircle2, ChevronDown, ChevronUp,
  Building2, Calendar, FileSpreadsheet, Sparkles, TrendingDown, Layers,
  ExternalLink, Eye, Trash2, ArrowRight
} from "lucide-react";
import RateComparisonModal from "./RateComparisonModal";
import PrintPOModal from "./PrintPOModal";
import P2PAgentStatusBar from "../../components/agents/P2PAgentStatusBar";
import { PO_STATUS_CONFIG, PO_STATUSES } from "../../utils/poStatus";
import { today } from "../../utils/dates";
import { useLocalSpeech } from "../../hooks/useLocalSpeech";

const LIMIT = 20;

const STATUS_ICONS = {
  Draft: <Clock size={12} />,
  Pending: <Clock size={12} />,
  Approved: <CheckCircle size={12} />,
  Sent: <FileText size={12} />,
  Received: <CheckCircle size={12} />,
  Cancelled: <XCircle size={12} />,
  Rejected: <XCircle size={12} />,
};

const STATUS_CONFIG = Object.fromEntries(
  PO_STATUSES.map((s) => [s, { ...PO_STATUS_CONFIG[s], icon: STATUS_ICONS[s] }])
);

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

const emptyItem = { item_code: "", name: "", qty: "", unit: UNITS[0], unit_price: "" };

const fmt = (n) => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function PurchaseOrdersScreen() {
  const { stocks, setCurrentScreen, poPreFill, setPoPreFill, setGrnPreFill } = useAppContext();
  const [view, setView]         = useState("list"); // "list" | "create" | "detail"
  const [createTab, setCreateTab] = useState("manual"); // "manual" | "voice" | "ocr" | "autodraft"
  const [detail, setDetail]     = useState(null);
  const [supplierList, setSupplierList] = useState([]);
  const [msg, setMsg]           = useState("");
  
  // Filters state
  const [filters, setFilters]   = useState({
    status: "",
    supplier_id: "",
    q: "",
    dateRange: "all",
    sort: "date",
    order: "desc"
  });

  // Form state
  const [form, setForm]         = useState({
    supplier_id: "",
    date: today(),
    delivery_date: "",
    payment_terms: "Net 30",
    notes: ""
  });
  const [lineItems, setLineItems] = useState([{ ...emptyItem }]);
  const [submitting, setSubmitting] = useState(false);
  const [ratesCache, setRatesCache] = useState({});

  // OCR & Voice state
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const [scanningBill, setScanningBill] = useState(false);
  const [importText, setImportText] = useState("");
  const { listening, interimText, startRecording, stopRecording } = useLocalSpeech();

  // Modals & Comparison
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareItemCode, setCompareItemCode] = useState("");
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Multi-agent swarm audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState(null);

  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.purchaseOrders.list);

  const load = (overrides = {}) => {
    const params = {
      limit: LIMIT,
      sort: filters.sort,
      order: filters.order,
      status: filters.status || undefined,
      supplier_id: filters.supplier_id || undefined,
      q: filters.q ? filters.q.trim() : undefined,
      ...overrides
    };
    fetch(params);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    api.suppliers.list({ limit: 200, sort: "name", order: "asc" })
      .then((r) => setSupplierList(r.data || []))
      .catch(() => {});
  }, []);

  // Cross-module pipeline: Auto-populate PO from Reorder Points or Suppliers screen
  useEffect(() => {
    if (poPreFill) {
      setView("create");
      setCreateTab("manual");
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
    setTimeout(() => setMsg(""), 3500);
  };

  // ── Multi-Agent Swarm Audit Trigger ─────────────────────
  const runSwarmAudit = async () => {
    setIsAuditing(true);
    const warnings = [];
    const recommendations = [];

    // 1. Agent Veritas Policy Check: Unit Compatibility
    for (const it of lineItems) {
      if (!it.name) continue;
      const match = stocks.find((s) => s.name && s.name.toLowerCase() === it.name.toLowerCase());
      if (match?.unit && !areUnitsCompatible(it.unit, match.unit, it.name)) {
        warnings.push(`Unit incompatibility: Item '${it.name}' ordered in '${it.unit}', but master stock is defined in '${match.unit}'.`);
      }
    }

    // 2. Agent Veritas: Check ₹10,000 threshold
    if (grandTotal > 10000) {
      warnings.push(`High Value Notice: Grand total of ₹${fmt(grandTotal)} exceeds the ₹10,000 threshold; will be locked for Managerial Approval.`);
    }

    // 3. Agent Sourcing Broker: Rate Optimization
    let totalPotentialSavings = 0;
    for (const it of lineItems) {
      if (!it.name) continue;
      const rates = ratesCache[it.name.toLowerCase()];
      if (rates && rates.length > 0) {
        const cheapest = rates[0];
        const currentRate = parseFloat(it.unit_price || 0);
        if (cheapest.price < currentRate) {
          const delta = (currentRate - cheapest.price) * (parseFloat(it.qty) || 1);
          totalPotentialSavings += delta;
          recommendations.push(
            `Agent Sourcing recommends '${cheapest.supplier}' for ${it.name} at ₹${cheapest.price}/${it.unit} (saves ₹${fmt(delta)}).`
          );
        }
      }
    }

    // 4. Duplicate Items Check
    const names = lineItems.map(it => it.name.trim().toLowerCase()).filter(Boolean);
    const duplicates = names.filter((n, idx) => names.indexOf(n) !== idx);
    if (duplicates.length > 0) {
      warnings.push(`Duplicate lines detected for: ${[...new Set(duplicates)].join(", ")}. Combine into single line to avoid duplicate orders.`);
    }

    setTimeout(() => {
      setAuditResults({
        hasWarnings: warnings.length > 0,
        warnings,
        recommendations,
        sourcingStatus: recommendations.length > 0 ? "SAVINGS FOUND" : "OPTIMAL",
        veritasStatus: warnings.length > 0 ? "ATTENTION REQ" : "VERIFIED",
        inwardStatus: "STANDBY"
      });
      setIsAuditing(false);
      flash(warnings.length > 0 ? "Swarm Audit completed with policy warnings." : "Swarm Audit: All lines verified ✓", warnings.length > 0 ? COLORS.warning : COLORS.success);
    }, 600);
  };

  // ── OCR Bill Scanner ────────────────────────────────────
  const handleScanBill = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanningBill(true);
    flash("Scanning document with OCR AI...", COLORS.brand);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      try {
        const res = await api.scan.purchase(base64, file.type || "image/jpeg");
        if (res.success && res.data) {
          const parsed = res.data;
          if (parsed.supplier) {
            const matched = supplierList.find(s => s.name?.toLowerCase().includes(parsed.supplier.toLowerCase()) || parsed.supplier.toLowerCase().includes(s.name?.toLowerCase()));
            if (matched) {
              setForm(f => ({ ...f, supplier_id: matched.id.toString() }));
              flash(`Bill scanned! Matched vendor: ${matched.name} ✓`);
            } else {
              flash(`Bill scanned! Vendor "${parsed.supplier}" not in directory.`, COLORS.warning);
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
            setCreateTab("manual");
          }
        } else {
          flash("Failed to extract bill items.", COLORS.coral);
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

  // ── Speech / Voice Parser ──────────────────────────────
  const startListening = () => {
    if (listening) {
      stopRecording((status) => flash(status));
    } else {
      startRecording(
        (text) => {
          setImportText((prev) => (prev.trim() ? prev.trim() + "\n" + text : text));
          flash("Voice transcription captured ✓");
        },
        (status) => flash(status)
      );
    }
  };

  const parseImportText = async () => {
    if (!importText.trim()) return;
    flash("Parsing voice list with AI...", COLORS.brand);
    try {
      const res = await api.scan.text(importText);
      if (res.success && res.data) {
        const parsed = res.data;
        if (parsed.supplier) {
          const matched = supplierList.find(s => s.name?.toLowerCase().includes(parsed.supplier.toLowerCase()) || parsed.supplier.toLowerCase().includes(s.name?.toLowerCase()));
          if (matched) setForm(f => ({ ...f, supplier_id: matched.id.toString() }));
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
          flash("Voice items converted to PO lines ✓");
          setCreateTab("manual");
          setImportText("");
        }
      }
    } catch (err) {
      flash("Parse error: " + err.message, COLORS.coral);
    }
  };

  // ── Line Items Helpers ──────────────────────────────────
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
              .catch(() => {});
          }
        }
      }
      return next;
    });
  };

  const addLine = () => setLineItems((p) => [...p, { ...emptyItem }]);
  const removeLine = (idx) => setLineItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : [{ ...emptyItem }]));
  const duplicateLine = (idx) => {
    const item = lineItems[idx];
    setLineItems((p) => [...p, { ...item }]);
    flash("Line duplicated ✓");
  };

  const lineTotal = (it) => {
    const q = parseFloat(it.qty) || 0;
    const p = parseFloat(it.unit_price) || 0;
    return (q * p).toFixed(2);
  };

  const grandTotal = lineItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.unit_price) || 0), 0);

  // ── Submit PO ──────────────────────────────────────────
  const submit = async () => {
    if (!form.supplier_id) return flash("Please select a vendor / supplier.", COLORS.coral);
    const validLines = lineItems.filter((it) => it.name && it.qty && it.unit_price);
    if (validLines.length === 0) return flash("Add at least one valid line item.", COLORS.coral);

    const hasIncompatibleUnit = validLines.some((it) => {
      const match = stocks.find((s) => s.name && s.name.toLowerCase() === it.name.toLowerCase());
      return match?.unit && !areUnitsCompatible(it.unit, match.unit, it.name);
    });
    if (hasIncompatibleUnit) {
      return flash("Dimensional conflict: Fix incompatible units before submitting PO.", COLORS.coral);
    }

    setSubmitting(true);
    try {
      const combinedNotes = [
        form.notes ? form.notes.trim() : null,
        form.delivery_date ? `Expected Delivery: ${form.delivery_date}` : null,
        form.payment_terms ? `Terms: ${form.payment_terms}` : null
      ].filter(Boolean).join(" | ");

      const payload = {
        supplier_id: parseInt(form.supplier_id),
        date: form.date,
        notes: combinedNotes || null,
        items: validLines.map((it) => ({
          item_code: it.item_code || it.name.toUpperCase().replace(/\s+/g, "-").slice(0, 20),
          name: it.name,
          qty: parseFloat(it.qty),
          unit: it.unit,
          unit_price: parseFloat(it.unit_price),
        })),
      };
      const res = await api.purchaseOrders.create(payload);
      flash(grandTotal > 10000 ? "PO routed to Approvals Queue (> ₹10,000 threshold) ✓" : "Purchase Order created ✓");
      setForm({ supplier_id: "", date: today(), delivery_date: "", payment_terms: "Net 30", notes: "" });
      setLineItems([{ ...emptyItem }]);
      setAuditResults(null);
      setView("list");
      load({ page: 1 });
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
    setSubmitting(false);
  };

  const autoDraft = async () => {
    if (!form.supplier_id) return flash("Select a supplier for auto-drafting.", COLORS.coral);
    try {
      const res = await api.purchaseOrders.autoDraft(parseInt(form.supplier_id), true);
      if (res.data && res.data.items && res.data.items.length > 0) {
        setLineItems(res.data.items.map(it => ({
          ...it,
          qty: it.qty?.toString() || "1",
          unit_price: it.unit_price?.toString() || ""
        })));
        flash(`Auto-drafted ${res.data.items.length} low stock items from reorder sentinel.`);
        setCreateTab("manual");
      } else {
        flash("No items requiring reorder for this vendor.");
      }
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  // ── Detail View Actions ────────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await api.purchaseOrders.getOne(id);
      setDetail(res.data);
      setView("detail");
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.purchaseOrders.update(id, { status });
      const res = await api.purchaseOrders.getOne(id);
      setDetail(res.data);
      load({ page: 1 });
      flash(`PO status updated to ${status} ✓`);
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  const deletePO = async (id) => {
    if (!confirm("Are you sure you want to delete this Purchase Order? This cannot be undone.")) return;
    try {
      await api.purchaseOrders.remove(id);
      flash("Purchase Order deleted.");
      setView("list");
      load({ page: 1 });
    } catch (e) {
      flash(e.message, COLORS.coral);
    }
  };

  // ── CSV Export ──────────────────────────────────────────
  const exportToCSV = () => {
    if (!items || items.length === 0) {
      flash("No purchase orders to export.", COLORS.warning);
      return;
    }
    const headers = ["PO Number", "Supplier", "Date", "Status", "Items Count", "Total Amount (INR)", "Created At"];
    const rows = items.map((p) => [
      `"${p.po_number}"`,
      `"${p.supplier_name}"`,
      `"${p.date}"`,
      `"${p.status}"`,
      p.item_count || 0,
      parseFloat(p.total_amount || 0).toFixed(2),
      `"${p.created_at || ""}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Kapila_Purchase_Orders_${today()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    flash("Exported Purchase Orders to CSV ✓");
  };

  // ── WhatsApp & Clipboard Formatting ────────────────────
  const lowStockItems = stocks.filter((item) => {
    const pct = item.qty > 0 ? (item.remaining / item.qty) * 100 : 0;
    return item.min_alert_qty !== null ? item.remaining <= item.min_alert_qty : pct < 25;
  });

  const generateWhatsAppPO = () => {
    if (lowStockItems.length === 0) return;
    const header = "*KAPILA INVENTORY — REORDER PURCHASE INQUIRY*\nGenerated: " + today() + "\n\n";
    const itemsText = lowStockItems.map((item, idx) => {
      const needed = item.min_alert_qty ? (item.min_alert_qty * 2) : 10;
      return `${idx + 1}. *${item.name}* — Needs approx. ${needed} ${item.unit} (Current: ${parseFloat(item.remaining).toFixed(1)} ${item.unit})`;
    }).join("\n");
    const footer = "\n\nPlease confirm pricing & earliest dispatch date.\nHotel Kapila Procurement";
    window.open(`https://wa.me/?text=${encodeURIComponent(header + itemsText + footer)}`, "_blank");
  };

  const copyPOToClipboard = () => {
    if (lowStockItems.length === 0) return;
    const header = "*KAPILA INVENTORY — PURCHASE ORDER INQUIRY*\nGenerated: " + today() + "\n\n";
    const itemsText = lowStockItems.map((item, idx) => {
      const needed = item.min_alert_qty ? (item.min_alert_qty * 2) : 10;
      return `${idx + 1}. *${item.name}* — Needs ${needed} ${item.unit}`;
    }).join("\n");
    navigator.clipboard.writeText(header + itemsText);
    flash("Reorder items copied to clipboard ✓");
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

  // ── KPI Summary Calculations ────────────────────────────
  const pendingCount = useMemo(() => (items || []).filter(p => p.status === "Pending").length, [items]);
  const approvedCount = useMemo(() => (items || []).filter(p => ["Approved", "Sent"].includes(p.status)).length, [items]);
  const totalSpend = useMemo(() => (items || []).reduce((acc, p) => acc + (parseFloat(p.total_amount) || 0), 0), [items]);

  // ════════════════════════════════════════════════════════
  // 1. DETAIL VIEW
  // ════════════════════════════════════════════════════════
  if (view === "detail" && detail) {
    const steps = [
      { key: "Draft", label: "Drafted" },
      { key: "Pending", label: "Pending Approval" },
      { key: "Approved", label: "Approved" },
      { key: "Sent", label: "Sent to Vendor" },
      { key: "Received", label: "Goods Received (GRN)" }
    ];

    const currentStepIdx = steps.findIndex(s => s.key === detail.status);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 16 }}>
        <P2PAgentStatusBar activeModule="po" />

        {/* Top Detail Navigation Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setView("list")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`,
                color: COLORS.text, padding: "8px 14px", borderRadius: 8,
                fontSize: 13, cursor: "pointer", fontWeight: 600
              }}
            >
              <ArrowLeft size={15} /> All Orders
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: "-0.02em" }}>
                  {detail.po_number}
                </h1>
                <StatusBadge status={detail.status} />
              </div>
              <p style={{ fontSize: 12, color: COLORS.muted, margin: "2px 0 0" }}>
                Vendor: <strong style={{ color: COLORS.text }}>{detail.supplier_name}</strong> · PO Date: {new Date(detail.date).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>

          {/* Lifecycle Action Buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {detail.status === "Draft" && (
              <Btn small onClick={() => changeStatus(detail.id, "Pending")}>
                Submit for Approval
              </Btn>
            )}
            {detail.status === "Approved" && (
              <Btn small onClick={() => changeStatus(detail.id, "Sent")}>
                Mark Sent to Vendor
              </Btn>
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
                Receive via GRN →
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
              <Btn small variant="danger" onClick={() => deletePO(detail.id)} icon={<Trash2 size={13} />}>
                Delete
              </Btn>
            )}
          </div>
        </div>

        {msg && <p style={{ color: msg.color, fontSize: 12, margin: 0 }}>{msg.text}</p>}

        {/* Visual Lifecycle Stepper */}
        <Card style={{ padding: "16px 20px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 12 }}>
            Procurement Lifecycle Stepper
          </span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
            {steps.map((st, i) => {
              const isPast = currentStepIdx > i;
              const isCurrent = currentStepIdx === i;
              return (
                <div key={st.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, flex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isCurrent ? COLORS.accent : isPast ? COLORS.success : "rgba(255,255,255,0.06)",
                    color: isCurrent ? "#18181b" : isPast ? "#fff" : COLORS.muted,
                    fontSize: 12, fontWeight: 700, border: `2px solid ${isCurrent ? COLORS.accent : isPast ? COLORS.success : COLORS.border}`,
                    marginBottom: 6
                  }}>
                    {isPast ? "✓" : i + 1}
                  </div>
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? COLORS.accent : isPast ? COLORS.text : COLORS.muted,
                    textAlign: "center"
                  }}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Metadata Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
            <span style={{ fontSize: 10.5, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vendor / Supplier</span>
            <p style={{ margin: "4px 0 2px", fontSize: 15, fontWeight: 700, color: COLORS.text }}>{detail.supplier_name}</p>
            <span style={{ fontSize: 11.5, color: COLORS.muted }}>Phone: {detail.supplier_phone || "Not on file"}</span>
          </div>

          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
            <span style={{ fontSize: 10.5, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>GSTIN & Compliance</span>
            <p style={{ margin: "4px 0 2px", fontSize: 15, fontWeight: 700, color: COLORS.text }}>{detail.supplier_gstin || "Unregistered"}</p>
            <span style={{ fontSize: 11.5, color: COLORS.muted }}>Vendor Rating: {detail.supplier_rating ? `${detail.supplier_rating} ★` : "Standard"}</span>
          </div>

          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
            <span style={{ fontSize: 10.5, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total PO Valuation</span>
            <p style={{ margin: "4px 0 2px", fontSize: 18, fontWeight: 800, color: COLORS.accent }}>₹{fmt(detail.total_amount)}</p>
            <span style={{ fontSize: 11.5, color: COLORS.muted }}>{detail.items?.length || 0} order items</span>
          </div>

          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
            <span style={{ fontSize: 10.5, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Delivery Terms & Notes</span>
            <p style={{ margin: "4px 0 2px", fontSize: 13, fontWeight: 600, color: COLORS.text }}>{detail.notes || "Standard procurement guidelines"}</p>
          </div>
        </div>

        {/* Items Table */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.02)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Ordered Items Breakdown
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: COLORS.bg, textAlign: "left", color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ padding: "10px 14px" }}>Item Code</th>
                  <th style={{ padding: "10px 14px" }}>Item Description</th>
                  <th style={{ padding: "10px 14px" }}>Quantity</th>
                  <th style={{ padding: "10px 14px" }}>Unit</th>
                  <th style={{ padding: "10px 14px" }}>Unit Price</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Total Price</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((it, idx) => (
                  <tr key={it.id || idx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", color: COLORS.brand, fontWeight: 600 }}>{it.item_code}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: COLORS.text }}>{it.name}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: COLORS.text }}>{it.qty}</td>
                    <td style={{ padding: "10px 14px", color: COLORS.muted }}>{it.unit}</td>
                    <td style={{ padding: "10px 14px" }}>₹{parseFloat(it.unit_price).toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: COLORS.accent }}>
                      ₹{parseFloat(it.total_price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderTop: `2px solid ${COLORS.border}` }}>
                  <td colSpan={5} style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: COLORS.text }}>
                    Grand Total
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, fontSize: 17, color: COLORS.accent }}>
                    ₹{fmt(detail.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <PrintPOModal open={printModalOpen} onClose={() => setPrintModalOpen(false)} po={detail} />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // 2. DEFAULT VIEW: COMMAND BAR + (NEW PO STUDIO / LIST GRID)
  // ════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 16 }}>
      {/* Top Header Command Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.02em", margin: 0 }}>
            Purchase Orders
          </h1>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0" }}>
            Procurement lifecycle management, vendor rate comparison & inward stock sync
          </p>
        </div>

        {/* View Switcher Pill */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            display: "flex", background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: 3
          }}>
            <button
              onClick={() => setView("list")}
              style={{
                padding: "6px 14px", fontSize: 12.5, fontWeight: view === "list" ? 700 : 500,
                borderRadius: 6, border: "none", cursor: "pointer",
                background: view === "list" ? COLORS.brand : "transparent",
                color: view === "list" ? "#fff" : COLORS.muted,
                transition: "all 0.15s"
              }}
            >
              Recent Orders ({total})
            </button>
            <button
              onClick={() => setView("create")}
              style={{
                padding: "6px 14px", fontSize: 12.5, fontWeight: view === "create" ? 700 : 500,
                borderRadius: 6, border: "none", cursor: "pointer",
                background: view === "create" ? COLORS.brand : "transparent",
                color: view === "create" ? "#fff" : COLORS.muted,
                transition: "all 0.15s"
              }}
            >
              + New PO Studio
            </button>
          </div>

          <Btn
            variant="ghost"
            onClick={() => { setCompareItemCode(""); setCompareOpen(true); }}
            icon={<Scale size={15} />}
            style={{ fontSize: 12.5, fontWeight: 600, border: `1px solid ${COLORS.border}` }}
          >
            Compare Rates
          </Btn>
        </div>
      </div>

      {/* Interactive Swarm Telemetry */}
      <P2PAgentStatusBar
        activeModule="po"
        onRunAudit={runSwarmAudit}
        isAuditing={isAuditing}
        auditResults={auditResults}
      />

      {/* KPI Counters Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
          <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>Total Purchase Orders</span>
          <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: COLORS.text }}>{total}</p>
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
          <span style={{ fontSize: 11, color: COLORS.warning, textTransform: "uppercase", fontWeight: 600 }}>Pending Manager Approval</span>
          <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: COLORS.warning }}>{pendingCount}</p>
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
          <span style={{ fontSize: 11, color: COLORS.teal, textTransform: "uppercase", fontWeight: 600 }}>Approved / Awaiting GRN</span>
          <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: COLORS.teal }}>{approvedCount}</p>
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
          <span style={{ fontSize: 11, color: COLORS.accent, textTransform: "uppercase", fontWeight: 600 }}>Total Orders Valuation</span>
          <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: COLORS.accent }}>₹{fmt(totalSpend)}</p>
        </div>
      </div>

      {msg && (
        <div style={{
          background: msg.color ? `${msg.color}15` : "rgba(16, 185, 129, 0.15)",
          border: `1px solid ${msg.color || COLORS.success}44`,
          color: msg.color || COLORS.success,
          padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500
        }}>
          {msg.text || msg}
        </div>
      )}

      {/* ────────────────────────────────────────────────────── */}
      {/* 2A. NEW PURCHASE ORDER STUDIO                          */}
      {/* ────────────────────────────────────────────────────── */}
      {view === "create" && (
        <Card style={{ padding: "20px 24px" }}>
          {/* Studio Tab Switcher */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 14, marginBottom: 18,
            flexWrap: "wrap", gap: 10
          }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "manual", label: "Line Item Builder", icon: <Layers size={14} /> },
                { id: "voice", label: "Voice / Speech", icon: <Mic size={14} /> },
                { id: "ocr", label: "Bill / Doc Scanner", icon: <FileImage size={14} /> },
                { id: "autodraft", label: "Low-Stock Auto-Draft", icon: <Sparkles size={14} /> }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setCreateTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: createTab === t.id ? 700 : 500,
                    background: createTab === t.id ? "rgba(232, 168, 56, 0.15)" : "transparent",
                    color: createTab === t.id ? COLORS.accent : COLORS.muted,
                    transition: "all 0.15s"
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={runSwarmAudit}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 6, fontSize: 12,
                  background: "rgba(232, 168, 56, 0.1)", border: `1px solid ${COLORS.accent}44`,
                  color: COLORS.accent, cursor: "pointer", fontWeight: 600
                }}
              >
                <Sparkles size={13} /> Verify Draft With Swarm
              </button>
            </div>
          </div>

          {/* TAB: VOICE DICTATION */}
          {createTab === "voice" && (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.border}`,
              borderRadius: 10, padding: 18, marginBottom: 20
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, display: "flex", alignItems: "center", gap: 6 }}>
                  <Mic size={16} /> Multi-Language Speech Capture (Telugu, Hindi, English)
                </span>
                <button
                  onClick={startListening}
                  style={{
                    padding: "7px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: listening ? COLORS.danger : COLORS.brand,
                    color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                  }}
                >
                  {listening ? "🛑 Stop Recording" : "🎤 Start Dictation"}
                </button>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Speak or paste order list (e.g. Sona Masoori Rice 50 kg rate 45, Sunflower Oil 20 liter rate 110)..."
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`, borderRadius: 8,
                  color: COLORS.text, fontSize: 13, resize: "vertical"
                }}
              />
              {interimText && (
                <div style={{ fontSize: 12, color: COLORS.accent, marginTop: 6, fontStyle: "italic" }}>
                  Listening: "{interimText}"...
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn small onClick={parseImportText} disabled={!importText.trim()}>Convert to PO Lines</Btn>
                <Btn small variant="ghost" onClick={() => setImportText("")} style={{ border: `1px solid ${COLORS.border}` }}>Clear</Btn>
              </div>
            </div>
          )}

          {/* TAB: OCR BILL SCANNER */}
          {createTab === "ocr" && (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.border}`,
              borderRadius: 10, padding: 18, marginBottom: 20
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <FileImage size={18} color={COLORS.accent} />
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                  AI Purchase Invoice & Quotation Scanner
                </span>
              </div>
              <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 14px 0" }}>
                Upload supplier proforma invoice or snap with mobile camera to automatically extract supplier and line items.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn
                  onClick={() => fileInputRef.current.click()}
                  disabled={scanningBill}
                  icon={scanningBill ? <Loader size={14} className="spin" /> : <FileImage size={14} />}
                >
                  {scanningBill ? "Scanning Bill..." : "Upload Invoice Image"}
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => cameraInputRef.current.click()}
                  disabled={scanningBill}
                  icon={<Camera size={14} />}
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  Capture with Camera
                </Btn>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleScanBill} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleScanBill} />
              </div>
            </div>
          )}

          {/* TAB: AUTO-DRAFT LOW STOCK */}
          {createTab === "autodraft" && (
            <div style={{
              background: "rgba(232, 168, 56, 0.06)", border: `1px solid ${COLORS.accent}44`,
              borderRadius: 10, padding: 18, marginBottom: 20
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Sparkles size={18} color={COLORS.accent} />
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent }}>
                  One-Click Predictive Low-Stock Auto-Draft
                </span>
              </div>
              <p style={{ fontSize: 12, color: COLORS.muted, margin: "0 0 12px 0" }}>
                Select a supplier below and click Auto-Draft. The procurement swarm queries on-hand stock and reorder levels to calculate optimal order quantities.
              </p>
              <Btn onClick={autoDraft} disabled={!form.supplier_id}>
                Auto-Draft Reorder Lines For Selected Vendor
              </Btn>
            </div>
          )}

          {/* Primary Form Header Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                Vendor / Supplier *
              </label>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                style={{
                  width: "100%", padding: "9px 12px", background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13
                }}
              >
                <option value="">— Select Supplier —</option>
                {supplierList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                PO Issue Date *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                style={{
                  width: "100%", padding: "9px 12px", background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm((f) => ({ ...f, delivery_date: e.target.value }))}
                style={{
                  width: "100%", padding: "9px 12px", background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                Payment Terms
              </label>
              <select
                value={form.payment_terms}
                onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
                style={{
                  width: "100%", padding: "9px 12px", background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13
                }}
              >
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Immediate">Immediate / Upon Delivery</option>
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Advance">Advance Payment</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              Instructions / Notes
            </label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Delivery before 10 AM, Gate 2 receiving, quality check required..."
              style={{
                width: "100%", padding: "9px 12px", background: COLORS.bg,
                border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, fontSize: 13
              }}
            />
          </div>

          {/* Line Items Table */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Order Line Items ({lineItems.length})
            </span>
          </div>

          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: COLORS.bg, color: COLORS.muted, textAlign: "left", borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ padding: "9px 12px" }}>Item Name & Search</th>
                  <th style={{ padding: "9px 12px" }}>Code</th>
                  <th style={{ padding: "9px 12px" }}>Quantity</th>
                  <th style={{ padding: "9px 12px" }}>Unit</th>
                  <th style={{ padding: "9px 12px" }}>Unit Price (₹)</th>
                  <th style={{ padding: "9px 12px" }}>Line Total</th>
                  <th style={{ padding: "9px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((it, idx) => {
                  const match = stocks.find((s) => s.name && s.name.toLowerCase() === (it.name || "").toLowerCase());
                  const allowedUnits = match?.unit ? getCompatibleUnits(match.unit) : UNITS;
                  const isIncompatible = match?.unit && !areUnitsCompatible(it.unit, match.unit, it.name);
                  const itemRates = ratesCache[it.name?.toLowerCase()];
                  const cheapestRate = itemRates && itemRates.length > 0 ? itemRates[0] : null;

                  return (
                    <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}`, verticalAlign: "top" }}>
                      {/* Name input */}
                      <td style={{ padding: "8px 12px", minWidth: 220 }}>
                        <input
                          list="stock-names-autocomplete"
                          value={it.name}
                          onChange={(e) => updateLine(idx, "name", e.target.value)}
                          placeholder="Type or select item..."
                          style={{
                            width: "100%", padding: "7px 10px", background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 6,
                            color: COLORS.text, fontSize: 12.5
                          }}
                        />
                        {/* Intelligent Lowest Rate Pill */}
                        {cheapestRate && (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 6, marginTop: 4,
                            fontSize: 11, color: COLORS.accent
                          }}>
                            <span>Cheapest: <strong>{cheapestRate.supplier}</strong> (₹{cheapestRate.price})</span>
                            <button
                              type="button"
                              onClick={() => {
                                updateLine(idx, "unit_price", cheapestRate.price.toString());
                                if (!form.supplier_id && cheapestRate.supplier_id) {
                                  setForm(f => ({ ...f, supplier_id: cheapestRate.supplier_id.toString() }));
                                }
                              }}
                              style={{
                                background: "rgba(232, 168, 56, 0.15)", border: "none",
                                color: COLORS.accent, borderRadius: 4, padding: "1px 6px",
                                cursor: "pointer", fontSize: 10.5, fontWeight: 700
                              }}
                            >
                              Use Rate
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Code */}
                      <td style={{ padding: "8px 12px", width: 100 }}>
                        <input
                          value={it.item_code}
                          onChange={(e) => updateLine(idx, "item_code", e.target.value)}
                          placeholder="KPL-###"
                          style={{
                            width: "100%", padding: "7px 10px", background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 6,
                            color: COLORS.brand, fontSize: 12, fontFamily: "monospace"
                          }}
                        />
                      </td>

                      {/* Qty */}
                      <td style={{ padding: "8px 12px", width: 90 }}>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={it.qty}
                          onChange={(e) => updateLine(idx, "qty", e.target.value)}
                          placeholder="Qty"
                          style={{
                            width: "100%", padding: "7px 10px", background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 6,
                            color: COLORS.text, fontSize: 12.5
                          }}
                        />
                      </td>

                      {/* Unit */}
                      <td style={{ padding: "8px 12px", width: 110 }}>
                        <select
                          value={it.unit}
                          onChange={(e) => updateLine(idx, "unit", e.target.value)}
                          style={{
                            width: "100%", padding: "7px 8px", fontSize: 12,
                            background: isIncompatible ? "rgba(239, 68, 68, 0.15)" : COLORS.bg,
                            border: `1px solid ${isIncompatible ? COLORS.danger : COLORS.border}`,
                            color: COLORS.text, borderRadius: 6
                          }}
                        >
                          {allowedUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        {isIncompatible && (
                          <div style={{ fontSize: 10, color: COLORS.danger, marginTop: 2 }}>
                            Stock is {match.unit}
                          </div>
                        )}
                      </td>

                      {/* Price */}
                      <td style={{ padding: "8px 12px", width: 120 }}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={it.unit_price}
                          onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                          placeholder="0.00"
                          style={{
                            width: "100%", padding: "7px 10px", background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 6,
                            color: COLORS.text, fontSize: 12.5
                          }}
                        />
                      </td>

                      {/* Line Total */}
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: COLORS.accent, whiteSpace: "nowrap" }}>
                        ₹{lineTotal(it)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCompareItemCode(it.item_code || "");
                            setCompareOpen(true);
                          }}
                          title="Compare rates for this item"
                          style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, padding: 4 }}
                        >
                          <Scale size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateLine(idx)}
                          title="Duplicate line"
                          style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, padding: 4 }}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          title="Remove line"
                          style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, padding: 4 }}
                        >
                          <XCircle size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <datalist id="stock-names-autocomplete">
            {stocks.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} (Code: {s.item_code} | Available: {parseFloat(s.remaining || 0).toFixed(1)} {s.unit})
              </option>
            ))}
          </datalist>

          {/* Add Line & Grand Total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <button
              onClick={addLine}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8, background: "none",
                border: `1px dashed ${COLORS.border}`, color: COLORS.text,
                fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}
            >
              <Plus size={15} /> Add Another Line
            </button>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>Grand Total</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.accent, letterSpacing: "-0.02em" }}>
                ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Threshold Gate Banner */}
          {grandTotal > 10000 && (
            <div style={{
              background: "rgba(232, 168, 56, 0.1)", border: `1px solid ${COLORS.accent}55`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 10
            }}>
              <AlertTriangle size={18} color={COLORS.accent} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: COLORS.accent, fontWeight: 600 }}>
                Managerial Authorization Gate: Purchase orders exceeding ₹10,000 (Current: ₹{fmt(grandTotal)}) automatically trigger the dual-authorization protocol upon creation.
              </span>
            </div>
          )}

          {/* Action Submission Buttons */}
          <div style={{ display: "flex", gap: 10, paddingTop: 16, borderTop: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
            <Btn onClick={submit} loading={submitting} style={{ flex: 1 }}>
              Submit Purchase Order
            </Btn>
            <Btn variant="ghost" onClick={autoDraft} disabled={!form.supplier_id}>
              Auto-Draft Reorders
            </Btn>
            <Btn variant="ghost" onClick={generateWhatsAppPO} disabled={lowStockItems.length === 0} style={{ color: COLORS.success, borderColor: COLORS.success }}>
              Share Inquiries (WA)
            </Btn>
            <Btn variant="ghost" onClick={copyPOToClipboard} disabled={lowStockItems.length === 0} style={{ color: COLORS.accent, borderColor: COLORS.accent }}>
              Copy Text
            </Btn>
            <Btn variant="ghost" onClick={() => {
              setForm({ supplier_id: "", date: today(), delivery_date: "", payment_terms: "Net 30", notes: "" });
              setLineItems([{ ...emptyItem }]);
              setAuditResults(null);
            }}>
              Clear
            </Btn>
          </div>
        </Card>
      )}

      {/* ────────────────────────────────────────────────────── */}
      {/* 2B. RECENT PURCHASE ORDERS LIST GRID                   */}
      {/* ────────────────────────────────────────────────────── */}
      {view === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter Bar */}
          <Card style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
                <Search size={15} color={COLORS.muted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={filters.q}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, q: e.target.value }));
                    load({ page: 1, q: e.target.value });
                  }}
                  placeholder="Search by PO Number or Vendor Name…"
                  style={{
                    width: "100%", padding: "8px 12px 8px 32px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    fontSize: 13, color: COLORS.text
                  }}
                />
              </div>

              {/* Vendor Filter */}
              <select
                value={filters.supplier_id}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, supplier_id: e.target.value }));
                  load({ page: 1, supplier_id: e.target.value });
                }}
                style={{
                  padding: "8px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                  color: COLORS.text, borderRadius: 8, fontSize: 13, minWidth: 170
                }}
              >
                <option value="">All Suppliers</option>
                {supplierList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* CSV Export Button */}
              <button
                type="button"
                onClick={exportToCSV}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${COLORS.border}`, color: COLORS.text,
                  fontSize: 12.5, fontWeight: 600, cursor: "pointer"
                }}
              >
                <FileSpreadsheet size={14} /> Export CSV
              </button>
            </div>

            {/* Status Tabs */}
            <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto", paddingBottom: 2 }}>
              {["", ...PO_STATUSES].map((st) => {
                const isActive = filters.status === st;
                const sc = st ? STATUS_CONFIG[st] : null;
                return (
                  <button
                    key={st}
                    onClick={() => {
                      setFilters((f) => ({ ...f, status: st }));
                      load({ page: 1, status: st });
                    }}
                    style={{
                      padding: "5px 14px", fontSize: 12, fontWeight: 600,
                      borderRadius: 20, border: `1px solid ${isActive ? (sc?.dot || COLORS.brand) : COLORS.border}`,
                      background: isActive ? (sc?.bg || "rgba(232, 168, 56, 0.15)") : "transparent",
                      color: isActive ? (sc?.text || COLORS.accent) : COLORS.muted,
                      cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap"
                    }}
                  >
                    {st || "All Orders"}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Orders Data Table */}
          <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
                Loading purchase orders…
              </div>
            ) : error ? (
              <ErrorMsg error={error} />
            ) : items.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: COLORS.muted }}>
                <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>No purchase orders found</p>
                <p style={{ fontSize: 13, margin: 0 }}>Try clearing search filters or create a new purchase order above.</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: COLORS.bg, textAlign: "left", color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
                        <th style={{ padding: "10px 16px" }}>PO Number</th>
                        <th style={{ padding: "10px 16px" }}>Vendor / Supplier</th>
                        <th style={{ padding: "10px 16px" }}>PO Date</th>
                        <th style={{ padding: "10px 16px" }}>Status</th>
                        <th style={{ padding: "10px 16px" }}>Items</th>
                        <th style={{ padding: "10px 16px" }}>Total Amount</th>
                        <th style={{ padding: "10px 16px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((po) => {
                        const sc = STATUS_CONFIG[po.status] || STATUS_CONFIG.Draft;
                        return (
                          <tr
                            key={po.id}
                            style={{
                              borderBottom: `1px solid ${COLORS.border}`,
                              cursor: "pointer",
                              transition: "background 0.15s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <td style={{ padding: "11px 16px" }} onClick={() => openDetail(po.id)}>
                              <span style={{ fontFamily: "monospace", color: COLORS.brand, fontWeight: 700, fontSize: 13 }}>
                                {po.po_number}
                              </span>
                            </td>

                            <td style={{ padding: "11px 16px" }} onClick={() => openDetail(po.id)}>
                              <div style={{ fontWeight: 600, color: COLORS.text }}>{po.supplier_name}</div>
                              {po.notes && (
                                <div style={{ fontSize: 11, color: COLORS.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {po.notes}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: "11px 16px", color: COLORS.muted }} onClick={() => openDetail(po.id)}>
                              {new Date(po.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>

                            <td style={{ padding: "11px 16px" }} onClick={() => openDetail(po.id)}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                background: sc.bg, color: sc.text,
                                padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600
                              }}>
                                {sc.icon} {po.status}
                              </span>
                            </td>

                            <td style={{ padding: "11px 16px", color: COLORS.muted }} onClick={() => openDetail(po.id)}>
                              {po.item_count ? `${po.item_count} items` : "—"}
                            </td>

                            <td style={{ padding: "11px 16px", fontWeight: 700, color: COLORS.accent }} onClick={() => openDetail(po.id)}>
                              ₹{fmt(po.total_amount)}
                            </td>

                            <td style={{ padding: "11px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => openDetail(po.id)}
                                  title="View Details"
                                  style={{
                                    padding: "4px 8px", background: "none", border: `1px solid ${COLORS.border}`,
                                    color: COLORS.text, borderRadius: 6, cursor: "pointer", fontSize: 11.5
                                  }}
                                >
                                  View
                                </button>
                                {["Approved", "Sent"].includes(po.status) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      api.purchaseOrders.getOne(po.id).then(r => {
                                        if (setGrnPreFill) setGrnPreFill(r.data);
                                        if (setCurrentScreen) setCurrentScreen("grn");
                                      });
                                    }}
                                    title="Receive in GRN"
                                    style={{
                                      padding: "4px 8px", background: COLORS.accent, border: "none",
                                      color: "#18181b", borderRadius: 6, cursor: "pointer", fontSize: 11.5, fontWeight: 700
                                    }}
                                  >
                                    GRN
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ padding: "10px 16px", borderTop: `1px solid ${COLORS.border}` }}>
                  <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Vendor Rate Comparison Modal */}
      <RateComparisonModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        stocks={stocks}
        initialItemCode={compareItemCode}
        onSelectSupplierRate={({ supplier_name, rate, item_code }) => {
          // If in create view, update matching line item
          if (view === "create") {
            setLineItems((prev) => {
              const idx = prev.findIndex(it => (it.item_code && it.item_code === item_code) || it.name.toLowerCase() === item_code.toLowerCase());
              if (idx >= 0) {
                const next = [...prev];
                next[idx].unit_price = rate.toString();
                return next;
              }
              return prev;
            });
            const matchedSup = supplierList.find(s => s.name.toLowerCase() === supplier_name.toLowerCase());
            if (matchedSup && !form.supplier_id) {
              setForm(f => ({ ...f, supplier_id: matchedSup.id.toString() }));
            }
            flash(`Applied rate ₹${rate} for ${item_code} from ${supplier_name} ✓`);
          }
        }}
      />
    </div>
  );
}
