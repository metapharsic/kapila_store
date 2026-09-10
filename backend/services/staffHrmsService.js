const db = require("../db");

/**
 * staffHrmsService.js
 * Core service for Hotel & Kitchen Crew HRMS, Split-Shift Rostering, and Leaves
 */

/**
 * Generate sequential Employee Code (e.g. EMP-KAP-007)
 */
async function generateNextEmpCode(trxOrDb = db) {
  const lastEmp = await trxOrDb("staff_employees")
    .where("emp_code", "like", "EMP-KAP-%")
    .orderBy("id", "desc")
    .first();

  let nextSeq = 1;
  if (lastEmp && lastEmp.emp_code) {
    const parts = lastEmp.emp_code.split("-");
    const parsed = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }
  return `EMP-KAP-${String(nextSeq).padStart(3, "0")}`;
}

/**
 * List employees with search, department filtering, and pagination
 */
async function listEmployees(filters = {}, pagination = { page: 1, limit: 50 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 50));
  const offset = (page - 1) * limit;

  let query = trxOrDb("staff_employees");

  if (filters.department && filters.department !== "ALL") {
    query = query.where("department", filters.department);
  }
  if (filters.status && filters.status !== "ALL") {
    query = query.where("status", filters.status);
  }
  if (filters.salary_type) {
    query = query.where("salary_type", filters.salary_type);
  }
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.where((builder) => {
      builder
        .whereILike("emp_code", term)
        .orWhereILike("first_name", term)
        .orWhereILike("last_name", term)
        .orWhereILike("designation", term)
        .orWhereILike("phone", term);
    });
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("status", "asc")
    .orderBy("id", "asc")
    .limit(limit)
    .offset(offset);

  const [aggregates] = await trxOrDb("staff_employees").select(
    trxOrDb.raw("COUNT(*) as total_count"),
    trxOrDb.raw("COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_count"),
    trxOrDb.raw("COALESCE(SUM(CASE WHEN salary_type = 'MONTHLY' AND status = 'ACTIVE' THEN basic_salary END), 0) as monthly_payroll_total")
  );

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      total_employees: parseInt(aggregates ? aggregates.total_count : 0, 10),
      active_count: parseInt(aggregates ? aggregates.active_count : 0, 10),
      monthly_payroll_total: parseFloat(aggregates ? aggregates.monthly_payroll_total : 0) || 0
    }
  };
}

/**
 * Onboard a new hotel/kitchen employee
 */
