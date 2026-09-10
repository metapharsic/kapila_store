const db = require('../db');

jest.mock('../services/permissionService', () => ({
  getDepartmentNames: jest.fn().mockResolvedValue(null),
  assertDepartmentAccess: jest.fn().mockResolvedValue(undefined),
  applyDepartmentScope: jest.fn((query) => query),
}));
jest.mock('../services/auditService', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/kafkaProducer', () => ({
  sendStockEvent: jest.fn().mockResolvedValue(undefined),
  sendAlertEvent: jest.fn().mockResolvedValue(undefined),
  sendIndentEvent: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(undefined),
}));

const staffHrmsService = require('../services/staffHrmsService');
const staffHrmsController = require('../controllers/staffHrmsController');
const nightAuditService = require('../services/nightAuditService');
const nightAuditController = require('../controllers/nightAuditController');
const ExcelJS = require('exceljs');

describe('Staff HRMS, Split-Shifts & Midnight Night Audit Phase 5 Suite', () => {
  let createdEmployeeId = null;
  let createdLeaveId = null;
  let createdAuditDate = '2026-09-07';

  afterAll(async () => {
    try {
      if (createdEmployeeId) {
        await db('staff_attendance').where('employee_id', createdEmployeeId).del();
        await db('staff_leaves').where('employee_id', createdEmployeeId).del();
        await db('staff_employees').where('id', createdEmployeeId).del();
      }
      if (createdLeaveId) {
        await db('staff_leaves').where('id', createdLeaveId).del();
      }
      if (createdAuditDate) {
        await db('daily_night_audit_logs').where('audit_date', createdAuditDate).del();
      }
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await db.destroy();
  });

  describe('1. Hotel & Kitchen Staff HRMS Directory', () => {
    it('should list seeded staff employee profiles', async () => {
      const res = await staffHrmsService.listEmployees({}, { page: 1, limit: 10 });
      expect(res.total).toBeGreaterThanOrEqual(6);
      expect(res.summary.active_count).toBeGreaterThanOrEqual(5);

      const leadChef = res.rows.find(e => e.emp_code === 'EMP-KAP-001');
      expect(leadChef).toBeDefined();
      expect(leadChef.first_name).toBe('Kiran');
      expect(leadChef.department).toBe('MANAGEMENT');
      expect(parseFloat(leadChef.basic_salary)).toBe(65000.00);
    });

    it('should onboard a new kitchen crew member with sequential emp_code', async () => {
      const emp = await staffHrmsService.createEmployee({
        first_name: 'Venkatesh',
        last_name: 'Naidu',
        department: 'CHAT & SOFTY',
        designation: 'Pani Puri & Chaat Master',
        phone: '9848099881',
        email: 'venky.chaat@hotelkapila.com',
        salary_type: 'DAILY_WAGE',
        daily_wage: 950.00,
        notes: 'Evening high-speed chaat counter operations.'
      }, { name: 'Executive Chef' });

      expect(emp).toBeDefined();
      expect(emp.id).toBeTruthy();
      expect(emp.emp_code).toMatch(/^EMP-KAP-\d{3}$/);
      expect(emp.status).toBe('ACTIVE');
      expect(parseFloat(emp.daily_wage)).toBe(950.00);

      createdEmployeeId = emp.id;
    });

    it('should update employee wages and designation', async () => {
      const updated = await staffHrmsService.updateEmployee(createdEmployeeId, {
        designation: 'Senior Chaat & Snack Specialist',
        daily_wage: 1050.00
      });

      expect(updated.designation).toBe('Senior Chaat & Snack Specialist');
      expect(parseFloat(updated.daily_wage)).toBe(1050.00);
    });
  });

  describe('2. Shift Attendance Register & Split-Shift Timing', () => {
    it('should record split-shift attendance with dual in/out slots', async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const record = await staffHrmsService.recordAttendance({
        attendance_date: todayStr,
        employee_id: createdEmployeeId,
        shift_type: 'SPLIT',
        in_time_1: '07:00',
        out_time_1: '11:00',
        in_time_2: '16:30',
        out_time_2: '22:30',
        status: 'PRESENT',
        overtime_hours: 1.5,
        notes: 'Extended evening service for weekend chaat rush.'
      }, { name: 'Shift Supervisor' });

      expect(record).toBeDefined();
      expect(record.shift_type).toBe('SPLIT');
      expect(record.in_time_1).toBe('07:00');
      expect(record.out_time_2).toBe('22:30');
      expect(parseFloat(record.overtime_hours)).toBe(1.5);
      expect(record.status).toBe('PRESENT');
    });

    it('should list attendance and aggregate shift metrics', async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await staffHrmsService.listAttendance({ date: todayStr }, { page: 1, limit: 20 });
      expect(res.total).toBeGreaterThanOrEqual(1);
      expect(res.summary).toBeDefined();
      expect(res.summary.present_count).toBeGreaterThanOrEqual(1);
      expect(res.summary.split_count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Staff Leaves & Management Review Workflow', () => {
    it('should apply for casual staff leave in PENDING status', async () => {
      const leave = await staffHrmsService.applyLeave({
        employee_id: createdEmployeeId,
        leave_type: 'CASUAL_LEAVE',
        start_date: '2026-09-15',
        end_date: '2026-09-16',
        total_days: 2.0,
        reason: 'Family temple visit'
      }, { name: 'Venkatesh Naidu' });

      expect(leave).toBeDefined();
      expect(leave.id).toBeTruthy();
      expect(leave.status).toBe('PENDING');
      expect(parseFloat(leave.total_days)).toBe(2.0);

      createdLeaveId = leave.id;
    });

    it('should approve leave request with supervisor audit', async () => {
      const approved = await staffHrmsService.reviewLeave(createdLeaveId, {
        status: 'APPROVED'
      }, { name: 'Kiran Varma (Executive Chef)' });

      expect(approved.status).toBe('APPROVED');
      expect(approved.approved_by).toBe('Kiran Varma (Executive Chef)');
    });
  });

  describe('4. Midnight Food Cost Night Audit & Daily Rollover', () => {
    it('should generate dynamic audit preview for yesterday', async () => {
      const preview = await nightAuditService.getDailyAuditPreview('2026-09-07', 140000.00);
      expect(preview).toBeDefined();
      expect(preview.audit_date).toBe('2026-09-07');
      expect(typeof preview.total_kitchen_direct_cost).toBe('number');
      expect(typeof preview.food_cost_percentage).toBe('number');
      expect(preview.target_food_cost_pct).toBe(32.00);
      expect(Array.isArray(preview.department_breakdown)).toBe(true);
      expect(preview.department_breakdown.length).toBe(9); // All 9 canonical departments
    });

    it('should execute and lock the daily night audit', async () => {
      const audit = await nightAuditService.executeNightAudit({
        audit_date: createdAuditDate,
        total_material_issued_cost: 39500.00,
        total_food_waste_cost: 1450.00,
        total_food_revenue: 140000.00,
        target_food_cost_pct: 32.00,
        department_breakdown: [
          { department: 'TIFFINS', issued_cost: 12000, waste_cost: 300, direct_cost: 12300 },
          { department: 'NORTH INDIAN', issued_cost: 10500, waste_cost: 450, direct_cost: 10950 }
        ],
        rollover_notes: 'Automated midnight audit passed. Material store issues locked.'
      }, { name: 'Night Auditor Rajesh' });

      expect(audit).toBeDefined();
      expect(audit.id).toBeTruthy();
      expect(parseFloat(audit.total_kitchen_direct_cost)).toBe(40950.00);
      expect(parseFloat(audit.food_cost_percentage)).toBe(29.25);
      expect(parseFloat(audit.variance_pct)).toBe(-2.75); // 29.25% - 32.00% = -2.75% (Favorable)
      expect(audit.audit_status).toBe('COMPLETED');
      expect(audit.auditor_name).toBe('Night Auditor Rajesh');
    });

    it('should retrieve night audit telemetry and KPI metrics', async () => {
      const telem = await nightAuditService.getNightAuditTelemetry();
      expect(telem).toBeDefined();
      expect(telem.total_audits).toBeGreaterThanOrEqual(1);
      expect(telem.compliant_audits).toBeGreaterThanOrEqual(1);
      expect(telem.latest_audit).toBeDefined();
    });
  });

  describe('5. Professional Multi-Sheet Excel Streaming Exports', () => {
    it('should stream a valid 2-sheet Staff Roster & Attendance workbook', async () => {
      const req = { query: {} };
      const chunks = [];
      const res = {
        setHeader: jest.fn(),
        write: jest.fn((chunk) => chunks.push(chunk)),
        end: jest.fn()
      };

      await staffHrmsController.exportExcel(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('Kapila_Staff_Roster_and_Attendance_')
      );

      const buffer = Buffer.concat(chunks);
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      expect(workbook.worksheets.length).toBe(2);
      expect(workbook.getWorksheet('Staff Directory & Wages')).toBeDefined();
      expect(workbook.getWorksheet('Shift Attendance Register')).toBeDefined();
    });

    it('should stream a valid 2-sheet Food Cost Night Audit workbook', async () => {
      const req = { query: {} };
      const chunks = [];
      const res = {
        setHeader: jest.fn(),
        write: jest.fn((chunk) => chunks.push(chunk)),
        end: jest.fn()
      };

      await nightAuditController.exportExcel(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('Kapila_Food_Cost_Night_Audit_Report_')
      );

      const buffer = Buffer.concat(chunks);
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      expect(workbook.worksheets.length).toBe(2);
      expect(workbook.getWorksheet('Night Audit Ledger')).toBeDefined();
      expect(workbook.getWorksheet('Department Cost Breakdown')).toBeDefined();
    });
  });
});
