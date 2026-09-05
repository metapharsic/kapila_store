import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { ArrowLeft, Save, AlertTriangle, CheckCircle, Info } from "lucide-react";
import Btn from "../../components/Btn";
import Card from "../../components/Card";
import Section from "../../components/Section";
import { getAudit, patchAuditItem } from "./auditApi";

export default function AuditCountScreen({ auditId, onBack, onProceed }) {
  const [audit, setAudit] = useState(null);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({}); // itemId -> string physical_qty
  const [saving, setSaving] = useState({}); // itemId -> boolean
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAuditDetails = async () => {
    try {
      const res = await getAudit(auditId);
      if (res.success) {
        setAudit(res.data);
        setItems(res.data.items || []);
        
        // Populate initial counts state
        const initialCounts = {};
        res.data.items.forEach(it => {
          initialCounts[it.id] = it.physical_qty !== null ? String(it.physical_qty) : "";
        });
        setCounts(initialCounts);
      }
    } catch (err) {
      setError(err.message || "Failed to load audit session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditDetails();
  }, [auditId]);

  const handleCountChange = (itemId, value) => {
    setCounts(prev => ({ ...prev, [itemId]: value }));
  };

  const handleCountBlur = async (itemId, originalValue) => {
    const rawVal = counts[itemId];
    if (rawVal === "") return; // Don't persist empty count automatically

    const val = parseFloat(rawVal);
    if (isNaN(val) || val < 0) return;

    // Check if the value has changed
    const currentItem = items.find(it => it.id === itemId);
    if (currentItem && currentItem.physical_qty === val) return; // No change

    setSaving(prev => ({ ...prev, [itemId]: true }));

    try {
      const res = await patchAuditItem(auditId, itemId, { physical_qty: val });
      if (res.success) {
        // Update local items state
        setItems(prev => prev.map(it => it.id === itemId ? {
          ...it,
          physical_qty: val,
          difference: val - parseFloat(it.db_qty)
        } : it));
      }
    } catch (err) {
      console.error("Failed to save count", err);
    } finally {
      setSaving(prev => ({ ...prev, [itemId]: false }));
    }
  };

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
  const countedItems = items.filter(it => it.physical_qty !== null).length;
  const progressPercent = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;
  const allCounted = countedItems === totalItems;

  return (
    <Section 
      title={`Stock Audit Count: ${audit.reference}`} 
      sub={`Auditor: ${audit.auditor_name} • Department: ${audit.department_id ? "Scoped" : "Global CENTRAL STORE"}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Progress Bar Header */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
              Counting Progress: {countedItems} of {totalItems} items entered
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.brand }}>
              {progressPercent}%
            </span>
          </div>
          <div style={{ width: "100%", height: 8, background: COLORS.border, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${progressPercent}%`, height: "100%", background: COLORS.brand, transition: "width 0.3s ease" }}></div>
          </div>
        </Card>

        {/* Audit Count Entry Table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Item Code</th>
                  <th>Item Name</th>
                  <th style={{ width: 100 }}>Unit</th>
                  <th style={{ width: 130 }}>DB Qty (Snapshot)</th>
                  <th style={{ width: 160 }}>Physical Count</th>
                  <th style={{ width: 180 }}>Variance Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const rawVal = counts[it.id];
                  const currentPhys = rawVal === "" ? null : parseFloat(rawVal);
                  const dbVal = parseFloat(it.db_qty);
                  const isSaved = it.physical_qty !== null;
                  
                  let statusText = "not entered";
                  let statusBg = "#f1f5f9";
                  let statusColor = "#64748b";

                  if (currentPhys !== null && !isNaN(currentPhys)) {
                    const diff = currentPhys - dbVal;
                    if (Math.abs(diff) < 0.0001) {
                      statusText = "matched";
                      statusBg = "#ecfdf5";
                      statusColor = COLORS.success;
                    } else if (diff < 0) {
                      statusText = `short ${Math.abs(diff).toFixed(2)} ${it.unit}`;
                      statusBg = "#fef2f2";
                      statusColor = COLORS.danger;
                    } else {
                      statusText = `surplus +${diff.toFixed(2)} ${it.unit}`;
                      statusBg = "#fef3c7";
                      statusColor = COLORS.warning;
                    }
                  } else if (isSaved) {
                    const diff = parseFloat(it.difference || 0);
                    if (Math.abs(diff) < 0.0001) {
                      statusText = "matched";
                      statusBg = "#ecfdf5";
                      statusColor = COLORS.success;
                    } else if (diff < 0) {
                      statusText = `short ${Math.abs(diff).toFixed(2)} ${it.unit}`;
                      statusBg = "#fef2f2";
                      statusColor = COLORS.danger;
                    } else {
                      statusText = `surplus +${diff.toFixed(2)} ${it.unit}`;
                      statusBg = "#fef3c7";
                      statusColor = COLORS.warning;
                    }
                  }

                  return (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{it.item_code}</td>
                      <td style={{ fontWeight: 500 }}>{it.item_name}</td>
                      <td style={{ color: COLORS.muted }}>{it.unit}</td>
                      <td style={{ fontWeight: 600, color: COLORS.muted }}>{dbVal.toFixed(2)}</td>
                      <td>
                        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={rawVal}
                            onChange={(e) => handleCountChange(it.id, e.target.value)}
                            onBlur={() => handleCountBlur(it.id, dbVal)}
                            placeholder="Enter count..."
                            style={{
                              padding: "6px 10px",
                              fontSize: 13,
                              borderColor: saving[it.id] ? COLORS.brand : undefined,
                              width: "100%",
                              outline: "none"
                            }}
                          />
                          {saving[it.id] && (
                            <span 
                              className="pulse" 
                              style={{ 
                                position: "absolute", right: 8, width: 8, height: 8,
                                background: COLORS.brand, borderRadius: "50%"
                              }} 
                            />
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          backgroundColor: statusBg,
                          color: statusColor,
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          display: "inline-block"
                        }}>
                          {statusText}
                        </span>
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
            Save & Exit
          </Btn>
          <Btn 
            onClick={() => onProceed(auditId)}
            disabled={!allCounted}
            style={{ padding: "10px 24px" }}
          >
            Proceed to Reconciliation
          </Btn>
        </div>

      </div>
    </Section>
  );
}
