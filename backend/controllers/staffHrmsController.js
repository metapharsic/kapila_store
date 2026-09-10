const staffHrmsService = require("../services/staffHrmsService");
const ExcelJS = require("exceljs");

/**
 * staffHrmsController.js
 * Controller for Hotel Staff HRMS, Split-Shift Attendance, Leaves, and Excel Exports
 */

async function listEmployees(req, res, next) {
  try {
    const { department, status, salary_type, search } = req.query;
    const pagination = req.pagination || { page: 1, limit: 50 };
    const result = await staffHrmsService.listEmployees(
      { department, status, salary_type, search },
      pagination
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createEmployee(req, res, next) {
  try {
    const employee = await staffHrmsService.createEmployee(req.body, req.user || {});
    res.status(201).json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const updated = await staffHrmsService.updateEmployee(req.params.id, req.body, req.user || {});
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function listAttendance(req, res, next) {
  try {
    const { date, department, shift_type, status } = req.query;
    const pagination = req.pagination || { page: 1, limit: 50 };
    const result = await staffHrmsService.listAttendance(
      { date, department, shift_type, status },
      pagination
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function recordAttendance(req, res, next) {
  try {
    const record = await staffHrmsService.recordAttendance(req.body, req.user || {});
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

async function listLeaves(req, res, next) {
  try {
    const { status, employee_id } = req.query;
    const pagination = req.pagination || { page: 1, limit: 30 };
    const result = await staffHrmsService.listLeaves({ status, employee_id }, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function applyLeave(req, res, next) {
  try {
    const leave = await staffHrmsService.applyLeave(req.body, req.user || {});
    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
}

async function reviewLeave(req, res, next) {
  try {
    const updated = await staffHrmsService.reviewLeave(req.params.id, req.body, req.user || {});
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const employeesRes = await staffHrmsService.listEmployees({}, { page: 1, limit: 500 });
    const attendanceRes = await staffHrmsService.listAttendance({ date: req.query.date }, { page: 1, limit: 500 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Kapila HRMS & Kitchen Operations";
    workbook.created = new Date();

    // Sheet 1: Staff Directory & Wages
    const sheet1 = workbook.addWorksheet("Staff Directory & Wages", {
      views: [{ showGridLines: true }]
    });

    sheet1.columns = [
      { header: "Emp Code", key: "emp_code", width: 16 },
      { header: "First Name", key: "first_name", width: 16 },
      { header: "Last Name", key: "last_name", width: 16 },
      { header: "Department", key: "department", width: 22 },
      { header: "Designation", key: "designation", width: 26 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Status", key: "status", width: 14 },
      { header: "Salary Type", key: "salary_type", width: 16 },
      { header: "Basic Salary (₹)", key: "basic_salary", width: 18 },
      { header: "Daily Wage (₹)", key: "daily_wage", width: 16 },
      { header: "Joining Date", key: "joining_date", width: 16 }
    ];

    sheet1.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet1.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    employeesRes.rows.forEach((emp) => {
      sheet1.addRow({
        emp_code: emp.emp_code,
        first_name: emp.first_name,
        last_name: emp.last_name,
        department: emp.department,
        designation: emp.designation,
        phone: emp.phone || "-",
        status: emp.status,
        salary_type: emp.salary_type,
        basic_salary: parseFloat(emp.basic_salary) || 0,
        daily_wage: parseFloat(emp.daily_wage) || 0,
        joining_date: emp.joining_date ? String(emp.joining_date).slice(0, 10) : "-"
      });
    });

    // Sheet 2: Shift Attendance Register
    const sheet2 = workbook.addWorksheet("Shift Attendance Register", {
      views: [{ showGridLines: true }]
    });

    sheet2.columns = [
      { header: "Date", key: "attendance_date", width: 14 },
      { header: "Emp Code", key: "emp_code", width: 15 },
      { header: "Employee Name", key: "employee_name", width: 24 },
      { header: "Department", key: "department", width: 20 },
      { header: "Shift Type", key: "shift_type", width: 16 },
      { header: "Slot 1 (In - Out)", key: "slot1", width: 20 },
      { header: "Slot 2 Split (In - Out)", key: "slot2", width: 22 },
      { header: "Status", key: "status", width: 14 },
      { header: "OT Hours", key: "overtime_hours", width: 14 },
      { header: "Recorded By", key: "recorded_by", width: 20 }
    ];

    sheet2.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

    attendanceRes.rows.forEach((att) => {
      sheet2.addRow({
        attendance_date: att.attendance_date ? String(att.attendance_date).slice(0, 10) : "-",
        emp_code: att.emp_code,
        employee_name: `${att.first_name} ${att.last_name}`,
        department: att.department,
        shift_type: att.shift_type,
        slot1: att.in_time_1 ? `${att.in_time_1} - ${att.out_time_1 || "Ongoing"}` : "-",
        slot2: att.in_time_2 ? `${att.in_time_2} - ${att.out_time_2 || "Ongoing"}` : "-",
        status: att.status,
        overtime_hours: parseFloat(att.overtime_hours) || 0,
        recorded_by: att.recorded_by
      });
    });

    const filename = `Kapila_Staff_Roster_and_Attendance_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEmployees,
  createEmployee,
  updateEmployee,
  listAttendance,
  recordAttendance,
  listLeaves,
  applyLeave,
  reviewLeave,
  exportExcel
};
