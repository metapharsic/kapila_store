import { useState, useEffect, useMemo, useCallback } from "react";
import { COLORS } from "../../styles/colors";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Send,
  Clipboard,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Scale,
  Sparkles,
  Zap,
  Check
} from "lucide-react";
import Btn from "../../components/Btn";
import Card from "../../components/Card";
import Section from "../../components/Section";
import AuditAgentStatusBar from "../../components/agents/AuditAgentStatusBar";
import {
  getAudit,
  finaliseAudit,
  getAgentTelemetry,
  exportAuditExcel,
  exportAuditCsv
} from "./auditApi";

export default function AuditReconcileScreen({ auditId, onBack, onComplete }) {
  const [audit, setAudit] = useState(null);
  const [items, setItems] = useState([]);
  const [reasons, setReasons] = useState({}); // itemId -> reason string
  const [actions, setActions] = useState({}); // itemId -> action string
  const [errors, setErrors] = useState({}); // itemId -> error string
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [downloading, setDownloading] = useState(false);

  // Success state after finalising
  const [finalisedData, setFinalisedData] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");

  // Preset Common Reasons
  const PRESET_REASONS = [
    "Routine Physical Count Variance",
    "Kitchen Evaporation & Prep Spoilage",
    "Portion Shrinkage / Line Loss",
    "Supplier Pack Weight Discrepancy",
    "Unlogged Tasting / Quality Testing"
  ];

  const loadTelemetry = useCallback(async () => {
    try {
      const res = await getAgentTelemetry(auditId);
      if (res.success) {
        setTelemetry(res.data);
      }
    } catch (err) {
      console.error("Telemetry error:", err);
    }
  }, [auditId]);

  const loadAuditDetails = async () => {
    try {
      const res = await getAudit(auditId);
      if (res.success) {
        setAudit(res.data);
        const fetchedItems = res.data.items || [];
        setItems(fetchedItems);

        const initialReasons = {};
        const initialActions = {};
        fetchedItems.forEach((it) => {
          initialReasons[it.id] = it.discrepancy_reason || "";
          initialActions[it.id] = it.action || "adjust_db";
        });
        setReasons(initialReasons);
        setActions(initialActions);
      }
      await loadTelemetry();
    } catch (err) {
      setApiError(err.message || "Failed to load audit details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditDetails();
  }, [auditId]);

  const handleReasonChange = (itemId, val) => {
    setReasons((prev) => ({ ...prev, [itemId]: val }));
    if (val.trim()) {
      setErrors((prev) => ({ ...prev, [itemId]: "" }));
    }
  };

  const handleActionChange = (itemId, val) => {
    setActions((prev) => ({ ...prev, [itemId]: val }));
  };

  // Bulk Apply Common Reason
  const handleApplyPresetReason = (reasonText) => {
    setReasons((prev) => {
      const updated = { ...prev };
      items.forEach((it) => {
        const diff = parseFloat(it.difference || 0);
        if (Math.abs(diff) > 0.0001 && (!updated[it.id] || !updated[it.id].trim())) {
          updated[it.id] = reasonText;
        }
      });
      return updated;
    });
    setErrors({});
  };

  // Bulk Set Action
  const handleBulkSetAction = (actionVal) => {
    setActions((prev) => {
      const updated = { ...prev };
      items.forEach((it) => {
        updated[it.id] = actionVal;
      });
      return updated;
    });
  };

  const handleFinalise = async () => {
    // Validate that all discrepant items have a reason
    const newErrors = {};
    let isValid = true;

    items.forEach((it) => {
      const diff = parseFloat(it.difference || 0);
      if (Math.abs(diff) > 0.0001) {
        const reason = reasons[it.id] || "";
        if (!reason.trim()) {
          newErrors[it.id] = "Reason is required for discrepancies.";
          isValid = false;
        }
      }
    });

    if (!isValid) {
      setErrors(newErrors);
      setApiError("Please provide reasons for all discrepant items before committing to double-entry ledger.");
      return;
    }

    setSubmitting(true);
    setApiError("");

    try {
      const payload = {
        items: items.map((it) => ({
          audit_item_id: it.id,
          discrepancy_reason: reasons[it.id]?.trim() || "",
          action: Math.abs(parseFloat(it.difference || 0)) < 0.0001 ? null : actions[it.id]
        }))
      };

      const res = await finaliseAudit(auditId, payload);
      if (res.success) {
        setFinalisedData(res.data);
      }
    } catch (err) {
      setApiError(err.message || "Failed to finalise audit session.");
    } finally {
      setSubmitting(false);
    }
  };

  // Excel & CSV Exports
  const handleExportExcel = async () => {
    try {
      setDownloading(true);
      await exportAuditExcel(auditId, audit?.reference);
    } catch (err) {
      alert("Failed to export Excel report: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setDownloading(true);
      await exportAuditCsv(auditId, audit?.reference);
    } catch (err) {
      alert("Failed to export CSV: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const generateWhatsAppPO = (alerts) => {
    if (!alerts || alerts.length === 0) return;
    const header = "*KAPILA INVENTORY - AUDIT ADJUSTMENT PURCHASE ORDER*\n\nGenerated: " + new Date().toISOString().slice(0, 10) + "\n\n";
    const itemsText = alerts.map((item, idx) => {
      const needed = item.qty ? item.qty : 10;
      return `${idx + 1}. *${item.name}* - Needs approx. ${needed} ${item.unit} (Current: ${parseFloat(item.remaining).toFixed(1)} ${item.unit})`;
    }).join("\n");
    const footer = "\n\nPlease check pricing and confirm delivery date.";
    window.open(`https://wa.me/?text=${encodeURIComponent(header + itemsText + footer)}`, "_blank");
  };

  const copyPOToClipboard = (alerts) => {
    if (!alerts || alerts.length === 0) return;
    const header = "*KAPILA INVENTORY - AUDIT ADJUSTMENT PURCHASE ORDER*\n\nGenerated: " + new Date().toISOString().slice(0, 10) + "\n\n";
    const itemsText = alerts.map((item, idx) => {
      const needed = item.qty ? item.qty : 10;
      return `${idx + 1}. *${item.name}* - Needs approx. ${needed} ${item.unit} (Current: ${parseFloat(item.remaining).toFixed(1)} ${item.unit})`;
    }).join("\n");
    const footer = "\n\nPlease check pricing and confirm delivery date.";
    navigator.clipboard.writeText(header + itemsText + footer);
    setCopyMsg("PO copied to clipboard ✓");
    setTimeout(() => setCopyMsg(""), 3000);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, color: COLORS.muted }}>
        Loading reconciliation dashboard…
      </div>
    );
  }

  if (apiError && !audit) {
    return (
      <div style={{ padding: 20, color: COLORS.danger }}>
        {apiError}
      </div>
    );
  }

  // --- RENDERING SUCCESS REPORT VIEW ---
  if (finalisedData) {
    const { matched, adjusted, flagged_recount, flagged_investigate, low_stock_alerts = [] } = finalisedData;
    return (
      <Section title="Audit Reconciled Successfully" sub={`Session Reference: ${audit.reference}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 840, margin: "0 auto" }}>
          
          <Card style={{ textAlign: "center", padding: 32, background: "rgba(16, 185, 129, 0.08)", border: `1px solid ${COLORS.success}44` }}>
            <CheckCircle2 size={48} color={COLORS.success} style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
              Audit Finalised & Atomic Ledger Committed
            </h2>
            <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
              Stock quantities have been synchronized. Double-entry records (<code style={{ color: COLORS.accent }}>ADJUSTMENT_ADD</code> / <code style={{ color: COLORS.accent }}>ADJUSTMENT_DEDUCT</code>) have been written into <code style={{ color: COLORS.accent }}>stock_ledger</code> with zero duplication.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 18 }}>
              <button
                onClick={handleExportExcel}
                disabled={downloading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
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
                <span>Download Branded Excel Report</span>
              </button>
            </div>
          </Card>

          {/* Reconciliation Stats Card */}
          <Card>
            <h4 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.accent, marginBottom: 14 }}>
              Reconciliation Summary
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              {[
                { label: "Items Matched", value: matched, color: COLORS.success },
                { label: "Ledger Batches Adjusted", value: adjusted, color: COLORS.accent },
                { label: "Flagged for Recount", value: flagged_recount, color: COLORS.warning },
                { label: "Flagged for Investigation", value: flagged_investigate, color: COLORS.danger }
              ].map((stat) => (
                <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>{stat.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Low Stock Alerts */}
          {low_stock_alerts.length > 0 && (
            <Card style={{ borderLeft: `4px solid ${COLORS.danger}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: `1px solid ${COLORS.border}55`, paddingBottom: 10 }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={16} color={COLORS.danger} /> Low Stock Warnings Post-Reconciliation
                  </h4>
                  <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                    Items fell below safety threshold due to audit shrinkage adjustments
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn variant="ghost" small onClick={() => copyPOToClipboard(low_stock_alerts)} icon={<Clipboard size={12} />} style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${COLORS.border}` }}>
                    Copy PO
                  </Btn>
                  <Btn variant="ghost" small onClick={() => generateWhatsAppPO(low_stock_alerts)} icon={<Send size={12} />} style={{ fontSize: 11, padding: "4px 8px", background: "#25D36622", border: "1px solid #25D36644", color: "#25D366" }}>
                    Send PO
                  </Btn>
                </div>
              </div>

              {copyMsg && <p style={{ color: COLORS.success, fontSize: 12, marginBottom: 10, fontWeight: 500 }}>{copyMsg}</p>}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {low_stock_alerts.map((item) => (
                  <div key={item.item_code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 8 }}>({item.item_code})</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.danger }}>
                      {parseFloat(item.remaining).toFixed(1)} / {item.qty} {item.unit} ({item.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div style={{ display: "flex", justifyContent: "center" }}>
            <Btn onClick={onComplete} style={{ padding: "12px 36px", fontWeight: 700 }}>
              Return to Audits List
            </Btn>
          </div>

        </div>
      </Section>
    );
  }

  // --- RECONCILIATION COUNT COMPARISON TABLE VIEW ---
  const total = items.length;
  const matched = items.filter((it) => Math.abs(parseFloat(it.difference || 0)) < 0.0001).length;
  const shortages = items.filter((it) => parseFloat(it.difference || 0) < -0.0001).length;
  const surpluses = items.filter((it) => parseFloat(it.difference || 0) > 0.0001).length;

  const getIsDiscrepant = (it) => {
    const diff = parseFloat(it.difference || 0);
    return Math.abs(diff) > 0.0001;
  };

  const sortedItems = [...items].sort((a, b) => {
    const aDisc = getIsDiscrepant(a);
    const bDisc = getIsDiscrepant(b);
    if (aDisc && !bDisc) return -1;
    if (!aDisc && bDisc) return 1;
    return 0;
  });

  const displayedItems = sortedItems.filter((it) => {
    const diff = parseFloat(it.difference || 0);
    const isDiscrepant = Math.abs(diff) > 0.0001;

    if (activeFilter === "matched") return !isDiscrepant;
    if (activeFilter === "shortages") return isDiscrepant && diff < 0;
    if (activeFilter === "surpluses") return isDiscrepant && diff > 0;
    return true;
  });

  return (
    <Section
      title={`Audit Reconciliation & Double-Entry Ledger: ${audit.reference}`}
      sub={`Auditor: ${audit.auditor_name} • Scope: ${audit.department_name || "CENTRAL STORE"}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Multi-Agent Orchestration Status Bar */}
        <AuditAgentStatusBar
          telemetry={telemetry}
          onRefresh={loadTelemetry}
        />

        {/* Concurrent Change Warning Banner */}
        {audit.has_concurrent_changes && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.1)",
              border: `1px solid ${COLORS.warning}66`,
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#fbbf24",
              fontSize: 13
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700 }}>Live Stock Movement Detected:</span> Inward purchases or department issues occurred after this audit snapshot was initiated. FIFO adjustments will reconcile against active current remaining batches.
            </div>
          </div>
        )}

        {/* Summary Filter Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { key: "all", label: "Total Items", value: total, color: COLORS.text, bg: "rgba(255,255,255,0.03)", activeColor: COLORS.accent },
            { key: "matched", label: "Matched", value: matched, color: COLORS.success, bg: "rgba(16, 185, 129, 0.06)", activeColor: COLORS.success },
            { key: "shortages", label: "Shrinkage / Short", value: shortages, color: COLORS.danger, bg: "rgba(239, 68, 68, 0.06)", activeColor: COLORS.danger },
            { key: "surpluses", label: "Surplus / Gain", value: surpluses, color: COLORS.warning, bg: "rgba(245, 158, 11, 0.06)", activeColor: COLORS.warning }
          ].map((card) => {
            const isActive = activeFilter === card.key;
            return (
              <div
                key={card.key}
                onClick={() => setActiveFilter(card.key)}
                style={{
                  background: card.bg,
                  padding: "12px 16px",
                  borderRadius: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  cursor: "pointer",
                  border: isActive ? `1px solid ${card.activeColor}` : `1px solid ${COLORS.border}`,
                  boxShadow: isActive ? `0 0 0 2px ${card.activeColor}33` : "none",
                  transition: "all 0.2s ease"
                }}
              >
                <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                  {card.label}
                </span>
                <span style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</span>
              </div>
            );
          })}
        </div>

        {/* Quick Batch Tools Toolbar */}
        <Card style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, textTransform: "uppercase" }}>
              Fast Reconciliation Presets:
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESET_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleApplyPresetReason(reason)}
                  title={`Apply "${reason}" to all empty variance reasons`}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,0.05)",
                    color: COLORS.text,
                    fontSize: 11,
                    cursor: "pointer"
                  }}
                >
                  + {reason}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => handleBulkSetAction("adjust_db")}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid rgba(16, 185, 129, 0.4)",
                background: "rgba(16, 185, 129, 0.1)",
                color: COLORS.success,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Set All to Adjust DB (FIFO)
            </button>

            <button
              onClick={handleExportExcel}
              disabled={downloading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,0.06)",
                color: COLORS.text,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <FileSpreadsheet size={13} color="#10b981" />
              <span>Export Excel</span>
            </button>
          </div>
        </Card>

        {/* Discrepancy Reconciliation Table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {apiError && (
            <p style={{ color: COLORS.danger, fontSize: 12, margin: "14px 20px 0", fontWeight: 600 }}>
              {apiError}
            </p>
          )}

          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ width: 120, padding: "12px 14px", textAlign: "left", fontSize: 12, color: COLORS.accent }}>Item Code</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, color: COLORS.text }}>Item Name</th>
                  <th style={{ width: 100, padding: "12px 14px", textAlign: "right", fontSize: 12, color: COLORS.muted }}>DB Qty</th>
                  <th style={{ width: 100, padding: "12px 14px", textAlign: "right", fontSize: 12, color: COLORS.text }}>Counted</th>
                  <th style={{ width: 120, padding: "12px 14px", textAlign: "right", fontSize: 12, color: COLORS.accent }}>Variance</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, color: COLORS.text }}>
                    Discrepancy Justification Reason <span style={{ color: COLORS.danger }}>*</span>
                  </th>
                  <th style={{ width: 200, padding: "12px 14px", textAlign: "left", fontSize: 12, color: COLORS.text }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((it) => {
                  const dbVal = parseFloat(it.db_qty || 0);
                  const physVal = parseFloat(it.physical_qty || 0);
                  const diff = physVal - dbVal;
                  const isDiscrepant = Math.abs(diff) > 0.0001;

                  let rowBg = "transparent";
                  let diffColor = COLORS.success;
                  let diffText = "Matched ✓";

                  if (isDiscrepant) {
                    if (diff < 0) {
                      rowBg = "rgba(239, 68, 68, 0.05)";
                      diffColor = COLORS.danger;
                      diffText = `${diff.toFixed(2)} ${it.unit}`;
                    } else {
                      rowBg = "rgba(245, 158, 11, 0.05)";
                      diffColor = COLORS.warning;
                      diffText = `+${diff.toFixed(2)} ${it.unit}`;
                    }
                  }

                  return (
                    <tr key={it.id} style={{ backgroundColor: rowBg, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, fontFamily: "monospace", color: COLORS.accent }}>
                        {it.item_code}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: COLORS.text }}>
                        {it.item_name}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: COLORS.muted }}>
                        {dbVal.toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: COLORS.text }}>
                        {physVal.toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: diffColor }}>
                        {diffText}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isDiscrepant ? (
                          <div>
                            <input
                              type="text"
                              value={reasons[it.id] || ""}
                              onChange={(e) => handleReasonChange(it.id, e.target.value)}
                              placeholder="Required: e.g. Kitchen spoilage, counting error…"
                              style={{
                                padding: "6px 10px",
                                fontSize: 12,
                                borderRadius: 6,
                                border: `1px solid ${errors[it.id] ? COLORS.danger : COLORS.border}`,
                                background: "rgba(0,0,0,0.25)",
                                color: COLORS.text,
                                width: "100%",
                                outline: "none"
                              }}
                            />
                            {errors[it.id] && (
                              <span style={{ color: COLORS.danger, fontSize: 10, marginTop: 2, display: "block" }}>
                                {errors[it.id]}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: COLORS.muted, fontSize: 12, fontStyle: "italic" }}>No discrepancy</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isDiscrepant ? (
                          <select
                            value={actions[it.id] || "adjust_db"}
                            onChange={(e) => handleActionChange(it.id, e.target.value)}
                            style={{
                              padding: "6px 8px",
                              fontSize: 12,
                              background: "#1e222b",
                              border: `1px solid ${COLORS.border}`,
                              color: COLORS.text,
                              borderRadius: 6,
                              width: "100%",
                              outline: "none"
                            }}
                          >
                            <option value="adjust_db">Adjust DB (FIFO Ledger)</option>
                            <option value="recount">Flag for Recount</option>
                            <option value="investigate">Investigate Discrepancy</option>
                          </select>
                        ) : (
                          <span style={{ color: COLORS.muted, fontSize: 12, fontStyle: "italic" }}>No action needed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={16} />}>
            Back to Fast Counts
          </Btn>
          <Btn
            onClick={handleFinalise}
            disabled={submitting}
            style={{ padding: "12px 32px", fontWeight: 700 }}
          >
            {submitting ? "Committing Atomic Double-Entry Ledger…" : "Finalise & Commit to Stock Ledger →"}
          </Btn>
        </div>
      </div>
    </Section>
  );
}
