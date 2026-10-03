import { useState, useEffect, useMemo } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import ErrorMsg from "../../components/ErrorMsg";
import Pill from "../../components/ui/Pill";
import { COLORS, SPACING, RADIUS } from "../../styles/colors";
import * as api from "../../api";
import { Check, X, Clock, ShieldCheck, Users as UsersIcon } from "lucide-react";

const MODULE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "purchase_orders", label: "Purchase Orders" },
  { value: "indents", label: "Indents" },
  { value: "transfers", label: "Transfers" },
  { value: "reconciliations", label: "Reconciliations" },
];

const AGE_OPTIONS = [
  { value: "all", label: "Any Age" },
  { value: "gt24", label: "Pending > 24h" },
  { value: "gt8", label: "Pending > 8h" },
  { value: "lt8", label: "Pending < 8h" },
];

const SORT_OPTIONS = [
  { value: "age_desc", label: "Oldest First" },
  { value: "age_asc", label: "Newest First" },
  { value: "amount_desc", label: "Amount (High-Low)" },
  { value: "amount_asc", label: "Amount (Low-High)" },
];

function getAmount(req) {
  const val = req.details?.total_amount != null ? req.details.total_amount : req.details?.estimated_amount;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// Falls back to computing age from created_at when the backend hasn't attached
// age_hours/sla_breached yet, so the screen still renders a sensible SLA pill.
function getSlaInfo(req) {
  const ageHours = req.age_hours != null
    ? parseFloat(req.age_hours)
    : (Date.now() - new Date(req.created_at).getTime()) / (1000 * 60 * 60);
  const breached = req.sla_breached != null ? !!req.sla_breached : ageHours > 24;
  let variant = "success";
  if (breached || ageHours > 24) variant = "danger";
  else if (ageHours > 8) variant = "warning";
  return { ageHours, breached, variant, text: `${Math.floor(ageHours)}h` };
}

export default function ApprovalsScreen() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conflictBanner, setConflictBanner] = useState("");
  const [msg, setMsg] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionNotes, setActionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);

  // Filters / sort
  const [moduleFilter, setModuleFilter] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("age_desc");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Delegate
  const [delegateTarget, setDelegateTarget] = useState(null);
  const [delegateUserId, setDelegateUserId] = useState("");
  const [delegateSubmitting, setDelegateSubmitting] = useState(false);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 3500);
  };

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.approvals.pending();
      if (res.success) {
        setPendingRequests(res.data || []);
        if (selectedRequest) {
          const fresh = res.data.find(r => r.id === selectedRequest.id);
          setSelectedRequest(fresh || null);
        }
        setSelectedIds(prev => {
          const ids = new Set((res.data || []).map(r => r.id));
          const next = new Set();
          prev.forEach(id => { if (ids.has(id)) next.add(id); });
          return next;
        });
      } else {
        setError(res.error || "Failed to load pending approvals.");
      }
    } catch (err) {
      setError("Server connection error.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    api.users.list({ limit: 200 }).then(res => {
      if (res.success) setUsers(res.data || []);
    }).catch(() => {});
  }, []);

  // Central handler for a 409 "someone already acted on this" conflict, shared
  // by single approve/reject, bulk-action, and delegate.
  const handleConflict = async (err, fallbackMsg) => {
    if (err?.status === 409) {
      const who = err.message && /by\s+(.+)$/i.exec(err.message)?.[1];
      setConflictBanner(who ? `Already handled by ${who}.` : (err.message || "This request was already handled by someone else."));
      setTimeout(() => setConflictBanner(""), 6000);
      await fetchPending();
      return true;
    }
    setError(err?.message || fallbackMsg);
    return false;
  };

  const handleAction = async (action) => {
    if (!selectedRequest) return;
    if (action === "reject" && !actionNotes.trim()) {
      setRejectReasonOpen(true);
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      let res;
      if (action === "approve") {
        res = await api.approvals.approve(selectedRequest.id, actionNotes);
      } else {
        res = await api.approvals.reject(selectedRequest.id, actionNotes);
      }

      if (res.success) {
        flash(action === "approve" ? "Transaction successfully authorized & approved ✓" : "Transaction rejected and returned to requester ✗", action === "approve" ? COLORS.success : COLORS.danger);
        setActionNotes("");
        setRejectReasonOpen(false);
        setSelectedRequest(null);
        await fetchPending();
      } else {
        setError(res.error || `Failed to ${action} request.`);
      }
    } catch (err) {
      await handleConflict(err, "Action failed. Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (prev.size === filteredSorted.length && filteredSorted.length > 0) return new Set();
      return new Set(filteredSorted.map(r => r.id));
    });
  };

  const runBulkAction = async (action, reason) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      setBulkSubmitting(true);
      setError("");
      const res = await api.approvals.bulkAction(ids, action, reason);
      if (res.success) {
        flash(action === "approve" ? `${ids.length} request(s) approved ✓` : `${ids.length} request(s) rejected ✗`, action === "approve" ? COLORS.success : COLORS.danger);
        setSelectedIds(new Set());
        setBulkRejectOpen(false);
        setBulkReason("");
        await fetchPending();
      } else {
        setError(res.error || `Failed to ${action} selected requests.`);
      }
    } catch (err) {
      await handleConflict(err, "Bulk action failed. Server error.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const submitDelegate = async () => {
    if (!delegateTarget || !delegateUserId) return;
    try {
      setDelegateSubmitting(true);
      setError("");
      const res = await api.approvals.delegate(delegateTarget.id, delegateUserId);
      if (res.success) {
        flash("Request delegated ✓", COLORS.success);
        setDelegateTarget(null);
        setDelegateUserId("");
        await fetchPending();
      } else {
        setError(res.error || "Failed to delegate request.");
      }
    } catch (err) {
      await handleConflict(err, "Delegate failed. Server error.");
    } finally {
      setDelegateSubmitting(false);
    }
  };

  const filteredSorted = useMemo(() => {
    let rows = pendingRequests.slice();
    if (moduleFilter !== "all") rows = rows.filter(r => r.module === moduleFilter);
    const min = parseFloat(minAmount);
    if (!isNaN(min) && minAmount !== "") rows = rows.filter(r => getAmount(r) >= min);
    if (ageFilter !== "all") {
      rows = rows.filter(r => {
        const { ageHours } = getSlaInfo(r);
        if (ageFilter === "gt24") return ageHours > 24;
        if (ageFilter === "gt8") return ageHours > 8;
        if (ageFilter === "lt8") return ageHours < 8;
        return true;
      });
    }
    rows.sort((a, b) => {
      if (sortBy === "amount_desc") return getAmount(b) - getAmount(a);
      if (sortBy === "amount_asc") return getAmount(a) - getAmount(b);
      const ageA = getSlaInfo(a).ageHours;
      const ageB = getSlaInfo(b).ageHours;
      return sortBy === "age_asc" ? ageA - ageB : ageB - ageA;
    });
    return rows;
  }, [pendingRequests, moduleFilter, minAmount, ageFilter, sortBy]);

  const allSelected = filteredSorted.length > 0 && selectedIds.size === filteredSorted.length;

  return (
    <Section title="Approvals Queue" subtitle="Manage and approve transactions based on threshold limits">
      {msg && <p style={{ color: msg.color, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{msg.text}</p>}
      {conflictBanner && (
        <div style={{ background: `${COLORS.danger}15`, border: `1px solid ${COLORS.danger}`, color: COLORS.danger, borderRadius: RADIUS.sm, padding: `${SPACING.sm}px ${SPACING.md}px`, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
          {conflictBanner}
        </div>
      )}
      {error && <ErrorMsg msg={error} />}

      {/* Filters & Sort */}
      <Card style={{ padding: 16, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div>
          <label style={filterLabel}>Request Type</label>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={selectStyle}>
            {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={filterLabel}>Min Amount (₹)</label>
          <input
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="0"
            style={{ ...selectStyle, width: 110 }}
          />
        </div>
        <div>
          <label style={filterLabel}>Age</label>
          <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} style={selectStyle}>
            {AGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={filterLabel}>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {(moduleFilter !== "all" || minAmount !== "" || ageFilter !== "all" || sortBy !== "age_desc") && (
          <Btn variant="ghost" small onClick={() => { setModuleFilter("all"); setMinAmount(""); setAgeFilter("all"); setSortBy("age_desc"); }}>
            Clear Filters
          </Btn>
        )}
      </Card>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <Card style={{ padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${COLORS.brand}`, background: `${COLORS.brand}10` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{selectedIds.size} selected</span>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn
              variant="success"
              small
              disabled={bulkSubmitting}
              onClick={() => runBulkAction("approve")}
              icon={<Check size={14} />}
            >
              Approve {selectedIds.size}
            </Btn>
            <Btn
              variant="danger"
              small
              disabled={bulkSubmitting}
              onClick={() => setBulkRejectOpen(true)}
              icon={<X size={14} />}
            >
              Reject {selectedIds.size}
            </Btn>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selectedRequest ? "1fr 1.2fr" : "1fr", gap: 24, minHeight: 400 }}>
        {/* Left Side: Pending Requests List */}
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 15, color: COLORS.text, fontWeight: 600 }}>Awaiting Approval ({filteredSorted.length})</h3>
            {filteredSorted.length > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.muted, cursor: "pointer" }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                Select all
              </label>
            )}
          </div>

          {loading && pendingRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Loading approval queue...</div>
          ) : filteredSorted.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>No pending approval requests match your filters.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: 500 }}>
              {filteredSorted.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                const isChecked = selectedIds.has(req.id);
                const poNumber = req.details?.po_number || "";
                const val = getAmount(req);
                const totalText = val > 0 ? `₹${val.toLocaleString()}` : "";
                const supplierText = req.details?.supplier_name || req.details?.dept || "System";
                const sla = getSlaInfo(req);

                return (
                  <div
                    key={req.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                      background: isSelected ? `${COLORS.accent}12` : COLORS.bg,
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(req.id)}
                        style={{ marginTop: 3 }}
                      />
                      <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { setSelectedRequest(req); setActionNotes(""); setRejectReasonOpen(false); setError(""); }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, textTransform: "uppercase" }}>
                            {req.module.replace("_", " ")}
                          </span>
                          <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600 }}>
                            {totalText}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>
                          Ref: {poNumber || `#${req.resource_id}`} · {supplierText}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: COLORS.muted, marginTop: 4 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={12} /> Stage {req.current_sequence}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Pill variant={sla.variant}>{sla.text}{sla.breached ? " SLA" : ""}</Pill>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDelegateTarget(req); setDelegateUserId(""); }}
                              style={delegateBtnStyle}
                              title="Delegate this request"
                            >
                              <UsersIcon size={11} /> Delegate
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right Side: Selected Request Details */}
        {selectedRequest && (
          <Card style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Detail Header */}
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    backgroundColor: `${COLORS.accent}20`,
                    color: COLORS.accent,
                    padding: "2px 8px",
                    borderRadius: 4,
                    display: "inline-block",
                    marginBottom: 6
                  }}>
                    Stage {selectedRequest.current_sequence} Approval
                  </span>
                  <h3 style={{ margin: 0, fontSize: 18, color: COLORS.text, textTransform: "capitalize" }}>
                    {selectedRequest.module.replace("_", " ")} Details
                  </h3>
                </div>
                {(selectedRequest.details?.total_amount || selectedRequest.details?.estimated_amount) && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.accent }}>
                      ₹{parseFloat(selectedRequest.details.total_amount || selectedRequest.details.estimated_amount).toLocaleString()}
                    </div>
                    <span style={{ fontSize: 10, color: COLORS.muted }}>
                      {selectedRequest.module === "indents" ? "Estimated Value" : "Total Cost"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Document Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>
              <div>
                <span style={{ color: COLORS.muted, display: "block", marginBottom: 2 }}>Reference Code</span>
                <span style={{ color: COLORS.text, fontWeight: 600 }}>
                  {selectedRequest.details?.po_number || `#${selectedRequest.resource_id}`}
                </span>
              </div>
              <div>
                <span style={{ color: COLORS.muted, display: "block", marginBottom: 2 }}>Date Created</span>
                <span style={{ color: COLORS.text, fontWeight: 600 }}>
                  {selectedRequest.details?.date || new Date(selectedRequest.created_at).toLocaleDateString()}
                </span>
              </div>
              {selectedRequest.details?.supplier_name && (
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: COLORS.muted, display: "block", marginBottom: 2 }}>Supplier</span>
                  <span style={{ color: COLORS.text, fontWeight: 600 }}>{selectedRequest.details.supplier_name}</span>
                </div>
              )}
              {selectedRequest.details?.dept && (
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: COLORS.muted, display: "block", marginBottom: 2 }}>Requesting Department</span>
                  <span style={{ color: COLORS.text, fontWeight: 600 }}>{selectedRequest.details.dept}</span>
                </div>
              )}
            </div>

            {/* Items List */}
            {selectedRequest.details?.items && selectedRequest.details.items.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 10px 0", fontSize: 13, color: COLORS.text, fontWeight: 600 }}>Requested Items</h4>
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                        <th style={{ padding: "8px 12px", color: COLORS.muted, fontWeight: 600 }}>Item Name</th>
                        <th style={{ padding: "8px 12px", color: COLORS.muted, fontWeight: 600, textAlign: "right" }}>Quantity</th>
                        {selectedRequest.details.items[0]?.unit_price !== undefined && (
                          <th style={{ padding: "8px 12px", color: COLORS.muted, fontWeight: 600, textAlign: "right" }}>Unit Price</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.details.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < selectedRequest.details.items.length - 1 ? `1px solid ${COLORS.border}50` : "none" }}>
                          <td style={{ padding: "8px 12px", color: COLORS.text }}>{item.name}</td>
                          <td style={{ padding: "8px 12px", color: COLORS.text, textAlign: "right" }}>{item.qty} {item.unit}</td>
                          {item.unit_price !== undefined && (
                            <td style={{ padding: "8px 12px", color: COLORS.text, textAlign: "right" }}>₹{parseFloat(item.unit_price).toFixed(2)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Policy & Ledger Safeguard Info */}
            <div
              style={{
                background: "rgba(232, 168, 56, 0.08)",
                border: `1px solid ${COLORS.accent}44`,
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.accent, fontWeight: 700, fontSize: 12 }}>
                <ShieldCheck size={15} />
                <span>Agent Policy Auditor & Veritas Ledger Safeguard</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
                • <strong>Escalation Threshold:</strong> Financial valuation {selectedRequest.details?.total_amount ? `(₹${parseFloat(selectedRequest.details.total_amount).toLocaleString()})` : ""} satisfies hotel authorization requirements.
              </p>
              <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
                • <strong>Ledger Impact:</strong> Authorizing this request stamps an immutable audit entry, advancing state to <strong>Approved</strong> to unlock downstream vendor issuance and GRN inward processing.
              </p>
            </div>

            {/* Notes & Actions Form */}
            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <Input
                label="Decision Comments / Remarks"
                placeholder="Enter notes explaining approval or rejection reason..."
                value={actionNotes}
                onChange={(e) => { setActionNotes(e.target.value); }}
              />

              {rejectReasonOpen && (
                <div style={{ border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.sm, padding: SPACING.md, background: `${COLORS.danger}08` }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.danger, display: "block", marginBottom: 6 }}>
                    Reason required to reject
                  </label>
                  <textarea
                    autoFocus
                    rows={3}
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Explain why this request is being rejected..."
                    style={textareaStyle}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <Btn
                  variant="danger"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  disabled={submitting || (rejectReasonOpen && !actionNotes.trim())}
                  onClick={() => handleAction("reject")}
                >
                  <X size={16} /> Reject Request
                </Btn>
                <Btn
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  disabled={submitting}
                  onClick={() => handleAction("approve")}
                >
                  <Check size={16} /> Approve Request
                </Btn>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Bulk Reject Confirmation Modal */}
      {bulkRejectOpen && (
        <div style={modalOverlay} onClick={() => !bulkSubmitting && setBulkRejectOpen(false)}>
          <div style={{ ...modalContent, border: `2px solid ${COLORS.danger}` }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
              <h3 style={{ margin: 0, color: COLORS.danger }}>Confirm Bulk Reject</h3>
              <button onClick={() => setBulkRejectOpen(false)} style={closeBtn}>&times;</button>
            </div>
            <p style={{ color: COLORS.text, fontSize: 13 }}>
              You are about to reject <strong>{selectedIds.size}</strong> pending request(s). This will notify each requester.
            </p>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.text, display: "block", marginBottom: 6 }}>
              Reason (required)
            </label>
            <textarea
              autoFocus
              rows={3}
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="Explain why these requests are being rejected..."
              style={textareaStyle}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Btn variant="ghost" onClick={() => setBulkRejectOpen(false)} disabled={bulkSubmitting}>Cancel</Btn>
              <Btn
                variant="danger"
                onClick={() => runBulkAction("reject", bulkReason)}
                disabled={!bulkReason.trim() || bulkSubmitting}
              >
                {bulkSubmitting ? "Rejecting..." : `Reject ${selectedIds.size}`}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Modal */}
      {delegateTarget && (
        <div style={modalOverlay} onClick={() => !delegateSubmitting && setDelegateTarget(null)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
              <h3 style={{ margin: 0, color: COLORS.text }}>Delegate Approval</h3>
              <button onClick={() => setDelegateTarget(null)} style={closeBtn}>&times;</button>
            </div>
            <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 0 }}>
              Reassign {delegateTarget.module.replace("_", " ")} #{delegateTarget.resource_id} to another user for approval.
            </p>
            <label style={filterLabel}>Delegate To</label>
            <select value={delegateUserId} onChange={(e) => setDelegateUserId(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
              <option value="">Select a user...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Btn variant="ghost" onClick={() => setDelegateTarget(null)} disabled={delegateSubmitting}>Cancel</Btn>
              <Btn onClick={submitDelegate} disabled={!delegateUserId || delegateSubmitting}>
                {delegateSubmitting ? "Delegating..." : "Delegate"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

const filterLabel = { display: "block", fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", marginBottom: 4 };
const selectStyle = {
  padding: "8px 10px",
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.text,
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
};
const textareaStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: SPACING.sm,
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.text,
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  resize: "vertical",
};
const delegateBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.sm,
  color: COLORS.muted,
  fontSize: 10,
  fontWeight: 600,
  padding: "2px 6px",
  cursor: "pointer",
};
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: SPACING.xl };
const modalContent = { background: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.xxl, width: "100%", maxWidth: "min(480px, 90vw)", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" };
const closeBtn = { background: "none", border: "none", color: COLORS.muted, fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 };
