/**
 * 061_create_staff_hrms_and_night_audit.js
 * Migration for Phase 5: Staff HRMS, Kitchen Split-Shift Attendance, Leaves, and Midnight Food Cost Night Audit Engine
 */

exports.up = async function (knex) {
  // 1. Create staff_employees
  const hasEmployees = await knex.schema.hasTable("staff_employees");
  if (!hasEmployees) {
    await knex.schema.createTable("staff_employees", (table) => {
      table.bigIncrements("id").primary();
      table.string("emp_code", 50).notNullable().unique().index();
      table.string("first_name", 100).notNullable();
      table.string("last_name", 100).notNullable();
      table.string("department", 100).notNullable().index(); // TIFFINS, NORTH INDIAN, CHINESE & DOSA, etc.
      table.string("designation", 100).notNullable(); // Executive Chef, Dosa Master, etc.
      table.string("phone", 50).nullable();
      table.string("email", 150).nullable();
      table.string("aadhaar_last4", 10).nullable();
      table.date("joining_date").notNullable().defaultTo(knex.fn.now());
      table.string("status", 50).notNullable().defaultTo("ACTIVE").index(); // ACTIVE, ON_LEAVE, RESIGNED, TERMINATED
      table.string("salary_type", 50).notNullable().defaultTo("MONTHLY"); // MONTHLY, DAILY_WAGE
      table.decimal("basic_salary", 12, 2).notNullable().defaultTo(0);
      table.decimal("daily_wage", 10, 2).notNullable().defaultTo(0);
      table.string("emergency_contact", 150).nullable();
      table.text("notes").nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 061] Created table 'staff_employees'.");
  }

  // 2. Create staff_attendance
  const hasAttendance = await knex.schema.hasTable("staff_attendance");
  if (!hasAttendance) {
    await knex.schema.createTable("staff_attendance", (table) => {
      table.bigIncrements("id").primary();
      table.date("attendance_date").notNullable().index();
      table.bigInteger("employee_id").notNullable().references("id").inTable("staff_employees").onDelete("CASCADE");
      table.string("shift_type", 50).notNullable().defaultTo("SPLIT"); // MORNING, EVENING, NIGHT, SPLIT, GENERAL
      table.string("in_time_1", 20).nullable(); // Slot 1 in (e.g. 06:30)
      table.string("out_time_1", 20).nullable(); // Slot 1 out (e.g. 11:30)
      table.string("in_time_2", 20).nullable(); // Slot 2 in for Split Shift (e.g. 17:30)
      table.string("out_time_2", 20).nullable(); // Slot 2 out for Split Shift (e.g. 22:30)
      table.string("status", 50).notNullable().defaultTo("PRESENT").index(); // PRESENT, HALF_DAY, ABSENT, PAID_LEAVE, WEEK_OFF
      table.decimal("overtime_hours", 5, 2).notNullable().defaultTo(0);
      table.text("notes").nullable();
      table.string("recorded_by", 100).notNullable().defaultTo("Store Manager");
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table.unique(["attendance_date", "employee_id"]);
    });
    console.log("[Migration 061] Created table 'staff_attendance'.");
  }

  // 3. Create staff_leaves
  const hasLeaves = await knex.schema.hasTable("staff_leaves");
  if (!hasLeaves) {
    await knex.schema.createTable("staff_leaves", (table) => {
      table.bigIncrements("id").primary();
      table.bigInteger("employee_id").notNullable().references("id").inTable("staff_employees").onDelete("CASCADE");
      table.string("leave_type", 50).notNullable().defaultTo("CASUAL_LEAVE"); // CASUAL_LEAVE, SICK_LEAVE, COMPENSATORY_OFF, FESTIVAL_OFF
      table.date("start_date").notNullable().index();
      table.date("end_date").notNullable().index();
      table.decimal("total_days", 4, 1).notNullable().defaultTo(1.0);
      table.text("reason").notNullable();
      table.string("status", 50).notNullable().defaultTo("PENDING").index(); // PENDING, APPROVED, REJECTED
      table.string("approved_by", 100).nullable();
      table.text("rejection_reason").nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 061] Created table 'staff_leaves'.");
  }

  // 4. Create daily_night_audit_logs
  const hasNightAudit = await knex.schema.hasTable("daily_night_audit_logs");
  if (!hasNightAudit) {
    await knex.schema.createTable("daily_night_audit_logs", (table) => {
      table.bigIncrements("id").primary();
      table.date("audit_date").notNullable().unique().index();
      table.decimal("total_material_issued_cost", 12, 2).notNullable().defaultTo(0);
      table.decimal("total_food_waste_cost", 12, 2).notNullable().defaultTo(0);
      table.decimal("total_kitchen_direct_cost", 12, 2).notNullable().defaultTo(0); // issues + waste
      table.decimal("total_food_revenue", 12, 2).notNullable().defaultTo(0);
      table.decimal("food_cost_percentage", 5, 2).notNullable().defaultTo(0);
      table.decimal("target_food_cost_pct", 5, 2).notNullable().defaultTo(32.00);
      table.decimal("variance_pct", 5, 2).notNullable().defaultTo(0);
      table.jsonb("department_breakdown").notNullable().defaultTo(JSON.stringify([]));
      table.jsonb("discrepancies_flagged").notNullable().defaultTo(JSON.stringify([]));
      table.string("audit_status", 50).notNullable().defaultTo("COMPLETED").index(); // COMPLETED, FLAGGED_DISCREPANCY
      table.string("auditor_name", 100).notNullable();
      table.text("rollover_notes").nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 061] Created table 'daily_night_audit_logs'.");
  }

  // 5. Seed initial staff profiles
  const employeeCount = await knex("staff_employees").count("id as count").first();
  if (parseInt(employeeCount ? employeeCount.count : 0, 10) === 0) {
    const seededEmployees = [
      {
        emp_code: "EMP-KAP-001",
        first_name: "Kiran",
        last_name: "Varma",
        department: "MANAGEMENT",
        designation: "Executive Chef & F&B Director",
        phone: "9848011201",
        email: "kiran.chef@hotelkapila.com",
        aadhaar_last4: "4921",
        joining_date: "2024-01-15",
        status: "ACTIVE",
        salary_type: "MONTHLY",
        basic_salary: 65000.00,
        daily_wage: 0,
        emergency_contact: "Padma Varma (Wife) - 9848011202",
        notes: "Master culinary lead across all 9 commercial kitchens."
      },
      {
        emp_code: "EMP-KAP-002",
        first_name: "Ramesh",
        last_name: "Goud",
        department: "TIFFINS",
        designation: "Head Tiffins & Idli Master",
        phone: "9848011203",
        email: null,
        aadhaar_last4: "8832",
        joining_date: "2024-02-01",
        status: "ACTIVE",
        salary_type: "MONTHLY",
        basic_salary: 32000.00,
        daily_wage: 0,
        emergency_contact: "S. Goud (Brother) - 9848011204",
        notes: "Expert in early morning South Indian fermentation and sambar formulation."
      },
      {
        emp_code: "EMP-KAP-003",
        first_name: "Suresh",
        last_name: "Kondapalli",
        department: "CHINESE & DOSA",
        designation: "Senior Dosa Specialist",
        phone: "9848011205",
        email: null,
        aadhaar_last4: "1920",
        joining_date: "2024-03-10",
        status: "ACTIVE",
        salary_type: "MONTHLY",
        basic_salary: 28000.00,
        daily_wage: 0,
        emergency_contact: "B. Kondapalli - 9848011206",
        notes: "Operates 4-foot griddle station during split breakfast and dinner rush."
      },
      {
        emp_code: "EMP-KAP-004",
        first_name: "Manpreet",
        last_name: "Singh",
        department: "NORTH INDIAN",
        designation: "Tandoori & Curry Master",
        phone: "9848011207",
        email: null,
        aadhaar_last4: "7711",
        joining_date: "2024-04-01",
        status: "ACTIVE",
        salary_type: "MONTHLY",
        basic_salary: 34000.00,
        daily_wage: 0,
        emergency_contact: "K. Singh - 9848011208",
        notes: "Clay oven kebabs, gravies, and naan prep."
      },
      {
        emp_code: "EMP-KAP-005",
        first_name: "Anjaneyulu",
        last_name: "Palla",
        department: "CENTRAL_STORE",
        designation: "Senior Storekeeper",
        phone: "9848011209",
        email: "store@hotelkapila.com",
        aadhaar_last4: "3391",
        joining_date: "2023-11-01",
        status: "ACTIVE",
        salary_type: "MONTHLY",
        basic_salary: 30000.00,
        daily_wage: 0,
        emergency_contact: "L. Palla - 9848011210",
        notes: "Custodian of bulk dry store, cold storage, and stock ledger."
      },
      {
        emp_code: "EMP-KAP-006",
        first_name: "Chinna",
        last_name: "Rao",
        department: "SI-MEALS",
        designation: "Kitchen Commis & Prep Helper",
        phone: "9848011211",
        email: null,
        aadhaar_last4: "6612",
        joining_date: "2024-05-15",
        status: "ACTIVE",
        salary_type: "DAILY_WAGE",
        basic_salary: 0,
        daily_wage: 850.00,
        emergency_contact: "V. Rao - 9848011212",
        notes: "Daily vegetable cutting and pot assistance."
      }
    ];

    const insertedEmployees = await knex("staff_employees").insert(seededEmployees).returning(["id", "emp_code"]);
    console.log(`[Migration 061] Seeded ${insertedEmployees.length} staff employee profiles.`);

    // Seed sample attendance for today
    const todayStr = new Date().toISOString().slice(0, 10);
    const empMap = {};
    insertedEmployees.forEach((e) => { empMap[e.emp_code] = e.id; });

    const seededAttendance = [
      {
        attendance_date: todayStr,
        employee_id: empMap["EMP-KAP-001"],
        shift_type: "GENERAL",
        in_time_1: "08:45",
        out_time_1: "18:15",
        in_time_2: null,
        out_time_2: null,
        status: "PRESENT",
        overtime_hours: 0.5,
        notes: "Overseeing kitchen menu standardizations.",
        recorded_by: "Store Manager"
      },
      {
        attendance_date: todayStr,
        employee_id: empMap["EMP-KAP-002"],
        shift_type: "SPLIT",
        in_time_1: "06:15",
        out_time_1: "11:45",
        in_time_2: "17:15",
        out_time_2: "22:15",
        status: "PRESENT",
        overtime_hours: 1.0,
        notes: "Morning breakfast shift + evening rush completed on schedule.",
        recorded_by: "Store Manager"
      },
      {
        attendance_date: todayStr,
        employee_id: empMap["EMP-KAP-003"],
        shift_type: "SPLIT",
        in_time_1: "06:30",
        out_time_1: "11:30",
        in_time_2: "17:30",
        out_time_2: "22:30",
        status: "PRESENT",
        overtime_hours: 0,
        notes: "Dosa griddle active for both services.",
        recorded_by: "Store Manager"
      },
      {
        attendance_date: todayStr,
        employee_id: empMap["EMP-KAP-004"],
        shift_type: "EVENING",
        in_time_1: "13:45",
        out_time_1: "22:30",
        in_time_2: null,
        out_time_2: null,
        status: "PRESENT",
        overtime_hours: 0.5,
        notes: "Dinner tandoor service.",
        recorded_by: "Store Manager"
      },
      {
        attendance_date: todayStr,
        employee_id: empMap["EMP-KAP-005"],
        shift_type: "GENERAL",
        in_time_1: "08:30",
        out_time_1: "18:00",
        in_time_2: null,
        out_time_2: null,
        status: "PRESENT",
        overtime_hours: 0,
        notes: "General store receiving and stock reconciliations.",
        recorded_by: "Store Manager"
      }
    ];

    await knex("staff_attendance").insert(seededAttendance);
    console.log(`[Migration 061] Seeded ${seededAttendance.length} staff attendance records.`);

    // Seed sample approved leave
    await knex("staff_leaves").insert({
      employee_id: empMap["EMP-KAP-006"],
      leave_type: "CASUAL_LEAVE",
      start_date: todayStr,
      end_date: todayStr,
      total_days: 1.0,
      reason: "Family function in hometown",
      status: "APPROVED",
      approved_by: "Kiran Varma (Executive Chef)"
    });
    console.log("[Migration 061] Seeded sample staff leave record.");

    // Seed recent baseline night audit record
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await knex("daily_night_audit_logs").insert({
      audit_date: yesterdayStr,
      total_material_issued_cost: 38450.00,
      total_food_waste_cost: 1620.00,
      total_kitchen_direct_cost: 40070.00,
      total_food_revenue: 135000.00,
      food_cost_percentage: 29.68,
      target_food_cost_pct: 32.00,
      variance_pct: -2.32,
      department_breakdown: JSON.stringify([
        { department: "TIFFINS", issued_cost: 11200.00, waste_cost: 350.00, food_cost: 11550.00 },
        { department: "NORTH INDIAN", issued_cost: 9800.00, waste_cost: 420.00, food_cost: 10220.00 },
        { department: "CHINESE & DOSA", issued_cost: 7400.00, waste_cost: 280.00, food_cost: 7680.00 },
        { department: "SI-MEALS", issued_cost: 6550.00, waste_cost: 310.00, food_cost: 6860.00 },
        { department: "MOCKTAILS & CONTINENTAL", issued_cost: 3500.00, waste_cost: 260.00, food_cost: 3760.00 }
      ]),
      discrepancies_flagged: JSON.stringify([]),
      audit_status: "COMPLETED",
      auditor_name: "Store Manager",
      rollover_notes: "Daily food cost closed at 29.68% (favorable by 2.32% under 32.00% benchmark). All stock balances locked."
    });
    console.log("[Migration 061] Seeded yesterday's closed night audit log.");
  }

  // 6. Seed RBAC Permissions for Staff HRMS & Night Audit
  const permissionsToAdd = [
    { key: "staff.view", resource: "staff", action: "view", label: "View Staff Directory & Roster" },
    { key: "staff.create", resource: "staff", action: "create", label: "Create and Onboard Employees" },
    { key: "staff.manage", resource: "staff", action: "manage", label: "Manage Staff Profiles and Wages" },
    { key: "attendance.view", resource: "attendance", action: "view", label: "View Staff Shift Attendance" },
    { key: "attendance.record", resource: "attendance", action: "record", label: "Punch & Record Shift Attendance" },
    { key: "night_audit.view", resource: "night_audit", action: "view", label: "View Daily Night Audit Logs" },
    { key: "night_audit.execute", resource: "night_audit", action: "execute", label: "Execute Midnight Food Cost Audit" },
    { key: "night_audit.export", resource: "night_audit", action: "export", label: "Export Staff & Audit Excel" }
  ];

  for (const perm of permissionsToAdd) {
    const existing = await knex("permissions").where("key", perm.key).first();
    if (!existing) {
      const [newPerm] = await knex("permissions").insert(perm).returning("id");
      const permId = typeof newPerm === "object" ? newPerm.id : newPerm;

      const rolesToAssign = await knex("roles").whereIn("key", ["admin", "store_manager", "manager", "chef"]).select("id");
      for (const r of rolesToAssign) {
        await knex("role_permissions")
          .insert({ role_id: r.id, permission_id: permId })
          .onConflict(["role_id", "permission_id"])
          .ignore();
      }
    }
  }
  console.log("[Migration 061] Successfully mapped Phase 5 permissions to roles.");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("daily_night_audit_logs");
  await knex.schema.dropTableIfExists("staff_leaves");
  await knex.schema.dropTableIfExists("staff_attendance");
  await knex.schema.dropTableIfExists("staff_employees");
  console.log("[Migration 061] Reverted Phase 5 HRMS and Night Audit tables.");
};
