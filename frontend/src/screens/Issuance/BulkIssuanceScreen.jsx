import { useState, useEffect } from "react";
import * as api from "../../api";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import MultiAgentStatusBar from "../../components/MultiAgentStatusBar";
import { ClipboardList, CheckSquare, AlertTriangle, Sparkles, Check, ChevronDown, ChevronUp } from "lucide-react";

export default function BulkIssuanceScreen({ onBack }) {
  const [indents, setIndents] = useState([]);
  const [shortfalls, setShortfalls] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [expandedIndent, setExpandedIndent] = useState(null);
  const [substitutes, setSubstitutes] = useState({});

  useEffect(() => {
    loadPreview();
  }, []);

  useEffect(() => {
    if (shortfalls.length > 0) {
      fetchSubstitutes();
    }
  }, [shortfalls]);

  const fetchSubstitutes = async () => {
    const subs = {};
    for (const s of shortfalls) {
      try {
        const res = await api.stock.substitute(s.name);
        if (res.success && res.substitute) {
          subs[s.name] = res.substitute;
        }
      } catch (err) {
        console.error("Failed to fetch substitute for " + s.name, err);
      }
    }
    setSubstitutes(subs);
  };

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await api.issuances.bulkPreview();
      if (res.success && res.data) {
        setIndents(res.data.indents || []);
        setShortfalls(res.data.shortfalls || []);
        // Select all by default
        setSelectedIds(new Set((res.data.indents || []).map(i => i.id)));
      }
    } catch (err) {
      console.error("Failed to load bulk preview", err);
    }
    setLoading(false);
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === indents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(indents.map(i => i.id)));
    }
  };

  const handleBulkIssue = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Are you sure you want to issue ${selectedIds.size} indents in bulk?`);
    if (!confirmed) return;

    setIssuing(true);
    try {
      const res = await api.issuances.bulkIssue(Array.from(selectedIds), "LIFO");
      if (res.success) {
        alert(res.message || "Bulk issuance completed successfully with LIFO stock deduction!");
        loadPreview();
      }
    } catch (err) {
      console.error("Bulk issuance failed", err);
      alert(err.message || "Bulk issuance failed.");
    }
    setIssuing(false);
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#1E293B", fontFamily: "var(--font-display, serif)", margin: 0 }}>
            Bulk Auto-Issuance
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>
            Reconcile and issue all approved indents in a single transaction with automatic shortfall conflict resolution.
          </p>
        </div>
        <Btn onClick={onBack} variant="outline">
          Back to Dashboard
        </Btn>
      </div>

      {/* Multi-Agent Swarm Status Bar & LIFO Strategy note */}
      <MultiAgentStatusBar
        customNote="Bulk auto-issuance operates on LIFO strategy: newest inventory lots drain first with invoice traceability"
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
          Loading pending approved indents...
        </div>
      ) : indents.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <CheckSquare size={48} color="#10B981" />
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1E293B", margin: 0 }}>All caught up!</h3>
          <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>No approved indents are currently awaiting issuance.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: shortfalls.length > 0 ? "1fr 340px" : "1fr", gap: "24px", alignItems: "start" }}>
          
          {/* Main List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Card style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === indents.length}
                    onChange={handleToggleSelectAll}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                    Select All ({indents.length} Pending)
                  </span>
                </div>
                <Btn
                  onClick={handleBulkIssue}
                  disabled={selectedIds.size === 0 || issuing}
                  style={{
                    background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                    border: "1px solid #e8a838",
                    color: "#e8a838",
                    boxShadow: "0 4px 12px rgba(232, 168, 56, 0.12)"
                  }}
                >
                  <Sparkles size={16} /> {issuing ? "Issuing..." : `⚡ Bulk Issue Selected (${selectedIds.size})`}
                </Btn>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {indents.map((ind) => {
                  const isChecked = selectedIds.has(ind.id);
                  const isExpanded = expandedIndent === ind.id;
                  return (
                    <div
                      key={ind.id}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        background: isChecked ? "#F8FAFC" : "white",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelect(ind.id)}
                            style={{ width: "16px", height: "16px", cursor: "pointer" }}
                          />
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#1E293B" }}>
                              {ind.dept}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                              Indent #{ind.id} • {ind.date}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backgroundColor: ind.status === "approved" ? "#ECFDF5" : "#EFF6FF",
                            color: ind.status === "approved" ? "#10B981" : "#3B82F6"
                          }}>
                            {ind.status.toUpperCase()}
                          </span>
                          <button
                            onClick={() => setExpandedIndent(isExpanded ? null : ind.id)}
                            style={{ background: "none", border: "none", color: "#64748B", display: "flex", alignItems: "center" }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: "12px", borderTop: "1px solid #E2E8F0", paddingTop: "12px" }}>
                          <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ background: "#F8FAFC" }}>
                                <th style={{ padding: "6px 8px", textAlign: "left", color: "#475569" }}>Item</th>
                                <th style={{ padding: "6px 8px", textAlign: "right", color: "#475569" }}>Qty Requested</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(ind.items || []).map((it, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                  <td style={{ padding: "6px 8px", color: "#334155" }}>{it.name}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#334155" }}>
                                    {it.qty} {it.unit}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Sidebar Shortfalls/Conflicts warnings */}
          {shortfalls.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Card style={{ padding: "20px", borderLeft: "4px solid #F59E0B", background: "#FFFBEB" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#B45309", display: "flex", alignItems: "center", gap: "6px", margin: "0 0 10px 0" }}>
                  <AlertTriangle size={18} /> Stock Shortfalls Detected
                </h3>
                <p style={{ fontSize: "12px", color: "#78350F", margin: "0 0 16px 0", lineHeight: "1.4" }}>
                  The items below have total pending requests exceeding the current available stock. The system will proportionally allocate stock during bulk execution.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {shortfalls.map((t, idx) => {
                    const sub = substitutes[t.name];
                    return (
                      <div key={idx} style={{ padding: "10px", background: "white", borderRadius: "6px", border: "1px solid #FCD34D" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#78350F" }}>{t.name}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#B45309", marginTop: "6px" }}>
                          <span>Total Requested: {t.requested} {t.unit}</span>
                          <span>Available: {t.available} {t.unit}</span>
                        </div>
                        {sub && (
                          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #FCD34D", fontSize: "12px", color: "#1E293B", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontWeight: 700, color: "#D97706" }}>💡 AI Alternative:</span>
                            <span>{sub.name} (Avail: {sub.remaining} {sub.unit})</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
