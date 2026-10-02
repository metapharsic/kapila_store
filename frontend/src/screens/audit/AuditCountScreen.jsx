import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { COLORS } from "../../styles/colors";
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle2,
  Info,
  Download,
  FileSpreadsheet,
  Search,
  Filter,
  Check,
  RotateCcw,
  Plus,
  Minus,
  Sparkles,
  Zap,
  Printer
} from "lucide-react";
import Btn from "../../components/Btn";
import Card from "../../components/Card";
import Section from "../../components/Section";
import AuditAgentStatusBar from "../../components/agents/AuditAgentStatusBar";
import {
  getAudit,
  batchCountAudit,
  getAgentTelemetry,
  exportAuditExcel,
  exportAuditCsv
} from "./auditApi";

export default function AuditCountScreen({ auditId, onBack, onProceed }) {
  const [audit, setAudit] = useState(null);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({}); // itemId -> string physical_qty
  const [savingMap, setSavingMap] = useState({}); // itemId -> boolean
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // 'ALL' | 'PENDING' | 'DISCREPANCIES' | 'ANOMALIES' | 'MATCHED'

  // Multi-Thread / Concurrency Worker State
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingQueue, setPendingQueue] = useState(new Map()); // itemId -> val
  const syncTimeoutRef = useRef(null);

  // Fetch telemetry helper
  const loadTelemetry = useCallback(async () => {
    try {
      const res = await getAgentTelemetry(auditId);
      if (res.success) {
        setTelemetry(res.data);
      }
    } catch (err) {
      console.error("Telemetry fetch error:", err);
    }
  }, [auditId]);

  // Initial load
  const loadAuditDetails = async () => {
    try {
      const res = await getAudit(auditId);
      if (res.success) {
        setAudit(res.data);
        const fetchedItems = res.data.items || [];
        setItems(fetchedItems);

        const initialCounts = {};
        fetchedItems.forEach((it) => {
          initialCounts[it.id] = it.physical_qty !== null ? String(it.physical_qty) : "";
        });
        setCounts(initialCounts);
      }
      await loadTelemetry();
    } catch (err) {
      setError(err.message || "Failed to load audit session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditDetails();
  }, [auditId]);

  // Multi-threaded parallel batch dispatcher
  const flushSyncQueue = useCallback(async (queueToFlush) => {
    if (!queueToFlush || queueToFlush.size === 0) return;

    setIsSyncing(true);
    const itemsToSave = Array.from(queueToFlush.entries()).map(([itemId, val]) => ({
      audit_item_id: parseInt(itemId, 10),
      physical_qty: val === "" ? null : parseFloat(val)
    }));

    // Optimistically mark items saving in UI
    const savingStatus = {};
    itemsToSave.forEach((it) => {
      savingStatus[it.audit_item_id] = true;
    });
    setSavingMap((prev) => ({ ...prev, ...savingStatus }));

    try {
      const res = await batchCountAudit(auditId, itemsToSave);
      if (res.success && res.data) {
        // Update local item differences
        const updatedMap = new Map(res.data.map((u) => [u.id, u]));
        setItems((prev) =>
          prev.map((it) => {
            const upd = updatedMap.get(it.id);
            if (upd) {
              return {
                ...it,
                physical_qty: upd.physical_qty,
                difference: upd.difference
              };
            }
            return it;
          })
        );
        // Refresh live agent telemetry
        await loadTelemetry();
      }
    } catch (err) {
      console.error("Parallel batch count error:", err);
    } finally {
      const clearedStatus = {};
      itemsToSave.forEach((it) => {
        clearedStatus[it.audit_item_id] = false;
      });
      setSavingMap((prev) => ({ ...prev, ...clearedStatus }));
      setIsSyncing(false);
    }
  }, [auditId, loadTelemetry]);

  // Queue item count change with debounced parallel sync
  const scheduleCountSave = useCallback((itemId, value) => {
    setPendingQueue((prev) => {
      const nextQueue = new Map(prev);
      nextQueue.set(itemId, value);

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        flushSyncQueue(nextQueue);
        setPendingQueue(new Map());
      }, 500); // 500ms debounce before multi-thread worker flush

      return nextQueue;
    });
  }, [flushSyncQueue]);

  const handleCountChange = (itemId, value) => {
    setCounts((prev) => ({ ...prev, [itemId]: value }));
    scheduleCountSave(itemId, value);
  };

  // Step increments (+1, -1, clear)
  const handleStepCount = (itemId, delta) => {
    const currentStr = counts[itemId] || "0";
    const currentNum = parseFloat(currentStr) || 0;
    const nextVal = Math.max(0, currentNum + delta);
    const rounded = Math.round(nextVal * 100) / 100;
    handleCountChange(itemId, String(rounded));
  };

  // Match DB theoretical value shortcut
  const handleMatchDB = (itemId, dbQty) => {
    handleCountChange(itemId, String(dbQty));
  };

  // Bulk match all uncounted items in current filtered view
  const handleBulkMatchFiltered = () => {
    const uncountedInView = filteredItems.filter((it) => it.physical_qty === null);
    if (uncountedInView.length === 0) return;

    if (
      !window.confirm(
        `Match theoretical quantities for all ${uncountedInView.length} uncounted items in this view?`
      )
    ) {
      return;
    }

    const newCounts = { ...counts };
    const queueMap = new Map();

    uncountedInView.forEach((it) => {
      const dbStr = String(parseFloat(it.db_qty || 0));
      newCounts[it.id] = dbStr;
      queueMap.set(it.id, dbStr);
    });

    setCounts(newCounts);
    flushSyncQueue(queueMap);
  };

  // Excel & CSV Exports
  const handleExportExcel = async () => {
    try {
      setDownloading(true);
      await exportAuditExcel(auditId, audit.reference);
    } catch (err) {
      alert("Failed to export Excel report: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setDownloading(true);
      await exportAuditCsv(auditId, audit.reference);
    } catch (err) {
      alert("Failed to export CSV: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // Print Count Checklist
  const handlePrintSheet = () => {
    window.print();
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [items]);

  // Anomalies set for fast lookup
  const anomalyIds = useMemo(() => {
    const list = telemetry?.agent_sentinel?.all_anomalies || [];
    return new Set(list.map((a) => a.id));
  }, [telemetry]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Category filter
      if (selectedCategory !== "ALL" && it.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (statusFilter === "PENDING" && it.physical_qty !== null) return false;
      if (statusFilter === "MATCHED" && (it.physical_qty === null || Math.abs(parseFloat(it.difference || 0)) > 0.0001)) return false;
      if (statusFilter === "DISCREPANCIES" && (it.physical_qty === null || Math.abs(parseFloat(it.difference || 0)) < 0.0001)) return false;
      if (statusFilter === "ANOMALIES" && !anomalyIds.has(it.id)) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const code = (it.item_code || "").toLowerCase();
        const name = (it.item_name || "").toLowerCase();
        return code.includes(q) || name.includes(q);
      }

      return true;
    });
  }, [items, selectedCategory, statusFilter, searchTerm, anomalyIds]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, color: COLORS.muted }}>
        Loading audit checklist…
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div style={{ padding: 20, color: COLORS.danger }}>
        {error || "Audit session not found."}
      </div>
    );
  }

  const totalItems = items.length;
  const countedItems = items.filter((it) => it.physical_qty !== null).length;
  const allCounted = totalItems > 0 && countedItems === totalItems;

  return (
    <Section
      title={`Stock Audit Fast-Entry: ${audit.reference}`}
      sub={`Auditor: ${audit.auditor_name} • Scope: ${audit.department_name || "CENTRAL STORE"}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Multi-Agent Orchestration Status Bar */}
        <AuditAgentStatusBar
          telemetry={telemetry}
          isSyncing={isSyncing}
          concurrentPendingCount={pendingQueue.size}
          onFilterAnomalies={() => setStatusFilter("ANOMALIES")}
          onFilterDiscrepancies={() => setStatusFilter("DISCREPANCIES")}
          onRefresh={loadTelemetry}
        />

        {/* Action & Filter Toolbar Card */}
        <Card style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: 260, flex: 1 }}>
              <Search
                size={16}
                color={COLORS.muted}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                placeholder="Search item by code or name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 36px",
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,0.04)",
                  color: COLORS.text,
                  fontSize: 13,
                  outline: "none"
                }}
              />
            </div>

            {/* Quick Bulk Action & Export Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleBulkMatchFiltered}
                title="Match theoretical stock for all uncounted items currently shown"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(232, 168, 56, 0.4)",
                  background: "rgba(232, 168, 56, 0.12)",
                  color: COLORS.accent,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                <Sparkles size={14} />
                <span>Match Theoretical (Filtered)</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={downloading}
                title="Download Excel Variance Workbook"
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

              <button
                onClick={handlePrintSheet}
                title="Print Physical Checklist"
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
                <Printer size={14} />
                <span>Print Sheet</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Chips Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>
              Filter:
            </span>
            {[
              { id: "ALL", label: `All (${totalItems})` },
              { id: "PENDING", label: `Pending (${totalItems - countedItems})` },
              { id: "DISCREPANCIES", label: `Variances (${telemetry?.agent_auditor?.discrepancy_skus || 0})` },
              { id: "ANOMALIES", label: `Anomalies (${telemetry?.agent_sentinel?.anomaly_count || 0})`, color: COLORS.danger },
              { id: "MATCHED", label: `Matched (${telemetry?.agent_auditor?.matched_skus || 0})`, color: COLORS.success }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${statusFilter === f.id ? COLORS.accent : COLORS.border}`,
                  background: statusFilter === f.id ? "rgba(232, 168, 56, 0.15)" : "transparent",
                  color: statusFilter === f.id ? COLORS.accent : f.color || COLORS.text,
                  fontSize: 11,
                  fontWeight: statusFilter === f.id ? 700 : 500,
                  cursor: "pointer"
                }}
              >
                {f.label}
              </button>
            ))}

            {/* Category selector dropdown */}
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
                  outline: "none",
                  cursor: "pointer"
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
        </Card>

        {/* Count Table Card */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ width: 120, padding: "12px 14px", textAlign: "left", fontSize: 12, color: COLORS.accent }}>Item Code</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, color: COLORS.text }}>Item & Category</th>
                  <th style={{ width: 90, padding: "12px 14px", textAlign: "left", fontSize: 12, color: COLORS.muted }}>Unit</th>
                  <th style={{ width: 130, padding: "12px 14px", textAlign: "right", fontSize: 12, color: COLORS.text }}>DB (Theoretical)</th>
                  <th style={{ width: 260, padding: "12px 14px", textAlign: "center", fontSize: 12, color: COLORS.accent }}>Physical Count Entry</th>
                  <th style={{ width: 160, padding: "12px 14px", textAlign: "left", fontSize: 12, color: COLORS.text }}>Variance Status</th>
                  <th style={{ width: 120, padding: "12px 14px", textAlign: "right", fontSize: 12, color: COLORS.text }}>Impact (₹)</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
                      No items match current filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((it) => {
                    const rawVal = counts[it.id] !== undefined ? counts[it.id] : "";
                    const currentPhys = rawVal === "" ? null : parseFloat(rawVal);
                    const dbVal = parseFloat(it.db_qty || 0);
                    const isSaving = savingMap[it.id];
                    const isAnomaly = anomalyIds.has(it.id);
                    const unitPrice = parseFloat(it.unit_price || 0);

                    let statusText = "Pending";
                    let statusBg = "rgba(100, 116, 139, 0.12)";
                    let statusColor = COLORS.muted;
                    let diffVal = null;
                    let diff = null;

                    if (currentPhys !== null && !isNaN(currentPhys)) {
                      diff = currentPhys - dbVal;
                      diffVal = diff * unitPrice;

                      if (Math.abs(diff) < 0.0001) {
                        statusText = "Exact Match ✓";
                        statusBg = "rgba(16, 185, 129, 0.14)";
                        statusColor = COLORS.success;
                      } else if (diff < 0) {
                        statusText = `Short ${Math.abs(diff).toFixed(2)} ${it.unit}`;
                        statusBg = "rgba(239, 68, 68, 0.15)";
                        statusColor = COLORS.danger;
                      } else {
                        statusText = `Surplus +${diff.toFixed(2)} ${it.unit}`;
                        statusBg = "rgba(245, 158, 11, 0.15)";
                        statusColor = COLORS.warning;
                      }
                    }

                    return (
                      <tr
                        key={it.id}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          background: isAnomaly
                            ? "rgba(239, 68, 68, 0.04)"
                            : "transparent"
                        }}
                      >
                        {/* Item Code */}
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, color: COLORS.accent, fontSize: 13 }}>
                          {it.item_code}
                          {isAnomaly && (
                            <span
                              title="Agent Sentinel Alert: High Variance Anomaly"
                              style={{
                                marginLeft: 6,
                                display: "inline-block",
                                verticalAlign: "middle",
                                color: COLORS.danger
                              }}
                            >
                              <AlertTriangle size={13} />
                            </span>
                          )}
                        </td>

                        {/* Name & Category */}
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600, color: COLORS.text, fontSize: 13 }}>{it.item_name}</div>
                          <div style={{ fontSize: 11, color: COLORS.muted }}>{it.category || "General"}</div>
                        </td>

                        {/* Unit */}
                        <td style={{ padding: "10px 14px", color: COLORS.muted, fontSize: 12 }}>{it.unit}</td>

                        {/* Theoretical DB Qty */}
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: COLORS.text, fontSize: 13 }}>
                          {dbVal.toFixed(2)}
                        </td>

                        {/* Physical Count Entry Controls */}
                        <td style={{ padding: "8px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {/* Step Minus */}
                            <button
                              type="button"
                              onClick={() => handleStepCount(it.id, -1)}
                              title="Decrease 1"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: `1px solid ${COLORS.border}`,
                                background: "rgba(255,255,255,0.06)",
                                color: COLORS.text,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}
                            >
                              <Minus size={12} />
                            </button>

                            {/* Input box */}
                            <div style={{ position: "relative", flex: 1 }}>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={rawVal}
                                onChange={(e) => handleCountChange(it.id, e.target.value)}
                                placeholder="Enter count…"
                                style={{
                                  padding: "6px 8px",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  border: `1px solid ${
                                    isSaving
                                      ? COLORS.accent
                                      : rawVal !== ""
                                      ? "rgba(232, 168, 56, 0.4)"
                                      : COLORS.border
                                  }`,
                                  background: "rgba(0,0,0,0.25)",
                                  color: COLORS.text,
                                  width: "100%",
                                  outline: "none"
                                }}
                              />
                              {isSaving && (
                                <span
                                  className="pulse"
                                  style={{
                                    position: "absolute",
                                    right: 6,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 7,
                                    height: 7,
                                    background: COLORS.accent,
                                    borderRadius: "50%"
                                  }}
                                />
                              )}
                            </div>

                            {/* Step Plus */}
                            <button
                              type="button"
                              onClick={() => handleStepCount(it.id, 1)}
                              title="Increase 1"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: `1px solid ${COLORS.border}`,
                                background: "rgba(255,255,255,0.06)",
                                color: COLORS.text,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}
                            >
                              <Plus size={12} />
                            </button>

                            {/* Shortcut: Match DB */}
                            <button
                              type="button"
                              onClick={() => handleMatchDB(it.id, dbVal)}
                              title="Match Theoretical DB Quantity"
                              style={{
                                padding: "4px 8px",
                                height: 28,
                                borderRadius: 6,
                                border: `1px solid ${COLORS.border}`,
                                background: "rgba(255,255,255,0.04)",
                                color: COLORS.muted,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer"
                              }}
                            >
                              Match
                            </button>
                          </div>
                        </td>

                        {/* Variance Status Badge */}
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              backgroundColor: statusBg,
                              color: statusColor,
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              display: "inline-block"
                            }}
                          >
                            {statusText}
                          </span>
                        </td>

                        {/* Monetary Valuation Impact */}
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          {diffVal !== null ? (
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 12,
                                color: diffVal < 0 ? COLORS.danger : diffVal > 0 ? COLORS.warning : COLORS.success
                              }}
                            >
                              {diffVal < 0 ? "-" : diffVal > 0 ? "+" : ""}₹{Math.abs(diffVal).toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ color: COLORS.muted, fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Footer Navigation Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={16} />}>
            Save & Exit to Dashboard
          </Btn>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: allCounted ? COLORS.success : COLORS.muted, fontWeight: 600 }}>
              {allCounted
                ? "All items counted ✓ Ready for Agent Veritas reconciliation"
                : `${totalItems - countedItems} items pending counts`}
            </span>
            <Btn
              onClick={() => onProceed(auditId)}
              disabled={!allCounted}
              style={{ padding: "10px 24px", fontWeight: 700 }}
            >
              Proceed to Reconciliation →
            </Btn>
          </div>
        </div>
      </div>
    </Section>
  );
}
