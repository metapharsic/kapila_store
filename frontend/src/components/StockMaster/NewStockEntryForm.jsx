import { useState, useEffect, useRef } from "react";
import Input from "../Input";
import Select from "../Select";
import Btn from "../Btn";
import { COLORS, UNITS } from "../../styles/colors";
import { useAppContext } from "../../context/AppContext";
import { useLocalSpeech } from "../../hooks/useLocalSpeech";
import { useBreakpoint } from "../../styles/responsive";
import * as api from "../../api";
import { today } from "../../utils/dates";
import { PlusCircle, Plus, Trash2, Camera, Mic, RefreshCw, ChevronDown, ChevronUp, Upload, Building2, Sparkles, CheckCircle2 } from "lucide-react";
import CreateVendorModal from "../CreateVendorModal";
import MultiAgentStatusBar from "../MultiAgentStatusBar";
import LIFOSuggestionBanner from "../LIFOSuggestionBanner";

const toTitleCase = (str) => {
  if (!str) return "";
  return str.trim().toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const blankItem = () => ({ id: Date.now() + Math.random(), name: "", qty: "", unit: "kg", price: "", item_code: "", expiry_date: "", min_alert_qty: "" });

export function NewStockEntryForm({ onSuccess, reorderItem }) {
  const { stockNames, stocks, refreshStockNames } = useAppContext();
  const { isMobile } = useBreakpoint();

  const [form, setForm] = useState({
    supplier: "", date: today(), freight: "", gst: "",
    items: [blankItem()]
  });
  const [msg, setMsg]   = useState("");
  const fileInputRef    = useRef();
  const cameraInputRef  = useRef();
  const csvFileInputRef = useRef();
  const [scanningBill, setScanningBill]     = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [importText, setImportText]           = useState("");
  const [activeRowIdx, setActiveRowIdx]       = useState(0);
  const [expandedCards, setExpandedCards]     = useState({});
  const [purchaseOrders, setPurchaseOrders]   = useState([]);
  const [selectedPoId, setSelectedPoId]       = useState("");
  const [supplierReliability, setSupplierReliability] = useState(null);
  const [suppliersList, setSuppliersList]     = useState([]);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [fieldSyncState, setFieldSyncState]   = useState(false);
  const [lastSyncName, setLastSyncName]       = useState("");
 
  const { listening, interimText, startRecording, stopRecording } = useLocalSpeech();
 
  useEffect(() => {
    const fetchPOs = async () => {
      try {
        const res = await api.purchaseOrders.list({ page: 1, limit: 100, status: "Sent" });
        setPurchaseOrders(res.data || []);
      } catch (err) {
        console.error("Failed to load POs in form", err);
      }
    };
    const fetchSuppliers = async () => {
      try {
        const res = await api.suppliers.list({ limit: 200, sort: "name", order: "asc" });
        setSuppliersList(res.data || []);
      } catch (err) {
        console.error("Failed to load suppliers in form", err);
      }
    };
    fetchPOs();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (reorderItem) {
      setShowQuickImport(false);
      const id = Date.now();
      setForm({
        supplier: reorderItem.supplier || "", date: today(), freight: "", gst: "",
        items: [{ id, name: reorderItem.name || "", qty: "", unit: reorderItem.unit || "kg", price: reorderItem.price != null ? reorderItem.price.toString() : "", item_code: reorderItem.item_code || "", expiry_date: "", min_alert_qty: reorderItem.min_alert_qty != null ? reorderItem.min_alert_qty.toString() : "" }]
      });
      setExpandedCards({ [id]: true });
      setMsg(`Form populated for ${reorderItem.name} ✓`);
      const t = setTimeout(() => setMsg(""), 3000); return () => clearTimeout(t);
    }
  }, [reorderItem]);

  const handlePOChange = async (poId) => {
    setSelectedPoId(poId);
    if (!poId) {
      setSupplierReliability(null);
      return;
    }
    setMsg("Loading PO details...");
    try {
      const res = await api.purchaseOrders.getOne(poId);
      if (res.success && res.data) {
        const po = res.data;
        const newItems = (po.items || []).map(it => ({
          id: Date.now() + Math.random(),
          name: it.name,
          qty: it.qty?.toString() || "",
          price: it.unit_price?.toString() || "",
          unit: it.unit || "kg",
          item_code: it.item_code || "",
          expiry_date: "",
          min_alert_qty: "",
          po_matched: true,
          po_qty: it.qty,
          po_price: it.unit_price
        }));
        setForm(prev => ({
          ...prev,
          supplier: po.supplier_name || prev.supplier,
          items: newItems
        }));
        if (isMobile) {
          setExpandedCards(Object.fromEntries(newItems.map(it => [it.id, false])));
        }
        if (po.supplier_id) {
          try {
            const supRes = await api.suppliers.performance(po.supplier_id);
            if (supRes.success && supRes.data && supRes.data.supplier) {
              setSupplierReliability(supRes.data.supplier.reliability_score);
            }
          } catch (e) {
            console.error("Failed to fetch supplier performance", e);
          }
        } else {
          setSupplierReliability(null);
        }
        setMsg(`Loaded PO ${po.po_number} details ✓`);
      } else {
        setMsg("Failed to load PO details.");
      }
    } catch (err) {
      setMsg("Error loading PO details: " + err.message);
    } finally {
      setTimeout(() => setMsg(""), 3000);
    }
  };
 
  const toggleCard = (id) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  const handleAutoFillLowStock = () => {
    const lowStock = stocks.filter((item) => {
      const pct = item.qty > 0 ? (item.remaining / item.qty) * 100 : 0;
      return item.min_alert_qty !== null ? item.remaining <= item.min_alert_qty : pct < 25;
    });
    if (lowStock.length === 0) { alert("No low stock items found."); return; }
    const newItems = lowStock.map(it => ({
      id: Date.now() + Math.random(), name: it.name, qty: (it.min_alert_qty ? it.min_alert_qty * 2 : 10).toString(),
      price: it.price != null ? it.price.toString() : "", unit: it.unit || "kg",
      item_code: it.item_code || "", expiry_date: "", min_alert_qty: it.min_alert_qty != null ? it.min_alert_qty.toString() : ""
    }));
    setForm(prev => ({ ...prev, items: newItems }));
    setMsg("Auto-filled low stock items ✓");
    setTimeout(() => setMsg(""), 3000);
  };

  const addRow = () => {
    const newItem = blankItem();
    setForm((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    if (isMobile) setExpandedCards(prev => ({ ...prev, [newItem.id]: true }));
  };

  const removeRow = (idx) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const clearAllItems = () => { const n = blankItem(); setForm(prev => ({ ...prev, items: [n] })); if (isMobile) setExpandedCards({ [n.id]: true }); };

  const updateItem = (idx, field, val) => {
    setForm((prev) => {
      const nextItems = prev.items.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: val };
        if (field === "name") {
          const matched = stocks.find(s => s.name.toLowerCase() === val.trim().toLowerCase());
          if (matched) {
            updated.unit = matched.unit || updated.unit;
            updated.item_code = matched.item_code;
            updated.price = matched.price != null ? matched.price.toString() : updated.price;
            updated.min_alert_qty = matched.min_alert_qty != null ? matched.min_alert_qty.toString() : updated.min_alert_qty;
          }
        }
        return updated;
      });
      return { ...prev, items: nextItems };
    });
  };

  const handleSelectLIFOBatch = (batch) => {
    if (activeRowIdx === null || !form.items[activeRowIdx]) return;
    setFieldSyncState(true);
    setLastSyncName(batch.name);
    updateItem(activeRowIdx, "unit", batch.unit);
    updateItem(activeRowIdx, "price", batch.unit_cost.toString());
    if (batch.item_code) {
      updateItem(activeRowIdx, "item_code", batch.item_code);
    }
    setMsg(`LIFO Batch ${batch.batch_no} synced (Unit: ${batch.unit}, Rate: ₹${batch.unit_cost}) ✓`);
    setTimeout(() => {
      setFieldSyncState(false);
      setMsg("");
    }, 2500);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        let startIndex = 0;
        const firstLineLower = lines[0].toLowerCase();
        if (firstLineLower.includes("item") || firstLineLower.includes("name") || firstLineLower.includes("qty")) {
          startIndex = 1;
        }

        const parsedItems = [];
        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(/[,;\t]/).map(p => p.trim());
          if (parts.length >= 2) {
            const name = parts[0];
            const qty = parseFloat(parts[1]) || 1;
            const unit = parts[2] || "kg";
            const price = parts[3] ? parseFloat(parts[3]) || "" : "";
            const expiry = parts[4] || "";

            parsedItems.push({
              id: Date.now() + Math.random(),
              name,
              qty: qty.toString(),
              unit,
              price: price.toString(),
              item_code: "",
              expiry_date: expiry,
              min_alert_qty: ""
            });
          }
        }

        if (parsedItems.length > 0) {
          setForm(prev => ({
            ...prev,
            items: [...(prev.items.length === 1 && !prev.items[0].name ? [] : prev.items), ...parsedItems]
          }));
          setMsg(`Uploaded and parsed ${parsedItems.length} items to purchase ✓`);
          setTimeout(() => setMsg(""), 3500);
        } else {
          setMsg("No valid items found in file. Format: Name, Qty, Unit, Price");
          setTimeout(() => setMsg(""), 4000);
        }
      } catch (err) {
        setMsg("Failed to parse file: " + err.message);
      } finally {
        e.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  const addAllToStore = async () => {
    const validItems = form.items.filter(it => it.name && it.qty);
    if (validItems.length === 0) { setMsg("Please add at least one item with a name and quantity."); setTimeout(() => setMsg(""), 3000); return; }
    setMsg("Adding items to store...");
    try {
      const gstVal      = parseFloat(form.gst) || 0;
      const freightVal  = parseFloat(form.freight) || 0;
      const freightPer  = validItems.length > 0 ? freightVal / validItems.length : 0;

      if (selectedPoId && navigator.onLine) {
        // Formal Goods Receipt (GRN) linked to PO
        const poRes = await api.purchaseOrders.getOne(selectedPoId);
        const po = poRes.data || {};
        const grnItems = validItems.map(it => {
          const basePrice = parseFloat(it.price) || 0;
          const qty = parseFloat(it.qty) || 0;
          const landed = qty > 0 ? (basePrice * (1 + gstVal / 100)) + (freightPer / qty) : basePrice;
          return {
            item_code: it.item_code || it.name.toUpperCase().replace(/\s+/g, "-").slice(0, 20),
            name: it.name,
            qty_ordered: it.po_qty != null ? parseFloat(it.po_qty) : qty,
            qty_received: qty,
            qty_accepted: qty,
            qty_rejected: 0,
            unit: it.unit || "kg",
            unit_price: basePrice,
            landed_cost: landed * qty,
            expiry_date: it.expiry_date || null
          };
        });

        await api.grn.create({
          po_id: parseInt(selectedPoId),
          supplier_id: po.supplier_id,
          date: form.date || today(),
          invoice_no: `INV-${Date.now().toString().slice(-6)}`,
          remarks: "Received via Store Manager Purchase Inward",
          items: grnItems
        });
      } else {
        // Direct non-PO stock inward
        for (const it of validItems) {
          const basePrice = parseFloat(it.price) || 0;
          const qty       = parseFloat(it.qty) || 0;
          const landed    = qty > 0 ? (basePrice * (1 + gstVal / 100)) + (freightPer / qty) : basePrice;

          const payload = {
            name: toTitleCase(it.name), qty, unit: it.unit || "kg",
            price: landed || null,
            supplier: form.supplier ? toTitleCase(form.supplier) : null,
            expiry_date: it.expiry_date || null,
            min_alert_qty: it.min_alert_qty ? parseFloat(it.min_alert_qty) : null,
            date: form.date || today()
          };

          if (!navigator.onLine) {
            const queue = JSON.parse(localStorage.getItem("kapila_offline_stock") || "[]");
            queue.push(payload);
            localStorage.setItem("kapila_offline_stock", JSON.stringify(queue));
          } else {
            await api.stock.create(payload);
          }
        }
      }

      const n = blankItem();
      setForm({ supplier: "", date: today(), freight: "", gst: "", items: [n] });
      setSelectedPoId("");
      setExpandedCards({ [n.id]: isMobile });
      setMsg("All stock added successfully ✓");
      setTimeout(() => setMsg(""), 3000);
      if (onSuccess) onSuccess();
      refreshStockNames();
    } catch (e) {
      setMsg("Error saving: " + e.message);
    }
  };

  const handleScanBill = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanningBill(true);
    setMsg("Scanning bill with AI...");
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      try {
        const res = await api.scan.purchase(base64, file.type || "image/jpeg", selectedPoId);
        if (res.success) {
          const newItems = res.data.items.map(it => ({
            id: Date.now() + Math.random(), name: it.name, qty: it.qty?.toString() || "",
            price: it.price?.toString() || "", unit: it.unit || "kg",
            item_code: it.item_code || "", expiry_date: "", min_alert_qty: "",
            po_matched: it.po_matched, po_qty: it.po_qty, po_price: it.po_price
          }));
          setForm(prev => ({ ...prev, supplier: res.data.supplier || prev.supplier, items: newItems }));
          if (isMobile) setExpandedCards(Object.fromEntries(newItems.map(it => [it.id, false])));
          setMsg(res.data.po_number ? `Scanned & matched against ${res.data.po_number} ✓` : "Bill scanned successfully ✓");
        } else { setMsg("Failed to parse bill."); }
      } catch (err) { setMsg("Scan error: " + err.message); }
      finally { setScanningBill(false); e.target.value = null; setTimeout(() => setMsg(""), 3000); }
    };
    reader.readAsDataURL(file);
  };

  const startListening = () => {
    if (listening) { stopRecording((s) => setMsg(s)); }
    else { startRecording((text) => { setImportText(prev => (prev.trim() ? prev.trim() + "\n" + text : text)); setMsg("Transcription complete ✓"); setTimeout(() => setMsg(""), 3000); }, (s) => setMsg(s)); }
  };

  const parseImportText = async () => {
    if (!importText.trim()) return;
    setMsg("Parsing text list with AI...");
    try {
      const res = await api.scan.text(importText);
      if (res.success) {
        const newItems = res.data.items.map(it => ({ id: Date.now() + Math.random(), name: it.name, qty: it.qty?.toString() || "", price: it.price?.toString() || "", unit: it.unit || "kg", item_code: it.item_code || "", expiry_date: "", min_alert_qty: "" }));
        setForm(prev => ({
          ...prev, supplier: res.data.supplier || prev.supplier,
          items: [...(prev.items.length === 1 && !prev.items[0].name ? [] : prev.items), ...newItems]
        }));
        if (isMobile) setExpandedCards(prev => ({ ...prev, ...Object.fromEntries(newItems.map(it => [it.id, false])) }));
        setShowQuickImport(false); setImportText(""); setMsg("Import parsed successfully ✓");
      } else { setMsg("Failed to parse text."); }
    } catch (err) { setMsg("Parse error: " + err.message); }
    finally { setTimeout(() => setMsg(""), 3000); }
  };

  return (
    <>
      <input ref={fileInputRef}   type="file" accept="image/*"                   style={{ display: "none" }} onChange={handleScanBill} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleScanBill} />
      <input ref={csvFileInputRef} type="file" accept=".csv,.tsv,.txt" style={{ display: "none" }} onChange={handleCSVUpload} />

      {/* ── Header row ── */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <p style={{ fontSize: isMobile ? 18 : 24, fontWeight: 800, color: COLORS.text, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <PlusCircle size={isMobile ? 18 : 24} style={{ color: COLORS.brand }} /> New Purchase Order
        </p>

        {/* Action buttons — 2×2 grid on mobile, flex row on desktop */}
        {isMobile ? (
          <div className="mob-action-grid">
            <button type="button" className="premium-btn" onClick={handleAutoFillLowStock} style={{ minHeight: 44 }}>
              <RefreshCw size={14} /> Auto-Fill
            </button>
            <button type="button" className="premium-btn" onClick={() => cameraInputRef.current.click()} disabled={scanningBill} style={{ minHeight: 44 }}>
              <Camera size={14} /> Camera
            </button>
            <button type="button" className="premium-btn" onClick={() => setShowQuickImport(!showQuickImport)} style={{ minHeight: 44 }}>
              <Mic size={14} /> Voice
            </button>
            <button type="button" className="premium-btn" onClick={() => fileInputRef.current.click()} disabled={scanningBill} style={{ minHeight: 44 }}>
              <Camera size={14} /> {scanningBill ? "Scanning…" : "Scan Doc"}
            </button>
            <button type="button" className="premium-btn" onClick={() => csvFileInputRef.current.click()} style={{ minHeight: 44, gridColumn: "1 / -1" }}>
              <Upload size={14} /> Upload Items File
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button type="button" className="premium-btn" onClick={handleAutoFillLowStock}><RefreshCw size={14} /> Auto-Fill Low Stock</button>
            <button type="button" className="premium-btn" onClick={() => cameraInputRef.current.click()} disabled={scanningBill}><Camera size={14} /> Scan using Camera</button>
            <button type="button" className="premium-btn" onClick={() => setShowQuickImport(!showQuickImport)}><Mic size={14} /> {showQuickImport ? "Hide Voice" : "Voice Input"}</button>
            <button type="button" className="premium-btn" onClick={() => fileInputRef.current.click()} disabled={scanningBill}><Camera size={14} /> {scanningBill ? "Scanning…" : "Scan Doc"}</button>
            <button type="button" className="premium-btn" onClick={() => csvFileInputRef.current.click()}><Upload size={14} /> Upload Items File</button>
          </div>
        )}
      </div>

      {/* ── Multi-Agent Swarm Status Bar ── */}
      <div style={{ marginBottom: 16 }}>
        <MultiAgentStatusBar
          syncing={fieldSyncState}
          lastSyncField={lastSyncName ? `Item "${lastSyncName}"` : null}
          customNote="Field Sync active across Vendor, LIFO Valuation, and Storage zones"
        />
      </div>

      {/* ── Voice / Quick Import panel ── */}
      {showQuickImport && (
        <div style={{ background: COLORS.surface, padding: 16, borderRadius: 8, border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
          <p style={{ fontSize: 15, color: COLORS.accent, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Mic size={16} /> Quick Dictate / Text Import
          </p>
          <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 12 }}>Type, paste WhatsApp text, or use voice dictation in local languages.</p>
          <div className="resp-form-grid" style={{ marginBottom: 10 }}>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={startListening} className={listening ? "pulse" : ""} style={{ padding: "8px 16px", fontSize: 13, background: listening ? COLORS.coral : COLORS.bg, border: `1px solid ${listening ? COLORS.coral : COLORS.border}`, color: listening ? "#fff" : COLORS.text, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, height: 35 }}>
                {listening ? "🛑 Stop" : "🎤 Start Dictation"}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="e.g. Tomato 10 kg rate 40" rows={4} style={{ width: "100%", padding: 10, fontSize: 13, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 4, resize: "vertical" }} />
            {interimText && <div style={{ fontSize: 12, color: COLORS.accent, marginTop: 6, padding: 8, background: COLORS.accent + "11", border: `1px dashed ${COLORS.accent}44`, borderRadius: 4 }}><span className="pulse">🎙️</span> <i>Hearing: "{interimText}"...</i></div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={parseImportText} style={{ flex: 1 }} disabled={!importText.trim()}>Parse &amp; Extract Items</Btn>
            <Btn variant="ghost" onClick={() => { setShowQuickImport(false); setImportText(""); }} style={{ border: `1px solid ${COLORS.border}` }}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* ── Invoice Details ── */}
      <div className="resp-form-grid" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Select
            label="Link Purchase Order (Optional)"
            value={selectedPoId}
            onChange={(e) => handlePOChange(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, height: 44, fontSize: 14 }}
          >
            <option value="">-- Select PO --</option>
            {purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.po_number} ({po.supplier_name || "Unknown"}) - ₹{parseFloat(po.total_amount).toFixed(2)}
              </option>
            ))}
          </Select>
          {supplierReliability !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 4 }}>
              <span style={{ color: COLORS.muted }}>Supplier Reliability:</span>
              <span style={{
                fontWeight: 700,
                color: supplierReliability >= 80 ? "#10B981" : supplierReliability >= 60 ? "#F59E0B" : "#EF4444",
                background: supplierReliability >= 80 ? "#ECFDF5" : supplierReliability >= 60 ? "#FFFBEB" : "#FEF2F2",
                padding: "2px 8px",
                borderRadius: 12
              }}>
                {supplierReliability}%
              </span>
            </div>
          )}
        </div>

        {/* Supplier / Vendor with + New Vendor CTA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>Supplier / Vendor</label>
            <button
              type="button"
              onClick={() => setShowVendorModal(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-gold, #f4c84b)",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <Building2 size={13} /> + New Vendor
            </button>
          </div>
          <input
            value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="Select or enter vendor..."
            list="suppliers-datalist"
            style={{
              width: "100%",
              padding: "10px 12px",
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              borderRadius: 8,
              height: 44,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <datalist id="suppliers-datalist">
            {suppliersList.map((s) => (
              <option key={s.id} value={s.name}>{s.name} {s.gstin ? `(${s.gstin})` : ""}</option>
            ))}
          </datalist>
        </div>

        <Input label="Date received" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        <Input label="GST / Tax (%)" type="number" value={form.gst} onChange={(e) => setForm((f) => ({ ...f, gst: e.target.value }))} placeholder="0" />
      </div>

      {/* ── LIFO Suggestion Banner for active item ── */}
      {form.items[activeRowIdx]?.name && (
        <div style={{ marginBottom: 16 }}>
          <LIFOSuggestionBanner
            itemName={form.items[activeRowIdx]?.name}
            itemCode={form.items[activeRowIdx]?.item_code}
            onSelectBatch={handleSelectLIFOBatch}
          />
        </div>
      )}

      {/* ── Purchase Items ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 24 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase" }}>Purchase Items</span>
        <button onClick={clearAllItems} style={{ background: "transparent", border: "none", color: COLORS.danger, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Trash2 size={14} /> Clear All
        </button>
      </div>

      {/* Desktop: Excel table */}
      {!isMobile && (
        <>
          <div className="resp-table-wrap" style={{ border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16, overflowX: "auto" }}>
            <table className="excel-table" style={{ minWidth: 750 }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 50 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="row-num">#</th>
                  <th>Item Name</th><th>Qty</th><th>Unit</th>
                  <th>Base Price</th><th>Expiry Date</th><th>Min Alert</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr key={it.id} className={`excel-row${activeRowIdx === idx ? " active-row" : ""}`} onClick={() => setActiveRowIdx(idx)}>
                    <td className="row-num">{idx + 1}</td>
                    <td style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input className="excel-input" value={it.name} onChange={(e) => updateItem(idx, "name", e.target.value)} placeholder="Item Name" list={`stock-names-${idx}`} style={{ flex: 1 }} />
                      <datalist id={`stock-names-${idx}`}>{stockNames.map((n) => <option key={n} value={n} />)}</datalist>
                      {it.po_matched && (
                        <span style={{ fontSize: 10, background: "rgba(232, 168, 56, 0.15)", color: "#e8a838", padding: "2px 6px", borderRadius: 4, fontWeight: 700, marginRight: 8, flexShrink: 0 }} title={`PO Matched: Ordered Qty ${it.po_qty}, PO Rate ₹${it.po_price}`}>
                          ✓ PO
                        </span>
                      )}
                    </td>
                    <td><input type="number" className="excel-input" value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} placeholder="0" /></td>
                    <td><select className="excel-input" value={it.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} style={{ padding: "4px 8px", border: "none", borderRadius: 0, height: "100%" }}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></td>
                    <td><input type="number" step="0.01" className="excel-input" value={it.price} onChange={(e) => updateItem(idx, "price", e.target.value)} placeholder="0.00" /></td>
                    <td><input type="date" className="excel-input" value={it.expiry_date} onChange={(e) => updateItem(idx, "expiry_date", e.target.value)} /></td>
                    <td><input type="number" className="excel-input" value={it.min_alert_qty} onChange={(e) => updateItem(idx, "min_alert_qty", e.target.value)} placeholder="e.g. 5" /></td>
                    <td><button onClick={(e) => { e.stopPropagation(); removeRow(idx); }} className="row-delete-btn" title="Delete Row"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "8px 12px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
              <button onClick={addRow} className="add-row-btn" style={{ background: "transparent", border: "none", color: COLORS.brand, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={14} /> Add Row
              </button>
            </div>
          </div>
          <Btn onClick={addAllToStore} style={{ width: "100%", height: 48, fontSize: 16, fontWeight: 700 }}>
            Confirm &amp; Save Purchase Order
          </Btn>
        </>
      )}

      {/* Mobile: Item Cards */}
      {isMobile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 80 }}>
          {form.items.map((it, idx) => {
            const isOpen = !!expandedCards[it.id];
            const hasName = !!it.name;
            return (
              <div key={it.id} className="mob-item-card">
                {/* Card header — tap to expand */}
                <div
                  className="mob-item-card-header"
                  onClick={() => toggleCard(it.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, display: "block", marginBottom: 2 }}>ITEM {idx + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: hasName ? COLORS.text : COLORS.muted }}>
                      {hasName ? it.name : "Tap to enter item details"}
                    </span>
                    {it.qty && <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 6 }}>· {it.qty} {it.unit}</span>}
                    {it.po_matched && (
                      <span style={{ fontSize: 10, background: "rgba(232, 168, 56, 0.15)", color: "#e8a838", padding: "2px 6px", borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>
                        ✓ PO
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {form.items.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); removeRow(idx); }} style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", padding: 4, display: "flex" }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={18} style={{ color: COLORS.muted, flexShrink: 0 }} /> : <ChevronDown size={18} style={{ color: COLORS.muted, flexShrink: 0 }} />}
                  </div>
                </div>

                {/* Expanded fields */}
                {isOpen && (
                  <div className="mob-item-card-body" style={{ paddingTop: 4, borderTop: `1px solid ${COLORS.border}` }}>
                    {/* Item Name — full width */}
                    <div className="mob-item-field" style={{ gridColumn: "1 / -1" }}>
                      <label>Item Name</label>
                      <input
                        value={it.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        placeholder="e.g. Tomato"
                        list={`mob-stock-names-${idx}`}
                      />
                      <datalist id={`mob-stock-names-${idx}`}>{stockNames.map((n) => <option key={n} value={n} />)}</datalist>
                    </div>

                    <div className="mob-item-field">
                      <label>Qty</label>
                      <input type="number" value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} placeholder="0" />
                    </div>

                    <div className="mob-item-field">
                      <label>Unit</label>
                      <select value={it.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>

                    <div className="mob-item-field">
                      <label>Base Price (₹)</label>
                      <input type="number" step="0.01" value={it.price} onChange={(e) => updateItem(idx, "price", e.target.value)} placeholder="0.00" />
                    </div>

                    <div className="mob-item-field">
                      <label>Min Alert Qty</label>
                      <input type="number" value={it.min_alert_qty} onChange={(e) => updateItem(idx, "min_alert_qty", e.target.value)} placeholder="e.g. 5" />
                    </div>

                    <div className="mob-item-field" style={{ gridColumn: "1 / -1" }}>
                      <label>Expiry Date</label>
                      <input type="date" value={it.expiry_date} onChange={(e) => updateItem(idx, "expiry_date", e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add item button */}
          <button
            onClick={addRow}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 12,
              border: `2px dashed ${COLORS.border}`, background: "transparent",
              color: COLORS.brand, fontWeight: 600, fontSize: 14,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s", minHeight: 52,
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.brand}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.border}
          >
            <Plus size={18} /> Add Another Item
          </button>
        </div>
      )}

      {/* Mobile sticky confirm button */}
      {isMobile && (
        <div className="mob-sticky-action">
          <button
            onClick={addAllToStore}
            style={{
              width: "100%", height: 52, fontSize: 16, fontWeight: 700,
              background: COLORS.brand, color: "white", border: "none",
              borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = COLORS.brandDark}
            onMouseLeave={(e) => e.currentTarget.style.background = COLORS.brand}
          >
            Confirm &amp; Save Purchase Order
          </button>
        </div>
      )}

      {msg && <p style={{ color: COLORS.success, fontSize: 13, marginTop: 12, textAlign: "center", fontWeight: 600 }}>{msg}</p>}

      <style dangerouslySetInnerHTML={{ __html: `
        .excel-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
        .excel-table th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 10px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; text-align: left; white-space: nowrap; }
        .excel-table td { border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 0; position: relative; white-space: nowrap; }
        .excel-table tr.excel-row:nth-child(even) { background-color: #fafafa; }
        .excel-table tr.excel-row:hover { background-color: #f1f5f9; }
        .excel-table tr.active-row td { border-top: 2px solid #3b82f6; border-bottom: 2px solid #3b82f6; }
        .excel-table tr.active-row td:first-child { border-left: 2px solid #3b82f6; }
        .excel-table tr.active-row td:last-child { border-right: 2px solid #3b82f6; }
        .row-num { padding: 8px 10px !important; color: #94a3b8; font-size: 12px; text-align: center; }
        .excel-input { width: 100%; height: 38px; border: none; background: transparent; padding: 8px 10px; font-size: 14px; color: #1e293b; outline: none; box-sizing: border-box; }
        .excel-input:focus { background: white; }
        .row-delete-btn { background: transparent; border: none; color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 14px; opacity: 0.7; }
        .row-delete-btn:hover { opacity: 1; }
        .premium-btn {
          padding: 10px 20px; font-size: 13.5px; font-weight: 600; border-radius: 8px;
          border: 1.5px solid #e8a838; color: #b27a18; background: rgba(232,168,56,0.05);
          cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
          gap: 8px; transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
          box-shadow: 0 1px 2px rgba(232,168,56,0.05); font-family: 'Inter', sans-serif;
        }
        .premium-btn:hover:not(:disabled) { background: #e8a838; color: #ffffff; box-shadow: 0 4px 12px rgba(232,168,56,0.2); transform: translateY(-1px); }
        .premium-btn:active:not(:disabled) { transform: translateY(0); }
        .premium-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}} />
      <CreateVendorModal
        open={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onSuccess={(newVendor) => {
          setSuppliersList(prev => [...prev, newVendor]);
          setForm(f => ({ ...f, supplier: newVendor.name }));
          setMsg(`Vendor "${newVendor.name}" registered and selected ✓`);
          setTimeout(() => setMsg(""), 3000);
        }}
      />
    </>
  );
}
