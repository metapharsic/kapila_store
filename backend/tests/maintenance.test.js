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

const maintenanceService = require('../services/maintenanceService');
const maintenanceController = require('../controllers/maintenanceController');
const ExcelJS = require('exceljs');

describe('Commercial Kitchen & Facility CMMS Phase 2 Suite', () => {
  const TEST_SPARE_CODE = 'SPARE_' + Math.floor(Date.now() % 10000000);
  let createdAssetId = null;
  let createdWoId = null;
  let testStockId = null;

  afterAll(async () => {
    try {
      // Clean up test spare part and ledger
      await db('stock_ledger').whereILike('item_code', 'SPARE_%').del();
      await db('maintenance_parts_consumed').whereILike('item_code', 'SPARE_%').del();
      if (testStockId) await db('stock').where('id', testStockId).del();
      if (createdWoId) await db('maintenance_work_orders').where('id', createdWoId).del();
      if (createdAssetId) await db('hotel_assets').where('id', createdAssetId).del();
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await db.destroy();
  });

  describe('1. Asset Registry & Seed Integrity', () => {
    it('should have seeded commercial kitchen equipment with valid operational statuses', async () => {
      const assetsList = await maintenanceService.listAssets({}, { page: 1, limit: 100 });
      expect(assetsList.total).toBeGreaterThanOrEqual(15);
      expect(assetsList.stats.total).toBeGreaterThanOrEqual(15);
      expect(assetsList.stats.operational).toBeGreaterThanOrEqual(10);

      // Verify specific seeded equipment
      const wokRange = assetsList.rows.find(a => a.asset_code === 'KPL-EQ-001');
      expect(wokRange).toBeDefined();
      expect(wokRange.department).toBe('CHINESE & DOSA');
      expect(wokRange.category).toBe('COOKING_RANGE');
      expect(wokRange.criticality).toBe('CRITICAL');
    });

    it('should create a new kitchen asset with auto-generated code and QR tag', async () => {
      const newAsset = await maintenanceService.createAsset({
        name: 'Automated Test Dough Proofer',
        department: 'TIFFINS',
        category: 'GRINDING_BAKERY',
        manufacturer: 'Proofer Tech Ltd',
        model_no: 'PT-100',
        criticality: 'HIGH'
      });

      expect(newAsset).toBeDefined();
      expect(newAsset.id).toBeTruthy();
      expect(newAsset.asset_code).toMatch(/^KPL-EQ-\d{3,}$/);
      expect(newAsset.qr_code).toBe(`kapila://asset/${newAsset.asset_code}`);
      expect(newAsset.status).toBe('OPERATIONAL');

      createdAssetId = newAsset.id;
    });
  });

  describe('2. Work Order Lifecycle & Breakdown Workflow', () => {
    it('should create a BREAKDOWN work order and automatically mark the machine as BREAKDOWN', async () => {
      const wo = await maintenanceService.createWorkOrder({
        asset_id: createdAssetId,
        order_type: 'BREAKDOWN',
        priority: 'CRITICAL',
        issue_description: 'Heating element burned out; temperature dropping rapidly.'
      }, { name: 'Chef Suresh' });

      expect(wo).toBeDefined();
      expect(wo.wo_number).toMatch(/^WO-\d{4}-\d{4}$/);
      expect(wo.status).toBe('OPEN');
      expect(wo.priority).toBe('CRITICAL');
      expect(wo.reported_by).toBe('Chef Suresh');

      createdWoId = wo.id;

      // Verify asset status updated to BREAKDOWN
      const asset = await db('hotel_assets').where('id', createdAssetId).first();
      expect(asset.status).toBe('BREAKDOWN');
    });

    it('should update work order status to IN_PROGRESS and mark machine UNDER_MAINTENANCE', async () => {
      const updated = await maintenanceService.updateWorkOrder(createdWoId, {
        status: 'IN_PROGRESS',
        assigned_to: 'Technician Rajesh'
      });

      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.assigned_to).toBe('Technician Rajesh');
      expect(updated.start_time).toBeDefined();

      // Verify asset status updated to UNDER_MAINTENANCE
      const asset = await db('hotel_assets').where('id', createdAssetId).first();
      expect(asset.status).toBe('UNDER_MAINTENANCE');
    });
  });

  describe('3. Store Spares Consumption & Double-Entry Ledger Linkage', () => {
    it('should deduct spare parts from store inventory and record OUTWARD_ISSUE in stock_ledger', async () => {
      // 1. Insert test spare part in store stock
      const [stk] = await db('stock')
        .insert({
          item_code: TEST_SPARE_CODE,
          name: 'Proofer Ceramic Heating Element 2kW',
          category: 'MAINTENANCE_SPARES',
          unit: 'pcs',
          qty: 10,
          remaining: 10,
          price: 450.00,
          date: '2026-09-08',
          supplier: 'Hotel Spares Direct'
        })
        .returning('*');

      testStockId = stk.id;

      // 2. Consume 2 units for the work order
      const result = await maintenanceService.consumeParts(
        createdWoId,
        [{
          stock_id: stk.id,
          item_code: stk.item_code,
          name: stk.name,
          qty: 2
        }],
        { name: 'Technician Rajesh' }
      );

      expect(result.parts.length).toBe(1);
      expect(Number(result.parts[0].qty)).toBe(2);
      expect(Number(result.parts[0].total_cost)).toBe(900.00);

      // Verify work order updated with parts cost
      expect(Number(result.workOrder.parts_cost)).toBe(900.00);
      expect(Number(result.workOrder.total_cost)).toBe(900.00);

      // 3. Verify stock table deduction
      const updatedStock = await db('stock').where('id', stk.id).first();
      expect(Number(updatedStock.remaining)).toBe(8);

      // 4. Verify immutable stock_ledger entry
      const ledgerRow = await db('stock_ledger')
        .where({
          item_code: TEST_SPARE_CODE,
          transaction_type: 'OUTWARD_ISSUE',
          reference_doc_type: 'MAINTENANCE'
        })
        .first();

      expect(ledgerRow).toBeDefined();
      expect(Number(ledgerRow.qty)).toBe(2);
      expect(Number(ledgerRow.total_value)).toBe(900.00);
      expect(Number(ledgerRow.balance_qty_before)).toBe(10);
      expect(Number(ledgerRow.balance_qty_after)).toBe(8);
      expect(String(ledgerRow.reference_doc_id)).toBe(String(createdWoId));
    });
  });

  describe('4. Work Order Completion & Machine Restoration', () => {
    it('should complete work order, compute downtime, and restore machine to OPERATIONAL', async () => {
      const completed = await maintenanceService.completeWorkOrder(createdWoId, {
        action_taken: 'Replaced ceramic heating element, calibrated thermostat, verified 38°C proofing temperature.',
        root_cause: 'Thermal fatigue on heating coil after continuous run.',
        labor_cost: 350.00
      }, { name: 'Technician Rajesh' });

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completed_at).toBeDefined();
      expect(completed.downtime_minutes).toBeGreaterThanOrEqual(0);
      expect(Number(completed.labor_cost)).toBe(350.00);
      expect(Number(completed.parts_cost)).toBe(900.00);
      expect(Number(completed.total_cost)).toBe(1250.00);

      // Verify asset restored to OPERATIONAL
      const asset = await db('hotel_assets').where('id', createdAssetId).first();
      expect(asset.status).toBe('OPERATIONAL');
    });
  });

  describe('5. Preventive Maintenance Schedules', () => {
    it('should list preventive routines and complete schedule with next due date rollover', async () => {
      const scheduleList = await maintenanceService.listSchedules();
      expect(scheduleList.rows.length).toBeGreaterThan(0);

      const sample = scheduleList.rows[0];
      expect(sample.frequency).toBeTruthy();
      expect(sample.next_due_date).toBeTruthy();

      // Complete this schedule
      const completedSchedule = await maintenanceService.completeSchedule(sample.id, {
        action_taken: 'Routine lubrication and filter check executed.',
        downtime_minutes: 20
      }, { name: 'Maintenance Engineer' });

      expect(completedSchedule.workOrder).toBeDefined();
      expect(completedSchedule.workOrder.order_type).toBe('PREVENTIVE');
      expect(completedSchedule.nextDueDate).toBeDefined();
      expect(completedSchedule.nextDueDate).not.toBe(sample.next_due_date);

      // Clean up generated preventive WO
      await db('maintenance_work_orders').where('id', completedSchedule.workOrder.id).del();
    });
  });

  describe('6. CMMS Telemetry & Excel Export', () => {
    it('should aggregate maintenance spend, MTTR, and departmental cost summary', async () => {
      const analytics = await maintenanceService.getAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.equipmentSummary.total).toBeGreaterThanOrEqual(15);
      expect(Array.isArray(analytics.costByDepartment)).toBe(true);
      expect(Array.isArray(analytics.topCostingMachines)).toBe(true);
      expect(analytics.grandTotalSpend).toBeGreaterThanOrEqual(0);
    });

    it('should generate valid multi-sheet Excel workbook via maintenanceController.exportExcel', async () => {
      const chunks = [];
      const res = {
        setHeader: jest.fn(),
        write: jest.fn((chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }),
        end: jest.fn(() => {})
      };
      const req = {};
      const next = jest.fn();

      await maintenanceController.exportExcel(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.end).toHaveBeenCalled();

      const buffer = Buffer.concat(chunks);
      expect(buffer.length).toBeGreaterThan(1000);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      expect(workbook.getWorksheet('Kitchen & Facility Assets')).toBeDefined();
      expect(workbook.getWorksheet('Maintenance Work Orders')).toBeDefined();
    });
  });
});
