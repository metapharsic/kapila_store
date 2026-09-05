import React from "react";
import { COLORS } from "../../styles/colors";
import { Edit3, CheckCircle } from "lucide-react";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import * as api from "../../api";

const QuickAdjustmentModal = ({
  adjustModalItem,
  setAdjustModalItem,
  adjustQty,
  setAdjustQty,
  adjustMinAlert,
  setAdjustMinAlert,
  adjustReason,
  setAdjustReason,
  adjustNotes,
  setAdjustNotes,
  load,
  refreshActiveTab,
  setMsg
}) => {
  if (!adjustModalItem) return null;

  const currentQty = parseFloat(adjustModalItem.remaining || 0);
  const targetQty = parseFloat(adjustQty) || 0;
  const delta = targetQty - currentQty;
  const isSurplus = delta > 0;
  
  const handleSaveAdjustment = async () => {
    try {
      await api.stock.update(adjustModalItem.id, {
        remaining: targetQty,
        min_alert_qty: adjustMinAlert.trim() === "" ? null : parseFloat(adjustMinAlert),
        reason: adjustReason,
        notes: adjustNotes.trim() === "" ? null : adjustNotes
      });
      setAdjustModalItem(null);
      load();
      refreshActiveTab();
      setMsg("Batch adjustments successfully applied ✓");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Error adjusting stock: " + e.message);
      setTimeout(() => setMsg(""), 4000);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.65)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: 24, width: 450, maxWidth: "90%",
        boxShadow: `0 8px 32px rgba(15, 23, 42, 0.15)`
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Edit3 size={18} /> Quick Stock Adjustment
        </h3>
        <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>
          Adjusting batch code <span style={{ color: COLORS.purple, fontWeight: "bold" }}>{adjustModalItem.item_code}</span> of <span style={{ color: COLORS.text, fontWeight: "bold" }}>{adjustModalItem.name}</span>.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>System Remaining</label>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: "8px 12px", borderRadius: 6, fontSize: 13, fontWeight: "bold", color: COLORS.text }}>
              {currentQty.toFixed(2)} {adjustModalItem.unit}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Original Quantity</label>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: "8px 12px", borderRadius: 6, fontSize: 13, color: COLORS.muted }}>
              {parseFloat(adjustModalItem.qty).toFixed(2)} {adjustModalItem.unit}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10, marginBottom: 16 }}>
          <Input 
            label={`Adjusted Remaining (${adjustModalItem.unit})`}
            type="number"
            step="0.01"
            value={adjustQty}
            onChange={(e) => setAdjustQty(e.target.value)}
            placeholder="0.00"
          />
          <Input 
            label="Min Alert Level"
            type="number"
            step="0.01"
            value={adjustMinAlert}
            onChange={(e) => setAdjustMinAlert(e.target.value)}
            placeholder="e.g. 5.0"
          />
        </div>

        {/* Real-time Delta visual feedback */}
        {delta !== 0 && (
          <div style={{
            background: isSurplus ? COLORS.teal + "11" : COLORS.coral + "11",
            border: `1px dashed ${isSurplus ? COLORS.teal : COLORS.coral}44`,
            borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 16,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span style={{ color: COLORS.muted }}>Reconciliation Delta:</span>
            <span style={{ fontWeight: "bold", color: isSurplus ? COLORS.success : COLORS.coral, fontSize: 13 }}>
              {isSurplus ? `+${delta.toFixed(2)}` : delta.toFixed(2)} {adjustModalItem.unit} ({isSurplus ? "Surplus / Ingress" : "Shrinkage / Waste"})
            </span>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Adjustment Reason</label>
          <select
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 12,
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.text, borderRadius: 6
            }}
          >
            <option value="Audit Correction">Audit Correction</option>
            <option value="Spoiled / Spilled">Spoiled / Spilled</option>
            <option value="Pest Damage">Pest Damage</option>
            <option value="Kitchen Theft">Kitchen Theft</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, display: "block", marginBottom: 4 }}>Audit Log Notes</label>
          <textarea
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
            placeholder="Provide supporting context for this adjustment..."
            rows={3}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 12,
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.text, borderRadius: 6, resize: "vertical"
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn 
            onClick={handleSaveAdjustment} 
            disabled={adjustQty.trim() === "" || isNaN(targetQty) || targetQty < 0}
            icon={<CheckCircle size={16} />}
            style={{ flex: 1 }}
          >
            Apply & Log Adjustment
          </Btn>
          <Btn variant="ghost" onClick={() => setAdjustModalItem(null)} style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}>
            Cancel
          </Btn>
        </div>

      </div>
    </div>
  );
};

export default QuickAdjustmentModal;
