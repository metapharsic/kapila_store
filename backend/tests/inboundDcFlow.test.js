const db = require('../db');

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

const inboundDcService = require('../services/inboundDcService');
const securityGateService = require('../services/securityGateService');

describe('Inbound DC, 3-Way Match & Returnable Assets End-to-End Suite', () => {
  const TEST_SUPPLIER_CODE = 'SUP_DC_' + Math.floor(Date.now() % 100000);
  const TEST_ITEM_CODE = 'IDC_ITM_' + Math.floor(Date.now() % 100000);
  let testSupplierId = null;
  let createdDc = null;
  let rgpPassId = null;

  beforeAll(async () => {
    // 1. Create or get test supplier
    let supplier = await db('suppliers').where('name', 'Heritage Dairy ' + TEST_SUPPLIER_CODE).first();
    if (!supplier) {
      const [newSup] = await db('suppliers')
        .insert({
          name: 'Heritage Dairy ' + TEST_SUPPLIER_CODE,
          contact_name: 'Venkatesh',
          phone: '9876543210',
          email: 'heritage@test.com',
          address: 'Secunderabad Dairy Farm'
        })
        .returning('*');
      supplier = newSup;
    }
    testSupplierId = supplier ? supplier.id : 1;
  });

  afterAll(async () => {
    try {
      if (createdDc) {
        const dc = await db('inbound_dcs').where('id', createdDc.id).first();
        if (dc && dc.converted_grn_id) {
          await db('goods_receipt_items').where('grn_id', dc.converted_grn_id).del();
          await db('goods_receipt_notes').where('id', dc.converted_grn_id).del();
        }
        await db('inbound_dc_items').where('inbound_dc_id', createdDc.id).del();
        await db('inbound_dcs').where('id', createdDc.id).del();
      }
      await db('stock_ledger').where('item_code', TEST_ITEM_CODE).del();
      await db('stock').where('item_code', TEST_ITEM_CODE).del();
      if (testSupplierId) {
        await db('suppliers').where('id', testSupplierId).del();
      }
      if (rgpPassId) {
        await db('security_gate_pass_items').where('gate_pass_id', rgpPassId).del();
        await db('security_gate_passes').where('id', rgpPassId).del();
      }
    } catch (e) {
      console.warn('Cleanup error:', e.message);
    }
    await db.destroy();
  });

  describe('1. Inbound Delivery Challan (DC) Intake with Provisional Stock Bump', () => {
    it('should create an Inbound DC, generate sequence IDC-YYYYMMDD-XXXX, and credit provisional stock', async () => {
      const payload = {
        supplier_id: testSupplierId,
        challan_no: 'CHAL-HERITAGE-8891',
        delivery_date: new Date().toISOString().slice(0, 10),
        vehicle_no: 'AP 09 TG 5512',
        driver_name: 'Venkatesh',
        driver_phone: '9848012345',
        received_by: 'Head Storekeeper',
        remarks: 'Early 5:00 AM delivery. 100 Liters milk received in 2 stainless cans.',
        items: [
          {
            item_code: TEST_ITEM_CODE,
            item_name: 'Fresh Buffalo Full Cream Milk',
            category: 'Dairy',
            unit: 'ltr',
            dc_qty: 100,
            est_unit_price: 65.00,
            storage_location: 'Dairy Chiller Cold Room',
            remarks: 'Temperature tested 3.8°C'
          }
        ]
      };

      const user = { id: 1, name: 'Store Admin', role: 'admin' };
      createdDc = await inboundDcService.createInboundDC(payload, user);

      expect(createdDc).toBeDefined();
      expect(createdDc.sequence_no).toMatch(/^IDC-\d{8}-\d{4}$/);
      expect(createdDc.status).toBe('PENDING_INVOICE');
      expect(createdDc.items).toHaveLength(1);
      expect(parseFloat(createdDc.total_est_value)).toBeCloseTo(6500.00);

      // Verify stock table update
      const stockRow = await db('stock').where('item_code', TEST_ITEM_CODE).whereNotNull('batch_no').first();
      expect(stockRow).toBeDefined();
      expect(parseFloat(stockRow.remaining)).toBeGreaterThanOrEqual(100);

      // Verify double-entry ledger entry
      const ledgerEntries = await db('stock_ledger')
        .where('item_code', TEST_ITEM_CODE)
        .andWhere('transaction_type', 'INWARD_DC_PROVISIONAL');
      expect(ledgerEntries.length).toBeGreaterThan(0);

      const latestEntry = ledgerEntries[0];
      expect(parseFloat(latestEntry.qty)).toBe(100);
      expect(latestEntry.reference_doc_type).toBe('DC');
      expect(String(latestEntry.reference_doc_id)).toBe(String(createdDc.id));
    });

    it('should retrieve the created DC in list and details queries', async () => {
      const listRes = await inboundDcService.listInboundDCs({ status: 'PENDING_INVOICE' });
      expect(listRes.rows).toBeDefined();
      const found = listRes.rows.find(d => d.id === createdDc.id);
      expect(found).toBeDefined();
      expect(found.sequence_no).toBe(createdDc.sequence_no);

      const details = await inboundDcService.getInboundDCDetails(createdDc.id);
      expect(details).toBeDefined();
      expect(details.id).toBe(createdDc.id);
      expect(details.items).toHaveLength(1);
    });
  });

  describe('2. 3-Way Invoice Match Engine & Zero Double-Counting GRN Conversion', () => {
    it('should match vendor tax invoice against pending DC and convert to GRN without doubling inventory', async () => {
      const dcDetails = await inboundDcService.getInboundDCDetails(createdDc.id);
      const dcItem = dcDetails.items[0];

      // Stock quantity before 3-way match
      const stockBefore = await db('stock').where('item_code', TEST_ITEM_CODE).whereNotNull('batch_no').first();
      const qtyBeforeMatch = parseFloat(stockBefore.remaining);

      // Supplier invoice arrives with finalized unit rate (e.g. ₹66.50 instead of estimated ₹65)
      const matchPayload = {
        vendor_invoice_no: 'TAX-INV-HERITAGE-4402',
        invoice_date: new Date().toISOString().slice(0, 10),
        items: [
          {
            id: dcItem.id,
            invoice_qty: 100,
            invoice_unit_price: 66.50,
            notes: 'Contract rate applied (+₹1.50/L seasonal revision)'
          }
        ]
      };

      const user = { id: 1, name: 'Store Admin', role: 'admin' };
      const matchResult = await inboundDcService.matchInvoiceAndGenerateGRN(createdDc.id, matchPayload, user);

      expect(matchResult).toBeDefined();
      expect(matchResult.grn_id).toBeDefined();
      expect(matchResult.grn_number).toMatch(/^GRN-\d{8}-\d{4}$/);
      expect(matchResult.status).toBe('GRN_COMPLETED');

      // ── CRITICAL INVARIANT: Zero Double-Counting Guarantee ──
      const stockAfter = await db('stock').where('item_code', TEST_ITEM_CODE).whereNotNull('batch_no').first();
      const qtyAfterMatch = parseFloat(stockAfter.remaining);
      expect(qtyAfterMatch).toBe(qtyBeforeMatch); // Qty must NOT double!

      // Verify stock price updated to match invoice rate
      expect(parseFloat(stockAfter.price)).toBeCloseTo(66.50);

      // Verify double-entry ledger entry was retagged from INWARD_DC_PROVISIONAL -> INWARD_GRN
      const grnLedgerEntry = await db('stock_ledger')
        .where('item_code', TEST_ITEM_CODE)
        .andWhere('transaction_type', 'INWARD_GRN')
        .first();
      expect(grnLedgerEntry).toBeDefined();
      expect(parseFloat(grnLedgerEntry.unit_price)).toBeCloseTo(66.50);

      // Verify DC status updated in database
      const dcInDb = await db('inbound_dcs').where('id', createdDc.id).first();
      expect(dcInDb.status).toBe('GRN_COMPLETED');
      expect(String(dcInDb.converted_grn_id)).toBe(String(matchResult.grn_id));

      // Verify 3-way match tolerance and price drift response
      expect(matchResult.price_drift_alerts).toBeDefined();
      expect(Array.isArray(matchResult.price_drift_alerts)).toBe(true);
      expect(matchResult.tolerance_exceeded).toBe(false); // 66.50 vs 65 is +2.3%, well within 10%
    });
  });

  describe('3. Returnable Asset Custody Tracking (RGP) Reconciliation', () => {
    it('should create an RGP gate pass for LPG cylinders / milk cans and reconcile partial return', async () => {
      // 1. Create a Returnable Gate Pass
      const user = { id: 1, name: 'Gate Officer', role: 'security' };
      const passData = {
        pass_type: 'RGP_RETURNABLE',
        party_name: 'Heritage Dairy Logistics',
        vehicle_number: 'AP 09 TG 5512',
        driver_name: 'Venkatesh',
        driver_phone: '9848012345',
        purpose: 'Returning empty 40L Stainless Milk Cans for cleaning & refilling',
        returnable_qty_out: 4,
        returnable_item_type: 'Stainless Steel Milk Cans',
        expected_return_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        items: [
          {
            item_name: '40-Liter Stainless Steel Milk Cans',
            qty: 4,
            unit: 'can',
            package_type: 'Canister',
            is_returnable: true
          }
        ]
      };

      const pass = await securityGateService.createPass(passData, user);
      expect(pass).toBeDefined();
      rgpPassId = pass.id;
      expect(pass.pass_number).toMatch(/^GP-\d{4}-\d{4}$/);
      expect(parseInt(pass.returnable_balance_due, 10)).toBe(4);

      // 2. Simulate return of 2 cans next morning
      const reconcileData = {
        qty_returned: 2,
        notes: '2 cans returned in clean condition by morning driver.'
      };

      const updatedPass = await securityGateService.reconcileRgp(rgpPassId, reconcileData, user);
      expect(updatedPass).toBeDefined();
      expect(parseInt(updatedPass.returnable_qty_in, 10)).toBe(2);
      expect(parseInt(updatedPass.returnable_balance_due, 10)).toBe(2);
      expect(updatedPass.is_return_completed).toBe(false);

      // 3. Return remaining 2 cans
      const finalReconcile = await securityGateService.reconcileRgp(rgpPassId, {
        qty_returned: 2,
        notes: 'Final 2 cans returned. RGP custody closed.'
      }, user);
      expect(finalReconcile).toBeDefined();
      expect(parseInt(finalReconcile.returnable_qty_in, 10)).toBe(4);
      expect(parseInt(finalReconcile.returnable_balance_due, 10)).toBe(0);
      expect(finalReconcile.is_return_completed).toBe(true);
    });
  });
});
