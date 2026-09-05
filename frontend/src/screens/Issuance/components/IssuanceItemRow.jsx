import KplCodeBadge from "../../../components/KplCodeBadge";
import { COLORS } from "../../../styles/colors";
import { Lock, Square, CheckSquare2, ShieldCheck } from "lucide-react";

const UNIT_OPTIONS = ["kg", "g", "L", "ml", "pcs", "dozen", "box", "bottle", "pkt", "tin", "jar", "bulk"];

export default function IssuanceItemRow({
  idx,
  item,
  available,
  issueQty,
  onQtyChange,
  isConfirmed = false,
  onToggleConfirm = () => {},
  onUnitChange = null,
  unitPrice = 0,
  cost = 0,
  baseUnit = "kg",
}) {
  const numQty = parseFloat(issueQty) || 0;
  const numAvail = parseFloat(available) || 0;
  const isInsufficient = numAvail < numQty;
  const isMismatch = cost === null;
  // Unit is editable only when the item is matched to real stock (has item_code)
  // and not yet confirmed. Fixing it here persists to the stock's base unit.
  const canEditUnit = !!onUnitChange && !isConfirmed && item.item_code && item.item_code !== "KPL-NEW";

  // Cost mismatch is informational only (display can't convert unit → price),
  // it must never block confirming — backend re-validates the real unit
  // conversion at issuance time and throws a clear error if truly incompatible.
  // A permanent, unrecoverable-without-master-data-edit lock here was trapping
  // whole indents that had even one item with a stale/mismatched unit.
  const isDisableConfirm = numAvail <= 0;

  return (
    <tr
      style={{
        backgroundColor: isConfirmed ? "rgba(16, 185, 129, 0.04)" : idx % 2 === 0 ? "#ffffff" : "#fafafa",
        transition: "background-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = isConfirmed ? "rgba(16, 185, 129, 0.08)" : "#f0f9ff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isConfirmed ? "rgba(16, 185, 129, 0.04)" : idx % 2 === 0 ? "#ffffff" : "#fafafa";
      }}
    >
      {/* ShieldCheck */}
      <td style={tdStyle({ width: 24, textAlign: "center" })}>
        {isConfirmed && (
          <ShieldCheck size={13} style={{ color: "#10B981" }} />
        )}
      </td>

      {/* # */}
      <td style={tdStyle({ width: 40, textAlign: "center", color: COLORS.muted })}>
        {idx + 1}
      </td>

      {/* ITEM CODE */}
      <td style={tdStyle({ width: 100 })}>
        <KplCodeBadge code={item.item_code} />
      </td>

      {/* ITEM NAME */}
      <td style={tdStyle({ fontWeight: 500, color: COLORS.text })}>
        {item.name}
      </td>

      {/* QTY (requested) */}
      <td style={tdStyle({ width: 70, color: COLORS.muted })}>
        {item.qty}
      </td>

      {/* ISSUE QTY — editable input */}
      <td style={tdStyle({ width: 95 })}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
          <input
            type="number"
            value={issueQty}
            onChange={(e) => onQtyChange(idx, e.target.value)}
            disabled={isConfirmed}
            readOnly={isConfirmed}
            title={isInsufficient ? `Only ${numAvail} available` : ""}
            style={{
              width: "100%",
              padding: isConfirmed ? "5px 24px 5px 8px" : "5px 8px",
              borderRadius: 6,
              border: `1.5px solid ${
                isConfirmed ? "#E5E7EB" : isInsufficient ? "#ef4444" : "#e2e8f0"
              }`,
              backgroundColor: isConfirmed ? "#F9FAFB" : isInsufficient ? "#fff5f5" : "#ffffff",
              color: isConfirmed ? "#9CA3AF" : COLORS.text,
              fontSize: 13,
              outline: "none",
              cursor: isConfirmed ? "not-allowed" : "text",
              transition: "all 0.15s",
            }}
            onFocus={(e) => {
              if (!isConfirmed) {
                e.target.style.borderColor = isInsufficient ? "#ef4444" : "#3b82f6";
              }
            }}
            onBlur={(e) => {
              if (!isConfirmed) {
                e.target.style.borderColor = isInsufficient ? "#ef4444" : "#e2e8f0";
              }
            }}
          />
          {isConfirmed && (
            <div
              style={{
                position: "absolute",
                right: 8,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9CA3AF",
              }}
            >
              <Lock size={12} />
            </div>
          )}
        </div>
      </td>

      {/* UNIT — editable dropdown to fix a mismatch; persists to stock base unit */}
      <td style={tdStyle({ width: 88, color: COLORS.muted })}>
        {canEditUnit ? (
          <select
            value={item.unit || "kg"}
            onChange={(e) => onUnitChange(idx, e.target.value)}
            title={isMismatch ? "Unit mismatch — pick the correct unit. Saves to stock." : "Change unit (saves to stock)"}
            style={{
              width: "100%",
              padding: "4px 6px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              color: COLORS.text,
              backgroundColor: isMismatch ? "#fff7ed" : "#ffffff",
              border: `1.5px solid ${isMismatch ? "#f59e0b" : "#e2e8f0"}`,
              outline: "none",
            }}
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        ) : (
          item.unit || "kg"
        )}
      </td>

      {/* PRICE */}
      <td style={tdStyle({ width: 80, color: COLORS.muted })}>
        ₹{unitPrice.toFixed(2)} / {baseUnit}
      </td>

      {/* COST */}
      <td style={tdStyle({ width: 90, fontWeight: 600, color: COLORS.accent })}>
        {cost !== null ? `₹${cost.toFixed(2)}` : <span style={{ color: COLORS.danger, fontSize: 11, cursor: "help" }} title={`Cannot convert ${item.unit} to ${baseUnit}. Update base unit in Master Data or fix indent unit.`}>⚠ Mismatch</span>}
      </td>

      {/* ✓ (CONFIRMED) CHECKBOX */}
      <td
        style={tdStyle({ width: 80, textAlign: "center" })}
      >
        <button
          type="button"
          aria-label="Confirm item"
          onClick={isDisableConfirm ? undefined : () => onToggleConfirm(idx)}
          disabled={isConfirmed}
          aria-disabled={isDisableConfirm ? "true" : "false"}
          title={
            isConfirmed 
              ? "Item confirmed — cannot be undone. Use Issue & Update Stock to submit." 
              : cost === null
                ? `Cannot convert ${item.unit} to ${baseUnit || "kg"}. Please update the item base unit in Master Data or fix the indent unit.`
                : numAvail <= 0 
                  ? "Cannot confirm — item is out of stock" 
                  : "Confirm item"
          }
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: isDisableConfirm ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            outline: "none",
            color: isConfirmed ? "#10B981" : "#cbd5e1",
            opacity: numAvail <= 0 && !isConfirmed ? 0.35 : 1,
            pointerEvents: isConfirmed ? "none" : "auto",
            transition: isDisableConfirm ? "none" : "transform 0.1s active",
          }}
          onMouseDown={isDisableConfirm ? undefined : (e) => e.currentTarget.style.transform = "scale(0.95)"}
          onMouseUp={isDisableConfirm ? undefined : (e) => e.currentTarget.style.transform = "scale(1)"}
        >
          {isConfirmed ? (
            <CheckSquare2 size={18} style={{ fill: "#10B981", color: "#ffffff" }} />
          ) : (
            <Square size={18} />
          )}
        </button>
      </td>

      {/* AVAIL — colour-coded exactly like Indent's AVAIL column */}
      <td style={tdStyle({ width: 110 })}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            fontWeight: 600,
            color: isInsufficient ? "#ef4444" : "#16a34a",
            backgroundColor: isInsufficient ? "#fef2f2" : "#f0fdf4",
            padding: "3px 10px",
            borderRadius: 20,
            whiteSpace: "nowrap",
          }}
        >
          {isInsufficient ? "⚠" : "✓"} {numAvail} available
        </span>
      </td>
    </tr>
  );
}

function tdStyle(extra = {}) {
  return {
    padding: "12px 14px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
    ...extra,
  };
}
