import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import * as api from "../../api";

const fmt = (n) => parseFloat(n || 0).toFixed(2);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const fmtTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

export default function ReconciliationHistoryPanel() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.stock.reconcileHistory({ limit: 30, offset: 0 })
      .then((r) => { setSessions(r.data || []); setTotal(r.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSession = async (id) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const r = await api.stock.reconcileSession(id);
      setDetail(r);
    } catch (_) {}
    finally { setDetailLoading(false); }
  };

  const statusBadge = (s) => {
    const colors = { SUBMITTED: { bg: COLORS.success + "22", color: COLORS.success }, DRAFT: { bg: COLORS.muted + "22", color: COLORS.muted } };
    const c = colors[s] || colors.DRAFT;
    return <span style={{ background: c.bg, color: c.color, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{s}</span>;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Reconciliation Sessions � {total} total
        </p>
      </div>

      {loading && <p style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: 40 }}>Loading sessions�</p>}

      {!loading && sessions.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: COLORS.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>??</div>
          <p style={{ fontSize: 14 }}>No reconciliation sessions yet.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Submit a physical count to create the first session.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map((s) => (
          <div key={s.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
            {/* Session header row */}
            <div
              onClick={() => toggleSession(s.id)}
              style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: 16, alignItems: "center",
                padding: "14px 20px", cursor: "pointer", background: expanded === s.id ? "#ffffff08" : "transparent" }}
            >
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 2 }}>{s.session_name}</p>
                <p style={{ fontSize: 11, color: COLORS.muted }}>{fmtTime(s.submitted_at || s.created_at)}</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>Items</p>
                <p style={{ fontWeight: 700, color: COLORS.text }}>{s.item_count}</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>Surplus</p>
                <p style={{ fontWeight: 700, color: COLORS.success }}>+?{fmt(s.total_surplus_value)}</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>Shortage</p>
                <p style={{ fontWeight: 700, color: COLORS.coral }}>-?{fmt(s.total_shortage_value)}</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>Conducted by</p>
                <p style={{ fontSize: 12, color: COLORS.text }}>{s.conducted_by || "�"}</p>
              </div>
              {statusBadge(s.status)}
              <span style={{ color: COLORS.muted, fontSize: 16 }}>{expanded === s.id ? "?" : "?"}</span>
            </div>

            {/* Expanded detail */}
            {expanded === s.id && (
              <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "14px 20px", background: "#ffffff05" }}>
                {detailLoading && <p style={{ color: COLORS.muted, fontSize: 12 }}>Loading detail�</p>}
                {detail && (
                  <>
                    <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                      {[
                        { label: "? Matched", val: s.matched_item_count, color: COLORS.success },
                        { label: "?? Surplus", val: s.surplus_item_count, color: COLORS.teal },
                        { label: "?? Shortage", val: s.shortage_item_count, color: COLORS.coral },
                        { label: "Net Impact", val: `?${(parseFloat(s.total_surplus_value||0) - parseFloat(s.total_shortage_value||0)).toFixed(2)}`,
                          color: parseFloat(s.total_surplus_value||0) >= parseFloat(s.total_shortage_value||0) ? COLORS.success : COLORS.coral },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 18px", minWidth: 100 }}>
                          <p style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>{label}</p>
                          <p style={{ fontSize: 18, fontWeight: 700, color }}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {s.notes && <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12, fontStyle: "italic" }}>?? {s.notes}</p>}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          {["Item", "SKU", "Adjustment", "Unit", "? Impact", "Reason", "Notes"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: COLORS.muted, fontWeight: 500, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.adjustments.map((adj) => (
                          <tr key={adj.id} style={{ borderBottom: `1px solid ${COLORS.border}11` }}>
                            <td style={{ padding: "7px 10px", color: COLORS.text }}>{adj.name}</td>
                            <td style={{ padding: "7px 10px", color: COLORS.teal, fontFamily: "monospace", fontSize: 11 }}>{adj.item_code}</td>
                            <td style={{ padding: "7px 10px", fontWeight: 700, color: adj.qty >= 0 ? COLORS.success : COLORS.coral }}>
                              {adj.qty >= 0 ? "+" : ""}{parseFloat(adj.qty).toFixed(2)}
                            </td>
                            <td style={{ padding: "7px 10px", color: COLORS.muted }}>{adj.unit}</td>
                            <td style={{ padding: "7px 10px", fontWeight: 600, color: adj.qty >= 0 ? COLORS.success : COLORS.coral }}>
                              {adj.qty >= 0 ? "+" : ""}?{(parseFloat(adj.qty) * parseFloat(adj.price || 0)).toFixed(2)}
                            </td>
                            <td style={{ padding: "7px 10px", color: COLORS.muted }}>{adj.reason}</td>
                            <td style={{ padding: "7px 10px", color: COLORS.muted, fontSize: 11 }}>{adj.notes || "�"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
