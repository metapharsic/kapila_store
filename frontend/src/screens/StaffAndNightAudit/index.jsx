import { useState, useEffect, useCallback } from "react";
import { COLORS } from "../../styles/colors";
import { staff, nightAudit } from "../../api";
import {
  Users, Clock, Calendar, Moon, Plus, Search, RefreshCw,
  IndianRupee, TrendingDown,
  TrendingUp, FileSpreadsheet, Check, X
} from "lucide-react";

import NewEmployeeModal from "./NewEmployeeModal";
import RecordAttendanceModal from "./RecordAttendanceModal";
import ApplyLeaveModal from "./ApplyLeaveModal";
import ExecuteNightAuditModal from "./ExecuteNightAuditModal";

const DEPARTMENTS = [
  "ALL",
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

export default function StaffAndNightAuditScreen() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState("staff_directory"); // staff_directory, shift_attendance, leave_management, night_audit
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Staff Data
  const [employees, setEmployees] = useState([]);
  const [staffSummary, setStaffSummary] = useState({ total_employees: 0, active_count: 0, monthly_payroll_total: 0 });

  // Attendance Data
  const [attendanceDate, setAttendanceDate] = useState(todayStr);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({ total_marked: 0, present_count: 0, split_count: 0, half_day_count: 0, absent_count: 0, total_ot_hours: 0 });

  // Leaves Data
  const [leaves, setLeaves] = useState([]);

  // Night Audit Data
  const [nightAuditLogs, setNightAuditLogs] = useState([]);
  const [auditTelemetry, setAuditTelemetry] = useState({ total_audits: 0, compliant_audits: 0, avg_food_cost_pct: 32.0, cumulative_cost_total: 0, latest_audit: null });

  // Filters
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [staffSearch, setStaffSearch] = useState("");
  const [attendanceShiftFilter, setAttendanceShiftFilter] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("ALL");

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "staff_directory") {
        const res = await staff.listEmployees({
          department: deptFilter !== "ALL" ? deptFilter : undefined,
          search: staffSearch || undefined,
          limit: 100
        });
        setEmployees(res.rows || []);
        if (res.summary) setStaffSummary(res.summary);
      } else if (activeTab === "shift_attendance") {
        // Ensure employees are loaded for modal dropdown
        if (employees.length === 0) {
          const empRes = await staff.listEmployees({ limit: 100 });
          setEmployees(empRes.rows || []);
        }
        const res = await staff.listAttendance({
          date: attendanceDate,
          department: deptFilter !== "ALL" ? deptFilter : undefined,
          shift_type: attendanceShiftFilter || undefined,
          limit: 100
        });
        setAttendanceLogs(res.rows || []);
        if (res.summary) setAttendanceSummary(res.summary);
      } else if (activeTab === "leave_management") {
        if (employees.length === 0) {
          const empRes = await staff.listEmployees({ limit: 100 });
          setEmployees(empRes.rows || []);
        }
        const res = await staff.listLeaves({
          status: leaveStatusFilter !== "ALL" ? leaveStatusFilter : undefined,
          limit: 50
        });
        setLeaves(res.rows || []);
      } else if (activeTab === "night_audit") {
        const res = await nightAudit.listLogs({ limit: 50 });
        setNightAuditLogs(res.rows || []);
        const telem = await nightAudit.telemetry();
        setAuditTelemetry(telem.data);
      }
    } catch (err) {
      console.error("Error loading staff & night audit data:", err);
      setMsg("Failed to load records: " + (err.message || "Network error"));
    } finally {
      setLoading(false);
    }
  }, [activeTab, deptFilter, staffSearch, attendanceDate, attendanceShiftFilter, leaveStatusFilter, employees.length]);

  useEffect(() => {
    queueMicrotask(() => loadData());
  }, [loadData]);

  const handleReviewLeave = async (id, status) => {
    try {
      setLoading(true);
      await staff.reviewLeave(id, { status });
      await loadData();
    } catch (err) {
      alert("Leave review failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      if (activeTab === "night_audit") {
        await nightAudit.exportExcel();
      } else {
        await staff.exportExcel({ date: attendanceDate });
      }
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", color: COLORS.text, maxWidth: "1600px", margin: "0 auto" }}>
      {msg && (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            borderRadius: "8px",
            backgroundColor: "rgba(220, 53, 69, 0.15)",
            border: "1px solid #dc3545",
            color: "#ff6b6b",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}
        >
          <span>{msg}</span>
          <button
            onClick={() => setMsg("")}
            style={{ background: "transparent", border: "none", color: "#ff6b6b", cursor: "pointer" }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {/* Top Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <Users size={28} color={COLORS.gold} />
            <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 700, fontFamily: "DM Serif Display, serif" }}>
              Staff HRMS, Split-Shifts & Midnight Night Audit
            </h1>
          </div>
          <p style={{ margin: 0, color: COLORS.textMuted, fontSize: "0.9rem" }}>
            Hotel Crew Directory, Kitchen Split-Shift Rostering, Biometric Timekeeping & End-of-Day Food Cost Rollover.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={loadData}
            title="Refresh Data"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 14px",
              backgroundColor: "var(--border-color)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "8px",
              color: COLORS.text,
              cursor: "pointer",
              fontSize: "0.85rem"
            }}
          >
            <RefreshCw size={15} className={loading ? "spin-animation" : ""} />
            Refresh
          </button>

          <button
            onClick={handleExport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 16px",
              backgroundColor: "rgba(232, 168, 56, 0.12)",
              border: `1px solid ${COLORS.gold}`,
              borderRadius: "8px",
              color: COLORS.gold,
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600
            }}
          >
            <FileSpreadsheet size={16} />
            Export Styled Excel
          </button>

          {/* Tab Actions */}
          {activeTab === "staff_directory" && (
            <button
              onClick={() => setIsEmployeeModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                backgroundColor: COLORS.gold,
                border: "none",
                borderRadius: "8px",
                color: "#111",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <Plus size={16} />
              Onboard Employee
            </button>
          )}

          {activeTab === "shift_attendance" && (
            <button
              onClick={() => setIsAttendanceModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                backgroundColor: COLORS.gold,
                border: "none",
                borderRadius: "8px",
                color: "#111",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <Plus size={16} />
              Log Shift Punch
            </button>
          )}

          {activeTab === "leave_management" && (
            <button
              onClick={() => setIsLeaveModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                backgroundColor: COLORS.gold,
                border: "none",
                borderRadius: "8px",
                color: "#111",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <Plus size={16} />
              Apply Leave
            </button>
          )}

          {activeTab === "night_audit" && (
            <button
              onClick={() => setIsAuditModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                backgroundColor: COLORS.gold,
                border: "none",
                borderRadius: "8px",
                color: "#111",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600
              }}
            >
              <Moon size={16} />
              Run Daily Night Audit
            </button>
          )}
        </div>
      </div>

      {/* Top Telemetry KPI Ribbon */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px"
        }}
      >
        {/* KPI 1: Active Staff */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "10px",
            padding: "16px 20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Total Crew Directory
            </span>
            <Users size={18} color={COLORS.gold} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: COLORS.text }}>
              {staffSummary.active_count} Active
            </span>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
              / {staffSummary.total_employees} Onboarded
            </span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: COLORS.textMuted }}>
            Monthly Payroll: ₹{staffSummary.monthly_payroll_total.toLocaleString("en-IN")}
          </div>
        </div>

        {/* KPI 2: Today's Shift Attendance */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "10px",
            padding: "16px 20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Duty Attendance Today
            </span>
            <Clock size={18} color="#52c41a" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#52c41a" }}>
              {attendanceSummary.present_count} Present
            </span>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
              ({attendanceSummary.split_count} Split Shifts)
            </span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: COLORS.textMuted }}>
            {attendanceSummary.total_ot_hours} OT hours accumulated
          </div>
        </div>

        {/* KPI 3: Food Cost % (Latest Night Audit) */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "10px",
            padding: "16px 20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Latest Night Audit Food Cost
            </span>
            <IndianRupee size={18} color={COLORS.gold} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontSize: "1.6rem",
                fontWeight: 700,
                color: auditTelemetry.latest_audit?.variance_pct <= 0 ? "#52c41a" : "#ff4d4f"
              }}
            >
              {auditTelemetry.latest_audit ? `${auditTelemetry.latest_audit.food_cost_percentage}%` : "29.68%"}
            </span>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
              (Target: 32.0%)
            </span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: COLORS.textMuted }}>
            {auditTelemetry.latest_audit?.variance_pct <= 0 ? "Favorable under budget" : "Budget overrun flagged"}
          </div>
        </div>

        {/* KPI 4: Night Audit 30-Day Health */}
        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "10px",
            padding: "16px 20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Rollover Compliance Rate
            </span>
            <Moon size={18} color="#52c41a" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: COLORS.text }}>
              {auditTelemetry.total_audits > 0
                ? `${((auditTelemetry.compliant_audits / auditTelemetry.total_audits) * 100).toFixed(0)}%`
                : "100%"}
            </span>
            <span style={{ fontSize: "0.8rem", color: COLORS.textMuted }}>
              ({auditTelemetry.compliant_audits} of {auditTelemetry.total_audits} closed)
            </span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: COLORS.textMuted }}>
            Avg Food Cost: {auditTelemetry.avg_food_cost_pct || 30.5}%
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${COLORS.border}`,
          marginBottom: "20px",
          gap: "8px"
        }}
      >
        <button
          onClick={() => setActiveTab("staff_directory")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "staff_directory" ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            color: activeTab === "staff_directory" ? COLORS.gold : COLORS.textMuted,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Users size={17} />
          Staff Directory & Wages ({staffSummary.total_employees})
        </button>

        <button
          onClick={() => setActiveTab("shift_attendance")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "shift_attendance" ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            color: activeTab === "shift_attendance" ? COLORS.gold : COLORS.textMuted,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Clock size={17} />
          Shift & Split Attendance Register ({attendanceLogs.length})
        </button>

        <button
          onClick={() => setActiveTab("leave_management")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "leave_management" ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            color: activeTab === "leave_management" ? COLORS.gold : COLORS.textMuted,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Calendar size={17} />
          Leave Requests & Approvals ({leaves.length})
        </button>

        <button
          onClick={() => setActiveTab("night_audit")}
          style={{
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "night_audit" ? `3px solid ${COLORS.gold}` : "3px solid transparent",
            color: activeTab === "night_audit" ? COLORS.gold : COLORS.textMuted,
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Moon size={17} />
          Midnight Food Cost Night Audit ({nightAuditLogs.length})
        </button>
      </div>

      {/* TAB 1: STAFF DIRECTORY */}
      {activeTab === "staff_directory" && (
        <div>
          {/* Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d === "ALL" ? "All Departments" : d}
                  </option>
                ))}
              </select>

              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search crew by name, code, role..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadData()}
                  style={{
                    padding: "8px 12px 8px 32px",
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "6px",
                    color: COLORS.text,
                    fontSize: "0.85rem",
                    width: "280px"
                  }}
                />
                <Search size={15} color={COLORS.textMuted} style={{ position: "absolute", left: "10px", top: "10px" }} />
              </div>
            </div>

            <span style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>
              Showing {employees.length} crew members
            </span>
          </div>

          {/* Employees Table */}
          <div style={{ backgroundColor: COLORS.surface, borderRadius: "10px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Code</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Employee Name</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Department</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Designation</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Phone / Contact</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Wage Model</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Salary / Rate</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: "32px", textAlign: "center", color: COLORS.textMuted }}>
                      No staff crew members found matching filters.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: COLORS.gold }}>
                        {emp.emp_code}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: COLORS.text }}>{emp.first_name} {emp.last_name}</div>
                        {emp.emergency_contact && (
                          <div style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>
                            Emerg: {emp.emergency_contact}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "4px", backgroundColor: "var(--border-color)", fontWeight: 600, fontSize: "0.78rem" }}>
                          {emp.department}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 500 }}>
                        {emp.designation}
                      </td>
                      <td style={{ padding: "12px 16px", color: COLORS.textMuted, fontSize: "0.82rem" }}>
                        {emp.phone || "-"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "0.78rem", color: emp.salary_type === "MONTHLY" ? "#52c41a" : COLORS.gold }}>
                          {emp.salary_type}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                        {emp.salary_type === "MONTHLY"
                          ? `₹${parseFloat(emp.basic_salary).toLocaleString("en-IN")}/mo`
                          : `₹${parseFloat(emp.daily_wage).toLocaleString("en-IN")}/day`}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: emp.status === "ACTIVE" ? "rgba(82, 196, 26, 0.15)" : "rgba(255, 77, 79, 0.15)",
                            color: emp.status === "ACTIVE" ? "#52c41a" : "#ff4d4f"
                          }}
                        >
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SHIFT ATTENDANCE */}
      {activeTab === "shift_attendance" && (
        <div>
          {/* Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              />

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d === "ALL" ? "All Departments" : d}
                  </option>
                ))}
              </select>

              <select
                value={attendanceShiftFilter}
                onChange={(e) => setAttendanceShiftFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "6px",
                  color: COLORS.text,
                  fontSize: "0.85rem"
                }}
              >
                <option value="">All Shifts</option>
                <option value="SPLIT">Split Shifts Only</option>
                <option value="MORNING">Morning Only</option>
                <option value="EVENING">Evening Only</option>
                <option value="NIGHT">Night Only</option>
                <option value="GENERAL">General Store Only</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "16px", fontSize: "0.85rem" }}>
              <div>Present: <strong style={{ color: "#52c41a" }}>{attendanceSummary.present_count}</strong></div>
              <div>Split Shifts: <strong style={{ color: COLORS.gold }}>{attendanceSummary.split_count}</strong></div>
              <div>Total OT: <strong>{attendanceSummary.total_ot_hours} hrs</strong></div>
            </div>
          </div>

          {/* Attendance Table */}
          <div style={{ backgroundColor: COLORS.surface, borderRadius: "10px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Employee</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Department & Role</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Shift Type</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Slot 1 (Morning Rush)</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Slot 2 (Dinner Rush)</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Overtime</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Notes / Auditor</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: "32px", textAlign: "center", color: COLORS.textMuted }}>
                      No attendance logged for {attendanceDate}. Click "Log Shift Punch" to mark crew attendance.
                    </td>
                  </tr>
                ) : (
                  attendanceLogs.map((row) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: COLORS.text }}>{row.first_name} {row.last_name}</div>
                        <div style={{ fontSize: "0.75rem", color: COLORS.gold }}>{row.emp_code}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div>{row.designation}</div>
                        <span style={{ fontSize: "0.72rem", color: COLORS.textMuted }}>{row.department}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: row.shift_type === "SPLIT" ? "var(--color-gold-dim)" : "var(--border-color)",
                            color: row.shift_type === "SPLIT" ? COLORS.gold : COLORS.text,
                            fontWeight: 600,
                            fontSize: "0.75rem"
                          }}
                        >
                          {row.shift_type}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {row.in_time_1 ? `${row.in_time_1} - ${row.out_time_1 || "Ongoing"}` : "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {row.in_time_2 ? `${row.in_time_2} - ${row.out_time_2 || "Ongoing"}` : "-"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: row.status === "PRESENT"
                              ? "rgba(82, 196, 26, 0.15)"
                              : row.status === "ABSENT"
                              ? "rgba(255, 77, 79, 0.15)"
                              : "rgba(250, 173, 20, 0.15)",
                            color: row.status === "PRESENT" ? "#52c41a" : row.status === "ABSENT" ? "#ff4d4f" : "#faad14"
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                        {parseFloat(row.overtime_hours) > 0 ? (
                          <span style={{ color: COLORS.gold }}>+{row.overtime_hours} hrs</span>
                        ) : (
                          <span style={{ color: COLORS.textMuted }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.8rem", color: COLORS.textMuted }}>
                        <div>{row.notes || "-"}</div>
                        <div style={{ fontSize: "0.7rem" }}>By: {row.recorded_by}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LEAVE REQUESTS */}
      {activeTab === "leave_management" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <select
              value={leaveStatusFilter}
              onChange={(e) => setLeaveStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "6px",
                color: COLORS.text,
                fontSize: "0.85rem"
              }}
            >
              <option value="ALL">All Leave Statuses</option>
              <option value="PENDING">Pending Approval Only</option>
              <option value="APPROVED">Approved Leaves</option>
              <option value="REJECTED">Rejected Leaves</option>
            </select>

            <span style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>
              Total Requests: <strong>{leaves.length}</strong>
            </span>
          </div>

          <div style={{ backgroundColor: COLORS.surface, borderRadius: "10px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Employee</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Department</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Leave Type</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Dates & Duration</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Reason</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600, textAlign: "right" }}>Action / Signoff</th>
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: "32px", textAlign: "center", color: COLORS.textMuted }}>
                      No leave requests recorded.
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: COLORS.text }}>{leave.first_name} {leave.last_name}</div>
                        <div style={{ fontSize: "0.75rem", color: COLORS.gold }}>{leave.emp_code}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "0.8rem" }}>{leave.department}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                        {leave.leave_type}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div>{String(leave.start_date).slice(0, 10)} to {String(leave.end_date).slice(0, 10)}</div>
                        <div style={{ fontSize: "0.75rem", color: COLORS.gold }}>({leave.total_days} days)</div>
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: "250px", fontSize: "0.82rem", color: COLORS.textMuted }}>
                        {leave.reason}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: leave.status === "APPROVED"
                              ? "rgba(82, 196, 26, 0.15)"
                              : leave.status === "REJECTED"
                              ? "rgba(255, 77, 79, 0.15)"
                              : "rgba(250, 173, 20, 0.15)",
                            color: leave.status === "APPROVED" ? "#52c41a" : leave.status === "REJECTED" ? "#ff4d4f" : "#faad14"
                          }}
                        >
                          {leave.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {leave.status === "PENDING" ? (
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => handleReviewLeave(leave.id, "APPROVED")}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(82, 196, 26, 0.2)",
                                border: "1px solid #52c41a",
                                color: "#52c41a",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <Check size={12} />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReviewLeave(leave.id, "REJECTED")}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(255, 77, 79, 0.2)",
                                border: "1px solid #ff4d4f",
                                color: "#ff4d4f",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <X size={12} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>
                            By: {leave.approved_by || "Management"}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: NIGHT AUDIT LEDGER */}
      {activeTab === "night_audit" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.9rem", color: COLORS.textMuted }}>
              Midnight Frozen Store Issuance & Daily Food Cost Accounting Ledgers
            </span>

            <span style={{ fontSize: "0.85rem", color: COLORS.textMuted }}>
              Total Audits Frozen: <strong>{nightAuditLogs.length}</strong>
            </span>
          </div>

          <div style={{ backgroundColor: COLORS.surface, borderRadius: "10px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Audit Date</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Material Issues (₹)</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Food Waste (₹)</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Direct Food Cost (₹)</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Food Sales (₹)</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Food Cost %</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Variance %</th>
                  <th style={{ padding: "12px 16px", color: COLORS.textMuted, fontWeight: 600 }}>Status & Auditor</th>
                </tr>
              </thead>
              <tbody>
                {nightAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: "32px", textAlign: "center", color: COLORS.textMuted }}>
                      No night audit records found. Click "Run Daily Night Audit" to execute the midnight rollover.
                    </td>
                  </tr>
                ) : (
                  nightAuditLogs.map((row) => {
                    const isFavorable = parseFloat(row.variance_pct) <= 0;
                    return (
                      <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: COLORS.gold }}>
                          {String(row.audit_date).slice(0, 10)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          ₹{parseFloat(row.total_material_issued_cost).toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#ff7875" }}>
                          ₹{parseFloat(row.total_food_waste_cost).toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: COLORS.text }}>
                          ₹{parseFloat(row.total_kitchen_direct_cost).toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          ₹{parseFloat(row.total_food_revenue).toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontWeight: 700, color: isFavorable ? "#52c41a" : "#ff4d4f" }}>
                            {row.food_cost_percentage}%
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              fontWeight: 600,
                              color: isFavorable ? "#52c41a" : "#ff4d4f"
                            }}
                          >
                            {isFavorable ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                            {parseFloat(row.variance_pct) > 0 ? "+" : ""}{row.variance_pct}%
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "10px",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                backgroundColor: row.audit_status === "COMPLETED" ? "rgba(82, 196, 26, 0.15)" : "rgba(255, 77, 79, 0.15)",
                                color: row.audit_status === "COMPLETED" ? "#52c41a" : "#ff4d4f"
                              }}
                            >
                              {row.audit_status}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.72rem", color: COLORS.textMuted, marginTop: "2px" }}>
                            By: {row.auditor_name}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Invocations */}
      <NewEmployeeModal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        onSuccess={loadData}
      />

      <RecordAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        onSuccess={loadData}
        employees={employees}
        initialDate={attendanceDate}
      />

      <ApplyLeaveModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSuccess={loadData}
        employees={employees}
      />

      <ExecuteNightAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
