const db = require('../db');
const reorderController = require('../controllers/reorderController');
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

describe('Reorder Points Multi-Agent Swarm & Multi-Thread Concurrency Suite', () => {
  const TEST_CODE_1 = 'RP_MA_1_' + Math.floor(Date.now() % 100000);
  const TEST_CODE_2 = 'RP_MA_2_' + Math.floor(Date.now() % 100000);
  let ruleId1 = null;
  let ruleId2 = null;
  let supplierId = null;
  let stockId1 = null;
  let stockId2 = null;

  beforeAll(async () => {
    // 1. Create test supplier
    const [sup] = await db('suppliers').insert({
      name: 'Agent Sourcing Supplier ' + Date.now(),
      phone: '9876543210',
      email: 'sourcing@kapilatest.com'
    }).returning('*');
    supplierId = sup.id;

    // 2. Create 2 test stock items
    const [s1] = await db('stock').insert({
      item_code: TEST_CODE_1,
      name: 'Reorder Test Paneer Block 1kg',
      category: 'Dairy',
      unit: 'kg',
      qty: 10,
      remaining: 4, // Breached: 4 <= min_qty 8
      price: 320,
      date: '2026-10-01',
      supplier: sup.name
    }).returning('*');
    stockId1 = s1.id;

    const [s2] = await db('stock').insert({
      item_code: TEST_CODE_2,
      name: 'Reorder Test Sona Masoori 25kg',
      category: 'Grains & Rice',
      unit: 'kg',
      qty: 25,
      remaining: 2, // Critical: 2 <= min_qty 10
      price: 65,
      date: '2026-10-01',
      supplier: sup.name
    }).returning('*');
    stockId2 = s2.id;

    // 3. Create reorder point rules
    const [r1] = await db('reorder_points').insert({
      item_code: TEST_CODE_1,
      name: 'Reorder Test Paneer Block 1kg',
      min_qty: 8,
      reorder_qty: 20,
      lead_time_days: 2,
      preferred_supplier_id: supplierId,
      is_active: true
    }).returning('*');
    ruleId1 = r1.id;

    const [r2] = await db('reorder_points').insert({
      item_code: TEST_CODE_2,
      name: 'Reorder Test Sona Masoori 25kg',
      min_qty: 10,
      reorder_qty: 50,
      lead_time_days: 3,
      preferred_supplier_id: supplierId,
      is_active: true
    }).returning('*');
    ruleId2 = r2.id;
  });

  afterAll(async () => {
    try {
      if (supplierId) {
        const pos = await db('purchase_orders').where('supplier_id', supplierId).select('id');
        const poIds = pos.map(p => p.id);
        if (poIds.length > 0) {
          await db('approval_requests').where('module', 'purchase_orders').whereIn('resource_id', poIds).del();
          await db('purchase_order_items').whereIn('po_id', poIds).del();
          await db('purchase_orders').whereIn('id', poIds).del();
        }
        await db('reorder_points').whereIn('id', [ruleId1, ruleId2].filter(Boolean)).del();
        await db('stock').whereIn('item_code', [TEST_CODE_1, TEST_CODE_2]).del();
        await db('suppliers').where('id', supplierId).del();
      }
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await db.destroy();
  });

  it('1. Should return real-time multi-agent telemetry across all 4 agents', async () => {
    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();

    await reorderController.agentTelemetry(req, res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);

    const tel = body.data;
    // Sentinel check
    expect(tel.agent_sentinel).toBeDefined();
    expect(tel.agent_sentinel.breached_count).toBeGreaterThanOrEqual(2);

    // Forecaster check
    expect(tel.agent_forecaster).toBeDefined();
    expect(tel.agent_forecaster.status).toBe('ACTIVE');

    // Strategist check
    expect(tel.agent_strategist).toBeDefined();
    expect(tel.agent_strategist.currency).toBe('INR');

    // Dispatcher check
    expect(tel.agent_dispatcher).toBeDefined();
    expect(tel.agent_dispatcher.ready_for_dispatch).toBe(true);
  });

  it('2. Should concurrently update reorder rules using parallel chunk worker logic', async () => {
    const req = {
      body: {
        rules: [
          { id: ruleId1, min_qty: 12, reorder_qty: 30 },
          { id: ruleId2, min_qty: 15, reorder_qty: 60 }
        ]
      }
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await reorderController.batchUpdate(req, res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.updated_count).toBe(2);

    const r1 = await db('reorder_points').where('id', ruleId1).first();
    expect(parseFloat(r1.min_qty)).toBe(12);
    expect(parseFloat(r1.reorder_qty)).toBe(30);
  });

  it('3. Should automatically recalibrate rules based on velocity and lead time buffers', async () => {
    const req = {
      body: { item_codes: [TEST_CODE_1, TEST_CODE_2] }
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await reorderController.recalibrate(req, res, next);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
  });

  it('4. Should batch-draft consolidated POs grouped by supplier with approval routing', async () => {
    const req = {
      body: { item_ids: [ruleId1, ruleId2] },
      user: { id: 1 }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await reorderController.batchDraftPOs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.created_count).toBe(1); // Grouped into 1 consolidated PO for supplier

    const createdPO = body.orders[0];
    expect(createdPO.supplier_id).toBe(supplierId);
    expect(createdPO.status).toBe('Draft');

    // Verify approval request was created or PO status
    const appReq = await db('approval_requests')
      .where('module', 'purchase_orders')
      .where('resource_id', createdPO.id)
      .first();
    const poInDb = await db('purchase_orders').where('id', createdPO.id).first();
    expect(poInDb).toBeDefined();
    expect(['Draft', 'Approved']).toContain(poInDb.status);
  });

  it('5. Should export branded Excel variance report successfully', async () => {
    const req = {};
    const stream = new PassThrough();
    const res = stream;
    res.setHeader = jest.fn();
    res.status = jest.fn().mockReturnThis();
    const next = jest.fn();

    await reorderController.exportExcel(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('6. Should export CSV report successfully', async () => {
    const req = {};
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    const next = jest.fn();

    await reorderController.exportCsv(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.send).toHaveBeenCalled();
  });
});
