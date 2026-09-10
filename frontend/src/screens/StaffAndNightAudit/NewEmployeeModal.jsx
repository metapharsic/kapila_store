import React, { useState } from "react";
import { COLORS } from "../../styles/colors";
import { staff } from "../../api";
import { UserPlus, AlertTriangle, X, Check, Briefcase, Phone, Mail, IndianRupee } from "lucide-react";

const DEPARTMENTS = [
  "TIFFINS",
  "STAFF",
  "SI-MEALS",
  "NORTH INDIAN",
  "CHAT & SOFTY",
  "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL",
  "RESTAURANT",
  "ROOM SERVICE",
  "CENTRAL_STORE",
  "STEWARDING",
  "MANAGEMENT"
];

export default function NewEmployeeModal({ isOpen, onClose, onSuccess }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [department, setDepartment] = useState("TIFFINS");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [aadhaarLast4, setAadhaarLast4] = useState("");
  const [joiningDate, setJoiningDate] = useState(todayStr);
  const [salaryType, setSalaryType] = useState("MONTHLY");
  const [basicSalary, setBasicSalary] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Both first name and last name are required");
      return;
    }
    if (!designation.trim()) {
      setError("Staff designation / role is required (e.g. CDP, Dosa Master, Steward)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await staff.createEmployee({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        department,
        designation: designation.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        aadhaar_last4: aadhaarLast4.trim() || undefined,
        joining_date: joiningDate,
        salary_type: salaryType,
        basic_salary: salaryType === "MONTHLY" ? (parseFloat(basicSalary) || 0) : 0,
        daily_wage: salaryType === "DAILY_WAGE" ? (parseFloat(dailyWage) || 0) : 0,
        emergency_contact: emergencyContact.trim() || undefined,
        notes: notes.trim() || undefined
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to onboard employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px"
      }}
    >
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: "12px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          color: COLORS.text
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: `linear-gradient(135deg, ${COLORS.surface} 0%, rgba(232, 168, 56, 0.08) 100%)`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <UserPlus size={22} color={COLORS.gold} />
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: COLORS.text }}>
                Onboard Hotel & Kitchen Employee
              </h2>
              <span style={{ fontSize: "0.78rem", color: COLORS.textMuted }}>
                Add crew profile to HRMS directory with department allocation & wage terms
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: COLORS.textMuted,
              cursor: "pointer",
              padding: "4px"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
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

            {/* Name Fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  First Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
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
                  Last Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Goud"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
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
            </div>

            {/* Department & Designation */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Department Allocation *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
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
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Designation / Role Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Head Tiffins & Idli Master"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
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
            </div>

            {/* Phone & Email */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Mobile Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9848011203"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  Aadhaar (Last 4 Digits)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 8832"
                  value={aadhaarLast4}
                  onChange={(e) => setAadhaarLast4(e.target.value)}
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

            {/* Wage & Salary Structure */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Compensation Model *
                </label>
                <select
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value)}
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
                  <option value="MONTHLY">Monthly Salaried</option>
                  <option value="DAILY_WAGE">Daily Wage / Contract Worker</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  {salaryType === "MONTHLY" ? "Basic Monthly Salary (₹) *" : "Daily Wage Rate (₹ / Day) *"}
                </label>
                <input
                  type="number"
                  placeholder={salaryType === "MONTHLY" ? "e.g. 32000" : "e.g. 850"}
                  value={salaryType === "MONTHLY" ? basicSalary : dailyWage}
                  onChange={(e) => salaryType === "MONTHLY" ? setBasicSalary(e.target.value) : setDailyWage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: COLORS.bgDark,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "6px",
                    color: COLORS.gold,
                    fontSize: "0.92rem",
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            {/* Joining Date & Emergency Contact */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Date of Joining *
                </label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
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
                  Emergency Contact (Name & Phone)
                </label>
                <input
                  type="text"
                  placeholder="e.g. S. Goud (Brother) - 9848011204"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
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

            {/* Operational Notes */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Crew Skills & Specialization Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Expert in South Indian batter fermentation and early tiffins prep."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 24px",
              borderTop: `1px solid ${COLORS.border}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              backgroundColor: "rgba(0,0,0,0.2)"
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
              {loading ? "Onboarding..." : "Save Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
