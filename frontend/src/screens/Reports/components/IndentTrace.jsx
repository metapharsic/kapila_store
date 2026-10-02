import React, { useState, useCallback } from "react";
import { authedGet } from "../../../api/client";
import { COLORS } from "../../../styles/colors";
import { ClipboardList, CheckCircle, AlertTriangle, Clock, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

const STATUS_STYLE = {
  FULL:    { bg: "#dcfce7", color: "#166534", icon: "✓" },
  PARTIAL: { bg: "#fef9c3", color: "#854d0e", icon: "≈" },
  PENDING: { bg: "#fee2e2", color: "#991b1b", icon: "○" },
};

function FulfillmentBar({ pct }) {
  const color = pct >= 100 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

function ItemTraceRow({ item }) {
  const [open, setOpen] = useState(false);
  const st = STATUS_STYLE[item.status] || STATUS_STYLE.PENDING;
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", background: item.status === "FULL" ? "rgba(16,185,129,0.04)" : item.status === "PARTIAL" ? "rgba(245,158,11,0.04)" : "rgba(239,68,68,0.04)" }}>
        <span style={{ background: st.bg, color: st.color, fontWeight: 800, fontSize: 12, borderRadius: 4, padding: "2px 8px" }}>{st.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: COLORS.text }}>{item.name || item.item_code}</div>
          <div style={{ fontSize: 10, color: COLORS.muted }}>{item.item_code} · {item.unit}</div>
        </div>
        <div style={{ textAlign: "right", marginRight: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{item.total_issued} / {item.qty} {item.unit}</div>
          <FulfillmentBar pct={item.fulfillment_pct} />
        </div>
        {open ? <ChevronDown size={14} color={COLORS.muted} /> : <ChevronRight size={14} color={COLORS.muted} />}
      </div>

      {open && (
        <div style={{ padding: "0 14px 14px", background: "#fafafa" }}>
          {/* Issuance lines */}
          {item.issued_lines?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 6, letterSpacing: "0.08em" }}>ISSUANCE RECORDS</div>
              {item.issued_lines.map((iss, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 11, padding: "4px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: "#10b981", fontWeight: 700 }}>↗ {iss.qty_issued} {iss.unit}</span>
                  <span>{iss.dept}</span>
                  <span style={{ color: COLORS.muted }}>{iss.date}</span>
                  <span style={{ color: COLORS.muted }}>by {iss.issued_by || "—"}</span>
                </div>
              ))}
            </div>
          )}

          {/* Ledger deductions */}
          {item.ledger_lines?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 6, letterSpacing: "0.08em" }}>LEDGER DEDUCTIONS</div>
              {item.ledger_lines.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 11, padding: "4px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>↙ {l.qty} {l.unit}</span>
                  <span style={{ color: COLORS.muted }}>{l.balance_qty_before} → {l.balance_qty_after}</span>
                  <span style={{ color: COLORS.muted }}>Batch: {l.batch_no || "—"}</span>
                  <span style={{ color: COLORS.muted }}>{l.created_at?.slice(0, 16)}</span>
                </div>
              ))}
            </div>
          )}

          {item.issued_lines?.length === 0 && item.ledger_lines?.length === 0 && (
            <div style={{ fontSize: 11, color: COLORS.muted, padding: "10px 0" }}>No issuance or ledger records found for this item on the indent date.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IndentTrace({ dimensions, onAgentUpdate }) {
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchId, setSearchId] = useState("");

  const indents = dimensions?.indents || [];

  const loadTrace = useCallback(async (indent) => {
    setSelectedIndent(indent);
    setData(null);
    setError(null);
    setLoading(true);

    const t0 = Date.now();

    onAgentUpdate?.("sentinel", { status: "done" });
    onAgentUpdate?.("scout",    { status: "done" });
    onAgentUpdate?.("indent",   { status: "running" });
    onAgentUpdate?.("ledger",   { status: "running" });
    onAgentUpdate?.("composer", { status: "running" });

    try {
      const res = await authedGet(`/api/reports/indent-trace/${indent.id}`);
      const elapsed = Date.now() - t0;

      if (!res.success) throw new Error(res.error || "Failed");

      onAgentUpdate?.("indent",   { status: "done", count: res.data.trace?.length || 0, ms: elapsed });
      onAgentUpdate?.("ledger",   { status: "done", count: res.data.trace?.reduce((a, i) => a + (i.ledger_lines?.length || 0), 0) });
      onAgentUpdate?.("tracer",   { status: "done" });
      onAgentUpdate?.("pogrn",    { status: "idle" });
      onAgentUpdate?.("composer", { status: "done", ms: elapsed });

      setData(res.data);
    } catch (e) {
      setError(e.message);
      onAgentUpdate?.("indent",   { status: "error", error: e.message });
      onAgentUpdate?.("ledger",   { status: "error" });
      onAgentUpdate?.("composer", { status: "error" });
    } finally {
      setLoading(false);
    }
  }, [onAgentUpdate]);

  const filteredIndents = searchId
    ? indents.filter(i => String(i.id).includes(searchId) || i.dept?.toLowerCase().includes(searchId.toLowerCase()))
    : indents;

  return (
    <div style={{ height: "100%", display: "flex", gap: 16 }}>
      {/* Indent list panel */}
      <div style={{ width: 240, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
          <input
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            placeholder="Filter by ID or dept…"
            style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 12, boxSizing: "border-box" }}
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filteredIndents.map(ind => (
            <button key={ind.id} onClick={() => loadTrace(ind)} style={{
              width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start",
              padding: "9px 12px", border: "none", borderBottom: `1px solid ${COLORS.border}`,
              background: selectedIndent?.id === ind.id ? "#18181b" : "transparent",
              cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: selectedIndent?.id === ind.id ? "#f4c84b" : COLORS.text }}>Indent #{ind.id}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                  background: ind.status === "Approved" ? "#dcfce7" : ind.status === "Pending" ? "#fef9c3" : "#f1f5f9",
                  color: ind.status === "Approved" ? "#166534" : ind.status === "Pending" ? "#854d0e" : "#475569" }}>
                  {ind.status}
                </span>
              </div>
              <span style={{ fontSize: 10, color: selectedIndent?.id === ind.id ? "#71717a" : COLORS.muted }}>{ind.dept}</span>
              <span style={{ fontSize: 9, color: selectedIndent?.id === ind.id ? "#52525b" : COLORS.muted }}>{ind.date}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Trace panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0, overflowY: "auto" }}>
        {!selectedIndent && !loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: COLORS.muted }}>
            <ClipboardList size={48} strokeWidth={1} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Select an indent to trace</div>
            <div style={{ fontSize: 12, textAlign: "center", maxWidth: 340 }}>See every line item's fulfillment: what was requested, what was issued, and which stock batches were deducted</div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>◎</div>
            <div>Tracing Indent #{selectedIndent?.id} for <strong>{selectedIndent?.dept}</strong>…</div>
          </div>
        )}

        {error && <div style={{ background: "#FEF2F2", border: "1px solid #fecaca", borderRadius: 8, padding: 14, color: "#991b1b", display: "flex", gap: 8 }}><AlertCircle size={16} />{error}</div>}

        {data && !loading && (
          <>
            {/* Indent header */}
            <div style={{ background: "#18181b", borderRadius: 12, padding: "14px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <ClipboardList size={28} color="#f4c84b" />
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Indent #{data.indent?.id} — {data.indent?.dept}</div>
                <div style={{ fontSize: 11, color: "#71717a" }}>{data.indent?.date} · Status: {data.indent?.status}</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>{data.summary?.overall_fulfillment_pct}% fulfilled</div>
                <div style={{ fontSize: 10, color: "#71717a" }}>{data.summary?.full_items} full · {data.summary?.partial_items} partial · {data.summary?.pending_items} pending</div>
              </div>
            </div>

            {/* Summary pills */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Total Items", value: data.summary?.total_items, color: COLORS.text },
                { label: "Fully Issued", value: data.summary?.full_items, color: "#10b981" },
                { label: "Partial", value: data.summary?.partial_items, color: "#f59e0b" },
                { label: "Pending", value: data.summary?.pending_items, color: "#ef4444" },
                { label: "Requested", value: `${data.summary?.total_requested}`, color: "#3b82f6" },
                { label: "Issued", value: `${data.summary?.total_issued}`, color: "#8b5cf6" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: COLORS.muted }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Overall fulfillment bar */}
            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Overall Fulfillment</span>
                <span style={{ fontSize: 12, color: COLORS.muted }}>{data.summary?.total_issued} / {data.summary?.total_requested} units</span>
              </div>
              <FulfillmentBar pct={data.summary?.overall_fulfillment_pct || 0} />
            </div>

            {/* Item-by-item trace */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Line Item Trace ({data.trace?.length || 0} items)</div>
              {(data.trace || []).map((item, i) => <ItemTraceRow key={i} item={item} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