async function createEmployee(data, user = {}, trxOrDb = db) {
  if (!data.first_name || !data.first_name.trim()) throw new Error("First name is required");
  if (!data.last_name || !data.last_name.trim()) throw new Error("Last name is required");
  if (!data.department) throw new Error("Department is required");
  if (!data.designation || !data.designation.trim()) throw new Error("Designation is required");

  return await db.transaction(async (trx) => {
    const empCode = data.emp_code ? data.emp_code.trim() : await generateNextEmpCode(trx);

    const [employee] = await trx("staff_employees")
      .insert({
        emp_code: empCode,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        department: data.department,
        designation: data.designation.trim(),
        phone: data.phone ? data.phone.trim() : null,
        email: data.email ? data.email.trim() : null,
        aadhaar_last4: data.aadhaar_last4 ? data.aadhaar_last4.trim() : null,
        joining_date: data.joining_date || new Date().toISOString().slice(0, 10),
        status: data.status || "ACTIVE",
        salary_type: data.salary_type || "MONTHLY",
        basic_salary: parseFloat(data.basic_salary) || 0,
        daily_wage: parseFloat(data.daily_wage) || 0,
        emergency_contact: data.emergency_contact ? data.emergency_contact.trim() : null,
        notes: data.notes ? data.notes.trim() : null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("*");

    return employee;
  });
}

/**
 * Update employee profile
 */
async function updateEmployee(id, data, user = {}, trxOrDb = db) {
  return await db.transaction(async (trx) => {
    const existing = await trx("staff_employees").where("id", id).first();
    if (!existing) throw new Error(`Employee with ID ${id} not found`);

    const updatePayload = {
      updated_at: new Date()
    };

    if (data.first_name !== undefined) updatePayload.first_name = data.first_name.trim();
    if (data.last_name !== undefined) updatePayload.last_name = data.last_name.trim();
    if (data.department !== undefined) updatePayload.department = data.department;
    if (data.designation !== undefined) updatePayload.designation = data.designation.trim();
    if (data.phone !== undefined) updatePayload.phone = data.phone ? data.phone.trim() : null;
    if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim() : null;
    if (data.aadhaar_last4 !== undefined) updatePayload.aadhaar_last4 = data.aadhaar_last4 ? data.aadhaar_last4.trim() : null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.salary_type !== undefined) updatePayload.salary_type = data.salary_type;
    if (data.basic_salary !== undefined) updatePayload.basic_salary = parseFloat(data.basic_salary) || 0;
    if (data.daily_wage !== undefined) updatePayload.daily_wage = parseFloat(data.daily_wage) || 0;
    if (data.emergency_contact !== undefined) updatePayload.emergency_contact = data.emergency_contact;
    if (data.notes !== undefined) updatePayload.notes = data.notes;

    const [updated] = await trx("staff_employees")
      .where("id", id)
      .update(updatePayload)
      .returning("*");

    return updated;
  });
}

/**
 * List shift attendance logs with staff joins
 */
async function listAttendance(filters = {}, pagination = { page: 1, limit: 50 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 50));
  const offset = (page - 1) * limit;

  const targetDate = filters.date || new Date().toISOString().slice(0, 10);

  let query = trxOrDb("staff_attendance as a")
    .join("staff_employees as e", "a.employee_id", "e.id")
    .select(
      "a.*",
      "e.emp_code",
      "e.first_name",
      "e.last_name",
      "e.department",
      "e.designation",
      "e.salary_type"
    );

  if (targetDate) {
    query = query.where("a.attendance_date", targetDate);
  }
  if (filters.department && filters.department !== "ALL") {
    query = query.where("e.department", filters.department);
  }
  if (filters.shift_type) {
    query = query.where("a.shift_type", filters.shift_type);
  }
  if (filters.status) {
    query = query.where("a.status", filters.status);
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("a.id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("e.department", "asc")
    .orderBy("e.first_name", "asc")
    .limit(limit)
    .offset(offset);

  // Aggregates for the date
  const aggQuery = trxOrDb("staff_attendance")
    .where("attendance_date", targetDate)
    .select(
      trxOrDb.raw("COUNT(*) as total_marked"),
      trxOrDb.raw("COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present_count"),
      trxOrDb.raw("COUNT(CASE WHEN shift_type = 'SPLIT' THEN 1 END) as split_count"),
      trxOrDb.raw("COUNT(CASE WHEN status = 'HALF_DAY' THEN 1 END) as half_day_count"),
      trxOrDb.raw("COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent_count"),
      trxOrDb.raw("COALESCE(SUM(overtime_hours), 0) as total_ot_hours")
    );
  const [aggregates] = await aggQuery;

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    targetDate,
    summary: {
      total_marked: parseInt(aggregates ? aggregates.total_marked : 0, 10),
      present_count: parseInt(aggregates ? aggregates.present_count : 0, 10),
      split_count: parseInt(aggregates ? aggregates.split_count : 0, 10),
      half_day_count: parseInt(aggregates ? aggregates.half_day_count : 0, 10),
      absent_count: parseInt(aggregates ? aggregates.absent_count : 0, 10),
      total_ot_hours: parseFloat(aggregates ? aggregates.total_ot_hours : 0) || 0
    }
  };
}

/**
 * Record or update daily shift attendance (supports split shifts)
 */
async function recordAttendance(data, user = {}, trxOrDb = db) {
  if (!data.employee_id) throw new Error("Employee ID is required");
  const attendanceDate = data.attendance_date || new Date().toISOString().slice(0, 10);

  return await db.transaction(async (trx) => {
    const employee = await trx("staff_employees").where("id", data.employee_id).first();
    if (!employee) throw new Error(`Employee with ID ${data.employee_id} not found`);

    const shiftType = data.shift_type || "SPLIT";
    const status = data.status || "PRESENT";
    const otHours = parseFloat(data.overtime_hours) || 0;

    const payload = {
      attendance_date: attendanceDate,
      employee_id: data.employee_id,
      shift_type: shiftType,
      in_time_1: data.in_time_1 || null,
      out_time_1: data.out_time_1 || null,
      in_time_2: shiftType === "SPLIT" ? (data.in_time_2 || null) : null,
      out_time_2: shiftType === "SPLIT" ? (data.out_time_2 || null) : null,
      status,
      overtime_hours: otHours,
      notes: data.notes ? data.notes.trim() : null,
      recorded_by: data.recorded_by || user.name || "Store Manager",
      updated_at: new Date()
    };

    const existing = await trx("staff_attendance")
      .where({ attendance_date: attendanceDate, employee_id: data.employee_id })
      .first();

    if (existing) {
      const [updated] = await trx("staff_attendance")
        .where("id", existing.id)
        .update(payload)
        .returning("*");
      return updated;
    } else {
      payload.created_at = new Date();
      const [inserted] = await trx("staff_attendance")
        .insert(payload)
        .returning("*");
      return inserted;
    }
  });
}

/**
 * List staff leaves
 */
async function listLeaves(filters = {}, pagination = { page: 1, limit: 30 }, trxOrDb = db) {
  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 30));
  const offset = (page - 1) * limit;

  let query = trxOrDb("staff_leaves as l")
    .join("staff_employees as e", "l.employee_id", "e.id")
    .select(
      "l.*",
      "e.emp_code",
      "e.first_name",
      "e.last_name",
      "e.department",
      "e.designation"
    );

  if (filters.status && filters.status !== "ALL") {
    query = query.where("l.status", filters.status);
  }
  if (filters.employee_id) {
    query = query.where("l.employee_id", filters.employee_id);
  }

  const countRow = await query.clone().clearSelect().clearOrder().count("l.id as count").first();
  const total = parseInt(countRow ? countRow.count : 0, 10);

  const rows = await query
    .clone()
    .orderBy("l.start_date", "desc")
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Apply for leave
 */
