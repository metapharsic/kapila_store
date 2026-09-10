import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { staff } from "../../api";
import { Clock, AlertTriangle, X, Check, Calendar, UserCheck } from "lucide-react";

export default function RecordAttendanceModal({ isOpen, onClose, onSuccess, employees = [], initialDate = "" }) {
  const todayStr = initialDate || new Date().toISOString().slice(0, 10);
  const [attendanceDate, setAttendanceDate] = useState(todayStr);
  const [employeeId, setEmployeeId] = useState("");
  const [shiftType, setShiftType] = useState("SPLIT"); // SPLIT, MORNING, EVENING, NIGHT, GENERAL
  const [inTime1, setInTime1] = useState("06:30");
  const [outTime1, setOutTime1] = useState("11:30");
  const [inTime2, setInTime2] = useState("17:30");
  const [outTime2, setOutTime2] = useState("22:30");
  const [status, setStatus] = useState("PRESENT"); // PRESENT, HALF_DAY, ABSENT, PAID_LEAVE, WEEK_OFF
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (employees.length > 0 && !employeeId) {
      setEmployeeId(employees[0].id);
    }
  }, [employees, employeeId]);

  if (!isOpen) return null;

  const handleShiftChange = (newShift) => {
    setShiftType(newShift);
    if (newShift === "SPLIT") {
      setInTime1("06:30");
      setOutTime1("11:30");
      setInTime2("17:30");
      setOutTime2("22:30");
    } else if (newShift === "MORNING") {
      setInTime1("06:00");
      setOutTime1("14:30");
      setInTime2("");
      setOutTime2("");
    } else if (newShift === "EVENING") {
      setInTime1("14:00");
      setOutTime1("22:30");
      setInTime2("");
      setOutTime2("");
    } else if (newShift === "NIGHT") {
      setInTime1("22:00");
      setOutTime1("06:30");
      setInTime2("");
      setOutTime2("");
    } else {
      // GENERAL
      setInTime1("09:00");
      setOutTime1("18:00");
      setInTime2("");
      setOutTime2("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId) {
      setError("Please select a staff crew member");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await staff.recordAttendance({
        attendance_date: attendanceDate,
        employee_id: employeeId,
        shift_type: shiftType,
        in_time_1: status === "ABSENT" || status === "WEEK_OFF" ? null : inTime1,
        out_time_1: status === "ABSENT" || status === "WEEK_OFF" ? null : outTime1,
        in_time_2: shiftType === "SPLIT" && status !== "ABSENT" && status !== "WEEK_OFF" ? inTime2 : null,
        out_time_2: shiftType === "SPLIT" && status !== "ABSENT" && status !== "WEEK_OFF" ? outTime2 : null,
        status,
        overtime_hours: parseFloat(overtimeHours) || 0,
        notes: notes.trim() || undefined
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to log shift attendance");
    } finally {
      setLoading(false);
    }
  };

  const selectedEmp = employees.find((e) => String(e.id) === String(employeeId));

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
          maxWidth: "600px",
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
            <Clock size={22} color={COLORS.gold} />
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: COLORS.text }}>
                Punch Shift & Split-Shift Attendance
              </h2>
              <span style={{ fontSize: "0.78rem", color: COLORS.textMuted }}>
                Log morning, evening, night or split-shift duty hours for kitchen staff
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

            {/* Date & Staff Selector */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Duty Date *
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
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
                  Staff Crew Member *
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
                      {emp.emp_code} — {emp.first_name} {emp.last_name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Employee Info Pill */}
            {selectedEmp && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  backgroundColor: "var(--border-color)",
                  border: `1px solid ${COLORS.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem"
                }}
              >
                <span style={{ color: COLORS.textMuted }}>
                  Role: <strong style={{ color: COLORS.text }}>{selectedEmp.designation}</strong>
                </span>
                <span style={{ color: COLORS.textMuted }}>
                  Wage Type: <strong style={{ color: COLORS.gold }}>{selectedEmp.salary_type}</strong>
                </span>
              </div>
            )}

            {/* Shift Type & Attendance Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Shift Structure *
                </label>
                <select
                  value={shiftType}
                  onChange={(e) => handleShiftChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: COLORS.bgDark,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "6px",
                    color: COLORS.text,
                    fontSize: "0.88rem",
                    fontWeight: 600
                  }}
                >
                  <option value="SPLIT">SPLIT SHIFT (Morning Rush + Dinner Service)</option>
                  <option value="MORNING">MORNING (06:00 - 14:30 Early Breakfast)</option>
                  <option value="EVENING">EVENING (14:00 - 22:30 Dinner Service)</option>
                  <option value="NIGHT">NIGHT (22:00 - 06:30 Baking & Stewarding)</option>
                  <option value="GENERAL">GENERAL (09:00 - 18:00 Store / Admin)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Attendance Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: COLORS.bgDark,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "6px",
                    color: status === "PRESENT" ? "#52c41a" : status === "ABSENT" ? "#ff4d4f" : "#faad14",
                    fontSize: "0.88rem",
                    fontWeight: 600
                  }}
                >
                  <option value="PRESENT">PRESENT (Full Duty)</option>
                  <option value="HALF_DAY">HALF_DAY (Single Slot Only)</option>
                  <option value="ABSENT">ABSENT (Unapproved)</option>
                  <option value="PAID_LEAVE">PAID LEAVE (Approved Casual/Sick)</option>
                  <option value="WEEK_OFF">WEEK OFF (Scheduled Rest Day)</option>
                </select>
              </div>
            </div>

            {/* Time Slots (Only if not absent/week-off) */}
            {status !== "ABSENT" && status !== "WEEK_OFF" && (
              <div
                style={{
                  backgroundColor: "rgba(0,0,0,0.2)",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "8px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}
              >
                {/* Slot 1 */}
                <div>
                  <span style={{ fontSize: "0.78rem", color: COLORS.gold, fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    {shiftType === "SPLIT" ? "Slot 1: Morning Breakfast Service" : "Shift Punch Times"}
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>In Time (HH:MM)</label>
                      <input
                        type="time"
                        value={inTime1}
                        onChange={(e) => setInTime1(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          backgroundColor: COLORS.bgDark,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: "4px",
                          color: COLORS.text,
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>Out Time (HH:MM)</label>
                      <input
                        type="time"
                        value={outTime1}
                        onChange={(e) => setOutTime1(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          backgroundColor: COLORS.bgDark,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: "4px",
                          color: COLORS.text,
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Slot 2 (Split Shift Only) */}
                {shiftType === "SPLIT" && (
                  <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: "10px" }}>
                    <span style={{ fontSize: "0.78rem", color: COLORS.gold, fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Slot 2: Evening Dinner & Tiffin Service
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>In Time 2 (HH:MM)</label>
                        <input
                          type="time"
                          value={inTime2}
                          onChange={(e) => setInTime2(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            backgroundColor: COLORS.bgDark,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: "4px",
                            color: COLORS.text,
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>Out Time 2 (HH:MM)</label>
                        <input
                          type="time"
                          value={outTime2}
                          onChange={(e) => setOutTime2(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            backgroundColor: COLORS.bgDark,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: "4px",
                            color: COLORS.text,
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Overtime & Notes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Overtime (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="8"
                  value={overtimeHours}
                  onChange={(e) => setOvertimeHours(e.target.value)}
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

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                  Remarks / Handoff Observation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Extra 1 hr for weekend banquet tiffins prep."
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
              {loading ? "Recording..." : "Record Attendance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
