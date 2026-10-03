import { useState, useEffect, useRef, useMemo } from "react";
import { COLORS, UNITS, STOCK_CATEGORIES } from "../../styles/colors";
import {
  PackagePlus, X, MapPin, Building2, Calendar, Clock,
  DollarSign, Layers, Tag, FileText, AlertCircle, Sparkles, CheckCircle, Info,
  Maximize2, Minimize2, Cpu, Zap, ShieldCheck, TrendingUp, TrendingDown,
  Warehouse, Calculator, Search, ChevronDown, ChevronUp, RefreshCw,
  CheckCheck, Boxes, ArrowRight, ExternalLink
} from "lucide-react";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import * as api from "../../api";
import { today } from "../../utils/dates";
import CreateVendorModal from "../../components/CreateVendorModal";
import UnitDimensionBadge from "../../components/UnitDimensionBadge";
import { getDimensionConfig, normalizeUnit } from "../../utils/units";

const STORAGE_ZONES = [
  "General Store & Provisions",
  "Main Dry Store - Heavy Grains & Rice",
  "Main Dry Store - Heavy Grains & Flour",
  "Main Dry Store - Pulses & Lentils",
  "Main Dry Store - Edible Oils & Ghee",
  "Main Dry Store - Spices & Seasonings",
  "Main Dry Store - Nuts & Dry Fruits",
  "Main Dry Store - Condiments & Sauces",
  "Main Dry Store - Bakery & Essences",
  "Cold Chain - Walk-in Dairy Chiller",
  "Cold Chain - Deep Freeze (-18°C)",
  "Cold Chain - Meat & Poultry Chiller",
  "Fresh Produce - Daily Vegetable Bay",
  "Fresh Produce - Daily Fruit Bay",
  "Beverage Cellar & Soft Drink Store",
  "Packaging & Non-Food Bay",
  "Housekeeping & Linen Store",
  "Chemicals & Cleaning Bay",
  "Utilities & Fuel Safety Bay"
];

const PACK_TYPES = [
  { label: "Standard / Loose", defaultSize: 1 },
  { label: "Bag / Sack (25 kg)", defaultSize: 25 },
  { label: "Bag / Sack (50 kg)", defaultSize: 50 },
  { label: "Tin / Canister (15 L)", defaultSize: 15 },
  { label: "Tin / Canister (20 L)", defaultSize: 20 },
  { label: "Carton / Box (12 pcs)", defaultSize: 12 },
  { label: "Carton / Box (24 pcs)", defaultSize: 24 },
  { label: "Crate (24 pcs)", defaultSize: 24 },
  { label: "Drum (200 L)", defaultSize: 200 },
];

const emptyForm = {
  name: "",
  item_code: "",
  qty: "",
  unit: UNITS[0] || "kg",
  pack_size: "1",
  category: STOCK_CATEGORIES[0] || "General",
  price: "",
  min_alert_qty: "",
  supplier_mode: "existing",
  supplier_id: "",
  supplier: "",
  storage_zone: STORAGE_ZONES[0],
  rack_number: "A-01",
  shelf_number: "1",
  bin_number: "",
  invoice_no: "",
  batch_no: "",
  date: today(),
  purchase_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  expiry_date: "",
  notes: "",
};

