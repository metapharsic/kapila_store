import React, { useState } from "react";
import { COLORS } from "../../styles/colors";
import { waste } from "../../api";
import { Trash2, AlertCircle, X, Check, Clock, IndianRupee } from "lucide-react";

const DEPARTMENTS = [
  "TIFFINS",
  "STAFF",
  "SI-MEALS",
  "NORTH INDIAN",
  "CHAT & SOFTY",
  "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL",
  "RESTAURANT",
  "ROOM SERVICE"
];

export default function LogFoodWasteModal({ isOpen, onClose, onSuccess }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [wasteDate, setWasteDate] = useState(todayStr);
  const [department, setDepartment] = useState("TIFFINS");
  const [wasteType, setWasteType] = useState("PREP_TRIMMING");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [disposalMethod, setDisposalMethod] = useState("Organic Composting Bin");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const totalCost = parseFloat(((parseFloat(qty) || 0) * (parseFloat(unitCost) || 0)).toFixed(2));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setError("Item description is required");
      return;
    }
    if (!qty || parseFloat(qty) <= 0) {
      setError("Please enter a valid quantity (> 0)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await waste.logWaste({
        waste_date: wasteDate,
        department,
        waste_type: wasteType,
        item_name: itemName.trim(),
        qty: parseFloat(qty),
        unit,
        unit_cost: parseFloat(unitCost) || 0,
        reason: reason.trim() || "Daily prep / discard log",
        disposal_method: disposalMethod
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to log food waste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px"
    }}>
      <div style={{
        background: "var(--bg-modal)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "14px",
        width: "100%",
        maxWidth: "600px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        color: "var(--text-main)"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#F87171"
            }}>
              <Trash2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>
                Log Daily Kitchen Food Waste
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                Track prep trimming, buffet discards, cooking mishaps, and financial cost impact
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            margin: "14px 20px 0",
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#FCA5A5",
            fontSize: "12px"
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: "18px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Department *
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Waste Date *
              </label>
              <input
                type="date"
                value={wasteDate}
                onChange={(e) => setWasteDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Waste Category *
              </label>
              <select
                value={wasteType}
                onChange={(e) => setWasteType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              >
                <option value="PREP_TRIMMING">PREP TRIMMING (Peeling, Roots, Fat Loss)</option>
                <option value="BUFFET_LEFTOVER_DISCARD">BUFFET DISCARD (Exceeded 4h Safe Window)</option>
                <option value="SPOILAGE_EXPIRED">SPOILAGE / EXPIRED (Storage Loss)</option>
                <option value="KITCHEN_BURNT_MISHAP">BURNT / MISHAP (Cooking Mistake)</option>
                <option value="PLATE_WASTE">PLATE WASTE (Returned from Tables)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Disposal Method
              </label>
              <select
                value={disposalMethod}
                onChange={(e) => setDisposalMethod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              >
                <option value="Organic Composting Bin">Organic Composting Bin</option>
                <option value="Biogas Plant Digester">Biogas Plant Digester</option>
                <option value="Pig Farm Livestock Feed">Pig Farm Livestock Feed</option>
                <option value="Municipal Waste Bin">Municipal Waste Bin</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
              Item Name / Description *
            </label>
            <input
              type="text"
              placeholder="e.g. Sambar & Rasam Buffet Leftovers or Onion Peeling Trimmings"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-main)",
                fontSize: "13px"
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Quantity Wasted *
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 5.0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  color: "var(--text-main)",
                  fontSize: "12px",
                  fontWeight: "600"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  color: "var(--text-main)",
                  fontSize: "12px"
                }}
              >
                <option value="kg">kg</option>
                <option value="ltr">ltr</option>
                <option value="portions">portions</option>
                <option value="pcs">pcs</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Unit Cost (₹)
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="e.g. 45.0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  color: "var(--text-main)",
                  fontSize: "12px"
                }}
              />
            </div>
          </div>

          {totalCost > 0 && (
            <div style={{
              marginTop: "12px",
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px"
            }}>
              <span style={{ color: "var(--text-muted)" }}>Estimated Financial Loss:</span>
              <span style={{ fontWeight: "700", color: "#F87171" }}>₹{totalCost.toFixed(2)}</span>
            </div>
          )}

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
              Reason & Preventive Action
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Lunch buffet exceeded 4 hours safe window; will reduce prep quantity for tomorrow."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-main)",
                fontSize: "13px",
                resize: "vertical"
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 18px",
                background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                border: "none",
                borderRadius: "8px",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: "700",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {loading ? <Clock size={15} /> : <Check size={15} />}
              {loading ? "Recording..." : "Log Waste"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
