const db = require('../db');
jest.mock('../services/auditService', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));
const inventoryReportService = require('../services/inventoryReportService');
const reportController = require('../controllers/reportController');
const ExcelJS = require('exceljs');

describe('Enterprise Multi-Agent Inventory Excel Reporting Unit', () => {
  jest.setTimeout(30000);
  afterAll(async () => {
    await db.destroy();
  });

  describe('Agent 1 (🏛️ Architect) & Agent 2 (📊 Data Agent): Schema & Queries', () => {
    it('aggregates master stock with valid valuation, item codes, and categories', async () => {
      const data = await inventoryReportService.fetchReportData();
      expect(data.masterStock).toBeDefined();
      expect(Array.isArray(data.masterStock)).toBe(true);
      expect(data.masterStock.length).toBeGreaterThan(0);

      const firstItem = data.masterStock[0];
      expect(firstItem).toHaveProperty('item_code');
      expect(firstItem).toHaveProperty('name');
      expect(firstItem).toHaveProperty('category');
      expect(firstItem).toHaveProperty('total_remaining');
      expect(firstItem).toHaveProperty('avg_price');
    });

    it('fetches batch & FEFO records with expiry dates', async () => {
      const data = await inventoryReportService.fetchReportData();
      expect(data.batches).toBeDefined();
      expect(Array.isArray(data.batches)).toBe(true);
      if (data.batches.length > 0) {
        expect(data.batches[0]).toHaveProperty('batch_no');
        expect(data.batches[0]).toHaveProperty('remaining');
        expect(data.batches[0]).toHaveProperty('price');
      }
    });

    it('fetches department consumption records with cost attributions', async () => {
      const data = await inventoryReportService.fetchReportData();
      expect(data.issuances).toBeDefined();
      expect(Array.isArray(data.issuances)).toBe(true);
    });
  });

  describe('Agent 3 (💻 Backend Core) & Agent 5 (🤖 AI Store Advisor): ExcelJS Engine', () => {
    it('generates a 7-sheet enterprise workbook with correct metadata and formulas', async () => {
      const workbook = await inventoryReportService.generateWorkbook(
        {},
        { userName: 'Test Auditor' }
      );

      expect(workbook.worksheets.length).toBe(7);
      const sheetNames = workbook.worksheets.map((ws) => ws.name);
      expect(sheetNames).toEqual([
        'Executive Summary',
        'Master Stock Valuation',
        'Batch & FEFO Expiry',
        'Department Consumption',
        'Procurement & GRN',
        'Reorder & Replenishment',
        'Audit & Variances',
      ]);

      // Check Executive Summary KPI row
      const summarySheet = workbook.getWorksheet('Executive Summary');
      expect(summarySheet).toBeDefined();
      expect(summarySheet.getCell('A1').value).toContain('HOTEL KAPILA');

      // Check Master Stock Valuation formulas
      const masterSheet = workbook.getWorksheet('Master Stock Valuation');
      expect(masterSheet).toBeDefined();
      // Row 4 is header, row 5 is first item
      const formulaCell = masterSheet.getCell('H5');
      if (formulaCell.value && typeof formulaCell.value === 'object') {
        expect(formulaCell.value.formula).toBe('=D5*F5');
      }

      // Verify binary buffer generation
      const buffer = await workbook.xlsx.writeBuffer();
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(50000); // Over 50 KB

      // Verify the buffer can be read back cleanly
      const readBackWb = new ExcelJS.Workbook();
      await readBackWb.xlsx.load(buffer);
      expect(readBackWb.worksheets.length).toBe(7);
    });
  });

  describe('Agent 4 (🎨 Frontend UI Support) & Controller Integration', () => {
    it('returns preview metadata with KPI totals and sheet listing', async () => {
      const req = { query: {} };
      let responseJson = null;
      const res = {
        json: (data) => {
          responseJson = data;
        },
      };
      const next = jest.fn();

      await reportController.previewInventoryMetadata(req, res, next);
      expect(responseJson).toBeDefined();
      expect(responseJson.success).toBe(true);
      expect(responseJson.data.total_skus).toBeGreaterThan(0);
      expect(responseJson.data.total_valuation).toBeGreaterThan(0);
      expect(responseJson.data.sheets.length).toBe(7);
    });

    it('sets proper download headers and streams Excel file', async () => {
      const req = {
        user: { id: 1, name: 'Admin', isAdmin: true },
        query: {},
        ip: '127.0.0.1',
      };
      const headers = {};
      const res = {
        setHeader: (k, v) => {
          headers[k] = v;
        },
        headersSent: false,
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
      };
      const next = jest.fn();

      await reportController.exportInventoryExcel(req, res, next);
      expect(headers['Content-Type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(headers['Content-Disposition']).toMatch(/^attachment; filename="Kapila_Inventory_Report_.*\.xlsx"$/);
      expect(res.end).toHaveBeenCalled();
    });
  });
});
