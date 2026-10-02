const db = require('../db');
const auditController = require('../controllers/auditController');
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

describe('Stock Audit Multi-Agent & Multi-Thread Concurrency Suite', () => {
  const TEST_REF = 'AUDIT_MA_' + Math.floor(Date.now() % 1000000);
  const TEST_CODE_1 = 'AUD_ITM_1_' + Math.floor(Date.now() % 100000);
  const TEST_CODE_2 = 'AUD_ITM_2_' + Math.floor(Date.now() % 100000);
  let auditSessionId = null;
  let auditItemId1 = null;
  let auditItemId2 = null;
  let stockId1 = null;
  let stockId2 = null;

  beforeAll(async () => {
    // Complete any leftover in_progress sessions to prevent conflict
    await db('audit_sessions').whereNull('department_id').where('status', 'in_progress').update({ status: 'completed' });

    // 1. Create 2 test stock items
    const [s1] = await db('stock').insert({
      item_code: TEST_CODE_1,
      name: 'Multi-Agent Test Basmati Rice',
      category: 'Grains & Rice',
      unit: 'kg',
      qty: 100,
      remaining: 100,
      price: 90,
      date: '2026-10-01',
      supplier: 'Godavari Traders'
    }).returning('*');
    stockId1 = s1.id;

    const [s2] = await db('stock').insert({
      item_code: TEST_CODE_2,
      name: 'Multi-Agent Test Pure Ghee',
      category: 'Dairy',
      unit: 'Ltr',
      qty: 50,
      remaining: 50,
      price: 650,
      date: '2026-10-01',
      supplier: 'Sangam Dairy'
    }).returning('*');
    stockId2 = s2.id;
  });

  afterAll(async () => {
    try {
      if (auditSessionId) {
        await db('stock_ledger').where('reference_doc_id', auditSessionId).del();
        await db('audit_items').where('audit_session_id', auditSessionId).del();
        await db('audit_sessions').where('id', auditSessionId).del();
      }
      await db('stock_adjustments').whereIn('stock_id', [stockId1, stockId2].filter(Boolean)).del();
      await db('stock').whereIn('item_code', [TEST_CODE_1, TEST_CODE_2]).del();
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await db.destroy();
  });

  it('1. Should create audit session with snapshot of stock items', async () => {
    const req = {
      body: {
        reference: TEST_REF,
        auditor_name: 'Agent Veritas QA',
        department_id: null,
        notes: 'Multi-Agent & Multi-Thread Concurrency Test'
      },
      user: { id: 1, username: 'tester' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await auditController.create(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    const sessionData = res.json.mock.calls[0][0].data;
    auditSessionId = sessionData.id;

    expect(auditSessionId).toBeDefined();
    expect(sessionData.reference).toBe(TEST_REF);

    // Fetch the 2 test audit items
    const items = await db('audit_items')
      .where('audit_session_id', auditSessionId)
      .whereIn('item_code', [TEST_CODE_1, TEST_CODE_2]);
    expect(items.length).toBe(2);

    const it1 = items.find(i => i.item_code === TEST_CODE_1);
    const it2 = items.find(i => i.item_code === TEST_CODE_2);
    auditItemId1 = it1.id;
    auditItemId2 = it2.id;
  });

  it('2. Should process batch counts concurrently using parallel chunk worker logic', async () => {
    const req = {
      params: { id: auditSessionId },
      body: {
        items: [
          { audit_item_id: auditItemId1, physical_qty: 92 }, // 8 units shrinkage
          { audit_item_id: auditItemId2, physical_qty: 54 }  // 4 units surplus
        ]
      },
      user: { id: 1 }
    };
    const res = {
      json: jest.fn()
    };
    const next = jest.fn();

    await auditController.batchCount(req, res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.updated_count).toBe(2);

    const updated1 = await db('audit_items').where('id', auditItemId1).first();
    expect(parseFloat(updated1.physical_qty)).toBe(92);
    expect(parseFloat(updated1.difference)).toBe(-8);

    const updated2 = await db('audit_items').where('id', auditItemId2).first();
    expect(parseFloat(updated2.physical_qty)).toBe(54);
    expect(parseFloat(updated2.difference)).toBe(4);
  });

  it('3. Should provide Agent Telemetry across Sentinel, Auditor, Valuator, and Veritas', async () => {
    const req = {
      params: { id: auditSessionId }
    };
    const res = {
      json: jest.fn()
    };
    const next = jest.fn();

    await auditController.getAgentTelemetry(req, res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);

    const tel = body.data;
    // Agent Auditor checks
    expect(tel.agent_auditor).toBeDefined();
    expect(tel.agent_auditor.counted_skus).toBe(2);
    expect(tel.agent_auditor.progress_pct).toBeGreaterThanOrEqual(0);

    // Agent Valuator checks
    expect(tel.agent_valuator).toBeDefined();
    expect(tel.agent_valuator.currency).toBe('INR');

    // Agent Sentinel checks
    expect(tel.agent_sentinel).toBeDefined();
    expect(tel.agent_sentinel.role).toBe('Variance Anomaly Detector');

    // Agent Veritas checks
    expect(tel.agent_veritas).toBeDefined();
    expect(tel.agent_veritas.role).toBe('Atomic Ledger Adjuster');
  });

  it('4. Should finalise audit and atomically post ADJUSTMENT_ADD and ADJUSTMENT_DEDUCT into stock_ledger', async () => {
    // Fill remaining items in session so all items are counted
    const allItems = await db('audit_items').where('audit_session_id', auditSessionId);
    for (const it of allItems) {
      if (it.physical_qty === null) {
        await db('audit_items').where('id', it.id).update({
          physical_qty: it.db_qty,
          difference: 0
        });
      }
    }

    const req = {
      params: { id: auditSessionId },
      body: {
        items: [
          { audit_item_id: auditItemId1, discrepancy_reason: 'Kitchen Spoilage', action: 'adjust_db' },
          { audit_item_id: auditItemId2, discrepancy_reason: 'Found Unopened Tin', action: 'adjust_db' }
        ]
      },
      user: { id: 1, username: 'veritas_auditor' }
    };
    const res = {
      json: jest.fn()
    };
    const next = jest.fn();

    await auditController.finalise(req, res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);

    // Verify stock_ledger records created with reference_doc_type = 'AUDIT'
    const ledgerRecords = await db('stock_ledger')
      .where('reference_doc_type', 'AUDIT')
      .where('reference_doc_id', auditSessionId);

    expect(ledgerRecords.length).toBeGreaterThanOrEqual(2);

    const deductEntry = ledgerRecords.find(l => l.item_code === TEST_CODE_1);
    expect(deductEntry).toBeDefined();
    expect(deductEntry.transaction_type).toBe('ADJUSTMENT_DEDUCT');
    expect(parseFloat(deductEntry.qty)).toBe(8);
    expect(parseFloat(deductEntry.balance_qty_after)).toBe(92);

    const addEntry = ledgerRecords.find(l => l.item_code === TEST_CODE_2);
    expect(addEntry).toBeDefined();
    expect(addEntry.transaction_type).toBe('ADJUSTMENT_ADD');
    expect(parseFloat(addEntry.qty)).toBe(4);
    expect(parseFloat(addEntry.balance_qty_after)).toBe(54);
  });

  it('5. Should export branded Excel variance report successfully', async () => {
    const req = {
      params: { id: auditSessionId }
    };
    const stream = new PassThrough();
    const res = stream;
    res.setHeader = jest.fn();
    res.status = jest.fn().mockReturnThis();

    const next = jest.fn();

    await auditController.exportExcel(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('6. Should export CSV variance report successfully', async () => {
    const req = {
      params: { id: auditSessionId }
    };
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    const next = jest.fn();

    await auditController.exportCsv(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.send).toHaveBeenCalled();
    const csv = res.send.mock.calls[0][0];
    expect(csv).toContain('Item Code');
    expect(csv).toContain(TEST_CODE_1);
  });
});
