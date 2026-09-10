import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { staff } from "../../api";
import { Calendar, AlertTriangle, X, Check } from "lucide-react";

const LEAVE_TYPES = [
  { value: "CASUAL_LEAVE", label: "Casual Leave (CL)" },
  { value: "SICK_LEAVE", label: "Sick / Medical Leave (SL)" },
  { value: "FESTIVAL_OFF", label: "Festival / Holiday Off" },
  { value: "COMPENSATORY_OFF", label: "Compensatory Off (Worked Sunday/Banquet)" }
];

export default function ApplyLeaveModal({ isOpen, onClose, onSuccess, employees = [] }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("CASUAL_LEAVE");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [totalDays, setTotalDays] = useState("1.0");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (employees.length > 0 && !employeeId) {
      setEmployeeId(employees[0].id);
    }
  }, [employees, employeeId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId) {
      setError("Please select an employee");
      return;
    }
    if (!reason.trim()) {
      setError("Reason for leave is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await staff.applyLeave({
        employee_id: employeeId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        total_days: parseFloat(totalDays) || 1.0,
        reason: reason.trim()
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to submit leave request");
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
          maxWidth: "540px",
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
            <Calendar size={22} color={COLORS.gold} />
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: COLORS.text }}>
                Submit Staff Leave Request
              </h2>
              <span style={{ fontSize: "0.78rem", color: COLORS.textMuted }}>
                Apply for kitchen crew planned absence or compensatory off
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

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Staff Employee *
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
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
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.emp_code} — {emp.first_name} {emp.last_name} ({emp.department} • {emp.designation})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Leave Type *
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
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
                  {LEAVE_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>
                      {lt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Total Days *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={totalDays}
                  onChange={(e) => setTotalDays(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: COLORS.bgDark,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "6px",
                    color: COLORS.gold,
                    fontSize: "0.88rem",
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
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
                  End Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
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

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                Reason for Leave *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Attending sister's wedding in Vijayawada. Shift coverage arranged with Suresh."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  backgroundColor: COLORS.bgDark,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem",
                  resize: "none"
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
              {loading ? "Submitting..." : "Submit Leave Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
