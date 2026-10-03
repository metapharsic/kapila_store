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

const securityGateService = require('../services/securityGateService');
const securityController = require('../controllers/securityController');
const utilityService = require('../services/utilityService');
const utilityController = require('../controllers/utilityController');
const ExcelJS = require('exceljs');

describe('Security Gate & Kitchen Utilities Phase 3 Suite', () => {
  let createdPassId = null;
  let createdRgpPassId = null;
  let createdReadingId = null;

  afterAll(async () => {
    try {
      if (createdPassId) await db('security_gate_passes').where('id', createdPassId).del();
      if (createdRgpPassId) await db('security_gate_passes').where('id', createdRgpPassId).del();
      if (createdReadingId) await db('hotel_utility_readings').where('id', createdReadingId).del();
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await db.destroy();
  });

  describe('1. Security Gate Pass Lifecycle & Sequential Numbering', () => {
    it('should have seeded initial gate passes', async () => {
      const result = await securityGateService.listPasses({}, { page: 1, limit: 10 });
      expect(result.total).toBeGreaterThanOrEqual(4);
      expect(result.stats.total_all).toBeGreaterThanOrEqual(4);

      const lpgPass = result.rows.find(p => p.pass_number === 'GP-2026-0002');
      expect(lpgPass).toBeDefined();
      expect(lpgPass.pass_type).toBe('RGP_RETURNABLE');
      expect(lpgPass.returnable_qty_out).toBe(12);
    });

    it('should create an INWARD_MATERIAL gate pass with sequential number and in-premises status', async () => {
      const pass = await securityGateService.createPass({
        pass_type: 'INWARD_MATERIAL',
        vehicle_type: 'TRUCK',
        vehicle_number: 'TS-09-UB-8888',
        driver_name: 'Harish Chandra',
        driver_phone: '9848011223',
        vendor_name: 'Heritage Fresh Foods',
        purpose: 'Bulk dairy and curd container delivery',
        material_description: '200 Litres milk packets and 50 buckets curd',
        challan_number: 'DC-HFF-9901',
        invoice_number: 'INV-HFF-112'
      }, { name: 'Officer Rajesh' });

      expect(pass).toBeDefined();
      expect(pass.id).toBeTruthy();
      expect(pass.pass_number).toMatch(/^GP-\d{4}-\d{4}$/);
      expect(pass.status).toBe('IN_PREMISES');
      expect(pass.vehicle_number).toBe('TS-09-UB-8888');

      createdPassId = pass.id;
    });

    it('should log outward vehicle exit and transition status to COMPLETED', async () => {
      const updated = await securityGateService.recordExit(createdPassId, {
        remarks: 'Unloaded and verified at Store dock. Vehicle cleared gate.'
      }, { name: 'Officer Rajesh' });

      expect(updated.status).toBe('COMPLETED');
      expect(updated.out_time).toBeDefined();
      expect(updated.remarks).toContain('Exit Note:');
    });
  });

  describe('2. Returnable Gate Pass (RGP) Lifecycle & Reconciliation', () => {
    it('should create an RGP pass for 12 empty commercial LPG cylinders with pending balance due', async () => {
      const rgp = await securityGateService.createPass({
        pass_type: 'RGP_RETURNABLE',
        vehicle_type: 'LPG_TRUCK',
        vehicle_number: 'AP-11-TG-5544',
        driver_name: 'S. Narsing',
        vendor_name: 'Super Gas Corporation',
        purpose: 'Dispatched empty commercial 47.5kg LPG cylinders for refilling',
        returnable_item_type: '47.5kg Commercial LPG Cylinders',
        returnable_qty_out: 12,
        return_due_date: '2026-09-12'
      });

      expect(rgp.pass_type).toBe('RGP_RETURNABLE');
      expect(rgp.returnable_qty_out).toBe(12);
      expect(rgp.returnable_qty_in).toBe(0);
      expect(rgp.returnable_balance_due).toBe(12);
      expect(rgp.is_return_completed).toBe(false);

      createdRgpPassId = rgp.id;
    });

    it('should partially reconcile returnable receipt (e.g. 7 cylinders returned)', async () => {
      const updated = await securityGateService.reconcileRgp(createdRgpPassId, {
        qty_returned: 7,
        notes: 'Received 7 filled cylinders. Remaining 5 pending.'
      }, { name: 'Store Incharge' });

      expect(updated.returnable_qty_in).toBe(7);
      expect(updated.returnable_balance_due).toBe(5);
      expect(updated.is_return_completed).toBe(false);
    });

    it('should fully reconcile remaining balance and mark RGP completed', async () => {
      const updated = await securityGateService.reconcileRgp(createdRgpPassId, {
        qty_returned: 5,
        notes: 'Received final 5 cylinders. All 12 accounted for.'
      }, { name: 'Store Incharge' });

      expect(updated.returnable_qty_in).toBe(12);
      expect(updated.returnable_balance_due).toBe(0);
      expect(updated.is_return_completed).toBe(true);
    });
  });

  describe('2b. RGP Overdue Detection, Vendor Round-Trip & Item-Type Validation', () => {
    let overdueRgpPassId = null;

    afterAll(async () => {
      try {
        if (overdueRgpPassId) await db('security_gate_passes').where('id', overdueRgpPassId).del();
      } catch (e) {
        console.error('Cleanup error:', e.message);
      }
    });

    it('should flag an RGP pass with a past return_due_date as overdue and still pending', async () => {
      const pastDueDate = '2020-01-01'; // well in the past, relative to any test run date

      const rgp = await securityGateService.createPass({
        pass_type: 'RGP_RETURNABLE',
        vehicle_type: 'LPG_TRUCK',
        vehicle_number: 'AP-11-TG-9999',
        driver_name: 'K. Prasad',
        vendor_name: 'Super Gas Corporation',
        purpose: 'Dispatched empty commercial LPG cylinders for refilling (overdue test)',
        returnable_item_type: '47.5kg Commercial LPG Cylinders',
        returnable_qty_out: 6,
        return_due_date: pastDueDate
      });

      overdueRgpPassId = rgp.id;
      expect(rgp.return_due_date).toBeDefined();
      expect(rgp.is_return_completed).toBe(false);

      // Fetch back via listPasses (pending_return filter, matching how the app surfaces open RGPs)
      const result = await securityGateService.listPasses(
        { pending_return: true },
        { page: 1, limit: 100 }
      );
      const fetched = result.rows.find((p) => p.id === overdueRgpPassId);
      expect(fetched).toBeDefined();
      expect(fetched.is_return_completed).toBe(false);

      // Overdue = pending return whose due date has already passed
      const dueDate = new Date(fetched.return_due_date);
      const today = new Date();
      expect(dueDate.getTime()).toBeLessThan(today.getTime());
    });

    it('should round-trip vendor_name correctly through createPass and listPasses', async () => {
      const vendorName = 'Heritage Dairy Logistics Pvt Ltd';
      const rgp = await securityGateService.createPass({
        pass_type: 'RGP_RETURNABLE',
        vehicle_type: 'TRUCK',
        vehicle_number: 'TS-07-AB-1234',
        driver_name: 'Ramu',
        vendor_name: vendorName,
        purpose: 'Returning empty milk cans for round-trip vendor_name test',
        returnable_item_type: 'Stainless Steel Milk Cans',
        returnable_qty_out: 3,
        return_due_date: '2026-12-01'
      });

      expect(rgp.vendor_name).toBe(vendorName);

      const result = await securityGateService.listPasses({ search: vendorName }, { page: 1, limit: 10 });
      const fetched = result.rows.find((p) => p.id === rgp.id);
      expect(fetched).toBeDefined();
      expect(fetched.vendor_name).toBe(vendorName);
      expect(fetched.vendor_name).not.toBe('');

      await db('security_gate_passes').where('id', rgp.id).del();
    });

    it('should reject creating an RGP pass without returnable_item_type', async () => {
      await expect(
        securityGateService.createPass({
          pass_type: 'RGP_RETURNABLE',
          vehicle_type: 'LPG_TRUCK',
          vehicle_number: 'AP-11-TG-0000',
          driver_name: 'No Item Type Driver',
          vendor_name: 'Super Gas Corporation',
          purpose: 'RGP pass missing returnable_item_type (should fail validation)',
          returnable_qty_out: 2,
          return_due_date: '2026-12-01'
          // returnable_item_type intentionally omitted
        })
      ).rejects.toThrow();
    });
  });

  describe('3. Commercial Kitchen Utility Telemetry & Auto-Deltas', () => {
    it('should record a shift utility reading and auto-calculate LPG & EB consumption deltas', async () => {
      const reading = await utilityService.recordReading({
        reading_date: '2026-09-08',
        shift: 'EVENING',
        lpg_start_kg: 350.00,
        lpg_end_kg: 295.50, // Delta = 54.50 kg
        lpg_active_cylinders: 8,
        lpg_empty_cylinders: 6,
        lpg_full_cylinders: 8,
        lpg_pressure_bar: 1.50,
        eb_meter_start: 145000.00,
        eb_meter_end: 145620.00, // Delta = 620 kWh
        dg_run_hours: 1.20,
        dg_units_kwh: 110.00,
        dg_diesel_consumed_litres: 28.00,
        dg_diesel_stock_litres: 440.00,
        water_tanker_count: 1,
        water_tanker_litres: 12000.00,
        ro_plant_output_litres: 4200.00,
        notes: 'Dinner peak load; DG generator exercised 1.2 hrs'
      }, { name: 'Duty Supervisor' });

      expect(reading).toBeDefined();
      expect(reading.id).toBeTruthy();
      expect(parseFloat(reading.lpg_consumed_kg)).toBeCloseTo(54.50, 1);
      expect(parseFloat(reading.eb_units_consumed)).toBeCloseTo(620.00, 1);
      expect(reading.lpg_active_cylinders).toBe(8);

      createdReadingId = reading.id;
    });

    it('should aggregate utility metrics and return averages via getUtilityAnalytics', async () => {
      const analytics = await utilityService.getUtilityAnalytics(30);
      expect(analytics).toBeDefined();
      expect(analytics.active_days).toBeGreaterThanOrEqual(1);
      expect(analytics.averages.avg_daily_lpg_kg).toBeGreaterThan(0);
      expect(analytics.averages.avg_daily_eb_units).toBeGreaterThan(0);
      expect(analytics.live_state).toBeDefined();
      expect(analytics.live_state.lpg_active_cylinders).toBe(8);
    });
  });

  describe('4. Styled Excel Workbooks Generation', () => {
    it('should generate a valid multi-sheet Excel workbook for Security Gate Passes', async () => {
      let buffer = null;
      const res = {
        setHeader: jest.fn(),
        write: jest.fn((chunk) => {
          buffer = buffer ? Buffer.concat([buffer, chunk]) : Buffer.from(chunk);
        }),
        end: jest.fn(),
      };

      await securityController.exportExcel({}, res, (err) => {
        if (err) throw err;
      });

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.end).toHaveBeenCalled();
      expect(buffer).not.toBeNull();
      expect(buffer.length).toBeGreaterThan(1000);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      expect(wb.worksheets.length).toBe(2);
      expect(wb.getWorksheet('Gate Passes Log')).toBeDefined();
      expect(wb.getWorksheet('Returnable Containers (RGP)')).toBeDefined();
    });

    it('should generate a valid multi-sheet Excel workbook for Kitchen & Facility Utilities', async () => {
      let buffer = null;
      const res = {
        setHeader: jest.fn(),
        write: jest.fn((chunk) => {
          buffer = buffer ? Buffer.concat([buffer, chunk]) : Buffer.from(chunk);
        }),
        end: jest.fn(),
      };

      await utilityController.exportExcel({}, res, (err) => {
        if (err) throw err;
      });

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.end).toHaveBeenCalled();
      expect(buffer).not.toBeNull();
      expect(buffer.length).toBeGreaterThan(1000);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      expect(wb.worksheets.length).toBe(2);
      expect(wb.getWorksheet('LPG Kitchen Fuel Telemetry')).toBeDefined();
      expect(wb.getWorksheet('Power & Water Telemetry')).toBeDefined();
    });
  });
});
