import { useState, useEffect, Fragment } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import { poStatusStyle } from "../../utils/poStatus";
import { usePaginatedApi } from "../../hooks/useApi";
import { useAppContext } from "../../context/AppContext";
import * as api from "../../api";
import { Users, Phone, Building2, ChevronDown, ChevronRight, Activity, TrendingUp, Search, PlusCircle, Trash2, Edit2, AlertTriangle, X, Receipt } from "lucide-react";

const LIMIT = 20;
const empty = { name: "", contact_name: "", phone: "", email: "", gstin: "", address: "" };

export default function SuppliersScreen() {
  const { setCurrentScreen, setPoPreFill } = useAppContext();
  const [form, setForm]     = useState(empty);
  const [editing, setEditing] = useState(null); // supplier id being edited
  const [msg, setMsg]       = useState("");
  const [q, setQ]           = useState("");
  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.suppliers.list);

  const [expandedId, setExpandedId] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [poDrafting, setPoDrafting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [viewPoId, setViewPoId] = useState(null);
  const [poDetails, setPoDetails] = useState(null);
  const [poLoading, setPoLoading] = useState(false);

  const openPoDetails = async (id) => {
    setViewPoId(id);
    setPoLoading(true);
    setPoDetails(null);
    try {
      const res = await api.purchaseOrders.getOne(id);
      if (res.success) setPoDetails(res.data);
    } catch (err) {
      flash("Error loading PO: " + err.message, COLORS.coral);
    } finally {
      setPoLoading(false);
    }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setPerformanceData(null);
      setSelectedCatalogItem(null);
      return;
    }
    setExpandedId(id);
    setSelectedCatalogItem(null);
    setPerformanceLoading(true);
    try {
      const res = await api.suppliers.performance(id);
      if (res.success) {
        setPerformanceData(res.data);
      }
    } catch (err) {
      flash("Error loading supplier details: " + err.message, COLORS.coral);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const load = (overrides = {}) =>
    fetch({ limit: LIMIT, sort: "name", order: "asc", q, ...overrides });

  useEffect(() => { load(); }, []);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 2500);
  };

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) return flash("Supplier name is required.", COLORS.coral);
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin.trim())) {
      return flash("Invalid GSTIN format.", COLORS.coral);
    }
    try {
      if (editing) {
        await api.suppliers.update(editing, form);
        flash("Supplier updated ✓");
      } else {
        await api.suppliers.create(form);
        flash("Supplier added ✓");
      }
      setForm(empty);
      setEditing(null);
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const startEdit = (s) => {
    setForm({ name: s.name, contact_name: s.contact_name || "", phone: s.phone || "", email: s.email || "", gstin: s.gstin || "", address: s.address || "" });
    setEditing(s.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => { setForm(empty); setEditing(null); };

  const remove = (id) => {
    setDeleteConfirmId(id);
  };

  const executeRemove = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.suppliers.remove(deleteConfirmId);
      flash("Supplier deleted.");
      setDeleteConfirmId(null);
      load({ page: 1 });
    } catch (e) { flash(e.message, COLORS.coral); }
  };

  const createPOForSupplier = (supplier) => {
    if (!supplier) return;
    if (setPoPreFill) {
      setPoPreFill({
        supplier_id: supplier.id,
        notes: `Initiated from Supplier Master: ${supplier.name}`
      });
    }
    flash(`Routing to Purchase Orders for ${supplier.name} ✓`, COLORS.accent);
    if (setCurrentScreen) setCurrentScreen("pos");
  };

  return (
    <Section title="Suppliers" sub="Manage vendor master — contacts, GSTIN, address" style={{ backgroundColor: "#F8FAFC" }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `4px solid #3B82F6` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '14px', fontWeight: 600 }}>
            <Users size={16} color="#3B82F6" /> Total Active Vendors
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>
            {loading ? '-' : total}
          </div>
        </Card>
        
        <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `4px solid #10B981` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '14px', fontWeight: 600 }}>
            <Activity size={16} color="#10B981" /> System Status
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
            Online & Synced
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>

        {/* Form Card */}
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} color="#8B5CF6" /> {editing ? "Edit Supplier" : "Add New Supplier"}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Supplier Name *" value={form.name} onChange={f("name")} placeholder="e.g. Fresh Farms India" />
            <Input label="Contact Person" value={form.contact_name} onChange={f("contact_name")} placeholder="Name" />
            <Input label="Phone" type="tel" value={form.phone} onChange={f("phone")} placeholder="+91 98765 43210" />
            <Input label="Email" type="email" value={form.email} onChange={f("email")} placeholder="vendor@example.com" />
            <Input label="GSTIN" value={form.gstin} onChange={f("gstin")} placeholder="22AAAAA0000A1Z5" />

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: "block", marginBottom: 6 }}>
                Address
              </label>
              <textarea
                value={form.address}
                onChange={f("address")}
                rows={3}
                placeholder="Street, City, State"
                style={{ background: "#F8FAFC", border: `1px solid #E2E8F0`, color: "#0F172A", borderRadius: 8, padding: "10px 12px", width: "100%", fontFamily: "inherit", fontSize: 14, resize: "vertical", outline: "none" }}
                onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
                onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn onClick={submit} style={{ flex: 1, backgroundColor: editing ? "#3B82F6" : "#10B981", border: "none" }} icon={editing ? <Edit2 size={14}/> : <PlusCircle size={14}/>}>
                {editing ? "Save Changes" : "Add Supplier"}
              </Btn>
              {editing && <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>}
            </div>
            {msg && <p style={{ color: msg.color, fontSize: 13, marginTop: 8, textAlign: "center", fontWeight: 500 }}>{msg.text}</p>}
          </div>
        </Card>

        {/* List Card */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid #E2E8F0`, display: "flex", gap: 16, alignItems: "center", backgroundColor: "#F8FAFC" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
              <Search size={16} color="#64748B" style={{ position: "absolute", left: 12, top: 10 }} />
              <input 
                type="text"
                placeholder="Search name, phone, GSTIN…"
                value={q}
                onChange={(e) => { setQ(e.target.value); load({ page: 1, q: e.target.value }); }}
                style={{ width: "100%", padding: "8px 12px 8px 36px", borderRadius: 8, border: "1px solid #E2E8F0", outline: "none", fontSize: 14 }}
              />
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#64748B', textAlign: "center", padding: 48, fontSize: 14 }}>Loading vendors…</p>
          ) : error ? (
            <div style={{ padding: 24 }}><ErrorMsg error={error} /></div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Building2 size={32} color="#CBD5E1" style={{ marginBottom: 12 }} />
              <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>No suppliers found. Add your first vendor.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid #E2E8F0`, backgroundColor: "white" }}>
                      {["Supplier", "Contact", "Phone", "GSTIN", ""].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", color: '#64748B', fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => {
                      const isExpanded = expandedId === s.id;
                      
                      const handleGenerateAutoDraft = async (e) => {
                        e.stopPropagation();
                        setPoDrafting(true);
                        try {
                          const res = await api.purchaseOrders.autoDraft(s.id);
                          flash(`Auto-draft PO ${res.data.po_number} successfully created!`, COLORS.success);
                          const perfRes = await api.suppliers.performance(s.id);
                          setPerformanceData(perfRes.data);
                        } catch (err) {
                          flash(err.message || "No low stock items found to reorder.", COLORS.coral);
                        } finally {
                          setPoDrafting(false);
                        }
                      };

                      return (
                        <Fragment key={s.id}>
                          <tr 
                            style={{ 
                              borderBottom: `1px solid #E2E8F0`,
                              cursor: "pointer",
                              backgroundColor: isExpanded ? "#F8FAFC" : "white",
                              transition: "background 0.2s"
                            }}
                            onClick={() => toggleExpand(s.id)}
                            onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = "#F1F5F9"; }}
                            onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = "white"; }}
                          >
                            <td style={{ padding: "16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {isExpanded ? <ChevronDown size={16} color="#64748B" /> : <ChevronRight size={16} color="#64748B" />}
                                <div>
                                  <p style={{ fontWeight: 600, color: "#0F172A", margin: 0, fontSize: 14 }}>{s.name}</p>
                                  {s.email && <p style={{ fontSize: 12, color: "#64748B", margin: 0, marginTop: 2 }}>{s.email}</p>}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "16px", color: "#475569" }}>{s.contact_name || "—"}</td>
                            <td style={{ padding: "16px", color: "#475569" }}>
                              {s.phone ? (
                                <a href={`tel:${s.phone.replace(/[^0-9+]/g, '')}`} style={{ color: "#3B82F6", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }} onClick={e => e.stopPropagation()}>
                                  <Phone size={12} /> {s.phone}
                                </a>
                              ) : "—"}
                            </td>
                            <td style={{ padding: "16px" }}>
                              {s.gstin
                                ? <span style={{ fontFamily: "monospace", fontSize: 12, background: "#EFF6FF", color: "#1D4ED8", padding: "4px 8px", borderRadius: 6 }}>{s.gstin}</span>
                                : <span style={{ color: "#94A3B8" }}>—</span>}
                            </td>
                            <td style={{ padding: "16px" }}>
                              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); createPOForSupplier(s); }}
                                  style={{ background: "rgba(232, 168, 56, 0.15)", border: `1px solid ${COLORS.accent}88`, padding: "8px 12px", borderRadius: 6, cursor: "pointer", color: COLORS.accent, display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}
                                  title="Create Purchase Order for this supplier"
                                >
                                  <Receipt size={14} /> New PO
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                                  style={{ background: "none", border: "1px solid #CBD5E1", padding: "8px 12px", borderRadius: 6, cursor: "pointer", color: "#475569", display: "flex", alignItems: "center", gap: 6, fontWeight: 500, fontSize: 13 }}
                                >
                                  <Edit2 size={16} /> Edit
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                                  style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", padding: "8px 12px", borderRadius: 6, cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", gap: 6, fontWeight: 500, fontSize: 13 }}
                                >
                                  <Trash2 size={16} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Analytics Row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="5" style={{ padding: "20px 24px", background: "#F8FAFC", borderBottom: `1px solid #E2E8F0` }}>
                                <div style={{ border: `1px solid #E2E8F0`, borderRadius: 12, padding: "24px", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                                  {performanceLoading ? (
                                    <div style={{ textAlign: "center", padding: 32, color: "#64748B" }}>
                                      <Activity size={24} className="spin" style={{ marginBottom: 12, color: "#3B82F6" }} />
                                      <p style={{ margin: 0 }}>Loading supplier analytics dashboard…</p>
                                    </div>
                                  ) : !performanceData ? (
                                    <p style={{ color: "#EF4444", textAlign: "center", padding: 32 }}>⚠️ Failed to load performance details.</p>
                                  ) : (
                                    <div>
                                      {/* Header & Metrics */}
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: `1px solid #E2E8F0`, paddingBottom: 16, flexWrap: "wrap", gap: 12 }}>
                                        <div>
                                          <h4 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                                            <Activity size={18} color="#8B5CF6" /> {performanceData.supplier.name} Dashboard
                                          </h4>
                                          <p style={{ fontSize: 12, color: "#64748B", margin: 0, marginTop: 4 }}>Vendor ID: SUP-{performanceData.supplier.id} · Registered GSTIN: {performanceData.supplier.gstin || "N/A"}</p>
                                        </div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                          <Btn 
                                            onClick={() => createPOForSupplier(performanceData.supplier)}
                                            style={{ background: COLORS.accent, color: "#18181b", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, border: "none" }}
                                          >
                                            <Receipt size={14} /> Create PO
                                          </Btn>
                                          <Btn 
                                            onClick={handleGenerateAutoDraft} 
                                            disabled={poDrafting}
                                            style={{ background: "#10B981", color: "#fff", display: "flex", alignItems: "center", gap: 8, border: "none" }}
                                          >
                                            {poDrafting ? "⏳ Auto-Drafting…" : "⚡ Auto-Draft PO (Low Stock)"}
                                          </Btn>
                                        </div>
                                      </div>

                                      {/* Stats Widgets */}
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
                                        <div style={{ background: "#F8FAFC", border: `1px solid #E2E8F0`, borderRadius: 8, padding: "12px 16px" }}>
                                          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Total Spend</span>
                                          <p style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0, marginTop: 4 }}>₹{parseFloat(performanceData.stats.total_spend || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                                        </div>
                                        <div style={{ background: "#F8FAFC", border: `1px solid #E2E8F0`, borderRadius: 8, padding: "12px 16px" }}>
                                          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Orders</span>
                                          <p style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0, marginTop: 4 }}>{performanceData.stats.total_pos} POs</p>
                                        </div>
                                        <div style={{ background: "#ECFDF5", border: `1px solid #D1FAE5`, borderRadius: 8, padding: "12px 16px" }}>
                                          <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>Completed</span>
                                          <p style={{ fontSize: 18, fontWeight: 700, color: "#047857", margin: 0, marginTop: 4 }}>{performanceData.stats.completed_pos}</p>
                                        </div>
                                        <div style={{ background: "#FEF2F2", border: `1px solid #FEE2E2`, borderRadius: 8, padding: "12px 16px" }}>
                                          <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>Pending</span>
                                          <p style={{ fontSize: 18, fontWeight: 700, color: "#B91C1C", margin: 0, marginTop: 4 }}>{performanceData.stats.pending_pos}</p>
                                        </div>
                                        <div style={{ background: "#F8FAFC", border: `1px solid #E2E8F0`, borderRadius: 8, padding: "12px 16px" }}>
                                          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Fulfillment</span>
                                          <p style={{ fontSize: 18, fontWeight: 700, color: "#3B82F6", margin: 0, marginTop: 4 }}>
                                            {performanceData.stats.fulfillment_rate !== null ? `${performanceData.stats.fulfillment_rate}%` : "—"}
                                          </p>
                                        </div>
                                        <div style={{ background: "#F8FAFC", border: `1px solid #E2E8F0`, borderRadius: 8, padding: "12px 16px" }}>
                                          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Lead Time</span>
                                          <p style={{ fontSize: 18, fontWeight: 700, color: "#8B5CF6", margin: 0, marginTop: 4 }}>
                                            {performanceData.stats.avg_lead_time_days !== null ? `${performanceData.stats.avg_lead_time_days}d` : "—"}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Sub columns: PO History (Left) and Catalog (Right) */}
                                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                        {/* Purchase Orders */}
                                        <div style={{ border: `1px solid #E2E8F0`, borderRadius: 8, overflow: "hidden" }}>
                                          <div style={{ padding: "12px 16px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                                            <p style={{ fontSize: 12, color: "#0F172A", fontWeight: 700, margin: 0 }}>🧾 Recent Purchase Orders</p>
                                          </div>
                                          {performanceData.recentPOs.length === 0 ? (
                                            <p style={{ color: "#64748B", fontSize: 13, fontStyle: "italic", padding: "16px" }}>No POs issued yet.</p>
                                          ) : (
                                            <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                              <table style={{ fontSize: 14, width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                                <thead>
                                                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                                                    <th style={{ padding: "8px 16px", fontWeight: 600, color: '#64748B' }}>PO #</th>
                                                    <th style={{ padding: "8px 16px", fontWeight: 600, color: '#64748B' }}>Date</th>
                                                    <th style={{ padding: "8px 16px", fontWeight: 600, color: '#64748B' }}>Status</th>
                                                    <th style={{ padding: "8px 16px", fontWeight: 600, color: '#64748B' }}>Total</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {performanceData.recentPOs.map((po) => (
                                                    <tr 
                                                      key={po.id} 
                                                      style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer", transition: "background 0.2s" }}
                                                      onClick={() => openPoDetails(po.id)}
                                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F8FAFC"}
                                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                                    >
                                                      <td style={{ fontFamily: "monospace", color: "#3B82F6", padding: "8px 16px", textDecoration: "underline", textUnderlineOffset: 2 }}>{po.po_number}</td>
                                                      <td style={{ padding: "8px 16px", color: '#475569' }}>{po.date}</td>
                                                      <td style={{ padding: "8px 16px" }}>
                                                        <span style={{
                                                          background: poStatusStyle(po.status).bg,
                                                          color: poStatusStyle(po.status).text,
                                                          fontSize: 11, fontWeight: 600,
                                                          padding: "2px 8px", borderRadius: 12
                                                        }}>
                                                          {po.status}
                                                        </span>
                                                      </td>
                                                      <td style={{ fontWeight: 600, color: "#0F172A", padding: "8px 16px" }}>₹{parseFloat(po.total_amount).toFixed(0)}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>

                                        {/* Catalog */}
                                        <div style={{ border: `1px solid #E2E8F0`, borderRadius: 8, overflow: "hidden" }}>
                                          <div style={{ padding: "12px 16px", backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                                            <p style={{ fontSize: 12, color: "#0F172A", fontWeight: 700, margin: 0 }}>📦 Supplied Items Catalog</p>
                                          </div>
                                          {performanceData.itemsSupplied.length === 0 ? (
                                            <p style={{ color: "#64748B", fontSize: 13, fontStyle: "italic", padding: "16px" }}>No stock items registered for this supplier.</p>
                                          ) : (
                                            <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                              <table style={{ fontSize: 14, width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                                <thead>
                                                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                                                    <th style={{ padding: "8px 16px", fontWeight: 600, color: '#64748B' }}>Item</th>
                                                    <th style={{ padding: "8px 16px", fontWeight: 600, color: '#64748B' }}>Last Cost</th>
                                                    <th style={{ padding: "8px 16px", fontWeight: 600, color: '#64748B' }}>Batches</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {performanceData.itemsSupplied.map((it, idx) => {
                                                    const isSelected = selectedCatalogItem === it.name;
                                                    const itemHistory = performanceData.priceHistory.filter(ph => ph.name === it.name);
                                                    const itemTrend = (() => {
                                                      if (itemHistory.length < 2) return null;
                                                      const latest = parseFloat(itemHistory[0].price);
                                                      const prev = parseFloat(itemHistory[1].price);
                                                      if (prev === 0) return null;
                                                      return ((latest - prev) / prev) * 100;
                                                    })();

                                                    return (
                                                      <Fragment key={idx}>
                                                        <tr 
                                                          onClick={() => setSelectedCatalogItem(isSelected ? null : it.name)} 
                                                          style={{ 
                                                            cursor: "pointer", 
                                                            backgroundColor: isSelected ? "#F8FAFC" : "transparent",
                                                            borderBottom: "1px solid #F1F5F9"
                                                          }}
                                                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                                                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                                                        >
                                                          <td style={{ fontWeight: 500, padding: "8px 16px", color: '#0F172A' }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                              {isSelected ? <ChevronDown size={12} color="#94A3B8" /> : <ChevronRight size={12} color="#94A3B8" />}
                                                              <span style={{ color: "#8B5CF6", fontFamily: "monospace", fontSize: 10 }}>{it.item_code}</span>
                                                              {it.name}
                                                            </div>
                                                          </td>
                                                          <td style={{ color: "#0F172A", padding: "8px 16px", fontWeight: 500 }}>
                                                            ₹{parseFloat(it.last_price || 0).toFixed(2)}
                                                            {itemTrend !== null && (
                                                              <span style={{ 
                                                                marginLeft: 6, fontSize: 10,
                                                                color: itemTrend > 0 ? "#EF4444" : itemTrend < 0 ? "#10B981" : "#64748B",
                                                                fontWeight: 600
                                                              }}>
                                                                {itemTrend > 0 ? `↗ +${itemTrend.toFixed(1)}%` : itemTrend < 0 ? `↘ ${itemTrend.toFixed(1)}%` : `→ 0.0%`}
                                                              </span>
                                                            )}
                                                          </td>
                                                          <td style={{ padding: "8px 16px", color: '#64748B' }}>{it.total_batches}</td>
                                                        </tr>
                                                        {isSelected && (
                                                          <tr>
                                                            <td colSpan="3" style={{ padding: "12px 16px 16px 32px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                                                              <div style={{ borderLeft: `2px solid #8B5CF6`, paddingLeft: 12 }}>
                                                                <p style={{ fontSize: 10, color: "#64748B", textTransform: "uppercase", fontWeight: 600, marginBottom: 8, margin: 0 }}>📈 Price History Timeline</p>
                                                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                                                                  {itemHistory.map((h, hIdx) => {
                                                                    const prevPriceRecord = itemHistory[hIdx + 1];
                                                                    let priceDiffPct = null;
                                                                    if (prevPriceRecord) {
                                                                      const curP = parseFloat(h.price);
                                                                      const prevP = parseFloat(prevPriceRecord.price);
                                                                      if (prevP > 0) {
                                                                        priceDiffPct = ((curP - prevP) / prevP) * 100;
                                                                      }
                                                                    }
                                                                    return (
                                                                      <div key={hIdx} style={{ fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", border: `1px solid #E2E8F0`, padding: "6px 12px", borderRadius: 6 }}>
                                                                        <span style={{ color: "#64748B" }}>{new Date(h.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                          <span style={{ fontWeight: 600, color: "#0F172A" }}>₹{parseFloat(h.price).toFixed(2)}</span>
                                                                          {priceDiffPct !== null && (
                                                                            <span style={{ 
                                                                              fontSize: 10,
                                                                              color: priceDiffPct > 0 ? "#EF4444" : priceDiffPct < 0 ? "#10B981" : "#64748B",
                                                                              fontWeight: 600
                                                                            }}>
                                                                              {priceDiffPct > 0 ? `↗ +${priceDiffPct.toFixed(1)}%` : priceDiffPct < 0 ? `↘ ${priceDiffPct.toFixed(1)}%` : `→ 0.0%`}
                                                                            </span>
                                                                          )}
                                                                        </div>
                                                                      </div>
                                                                    );
                                                                  })}
                                                                </div>
                                                              </div>
                                                            </td>
                                                          </tr>
                                                        )}
                                                      </Fragment>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0" }}>
                <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
              </div>
            </>
          )}
        </Card>
      </div>

      {deleteConfirmId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Card style={{ maxWidth: 400, width: "100%", padding: 32, borderRadius: 16 }}>
            <h3 style={{ marginTop: 0, color: "#0F172A", fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle color="#EF4444" size={24} /> Confirm Deletion
            </h3>
            <p style={{ color: "#475569", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>Are you sure you want to delete this supplier? This action cannot be undone and may affect historical PO references.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</Btn>
              <Btn style={{ backgroundColor: "#EF4444", border: "none" }} onClick={executeRemove}>Yes, Delete</Btn>
            </div>
          </Card>
        </div>
      )}
      
      {viewPoId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Card style={{ maxWidth: 700, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", borderRadius: 16, minWidth: 0 }}>
            {/* Modal Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "#0F172A" }}>
                <Receipt size={20} color="#3B82F6" /> Purchase Order Details
              </h3>
              <button onClick={() => setViewPoId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              {poLoading ? (
                <div style={{ textAlign: "center", padding: 48, color: "#64748B" }}>
                  <Activity size={24} className="spin" style={{ margin: "0 auto 12px", color: "#3B82F6", display: "block" }} />
                  Loading invoice details...
                </div>
              ) : !poDetails ? (
                <p style={{ textAlign: "center", color: "#EF4444", padding: 24 }}>Failed to load PO details.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  
                  {/* PO Info Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", padding: 16, borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>PO Number</p>
                      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>{poDetails.po_number}</p>
                    </div>
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", padding: 16, borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Total Amount</p>
                      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#0F172A" }}>₹{parseFloat(poDetails.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 32 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600 }}>Created Date</p>
                      <p style={{ margin: "4px 0 0", fontSize: 14, color: "#0F172A", fontWeight: 500 }}>{poDetails.date}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600 }}>Status</p>
                      <span style={{ 
                        display: "inline-block", marginTop: 4,
                        background: poDetails.status === "Received" ? "#D1FAE5" : poDetails.status === "Sent" ? "#FEF3C7" : "#F1F5F9",
                        color: poDetails.status === "Received" ? "#047857" : poDetails.status === "Sent" ? "#D97706" : "#475569",
                        fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 12
                      }}>
                        {poDetails.status}
                      </span>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#0F172A" }}>Invoice Items</h4>
                    <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflowX: "auto" }}>
                      <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                            <th style={{ padding: "10px 16px", color: "#64748B", fontWeight: 600 }}>Item</th>
                            <th style={{ padding: "10px 16px", color: "#64748B", fontWeight: 600 }}>Qty</th>
                            <th style={{ padding: "10px 16px", color: "#64748B", fontWeight: 600 }}>Price</th>
                            <th style={{ padding: "10px 16px", color: "#64748B", fontWeight: 600 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poDetails.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "12px 16px", color: "#0F172A", fontWeight: 500 }}>{it.name}</td>
                              <td style={{ padding: "12px 16px", color: "#475569" }}>{it.qty} {it.unit}</td>
                              <td style={{ padding: "12px 16px", color: "#475569" }}>₹{parseFloat(it.unit_price).toFixed(2)}</td>
                              <td style={{ padding: "12px 16px", color: "#0F172A", fontWeight: 600 }}>₹{parseFloat(it.total_price).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "flex-end" }}>
              <Btn onClick={() => setViewPoId(null)} style={{ background: "#0F172A", color: "white", border: "none" }}>Close Invoice</Btn>
            </div>
          </Card>
        </div>
      )}

    </Section>
  );
}