async function applyLeave(data, user = {}, trxOrDb = db) {
  if (!data.employee_id) throw new Error("Employee ID is required");
  if (!data.start_date) throw new Error("Start date is required");
  if (!data.end_date) throw new Error("End date is required");
  if (!data.reason || !data.reason.trim()) throw new Error("Reason for leave is required");

  return await db.transaction(async (trx) => {
    const [leave] = await trx("staff_leaves")
      .insert({
        employee_id: data.employee_id,
        leave_type: data.leave_type || "CASUAL_LEAVE",
        start_date: data.start_date,
        end_date: data.end_date,
        total_days: parseFloat(data.total_days) || 1.0,
        reason: data.reason.trim(),
        status: "PENDING",
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning("*");

    return leave;
  });
}

/**
 * Review leave (approve/reject)
 */
async function reviewLeave(id, { status, rejection_reason }, user = {}, trxOrDb = db) {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Invalid leave status. Must be APPROVED or REJECTED");
  }

  return await db.transaction(async (trx) => {
    const existing = await trx("staff_leaves").where("id", id).first();
    if (!existing) throw new Error(`Leave request #${id} not found`);

    const [updated] = await trx("staff_leaves")
      .where("id", id)
      .update({
        status,
        approved_by: status === "APPROVED" ? (user.name || "Manager") : null,
        rejection_reason: status === "REJECTED" ? (rejection_reason || "Declined by management") : null,
        updated_at: new Date()
      })
      .returning("*");

    return updated;
  });
}

module.exports = {
  listEmployees,
  createEmployee,
  updateEmployee,
  listAttendance,
  recordAttendance,
  listLeaves,
  applyLeave,
  reviewLeave
};
