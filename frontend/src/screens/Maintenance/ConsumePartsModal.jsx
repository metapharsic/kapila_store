import React, { useState, useEffect } from "react";
import { X, Package, Plus, Trash2, CheckCircle } from "lucide-react";
import { stock } from "../../api";

export default function ConsumePartsModal({ isOpen, onClose, workOrder, onSubmit }) {
  const [availableStock, setAvailableStock] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [selectedParts, setSelectedParts] = useState([]);
  const [currentItemCode, setCurrentItemCode] = useState("");
  const [currentQty, setCurrentQty] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStoreStock();
      setSelectedParts([]);
    }
  }, [isOpen]);

  const loadStoreStock = async () => {
    setLoadingStock(true);
    try {
      const res = await stock.list({ limit: 500 });
      setAvailableStock(res.data || []);
      if (res.data && res.data.length > 0) {
        setCurrentItemCode(res.data[0].item_code);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingStock(false);
  };

  if (!isOpen || !workOrder) return null;

  const currentItem = availableStock.find(s => s.item_code === currentItemCode);

  const handleAddPart = () => {
    const qty = parseFloat(currentQty);
    if (!currentItem || isNaN(qty) || qty <= 0) return;

    if (qty > parseFloat(currentItem.remaining)) {
      alert(`Requested quantity (${qty}) exceeds current stock in store (${currentItem.remaining} ${currentItem.unit})`);
      return;
    }

    const existingIndex = selectedParts.findIndex(p => p.item_code === currentItem.item_code);
    if (existingIndex >= 0) {
      const updated = [...selectedParts];
      updated[existingIndex].qty += qty;
      setSelectedParts(updated);
    } else {
      setSelectedParts([
        ...selectedParts,
        {
          item_code: currentItem.item_code,
          name: currentItem.name,
          stock_id: currentItem.id,
          unit: currentItem.unit,
          unit_price: parseFloat(currentItem.price) || 0,
          qty,
          line_total: Math.round(qty * (parseFloat(currentItem.price) || 0) * 100) / 100
        }
      ]);
    }
    setCurrentQty("1");
  };

  const handleRemovePart = (index) => {
    setSelectedParts(selectedParts.filter((_, idx) => idx !== index));
  };

  const totalRequisitionCost = selectedParts.reduce((sum, p) => sum + (p.line_total || 0), 0);

  const handleSubmit = async () => {
    if (selectedParts.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedParts);
      onClose();
    } catch (err) {
      alert("Failed to consume parts: " + (err.message || "Error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid #334155", borderRadius: 12,
        width: "100%", maxWidth: 620, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #334155",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(59, 130, 246, 0.08)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "rgba(59, 130, 246, 0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6"
            }}>
              <Package size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                Requisition Store Spares & Consumables
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                WO: <span style={{ color: "#f59e0b", fontFamily: "monospace" }}>{workOrder.wo_number}</span> — {workOrder.asset_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            background: "var(--bg-modal)", border: "1px solid #334155", borderRadius: 8, padding: 14,
            display: "flex", flexDirection: "column", gap: 10
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Select Item From Store Stock
            </span>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 3, minWidth: 240 }}>
                <select
                  value={currentItemCode}
                  onChange={(e) => setCurrentItemCode(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--bg-card)",
                    border: "1px solid #475569", color: "var(--text-main)", fontSize: 13, outline: "none"
                  }}
                >
                  {availableStock.map((s) => (
                    <option key={s.id} value={s.item_code}>
                      [{s.item_code}] {s.name} (In Store: {s.remaining} {s.unit} @ ₹{parseFloat(s.price).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 90 }}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Qty"
                  value={currentQty}
                  onChange={(e) => setCurrentQty(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--bg-card)",
                    border: "1px solid #475569", color: "var(--text-main)", fontSize: 13, outline: "none"
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleAddPart}
                style={{
                  padding: "9px 16px", borderRadius: 8, background: "#3b82f6",
                  border: "none", color: "#ffffff", fontWeight: 600, fontSize: 13,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                }}
              >
                <Plus size={15} /> Add Part
              </button>
            </div>

            {currentItem && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 16 }}>
                <span>Unit: <strong>{currentItem.unit}</strong></span>
                <span>Rate: <strong>₹{parseFloat(currentItem.price || 0).toFixed(2)}</strong></span>
                <span>Remaining in Store: <strong style={{ color: "#10b981" }}>{currentItem.remaining} {currentItem.unit}</strong></span>
              </div>
            )}
          </div>

          {/* Selected parts list */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                PARTS TO CONSUME ({selectedParts.length})
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                Total Cost: ₹{totalRequisitionCost.toFixed(2)}
              </span>
            </div>

            {selectedParts.length === 0 ? (
              <div style={{
                padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13,
                border: "1px dashed #334155", borderRadius: 8
              }}>
                No spare parts added to this work order yet. Add items above to deduct from store inventory and record in the stock ledger.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedParts.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", background: "var(--bg-modal)", borderRadius: 8,
                      border: "1px solid #334155"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                        {p.item_code} • {p.qty} {p.unit} @ ₹{p.unit_price.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>
                        ₹{(p.line_total || 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePart(idx)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 2 }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid #334155",
          display: "flex", justifyContent: "flex-end", gap: 10, background: "rgba(15, 23, 42, 0.4)"
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px", borderRadius: 8, background: "transparent",
              border: "1px solid #334155", color: "var(--text-muted)", fontSize: 13, cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || selectedParts.length === 0}
            onClick={handleSubmit}
            style={{
              padding: "9px 20px", borderRadius: 8, background: "#10b981",
              border: "none", color: "#ffffff", fontWeight: 700, fontSize: 13,
              cursor: submitting || selectedParts.length === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6, opacity: selectedParts.length === 0 ? 0.5 : 1
            }}
          >
            <CheckCircle size={15} />
            {submitting ? "Deducting Stock..." : `Issue Spares (₹${totalRequisitionCost.toFixed(2)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
