import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import ModalShell from "../../components/ui/ModalShell";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import { usePaginatedApi } from "../../hooks/useApi";
import { useAppContext } from "../../context/AppContext";
import * as api from "../../api";
import ReorderAgentStatusBar from "../../components/agents/ReorderAgentStatusBar";
import {
  AlertTriangle,
  Sparkles,
  ShoppingBag,
  FileSpreadsheet,
  Download,
  Plus,
  Zap,
  TrendingDown,
  RefreshCw,
  Send,
  Clipboard,
  ShieldCheck,
  Sliders,
  Check,
  RotateCcw
} from "lucide-react";

const LIMIT = 30;
const empty = {
  item_code: "",
  name: "",
  min_qty: "",
  reorder_qty: "",
  lead_time_days: "3",
  preferred_supplier_id: "",
  notes: ""
};

export default function ReorderPointsScreen() {
  const { stocks, setCurrentScreen, setPoPreFill } = useAppContext();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // "all" | "breached" | "critical" | "active"
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [msg, setMsg] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [draftingPOs, setDraftingPOs] = useState(false);
  const [showRecalibrateModal, setShowRecalibrateModal] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);

  // Multi-Thread / Concurrency Worker State for Inline Rule Edits
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncQueue, setPendingSyncQueue] = useState(new Map()); // ruleId -> { min_qty, reorder_qty }
  const [inlineValues, setInlineValues] = useState({}); // ruleId -> { min_qty, reorder_qty }
  const syncTimeoutRef = useRef(null);

  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.reorderPoints.list);
  const load = (overrides = {}) => fetch({ limit: LIMIT, sort: "name", order: "asc", ...overrides });

  // Load telemetry
  const loadTelemetry = useCallback(async () => {
    try {
      const res = await api.reorderPoints.telemetry();
      if (res.success) {
        setTelemetry(res.data);
      }
    } catch (err) {
      console.error("Failed to load telemetry", err);
    }
  }, []);

  useEffect(() => {
    load();
    loadTelemetry();
  }, [loadTelemetry]);

  useEffect(() => {
    api.suppliers
      .list({ limit: 200, sort: "name", order: "asc" })
      .then((r) => setSuppliers(r.data || []))
      .catch(() => {});
  }, []);

  // Sync inline values when items change
  useEffect(() => {
    const map = {};
    items.forEach((it) => {
      map[it.id] = {
        min_qty: String(it.min_qty),
        reorder_qty: String(it.reorder_qty)
      };
    });
    setInlineValues(map);
  }, [items]);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 3000);
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // Auto-fill item code and name
  const handleItemCode = (e) => {
    const val = e.target.value;
    setForm((p) => {
      const match = stocks.find((s) => s.item_code === val);
      return { ...p, item_code: val, name: match ? match.name : p.name };
    });
  };

  const handleName = (e) => {
    const val = e.target.value;
    setForm((p) => {
      const match = stocks.find((s) => s.name.toLowerCase() === val.toLowerCase());
      return { ...p, name: val, item_code: match ? match.item_code : p.item_code };
    });
  };

  // Submit single rule modal / card form
  const submit = async () => {
    if (!form.item_code || !form.min_qty || !form.reorder_qty) {
      return flash("Item code, min qty, and reorder qty are required.", COLORS.danger);
    }
    try {
      const payload = {
        item_code: form.item_code.trim(),
        name: form.name || form.item_code,
        min_qty: parseFloat(form.min_qty),
        reorder_qty: parseFloat(form.reorder_qty),
        lead_time_days: parseInt(form.lead_time_days, 10) || 3,
        preferred_supplier_id: form.preferred_supplier_id ? parseInt(form.preferred_supplier_id, 10) : null,
        notes: form.notes || null
      };

      if (editing) {
        await api.reorderPoints.update(editing, payload);
        flash("Reorder point updated successfully ✓");
      } else {
        await api.reorderPoints.create(payload);
        flash("Reorder point added successfully ✓");
      }
      setForm(empty);
      setEditing(null);
      load({ page: 1 });
      loadTelemetry();
    } catch (e) {
      flash(e.message, COLORS.danger);
    }
  };

  const startEdit = (r) => {
    setForm({
      item_code: r.item_code,
      name: r.name,
      min_qty: String(r.min_qty),
      reorder_qty: String(r.reorder_qty),
      lead_time_days: String(r.lead_time_days),
      preferred_supplier_id: r.preferred_supplier_id ? String(r.preferred_supplier_id) : "",
      notes: r.notes || ""
    });
    setEditing(r.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleActive = async (r) => {
    try {
      await api.reorderPoints.update(r.id, { is_active: !r.is_active });
      load({ page: 1 });
      loadTelemetry();
      flash(`Reorder rule ${r.is_active ? "disabled" : "activated"} ✓`);
    } catch (e) {
      flash(e.message, COLORS.danger);
    }
  };

  const remove = async (id) => {
    if (!confirm("Are you sure you want to delete this reorder point rule?")) return;
    try {
      await api.reorderPoints.remove(id);
      flash("Reorder rule deleted ✓");
      load({ page: 1 });
      loadTelemetry();
    } catch (e) {
      flash(e.message, COLORS.danger);
    }
  };

  // Multi-thread parallel batch sync queue for inline edits
  const flushInlineSync = useCallback(async (queueToFlush) => {
    if (!queueToFlush || queueToFlush.size === 0) return;

    setIsSyncing(true);
    const rulesToUpdate = Array.from(queueToFlush.entries()).map(([id, vals]) => ({
      id: parseInt(id, 10),
      min_qty: parseFloat(vals.min_qty),
      reorder_qty: parseFloat(vals.reorder_qty)
    }));

    try {
      const res = await api.reorderPoints.batchUpdate(rulesToUpdate);
      if (res.success) {
        await loadTelemetry();
      }
    } catch (err) {
      console.error("Parallel batch update error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [loadTelemetry]);

  const scheduleInlineUpdate = useCallback((ruleId, nextVals) => {
    setPendingSyncQueue((prev) => {
      const nextQueue = new Map(prev);
      nextQueue.set(ruleId, nextVals);

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        flushInlineSync(nextQueue);
        setPendingSyncQueue(new Map());
      }, 500); // 500ms debounce before multi-thread worker flush

      return nextQueue;
    });
  }, [flushInlineSync]);

  const handleInlineChange = (ruleId, field, value) => {
    setInlineValues((prev) => {
      const current = prev[ruleId] || { min_qty: "0", reorder_qty: "0" };
      const updated = { ...current, [field]: value };
      scheduleInlineUpdate(ruleId, updated);
      return { ...prev, [ruleId]: updated };
    });
  };

  // 1-Click Interactive PO Drafting
  const draftInteractivePO = (r) => {
    const itemStock = stocks.find(
      (s) => s.item_code === r.item_code || s.name.toLowerCase() === r.name.toLowerCase()
    );
    if (setPoPreFill) {
      setPoPreFill({
        supplier_id: r.preferred_supplier_id || null,
        notes: `Drafted from Reorder Sentinel for ${r.name} (Safety Buffer: ${r.min_qty}, Order Qty: ${r.reorder_qty})`,
        items: [
          {
            item_code: r.item_code,
            name: r.name,
            qty: r.reorder_qty,
            unit: r.unit || itemStock?.unit || "kg",
            unit_price: r.unit_cost || itemStock?.price || 0
          }
        ]
      });
    }
    flash(`Routing to Purchase Orders for ${r.name} ✓`, COLORS.accent);
    if (setCurrentScreen) setCurrentScreen("pos");
  };

  // 1-Click Multi-Supplier Auto-Draft POs
  const handleBatchDraftPOs = async () => {
    const breachedItems = items.filter((it) => it.needs_reorder);
    if (breachedItems.length === 0) {
      return flash("No breached items currently need reordering.", COLORS.warning);
    }

    if (
      !confirm(
        `Agent Auto-Draft Dispatcher: Generate consolidated draft POs for ${breachedItems.length} breached SKUs grouped by vendor?`
      )
    ) {
      return;
    }

    setDraftingPOs(true);
    try {
      const res = await api.reorderPoints.batchDraftPOs(breachedItems.map((b) => b.id));
      if (res.success) {
        flash(`Successfully created ${res.created_count} draft Purchase Order(s) across suppliers! ✓`);
        await loadTelemetry();
        if (setCurrentScreen) {
          setTimeout(() => setCurrentScreen("pos"), 1200);
        }
      }
    } catch (err) {
      flash(err.message, COLORS.danger);
    } finally {
      setDraftingPOs(false);
    }
  };

  // Smart Recalibration Execution
  const handleRecalibrateAll = async () => {
    setRecalibrating(true);
    try {
      const res = await api.reorderPoints.recalibrate();
      if (res.success) {
        flash(res.message, COLORS.success);
        setShowRecalibrateModal(false);
        load();
        loadTelemetry();
      }
    } catch (err) {
      flash(err.message, COLORS.danger);
    } finally {
      setRecalibrating(false);
    }
  };

  // Excel & CSV Exports
  const handleExportExcel = async () => {
    try {
      setDownloading(true);
      await api.reorderPoints.exportExcel();
    } catch (err) {
      alert("Failed to export Excel report: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setDownloading(true);
      await api.reorderPoints.exportCsv();
    } catch (err) {
      alert("Failed to export CSV: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((r) => {
      if (selectedCategory !== "ALL" && r.category !== selectedCategory) return false;
      if (filterMode === "breached") return r.needs_reorder;
      if (filterMode === "critical") return r.is_critical || r.current_stock <= 0;
      if (filterMode === "active") return r.is_active;
      return true;
    });
  }, [items, selectedCategory, filterMode]);

  return (
    <Section
      title="Reorder Points & Depletion Intelligence"
      sub="Autonomous stockout prevention, dynamic velocity forecasting, and 1-click multi-supplier procurement."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Multi-Agent Swarm Status Bar */}
        <ReorderAgentStatusBar
          telemetry={telemetry}
          isSyncing={isSyncing}
          pendingSyncCount={pendingSyncQueue.size}
          onFilterBreached={() => setFilterMode("breached")}
          onFilterCritical={() => setFilterMode("critical")}
          onRecalibrate={() => setShowRecalibrateModal(true)}
          onBatchDraftPOs={handleBatchDraftPOs}
          onRefresh={loadTelemetry}
        />

        {/* Executive KPI Summary Tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            {
              label: "Managed Rules",
              value: total,
              sub: "Active SKUs monitored",
              color: COLORS.text,
              border: COLORS.border
            },
            {
              label: "Buffer Breaches",
              value: telemetry?.agent_sentinel?.breached_count || 0,
              sub: "Immediate reorder required",
              color: (telemetry?.agent_sentinel?.breached_count || 0) > 0 ? COLORS.warning : COLORS.success,
              border: (telemetry?.agent_sentinel?.breached_count || 0) > 0 ? "rgba(245, 158, 11, 0.4)" : COLORS.border
            },
            {
              label: "Critical Runout (<48h)",
              value: telemetry?.agent_forecaster?.urgent_stockouts_48h || 0,
              sub: "Imminent kitchen stockout risk",
              color: (telemetry?.agent_forecaster?.urgent_stockouts_48h || 0) > 0 ? COLORS.danger : COLORS.success,
              border: (telemetry?.agent_forecaster?.urgent_stockouts_48h || 0) > 0 ? "rgba(239, 68, 68, 0.4)" : COLORS.border
            },
            {
              label: "Replenishment Capital",
              value: `₹${(telemetry?.agent_strategist?.total_spend_required || 0).toLocaleString("en-IN")}`,
              sub: "Projected procurement spend",
              color: COLORS.accent,
              border: "rgba(232, 168, 56, 0.4)"
            }
          ].map((tile) => (
            <Card
              key={tile.label}
              style={{
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                border: `1px solid ${tile.border}`,
                background: "rgba(255,255,255,0.02)"
              }}
            >
              <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>
                {tile.label}
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: tile.color }}>{tile.value}</span>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{tile.sub}</span>
            </Card>
          ))}
        </div>

        {/* Main Grid: Form Drawer + Table */}
        <div style={{ display: "grid", gridTemplateColumns: "310px 1fr", gap: 18, alignItems: "start" }}>
          {/* Rule Creator & Editor Form */}
          <Card style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {editing ? "Edit Reorder Rule" : "Add Safety Rule"}
              </span>
              {editing && (
                <button
                  onClick={() => {
                    setForm(empty);
                    setEditing(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: COLORS.muted,
                    fontSize: 11,
                    cursor: "pointer"
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>
                  Item Name
                </label>
                <input
                  list="stock-names-ro"
                  value={form.name}
                  onChange={handleName}
                  placeholder="Select or type item…"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    borderRadius: 6,
                    padding: "8px 10px",
                    width: "100%",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
                <datalist id="stock-names-ro">
                  {stocks.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>
                  Item Code
                </label>
                <input
                  value={form.item_code}
                  onChange={handleItemCode}
                  placeholder="e.g. KPL-435"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.accent,
                    borderRadius: 6,
                    padding: "8px 10px",
                    width: "100%",
                    fontSize: 13,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Min Safety Qty *" type="number" min="0" step="any" value={form.min_qty} onChange={f("min_qty")} placeholder="e.g. 5" />
                <Input label="Reorder Top-Up *" type="number" min="0.01" step="any" value={form.reorder_qty} onChange={f("reorder_qty")} placeholder="e.g. 25" />
              </div>

              <Input label="Lead Time (Days)" type="number" min="1" value={form.lead_time_days} onChange={f("lead_time_days")} placeholder="3" />

              <div>
                <label style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>
                  Preferred Supplier
                </label>
                <select
                  value={form.preferred_supplier_id}
                  onChange={f("preferred_supplier_id")}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "#1e222b",
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: "none"
                  }}
                >
                  <option value="">— None (Agent Selects Cheapest) —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input label="Notes" value={form.notes} onChange={f("notes")} placeholder="Rack position, storage zone…" />

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Btn onClick={submit} style={{ flex: 1, fontWeight: 700 }}>
                  {editing ? "Update Rule" : "Save Rule"}
                </Btn>
              </div>

              {msg && (
                <p style={{ color: msg.color, fontSize: 12, marginTop: 6, textAlign: "center", fontWeight: 600 }}>
                  {msg.text}
                </p>
              )}
            </div>
          </Card>

          {/* Rules Intelligence Table */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {/* Table Toolbar */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${COLORS.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
                <SearchBar onSearch={(v) => load({ page: 1, q: v })} placeholder="Search item code or name…" />
              </div>

              {/* Actions & Exports */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={handleBatchDraftPOs}
                  disabled={draftingPOs}
                  title="Generate consolidated draft POs across all suppliers for breached items"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(232, 168, 56, 0.4)",
                    background: "rgba(232, 168, 56, 0.14)",
                    color: COLORS.accent,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  <ShoppingBag size={14} />
                  <span>{draftingPOs ? "Drafting POs…" : "1-Click Auto-Draft POs"}</span>
                </button>

                <button
                  onClick={handleExportExcel}
                  disabled={downloading}
                  title="Export Reorder Safety Stock & Depletion Matrix"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,0.06)",
                    color: COLORS.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  <FileSpreadsheet size={14} color="#10b981" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Quick Filter Chips Bar */}
            <div
              style={{
                padding: "8px 18px",
                borderBottom: `1px solid rgba(255,255,255,0.05)`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap"
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>
                Filter:
              </span>
              {[
                ["all", `All Rules (${total})`],
                ["breached", `Breached (${telemetry?.agent_sentinel?.breached_count || 0})`, COLORS.warning],
                ["critical", `Critical Runouts (${telemetry?.agent_forecaster?.urgent_stockouts_48h || 0})`, COLORS.danger],
                ["active", "Active Only"]
              ].map(([key, label, customColor]) => {
                const isActive = filterMode === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterMode(key)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
                      background: isActive ? "rgba(232, 168, 56, 0.15)" : "transparent",
                      color: isActive ? COLORS.accent : customColor || COLORS.text,
                      cursor: "pointer"
                    }}
                  >
                    {label}
                  </button>
                );
              })}

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: "#1e222b",
                    color: COLORS.text,
                    fontSize: 12,
                    outline: "none"
                  }}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <p style={{ color: COLORS.muted, textAlign: "center", padding: 40 }}>Loading reorder rules…</p>
            ) : error ? (
              <ErrorMsg error={error} />
            ) : filteredItems.length === 0 ? (
              <p style={{ color: COLORS.muted, textAlign: "center", padding: 40 }}>No reorder rules match criteria.</p>
            ) : (
              <>
                <div className="resp-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${COLORS.border}` }}>
                        <th style={{ width: 110, padding: "10px 14px", textAlign: "left", color: COLORS.accent }}>Item Code</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.text }}>Item & Category</th>
                        <th style={{ width: 110, padding: "10px 14px", textAlign: "right", color: COLORS.text }}>On-Hand Stock</th>
                        <th style={{ width: 110, padding: "10px 14px", textAlign: "right", color: COLORS.muted }}>Safety Min</th>
                        <th style={{ width: 110, padding: "10px 14px", textAlign: "right", color: COLORS.accent }}>Reorder Qty</th>
                        <th style={{ width: 100, padding: "10px 14px", textAlign: "right", color: COLORS.text }}>Daily Burn</th>
                        <th style={{ width: 100, padding: "10px 14px", textAlign: "right", color: COLORS.text }}>Runout (DTS)</th>
                        <th style={{ width: 120, padding: "10px 14px", textAlign: "left", color: COLORS.text }}>Risk Status</th>
                        <th style={{ width: 160, padding: "10px 14px", textAlign: "left", color: COLORS.text }}>Supplier / Spend</th>
                        <th style={{ width: 150, padding: "10px 14px", textAlign: "right", color: COLORS.text }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((r) => {
                        const vals = inlineValues[r.id] || { min_qty: String(r.min_qty), reorder_qty: String(r.reorder_qty) };
                        const isBreached = r.needs_reorder;
                        const isCritical = r.is_critical || r.current_stock <= 0;

                        let statusBg = "rgba(16, 185, 129, 0.12)";
                        let statusColor = COLORS.success;
                        let statusText = "Optimal";

                        if (r.current_stock <= 0) {
                          statusBg = "rgba(239, 68, 68, 0.2)";
                          statusColor = COLORS.danger;
                          statusText = "Stockout ✗";
                        } else if (isCritical) {
                          statusBg = "rgba(239, 68, 68, 0.15)";
                          statusColor = COLORS.danger;
                          statusText = "Critical (<48h)";
                        } else if (isBreached) {
                          statusBg = "rgba(245, 158, 11, 0.15)";
                          statusColor = COLORS.warning;
                          statusText = "Breached ⚠";
                        }

                        return (
                          <tr
                            key={r.id}
                            style={{
                              borderBottom: `1px solid rgba(255,255,255,0.04)`,
                              background: isCritical ? "rgba(239, 68, 68, 0.03)" : "transparent"
                            }}
                          >
                            <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, color: COLORS.accent }}>
                              {r.item_code}
                            </td>

                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ fontWeight: 600, color: COLORS.text }}>{r.name}</div>
                              <div style={{ fontSize: 11, color: COLORS.muted }}>{r.category || "General"}</div>
                            </td>

                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: isBreached ? COLORS.danger : COLORS.success }}>
                              {r.current_stock !== null ? r.current_stock.toFixed(1) : "—"} {r.unit}
                            </td>

                            {/* Inline editable Min Qty */}
                            <td style={{ padding: "8px 14px", textAlign: "right" }}>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={vals.min_qty}
                                onChange={(e) => handleInlineChange(r.id, "min_qty", e.target.value)}
                                style={{
                                  width: 70,
                                  padding: "4px 6px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderRadius: 4,
                                  border: `1px solid ${COLORS.border}`,
                                  background: "rgba(0,0,0,0.2)",
                                  color: COLORS.text,
                                  textAlign: "right",
                                  outline: "none"
                                }}
                              />
                            </td>

                            {/* Inline editable Reorder Qty */}
                            <td style={{ padding: "8px 14px", textAlign: "right" }}>
                              <input
                                type="number"
                                min="0.1"
                                step="any"
                                value={vals.reorder_qty}
                                onChange={(e) => handleInlineChange(r.id, "reorder_qty", e.target.value)}
                                style={{
                                  width: 70,
                                  padding: "4px 6px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  borderRadius: 4,
                                  border: `1px solid rgba(232, 168, 56, 0.3)`,
                                  background: "rgba(0,0,0,0.2)",
                                  color: COLORS.accent,
                                  textAlign: "right",
                                  outline: "none"
                                }}
                              />
                            </td>

                            <td style={{ padding: "10px 14px", textAlign: "right", color: COLORS.muted, fontSize: 12 }}>
                              {r.daily_velocity > 0 ? `${r.daily_velocity.toFixed(1)}/d` : "0"}
                            </td>

                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: r.days_to_out <= 2 ? COLORS.danger : r.days_to_out <= 5 ? COLORS.warning : COLORS.text }}>
                              {r.days_to_out === 999 ? "—" : `${r.days_to_out}d`}
                            </td>

                            <td style={{ padding: "10px 14px" }}>
                              <span
                                style={{
                                  background: statusBg,
                                  color: statusColor,
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 700
                                }}
                              >
                                {statusText}
                              </span>
                            </td>

                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                                {r.recommended_supplier || "—"}
                              </div>
                              <div style={{ fontSize: 11, color: COLORS.muted }}>
                                Est: ₹{r.projected_spend.toLocaleString("en-IN")}
                              </div>
                            </td>

                            <td style={{ padding: "10px 14px", textAlign: "right" }}>
                              <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                                {isBreached && (
                                  <Btn
                                    small
                                    onClick={() => draftInteractivePO(r)}
                                    style={{
                                      background: COLORS.accent,
                                      color: "#18181b",
                                      fontWeight: 700,
                                      fontSize: 11,
                                      padding: "3px 8px"
                                    }}
                                  >
                                    Draft PO
                                  </Btn>
                                )}

                                {r.wa_link && (
                                  <a
                                    href={r.wa_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Send WhatsApp PO Request"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: 26,
                                      height: 26,
                                      borderRadius: 6,
                                      background: "rgba(37, 211, 102, 0.15)",
                                      border: "1px solid rgba(37, 211, 102, 0.4)",
                                      color: "#25D366",
                                      textDecoration: "none"
                                    }}
                                  >
                                    <Send size={12} />
                                  </a>
                                )}

                                <Btn small variant="ghost" onClick={() => startEdit(r)} style={{ fontSize: 11, padding: "3px 6px" }}>
                                  Edit
                                </Btn>
                                <Btn small variant="ghost" onClick={() => toggleActive(r)} style={{ fontSize: 11, padding: "3px 6px" }}>
                                  {r.is_active ? "On" : "Off"}
                                </Btn>
                                <Btn small variant="danger" onClick={() => remove(r.id)} style={{ padding: "3px 6px" }}>
                                  ✕
                                </Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />
              </>
            )}
          </Card>
        </div>

        {/* Smart Recalibration Modal */}
        {showRecalibrateModal && (
          <ModalShell
            onClose={() => setShowRecalibrateModal(false)}
            size="compact"
            title={(
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={18} color={COLORS.accent} />
                Agent Velocity Forecaster: Smart Recalibration
              </span>
            )}
          >
            <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5, marginBottom: 18 }}>
              This will automatically recalibrate <strong style={{ color: COLORS.text }}>Safety Min Qty</strong> and <strong style={{ color: COLORS.text }}>Reorder Top-Up Qty</strong> across all active inventory using real 14-day kitchen burn velocity and vendor lead time buffers:
            </p>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 8, border: `1px solid ${COLORS.border}`, marginBottom: 20, fontSize: 12, overflowX: "auto" }}>
              <div style={{ marginBottom: 6 }}>
                <code style={{ color: COLORS.accent }}>Recommended Min Qty</code> = Lead Time Days × Daily Burn Velocity × 1.25 Buffer
              </div>
              <div>
                <code style={{ color: COLORS.accent }}>Recommended Reorder Qty</code> = 7-Day Top-Up Cycle × Daily Burn Velocity
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setShowRecalibrateModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={handleRecalibrateAll} disabled={recalibrating} style={{ fontWeight: 700 }}>
                {recalibrating ? "Recalibrating SKUs…" : "Apply Smart Recalibration ✓"}
              </Btn>
            </div>
          </ModalShell>
        )}
      </div>
    </Section>
  );
}
