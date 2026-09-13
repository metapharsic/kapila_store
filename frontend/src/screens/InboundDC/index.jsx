import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { inboundDc, suppliers, stock } from "../../api";
import { 
  Truck, CheckCircle2, Clock, AlertTriangle, FileText, ArrowRight, 
  Search, RefreshCw, Plus, Trash2, Check, ShieldCheck, 
  Receipt, Scale, X, ExternalLink, Calendar, ChevronRight
} from "lucide-react";

const UNITS = ["kg", "gm", "ltr", "ml", "pcs", "pack", "can", "cylinder", "crate", "box"];
const CATEGORIES = ["Vegetables", "Dairy & Milk", "Bakery", "Meat & Poultry", "Gas & Utility", "Groceries", "Disposables"];

export default function InboundDCScreen() {
  const [activeTab, setActiveTab] = useState("register"); // "register" | "intake" | "match"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  // Data
  const [dcList, setDcList] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [selectedDc, setSelectedDc] = useState(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Intake Form State
  const initialIntakeForm = {
    supplier_id: "",
    challan_no: "",
    delivery_date: new Date().toISOString().slice(0, 10),
    vehicle_no: "",
    driver_name: "",
    driver_phone: "",
    received_by: "Storekeeper",
    remarks: "",
    items: [
      {
        item_code: "",
        item_name: "",
        category: "Vegetables",
        unit: "kg",
        dc_qty: "",
        est_unit_price: "",
        storage_location: "Cold Storage A",
        remarks: ""
      }
    ]
  };
  const [intakeForm, setIntakeForm] = useState(initialIntakeForm);

  // 3-Way Match Form State
  const [matchDc, setMatchDc] = useState(null);
  const [matchForm, setMatchForm] = useState({
    vendor_invoice_no: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    invoice_items: []
  });

  // Load initial data
  useEffect(() => {
    loadDcs();
    loadSuppliers();
    loadStockMaster();
  }, []);

  const loadDcs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inboundDc.list();
      setDcList(res.data || []);
    } catch (err) {
      console.error("Failed to load inbound DCs:", err);
      setError(err.message || "Failed to load Inbound DCs");
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await suppliers.list({ limit: 200 });
      setSupplierList(res.data || []);
    } catch (err) {
      console.warn("Failed to load suppliers:", err);
    }
  };

  const loadStockMaster = async () => {
    try {
      const res = await stock.list({ limit: 500 });
      setStockItems(res.data || []);
    } catch (err) {
      console.warn("Failed to load stock items:", err);
    }
  };

  // --- Intake Handlers ---
  const handleItemChange = (index, field, value) => {
    const updated = [...intakeForm.items];
    updated[index][field] = value;

    // Auto-fill from stock items if item_code changed
    if (field === "item_code" && value) {
      const found = stockItems.find(s => s.item_code === value);
      if (found) {
        updated[index].item_name = found.name;
        updated[index].unit = found.unit || "kg";
        updated[index].category = found.category || "Vegetables";
        updated[index].est_unit_price = found.unit_price || found.cost_price || "";
      }
    }
    setIntakeForm({ ...intakeForm, items: updated });
  };

  const addItemRow = () => {
    setIntakeForm({
      ...intakeForm,
      items: [
        ...intakeForm.items,
        {
          item_code: "",
          item_name: "",
          category: "Vegetables",
          unit: "kg",
          dc_qty: "",
          est_unit_price: "",
          storage_location: "Cold Storage A",
          remarks: ""
        }
      ]
    });
  };

  const removeItemRow = (index) => {
    if (intakeForm.items.length <= 1) return;
    const updated = intakeForm.items.filter((_, i) => i !== index);
    setIntakeForm({ ...intakeForm, items: updated });
  };

  const calculateIntakeTotal = () => {
    return intakeForm.items.reduce((sum, it) => {
      const q = parseFloat(it.dc_qty) || 0;
      const r = parseFloat(it.est_unit_price) || 0;
      return sum + (q * r);
    }, 0);
  };

  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!intakeForm.supplier_id) {
      setError("Please select a valid supplier.");
      return;
    }
    if (!intakeForm.challan_no.trim()) {
      setError("Please enter the vendor Delivery Challan (DC) number.");
      return;
    }
    const validItems = intakeForm.items.filter(it => it.item_name.trim() && parseFloat(it.dc_qty) > 0);
    if (validItems.length === 0) {
      setError("Please enter at least one item with a valid quantity.");
      return;
    }

    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      const payload = {
        supplier_id: intakeForm.supplier_id,
        challan_no: intakeForm.challan_no.trim(),
        delivery_date: intakeForm.delivery_date,
        vehicle_no: intakeForm.vehicle_no.trim(),
        driver_name: intakeForm.driver_name.trim(),
        driver_phone: intakeForm.driver_phone.trim(),
        received_by: intakeForm.received_by.trim(),
        remarks: intakeForm.remarks.trim(),
        items: validItems.map(it => ({
          item_code: it.item_code || undefined,
          item_name: it.item_name.trim(),
          category: it.category,
          unit: it.unit,
          dc_qty: parseFloat(it.dc_qty),
          est_unit_price: parseFloat(it.est_unit_price) || 0,
          storage_location: it.storage_location,
          remarks: it.remarks
        }))
      };

      const res = await inboundDc.create(payload);
      setMsg(`Success! Inbound DC ${res.data.sequence_no} received. Provisional stock credited immediately for kitchen operations.`);
      setIntakeForm(initialIntakeForm);
      await loadDcs();
      setActiveTab("register");
    } catch (err) {
      console.error("Intake submit error:", err);
      setError(err.message || "Failed to submit Inbound DC");
    } finally {
      setLoading(false);
    }
  };

  // --- 3-Way Match Preparation ---
  const startMatchWorkflow = (dc) => {
    setMatchDc(dc);
    setMatchForm({
      vendor_invoice_no: "",
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_items: (dc.items || []).map(it => ({
        id: it.id,
        item_name: it.item_name,
        dc_qty: it.dc_qty,
        invoice_qty: it.dc_qty,
        unit: it.unit,
        est_unit_price: it.est_unit_price,
        invoice_unit_price: it.est_unit_price,
        variance_notes: ""
      }))
    });
    setActiveTab("match");
  };

  const handleMatchItemChange = (index, field, value) => {
    const updated = [...matchForm.invoice_items];
    updated[index][field] = value;
    setMatchForm({ ...matchForm, invoice_items: updated });
  };

  const calculateMatchTotals = () => {
    if (!matchForm.invoice_items) return { dcTotal: 0, invTotal: 0, variance: 0 };
    let dcTotal = 0;
    let invTotal = 0;
    matchForm.invoice_items.forEach(it => {
      const dq = parseFloat(it.dc_qty) || 0;
      const dr = parseFloat(it.est_unit_price) || 0;
      const iq = parseFloat(it.invoice_qty) || 0;
      const ir = parseFloat(it.invoice_unit_price) || 0;
      dcTotal += (dq * dr);
      invTotal += (iq * ir);
    });
    return { dcTotal, invTotal, variance: invTotal - dcTotal };
  };

  const handleMatchSubmit = async (e) => {
    e.preventDefault();
    if (!matchForm.vendor_invoice_no.trim()) {
      setError("Please specify the Vendor Tax Invoice number.");
      return;
    }
    if (!matchDc) return;

    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      const payload = {
        vendor_invoice_no: matchForm.vendor_invoice_no.trim(),
        invoice_date: matchForm.invoice_date,
        items: matchForm.invoice_items.map(it => ({
          id: it.id,
          invoice_qty: parseFloat(it.invoice_qty) || 0,
          invoice_unit_price: parseFloat(it.invoice_unit_price) || 0,
          notes: it.variance_notes
        }))
      };

      const res = await inboundDc.matchInvoice(matchDc.id, payload);
      setMsg(`3-Way Match Verified! Converted to formal GRN #${res.data.grn_number}. Stock ledger atomically retagged with ZERO inventory duplication.`);
      setMatchDc(null);
      await loadDcs();
      setActiveTab("register");
    } catch (err) {
      console.error("3-Way match error:", err);
      setError(err.message || "Failed to execute 3-Way Invoice Match");
    } finally {
      setLoading(false);
    }
  };

  // --- Cancellation ---
  const handleCancelDc = async (dc) => {
    const reason = window.prompt(`Are you sure you want to cancel DC ${dc.sequence_no}? Enter cancellation reason:`);
    if (!reason) return;

    setLoading(true);
    setError(null);
    try {
      await inboundDc.cancel(dc.id, reason);
      setMsg(`Inbound DC ${dc.sequence_no} cancelled. Provisional stock and ledger entries adjusted.`);
      await loadDcs();
    } catch (err) {
      setError(err.message || "Failed to cancel DC");
    } finally {
      setLoading(false);
    }
  };

  // Telemetry Aggregates
  const totalReceived = dcList.length;
  const pendingMatch = dcList.filter(d => d.status === "PENDING_INVOICE").length;
  const grnCompleted = dcList.filter(d => d.status === "GRN_COMPLETED").length;
  const totalValue = dcList.reduce((sum, d) => sum + (parseFloat(d.total_est_value) || 0), 0);

  // Filtered DCs
  const filteredDcs = dcList.filter(dc => {
    const matchesSearch = 
      (dc.sequence_no || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dc.challan_no || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dc.supplier_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dc.vehicle_no || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || dc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ padding: "8px 0 32px", maxWidth: 1400, margin: "0 auto", color: COLORS.text }}>
      
      {/* ═══ TOP HEADER & BREADCRUMB ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.muted, marginBottom: 4 }}>
            <span>Procurement & Stores</span>
            <ChevronRight size={14} />
            <span style={{ color: COLORS.brand, fontWeight: 600 }}>Inbound Delivery Challans (DC)</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10, color: COLORS.text }}>
            <Truck color={COLORS.brand} size={28} />
            Early Morning Challan Intake & 3-Way Match Engine
          </h1>
          <p style={{ margin: "4px 0 0", color: COLORS.muted, fontSize: 13 }}>
            Immediate provisional stock crediting for dawn deliveries (Milk, Produce, LPG) prior to consolidated vendor tax invoice.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={loadDcs}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              color: COLORS.text, padding: "8px 14px", borderRadius: 8,
              cursor: "pointer", fontSize: 13, fontWeight: 500
            }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setActiveTab("intake")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: COLORS.brand, border: "none",
              color: "#000", padding: "8px 16px", borderRadius: 8,
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              boxShadow: "0 2px 8px rgba(232, 168, 56, 0.25)"
            }}
          >
            <Plus size={16} />
            New Morning Challan
          </button>
        </div>
      </div>

      {/* ═══ TELEMETRY METRIC TILES ═══ */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16, marginBottom: 24
      }}>
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            <span>Total Challans</span>
            <FileText size={16} color={COLORS.brand} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: COLORS.text }}>
            {totalReceived}
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            Inbound perishables & provisions
          </div>
        </div>

        <div style={{
          background: COLORS.surface, border: `1px solid ${pendingMatch > 0 ? COLORS.warning + "40" : COLORS.border}`,
          borderRadius: 12, padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            <span>Pending 3-Way Match</span>
            <Clock size={16} color={COLORS.warning} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: COLORS.warning }}>
            {pendingMatch}
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            Active provisional stock in kitchen
          </div>
        </div>

        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            <span>GRN Reconciled</span>
            <CheckCircle2 size={16} color={COLORS.success} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: COLORS.success }}>
            {grnCompleted}
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            Formal invoice matched & retagged
          </div>
        </div>

        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            <span>Provisional Inflow Value</span>
            <Receipt size={16} color={COLORS.brand} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: COLORS.brand }}>
            ₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            Est. inventory value delivered
          </div>
        </div>
      </div>

      {/* ═══ NOTIFICATION BANNERS ═══ */}
      {msg && (
        <div style={{
          background: "#064e3b40", border: "1px solid #059669",
          color: "#a7f3d0", padding: "12px 16px", borderRadius: 8,
          marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={18} color="#34d399" />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{msg}</span>
          </div>
          <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: "#a7f3d0", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div style={{
          background: "#7f1d1d40", border: "1px solid #dc2626",
          color: "#fecaca", padding: "12px 16px", borderRadius: 8,
          marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} color="#f87171" />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#fecaca", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ═══ NAVIGATION TABS ═══ */}
      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("register")}
          style={{
            padding: "10px 18px", background: "none", border: "none",
            borderBottom: activeTab === "register" ? `3px solid ${COLORS.brand}` : "3px solid transparent",
            color: activeTab === "register" ? COLORS.brand : COLORS.muted,
            fontWeight: activeTab === "register" ? 600 : 400,
            fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}
        >
          <FileText size={16} />
          Inbound DC Register ({filteredDcs.length})
        </button>

        <button
          onClick={() => setActiveTab("intake")}
          style={{
            padding: "10px 18px", background: "none", border: "none",
            borderBottom: activeTab === "intake" ? `3px solid ${COLORS.brand}` : "3px solid transparent",
            color: activeTab === "intake" ? COLORS.brand : COLORS.muted,
            fontWeight: activeTab === "intake" ? 600 : 400,
            fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}
        >
          <Plus size={16} />
          Morning Challan Intake
        </button>

        <button
          onClick={() => {
            if (pendingMatch > 0 && !matchDc) {
              const firstPending = dcList.find(d => d.status === "PENDING_INVOICE");
              if (firstPending) startMatchWorkflow(firstPending);
            } else {
              setActiveTab("match");
            }
          }}
          style={{
            padding: "10px 18px", background: "none", border: "none",
            borderBottom: activeTab === "match" ? `3px solid ${COLORS.brand}` : "3px solid transparent",
            color: activeTab === "match" ? COLORS.brand : COLORS.muted,
            fontWeight: activeTab === "match" ? 600 : 400,
            fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            position: "relative"
          }}
        >
          <Scale size={16} />
          3-Way Invoice Match Engine
          {pendingMatch > 0 && (
            <span style={{
              background: COLORS.warning, color: "#000",
              fontSize: 10, fontWeight: 700, padding: "1px 6px",
              borderRadius: 10, marginLeft: 4
            }}>
              {pendingMatch} Pending
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1: REGISTER VIEW
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "register" && (
        <div>
          {/* Controls Bar */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }} />
              <input
                type="text"
                placeholder="Search DC sequence, vendor challan #, supplier, or vehicle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px 9px 36px",
                  background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, color: COLORS.text, fontSize: 13
                }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "9px 16px", background: COLORS.surface,
                border: `1px solid ${COLORS.border}`, borderRadius: 8,
                color: COLORS.text, fontSize: 13, cursor: "pointer"
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_INVOICE">Pending Invoice Match</option>
              <option value="GRN_COMPLETED">GRN Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Table */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, overflow: "hidden"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "12px 16px" }}>Sequence / Date</th>
                  <th style={{ padding: "12px 16px" }}>Vendor Challan #</th>
                  <th style={{ padding: "12px 16px" }}>Supplier</th>
                  <th style={{ padding: "12px 16px" }}>Vehicle / Driver</th>
                  <th style={{ padding: "12px 16px" }}>Items</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Est. Total</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDcs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "48px 16px", textAlign: "center", color: COLORS.muted }}>
                      <Truck size={36} color={COLORS.muted} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                      <div style={{ fontSize: 15, fontWeight: 500, color: COLORS.text }}>No Inbound Delivery Challans found</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>Receive your morning dawn deliveries via the "Morning Challan Intake" tab.</div>
                    </td>
                  </tr>
                ) : (
                  filteredDcs.map((dc) => {
                    const isPending = dc.status === "PENDING_INVOICE";
                    const isCompleted = dc.status === "GRN_COMPLETED";
                    const isCancelled = dc.status === "CANCELLED";

                    return (
                      <tr key={dc.id} style={{ borderBottom: `1px solid ${COLORS.border}`, transition: "background 0.15s" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: COLORS.brand }}>{dc.sequence_no}</div>
                          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{dc.delivery_date}</div>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 500 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <FileText size={14} color={COLORS.muted} />
                            <span>{dc.challan_no}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 500 }}>{dc.supplier_name || "Unknown"}</div>
                          <div style={{ fontSize: 11, color: COLORS.muted }}>{dc.supplier_phone || ""}</div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div>{dc.vehicle_no || "—"}</div>
                          <div style={{ fontSize: 11, color: COLORS.muted }}>{dc.driver_name || ""}</div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                            padding: "2px 8px", borderRadius: 4, fontSize: 11
                          }}>
                            {dc.items_count || (dc.items ? dc.items.length : 0)} items
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>
                          ₹{parseFloat(dc.total_est_value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {isPending && (
                            <span style={{
                              background: "#78350f40", border: "1px solid #d97706",
                              color: "#fde68a", padding: "3px 8px", borderRadius: 6,
                              fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4
                            }}>
                              <Clock size={12} />
                              Pending Invoice
                            </span>
                          )}
                          {isCompleted && (
                            <span style={{
                              background: "#064e3b40", border: "1px solid #059669",
                              color: "#a7f3d0", padding: "3px 8px", borderRadius: 6,
                              fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4
                            }}>
                              <CheckCircle2 size={12} />
                              GRN Matched
                            </span>
                          )}
                          {isCancelled && (
                            <span style={{
                              background: "#7f1d1d40", border: "1px solid #dc2626",
                              color: "#fecaca", padding: "3px 8px", borderRadius: 6,
                              fontSize: 11, fontWeight: 600
                            }}>
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              onClick={() => {
                                setSelectedDc(dc);
                                setInspectModalOpen(true);
                              }}
                              title="Inspect Challan Details"
                              style={{
                                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                                color: COLORS.text, padding: "5px 10px", borderRadius: 6,
                                cursor: "pointer", fontSize: 12
                              }}
                            >
                              Details
                            </button>

                            {isPending && (
                              <button
                                onClick={() => startMatchWorkflow(dc)}
                                title="Execute 3-Way Invoice Match"
                                style={{
                                  background: COLORS.brand, border: "none",
                                  color: "#000", padding: "5px 12px", borderRadius: 6,
                                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                                  display: "flex", alignItems: "center", gap: 4
                                }}
                              >
                                <Scale size={13} />
                                Match Invoice
                              </button>
                            )}

                            {isPending && (
                              <button
                                onClick={() => handleCancelDc(dc)}
                                title="Cancel Inbound DC"
                                style={{
                                  background: "none", border: "none",
                                  color: COLORS.danger, padding: "5px",
                                  cursor: "pointer"
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2: MORNING CHALLAN INTAKE (FAST)
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "intake" && (
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "24px", maxWidth: 1100, margin: "0 auto"
        }}>
          {/* Informational Callout */}
          <div style={{
            background: "#1e3a8a30", border: "1px solid #3b82f6",
            borderRadius: 8, padding: "14px 18px", marginBottom: 24,
            display: "flex", alignItems: "flex-start", gap: 12
          }}>
            <ShieldCheck size={22} color="#60a5fa" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "#dbeafe" }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#fff", marginBottom: 2 }}>
                Hotel Kapila Provisional Inward Protocol
              </div>
              Early morning supplies (5:00 AM Vegetables, Fresh Dairy Milk, Bread, LPG Cylinders) arriving without an official tax invoice are received here under vendor Delivery Challan.
              Items are <strong>immediately credited to active inventory</strong> as <code style={{ background: "#1e293b", padding: "2px 6px", borderRadius: 4 }}>INWARD_DC_PROVISIONAL</code> so kitchen stations can instantly issue and cook without operational delay.
            </div>
          </div>

          <form onSubmit={handleIntakeSubmit}>
            {/* Header Fields */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16, marginBottom: 20
            }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                  Supplier / Vendor *
                </label>
                <select
                  required
                  value={intakeForm.supplier_id}
                  onChange={(e) => setIntakeForm({ ...intakeForm, supplier_id: e.target.value })}
                  style={{
                    width: "100%", padding: "9px 12px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    color: COLORS.text, fontSize: 13
                  }}
                >
                  <option value="">Select Vendor...</option>
                  {supplierList.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.category || "Supplier"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                  Vendor Challan # (DC) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DC-MILK-9812"
                  value={intakeForm.challan_no}
                  onChange={(e) => setIntakeForm({ ...intakeForm, challan_no: e.target.value })}
                  style={{
                    width: "100%", padding: "9px 12px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    color: COLORS.text, fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                  Delivery Date *
                </label>
                <input
                  type="date"
                  required
                  value={intakeForm.delivery_date}
                  onChange={(e) => setIntakeForm({ ...intakeForm, delivery_date: e.target.value })}
                  style={{
                    width: "100%", padding: "9px 12px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    color: COLORS.text, fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                  Vehicle Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TS 09 UB 4412"
                  value={intakeForm.vehicle_no}
                  onChange={(e) => setIntakeForm({ ...intakeForm, vehicle_no: e.target.value })}
                  style={{
                    width: "100%", padding: "9px 12px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    color: COLORS.text, fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                  Driver Name & Phone
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh (9876543210)"
                  value={intakeForm.driver_name}
                  onChange={(e) => setIntakeForm({ ...intakeForm, driver_name: e.target.value })}
                  style={{
                    width: "100%", padding: "9px 12px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    color: COLORS.text, fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                  Received By (Storekeeper)
                </label>
                <input
                  type="text"
                  value={intakeForm.received_by}
                  onChange={(e) => setIntakeForm({ ...intakeForm, received_by: e.target.value })}
                  style={{
                    width: "100%", padding: "9px 12px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    color: COLORS.text, fontSize: 13
                  }}
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: COLORS.text }}>
                  Challan Goods Received
                </h3>
                <button
                  type="button"
                  onClick={addItemRow}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    color: COLORS.brand, padding: "6px 12px", borderRadius: 6,
                    fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}
                >
                  <Plus size={14} />
                  Add Line Item
                </button>
              </div>

              <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, textAlign: "left" }}>
                      <th style={{ padding: "10px 12px", width: "25%" }}>Item Description *</th>
                      <th style={{ padding: "10px 12px", width: "15%" }}>Category</th>
                      <th style={{ padding: "10px 12px", width: "12%" }}>Unit</th>
                      <th style={{ padding: "10px 12px", width: "12%" }}>Challan Qty *</th>
                      <th style={{ padding: "10px 12px", width: "14%" }}>Est. Rate (₹)</th>
                      <th style={{ padding: "10px 12px", width: "14%" }}>Est. Total (₹)</th>
                      <th style={{ padding: "10px 12px", width: "8%", textAlign: "center" }}>Act</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intakeForm.items.map((item, idx) => {
                      const lineTotal = (parseFloat(item.dc_qty) || 0) * (parseFloat(item.est_unit_price) || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: "8px 12px" }}>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Fresh Buffalo Milk"
                              value={item.item_name}
                              onChange={(e) => handleItemChange(idx, "item_name", e.target.value)}
                              list={`stock-datalist-${idx}`}
                              style={{
                                width: "100%", padding: "7px 10px", background: COLORS.bg,
                                border: `1px solid ${COLORS.border}`, borderRadius: 6,
                                color: COLORS.text, fontSize: 12
                              }}
                            />
                            <datalist id={`stock-datalist-${idx}`}>
                              {stockItems.map(s => (
                                <option key={s.id} value={s.name}>{s.item_code}</option>
                              ))}
                            </datalist>
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <select
                              value={item.category}
                              onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                              style={{
                                width: "100%", padding: "7px 10px", background: COLORS.bg,
                                border: `1px solid ${COLORS.border}`, borderRadius: 6,
                                color: COLORS.text, fontSize: 12
                              }}
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <select
                              value={item.unit}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              style={{
                                width: "100%", padding: "7px 10px", background: COLORS.bg,
                                border: `1px solid ${COLORS.border}`, borderRadius: 6,
                                color: COLORS.text, fontSize: 12
                              }}
                            >
                              {UNITS.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <input
                              type="number"
                              step="any"
                              required
                              placeholder="Qty"
                              value={item.dc_qty}
                              onChange={(e) => handleItemChange(idx, "dc_qty", e.target.value)}
                              style={{
                                width: "100%", padding: "7px 10px", background: COLORS.bg,
                                border: `1px solid ${COLORS.border}`, borderRadius: 6,
                                color: COLORS.text, fontSize: 12
                              }}
                            />
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <input
                              type="number"
                              step="any"
                              placeholder="Est Rate"
                              value={item.est_unit_price}
                              onChange={(e) => handleItemChange(idx, "est_unit_price", e.target.value)}
                              style={{
                                width: "100%", padding: "7px 10px", background: COLORS.bg,
                                border: `1px solid ${COLORS.border}`, borderRadius: 6,
                                color: COLORS.text, fontSize: 12
                              }}
                            />
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: COLORS.brand }}>
                            ₹{lineTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              disabled={intakeForm.items.length <= 1}
                              style={{
                                background: "none", border: "none",
                                color: intakeForm.items.length <= 1 ? COLORS.muted : COLORS.danger,
                                cursor: intakeForm.items.length <= 1 ? "not-allowed" : "pointer"
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Row: Remarks & Summary */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-end",
              borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, flexWrap: "wrap", gap: 16
            }}>
              <div style={{ flex: 1, minWidth: 300 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                  Delivery Remarks / Condition
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Delivered 5:15 AM, milk temperature inspected 4°C, all crates intact."
                  value={intakeForm.remarks}
                  onChange={(e) => setIntakeForm({ ...intakeForm, remarks: e.target.value })}
                  style={{
                    width: "100%", padding: "8px 12px", background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    color: COLORS.text, fontSize: 12, resize: "none"
                  }}
                />
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: COLORS.muted }}>Estimated Provisional Value</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.brand, margin: "2px 0 12px" }}>
                  ₹{calculateIntakeTotal().toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("register")}
                    style={{
                      padding: "10px 18px", background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`, borderRadius: 8,
                      color: COLORS.text, cursor: "pointer", fontSize: 13
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: "10px 24px", background: COLORS.brand,
                      border: "none", borderRadius: 8,
                      color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 8,
                      boxShadow: "0 2px 10px rgba(232, 168, 56, 0.3)"
                    }}
                  >
                    <CheckCircle2 size={16} />
                    {loading ? "Recording..." : "Record Inbound DC & Credit Stock"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3: 3-WAY INVOICE MATCH RECONCILER
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "match" && (
        <div>
          {!matchDc ? (
            <div style={{
              background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: "48px 24px", textAlign: "center"
            }}>
              <Scale size={48} color={COLORS.brand} style={{ margin: "0 auto 16px", opacity: 0.8 }} />
              <h2 style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, margin: "0 0 8px" }}>
                Select a Pending Challan to Match Against Tax Invoice
              </h2>
              <p style={{ color: COLORS.muted, fontSize: 13, maxWidth: 500, margin: "0 auto 20px" }}>
                Choose any Inbound Delivery Challan that has arrived and is currently in provisional status awaiting the vendor's weekly or monthly invoice.
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                {dcList.filter(d => d.status === "PENDING_INVOICE").length === 0 ? (
                  <div style={{ color: COLORS.success, fontSize: 14, fontWeight: 500 }}>
                    ✨ All Inbound Challans have been matched with invoices! No pending 3-way matches.
                  </div>
                ) : (
                  dcList.filter(d => d.status === "PENDING_INVOICE").map(dc => (
                    <button
                      key={dc.id}
                      onClick={() => startMatchWorkflow(dc)}
                      style={{
                        padding: "10px 16px", background: COLORS.bg,
                        border: `1px solid ${COLORS.brand}`, borderRadius: 8,
                        color: COLORS.text, cursor: "pointer", fontSize: 13,
                        textAlign: "left", display: "flex", alignItems: "center", gap: 12
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: COLORS.brand }}>{dc.sequence_no}</div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>{dc.supplier_name} · {dc.challan_no}</div>
                      </div>
                      <ArrowRight size={16} color={COLORS.brand} />
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: "24px", maxWidth: 1100, margin: "0 auto"
            }}>
              {/* Header Details */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 16, marginBottom: 20, flexWrap: "wrap", gap: 12
              }}>
                <div>
                  <span style={{
                    background: "#78350f40", border: "1px solid #d97706",
                    color: "#fde68a", padding: "2px 8px", borderRadius: 4,
                    fontSize: 11, fontWeight: 600
                  }}>
                    Matching Challan: {matchDc.sequence_no}
                  </span>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: "6px 0 2px", color: COLORS.text }}>
                    3-Way Match: Challan vs Tax Invoice
                  </h2>
                  <div style={{ fontSize: 13, color: COLORS.muted }}>
                    Vendor: <strong style={{ color: COLORS.text }}>{matchDc.supplier_name}</strong> · Challan #: <strong style={{ color: COLORS.text }}>{matchDc.challan_no}</strong> · Delivered: {matchDc.delivery_date}
                  </div>
                </div>

                <button
                  onClick={() => setMatchDc(null)}
                  style={{
                    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    color: COLORS.muted, padding: "6px 12px", borderRadius: 6,
                    cursor: "pointer", fontSize: 12
                  }}
                >
                  Change Challan
                </button>
              </div>

              {/* Invoice Input Details */}
              <form onSubmit={handleMatchSubmit}>
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 16, marginBottom: 20, background: COLORS.bg, padding: "16px", borderRadius: 8
                }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                      Vendor Tax Invoice # *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. INV-2026-98124"
                      value={matchForm.vendor_invoice_no}
                      onChange={(e) => setMatchForm({ ...matchForm, vendor_invoice_no: e.target.value })}
                      style={{
                        width: "100%", padding: "9px 12px", background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`, borderRadius: 8,
                        color: COLORS.text, fontSize: 13
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                      Invoice Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={matchForm.invoice_date}
                      onChange={(e) => setMatchForm({ ...matchForm, invoice_date: e.target.value })}
                      style={{
                        width: "100%", padding: "9px 12px", background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`, borderRadius: 8,
                        color: COLORS.text, fontSize: 13
                      }}
                    />
                  </div>
                </div>

                {/* Comparison Matrix */}
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, textAlign: "left" }}>
                        <th style={{ padding: "10px 12px", width: "25%" }}>Item Description</th>
                        <th style={{ padding: "10px 12px", width: "12%" }}>DC Qty</th>
                        <th style={{ padding: "10px 12px", width: "15%" }}>Invoice Qty</th>
                        <th style={{ padding: "10px 12px", width: "12%" }}>DC Est Rate</th>
                        <th style={{ padding: "10px 12px", width: "15%" }}>Invoice Unit Rate</th>
                        <th style={{ padding: "10px 12px", width: "12%", textAlign: "right" }}>Line Total</th>
                        <th style={{ padding: "10px 12px", width: "9%", textAlign: "center" }}>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchForm.invoice_items.map((item, idx) => {
                        const dcQty = parseFloat(item.dc_qty) || 0;
                        const invQty = parseFloat(item.invoice_qty) || 0;
                        const dcRate = parseFloat(item.est_unit_price) || 0;
                        const invRate = parseFloat(item.invoice_unit_price) || 0;
                        const lineTotal = invQty * invRate;
                        
                        const rateDiffPct = dcRate > 0 ? Math.abs(((invRate - dcRate) / dcRate) * 100) : 0;
                        const hasVariance = Math.abs(invQty - dcQty) > 0.001 || rateDiffPct > 0.1;

                        return (
                          <tr key={item.id || idx} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                              {item.item_name}
                              <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400 }}>Unit: {item.unit}</div>
                            </td>
                            <td style={{ padding: "10px 12px", color: COLORS.muted }}>
                              {dcQty} {item.unit}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <input
                                type="number"
                                step="any"
                                required
                                value={item.invoice_qty}
                                onChange={(e) => handleMatchItemChange(idx, "invoice_qty", e.target.value)}
                                style={{
                                  width: "100%", padding: "6px 8px", background: COLORS.bg,
                                  border: `1px solid ${COLORS.border}`, borderRadius: 6,
                                  color: COLORS.text, fontSize: 12
                                }}
                              />
                            </td>
                            <td style={{ padding: "10px 12px", color: COLORS.muted }}>
                              ₹{dcRate.toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <input
                                type="number"
                                step="any"
                                required
                                value={item.invoice_unit_price}
                                onChange={(e) => handleMatchItemChange(idx, "invoice_unit_price", e.target.value)}
                                style={{
                                  width: "100%", padding: "6px 8px", background: COLORS.bg,
                                  border: `1px solid ${COLORS.border}`, borderRadius: 6,
                                  color: COLORS.text, fontSize: 12
                                }}
                              />
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: COLORS.brand }}>
                              ₹{lineTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "center" }}>
                              {!hasVariance ? (
                                <span style={{
                                  background: "#064e3b30", color: "#34d399",
                                  padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700
                                }}>
                                  EXACT
                                </span>
                              ) : rateDiffPct > 5 ? (
                                <span style={{
                                  background: "#7f1d1d40", color: "#f87171",
                                  padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700
                                }}>
                                  +{rateDiffPct.toFixed(1)}%
                                </span>
                              ) : (
                                <span style={{
                                  background: "#78350f40", color: "#fbbf24",
                                  padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700
                                }}>
                                  ±{rateDiffPct.toFixed(1)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Audit & Conversion Note */}
                <div style={{
                  background: "#064e3b20", border: "1px solid #05966950",
                  borderRadius: 8, padding: "12px 16px", marginBottom: 20,
                  display: "flex", alignItems: "center", gap: 10
                }}>
                  <ShieldCheck size={20} color="#34d399" />
                  <div style={{ fontSize: 12, color: "#a7f3d0", lineHeight: 1.4 }}>
                    <strong>Zero Double-Counting Guarantee:</strong> Confirming this 3-way match updates the existing provisional batch with final vendor invoice rates and seamlessly retags the stock ledger entry to <code style={{ background: "#022c22", padding: "1px 4px", borderRadius: 3 }}>INWARD_GRN</code>. No secondary inventory count is created.
                  </div>
                </div>

                {/* Totals & Submit */}
                {(() => {
                  const { dcTotal, invTotal, variance } = calculateMatchTotals();
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                      <div style={{ display: "flex", gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Challan Est. Total</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text }}>
                            ₹{dcTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Matched Invoice Total</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.brand }}>
                            ₹{invTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Net Variance</div>
                          <div style={{
                            fontSize: 16, fontWeight: 600,
                            color: Math.abs(variance) < 1 ? COLORS.success : variance > 0 ? COLORS.warning : COLORS.danger
                          }}>
                            {variance >= 0 ? "+" : ""}₹{variance.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setMatchDc(null)}
                          style={{
                            padding: "10px 18px", background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 8,
                            color: COLORS.text, cursor: "pointer", fontSize: 13
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          style={{
                            padding: "10px 24px", background: COLORS.brand,
                            border: "none", borderRadius: 8,
                            color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700,
                            display: "flex", alignItems: "center", gap: 8,
                            boxShadow: "0 2px 10px rgba(232, 168, 56, 0.3)"
                          }}
                        >
                          <CheckCircle2 size={16} />
                          {loading ? "Matching & Converting..." : "Confirm 3-Way Match & Convert to GRN"}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </form>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: INSPECT CHALLAN DETAILS & AUDIT TRAIL
         ═══════════════════════════════════════════════════════════════ */}
      {inspectModalOpen && selectedDc && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 20
        }}>
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: 14, width: "100%", maxWidth: 750, maxHeight: "90vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.text }}>
                    {selectedDc.sequence_no}
                  </h3>
                  <span style={{
                    background: selectedDc.status === "GRN_COMPLETED" ? "#064e3b40" : "#78350f40",
                    color: selectedDc.status === "GRN_COMPLETED" ? "#a7f3d0" : "#fde68a",
                    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600
                  }}>
                    {selectedDc.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                  Challan #: {selectedDc.challan_no} · Delivered: {selectedDc.delivery_date}
                </div>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16, marginBottom: 20, fontSize: 13
              }}>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase" }}>Supplier</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedDc.supplier_name || "Unknown"}</div>
                </div>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase" }}>Vehicle / Logistics</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedDc.vehicle_no || "—"} ({selectedDc.driver_name || "Driver not listed"})</div>
                </div>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase" }}>Received By</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedDc.received_by || "Storekeeper"}</div>
                </div>
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase" }}>Linked GRN</div>
                  <div style={{ fontWeight: 600, marginTop: 2, color: COLORS.brand }}>
                    {selectedDc.linked_grn_id ? `GRN ID #${selectedDc.linked_grn_id}` : "Pending 3-Way Match"}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, textAlign: "left" }}>
                      <th style={{ padding: "8px 12px" }}>Item</th>
                      <th style={{ padding: "8px 12px" }}>Category</th>
                      <th style={{ padding: "8px 12px" }}>DC Qty</th>
                      <th style={{ padding: "8px 12px" }}>Est Rate</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDc.items || []).map((it, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{it.item_name}</td>
                        <td style={{ padding: "8px 12px", color: COLORS.muted }}>{it.category}</td>
                        <td style={{ padding: "8px 12px" }}>{it.dc_qty} {it.unit}</td>
                        <td style={{ padding: "8px 12px" }}>₹{parseFloat(it.est_unit_price || 0).toFixed(2)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: COLORS.brand }}>
                          ₹{((parseFloat(it.dc_qty) || 0) * (parseFloat(it.est_unit_price) || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedDc.remarks && (
                <div style={{ background: COLORS.bg, padding: "10px 14px", borderRadius: 8, fontSize: 12, color: COLORS.muted }}>
                  <strong style={{ color: COLORS.text }}>Remarks: </strong> {selectedDc.remarks}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "14px 24px", borderTop: `1px solid ${COLORS.border}`,
              display: "flex", justifyContent: "flex-end", gap: 10
            }}>
              <button
                onClick={() => setInspectModalOpen(false)}
                style={{
                  padding: "8px 16px", background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  color: COLORS.text, cursor: "pointer", fontSize: 13
                }}
              >
                Close
              </button>
              {selectedDc.status === "PENDING_INVOICE" && (
                <button
                  onClick={() => {
                    setInspectModalOpen(false);
                    startMatchWorkflow(selectedDc);
                  }}
                  style={{
                    padding: "8px 18px", background: COLORS.brand,
                    border: "none", borderRadius: 6,
                    color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 6
                  }}
                >
                  <Scale size={14} />
                  Match Against Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
