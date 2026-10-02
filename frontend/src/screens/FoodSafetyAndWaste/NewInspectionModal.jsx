import React, { useState } from "react";
import { COLORS } from "../../styles/colors";
import { foodSafety } from "../../api";
import { ShieldCheck, Thermometer, AlertCircle, X, Check, Clock } from "lucide-react";

export default function NewInspectionModal({ isOpen, onClose, onSuccess }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [inspectionDate, setInspectionDate] = useState(todayStr);
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [category, setCategory] = useState("DAIRY");
  const [supplierName, setSupplierName] = useState("");
  const [challanNumber, setChallanNumber] = useState("");
  const [receivingTemp, setReceivingTemp] = useState("");
  const [tempMax, setTempMax] = useState("4.0");
  const [packagingSeal, setPackagingSeal] = useState("INTACT");
  const [sensoryRating, setSensoryRating] = useState("EXCELLENT");
  const [status, setStatus] = useState("PASSED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionTaken, setActionTaken] = useState("Accepted into Cold Storage");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    if (cat === "DAIRY") setTempMax("4.0");
    else if (cat === "POULTRY_MEAT" || cat === "SEAFOOD") setTempMax("-18.0");
    else if (cat === "VEGETABLES_FRUITS") setTempMax("15.0");
    else setTempMax("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setError("Item name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await foodSafety.createInspection({
        inspection_date: inspectionDate,
        item_name: itemName.trim(),
        item_code: itemCode.trim() || null,
        category,
        supplier_name: supplierName.trim() || null,
        challan_number: challanNumber.trim() || null,
        receiving_temp_c: receivingTemp !== "" ? parseFloat(receivingTemp) : null,
        temp_threshold_max_c: tempMax !== "" ? parseFloat(tempMax) : null,
        packaging_seal: packagingSeal,
        sensory_rating: sensoryRating,
        status,
        rejection_reason: rejectionReason.trim() || null,
        action_taken: actionTaken.trim()
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save receiving quality inspection");
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
        maxWidth: "680px",
        maxHeight: "92vh",
        overflowY: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        color: "var(--text-main)"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 22px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(16, 185, 129, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#34D399"
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>
                Log HACCP Food Receiving Inspection
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                Verify raw material temperature, packaging seals, sensory quality, and FSSAI expiry
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            margin: "14px 22px 0",
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

        <form onSubmit={handleSubmit} style={{ padding: "20px 22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Food Category *
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
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
                <option value="DAIRY">Dairy & Milk (Chilled ≤ 4°C)</option>
                <option value="POULTRY_MEAT">Poultry & Meat (Frozen ≤ -18°C)</option>
                <option value="SEAFOOD">Seafood & Fish (Chilled on Ice ≤ 4°C)</option>
                <option value="VEGETABLES_FRUITS">Fresh Fruits & Vegetables (Ambient/Cool)</option>
                <option value="STAPLES_GROCERY">Dry Staples, Grains & Pulses</option>
                <option value="COOKING_OIL">Edible Cooking Oils & Fats</option>
                <option value="PACKAGED_GOODS">Packaged & Canned Goods</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Inspection Date *
              </label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
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
                Item Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Fresh Malai Paneer Blocks"
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

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Supplier / Vendor Name
              </label>
              <input
                type="text"
                placeholder="e.g. Vijaya Fresh Dairy"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
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
                Delivery Challan (DC) #
              </label>
              <input
                type="text"
                placeholder="e.g. DC-1082"
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
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
                SKU / Item Code
              </label>
              <input
                type="text"
                placeholder="e.g. PAN-001"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
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
          </div>

          {/* Temperature & Sensory Check */}
          <div style={{
            marginTop: "16px",
            padding: "14px",
            background: "rgba(59, 130, 246, 0.05)",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            borderRadius: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Thermometer size={16} color="#60A5FA" />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#60A5FA" }}>
                HACCP Temperature & Sensory Inspection
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Delivery Temp (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 3.5"
                  value={receivingTemp}
                  onChange={(e) => setReceivingTemp(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Max Safe Temp (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 4.0"
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Packaging & Seal
                </label>
                <select
                  value={packagingSeal}
                  onChange={(e) => setPackagingSeal(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                >
                  <option value="INTACT">INTACT (Clean)</option>
                  <option value="TORN">TORN (Compromised)</option>
                  <option value="LEAKING">LEAKING (Defective)</option>
                  <option value="DIRTY">DIRTY (Unsanitary)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Sensory Quality
                </label>
                <select
                  value={sensoryRating}
                  onChange={(e) => setSensoryRating(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                >
                  <option value="EXCELLENT">EXCELLENT (Fresh)</option>
                  <option value="GOOD">GOOD (Acceptable)</option>
                  <option value="ACCEPTABLE">ACCEPTABLE</option>
                  <option value="REJECTED">REJECTED (Off-Odor/Color)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status and Action */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Inspection Verdict *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: status === "PASSED" ? "#34D399" : "#F87171",
                  fontSize: "13px",
                  fontWeight: "700"
                }}
              >
                <option value="PASSED">PASSED (HACCP Compliant)</option>
                <option value="CONDITIONALLY_ACCEPTED">CONDITIONALLY ACCEPTED</option>
                <option value="REJECTED">REJECTED (Immediate RTV)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Action Taken / Destination
              </label>
              <input
                type="text"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
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
          </div>

          {/* Rejection reason */}
          {status === "REJECTED" && (
            <div style={{ marginTop: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#F87171", marginBottom: "4px" }}>
                Rejection Reason *
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Milk arrived at 11.5°C; cold chain broken during transit. Consignment returned."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px",
                  resize: "vertical"
                }}
              />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 16px",
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
                padding: "9px 20px",
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
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
              {loading ? "Recording..." : "Save Inspection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
