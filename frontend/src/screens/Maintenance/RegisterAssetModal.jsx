import React, { useState } from "react";
import { X, Plus, Building2 } from "lucide-react";

export default function RegisterAssetModal({ isOpen, onClose, onSubmit, departments = [] }) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(departments[0]?.name || "CHINESE & DOSA");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("COOKING_RANGE");
  const [manufacturer, setManufacturer] = useState("");
  const [modelNo, setModelNo] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [amcVendor, setAmcVendor] = useState("");
  const [criticality, setCriticality] = useState("MEDIUM");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !department) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        department,
        location: location.trim() || null,
        category,
        manufacturer: manufacturer.trim() || null,
        model_no: modelNo.trim() || null,
        serial_no: serialNo.trim() || null,
        purchase_date: purchaseDate || null,
        warranty_expiry: warrantyExpiry || null,
        amc_vendor: amcVendor.trim() || null,
        criticality,
        notes: notes.trim() || null
      });
      onClose();
    } catch (err) {
      console.error(err);
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
        width: "100%", maxWidth: 640, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #334155",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(232, 168, 56, 0.08)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "rgba(232, 168, 56, 0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-gold)"
            }}>
              <Building2 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                Register Kitchen & Facility Asset
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Create equipment record, QR tag, and PM schedule registry
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

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Equipment Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rational Combi Oven 10-Tray / Conveyor Dishwasher"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Department *
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              >
                {departments.map((d) => (
                  <option key={d.id || d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
                <option value="FACILITY & MAINTENANCE">FACILITY & MAINTENANCE</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              >
                <option value="COOKING_RANGE">Cooking Range & Ovens</option>
                <option value="REFRIGERATION">Refrigeration & Cold Rooms</option>
                <option value="WASHING">Dishwashing & Sanitization</option>
                <option value="GRINDING_BAKERY">Wet Grinders & Bakery Kneaders</option>
                <option value="HVAC_EXHAUST">Exhaust Hoods & Blowers</option>
                <option value="UTILITY_POWER">LPG, Generator & Water RO</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Physical Location
              </label>
              <input
                type="text"
                placeholder="e.g. Hot Kitchen Line 2 / Pot Wash Corner"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Criticality Rating
              </label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              >
                <option value="CRITICAL">🔴 Critical (Kitchen Stops if Down)</option>
                <option value="HIGH">🟠 High Priority</option>
                <option value="MEDIUM">🟡 Medium Priority</option>
                <option value="LOW">🟢 Low Priority</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Manufacturer / Brand
              </label>
              <input
                type="text"
                placeholder="e.g. Blue Star / Hobart / Rational"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Model / Serial No
              </label>
              <input
                type="text"
                placeholder="e.g. HBT-120-PRO / SN-88231"
                value={modelNo}
                onChange={(e) => setModelNo(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Warranty / AMC Expiry
              </label>
              <input
                type="date"
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                AMC Vendor / External Service Partner
              </label>
              <input
                type="text"
                placeholder="e.g. Voltas Commercial Direct / Apex Kitchen Engineering"
                value={amcVendor}
                onChange={(e) => setAmcVendor(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Notes / Technical Instructions
              </label>
              <textarea
                rows={2}
                placeholder="Operational notes, electrical requirements, or safety precautions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--bg-modal)",
                  border: "1px solid #334155", color: "var(--text-main)", fontSize: 13, outline: "none"
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
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
              type="submit"
              disabled={submitting}
              style={{
                padding: "9px 20px", borderRadius: 8, background: "var(--color-gold)",
                border: "none", color: "var(--bg-modal)", fontWeight: 700, fontSize: 13,
                cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Plus size={16} />
              {submitting ? "Registering..." : "Register Machine"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
