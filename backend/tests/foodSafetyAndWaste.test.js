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

const foodSafetyService = require('../services/foodSafetyService');
const foodSafetyController = require('../controllers/foodSafetyController');
const wasteService = require('../services/wasteService');
const wasteController = require('../controllers/wasteController');
const ExcelJS = require('exceljs');

describe('Food Safety QC, RUCO & Waste Governance Phase 4 Suite', () => {
  let createdInspectionId = null;
  let createdWasteId = null;
  let createdRucoId = null;
  let createdDisposalId = null;
  let createdPestId = null;

  afterAll(async () => {
    try {
      if (createdInspectionId) await db('food_quality_inspections').where('id', createdInspectionId).del();
      if (createdWasteId) await db('food_waste_logs').where('id', createdWasteId).del();
      if (createdRucoId) await db('used_cooking_oil_logs').where('id', createdRucoId).del();
      if (createdDisposalId) await db('used_cooking_oil_logs').where('id', createdDisposalId).del();
      if (createdPestId) await db('hygiene_pest_control_logs').where('id', createdPestId).del();
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await db.destroy();
  });

  describe('1. HACCP Inbound Quality & Temperature Compliance', () => {
    it('should list seeded HACCP receiving inspections', async () => {
      const res = await foodSafetyService.listInspections({}, { page: 1, limit: 10 });
      expect(res.total).toBeGreaterThanOrEqual(5);
      expect(res.rows.length).toBeGreaterThanOrEqual(5);

      const dairy = res.rows.find(r => r.category === 'DAIRY');
      expect(dairy).toBeDefined();
      expect(parseFloat(dairy.receiving_temp_c)).toBeLessThanOrEqual(4.0);
      expect(dairy.temp_compliant).toBe(true);
    });

    it('should automatically approve compliant cold-chain delivery', async () => {
      const inspection = await foodSafetyService.createInspection({
        inspection_date: new Date().toISOString().slice(0, 10),
        item_name: 'Amul Taaza Toned Milk 1L',
        category: 'DAIRY',
        supplier_name: 'Heritage Fresh Foods',
        challan_number: 'DC-MILK-1092',
        receiving_temp_c: 3.5,
        temp_threshold_max_c: 4.0,
        packaging_seal: 'INTACT',
        sensory_rating: 'EXCELLENT',
        expiry_date_verified: true,
        action_taken: 'Accepted into Dairy Walk-in Chiller'
      }, { name: 'Receiving Commis' });

      expect(inspection).toBeDefined();
      expect(inspection.id).toBeTruthy();
      expect(inspection.temp_compliant).toBe(true);
      expect(inspection.status).toBe('PASSED');
      expect(inspection.inspector_name).toBe('Receiving Commis');

      createdInspectionId = inspection.id;
    });

    it('should automatically reject non-compliant temperature cold-chain consignment', async () => {
      const inspection = await foodSafetyService.createInspection({
        inspection_date: new Date().toISOString().slice(0, 10),
        item_name: 'Frozen Prawns 10kg Block',
        category: 'SEAFOOD',
        supplier_name: 'Coastal Seafoods Kakinada',
        challan_number: 'DC-SEA-4411',
        receiving_temp_c: -8.0, // Fails -18°C requirement
        temp_threshold_max_c: -18.0,
        packaging_seal: 'CONDENSATION_DEFECT',
        sensory_rating: 'UNACCEPTABLE',
        rejection_reason: 'Temperature abuse during transport: measured -8.0°C vs max -18.0°C threshold'
      }, { name: 'Executive Sous Chef' });

      expect(inspection).toBeDefined();
      expect(inspection.temp_compliant).toBe(false);
      expect(inspection.status).toBe('REJECTED');
      expect(inspection.action_taken).toBe('Returned to Vendor');

      // Cleanup
      await db('food_quality_inspections').where('id', inspection.id).del();
    });

    it('should retrieve quality telemetry summary', async () => {
      const telemetry = await foodSafetyService.getQualityTelemetry();
      expect(telemetry).toBeDefined();
      expect(telemetry.total_inspections).toBeGreaterThanOrEqual(5);
      expect(telemetry.passed_count).toBeGreaterThanOrEqual(1);
      expect(typeof telemetry.compliance_rate_pct).toBe('number');
      expect(Array.isArray(telemetry.recent_rejections)).toBe(true);
    });
  });

  describe('2. Kitchen Food Waste Accounting & Cost Valuation', () => {
    it('should list seeded food waste logs and calculate summary cost', async () => {
      const res = await wasteService.listWasteLogs({}, { page: 1, limit: 10 });
      expect(res.total).toBeGreaterThanOrEqual(5);
      expect(res.summary.total_waste_cost).toBeGreaterThan(0);
      expect(res.summary.total_waste_qty).toBeGreaterThan(0);
    });

    it('should log daily prep food waste and auto-calculate total cost loss', async () => {
      const log = await wasteService.logWaste({
        waste_date: new Date().toISOString().slice(0, 10),
        department: 'NORTH INDIAN',
        waste_type: 'PREP_TRIMMING',
        item_name: 'Paneer Block Trimmings & Off-cuts',
        qty: 4.5,
        unit: 'kg',
        unit_cost: 340.00,
        reason: 'Daily trimming during curry mise en place',
        disposal_method: 'Organic Composting Bin'
      }, { name: 'Chef Sitaram' });

      expect(log).toBeDefined();
      expect(log.id).toBeTruthy();
      expect(parseFloat(log.qty)).toBe(4.5);
      expect(parseFloat(log.unit_cost)).toBe(340.00);
      expect(parseFloat(log.total_cost)).toBe(1530.00);
      expect(log.logged_by).toBe('Chef Sitaram');

      createdWasteId = log.id;
    });

    it('should aggregate 30-day waste analytics by department & channel', async () => {
      const analytics = await wasteService.getWasteAnalytics(30);
      expect(analytics).toBeDefined();
      expect(Array.isArray(analytics.by_department)).toBe(true);
      expect(Array.isArray(analytics.by_waste_type)).toBe(true);
      expect(analytics.timeframe_days).toBe(30);
    });
  });

  describe('3. FSSAI RUCO (Repurpose Used Cooking Oil) Management', () => {
    it('should list seeded RUCO logs and calculate drum yard balances', async () => {
      const res = await wasteService.listRucoLogs({}, { page: 1, limit: 10 });
      expect(res.total).toBeGreaterThanOrEqual(3);
      expect(res.summary).toBeDefined();
      expect(typeof res.summary.current_drum_stock_litres).toBe('number');
    });

    it('should record safe fryer reading when TPC is below 21%', async () => {
      const reading = await wasteService.logRucoReading({
        log_date: new Date().toISOString().slice(0, 10),
        department: 'CHINESE & DOSA',
        fryer_name: 'Dosa Griddle Sump Fryer',
        oil_type: 'Sunflower Oil',
        tpc_percentage: 16.5,
        discarded_litres: 0
      }, { name: 'Station Chef Raju' });

      expect(reading).toBeDefined();
      expect(reading.status).toBe('SAFE_FOR_FRYING');
      expect(parseFloat(reading.discarded_litres)).toBe(0);

      createdRucoId = reading.id;
    });

    it('should enforce statutory discard when TPC >= 25.0% and increment drum stock', async () => {
      const latestBefore = await db('used_cooking_oil_logs').orderBy('id', 'desc').first();
      const stockBefore = latestBefore ? parseFloat(latestBefore.current_drum_stock_litres) : 0;

      const reading = await wasteService.logRucoReading({
        log_date: new Date().toISOString().slice(0, 10),
        department: 'TIFFINS',
        fryer_name: 'Poori Deep Fryer #1',
        oil_type: 'Palmolein Oil',
        tpc_percentage: 26.8, // Violates FSSAI 25% limit
        discarded_litres: 25.0
      }, { name: 'Head Halwai' });

      expect(reading).toBeDefined();
      expect(reading.status).toBe('DISCARDED_TO_RUCO_DRUM');
      expect(parseFloat(reading.discarded_litres)).toBe(25.0);
      expect(parseFloat(reading.current_drum_stock_litres)).toBe(stockBefore + 25.0);

      // Clean up this reading
      await db('used_cooking_oil_logs').where('id', reading.id).del();
    });

    it('should record handover to authorized FSSAI biodiesel recycler', async () => {
      const latestBefore = await db('used_cooking_oil_logs').orderBy('id', 'desc').first();
      const stockBefore = latestBefore ? parseFloat(latestBefore.current_drum_stock_litres) : 0;

      const disposal = await wasteService.recordRucoDisposal({
        log_date: new Date().toISOString().slice(0, 10),
        collected_litres: 40.0,
        collection_vendor: 'EcoGreen BioFuels Hyderabad',
        collection_certificate_no: 'RUCO-HYD-2026-9901',
        revenue_recovered: 1200.00,
        notes: 'Handed over 2 containers of degraded cooking oil for biodiesel transesterification.'
      }, { name: 'Store Keeper' });

      expect(disposal).toBeDefined();
      expect(disposal.collection_vendor).toBe('EcoGreen BioFuels Hyderabad');
      expect(parseFloat(disposal.collected_litres)).toBe(40.0);
      expect(parseFloat(disposal.revenue_recovered)).toBe(1200.00);
      expect(parseFloat(disposal.current_drum_stock_litres)).toBe(Math.max(0, stockBefore - 40.0));

      createdDisposalId = disposal.id;
    });
  });

  describe('4. FSSAI Schedule IV Hygiene & Pest Control Audits', () => {
    it('should list seeded pest control logs', async () => {
      const res = await foodSafetyService.listPestLogs({ page: 1, limit: 10 });
      expect(res.total).toBeGreaterThanOrEqual(1);
      expect(res.rows.length).toBeGreaterThanOrEqual(1);

      const audit = res.rows[0];
      expect(audit.service_agency).toBe('Pest Control India (PCI) Hyderabad');
      expect(audit.hygiene_score).toBeGreaterThanOrEqual(90);
    });

    it('should log a deep cleaning and chemical pest sanitization service', async () => {
      const pest = await foodSafetyService.createPestLog({
        service_date: new Date().toISOString().slice(0, 10),
        service_type: 'DEEP_CLEANING_AUDIT',
        service_agency: 'Kapila Internal Hygiene Taskforce',
        technician_name: 'R. Koteswar Rao',
        areas_covered: ['Central Store Dry Grocery', 'Walk-in Chiller & Freezers', 'Pot Wash & Scullery'],
        chemicals_used: 'Sodium Hypochlorite 500ppm, Food-Safe QAC Degreaser',
        trap_count_installed: 8,
        pest_activity_detected: 'NONE',
        hygiene_score: 98,
        supervisor_signoff: 'Executive Chef',
        remarks: 'All stainless-steel worktops sanitized. Drains clear of grease accumulation.'
      }, { name: 'Executive Chef' });

      expect(pest).toBeDefined();
      expect(pest.id).toBeTruthy();
      expect(pest.hygiene_score).toBe(98);
      expect(pest.pest_activity_detected).toBe('NONE');
      expect(pest.supervisor_signoff).toBe('Executive Chef');

      createdPestId = pest.id;
    });
  });

  describe('5. Professional Multi-Sheet Excel Streaming Exports', () => {
    it('should stream a valid 2-sheet HACCP & Pest Control workbook', async () => {
      const req = { query: {} };
      const chunks = [];
      const res = {
        setHeader: jest.fn(),
        write: jest.fn((chunk) => chunks.push(chunk)),
        end: jest.fn()
      };

      await foodSafetyController.exportExcel(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('Kapila_Food_Safety_HACCP_Report_')
      );

      const buffer = Buffer.concat(chunks);
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      expect(workbook.worksheets.length).toBe(2);
      expect(workbook.getWorksheet('HACCP Receiving Inspections')).toBeDefined();
      expect(workbook.getWorksheet('Pest Control & Hygiene Audits')).toBeDefined();
    });

    it('should stream a valid 2-sheet Kitchen Waste & RUCO workbook', async () => {
      const req = { query: {} };
      const chunks = [];
      const res = {
        setHeader: jest.fn(),
        write: jest.fn((chunk) => chunks.push(chunk)),
        end: jest.fn()
      };

      await wasteController.exportExcel(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('Kapila_Kitchen_Waste_and_RUCO_Report_')
      );

      const buffer = Buffer.concat(chunks);
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      expect(workbook.worksheets.length).toBe(2);
      expect(workbook.getWorksheet('Kitchen Food Waste Log')).toBeDefined();
      expect(workbook.getWorksheet('RUCO Used Cooking Oil')).toBeDefined();
    });
  });
});
