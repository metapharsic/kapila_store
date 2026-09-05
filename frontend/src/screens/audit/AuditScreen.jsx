import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { Clipboard, User, Calendar, Plus, Eye, Play, CheckCircle, XCircle, Info, Download, Trash2, ArrowLeft } from "lucide-react";
import Btn from "../../components/Btn";
import Card from "../../components/Card";
import Section from "../../components/Section";
import Pagination from "../../components/Pagination";
import { useAuth } from "../../context/AuthContext";
import { getAudits, getAudit, cancelAudit } from "./auditApi";
import AuditNewModal from "./AuditNewModal";
import AuditCountScreen from "./AuditCountScreen";
import AuditReconcileScreen from "./AuditReconcileScreen";

export default function AuditScreen() {
  const { hasPermission, user } = useAuth();
  
  // Navigation State
  // 'list' | 'count' | 'reconcile' | 'report'
  const [subView, setSubView] = useState("list");
  const [selectedAuditId, setSelectedAuditId] = useState(null);

  // Lists state
  const [audits, setAudits] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Detail View State (for report view)
  const [detailAudit, setDetailAudit] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Permission Gate
  if (!hasPermission("audit.view")) {
    return (
      <Section title="Access Denied" sub="Insufficient permissions">
        <Card style={{ textAlign: "center", padding: 40, border: `1px solid ${COLORS.border}` }}>
          <XCircle size={40} color={COLORS.danger} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>
            You do not have permission to view stock audits.
          </p>
        </Card>
      </Section>
    );
  }

  // Load dashboard filter
  useEffect(() => {
    const filter = localStorage.getItem("kapila_audit_filter");
    if (filter) {
      setStatusFilter(filter);
      localStorage.removeItem("kapila_audit_filter");
    }
  }, []);

  const loadAudits = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAudits(statusFilter || undefined);
      if (res.success) {
        setAudits(res.data || []);
        setTotal(res.total || res.data.length);
      }
    } catch (err) {
      setError(err.message || "Failed to load audit history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subView === "list") {
      loadAudits();
    }
  }, [subView, statusFilter]);

  const handleAuditClick = async (audit) => {
    if (audit.status === "in_progress") {
      setDetailLoading(true);
      try {
        const res = await getAudit(audit.id);
        if (res.success) {
          const items = res.data.items || [];
          const allCounted = items.length > 0 && items.every(it => it.physical_qty !== null);
          setSelectedAuditId(audit.id);
          if (allCounted) {
            setSubView("reconcile");
          } else {
            setSubView("count");
          }
        }
      } catch (err) {
        setError("Failed to fetch audit checklist: " + err.message);
      } finally {
        setDetailLoading(false);
      }
    } else {
      // Completed or cancelled -> show read-only report
      setSelectedAuditId(audit.id);
      setDetailLoading(true);
      try {
        const res = await getAudit(audit.id);
        if (res.success) {
          setDetailAudit(res.data);
          setSubView("report");
        }
      } catch (err) {
        setError("Failed to load audit report: " + err.message);
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const handleCancelAudit = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to cancel this audit session? The locked snapshot will be discarded but preserved in the history.")) return;
    try {
      const res = await cancelAudit(id);
      if (res.success) {
        loadAudits();
      }
    } catch (err) {
      alert("Failed to cancel audit: " + err.message);
    }
  };

  const exportReportToCSV = (auditData) => {
    if (!auditData || !auditData.items) return;
    const headers = ["Item Code", "Item Name", "Unit", "DB Qty (Snapshot)", "Physical Qty (Counted)", "Variance", "Reason", "Action Taken", "DB Adjusted"];
    const rows = auditData.items.map(it => {
      const dbVal = parseFloat(it.db_qty);
      const physVal = parseFloat(it.physical_qty || 0);
      const diff = physVal - dbVal;
      const discrepancyReason = it.discrepancy_reason || "";
      const action = it.action || "None";
      const adjusted = it.db_adjusted ? "Yes" : "No";

      return [
        `"${it.item_code}"`,
        `"${it.item_name}"`,
        `"${it.unit}"`,
        dbVal.toFixed(2),
        physVal.toFixed(2),
        diff.toFixed(2),
        `"${discrepancyReason.replace(/"/g, '""')}"`,
        `"${action}"`,
        `"${adjusted}"`
      ].join(",");
    });

    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_report_${auditData.reference}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- SUBVIEW: READ-ONLY REPORT VIEW ---
  if (subView === "report" && detailAudit) {
    const matched = detailAudit.items.filter(it => Math.abs(parseFloat(it.difference || 0)) < 0.0001).length;
    const adjusted = detailAudit.items.filter(it => it.db_adjusted).length;
    const flagged = detailAudit.items.filter(it => it.action === "recount" || it.action === "investigate").length;

    return (
      <Section title={`Audit Report: ${detailAudit.reference}`} sub="Historical inventory reconciliation record">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Metadata Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
            
            <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block" }}>Auditor</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{detailAudit.auditor_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block" }}>Session Reference</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{detailAudit.reference}</span>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block" }}>Department Scope</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{detailAudit.department_id ? detailAudit.department_name : "All Departments (Global)"}</span>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block" }}>Date Created</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{new Date(detailAudit.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              {detailAudit.notes && (
                <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Notes</span>
                  <p style={{ fontSize: 13, color: COLORS.text, margin: 0 }}>{detailAudit.notes}</p>
                </div>
              )}
            </Card>

            <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 4 }}>Resolution Summary</span>
              {[
                { label: "Status", value: detailAudit.status.toUpperCase(), color: detailAudit.status === "completed" ? COLORS.success : COLORS.muted },
                { label: "Matched Items", value: matched, color: COLORS.success },
                { label: "Adjusted in DB", value: adjusted, color: COLORS.brand },
                { label: "Flagged Recount/Investigate", value: flagged, color: COLORS.warning }
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </Card>

          </div>

          {/* Items Report Table */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reconciliation Checklist</span>
              <Btn small variant="ghost" onClick={() => exportReportToCSV(detailAudit)} icon={<Download size={14} />}>
                Export to CSV
              </Btn>
            </div>
            
            <div className="resp-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Snapshot DB Qty</th>
                    <th>Counted Qty</th>
                    <th>Variance</th>
                    <th>Reason</th>
                    <th>Action Taken</th>
                    <th>DB Adjusted</th>
                  </tr>
                </thead>
                <tbody>
                  {detailAudit.items.map((it) => {
                    const dbVal = parseFloat(it.db_qty);
                    const physVal = parseFloat(it.physical_qty || 0);
                    const diff = physVal - dbVal;
                    const isDiscrepant = Math.abs(diff) > 0.0001;

                    return (
                      <tr key={it.id}>
                        <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{it.item_code}</td>
                        <td style={{ fontWeight: 500 }}>{it.item_name}</td>
                        <td style={{ color: COLORS.muted }}>{dbVal.toFixed(2)} {it.unit}</td>
                        <td style={{ fontWeight: 600 }}>{physVal.toFixed(2)} {it.unit}</td>
                        <td style={{
                          fontWeight: 700,
                          color: !isDiscrepant ? COLORS.success : diff < 0 ? COLORS.danger : COLORS.warning
                        }}>
                          {!isDiscrepant ? "matched" : diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                        </td>
                        <td style={{ color: COLORS.muted, fontSize: 12 }}>{it.discrepancy_reason || "—"}</td>
                        <td>
                          {it.action ? (
                            <span style={{
                              backgroundColor: it.action === "adjust_db" ? "var(--color-accent-green-light)" : "var(--color-accent-amber-light)",
                              color: it.action === "adjust_db" ? COLORS.success : COLORS.warning,
                              padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600
                            }}>
                              {it.action === "adjust_db" ? "Adjusted DB" : it.action === "recount" ? "Recount" : "Investigate"}
                            </span>
                          ) : (
                            <span style={{ color: COLORS.muted, fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, color: it.db_adjusted ? COLORS.success : COLORS.muted }}>
                          {it.db_adjusted ? "Yes" : "No"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <Btn variant="ghost" onClick={() => setSubView("list")} icon={<ArrowLeft size={16} />}>
              Back to List
            </Btn>
          </div>

        </div>
      </Section>
    );
  }

  // --- SUBVIEW: IN-PROGRESS ACTIVE SCREENS ---
  if (subView === "count" && selectedAuditId) {
    return (
      <AuditCountScreen 
        auditId={selectedAuditId} 
        onBack={() => setSubView("list")} 
        onProceed={(id) => {
          setSelectedAuditId(id);
          setSubView("reconcile");
        }}
      />
    );
  }

  if (subView === "reconcile" && selectedAuditId) {
    return (
      <AuditReconcileScreen 
        auditId={selectedAuditId} 
        onBack={() => setSubView("count")} 
        onComplete={() => setSubView("list")}
      />
    );
  }

  // --- MAIN VIEW: LIST AUDIT SESSIONS ---
  return (
    <Section title="Stock Audits" sub="Manage inventory counts, snapshot locks, and database reconciliation.">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        
        {/* Filter Bar */}
        <Card style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500 }}>Filter Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: 150, padding: "6px 10px", fontSize: 13,
                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                color: COLORS.text, borderRadius: 8
              }}
            >
              <option value="">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {hasPermission("audit.create") && (
            <Btn onClick={() => setIsNewModalOpen(true)} icon={<Plus size={16} />}>
              New Audit Session
            </Btn>
          )}
        </Card>

        {error && (
          <p style={{ color: COLORS.danger, fontSize: 13, fontWeight: 500 }}>{error}</p>
        )}

        {/* Audits Table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div className="resp-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Reference</th>
                  <th>Auditor</th>
                  <th>Department Scope</th>
                  <th>Date Created</th>
                  <th>Items Count</th>
                  <th>Status</th>
                  <th style={{ width: 150, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: 30, color: COLORS.muted }}>
                      Loading audit sessions…
                    </td>
                  </tr>
                ) : audits.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: 30, color: COLORS.muted }}>
                      No audit sessions found.
                    </td>
                  </tr>
                ) : (
                  audits.map((a) => {
                    let statusBg = "var(--color-bg-page)";
                    let statusColor = "var(--color-text-muted)";
                    if (a.status === "in_progress") {
                      statusBg = "var(--color-accent-amber-light)";
                      statusColor = COLORS.warning;
                    } else if (a.status === "completed") {
                      statusBg = "var(--color-accent-green-light)";
                      statusColor = COLORS.success;
                    } else if (a.status === "cancelled") {
                      statusBg = "var(--color-accent-red-light)";
                      statusColor = COLORS.danger;
                    }

                    return (
                      <tr 
                        key={a.id} 
                        onClick={() => handleAuditClick(a)} 
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ fontWeight: 600, color: COLORS.brand }}>{a.reference}</td>
                        <td style={{ fontWeight: 500 }}>{a.auditor_name}</td>
                        <td style={{ color: COLORS.muted }}>{a.department_id ? a.department_name : "Global Central Store"}</td>
                        <td>{new Date(a.created_at).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600, color: COLORS.muted }}>{a.items_count || 0} items</td>
                        <td>
                          <span style={{
                            backgroundColor: statusBg,
                            color: statusColor,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            display: "inline-block",
                            textTransform: "uppercase"
                          }}>
                            {a.status.replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {a.status === "in_progress" ? (
                              <>
                                <Btn 
                                  small
                                  onClick={(e) => { e.stopPropagation(); handleAuditClick(a); }}
                                  icon={<Play size={12} />}
                                >
                                  Resume
                                </Btn>
                                {hasPermission("audit.finalise") && (
                                  <Btn 
                                    small
                                    variant="ghost"
                                    onClick={(e) => handleCancelAudit(a.id, e)}
                                    icon={<Trash2 size={12} />}
                                    className="danger-hover"
                                    style={{ color: COLORS.danger, borderColor: COLORS.border }}
                                  >
                                    Cancel
                                  </Btn>
                                )}
                              </>
                            ) : (
                              <Btn 
                                small
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleAuditClick(a); }}
                                icon={<Eye size={12} />}
                                style={{ border: `1px solid ${COLORS.border}` }}
                              >
                                View Report
                              </Btn>
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
        </Card>
      </div>

      <AuditNewModal 
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={(newSession) => {
          setSelectedAuditId(newSession.id);
          setSubView("count");
        }}
        user={user}
      />
    </Section>
  );
}
