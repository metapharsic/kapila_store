import { useState } from "react";
import IssuanceItemRow from "./IssuanceItemRow";
import { COLORS } from "../../../styles/colors";
import { ClipboardList, CheckSquare, CheckCircle, X } from "lucide-react";
import { calculateNormalizedQty } from "../../../utils/units";
import MultiAgentStatusBar from "../../../components/MultiAgentStatusBar";
import LIFOSuggestionBanner from "../../../components/LIFOSuggestionBanner";

const TH = ({ children, style = {}, ...rest }) => (
  <th
    style={{
      padding: "11px 14px", fontSize: 11, fontWeight: 600, color: COLORS.muted,
      textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left",
      backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap",
      ...style,
    }}
    {...rest}
  >
    {children}
  </th>
);

export default function IssuanceItemsGrid({
  selectedIndent, issueQtys, availableStock, onQtyChange,
  confirmedItems = new Set(), onToggleConfirm = () => {}, onToggleAll = () => {},
  onIssue, onSelectIndent, isMobile = false,
  stocks, getItemPrice, getItemBaseUnit, onUnitChange, msg,
  onApprove, approving, isStoreManager,
}) {
  const [inspectedItemIdx, setInspectedItemIdx] = useState(0);
  const items = selectedIndent?.items || [];
  const totalItems = items.length;
  const confirmedCount = confirmedItems ? confirmedItems.size : 0;

  // Availability keyed by item_code (reliable) with name fallback (legacy indents).
  // availableStock is always in the STOCK's base unit — the issue line can be
  // in a different unit (e.g. stock in kg, issuing in g). Convert available
  // into the line's unit before comparing/displaying, else "23.9 kg available"
  // reads as "23.9 available" against a 500 g request and falsely flags low stock.
  const availOf = (it) => {
    const raw = it.item_code && availableStock[it.item_code] != null
      ? parseFloat(availableStock[it.item_code]) || 0
      : parseFloat(availableStock[it.name?.toLowerCase()]) || 0;
    const baseUnit = getItemBaseUnit ? getItemBaseUnit(it.name, it.item_code) : "kg";
    const converted = calculateNormalizedQty(raw, baseUnit, it.unit);
    return converted !== null ? converted : raw;
  };

  const needAttentionCount = items.filter((it, idx) => {
    const avail = availOf(it);
    const req = parseFloat(issueQtys[idx] ?? it.qty) || 0;
    return avail < req;
  }).length;

  const EmptyState = () => (
    <div style={{ padding: "64px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <ClipboardList size={40} color="#cbd5e1" />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: COLORS.text }}>No indent selected</p>
      <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>Select an indent from the list to view its items.</p>
    </div>
  );

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, backgroundColor: "#ffffff", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Header */}
      {selectedIndent && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: COLORS.text }}>
              {selectedIndent.dept}
            </span>
            <span style={{ fontSize: 11, color: COLORS.muted }}>{selectedIndent.date}</span>
            {(() => {
              const isAdhoc = (selectedIndent.indent_type || "routine") === "adhoc";
              return (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 10px", borderRadius: 20,
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
                  background: isAdhoc ? "#FEF3C7" : "#D1FAE5",
                  color: isAdhoc ? "#92400E" : "#065F46",
                  border: `1px solid ${isAdhoc ? "#FCD34D" : "#6EE7B7"}`,
                  whiteSpace: "nowrap",
                }}>
                  {isAdhoc ? "⚡ Ad-Hoc" : "✓ Routine"}
                </span>
              );
            })()}
            {selectedIndent.status === "pending" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 10px", borderRadius: 20,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
                background: "#FEF3C7", color: "#92400E",
                border: "1px solid #FCD34D", whiteSpace: "nowrap",
              }}>
                ⏳ Pending Review
              </span>
            )}
            {selectedIndent.status === "approved" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 10px", borderRadius: 20,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
                background: "#D1FAE5", color: "#065F46",
                border: "1px solid #6EE7B7", whiteSpace: "nowrap",
              }}>
                ✓ Approved
              </span>
            )}
          </div>
          {onSelectIndent && (
            <button
              onClick={() => onSelectIndent(null)}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: COLORS.muted, fontSize: 12, display: "flex", alignItems: "center", gap: 4, fontWeight: 600, minHeight: 36 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.brandLight; e.currentTarget.style.color = COLORS.brandDark; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = COLORS.muted; }}
            >
              Exit <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Multi-Agent Swarm & LIFO Dispatch Advisory ── */}
      {selectedIndent && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
          <MultiAgentStatusBar
            compact
            customNote="LIFO Dispatch Strategy active: evaluating available batches by freshest inward receipt"
          />
          {items.length > 0 && items[inspectedItemIdx] && (
            <div style={{ marginTop: 8 }}>
              <LIFOSuggestionBanner
                compact
                itemName={items[inspectedItemIdx].name}
                itemCode={items[inspectedItemIdx].item_code}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!selectedIndent ? (
          <EmptyState />
        ) : items.length === 0 ? (
          <p style={{ color: COLORS.muted, textAlign: "center", padding: 40, fontSize: 13 }}>This indent has no items.</p>
        ) : isMobile ? (
          /* ── Mobile: item cards ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 12px 80px 12px" }}>
            {items.map((it, idx) => {
              const available = availOf(it);
              const issueQty  = parseFloat(issueQtys[idx] ?? it.qty) || 0;
              const isLow     = available < issueQty;
              const isConf    = confirmedItems.has(idx);
              const unitPrice = getItemPrice ? getItemPrice(it.name, it.item_code) : 0;
              const baseUnit = getItemBaseUnit ? getItemBaseUnit(it.name, it.item_code) : "kg";
              const normalizedQty = calculateNormalizedQty(issueQty, it.unit, baseUnit);
              const cost = normalizedQty !== null ? normalizedQty * unitPrice : null;

              return (
                <div 
                  key={idx} 
                  onClick={() => setInspectedItemIdx(idx)}
                  style={{
                    background: inspectedItemIdx === idx ? "rgba(244, 200, 75, 0.08)" : isConf ? (COLORS.success + "08") : "#fff",
                    border: `1.5px solid ${inspectedItemIdx === idx ? "var(--color-gold, #f4c84b)" : isConf ? COLORS.success + "33" : (isLow ? COLORS.danger + "44" : "#e2e8f0")}`,
                    borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, cursor: "pointer",
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 9, color: COLORS.accent, display: "block", fontWeight: 700, marginBottom: 2, letterSpacing: "0.05em" }}>{it.item_code || "KPL"}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, display: "block" }}>{it.name}</span>
                      <span style={{ fontSize: 11, color: COLORS.muted }}>{it.unit || "kg"} · Requested: {it.qty}</span>
                      <span style={{ fontSize: 11, color: COLORS.muted, display: "block", marginTop: 2 }}>
                        Price: ₹{unitPrice.toFixed(2)} / {baseUnit} | Cost: {cost !== null ? `₹${cost.toFixed(2)}` : <span style={{ color: COLORS.danger }} title={`Cannot convert ${it.unit} to ${baseUnit}. Please update the item base unit in Master Data or change the indent unit.`}>⚠ Unit Mismatch</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => onToggleConfirm(idx)}
                      style={{
                        flexShrink: 0, padding: "6px 10px", borderRadius: 8,
                        border: `1.5px solid ${isConf ? COLORS.success : "#e2e8f0"}`,
                        background: isConf ? (COLORS.success + "15") : "#f8fafc",
                        color: isConf ? COLORS.success : COLORS.muted,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, minHeight: 40, minWidth: 40, justifyContent: "center",
                      }}
                    >
                      <CheckCircle size={16} />
                    </button>
                  </div>

                  {/* Issue qty row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, flexShrink: 0 }}>Issue Qty</label>
                    <input
                      type="number"
                      value={issueQtys[idx] ?? it.qty}
                      onChange={(e) => onQtyChange(idx, e.target.value)}
                      min="0" step="0.01"
                      style={{
                        flex: 1, padding: "8px 12px", fontSize: 15, fontWeight: 700, color: COLORS.text,
                        border: `1px solid ${isLow ? COLORS.danger : COLORS.border}`,
                        borderRadius: 8, background: "#f8fafc", outline: "none", minHeight: 44,
                      }}
                    />
                    <span style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 600,
                      color: isLow ? COLORS.danger : COLORS.success,
                      padding: "3px 8px", borderRadius: 6,
                      background: isLow ? (COLORS.danger + "12") : (COLORS.success + "12"),
                    }}>
                      {isLow ? `⚠ Low (${available})` : `✓ ${available} avail`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Desktop: full table ── */
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
              <tr>
                <TH style={{ width: 24, textAlign: "center" }}></TH>
                <TH style={{ width: 40, textAlign: "center" }}>#</TH>
                <TH style={{ width: 100 }}>Item Code</TH>
                <TH>Item Name</TH>
                <TH style={{ width: 70 }}>QTY</TH>
                <TH style={{ width: 100 }}>Issue QTY</TH>
                <TH style={{ width: 70 }}>Unit</TH>
                <TH style={{ width: 80 }}>Price</TH>
                <TH style={{ width: 90 }}>Cost</TH>
                <TH style={{ width: 80, textAlign: "center", cursor: "pointer" }} onClick={onToggleAll}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <CheckSquare size={14} style={{ display: "inline-block", verticalAlign: "middle" }} />
                    <span style={{ fontSize: 9 }}>ALL</span>
                  </div>
                </TH>
                <TH style={{ width: 140 }}>Avail</TH>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const available = availOf(it);
                const issueQty = issueQtys[idx] ?? it.qty;
                const unitPrice = getItemPrice ? getItemPrice(it.name, it.item_code) : 0;
                const baseUnit = getItemBaseUnit ? getItemBaseUnit(it.name, it.item_code) : "kg";
                const normalizedQty = calculateNormalizedQty(issueQty, it.unit, baseUnit);
                const cost = normalizedQty !== null ? normalizedQty * unitPrice : null;
                return (
                  <IssuanceItemRow
                    key={idx} idx={idx} item={it} available={available}
                    issueQty={issueQty} onQtyChange={onQtyChange}
                    isConfirmed={confirmedItems.has(idx)} onToggleConfirm={onToggleConfirm}
                    onUnitChange={onUnitChange}
                    unitPrice={unitPrice} cost={cost} baseUnit={baseUnit}
                    onInspect={setInspectedItemIdx}
                    isInspected={inspectedItemIdx === idx}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Stats footer */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid #e2e8f0", backgroundColor: "#fafafa", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, fontSize: 13, flexShrink: 0 }}>
        {needAttentionCount > 0 && (
          <span style={{ color: "#ef4444", fontWeight: 600 }}>⚠ {needAttentionCount} need attention</span>
        )}
        <span style={{ color: COLORS.muted, fontWeight: 500 }}>
          Total Cost: <strong style={{ color: COLORS.text }}>₹{items.reduce((sum, it, idx) => {
            const issueQty = parseFloat(issueQtys[idx] ?? it.qty) || 0;
            const price = getItemPrice ? getItemPrice(it.name, it.item_code) : 0;
            const baseUnit = getItemBaseUnit ? getItemBaseUnit(it.name, it.item_code) : "kg";
            const normalized = calculateNormalizedQty(issueQty, it.unit, baseUnit);
            if (normalized === null) return sum; // Skip items with unit mismatch
            return sum + normalized * price;
          }, 0).toFixed(2)}</strong>
        </span>
        <span style={{ color: COLORS.muted, fontWeight: 500 }}>
          Total items: <strong style={{ color: COLORS.text }}>{totalItems}</strong>
        </span>
      </div>

      {/* Issue action footer */}
      {selectedIndent && (
        <div style={{
          padding: isMobile ? "12px 16px" : "16px 20px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexShrink: 0,
        }}>
          <div>
            {confirmedCount > 0 && (
              <span style={{ color: COLORS.muted, fontSize: 13, fontWeight: 500 }}>
                {confirmedCount} of {totalItems} items confirmed
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {msg && (
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: msg.startsWith("Error") ? "#dc2626" : "#16a34a",
                whiteSpace: "nowrap",
              }}>
                {msg}
              </span>
            )}
            {selectedIndent.status === "pending" ? (
              <button
                type="button"
                onClick={onApprove}
                disabled={approving}
                style={{
                  height: isMobile ? 48 : 40,
                  padding: isMobile ? "0 20px" : "0 24px",
                  flex: isMobile ? 1 : "unset",
                  backgroundColor: "#e8a838",
                  color: "#18181b",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: approving ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 2px 8px rgba(232, 168, 56, 0.35)",
                }}
              >
                <CheckCircle size={16} />
                <span>{approving ? "Approving Requisition..." : "Approve Indent & Enable Issuance"}</span>
              </button>
            ) : (
              <button
                onClick={onIssue}
                disabled={confirmedCount === 0}
                style={{
                  height: isMobile ? 48 : 40,
                  padding: isMobile ? "0 20px" : "0 24px",
                  flex: isMobile ? 1 : "unset",
                  backgroundColor: "#111827", opacity: confirmedCount > 0 ? 1 : 0.5,
                  color: "#ffffff", border: "none", borderRadius: 8,
                  fontSize: 14, fontWeight: 700, cursor: confirmedCount > 0 ? "pointer" : "not-allowed",
                  transition: "all 0.15s", letterSpacing: "0.01em",
                }}
              >
                Issue &amp; Update Stock
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
