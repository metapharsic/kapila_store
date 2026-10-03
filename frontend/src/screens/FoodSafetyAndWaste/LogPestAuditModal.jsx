import { useState } from "react";
import ModalShell from "../../components/ui/ModalShell";
import { COLORS } from "../../styles/colors";
import { foodSafety } from "../../api";
import { Sparkles, AlertTriangle, Check } from "lucide-react";

const SERVICE_TYPES = [
  { value: "PEST_CONTROL_SERVICE", label: "Pest Control & Rodent Treatment" },
  { value: "DEEP_CLEANING_AUDIT", label: "Kitchen Deep Sanitization Audit" },
  { value: "GREASE_TRAP_CLEANOUT", label: "Grease Trap & Sump De-sludging" },
  { value: "HOOD_CHEMICAL_WASH", label: "Exhaust Hood & Duct Chemical Degreasing" }
];

const STANDARD_AREAS = [
  "Central Store Dry Grocery",
  "Walk-in Chiller & Freezers",
  "Vegetable Receiving Dock",
  "Tiffins & SI-Meals Kitchen",
  "North Indian & Tandoor Kitchen",
  "Chinese & Dosa Counters",
  "Pot Wash & Scullery",
  "Garbage Yard & RUCO Shed",
  "Dining Hall & Buffet Counters"
];

export default function LogPestAuditModal({ isOpen, onClose, onSuccess }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [serviceDate, setServiceDate] = useState(todayStr);
  const [serviceType, setServiceType] = useState("PEST_CONTROL_SERVICE");
  const [serviceAgency, setServiceAgency] = useState("Rentokil PCI India");
  const [technicianName, setTechnicianName] = useState("");
  const [selectedAreas, setSelectedAreas] = useState([
    "Central Store Dry Grocery",
    "Walk-in Chiller & Freezers",
    "Tiffins & SI-Meals Kitchen"
  ]);
  const [chemicalsUsed, setChemicalsUsed] = useState("Deltamethrin 2.5% WP, Sticky Bait Traps");
  const [trapCountInstalled, setTrapCountInstalled] = useState("12");
  const [pestActivity, setPestActivity] = useState("NONE");
  const [hygieneScore, setHygieneScore] = useState("95");
  const [supervisorSignoff, setSupervisorSignoff] = useState("Executive Chef");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const toggleArea = (area) => {
    if (selectedAreas.includes(area)) {
      setSelectedAreas(selectedAreas.filter((a) => a !== area));
    } else {
      setSelectedAreas([...selectedAreas, area]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!serviceAgency.trim()) {
      setError("Service provider agency name is required");
      return;
    }
    if (selectedAreas.length === 0) {
      setError("Please select at least one area audited / serviced");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await foodSafety.createPestLog({
        service_date: serviceDate,
        service_type: serviceType,
        service_agency: serviceAgency.trim(),
        technician_name: technicianName.trim() || undefined,
        areas_covered: selectedAreas,
        chemicals_used: chemicalsUsed.trim() || undefined,
        trap_count_installed: parseInt(trapCountInstalled, 10) || 0,
        pest_activity_detected: pestActivity,
        hygiene_score: parseInt(hygieneScore, 10) || 95,
        supervisor_signoff: supervisorSignoff.trim() || undefined,
        remarks: remarks.trim() || undefined
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record pest control & hygiene audit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="default"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles size={22} color={COLORS.gold} />
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: COLORS.text }}>
              Pest Control & Deep Hygiene Audit Log
            </div>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted }}>
              FSSAI Schedule IV Sanitary Maintenance & Verification Record
            </span>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                backgroundColor: "rgba(220, 53, 69, 0.15)",
                border: "1px solid #dc3545",
                color: "#ff6b6b",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Date & Service Type */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Service Date *
              </label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.88rem"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Service / Audit Type *
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.88rem"
                }}
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Service Agency & Technician */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Service Agency / Contractor *
              </label>
              <input
                type="text"
                placeholder="e.g. Rentokil PCI India"
                value={serviceAgency}
                onChange={(e) => setServiceAgency(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.88rem"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Technician / Auditor Name
              </label>
              <input
                type="text"
                placeholder="e.g. P. Ramesh Kumar"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.88rem"
                }}
              />
            </div>
          </div>

          {/* Areas Covered Checkboxes */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "8px" }}>
              Kitchen & Storage Areas Serviced ({selectedAreas.length} selected) *
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "8px",
                padding: "12px",
                backgroundColor: COLORS.bgDark,
                borderRadius: "6px",
                border: `1px solid ${COLORS.border}`,
                maxHeight: "140px",
                overflowY: "auto"
              }}
            >
              {STANDARD_AREAS.map((area) => {
                const isChecked = selectedAreas.includes(area);
                return (
                  <label
                    key={area}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.8rem",
                      color: isChecked ? COLORS.text : COLORS.textMuted,
                      cursor: "pointer",
                      userSelect: "none"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleArea(area)}
                      style={{ accentColor: COLORS.gold }}
                    />
                    <span>{area}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Chemicals Used & Traps */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Chemicals / Baits Applied (Food Grade)
              </label>
              <input
                type="text"
                placeholder="e.g. Deltamethrin 2.5%, Gel Cockroach Baits"
                value={chemicalsUsed}
                onChange={(e) => setChemicalsUsed(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.88rem"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Bait Stations / Traps Installed
              </label>
              <input
                type="number"
                min="0"
                value={trapCountInstalled}
                onChange={(e) => setTrapCountInstalled(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.88rem"
                }}
              />
            </div>
          </div>

          {/* Pest Activity & Hygiene Score */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Pest Activity Observed *
              </label>
              <select
                value={pestActivity}
                onChange={(e) => setPestActivity(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: pestActivity === "NONE" ? "#52c41a" : pestActivity === "HIGH" ? "#ff4d4f" : "#faad14",
                  fontSize: "0.88rem",
                  fontWeight: 600
                }}
              >
                <option value="NONE">NONE — Zero Activity Found</option>
                <option value="LOW">LOW — Minor Isolated Signs</option>
                <option value="MODERATE">MODERATE — Active Monitoring Needed</option>
                <option value="HIGH">HIGH — Critical Infestation Alert</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Hygiene Score (0 - 100) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={hygieneScore}
                onChange={(e) => setHygieneScore(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.gold,
                  fontSize: "0.95rem",
                  fontWeight: 700
                }}
              />
            </div>
          </div>

          {/* Supervisor & Remarks */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Hotel Supervisor Sign-off
              </label>
              <input
                type="text"
                placeholder="e.g. Executive Chef"
                value={supervisorSignoff}
                onChange={(e) => setSupervisorSignoff(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.88rem"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Auditor Remarks / Action Plan
              </label>
              <input
                type="text"
                placeholder="e.g. All kitchen fly insectocutors serviced. Sticky pads replaced."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.88rem"
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: `1px solid ${COLORS.border}`
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              backgroundColor: "transparent",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.textMuted,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "8px 20px",
              borderRadius: "6px",
              backgroundColor: COLORS.gold,
              border: "none",
              color: "#111",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: loading ? 0.7 : 1
            }}
          >
            <Check size={16} />
            {loading ? "Recording..." : "Save Audit Record"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
