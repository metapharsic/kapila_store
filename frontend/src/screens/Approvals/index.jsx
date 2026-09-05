import React, { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import * as api from "../../api";
import { Check, X, ShieldAlert, Clock, ArrowRight, User, Calendar } from "lucide-react";

export default function ApprovalsScreen() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionNotes, setActionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.approvals.pending();
      if (res.success) {
        setPendingRequests(res.data || []);
        // Preserve selected request reference if it's still in the list
        if (selectedRequest) {
          const fresh = res.data.find(r => r.id === selectedRequest.id);
          setSelectedRequest(fresh || null);
        }
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
  }, []);

  const handleAction = async (action) => {
    if (!selectedRequest) return;
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
        setActionNotes("");
        setSelectedRequest(null);
        await fetchPending();
      } else {
        setError(res.error || `Failed to ${action} request.`);
      }
    } catch (err) {
      setError("Action failed. Server error.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section title="Approvals Queue" subtitle="Manage and approve transactions based on threshold limits">
      {error && <ErrorMsg msg={error} />}

      <div style={{ display: "grid", gridTemplateColumns: selectedRequest ? "1fr 1.2fr" : "1fr", gap: 24, minHeight: 400 }}>
        {/* Left Side: Pending Requests List */}
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: COLORS.text, fontWeight: 600 }}>Awaiting Approval ({pendingRequests.length})</h3>
          
          {loading && pendingRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Loading approval queue...</div>
          ) : pendingRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>No pending approval requests.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: 500 }}>
              {pendingRequests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                const poNumber = req.details?.po_number || "";
                const totalText = req.details?.total_amount ? `₹${parseFloat(req.details.total_amount).toLocaleString()}` : "";
                const supplierText = req.details?.supplier_name || req.details?.dept || "System";
                
                return (
                  <div
                    key={req.id}
                    onClick={() => { setSelectedRequest(req); setError(""); }}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                      background: isSelected ? `${COLORS.accent}12` : COLORS.bg,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6
                    }}
                  >
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
                      <span>
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
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
                {selectedRequest.details?.total_amount && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.accent }}>
                      ₹{parseFloat(selectedRequest.details.total_amount).toLocaleString()}
                    </div>
                    <span style={{ fontSize: 10, color: COLORS.muted }}>Total Cost</span>
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

            {/* Notes & Actions Form */}
            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <Input
                label="Decision Comments / Remarks"
                placeholder="Enter notes explaining approval or rejection reason..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <Btn
                  variant="danger"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  disabled={submitting}
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
    </Section>
  );
}
