import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { ArrowLeft, CheckCircle, AlertTriangle, HelpCircle, RefreshCw, Send, Clipboard } from "lucide-react";
import Btn from "../../components/Btn";
import Card from "../../components/Card";
import Section from "../../components/Section";
import { getAudit, finaliseAudit } from "./auditApi";

export default function AuditReconcileScreen({ auditId, onBack, onComplete }) {
  const [audit, setAudit] = useState(null);
  const [items, setItems] = useState([]);
  const [reasons, setReasons] = useState({}); // itemId -> reason string
  const [actions, setActions] = useState({}); // itemId -> action string
  const [errors, setErrors] = useState({}); // itemId -> error string
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  
  // Success state after finalising
  const [finalisedData, setFinalisedData] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");

  const loadAuditDetails = async () => {
    try {
      const res = await getAudit(auditId);
      if (res.success) {
        setAudit(res.data);
        setItems(res.data.items || []);
        
        // Initialise reasons and actions states
        const initialReasons = {};
        const initialActions = {};
        res.data.items.forEach(it => {
          initialReasons[it.id] = it.discrepancy_reason || "";
          initialActions[it.id] = it.action || "adjust_db";
        });
        setReasons(initialReasons);
        setActions(initialActions);
      }
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
    setReasons(prev => ({ ...prev, [itemId]: val }));
    if (val.trim()) {
      setErrors(prev => ({ ...prev, [itemId]: "" }));
    }
  };

  const handleActionChange = (itemId, val) => {
    setActions(prev => ({ ...prev, [itemId]: val }));
  };

  const handleFinalise = async () => {
    // Validate that all discrepant items have a reason
    const newErrors = {};
    let isValid = true;

    items.forEach(it => {
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
      setApiError("Please provide reasons for all discrepant items.");
      return;
    }

    setSubmitting(true);
    setApiError("");

    try {
      const payload = {
        items: items.map(it => ({
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
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800, margin: "0 auto" }}>
          
          <Card style={{ textAlign: "center", padding: 32, background: "var(--color-accent-green-light)", border: `1px solid ${COLORS.success}44` }}>
            <CheckCircle size={48} color={COLORS.success} style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Audit Session Finalised</h2>
            <p style={{ fontSize: 14, color: COLORS.muted }}>
              Stock quantities have been reconciled. Database adjustments were written back successfully.
            </p>
          </Card>

          {/* Reconciliation Stats Card */}
          <Card>
            <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.muted, marginBottom: 16 }}>Summary Statistics</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Items Matched", value: matched, color: COLORS.success },
                { label: "Batches Adjusted", value: adjusted, color: COLORS.brand },
                { label: "Flagged for Recount", value: flagged_recount, color: COLORS.warning },
                { label: "Flagged for Investigation", value: flagged_investigate, color: COLORS.danger }
              ].map((stat) => (
                <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: COLORS.bg, borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: COLORS.muted }}>{stat.label}</span>
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
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={16} color={COLORS.danger} /> Low Stock Warnings
                  </h4>
                  <p style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Items dropped below threshold due to audit adjustment</p>
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
                  <div key={item.item_code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: COLORS.bg, borderRadius: 6 }}>
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
            <Btn onClick={onComplete} style={{ padding: "10px 32px" }}>
              Back to Audit List
            </Btn>
          </div>

        </div>
      </Section>
    );
  }

  // --- STANDARD RECONCILIATION COUNT COMPARISON TABLE VIEW ---
  const total = items.length;
  const matched = items.filter(it => Math.abs(parseFloat(it.difference || 0)) < 0.0001).length;
  const shortages = items.filter(it => parseFloat(it.difference || 0) < -0.0001).length;
  const surpluses = items.filter(it => parseFloat(it.difference || 0) > 0.0001).length;

  const getIsDiscrepant = (it) => {
    const dbVal = parseFloat(it.db_qty);
    const physVal = parseFloat(it.physical_qty || 0);
    const diff = physVal - dbVal;
    return Math.abs(diff) > 0.0001;
  };

  const sortedItems = [...items].sort((a, b) => {
    const aDisc = getIsDiscrepant(a);
    const bDisc = getIsDiscrepant(b);
    if (aDisc && !bDisc) return -1;
    if (!aDisc && bDisc) return 1;
    return 0;
  });

  const displayedItems = sortedItems.filter(it => {
    const dbVal = parseFloat(it.db_qty);
    const physVal = parseFloat(it.physical_qty || 0);
    const diff = physVal - dbVal;
    const isDiscrepant = Math.abs(diff) > 0.0001;

    if (activeFilter === "matched") {
      return !isDiscrepant;
    }
    if (activeFilter === "shortages") {
      return isDiscrepant && diff < 0;
    }
    if (activeFilter === "surpluses") {
      return isDiscrepant && diff > 0;
    }
    return true;
  });

  return (
    <Section 
      title={`Audit Reconciliation: ${audit.reference}`} 
      sub={`Auditor: ${audit.auditor_name} • Scoped: ${audit.department_id ? "Department Specific" : "Global CENTRAL STORE"}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Concurrent Change Warning Banner */}
        {audit.has_concurrent_changes && (
          <div style={{
            background: "#fffbeb", border: `1px solid ${COLORS.warning}44`,
            borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
            color: "#b45309", fontSize: 13
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 600 }}>Stock movements occurred after snapshot was locked.</span> Review figures carefully. Live database remaining quantities might differ from snapshot quantities.
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { key: "all", label: "Total Items", value: total, color: COLORS.text, bg: COLORS.surface, activeColor: "#e8a838" },
            { key: "matched", label: "Matched", value: matched, color: COLORS.success, bg: "#ecfdf5", activeColor: COLORS.success },
            { key: "shortages", label: "Shortages", value: shortages, color: COLORS.danger, bg: "#fef2f2", activeColor: COLORS.danger },
            { key: "surpluses", label: "Surpluses", value: surpluses, color: COLORS.warning, bg: "#fef3c7", activeColor: COLORS.warning }
          ].map((card) => {
            const isActive = activeFilter === card.key;
            return (
              <Card 
                key={card.label} 
                onClick={() => setActiveFilter(card.key)}
                style={{ 
                  background: card.bg, 
                  padding: 14, 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: 4,
                  cursor: "pointer",
                  border: isActive ? `1px solid ${card.activeColor}` : `1px solid ${COLORS.border}`,
                  boxShadow: isActive 
                    ? `0 0 0 2px ${card.activeColor}33, 0 4px 12px rgba(0, 0, 0, 0.08)` 
                    : "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
                  transform: isActive ? "translateY(-2px)" : "none",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</span>
              </Card>
            );
          })}
        </div>

        {/* Discrepancy Reconciliation Table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {apiError && (
            <p style={{ color: COLORS.danger, fontSize: 12, margin: "14px 20px 0", fontWeight: 500 }}>
              {apiError}
            </p>
          )}

          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th style={{ width: 100 }}>DB Qty</th>
                  <th style={{ width: 100 }}>Counted</th>
                  <th style={{ width: 110 }}>Variance</th>
                  <th>Reason (Required if discrepant)</th>
                  <th style={{ width: 180 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((it) => {
                  const dbVal = parseFloat(it.db_qty);
                  const physVal = parseFloat(it.physical_qty || 0);
                  const diff = physVal - dbVal;
                  const isDiscrepant = Math.abs(diff) > 0.0001;

                  let rowBg = "transparent";
                  let diffColor = COLORS.success;
                  let diffText = "0.00";

                  if (isDiscrepant) {
                    if (diff < 0) {
                      rowBg = "#fef2f244"; // light red tint
                      diffColor = COLORS.danger;
                      diffText = `${diff.toFixed(2)} ${it.unit}`;
                    } else {
                      rowBg = "#fef3c744"; // light amber tint
                      diffColor = COLORS.warning;
                      diffText = `+${diff.toFixed(2)} ${it.unit}`;
                    }
                  }

                  return (
                    <tr key={it.id} style={{ backgroundColor: rowBg }}>
                      <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{it.item_code}</td>
                      <td style={{ fontWeight: 500 }}>{it.item_name}</td>
                      <td style={{ color: COLORS.muted }}>{dbVal.toFixed(2)}</td>
                      <td style={{ fontWeight: 600 }}>{physVal.toFixed(2)}</td>
                      <td style={{ fontWeight: 700, color: diffColor }}>
                        {isDiscrepant ? diffText : "matched"}
                      </td>
                      <td>
                        {isDiscrepant ? (
                          <div>
                            <input
                              type="text"
                              value={reasons[it.id]}
                              onChange={(e) => handleReasonChange(it.id, e.target.value)}
                              placeholder="e.g. Spillage, counting error..."
                              style={{
                                padding: "6px 8px",
                                fontSize: 12,
                                borderColor: errors[it.id] ? COLORS.danger : undefined,
                                width: "100%"
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
                      <td>
                        {isDiscrepant ? (
                          <select
                            value={actions[it.id]}
                            onChange={(e) => handleActionChange(it.id, e.target.value)}
                            style={{
                              padding: "6px 8px",
                              fontSize: 12,
                              background: COLORS.bg,
                              border: `1px solid ${COLORS.border}`,
                              color: COLORS.text,
                              borderRadius: 6,
                              width: "100%"
                            }}
                          >
                            <option value="adjust_db">Adjust DB (FIFO)</option>
                            <option value="recount">Flag for Recount</option>
                            <option value="investigate">Investigate</option>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Btn variant="ghost" onClick={onBack} icon={<ArrowLeft size={16} />}>
            Back
          </Btn>
          <Btn 
            onClick={handleFinalise}
            disabled={submitting}
            style={{ padding: "10px 28px" }}
          >
            {submitting ? "Finalising and adjusting DB..." : "Finalise & Adjust DB"}
          </Btn>
        </div>

      </div>
    </Section>
  );
}
