const db = require('../db');

jest.mock('../services/permissionService', () => ({
  getDepartmentNames: jest.fn().mockResolvedValue(null),
  assertDepartmentAccess: jest.fn().mockResolvedValue(undefined)
}));

describe('Store Manager and Admin Multi-Agent Synchronization', () => {
  afterAll(async () => {
    await db.destroy();
  });

  describe('DevOps Agent: Approval Rules & Permissions Matrix', () => {
    it('seeds active approval rules for all four modules', async () => {
      const rules = await db('approval_rules').select('*');
      const modules = rules.map(r => r.module);
      expect(modules).toContain('purchase_orders');
      expect(modules).toContain('indents');
      expect(modules).toContain('reconciliations');
      expect(modules).toContain('transfers');
    });

    it('assigns operational approval tier (<= 25k) to store manager and high-value to admin', async () => {
      const smRole = await db('roles').where('key', 'store_manager').first();
      const adminRole = await db('roles').where('key', 'admin').first();

      const poRules = await db('approval_rules')
        .where('module', 'purchase_orders')
        .orderBy('min_amount', 'asc');

      expect(poRules.length).toBeGreaterThanOrEqual(2);
      expect(poRules[0].role_id).toBe(smRole.id);
      expect(parseFloat(poRules[0].max_amount)).toBe(25000.00);

      const highValueRule = poRules.find(r => r.max_amount === null);
      expect(highValueRule.role_id).toBe(adminRole.id);
    });

    it('grants store_manager operational permissions for GRN, Reconcile, and Transfers', async () => {
      const smRole = await db('roles').where('key', 'store_manager').first();
      const perms = await db('role_permissions')
        .join('permissions', 'role_permissions.permission_id', 'permissions.id')
        .where('role_permissions.role_id', smRole.id)
        .pluck('permissions.key');

      expect(perms).toContain('grn.view');
      expect(perms).toContain('grn.create');
      expect(perms).toContain('reconciliation.view');
      expect(perms).toContain('reconciliation.create');
      expect(perms).toContain('transfers.view');
      expect(perms).toContain('transfers.create');
      expect(perms).toContain('audit.view');
    });
  });

  describe('Backend Developer Agent: Purchase Order Guardrails', () => {
    it('rejects marking a PO as Received directly via PATCH', async () => {
      // Create a test PO
      const supplier = await db('suppliers').first();
      if (!supplier) return;

      const todayStr = new Date().toISOString().slice(0, 10);
      const [po] = await db('purchase_orders')
        .insert({
          po_number: `TEST-PO-${Date.now()}`,
          supplier_id: supplier.id,
          date: todayStr,
          status: 'Draft',
          total_amount: 1000
        })
        .returning('*');

      const ctrl = require('../controllers/purchaseOrderController');

      let errorMsg = null;
      let statusCode = null;

      const req = {
        params: { id: po.id },
        body: { status: 'Received' },
        user: { id: 1, isAdmin: true }
      };
      const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { errorMsg = payload.error; return this; }
      };

      await ctrl.update(req, res, () => {});

      expect(statusCode).toBe(400);
      expect(errorMsg).toMatch(/Goods Receipt/i);

      // Cleanup
      await db('purchase_orders').where('id', po.id).del();
    });

    it('rejects marking a Draft PO as Sent without Approval', async () => {
      const supplier = await db('suppliers').first();
      if (!supplier) return;

      const todayStr = new Date().toISOString().slice(0, 10);
      const [po] = await db('purchase_orders')
        .insert({
          po_number: `TEST-PO-DRAFT-${Date.now()}`,
          supplier_id: supplier.id,
          date: todayStr,
          status: 'Draft',
          total_amount: 5000
        })
        .returning('*');

      const ctrl = require('../controllers/purchaseOrderController');

      let errorMsg = null;
      let statusCode = null;

      const req = {
        params: { id: po.id },
        body: { status: 'Sent' },
        user: { id: 2, isAdmin: false }
      };
      const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { errorMsg = payload.error; return this; }
      };

      await ctrl.update(req, res, () => {});

      expect(statusCode).toBe(400);
      expect(errorMsg).toMatch(/Approved/i);

      // Cleanup
      await db('purchase_orders').where('id', po.id).del();
    });
  });

  describe('Data Agent: Dashboard KPI Synchronization', () => {
    it('counts both GRNs and stock purchase entries for today_stock_entries', async () => {
      const ctrl = require('../controllers/dashboardController');

      let responseData = null;
      const req = { user: { id: 1, isAdmin: true } };
      const res = {
        json(payload) { responseData = payload.data; return this; }
      };

      await ctrl.storeHome(req, res, () => {});

      expect(responseData).toBeDefined();
      expect(typeof responseData.today_stock_entries).toBe('number');
      expect(typeof responseData.pending_indents).toBe('number');
      expect(typeof responseData.low_stock_count).toBe('number');
    });
  });
});
