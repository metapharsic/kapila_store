import React, { useState } from "react";
import { COLORS } from "../../styles/colors";
import { security } from "../../api";
import { Shield, Truck, AlertCircle, X, Check, Clock, User, FileText, Phone } from "lucide-react";

export default function NewGatePassModal({ isOpen, onClose, onSuccess }) {
  const [passType, setPassType] = useState("INWARD_MATERIAL");
  const [vehicleType, setVehicleType] = useState("TEMPO");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [challanNumber, setChallanNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  
  // Returnable RGP specific
  const [returnableItemType, setReturnableItemType] = useState("47.5kg Commercial LPG Cylinders");
  const [returnableQtyOut, setReturnableQtyOut] = useState(1);
  const [returnDueDate, setReturnDueDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleNumber.trim()) {
      setError("Vehicle number is required");
      return;
    }
    if (!driverName.trim()) {
      setError("Driver name is required");
      return;
    }
    if (!purpose.trim()) {
      setError("Purpose of visit is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await security.createPass({
        pass_type: passType,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.toUpperCase().trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        vendor_name: vendorName.trim(),
        purpose: purpose.trim(),
        material_description: materialDescription.trim(),
        challan_number: challanNumber.trim(),
        invoice_number: invoiceNumber.trim(),
        po_number: poNumber.trim(),
        returnable_item_type: passType === "RGP_RETURNABLE" ? returnableItemType : null,
        returnable_qty_out: passType === "RGP_RETURNABLE" ? parseInt(returnableQtyOut, 10) || 0 : 0,
        return_due_date: passType === "RGP_RETURNABLE" ? returnDueDate : null
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to generate gate pass");
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
          padding: "18px 24px",
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
              background: "var(--color-gold-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-gold)"
            }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0, letterSpacing: "-0.01em" }}>
                Generate Security Gate Pass
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                Log incoming & outgoing vehicles, delivery challans, and returnable containers (RGP)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            margin: "16px 24px 0",
            padding: "12px 16px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#FCA5A5",
            fontSize: "13px"
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Pass Type */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                Gate Pass Type *
              </label>
              <select
                value={passType}
                onChange={(e) => setPassType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              >
                <option value="INWARD_MATERIAL">INWARD MATERIAL (Vendor Goods Delivery)</option>
                <option value="RGP_RETURNABLE">RGP (Returnable Gate Pass — Cylinders/Crates/Cans)</option>
                <option value="OUTWARD_RTV">OUTWARD RTV (Return to Vendor / Rejection)</option>
                <option value="NRGP_NON_RETURNABLE">NRGP (Non-Returnable Gate Pass — Waste/Scrap)</option>
                <option value="VISITOR_CONTRACTOR">VISITOR / CONTRACTOR (Technician / AMC Visit)</option>
              </select>
            </div>

            {/* Vehicle Type */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                Vehicle Type *
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              >
                <option value="TEMPO">Delivery Tempo / Mini Van</option>
                <option value="TRUCK">Heavy Commercial Truck</option>
                <option value="LPG_TRUCK">LPG Cylinder Delivery Truck</option>
                <option value="WATER_TANKER">Water Tanker</option>
                <option value="AUTO">Commercial Auto / Cargo 3-Wheeler</option>
                <option value="TWO_WHEELER">Two-Wheeler / Courier</option>
                <option value="OTHER">Other Vehicle</option>
              </select>
            </div>

            {/* Vehicle Number */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                Vehicle Number *
              </label>
              <input
                type="text"
                placeholder="e.g. TS-09-EA-3120"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px",
                  fontWeight: "600",
                  textTransform: "uppercase"
                }}
              />
            </div>

            {/* Driver Name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                Driver Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              />
            </div>

            {/* Driver Phone */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                Driver Mobile #
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              />
            </div>

            {/* Vendor / Supplier Name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
                Vendor / Supplier Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sri Krishna Agro Provisions"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              />
            </div>
          </div>

          {/* RGP Specific Section */}
          {passType === "RGP_RETURNABLE" && (
            <div style={{
              marginTop: "16px",
              padding: "14px",
              background: "rgba(232, 168, 56, 0.08)",
              border: "1px solid rgba(232, 168, 56, 0.25)",
              borderRadius: "10px"
            }}>
              <h4 style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--color-gold)", fontWeight: "700" }}>
                Returnable Asset Details (RGP)
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Container / Asset Type *
                  </label>
                  <select
                    value={returnableItemType}
                    onChange={(e) => setReturnableItemType(e.target.value)}
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
                    <option value="47.5kg Commercial LPG Cylinders">47.5kg Commercial LPG Cylinders</option>
                    <option value="50L SS Milk Cans">50L Stainless Steel Milk Cans</option>
                    <option value="Plastic Vegetable Crates">Plastic Vegetable Crates</option>
                    <option value="Beverage Glass Crates">Beverage Glass Crates</option>
                    <option value="Other Equipment">Other Returnable Equipment</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Qty Dispatched (Out) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={returnableQtyOut}
                    onChange={(e) => setReturnableQtyOut(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      background: "var(--bg-modal)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      color: "var(--text-main)",
                      fontSize: "12px",
                      fontWeight: "700"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Expected Return Due Date *
                  </label>
                  <input
                    type="date"
                    value={returnDueDate}
                    onChange={(e) => setReturnDueDate(e.target.value)}
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
              </div>
            </div>
          )}

          {/* Purpose */}
          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
              Purpose of Entry / Delivery *
            </label>
            <input
              type="text"
              placeholder="e.g. Morning vegetable supply for kitchen prep"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-main)",
                fontSize: "13px"
              }}
            />
          </div>

          {/* Documents row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Delivery Challan (DC) #
              </label>
              <input
                type="text"
                placeholder="e.g. DC-1082"
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
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
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Invoice #
              </label>
              <input
                type="text"
                placeholder="e.g. INV-9921"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
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
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Purchase Order (PO) #
              </label>
              <input
                type="text"
                placeholder="e.g. PO-2026-081"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
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

          {/* Material Description */}
          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
              Material / Item Summary
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 15 crates of tomatoes, 5 sacks of onions, 4 bags of potatoes"
              value={materialDescription}
              onChange={(e) => setMaterialDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-main)",
                fontSize: "13px",
                resize: "vertical"
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                background: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "13px",
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
                padding: "10px 22px",
                background: "linear-gradient(135deg, var(--color-gold) 0%, #ca8a04 100%)",
                border: "none",
                borderRadius: "8px",
                color: "var(--bg-modal)",
                fontSize: "13px",
                fontWeight: "700",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {loading ? <Clock size={16} /> : <Check size={16} />}
              {loading ? "Generating..." : "Generate Pass & Log Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
