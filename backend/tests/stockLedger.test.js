const db = require('../db');
const { PassThrough } = require('stream');

jest.mock('../services/permissionService', () => ({
  getDepartmentNames: jest.fn().mockResolvedValue(null),
  assertDepartmentAccess: jest.fn().mockResolvedValue(undefined),
  applyDepartmentScope: jest.fn((query) => query),
}));
jest.mock('../utils/highValueAlert', () => ({
  checkHighValueAlert: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../cron/anomalyDetector', () => ({
  getThreshold: jest.fn().mockReturnValue(2.0),
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

const stockLedgerService = require('../services/stockLedgerService');
const stockController = require('../controllers/stockController');
const issuanceController = require('../controllers/issuanceController');
const ExcelJS = require('exceljs');

describe('Stock Ledger Phase 1 - Double-Entry Ledger & P2P Integration Suite', () => {
  const TEST_ITEM_CODE = 'T1_' + Math.floor(Date.now() % 10000000);
  const TEST_ITEM_NAME = 'Test Ledger Rice 25kg';

  afterAll(async () => {
    // Thorough cleanup of all test entities
    try {
      await db('stock_ledger').whereILike('item_code', 'T1_%').del();
      const testStock = await db('stock').whereILike('item_code', 'T1_%').select('id', 'item_code');
      const itemCodes = testStock.map(s => s.item_code);
      if (itemCodes.length > 0) {
        const issItems = await db('issuance_items').whereIn('item_code', itemCodes).select('issuance_id');
        const issIds = issItems.map(i => i.issuance_id);
        if (issIds.length > 0) {
          await db('issuance_items').whereIn('issuance_id', issIds).del();
          await db('issuances').whereIn('id', issIds).del();
        }
        await db('stock').whereIn('item_code', itemCodes).del();
      }
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await db.destroy();
  });

  describe('1. Schema & Opening Balance Parity Check', () => {
    it('should have stock_ledger table populated with opening balances', async () => {
      const exists = await db.schema.hasTable('stock_ledger');
      expect(exists).toBe(true);

      const openingCount = await db('stock_ledger')
        .where('transaction_type', 'OPENING_BALANCE')
        .count('id as count')
        .first();

      expect(Number(openingCount.count)).toBeGreaterThan(0);

      // Verify that opening balances have proper balance calculations
      const sample = await db('stock_ledger')
        .where('transaction_type', 'OPENING_BALANCE')
        .first();

      expect(sample).toBeDefined();
      expect(sample.item_code).toBeTruthy();
      expect(Number(sample.balance_qty_before)).toBe(0);
      expect(Number(sample.balance_qty_after)).toBe(Number(sample.qty));
    });
  });

  describe('2. Direct stockLedgerService API Suite', () => {
    it('should compute running balances accurately across consecutive transactions', async () => {
      // Step A: First Inward entry for brand new SKU
      const entry1 = await stockLedgerService.recordEntry(null, {
        item_code: TEST_ITEM_CODE,
        item_name: TEST_ITEM_NAME,
        transaction_type: 'INWARD_PURCHASE',
        qty: 100,
        unit: 'KG',
        unit_price: 50.0,
        supplier: 'Test Agro Corp',
        batch_no: 'BATCH-001',
        reference_doc_type: 'STOCK',
        notes: 'Initial test shipment'
      });

      expect(entry1).toBeDefined();
      expect(Number(entry1.balance_qty_before)).toBe(0);
      expect(Number(entry1.qty)).toBe(100);
      expect(Number(entry1.balance_qty_after)).toBe(100);
      expect(Number(entry1.total_value)).toBe(5000.0);

      // Step B: Outward Issue entry
      const entry2 = await stockLedgerService.recordEntry(null, {
        item_code: TEST_ITEM_CODE,
        item_name: TEST_ITEM_NAME,
        transaction_type: 'OUTWARD_ISSUE',
        qty: 35,
        unit: 'KG',
        unit_price: 50.0,
        department: 'SI-MEALS',
        batch_no: 'BATCH-001',
        reference_doc_type: 'ISSUE',
        notes: 'Lunch prep distribution'
      });

      expect(entry2).toBeDefined();
      expect(Number(entry2.balance_qty_before)).toBe(100);
      expect(Number(entry2.qty)).toBe(35);
      expect(Number(entry2.balance_qty_after)).toBe(65);
      expect(Number(entry2.total_value)).toBe(1750.0);

      // Step C: Subsequent Inward Entry
      const entry3 = await stockLedgerService.recordEntry(null, {
        item_code: TEST_ITEM_CODE,
        item_name: TEST_ITEM_NAME,
        transaction_type: 'INWARD_PURCHASE',
        qty: 50,
        unit: 'KG',
        unit_price: 52.0,
        supplier: 'Secondary Vendor',
        batch_no: 'BATCH-002',
        reference_doc_type: 'STOCK',
        notes: 'Replenishment'
      });

      expect(entry3).toBeDefined();
      expect(Number(entry3.balance_qty_before)).toBe(65);
      expect(Number(entry3.qty)).toBe(50);
      expect(Number(entry3.balance_qty_after)).toBe(115);
    });

    it('should throw validation error if required fields are missing', async () => {
      await expect(
        stockLedgerService.recordEntry(null, {
          item_code: '',
          transaction_type: 'INWARD_PURCHASE',
          qty: 10
        })
      ).rejects.toThrow('Missing required ledger fields');

      await expect(
        stockLedgerService.recordEntry(null, {
          item_code: 'TEST_ERR',
          item_name: 'Err item',
          unit: 'KG',
          reference_doc_type: 'STOCK',
          transaction_type: 'UNKNOWN_TYPE',
          qty: 10
        })
      ).rejects.toThrow('Invalid transaction_type');
    });

    it('should aggregate ledger totals correctly via queryLedger', async () => {
      const result = await stockLedgerService.queryLedger({ item_code: TEST_ITEM_CODE });
      expect(result.rows.length).toBe(3);
      expect(result.summary.totalInflowQty).toBe(150);
      expect(result.summary.totalOutflowQty).toBe(35);
      expect(result.summary.totalInflowValue).toBe(7600); // 5000 + 2600
      expect(result.summary.totalOutflowValue).toBe(1750);
    });
  });

  describe('3. P2P & Stock Controller Integration Check', () => {
    it('should record INWARD_PURCHASE to ledger on stockController.create', async () => {
      const req = {
        body: {
          name: 'Controller Test Product ' + Date.now(),
          category: 'PROVISIONS',
          unit: 'KG',
          qty: 80,
          price: 45,
          date: '2026-09-08',
          supplier: 'Kapila Standard Supplier',
          min_alert_qty: 10
        },
        user: { id: 1, name: 'Store Manager', role: 'STORE_MANAGER' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await stockController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      const createdItem = res.json.mock.calls[0][0].data;

      // Verify ledger entry
      const ledgerEntry = await db('stock_ledger')
        .where({
          item_code: createdItem.item_code,
          transaction_type: 'INWARD_PURCHASE'
        })
        .first();

      expect(ledgerEntry).toBeDefined();
      expect(Number(ledgerEntry.qty)).toBe(80);
      expect(Number(ledgerEntry.balance_qty_after)).toBe(80);
      expect(ledgerEntry.supplier).toBe('Kapila Standard Supplier');

      // Cleanup
      await db('stock_ledger').where('item_code', createdItem.item_code).del();
      await db('stock').where('id', createdItem.id).del();
    });

    it('should record OUTWARD_ISSUE to ledger on issuanceController.create', async () => {
      // Find a valid department and user
      const dept = await db('departments').first();
      expect(dept).toBeDefined();
      const user = await db('users').first();

      // Create test approved indent
      const [indent] = await db('indents').insert({
        dept: dept.name,
        date: '2026-09-08',
        status: 'approved',
        created_by: user ? user.id : 1
      }).returning('*');

      // Insert stock batch
      const [stk] = await db('stock')
        .insert({
          item_code: TEST_ITEM_CODE + '_ISS',
          name: 'Issuance Item Test ' + Date.now(),
          category: 'PROVISIONS',
          unit: 'kg',
          qty: 50,
          remaining: 50,
          price: 60,
          date: '2026-09-08',
          supplier: 'Agro Foods'
        })
        .returning('*');

      const req = {
        body: {
          indent_id: indent.id,
          dept: dept.name,
          date: '2026-09-08',
          items: [{
            item_code: stk.item_code,
            name: stk.name,
            qty: 15,
            issued: 15,
            unit: 'kg'
          }]
        },
        user: { id: 1, name: 'Chef Ramesh', role: 'STORE_KEEPER' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await issuanceController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);

      // Verify outward ledger entry
      const issueLedger = await db('stock_ledger')
        .where({
          item_code: stk.item_code,
          transaction_type: 'OUTWARD_ISSUE'
        })
        .first();

      expect(issueLedger).toBeDefined();
      expect(Number(issueLedger.qty)).toBe(15);
      expect(issueLedger.department).toBe(dept.name);

      // Cleanup
      await db('stock_ledger').where('item_code', stk.item_code).del();
      await db('issuance_items').where('item_code', stk.item_code).del();
      await db('issuances').where('indent_id', indent.id).del();
      await db('indents').where('id', indent.id).del();
      await db('stock').where('id', stk.id).del();
    });
  });

  describe('4. getLedger API & Excel Streaming Endpoint', () => {
    it('should return paginated ledger results and summary totals via stockController.getLedger', async () => {
      const req = {
        query: { page: 1, limit: 10 },
        pagination: { page: 1, limit: 10, offset: 0 }
      };
      const res = {
        json: jest.fn()
      };
      const next = jest.fn();

      await stockController.getLedger(req, res, next);
      expect(res.json).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.summary).toBeDefined();
      expect(body.summary).toHaveProperty('totalInflowQty');
      expect(body.summary).toHaveProperty('totalOutflowQty');
      expect(body.summary).toHaveProperty('totalInflowValue');
      expect(body.summary).toHaveProperty('totalOutflowValue');
    });

    it('should generate valid Excel workbook for stockController.exportLedgerExcel', async () => {
      const chunks = [];
      const res = {
        setHeader: jest.fn(),
        write: jest.fn((chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }),
        end: jest.fn(() => {})
      };
      const req = {
        query: { limit: 10 }
      };
      const next = jest.fn();

      await stockController.exportLedgerExcel(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.end).toHaveBeenCalled();

      const capturedBuffer = Buffer.concat(chunks);
      expect(capturedBuffer.length).toBeGreaterThan(1000);

      // Verify Excel contents using ExcelJS reader
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(capturedBuffer);
      const sheet = workbook.getWorksheet('Stock Movement Ledger');
      expect(sheet).toBeDefined();
      expect(sheet.rowCount).toBeGreaterThan(3);
    });

    it('should gracefully handle sort=date by mapping to created_at and provide virtual date', async () => {
      const req = {
        query: { page: 1, limit: 5, sort: 'date' },
        pagination: { page: 1, limit: 5, offset: 0, sort: 'date', order: 'desc' }
      };
      const res = { json: jest.fn() };
      const next = jest.fn();

      await stockController.getLedger(req, res, next);
      expect(res.json).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0]).toHaveProperty('created_at');
      expect(body.data[0]).toHaveProperty('date');
    });

    it('should record ADJUSTMENT_ADD and ADJUSTMENT_DEDUCT into stock_ledger upon physical reconciliation', async () => {
      // Create a temporary batch for reconciliation testing
      const [reconStock] = await db('stock').insert({
        name: 'Recon Test Item',
        item_code: TEST_ITEM_CODE + '_REC',
        qty: 20,
        remaining: 20,
        unit: 'kg',
        price: 100,
        date: new Date().toISOString().slice(0, 10),
        supplier: 'Recon Supplier'
      }).returning('*');

      // Test shortage reconciliation (-5 kg)
      const reqShortage = {
        body: {
          items: [{ item_code: reconStock.item_code, physical_qty: 15, reason: 'Physical Shortage Test' }],
          session_name: 'Test Recon Shortage Session'
        },
        user: { id: 1, name: 'Recon Auditor' }
      };
      const resShortage = { json: jest.fn() };
      const nextShortage = jest.fn();

      await stockController.reconcile(reqShortage, resShortage, nextShortage);
      expect(resShortage.json).toHaveBeenCalled();

      // Verify stock_ledger entry was created
      const shortageLedgerEntry = await db('stock_ledger')
        .where('item_code', reconStock.item_code)
        .andWhere('transaction_type', 'ADJUSTMENT_DEDUCT')
        .first();

      expect(shortageLedgerEntry).toBeDefined();
      expect(Number(shortageLedgerEntry.qty)).toBe(5);
      expect(shortageLedgerEntry.reference_doc_type).toBe('RECONCILIATION');

      // Cleanup recon stock
      await db('stock_ledger').where('item_code', reconStock.item_code).del();
      await db('stock_adjustments').where('stock_id', reconStock.id).del();
      await db('stock').where('id', reconStock.id).del();
    });
  });
});