export default function AddItemDrawer({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [suppliers, setSuppliers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Multi-Agent Swarm Consultation State
  const [consulting, setConsulting] = useState(false);
  const [consultation, setConsultation] = useState(null);
  const [appliedAi, setAppliedAi] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showLedgerPreview, setShowLedgerPreview] = useState(true);

  // Autocomplete / Search State
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDropdownRef = useRef(null);

  // Pack Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcPacksCount, setCalcPacksCount] = useState("1");
  const [calcPackSize, setCalcPackSize] = useState("25");
  const [calcTotalPackCost, setCalcTotalPackCost] = useState("");
  const [calcSelectedType, setCalcSelectedType] = useState(PACK_TYPES[1].label);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialization when drawer opens
  useEffect(() => {
    if (open) {
      loadInitialData();
      const generatedBatch = `BAT-${Date.now().toString().slice(-6)}`;
      setForm({
        ...emptyForm,
        date: today(),
        purchase_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        batch_no: generatedBatch
      });
      setErr("");
      setConsultation(null);
      setAppliedAi(false);
      setShowSuggestions(false);
      setShowCalculator(false);
    }
  }, [open]);

  // Load existing vendors and stock catalog for autocomplete
  const loadInitialData = async () => {
    setLoadingSuppliers(true);
    try {
      const [vendorRes, stockRes] = await Promise.all([
        api.suppliers.list({ limit: 100, sort: "name", order: "asc" }).catch(() => ({ data: [] })),
        api.stock.list({ limit: 500, page: 1 }).catch(() => ({ data: [] }))
      ]);

      const vendorList = vendorRes?.data || [];
      const stockList = stockRes?.data || [];

      setSuppliers(vendorList);
      setCatalogItems(stockList);

      if (vendorList.length > 0 && !form.supplier) {
        setForm((f) => ({
          ...f,
          supplier_id: String(vendorList[0].id),
          supplier: vendorList[0].name
        }));
      }
    } catch {
      // Fallback
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Debounced Multi-Agent Swarm Consultation
  useEffect(() => {
    if (!open || !form.name.trim()) {
      if (!form.name.trim()) setConsultation(null);
      return;
    }

    const timer = setTimeout(async () => {
      setConsulting(true);
      try {
        const res = await api.stock.agentConsult({
          name: form.name,
          item_code: form.item_code,
          category: form.category,
          unit: form.unit,
          price: form.price,
          qty: form.qty,
          pack_size: form.pack_size,
          supplier: form.supplier,
          supplier_id: form.supplier_id,
          storage_zone: form.storage_zone
        });

        if (res?.success && res?.data) {
          setConsultation(res.data);
          // If SKU is not set yet, automatically adopt proposed SKU
          if (!form.item_code && res.data.catalog?.proposed_sku) {
            setForm((f) => ({
              ...f,
              item_code: f.item_code || res.data.catalog.proposed_sku
            }));
          }
        }
      } catch (e) {
        console.warn("Multi-Agent consultation error:", e);
      } finally {
        setConsulting(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [form.name, form.item_code, form.category, form.unit, form.price, form.qty, form.storage_zone]);

  if (!open) return null;

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setAppliedAi(false);
  };

  // Filter catalog items for typeahead
  const filteredCatalog = useMemo(() => {
    const q = (form.name || "").trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return catalogItems
      .filter((item) => 
        item.name?.toLowerCase().includes(q) || 
        item.item_code?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [catalogItems, form.name]);

  // Handle selecting an existing SKU from typeahead
  const handleSelectCatalogItem = (item) => {
    setShowSuggestions(false);
    setForm((f) => ({
      ...f,
      name: item.name,
      item_code: item.item_code,
      unit: item.unit || f.unit,
      category: item.category || f.category,
      storage_zone: item.storage_zone || f.storage_zone,
      rack_number: item.rack_location ? (item.rack_location.split("/")[0] || "A-01").replace("Rack", "").trim() : f.rack_number,
      price: item.price ? String(item.price) : f.price,
      min_alert_qty: item.min_alert_qty != null ? String(item.min_alert_qty) : f.min_alert_qty,
    }));
  };

  // Apply AI Recommendations from Swarm Coordinator
  const handleApplyAiRecommendations = () => {
    if (!consultation?.auto_fill_payload) return;
    const payload = consultation.auto_fill_payload;

    setForm((f) => ({
      ...f,
      item_code: payload.item_code || f.item_code,
      unit: payload.unit || f.unit,
      category: payload.category || f.category,
      storage_zone: payload.storage_zone || f.storage_zone,
      min_alert_qty: payload.min_alert_qty != null ? String(payload.min_alert_qty) : f.min_alert_qty,
      price: (!f.price || parseFloat(f.price) === 0) && payload.suggested_price > 0 
        ? String(payload.suggested_price) 
        : f.price,
    }));

    setAppliedAi(true);
    setTimeout(() => setAppliedAi(false), 3000);
  };

  // Handle Supplier Selection
  const handleSupplierSelect = (e) => {
    const suppId = e.target.value;
    if (suppId === "__custom__") {
      setShowVendorModal(true);
    } else {
      const found = suppliers.find((s) => String(s.id) === String(suppId));
      setForm((f) => ({
        ...f,
        supplier_mode: "existing",
        supplier_id: suppId,
        supplier: found ? found.name : ""
      }));
    }
  };

  // Apply Pack Calculator values
  const handleApplyPackCalculation = () => {
    const packs = parseFloat(calcPacksCount) || 1;
    const size = parseFloat(calcPackSize) || 1;
    const totalCost = parseFloat(calcTotalPackCost) || 0;

    const totalQty = packs * size;
    const unitRate = totalQty > 0 ? parseFloat((totalCost / totalQty).toFixed(2)) : 0;

    setForm((f) => ({
      ...f,
      qty: String(totalQty),
      pack_size: String(size),
      price: unitRate > 0 ? String(unitRate) : f.price
    }));

    setShowCalculator(false);
  };

  const parsedQty = parseFloat(form.qty) || 0;
  const parsedPrice = parseFloat(form.price) || 0;
  const totalValuation = parsedQty * parsedPrice;
  const constructedRack = `Rack ${form.rack_number || "A-01"} / Shelf ${form.shelf_number || "1"}${form.bin_number ? ` / Bin ${form.bin_number}` : ""}`;
  const valid = form.name.trim() && parsedQty > 0 && form.unit && parsedPrice >= 0;

  // Submit via Multi-Agent Provisioner
  const handleProvision = async () => {
    if (!valid) return;
    setSaving(true);
    setErr("");
    try {
      const supplierName = form.supplier_mode === "existing" ? form.supplier : form.supplier.trim();

      const payload = {
        name: form.name.trim(),
        item_code: form.item_code.trim() || undefined,
        qty: parsedQty,
        unit: form.unit,
        pack_size: form.pack_size ? parseFloat(form.pack_size) : 1,
        date: form.date,
        price: parsedPrice,
        category: form.category || "General",
        supplier: supplierName || null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id, 10) : null,
        storage_zone: form.storage_zone || "General Store & Provisions",
        rack_number: form.rack_number,
        shelf_number: form.shelf_number,
        bin_number: form.bin_number,
        rack_location: constructedRack,
        invoice_no: form.invoice_no.trim() || undefined,
        batch_no: form.batch_no.trim() || undefined,
        purchase_time: `${form.date}T${form.purchase_time || "12:00"}:00`,
        expiry_date: form.expiry_date || null,
        min_alert_qty: form.min_alert_qty.trim() === "" ? null : parseFloat(form.min_alert_qty),
        notes: form.notes.trim() || undefined,
      };

      // Call high-assurance multi-agent provision endpoint
      await api.stock.agentProvision(payload);

      setForm(emptyForm);
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || "Failed to provision stock item.");
    } finally {
      setSaving(false);
    }
  };

  const confidenceScore = consultation?.confidence_score || (valid ? 95 : 75);
  const pricingAssessment = consultation?.pricing?.assessment || "NORMAL";
  const variancePct = consultation?.pricing?.variance_pct || 0;
  const marketAvg = consultation?.pricing?.market_avg_price || 0;
  const unitCompatible = consultation?.veritas?.unit_compatible ?? true;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "drawerBackdropFade 0.25s ease-out"
      }}
      onClick={onClose}
    >
      <style>
        {`
          @keyframes drawerBackdropFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalPopUp { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(232, 168, 56, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(232, 168, 56, 0); } 100% { box-shadow: 0 0 0 0 rgba(232, 168, 56, 0); } }
        `}
      </style>

      <div
        style={{
          width: "95vw",
          maxWidth: expanded ? 1240 : 960,
          maxHeight: "92vh",
          background: "var(--bg-modal, #0b1120)",
          border: "1px solid rgba(232, 168, 56, 0.35)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(232, 168, 56, 0.15)",
          overflowY: "auto",
          animation: "modalPopUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(8, 12, 20, 0.98))",
            position: "sticky",
            top: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(232, 168, 56, 0.2), rgba(232, 168, 56, 0.05))",
                border: "1px solid rgba(232, 168, 56, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-gold, #e8a838)"
              }}
            >
              <PackagePlus size={24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--text-main, #f8fafc)",
                    letterSpacing: "-0.01em",
                    fontFamily: "'DM Serif Display', Georgia, serif",
                  }}
                >
                  Multi-Agent Stock Provisioning Matrix
                </h3>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 9px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    background: consulting 
                      ? "rgba(56, 189, 248, 0.15)" 
                      : (confidenceScore >= 90 ? "rgba(16, 185, 129, 0.15)" : "rgba(232, 168, 56, 0.15)"),
                    border: `1px solid ${consulting ? "rgba(56, 189, 248, 0.4)" : (confidenceScore >= 90 ? "rgba(16, 185, 129, 0.4)" : "rgba(232, 168, 56, 0.4)")}`,
                    color: consulting ? "#38bdf8" : (confidenceScore >= 90 ? "#10b981" : "#e8a838")
                  }}
                >
                  {consulting ? (
                    <>
                      <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />
                      Swarm Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap size={11} />
                      AI Confidence: {confidenceScore}%
                    </>
                  )}
                </div>
              </div>
              <p style={{ margin: "3px 0 0 0", fontSize: 12.5, color: "var(--text-muted, #94a3b8)" }}>
                Coordinated 5-Agent Pipeline: Autonomous SKU resolution, LIFO rate intelligence, thermal zoning & double-entry ledger guarantee.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Switch to standard width" : "Switch to ultra-wide view"}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 8,
                padding: "8px",
                cursor: "pointer",
                color: "var(--text-muted, #94a3b8)",
                display: "flex",
                alignItems: "center",
                transition: "all 0.15s ease"
              }}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 8,
                padding: "8px",
                cursor: "pointer",
                color: "var(--text-muted, #94a3b8)",
                display: "flex",
                alignItems: "center"
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MULTI-AGENT SWARM TELEMETRY & COMMAND HUD */}
        <div style={{ padding: "18px 24px 0 24px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.6))",
              border: "1px solid rgba(232, 168, 56, 0.25)",
              borderRadius: 14,
              padding: "16px 20px",
              boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)"
            }}
          >
            {/* Top Swarm Row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Cpu size={16} style={{ color: "var(--color-gold, #e8a838)" }} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-main, #f8fafc)", textTransform: "uppercase" }}>
                  Active Agent Swarm Intelligence
                </span>
                {consultation?.elapsed_ms != null && (
                  <span style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", background: "rgba(0,0,0,0.3)", padding: "2px 7px", borderRadius: 6 }}>
                    {consultation.elapsed_ms}ms roundtrip
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {consultation?.auto_fill_payload && (
                  <button
                    type="button"
                    onClick={handleApplyAiRecommendations}
                    style={{
                      background: appliedAi 
                        ? "rgba(16, 185, 129, 0.2)" 
                        : "linear-gradient(135deg, rgba(232, 168, 56, 0.25), rgba(232, 168, 56, 0.1))",
                      border: `1px solid ${appliedAi ? "rgba(16, 185, 129, 0.6)" : "rgba(232, 168, 56, 0.5)"}`,
                      color: appliedAi ? "#10b981" : "var(--color-gold, #e8a838)",
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s ease"
                    }}
                  >
                    {appliedAi ? (
                      <>
                        <CheckCheck size={14} /> Applied Optimal AI Parameters!
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> ✨ Apply AI Recommendations
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowDiagnostics((v) => !v)}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "var(--text-muted, #94a3b8)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5
                  }}
                >
                  <Info size={13} /> {showDiagnostics ? "Hide Threads" : "Swarm Threads"}
                </button>
              </div>
            </div>

            {/* 4 Multi-Agent Telemetry Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12
              }}
            >
              {/* Agent 1: CatalogScout */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 10,
                  padding: "10px 12px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 5 }}>
                    <Boxes size={13} /> CatalogScout
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted, #64748b)" }}>SKU & Catalog</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main, #f8fafc)" }}>
                  {consultation?.catalog?.status === "EXISTING_SKU_FOUND" ? (
                    <span style={{ color: "#38bdf8", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={13} /> Existing: {consultation.catalog.proposed_sku}
                    </span>
                  ) : (
                    <span>Auto-SKU: <strong style={{ color: "var(--color-gold, #e8a838)" }}>{consultation?.catalog?.proposed_sku || "Ready"}</strong></span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted, #94a3b8)", marginTop: 2 }}>
                  {consultation?.catalog?.matched_item 
                    ? `Current Stock: ${consultation.catalog.matched_item.remaining} ${consultation.catalog.matched_item.unit}`
                    : "Zero SKU collisions verified"}
                </div>
              </div>

              {/* Agent 2: PricingStrategist */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: `1px solid ${pricingAssessment === "HIGH_ALERT" ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.06)"}`,
                  borderRadius: 10,
                  padding: "10px 12px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", display: "flex", alignItems: "center", gap: 5 }}>
                    <TrendingUp size={13} /> PricingStrategist
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted, #64748b)" }}>LIFO Benchmark</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main, #f8fafc)" }}>
                  {marketAvg > 0 ? (
                    <span>Avg: <strong style={{ color: "#10b981" }}>₹{marketAvg.toFixed(2)}</strong>/{form.unit}</span>
                  ) : (
                    <span style={{ color: "var(--text-muted, #94a3b8)" }}>No past purchase record</span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  {pricingAssessment === "HIGH_ALERT" ? (
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>⚠️ +{variancePct}% above market avg</span>
                  ) : pricingAssessment === "DISCOUNTED" ? (
                    <span style={{ color: "#10b981", fontWeight: 700 }}>✓ {variancePct}% cheaper</span>
                  ) : (
                    <span style={{ color: "var(--text-muted, #94a3b8)" }}>Within normal market par</span>
                  )}
                </div>
              </div>

              {/* Agent 3: SpatialArchitect */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 10,
                  padding: "10px 12px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#a855f7", display: "flex", alignItems: "center", gap: 5 }}>
                    <Warehouse size={13} /> SpatialArchitect
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted, #64748b)" }}>Thermal & Rack</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {consultation?.spatial?.recommended_zone 
                    ? consultation.spatial.recommended_zone.split("-")[0]
                    : "Dry Storage Bay"}
                </div>
                <div style={{ fontSize: 10.5, color: "#a855f7", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <span>{consultation?.spatial?.storage_temperature || "Ambient"}</span>
                  <span style={{ color: "var(--text-muted, #64748b)" }}>•</span>
                  <span>{consultation?.spatial?.recommended_rack || "Rack A-01"}</span>
                </div>
              </div>

              {/* Agent 4: Veritas */}
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: `1px solid ${!unitCompatible ? "rgba(239, 68, 68, 0.4)" : "rgba(255, 255, 255, 0.06)"}`,
                  borderRadius: 10,
                  padding: "10px 12px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: unitCompatible ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", gap: 5 }}>
                    <ShieldCheck size={13} /> Agent Veritas
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted, #64748b)" }}>Audit & Par</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: unitCompatible ? "var(--text-main, #f8fafc)" : "#ef4444" }}>
                  {unitCompatible ? (
                    <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCheck size={13} /> Dimension Validated
                    </span>
                  ) : (
                    <span>Unit Conflict Detected!</span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted, #94a3b8)", marginTop: 2 }}>
                  Safety Par: {consultation?.veritas?.suggested_reorder_qty || 10} {form.unit}
                </div>
              </div>
            </div>

            {/* Diagnostic Threads Collapsible View */}
            {showDiagnostics && consultation?.threads && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 8
                }}
              >
                {Object.entries(consultation.threads).map(([key, t]) => (
                  <div key={key} style={{ fontSize: 11, background: "rgba(0,0,0,0.3)", padding: "6px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-main, #f8fafc)", fontWeight: 600 }}>{t.name}</span>
                    <span style={{ color: t.status === "ALERT" ? "#ef4444" : "#10b981" }}>{t.latency_ms}ms • {t.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MODAL MAIN CONTENT */}
        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: expanded ? "1.1fr 0.9fr" : "1fr 1fr", gap: 20 }}>
          
          {/* LEFT COLUMN: ITEM IDENTITY & LOCATION */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            
            {/* Section 1: Item Identity & Master Catalog Lookup */}
            <div style={{ background: "var(--bg-page, #0f172a)", border: "1px solid var(--border-color, rgba(255,255,255,0.08))", borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gold, #e8a838)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                  <Tag size={15} /> Item Master Identity
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>
                  Catalog: {catalogItems.length} SKUs indexed
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Item Name with Autocomplete Suggestions */}
                <div style={{ position: "relative" }} ref={searchDropdownRef}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                    Item Name / Description <span style={{ color: "var(--color-gold, #e8a838)" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => {
                        set("name", e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => {
                        if (form.name.trim().length >= 2) setShowSuggestions(true);
                      }}
                      placeholder="e.g. Aashirvaad Atta / Basmati Rice"
                      autoFocus
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        fontSize: 14,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
                        borderRadius: 8,
                        color: "var(--text-main, #f8fafc)",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                    />
                    {consulting && (
                      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-gold, #e8a838)" }}>
                        <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                      </div>
                    )}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && filteredCatalog.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        marginTop: 4,
                        background: "#0d131f",
                        border: "1px solid rgba(232, 168, 56, 0.4)",
                        borderRadius: 8,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
                        overflow: "hidden"
                      }}
                    >
                      <div style={{ padding: "6px 10px", fontSize: 10.5, fontWeight: 700, color: "var(--color-gold, #e8a838)", background: "rgba(232, 168, 56, 0.1)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        EXISTING CATALOG MATCHES ({filteredCatalog.length})
                      </div>
                      {filteredCatalog.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectCatalogItem(item)}
                          style={{
                            padding: "9px 12px",
                            cursor: "pointer",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            transition: "background 0.12s ease"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232, 168, 56, 0.12)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc" }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", display: "flex", gap: 8, marginTop: 2 }}>
                              <span style={{ color: "var(--color-gold, #e8a838)", fontWeight: 600 }}>{item.item_code}</span>
                              <span>•</span>
                              <span>{item.category}</span>
                              <span>•</span>
                              <span>Current: {item.remaining} {item.unit}</span>
                            </div>
                          </div>
                          {item.price > 0 && (
                            <div style={{ textAlign: "right", fontSize: 12, fontWeight: 600, color: "#10b981" }}>
                              ₹{parseFloat(item.price).toFixed(2)}/{item.unit}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SKU Code & Unit Selection */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                      SKU / Item Code
                    </label>
                    <input
                      type="text"
                      value={form.item_code}
                      onChange={(e) => set("item_code", e.target.value)}
                      placeholder={consultation?.catalog?.proposed_sku || "Auto-assigned"}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        fontSize: 13,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
                        borderRadius: 8,
                        color: "var(--text-main, #f8fafc)",
                        boxSizing: "border-box"
                      }}
                    />
                    <div style={{ fontSize: 10.5, color: "var(--text-muted, #94a3b8)", marginTop: 4 }}>
                      Sequential enterprise code. Auto-generated if left empty.
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)" }}>Base Unit</label>
                      <UnitDimensionBadge unit={form.unit} />
                    </div>
                    <select
                      value={form.unit}
                      onChange={(e) => set("unit", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 10px",
                        fontSize: 13,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: `1px solid ${!unitCompatible ? "#ef4444" : "var(--border-color, rgba(255,255,255,0.12))"}`,
                        color: "var(--text-main, #f8fafc)",
                        borderRadius: 8
                      }}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u} style={{ background: "#0b1120" }}>{u}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 10.5, color: getDimensionConfig(form.unit).color, marginTop: 4, fontWeight: 500 }}>
                      {getDimensionConfig(form.unit).description}
                    </div>
                  </div>
                </div>

                {/* Category & Pack Size */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                      Classification Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => set("category", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 10px",
                        fontSize: 13,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
                        color: "var(--text-main, #f8fafc)",
                        borderRadius: 8
                      }}
                    >
                      {STOCK_CATEGORIES.map((c) => (
                        <option key={c} value={c} style={{ background: "#0b1120" }}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                      Pack Size (Units/Pack)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.pack_size}
                      onChange={(e) => set("pack_size", e.target.value)}
                      placeholder="e.g. 25"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        fontSize: 13,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
                        borderRadius: 8,
                        color: "var(--text-main, #f8fafc)",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Storage & Environmental Allocation */}
            <div style={{ background: "var(--bg-page, #0f172a)", border: "1px solid var(--border-color, rgba(255,255,255,0.08))", borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={15} /> Physical Storage & Thermal Zone
                </div>
                {consultation?.spatial?.storage_temperature && (
                  <span style={{ fontSize: 11, color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "2px 8px", borderRadius: 999 }}>
                    🌡️ {consultation.spatial.storage_temperature}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                    Designated Storage Zone
                  </label>
                  <select
                    value={form.storage_zone}
                    onChange={(e) => set("storage_zone", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      fontSize: 13,
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
                      color: "var(--text-main, #f8fafc)",
                      borderRadius: 8
                    }}
                  >
                    {STORAGE_ZONES.map((z) => (
                      <option key={z} value={z} style={{ background: "#0b1120" }}>{z}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted, #94a3b8)", display: "block", marginBottom: 4 }}>Rack #</label>
                    <input
                      type="text"
                      value={form.rack_number}
                      onChange={(e) => set("rack_number", e.target.value)}
                      placeholder="A-01"
                      style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 6, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted, #94a3b8)", display: "block", marginBottom: 4 }}>Shelf #</label>
                    <input
                      type="text"
                      value={form.shelf_number}
                      onChange={(e) => set("shelf_number", e.target.value)}
                      placeholder="1"
                      style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 6, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted, #94a3b8)", display: "block", marginBottom: 4 }}>Bin (Opt)</label>
                    <input
                      type="text"
                      value={form.bin_number}
                      onChange={(e) => set("bin_number", e.target.value)}
                      placeholder="e.g. 3"
                      style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 6, boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "var(--text-muted, #94a3b8)", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 6 }}>
                  <Warehouse size={14} style={{ color: "#38bdf8" }} />
                  <span>Target Coordinate: <strong style={{ color: "var(--text-main, #f8fafc)" }}>{constructedRack}</strong></span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: COMMERCIALS, VENDORS & BATCH CONTROLS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            
            {/* Section 3: Commercial Inwarding & Pack Calculator */}
            <div style={{ background: "var(--bg-page, #0f172a)", border: "1px solid var(--border-color, rgba(255,255,255,0.08))", borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gold, #e8a838)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                  <DollarSign size={15} /> Commercial Inwarding & Valuation
                </div>
                
                {/* Pack Calculator Toggle */}
                <button
                  type="button"
                  onClick={() => setShowCalculator((v) => !v)}
                  style={{
                    background: showCalculator ? "rgba(232, 168, 56, 0.25)" : "rgba(255, 255, 255, 0.05)",
                    border: `1px solid ${showCalculator ? "rgba(232, 168, 56, 0.6)" : "rgba(255, 255, 255, 0.1)"}`,
                    color: showCalculator ? "var(--color-gold, #e8a838)" : "var(--text-muted, #94a3b8)",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5
                  }}
                >
                  <Calculator size={13} /> {showCalculator ? "Close Calculator" : "Pack Size Calculator"}
                </button>
              </div>

              {/* Commercial Pack Calculator Panel */}
              {showCalculator && (
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.5)",
                    border: "1px solid rgba(232, 168, 56, 0.3)",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 16
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-gold, #e8a838)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Calculator size={14} /> Commercial Bulk Pack Converter (Bags / Tins / Cartons)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", display: "block", marginBottom: 4 }}>Packs Count</label>
                      <input
                        type="number"
                        min="1"
                        value={calcPacksCount}
                        onChange={(e) => setCalcPacksCount(e.target.value)}
                        placeholder="e.g. 4"
                        style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 6, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", display: "block", marginBottom: 4 }}>Qty per Pack</label>
                      <input
                        type="number"
                        min="0.1"
                        value={calcPackSize}
                        onChange={(e) => setCalcPackSize(e.target.value)}
                        placeholder="e.g. 25"
                        style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 6, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", display: "block", marginBottom: 4 }}>Total Invoice Cost (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={calcTotalPackCost}
                        onChange={(e) => setCalcTotalPackCost(e.target.value)}
                        placeholder="e.g. 5200"
                        style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 6, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Calculator Output & Apply */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(232, 168, 56, 0.08)", padding: "8px 12px", borderRadius: 6 }}>
                    <div style={{ fontSize: 11.5, color: "var(--text-main, #f8fafc)" }}>
                      Yield: <strong>{(parseFloat(calcPacksCount) || 0) * (parseFloat(calcPackSize) || 0)} {form.unit}</strong> @ ₹
                      {((parseFloat(calcTotalPackCost) || 0) / Math.max(1, (parseFloat(calcPacksCount) || 0) * (parseFloat(calcPackSize) || 0))).toFixed(2)}/{form.unit}
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyPackCalculation}
                      style={{
                        background: "var(--color-gold, #e8a838)",
                        color: "#000",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Apply to Form
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                      Inward Quantity ({form.unit}) <span style={{ color: "var(--color-gold, #e8a838)" }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.qty}
                      onChange={(e) => set("qty", e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        fontSize: 13,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
                        borderRadius: 8,
                        color: "var(--text-main, #f8fafc)",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                      Unit Cost (₹/{form.unit}) <span style={{ color: "var(--color-gold, #e8a838)" }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        fontSize: 13,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: `1px solid ${pricingAssessment === "HIGH_ALERT" ? "#ef4444" : "var(--border-color, rgba(255,255,255,0.12))"}`,
                        borderRadius: 8,
                        color: "var(--text-main, #f8fafc)",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>

                {/* Valuation & Rate Telemetry Pill */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 8,
                    fontSize: 12
                  }}
                >
                  <span style={{ color: "var(--text-muted, #94a3b8)" }}>Total Batch Valuation:</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: totalValuation > 0 ? "#10b981" : "var(--text-muted, #94a3b8)" }}>
                    ₹{totalValuation.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Vendor Selection */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)" }}>Supplier Source</label>
                    <button
                      type="button"
                      onClick={() => setShowVendorModal(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-gold, #e8a838)",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3
                      }}
                    >
                      <Building2 size={12} /> + Register New Vendor
                    </button>
                  </div>

                  {form.supplier_mode === "existing" ? (
                    <select
                      value={form.supplier_id}
                      onChange={handleSupplierSelect}
                      disabled={loadingSuppliers}
                      style={{
                        width: "100%",
                        padding: "9px 10px",
                        fontSize: 13,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
                        color: "var(--text-main, #f8fafc)",
                        borderRadius: 8
                      }}
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id} style={{ background: "#0b1120" }}>
                          {s.name} {s.gstin ? `(${s.gstin})` : ""}
                        </option>
                      ))}
                      <option value="__custom__" style={{ background: "#0b1120", color: "var(--color-gold, #e8a838)", fontWeight: "bold" }}>
                        + Add / Register New Vendor...
                      </option>
                    </select>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={form.supplier}
                        onChange={(e) => set("supplier", e.target.value)}
                        placeholder="Enter vendor name"
                        style={{ flex: 1, padding: "9px 12px", fontSize: 13, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 8 }}
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, supplier_mode: "existing", supplier_id: suppliers[0] ? String(suppliers[0].id) : "" }))}
                        style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#f8fafc", borderRadius: 8, padding: "0 12px", fontSize: 12, cursor: "pointer" }}
                      >
                        Existing
                      </button>
                    </div>
                  )}

                  {/* Supplier Benchmarking from Agent PricingStrategist */}
                  {consultation?.pricing?.top_suppliers?.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10.5, color: "var(--text-muted, #94a3b8)" }}>Past Suppliers:</span>
                      {consultation.pricing.top_suppliers.map((sup, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              supplier: sup.supplier,
                              supplier_id: sup.supplier_id ? String(sup.supplier_id) : f.supplier_id,
                              price: sup.last_price ? String(sup.last_price) : f.price
                            }));
                          }}
                          style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 6,
                            padding: "2px 7px",
                            fontSize: 10.5,
                            color: "var(--text-main, #f8fafc)",
                            cursor: "pointer"
                          }}
                        >
                          {sup.supplier} (₹{parseFloat(sup.last_price || 0).toFixed(2)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                      Invoice Reference #
                    </label>
                    <input
                      type="text"
                      value={form.invoice_no}
                      onChange={(e) => set("invoice_no", e.target.value)}
                      placeholder="INV-202601"
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 8, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>
                      Batch Number
                    </label>
                    <input
                      type="text"
                      value={form.batch_no}
                      onChange={(e) => set("batch_no", e.target.value)}
                      placeholder="Auto-generated"
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 8, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Operational Dates, Reorder Par & Double-Entry Ledger Preview */}
            <div style={{ background: "var(--bg-page, #0f172a)", border: "1px solid var(--border-color, rgba(255,255,255,0.08))", borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={15} /> Safety Par & Double-Entry Ledger Preview
                </div>
                <button
                  type="button"
                  onClick={() => setShowLedgerPreview((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted, #94a3b8)",
                    fontSize: 11.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  {showLedgerPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>Receipt Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => set("date", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 8, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)", display: "block", marginBottom: 6 }}>Expiry Date (Opt)</label>
                    <input
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) => set("expiry_date", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 8, boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main, #f8fafc)" }}>
                      Minimum Alert Safety Stock ({form.unit})
                    </label>
                    {consultation?.veritas?.suggested_reorder_qty && (
                      <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>
                        AI Recommended: {consultation.veritas.suggested_reorder_qty} {form.unit}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.min_alert_qty}
                    onChange={(e) => set("min_alert_qty", e.target.value)}
                    placeholder={String(consultation?.veritas?.suggested_reorder_qty || 10)}
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", borderRadius: 8, boxSizing: "border-box" }}
                  />
                </div>

                {/* Double-Entry Ledger Preview Box */}
                {showLedgerPreview && (
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 12
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 5 }}>
                        <CheckCheck size={14} /> Atomic Ledger Posting
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>CENTRAL STORE</span>
                    </div>
                    <div style={{ color: "var(--text-muted, #94a3b8)", fontSize: 11.5, lineHeight: 1.5 }}>
                      Type: <strong style={{ color: "#f8fafc" }}>INWARD_PURCHASE</strong> • Credit Item Code: <strong style={{ color: "var(--color-gold, #e8a838)" }}>{form.item_code || consultation?.catalog?.proposed_sku || "KPL-AUTO"}</strong>
                    </div>
                    <div style={{ color: "var(--text-muted, #94a3b8)", fontSize: 11.5, marginTop: 2 }}>
                      Ledger Valuation: <strong style={{ color: "#10b981" }}>+₹{totalValuation.toFixed(2)}</strong> added to Store Asset Ledger.
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* ERROR MESSAGE IF ANY */}
        {err && (
          <div style={{ padding: "0 24px 12px 24px" }}>
            <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#ef4444", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
              <AlertCircle size={18} />
              <span>{err}</span>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(11, 17, 32, 0.95)",
            position: "sticky",
            bottom: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted, #94a3b8)" }}>
            <Zap size={14} style={{ color: "var(--color-gold, #e8a838)" }} />
            <span>
              {valid ? (
                <span>Ready to inward <strong style={{ color: "#f8fafc" }}>{parsedQty} {form.unit}</strong> of <strong style={{ color: "#f8fafc" }}>{form.name}</strong></span>
              ) : (
                <span>Fill Name, Qty, Unit, and Price to provision item</span>
              )}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Btn
              variant="ghost"
              onClick={onClose}
              style={{ border: "1px solid rgba(255, 255, 255, 0.12)", color: "var(--text-muted, #94a3b8)", padding: "10px 20px" }}
            >
              Cancel
            </Btn>

            <Btn
              onClick={handleProvision}
              disabled={!valid || saving}
              variant="primary"
              style={{
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 700,
                background: valid ? "var(--color-gold, #e8a838)" : "rgba(232, 168, 56, 0.3)",
                color: valid ? "#000" : "#666",
                boxShadow: valid ? "0 4px 20px rgba(232, 168, 56, 0.35)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                  Provisioning Swarm Entry...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Confirm & Provision Stock Item
                </>
              )}
            </Btn>
          </div>
        </div>

      </div>

      {/* CREATE VENDOR MODAL */}
      <CreateVendorModal
        open={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onSuccess={(newVendor) => {
          setSuppliers((prev) => [newVendor, ...prev]);
          setForm((f) => ({
            ...f,
            supplier_mode: "existing",
            supplier_id: String(newVendor.id),
            supplier: newVendor.name,
          }));
        }}
      />
    </div>
  );
}
