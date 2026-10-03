import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import SearchBar from "../../components/SearchBar";
import { COLORS, STOCK_CATEGORIES } from "../../styles/colors";
import { usePaginatedApi } from "../../hooks/useApi";
import * as api from "../../api";
import { useAppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutList, Download, RefreshCw, BarChart2, ShoppingBag, Filter,
  AlertOctagon, PackagePlus, FileSpreadsheet, UploadCloud
} from "lucide-react";

import { today } from "../../utils/dates";
const LIMIT = 20;

import PriceTrendChart from "./PriceTrendChart";
import LedgerTab from "./LedgerTab";
import ProcurementTab from "./ProcurementTab";
import InsightsTab from "./InsightsTab";
import PrintPreviewModal from "./PrintPreviewModal";
import QuickAdjustmentModal from "./QuickAdjustmentModal";
import AddItemDrawer from "./AddItemDrawer";
import StockImportModal from "../../components/StockImportModal";
import EditItemDrawer from "./EditItemDrawer";
import ErrorBoundary from "../../components/ErrorBoundary";
import ExportReportModal from "../../components/ExportReportModal";

// Extracted shared components
import { StockKpiCards } from "../../components/StockMaster/StockKpiCards";
import StoreAlertsPanel from "../../components/StockMaster/StoreAlertsPanel";
import { StockTable } from "../../components/StockMaster/StockTable";
import ItemDetailDrawer from "../../components/StockMaster/ItemDetailDrawer";
import AppendBatchModal from "../../components/StockMaster/AppendBatchModal";
import DeleteConfirmModal from "../../components/StockMaster/DeleteConfirmModal";

