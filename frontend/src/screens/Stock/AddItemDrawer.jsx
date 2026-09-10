import { useState, useEffect } from "react";
import { COLORS, UNITS, STOCK_CATEGORIES } from "../../styles/colors";
import {
  PackagePlus, X, MapPin, Building2, Calendar, Clock,
  DollarSign, Layers, Tag, FileText, AlertCircle, Sparkles, CheckCircle, Info
} from "lucide-react";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import * as api from "../../api";
import { today } from "../../utils/dates";
import CreateVendorModal from "../../components/CreateVendorModal";
import MultiAgentStatusBar from "../../components/MultiAgentStatusBar";
import LIFOSuggestionBanner from "../../components/LIFOSuggestionBanner";

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

const emptyForm = {
  name: "",
  item_code: "",
  qty: "",
  unit: UNITS[0] || "kg",
  pack_size: "1",
  category: STOCK_CATEGORIES[0] || "General",
  price: "",
  min_alert_qty: "",
  supplier_mode: "existing", // "existing" or "new"
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
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [fieldSyncState, setFieldSyncState] = useState(false);

  const handleSelectLIFOBatch = (batch) => {
    setFieldSyncState(true);
    setForm((f) => ({
      ...f,
      unit: batch.unit || f.unit,
      price: batch.unit_cost != null ? batch.unit_cost.toString() : f.price,
      item_code: batch.item_code || f.item_code,
      storage_zone: batch.storage_zone || f.storage_zone,
      supplier: batch.supplier || f.supplier,
      supplier_id: batch.supplier_id ? String(batch.supplier_id) : f.supplier_id,
      pack_size: batch.pack_size ? batch.pack_size.toString() : f.pack_size,
    }));
    setTimeout(() => setFieldSyncState(false), 2000);
  };

  useEffect(() => {
    if (open) {
      loadSuppliers();
      const generatedBatch = `BAT-${Date.now().toString().slice(-6)}`;
      setForm({
        ...emptyForm,
        date: today(),
        purchase_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        batch_no: generatedBatch
      });
      setErr("");
    }
  }, [open]);

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const res = await api.suppliers.list({ limit: 100, sort: "name", order: "asc" });
      const list = res.data || [];
      setSuppliers(list);
      if (list.length > 0 && !form.supplier) {
        setForm((f) => ({
          ...f,
          supplier_id: String(list[0].id),
          supplier: list[0].name
        }));
      }
    } catch {
      // Fallback
    } finally {
      setLoadingSuppliers(false);
    }
  };

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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

  const parsedQty = parseFloat(form.qty) || 0;
  const parsedPrice = parseFloat(form.price) || 0;
  const totalValuation = parsedQty * parsedPrice;
  const constructedRack = `Rack ${form.rack_number} / Shelf ${form.shelf_number}${form.bin_number ? ` / Bin ${form.bin_number}` : ""}`;

  const valid = form.name.trim() && parsedQty > 0 && form.unit && parsedPrice >= 0;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setErr("");
    try {
      const supplierName = form.supplier_mode === "existing"
        ? form.supplier
        : form.supplier.trim();

      await api.stock.create({
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
        rack_location: constructedRack,
        invoice_no: form.invoice_no.trim() || undefined,
        batch_no: form.batch_no.trim() || undefined,
        purchase_time: `${form.date}T${form.purchase_time || "12:00"}:00`,
        expiry_date: form.expiry_date || null,
        min_alert_qty: form.min_alert_qty.trim() === "" ? null : parseFloat(form.min_alert_qty),
        notes: form.notes.trim() || undefined,
      });

      setForm(emptyForm);
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || "Failed to create item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "drawerBackdropFade 0.25s ease-out"
      }}
      onClick={onClose}
    >
      <style>
        {`
          @keyframes drawerBackdropFade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalPopUp {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}
      </style>
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          maxHeight: "90vh",
          background: "var(--bg-modal)",
          border: "1px solid var(--color-gold-glow)",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
          overflowY: "auto",
          animation: "modalPopUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-color)",
            background: "linear-gradient(135deg, var(--bg-page), rgba(15,23,42,0.95))",
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "'DM Serif Display', Georgia, serif",
              }}
            >
              <PackagePlus size={22} style={{ color: "var(--color-gold)" }} /> Provision New Stock Item
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Enterprise catalog entry. Please ensure supplier batches and storage locations are precise.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--border-color)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              padding: 6,
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content - 2 Column Layout */}
        <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          
          {/* Multi-Agent System Status Bar */}
          <div style={{ gridColumn: "1 / -1", marginBottom: -6 }}>
            <MultiAgentStatusBar
              syncing={fieldSyncState}
              customNote="Multi-agent swarm: Vendor Directory, LIFO Batch Valuation, and Storage Zone synchronized"
            />
          </div>

          {/* LIFO Advisory Banner when item name is entered */}
          {form.name && (
            <div style={{ gridColumn: "1 / -1", marginBottom: -6 }}>
              <LIFOSuggestionBanner
                itemName={form.name}
                itemCode={form.item_code}
                onSelectBatch={handleSelectLIFOBatch}
              />
            </div>
          )}

          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Section 1: Item Identity */}
            <div style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gold)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <Tag size={15} /> Item Identity
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Input
                  label="Item Name / Description"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Premium Basmati Rice"
                  autoFocus
                />
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                  <Input
                    label="SKU / Item Code (Optional)"
                    value={form.item_code}
                    onChange={(e) => set("item_code", e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4, fontWeight: 500 }}>Base Unit</label>
                    <select
                      value={form.unit}
                      onChange={(e) => set("unit", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: "var(--bg-page)", border: "1px solid var(--border-color)", color: "var(--text-main)", borderRadius: 6 }}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u} style={{ background: "var(--bg-modal)" }}>{u}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>Used for recipe scaling.</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4, fontWeight: 500 }}>Classification Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => set("category", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: "var(--bg-page)", border: "1px solid var(--border-color)", color: "var(--text-main)", borderRadius: 6 }}
                    >
                      {STOCK_CATEGORIES.map((c) => (
                        <option key={c} value={c} style={{ background: "var(--bg-modal)" }}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Pack Size (Qty per Unit)"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.pack_size}
                    onChange={(e) => set("pack_size", e.target.value)}
                    placeholder="e.g. 50"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Storage & Location */}
            <div style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-info)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <MapPin size={15} /> Physical Storage Location
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4, fontWeight: 500 }}>Designated Storage Zone</label>
                  <select
                    value={form.storage_zone}
                    onChange={(e) => set("storage_zone", e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: "var(--bg-page)", border: "1px solid var(--border-color)", color: "var(--text-main)", borderRadius: 6 }}
                  >
                    {STORAGE_ZONES.map((z) => (
                      <option key={z} value={z} style={{ background: "var(--bg-modal)" }}>{z}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>Impacts environmental monitoring and audit routes.</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <Input label="Rack #" value={form.rack_number} onChange={(e) => set("rack_number", e.target.value)} placeholder="e.g. A-01" />
                  <Input label="Shelf #" value={form.shelf_number} onChange={(e) => set("shelf_number", e.target.value)} placeholder="e.g. 1" />
                  <Input label="Bin (Opt)" value={form.bin_number} onChange={(e) => set("bin_number", e.target.value)} placeholder="e.g. 4" />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "rgba(15,23,42,0.4)", borderRadius: 6 }}>
                  <Info size={14} style={{ color: "var(--color-info)" }} />
                  <span>Target Coordinate: <strong style={{ color: "var(--text-main)" }}>{constructedRack}</strong></span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Section 3: Commercials & Supplier */}
            <div style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-gold)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <Building2 size={15} /> Commercials & Batch Inwarding
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input label="Initial Quantity Inward" type="number" min="0" step="0.01" value={form.qty} onChange={(e) => set("qty", e.target.value)} placeholder="0.00" />
                  <div>
                    <Input label={`Unit Cost (₹) per ${form.unit}`} type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
                    <div style={{ fontSize: 10.5, color: totalValuation > 0 ? "#10b981" : "var(--text-muted)", marginTop: 4 }}>
                      Batch Valuation: ₹{totalValuation.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500 }}>Supplier Source</label>
                    <button
                      type="button"
                      onClick={() => setShowVendorModal(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-gold)",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3
                      }}
                    >
                      <Building2 size={12} /> + New Vendor
                    </button>
                  </div>
                  {form.supplier_mode === "existing" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        value={form.supplier_id}
                        onChange={handleSupplierSelect}
                        disabled={loadingSuppliers}
                        style={{ flex: 1, padding: "8px 10px", fontSize: 13, background: "var(--bg-page)", border: "1px solid var(--border-color)", color: "var(--text-main)", borderRadius: 6 }}
                      >
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id} style={{ background: "var(--bg-modal)" }}>{s.name} {s.gstin ? `(${s.gstin})` : ""}</option>
                        ))}
                        <option value="__custom__" style={{ background: "var(--bg-modal)", color: "var(--color-gold)", fontWeight: "bold" }}>+ Add / Register New Vendor...</option>
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Input style={{ flex: 1 }} value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Enter vendor name" />
                      <button
                        onClick={() => setForm((f) => ({ ...f, supplier_mode: "existing", supplier_id: suppliers[0] ? String(suppliers[0].id) : "", supplier: suppliers[0] ? suppliers[0].name : "" }))}
                        style={{ background: "var(--border-color)", border: "1px solid var(--border-color)", color: "var(--text-main)", borderRadius: 6, padding: "0 10px", fontSize: 12, cursor: "pointer" }}
                      >
                        Select Existing
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input label="Invoice Reference #" value={form.invoice_no} onChange={(e) => set("invoice_no", e.target.value)} placeholder="INV-202601" />
                  <Input label="Batch Number" value={form.batch_no} onChange={(e) => set("batch_no", e.target.value)} placeholder="Auto-generated" />
                </div>
              </div>
            </div>

            {/* Section 4: Stock Controls */}
            <div style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <Sparkles size={15} /> Stock Controls & Tracking
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input label="Receipt Date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
                  <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
                </div>
                
                <div>
                  <Input
                    label="Minimum Alert Quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.min_alert_qty}
                    onChange={(e) => set("min_alert_qty", e.target.value)}
                    placeholder="e.g. 5"
                  />
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
                    If stock falls below this level, an automated WhatsApp re-order alert is triggered to purchasing.
                  </div>
                </div>

                <div>
                  <Input label="Storekeeper Entry Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Grade A quality verified" />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Error / Footer */}
        <div style={{ padding: "0 24px 24px 24px", marginTop: "auto" }}>
          {err && (
            <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#ef4444", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <AlertCircle size={18} /> {err}
            </div>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <Btn
              onClick={save}
              disabled={!valid || saving}
              variant="primary"
              style={{ flex: 1, padding: "14px", fontSize: 15, fontWeight: 600, background: valid ? "var(--color-gold)" : "rgba(232, 168, 56, 0.3)", color: valid ? "#000" : "#666" }}
            >
              {saving ? "Provisioning System..." : "Confirm & Provision Item"}
            </Btn>
            <Btn
              variant="ghost"
              onClick={onClose}
              style={{ border: "1px solid var(--border-color)", color: "var(--text-muted)", padding: "14px 24px" }}
            >
              Cancel
            </Btn>
          </div>
        </div>

      </div>

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
