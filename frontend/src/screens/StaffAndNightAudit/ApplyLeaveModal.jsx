import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { staff } from "../../api";
import { Calendar, AlertTriangle, Check } from "lucide-react";
import ModalShell from "../../components/ui/ModalShell";

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
    <ModalShell
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Calendar size={20} color={COLORS.gold} />
          <span>Submit Staff Leave Request</span>
        </div>
      }
      onClose={onClose}
      size="compact"
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
              fontSize: "0.88rem",
              boxSizing: "border-box"
            }}
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.emp_code} — {emp.first_name} {emp.last_name} ({emp.department} • {emp.designation})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: "14px" }}>
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
                fontSize: "0.88rem",
                boxSizing: "border-box"
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
                fontWeight: 600,
                boxSizing: "border-box"
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "14px" }}>
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
                fontSize: "0.88rem",
                boxSizing: "border-box"
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
                fontSize: "0.88rem",
                boxSizing: "border-box"
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
              resize: "vertical",
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            paddingTop: "16px",
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px"
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
    </ModalShell>
  );
}