export default function StockScreen() {
  const { stocks, refreshStockNames, reorderAlerts, refreshReorderAlerts } = useAppContext();
  const { hasPermission, roles } = useAuth();
  const canEditStock = hasPermission("stock.edit") || hasPermission("stock.delete");
  const isStoreManager = roles.some((r) => r.key === "store_manager") || hasPermission("stock.create");
  const [msg, setMsg]   = useState("");
  const [filters, setFilters] = useState({ low_stock: "", expiry_status: "", supplier: "", active_only: "", category: "", storage_zone: "" });
  const [stats, setStats]     = useState({ total_spend: 0, store_value: 0, low_stock_value: 0 });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const { items, total, page, loading, error, fetch, setItems, setTotal } = usePaginatedApi(api.stock.list);

  const [editingId, setEditingId] = useState(null);
  const [editRemaining, setEditRemaining] = useState("");
  const [editMinAlert, setEditMinAlert] = useState("");
  const [editReason, setEditReason] = useState("Audit Correction");
  const [editNotes, setEditNotes] = useState("");
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editItemCode, setEditItemCode] = useState("");

  // Print Label Preview Modal State
  const [printModalItem, setPrintModalItem] = useState(null);
  const [printConfig, setPrintConfig] = useState({ showPrice: true, labelFormat: "qr", showExpiry: true });

  // Quick Adjustment Modal State
  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustMinAlert, setAdjustMinAlert] = useState("");
  const [adjustReason, setAdjustReason] = useState("Audit Correction");
  const [adjustNotes, setAdjustNotes] = useState("");

  const [activeTab, setActiveTab] = useState("inventory"); // "inventory", "ledger", "insights", "procurement"
  const [procurementData, setProcurementData] = useState(null);
  const [procurementLoading, setProcurementLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerSummary, setLedgerSummary] = useState(null);
  const [ledgerFilters, setLedgerFilters] = useState({ type: "", q: "", date_from: "", date_to: "" });
  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [chartItem, setChartItem] = useState("");

  const [groupByItem, setGroupByItem] = useState(true);

  const loadLedger = async (params = {}) => {
    setLedgerLoading(true);
    try {
      const p = params.page || ledgerPage;
      const mergedFilters = { ...ledgerFilters, ...params.filters };
      const res = await api.stock.ledger({ page: p, limit: LIMIT, ...mergedFilters });
      setLedgerData(res.data || []);
      setLedgerTotal(res.total || 0);
      setLedgerSummary(res.summary || null);
      setLedgerPage(p);
      if (params.filters) setLedgerFilters(mergedFilters);
    } catch (err) {
      console.error("[loadLedger] Error loading stock ledger:", err);
      setMsg("Failed to load stock ledger: " + (err.message || "Network error"));
      setTimeout(() => setMsg(""), 4000);
    } finally {
      setLedgerLoading(false);
    }
  };

  const exportLedgerCSV = () => {
    const headers = [
      "Timestamp",
      "Transaction Type",
      "Item Code",
      "Item Name",
      "Destination / Party",
      "Quantity",
      "Unit",
      "Unit Price (INR)",
      "Total Value (INR)",
      "Balance Before",
      "Balance After",
      "Reference Document",
      "User / Reason"
    ];
    const rows = ledgerData.map((r) => [
      `"${r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : ""}"`,
      `"${r.transaction_type || ""}"`,
      `"${r.item_code || ""}"`,
      `"${(r.item_name || r.name || "").replace(/"/g, '""')}"`,
      `"${(r.department || r.supplier || "Central Store").replace(/"/g, '""')}"`,
      r.qty !== undefined && r.qty !== null ? r.qty : 0,
      `"${r.unit || ""}"`,
      r.unit_price !== undefined && r.unit_price !== null ? r.unit_price : 0,
      r.total_value !== undefined && r.total_value !== null ? r.total_value : 0,
      r.balance_qty_before !== undefined && r.balance_qty_before !== null ? r.balance_qty_before : "",
      r.balance_qty_after !== undefined && r.balance_qty_after !== null ? r.balance_qty_after : "",
      `"${r.reference_doc_no || r.reference_doc_type || ""}"`,
      `"${(r.reason || r.notes || "").replace(/"/g, '""')}"`
    ].join(","));
    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `Kapila_Stock_Ledger_${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportLedgerExcel = async () => {
    try {
      setMsg("Exporting Stock Ledger Excel...");
      await api.stock.exportLedgerExcel(ledgerFilters);
      setMsg("Stock Ledger Excel exported successfully ✓");
      setTimeout(() => setMsg(""), 3500);
    } catch (err) {
      setMsg("Ledger export failed: " + (err.message || "Network error"));
      setTimeout(() => setMsg(""), 4000);
    }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await api.stock.insights();
      setInsightsData(res.data);
      const firstItem = (res.data?.priceTrends || [])[0]?.name || "";
      setChartItem(firstItem);
    } catch {}
    setInsightsLoading(false);
  };

  const loadProcurement = async () => {
    setProcurementLoading(true);
    try {
      const [posRes, grnRes, suppRes] = await Promise.all([
        api.purchaseOrders.list({ limit: 10, sort: "date", order: "desc" }),
        api.grn.list({ limit: 10, sort: "date", order: "desc" }),
        api.suppliers.list({ limit: 100, sort: "name", order: "asc" }),
      ]);
      setProcurementData({
        recentPOs:  posRes.data  || [],
        recentGRNs: grnRes.data  || [],
        suppliers:  suppRes.data || [],
      });
    } catch {}
    setProcurementLoading(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "ledger")      loadLedger();
    if (tab === "insights")    loadInsights();
    if (tab === "procurement") loadProcurement();
  };

  const refreshActiveTab = (tab = activeTab) => {
    if (tab === "ledger")      loadLedger();
    if (tab === "insights")    loadInsights();
    if (tab === "procurement") loadProcurement();
  };

  const load = async (overrides = {}) => {
    const merged = { ...filters, ...overrides };
    const isGrouped = overrides.groupByItem !== undefined ? overrides.groupByItem : groupByItem;
    const currentLimit = overrides.limit || (isGrouped ? 1000 : LIMIT);
    const res = await fetch({ limit: currentLimit, sort: "created_at", order: "desc", ...merged });
    if (res && res.stats) {
      setStats(res.stats);
    }
  };

  const handleNLPSearch = async (queryText) => {
    setMsg("AI parsing query...");
    try {
      const res = await api.stock.searchNLP(queryText);
      if (res.success && res.data) {
        setItems(res.data);
        setTotal(res.data.length);
        setMsg(`AI Search results for: "${queryText}" (${res.data.length} items found) ✓`);
        setTimeout(() => setMsg(""), 4000);
      } else {
        setMsg("No items found matching the AI query.");
        setTimeout(() => setMsg(""), 3000);
      }
    } catch (err) {
      setMsg("AI Search failed: " + err.message);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  useEffect(() => {
    load();
    refreshReorderAlerts();
  }, []);

  useEffect(() => {
    const syncOffline = async () => {
      if (!navigator.onLine) return;
      // Cross-tab lock: only one tab flushes the queue at a time.
      const lockKey = "kapila_offline_stock_lock";
      const now = Date.now();
      const lock = parseInt(localStorage.getItem(lockKey) || "0", 10);
      if (lock && now - lock < 30000) return;
      localStorage.setItem(lockKey, String(now));

      try {
        const queue = JSON.parse(localStorage.getItem("kapila_offline_stock") || "[]");
        if (queue.length === 0) return;

        setMsg(`Syncing ${queue.length} offline records...`);
        // Sync one at a time; drop each from the queue as soon as it succeeds
        // so a later failure never replays an already-synced item.
        while (queue.length > 0) {
          await api.stock.create(queue[0]);
          queue.shift();
          localStorage.setItem("kapila_offline_stock", JSON.stringify(queue));
        }
        setMsg("Synced offline purchases successfully ✓");
        load({ page: 1 });
        refreshStockNames();
        refreshActiveTab();
      } catch (err) {
        setMsg("Sync error: " + err.message);
      } finally {
        localStorage.removeItem(lockKey);
        setTimeout(() => setMsg(""), 3000);
      }
    };

    window.addEventListener("online", syncOffline);
    syncOffline();
    return () => window.removeEventListener("online", syncOffline);
  }, [stocks]);

  const remove = async (id) => {
    try {
      await api.stock.remove(id);
      load({ page: 1 });
      refreshStockNames();
      refreshActiveTab();
    } catch (e) { setMsg("Error: " + e.message); }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditRemaining(item.remaining.toString());
    setEditMinAlert(item.min_alert_qty !== null ? item.min_alert_qty.toString() : "");
    setEditReason("Audit Correction");
    setEditNotes("");
    setEditName(item.name || "");
    setEditUnit(item.unit || "kg");
    setEditPrice(item.price !== null && item.price !== undefined ? item.price.toString() : "");
    setEditItemCode(item.item_code || "");
  };

  const saveEdit = async (id) => {
    try {
      await api.stock.update(id, {
        remaining: parseFloat(editRemaining),
        min_alert_qty: editMinAlert.trim() === "" ? null : parseFloat(editMinAlert),
        reason: editReason,
        notes: editNotes.trim() === "" ? null : editNotes,
        name: editName.trim() === "" ? undefined : editName,
        unit: editUnit,
        price: editPrice.trim() === "" ? undefined : parseFloat(editPrice),
        item_code: editItemCode.trim() === "" ? undefined : editItemCode
      });
      setEditingId(null);
      load();
      refreshActiveTab();
    } catch (e) { setMsg("Error updating stock: " + e.message); }
  };

  const handleFilterChange = (field, val) => {
    setFilters((f) => {
      const nextFilters = { ...f, [field]: val };
      load({ page: 1, ...nextFilters });
      return nextFilters;
    });
  };

  const uniqueSuppliers = Array.from(new Set(stocks.map((s) => s.supplier).filter(Boolean)));

  const exportCSV = () => {
    const headers = ["item_code", "name", "qty", "remaining", "unit", "price", "supplier", "batch_no", "expiry_date", "date"];
    const rows = items.map((r) =>
      headers.map((h) => (r[h] !== undefined && r[h] !== null ? `"${String(r[h]).replace(/"/g, '""')}"` : '""')).join(",")
    );
    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = `kapila_stock_${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const lowStockItems = reorderAlerts.map(a => ({
    id: a.id,
    name: a.name,
    item_code: a.item_code,
    remaining: a.current_stock,
    qty: a.min_qty > 0 ? Math.max(a.min_qty * 2, a.reorder_qty) : a.reorder_qty,
    unit: a.unit,
    min_alert_qty: a.min_qty
  }));

  const expiringSoonItems = stocks.filter((item) => {
    if (!item.expiry_date || item.remaining <= 0) return false;
    const todayVal = new Date(today());
    const expiryVal = new Date(item.expiry_date);
    const diffTime = expiryVal - todayVal;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  });

  const handleReorderClick = (item) => {
    load({ page: 1, q: item.name });
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
    setMsg("PO copied to clipboard ✓");
    setTimeout(() => setMsg(""), 3000);
  };

  const handleStatCardClick = (type) => {
    setFilters((f) => {
      let nextFilters = { ...f };
      if (type === "total") {
        nextFilters.low_stock = "";
        nextFilters.active_only = "";
      } else if (type === "active") {
        nextFilters.low_stock = "";
        nextFilters.active_only = "true";
      } else if (type === "low") {
        nextFilters.low_stock = "true";
        nextFilters.active_only = "";
      }
      load({ page: 1, ...nextFilters });
      return nextFilters;
    });
  };

  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewDrawerItem, setViewDrawerItem] = useState(null);
  const [appendModalItem, setAppendModalItem] = useState(null);
  const [deleteModalItem, setDeleteModalItem] = useState(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportAvailableStockExcel = async () => {
    try {
      setIsExportingExcel(true);
      await api.stock.exportExcel();
      setMsg("Available stock Excel report exported successfully ✓");
      setTimeout(() => setMsg(""), 3500);
    } catch (err) {
      console.error("Export Excel error:", err);
      setMsg("Export failed: " + (err.message || "Network error"));
      setTimeout(() => setMsg(""), 4000);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      {/* KPI Strip */}
      <StockKpiCards 
        data={stats} 
        filters={filters} 
        handleStatCardClick={handleStatCardClick} 
      />

      {/* Collapsible Alerts Panel */}
      {(lowStockItems.length > 0 || expiringSoonItems.length > 0) && (
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          {alertsExpanded ? (
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                <button 
                  onClick={() => setAlertsExpanded(false)}
                  style={{ 
                    background: "none", 
                    border: "none", 
                    color: COLORS.brand, 
                    fontSize: 12, 
                    fontWeight: 600, 
                    cursor: "pointer", 
                    padding: "4px 8px" 
                  }}
                >
                  Collapse Alerts
                </button>
              </div>
              <StoreAlertsPanel
                lowStockItems={lowStockItems}
                expiringSoonItems={expiringSoonItems}
                copyPOToClipboard={copyPOToClipboard}
                generateWhatsAppPO={generateWhatsAppPO}
                handleReorderClick={handleReorderClick}
                defaultCollapsed={false}
                style={{ width: "100%" }}
              />
            </div>
          ) : (
            <div style={{ 
              background: COLORS.surface, 
              border: `1px solid ${COLORS.border}`, 
              borderRadius: 12, 
              padding: "12px 20px", 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center" 
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertOctagon size={16} style={{ color: COLORS.danger }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.danger }}>
                  Store Alerts:
                </span>
                <span style={{ fontSize: 13, color: COLORS.text }}>
                  {lowStockItems.length} items low on stock
                  {expiringSoonItems.length > 0 && ` and ${expiringSoonItems.length} items expiring soon`}
                </span>
              </div>
              <button 
                onClick={() => setAlertsExpanded(true)}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: COLORS.brand, 
                  fontSize: 13, 
                  fontWeight: 600, 
                  cursor: "pointer", 
                  padding: "4px 8px" 
                }}
              >
                Expand Alerts
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>
        {/* List */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {/* Tabs header */}
          <div 
            role="tablist" 
            aria-label="Stock Master Views"
            style={{ padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 8, alignItems: "center", overflowX: "auto", flexWrap: "nowrap" }}
          >
            {[
              { id: "inventory",   label: "Inventory",     icon: <LayoutList size={14} /> },
              { id: "ledger",      label: "Ledger",        icon: <RefreshCw size={14} /> },
              { id: "insights",    label: "Cost Insights", icon: <BarChart2 size={14} /> },
              { id: "procurement", label: "Procurement",   icon: <ShoppingBag size={14} /> },
            ].map(({ id, label, icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                tabIndex={activeTab === id ? 0 : -1}
                onClick={() => handleTabChange(id)}
                style={{
                  background: activeTab === id ? COLORS.brand + "15" : "transparent",
                  border: "none",
                  color: activeTab === id ? COLORS.brand : COLORS.muted,
                  padding: "8px 12px",
                  fontSize: 13.5,
                  fontWeight: activeTab === id ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                  outline: "none",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                {icon}
                {label}
              </button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {isStoreManager && (
                <Btn small onClick={() => setAddDrawerOpen(true)} title="Add a new item to stock">
                  <PackagePlus size={14} style={{ marginRight: 4 }} /> Add Item
                </Btn>
              )}
              {isStoreManager && (
                <Btn small variant="ghost" onClick={() => setImportModalOpen(true)} title="Bulk import stock from Excel or PDF">
                  <UploadCloud size={14} style={{ marginRight: 4 }} /> Import Excel/PDF
                </Btn>
              )}
              <Btn small variant="ghost" onClick={exportCSV} title="Export current view to CSV">
                <Download size={14} style={{ marginRight: 4 }} /> Export CSV
              </Btn>
              <Btn
                small
                variant="ghost"
                onClick={handleExportAvailableStockExcel}
                title="Export live Available Stock with warehouse racks, vendors & timestamps to Excel (.xlsx)"
                disabled={isExportingExcel}
              >
                <FileSpreadsheet size={14} style={{ marginRight: 4 }} />
                {isExportingExcel ? "Exporting..." : "Export Excel (.xlsx)"}
              </Btn>
              <Btn
                small
                variant="ghost"
                onClick={() => setIsExportModalOpen(true)}
                title="Generate Complete Enterprise Excel Inventory Report (7 Sheets)"
              >
                <FileSpreadsheet size={14} style={{ marginRight: 4 }} /> Full 7-Sheet Report
              </Btn>
            </div>
          </div>

          {activeTab === "inventory" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: COLORS.bg + "22", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1, minWidth: 280 }}>
                  <SearchBar onSearch={(q) => load({ page: 1, q })} placeholder="Search items…" style={{ flex: 1 }} />
                  <button 
                    onClick={() => {
                      const q = prompt("Ask AI to filter stock (e.g. 'show spices under 5kg expiring soon'):");
                      if (q) handleNLPSearch(q);
                    }}
                    style={{
                      background: COLORS.brand || "var(--color-gold)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 4px rgba(232, 168, 56, 0.2)",
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap"
                    }}
                    title="Natural Language Search via Gemini AI"
                  >
                    ✨ AI Search
                  </button>
                </div>
                <Btn variant="ghost" small onClick={() => {
                  const nextVal = !groupByItem;
                  setGroupByItem(nextVal);
                  load({ page: 1, limit: nextVal ? 1000 : LIMIT, groupByItem: nextVal });
                }} style={{ fontSize: 12, padding: "6px 12px" }}>
                  {groupByItem ? "View All Batches" : "Group by Item"}
                </Btn>
                
                <div style={{ height: "24px", width: "1px", background: COLORS.border, margin: "0 6px" }}></div>
                
                {/* Pill Filters */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    onClick={() => handleFilterChange("low_stock", filters.low_stock === "true" ? "" : "true")}
                    className={filters.low_stock === "true" ? "chip active" : "chip"}
                    style={{ fontSize: 12 }}
                  >
                    <Filter size={12} /> Low Stock
                  </button>

                  <select
                    value={filters.expiry_status}
                    onChange={(e) => handleFilterChange("expiry_status", e.target.value)}
                    className={filters.expiry_status ? "chip active" : "chip"}
                    style={{ 
                      fontSize: 12, 
                      paddingRight: "24px", 
                      appearance: "none", 
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, 
                      backgroundRepeat: "no-repeat", 
                      backgroundPosition: "right 8px center", 
                      backgroundSize: "10px",
                      cursor: "pointer",
                      outline: "none"
                    }}
                  >
                    <option value="">All Expiry</option>
                    <option value="expired">Expired</option>
                    <option value="expiring">Expiring Soon</option>
                    <option value="fresh">Fresh</option>
                  </select>

                  <select
                    value={filters.supplier}
                    onChange={(e) => handleFilterChange("supplier", e.target.value)}
                    className={filters.supplier ? "chip active" : "chip"}
                    style={{ 
                      fontSize: 12, 
                      paddingRight: "24px", 
                      appearance: "none", 
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, 
                      backgroundRepeat: "no-repeat", 
                      backgroundPosition: "right 8px center", 
                      backgroundSize: "10px",
                      cursor: "pointer",
                      outline: "none"
                    }}
                  >
                    <option value="">All Suppliers</option>
                    {uniqueSuppliers.map((sup) => <option key={sup} value={sup}>{sup}</option>)}
                  </select>

                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange("category", e.target.value)}
                    className={filters.category ? "chip active" : "chip"}
                    style={{
                      fontSize: 12,
                      paddingRight: "24px",
                      appearance: "none",
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                      backgroundSize: "10px",
                      cursor: "pointer",
                      outline: "none"
                    }}
                  >
                    <option value="">All Categories</option>
                    {STOCK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <select
                    value={filters.storage_zone || ""}
                    onChange={(e) => handleFilterChange("storage_zone", e.target.value)}
                    className={filters.storage_zone ? "chip active" : "chip"}
                    style={{
                      fontSize: 12,
                      paddingRight: "24px",
                      appearance: "none",
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                      backgroundSize: "10px",
                      cursor: "pointer",
                      outline: "none"
                    }}
                  >
                    <option value="">All Storage Zones</option>
                    <option value="General Store & Provisions">General Store & Provisions</option>
                    <option value="Main Dry Store - Heavy Grains & Rice">Main Dry Store - Rice</option>
                    <option value="Main Dry Store - Heavy Grains & Flour">Main Dry Store - Flour</option>
                    <option value="Main Dry Store - Pulses & Lentils">Main Dry Store - Pulses</option>
                    <option value="Main Dry Store - Edible Oils & Ghee">Main Dry Store - Oils</option>
                    <option value="Main Dry Store - Spices & Seasonings">Main Dry Store - Spices</option>
                    <option value="Cold Chain - Walk-in Dairy Chiller">Cold Chain - Chiller</option>
                    <option value="Cold Chain - Deep Freeze (-18°C)">Cold Chain - Deep Freeze</option>
                    <option value="Fresh Produce - Daily Vegetable Bay">Fresh Produce Bay</option>
                    <option value="Beverage Cellar & Soft Drink Store">Beverage Cellar</option>
                  </select>

                  {(filters.low_stock || filters.expiry_status || filters.supplier || filters.category || filters.storage_zone) && (
                    <button
                      onClick={() => {
                        const resetFilters = { low_stock: "", expiry_status: "", supplier: "", active_only: "", category: "", storage_zone: "" };
                        setFilters(resetFilters);
                        load({ page: 1, ...resetFilters });
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: "4px 6px"
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              <StockTable
                items={items}
                loading={loading}
                error={error}
                page={page}
                total={total}
                limit={groupByItem ? 1000 : LIMIT}
                onPage={(p) => load({ page: p })}
                groupByItem={groupByItem}
                readOnly={!canEditStock}

                onView={(item) => setViewDrawerItem(item)}
                onEditItem={(item) => setEditItem(item)}
                onAppend={(item) => setAppendModalItem(item)}
                onDelete={(item) => setDeleteModalItem(item)}
                onExportExcel={handleExportAvailableStockExcel}

                setPrintModalItem={setPrintModalItem}
                setAdjustModalItem={setAdjustModalItem}
                setAdjustQty={setAdjustQty}
                setAdjustMinAlert={setAdjustMinAlert}
                setAdjustReason={setAdjustReason}
                setAdjustNotes={setAdjustNotes}
                remove={(id) => setDeleteModalItem(items.find((i) => i.id === id))}
                editingId={null}
                startEdit={(item) => setEditItem(item)}
                saveEdit={saveEdit}
                editRemaining={editRemaining}
                setEditRemaining={setEditRemaining}
                editMinAlert={editMinAlert}
                setEditMinAlert={setEditMinAlert}
                editReason={editReason}
                setEditReason={setEditReason}
                editNotes={editNotes}
                setEditNotes={setEditNotes}
                editName={editName}
                setEditName={setEditName}
                editUnit={editUnit}
                setEditUnit={setEditUnit}
                editPrice={editPrice}
                setEditPrice={setEditPrice}
                editItemCode={editItemCode}
                setEditItemCode={setEditItemCode}
              />
            </div>
          )}

          {activeTab === "ledger" && (
            <LedgerTab
              ledgerLoading={ledgerLoading}
              ledgerData={ledgerData}
              ledgerPage={ledgerPage}
              ledgerTotal={ledgerTotal}
              ledgerSummary={ledgerSummary}
              limit={LIMIT}
              onPage={(p) => loadLedger({ page: p })}
              filters={ledgerFilters}
              onFilterChange={(next) => loadLedger({ page: 1, filters: next })}
              onExport={exportLedgerCSV}
              onExportExcel={exportLedgerExcel}
            />
          )}

          {activeTab === "insights" && (
            <InsightsTab 
              insightsLoading={insightsLoading} 
              insightsData={insightsData} 
              chartItem={chartItem} 
              setChartItem={setChartItem} 
            />
          )}

          {activeTab === "procurement" && (
            <ProcurementTab procurementLoading={procurementLoading} procurementData={procurementData} />
          )}

         </Card>
      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal 
        printModalItem={printModalItem}
        setPrintModalItem={setPrintModalItem}
        printConfig={printConfig}
        setPrintConfig={setPrintConfig}
      />

      {/* Quick Adjustment Modal */}
      <QuickAdjustmentModal 
        adjustModalItem={adjustModalItem}
        setAdjustModalItem={setAdjustModalItem}
        adjustQty={adjustQty}
        setAdjustQty={setAdjustQty}
        adjustMinAlert={adjustMinAlert}
        setAdjustMinAlert={setAdjustMinAlert}
        adjustReason={adjustReason}
        setAdjustReason={setAdjustReason}
        adjustNotes={adjustNotes}
        setAdjustNotes={setAdjustNotes}
        load={load}
        refreshActiveTab={refreshActiveTab}
        setMsg={setMsg}
      />
      {/* Add New Item Drawer */}
      <AddItemDrawer
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        onSaved={() => {
          load({ page: 1 });
          refreshStockNames();
          refreshActiveTab();
          setMsg("Item added ✓");
          setTimeout(() => setMsg(""), 3000);
        }}
      />
      {/* Edit / Append / Delete Item Drawer */}
      <ErrorBoundary title="Item Maintenance Drawer Error">
        <EditItemDrawer
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            load({ page: 1 });
            refreshStockNames();
            refreshActiveTab();
            setMsg("Item updated ✓");
            setTimeout(() => setMsg(""), 3000);
          }}
        />
      </ErrorBoundary>

      {/* 360° Item Detail Dossier Drawer */}
      <ItemDetailDrawer
        item={viewDrawerItem}
        onClose={() => setViewDrawerItem(null)}
        onEditItem={(it) => {
          setViewDrawerItem(null);
          setEditItem(it);
        }}
        onAppendBatch={(it) => {
          setViewDrawerItem(null);
          setAppendModalItem(it);
        }}
        onPrintItem={(it) => {
          setPrintModalItem(it);
        }}
      />

      {/* Append Inward Batch Modal */}
      <AppendBatchModal
        item={appendModalItem}
        onClose={() => setAppendModalItem(null)}
        onSuccess={() => {
          load({ page: 1 });
          refreshStockNames();
          refreshActiveTab();
          setMsg("Batch appended successfully ✓");
          setTimeout(() => setMsg(""), 3000);
        }}
      />

      {/* Decommission / Delete Stock Modal */}
      <DeleteConfirmModal
        item={deleteModalItem}
        onClose={() => setDeleteModalItem(null)}
        onSuccess={() => {
          load({ page: 1 });
          refreshStockNames();
          refreshActiveTab();
          setMsg("Item removed from stock ✓");
          setTimeout(() => setMsg(""), 3000);
        }}
      />
      <ExportReportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
      <StockImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={() => {
          load({ page: 1 });
          refreshStockNames();
          refreshActiveTab();
          setMsg("Stock import complete ✓");
          setTimeout(() => setMsg(""), 3000);
        }}
      />
      {msg && <p style={{ display: "none" }}>{msg}</p>}
    </div>
  );
}
