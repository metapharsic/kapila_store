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

const purchaseOrderController = require('../controllers/purchaseOrderController');
const reorderController = require('../controllers/reorderController');
const departmentController = require('../controllers/departmentController');

describe('Enterprise Multi-Agent Swarm Integration Test Suite', () => {
  let testSupplierId = null;
  let testPoId = null;
  let testDeptId = null;
  const uniqueSuffix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    // Create test supplier
    const [supplier] = await db('suppliers')
      .insert({
        name: `Test Vendor Swarm ${uniqueSuffix}`,
        contact_name: 'Vendor Lead',
        phone: '9876543210',
        email: `vendor_${uniqueSuffix}@example.com`,
      })
      .returning('*');
    testSupplierId = supplier.id;

    // Create test department
    const [dept] = await db('departments')
      .insert({
        name: `Test Culinary Unit ${uniqueSuffix}`,
        code: `TC${uniqueSuffix.slice(-3)}`,
        chef_name: 'Executive Chef Test',
      })
      .returning('*');
    testDeptId = dept.id;
  });

  afterAll(async () => {
    try {
      if (testPoId) {
        await db('purchase_order_items').where('po_id', testPoId).del();
        await db('purchase_orders').where('id', testPoId).del();
      }
      if (testDeptId) {
        await db('departments').where('id', testDeptId).del();
      }
      if (testSupplierId) {
        await db('suppliers').where('id', testSupplierId).del();
      }
    } catch (err) {
      console.warn('Cleanup error:', err.message);
    }
  });

  describe('Module 1 & 2: P2P Swarm - Purchase Orders & Goods Receipt Flow', () => {
    it('creates a draft Purchase Order with line items and calculates totals', async () => {
      const req = {
        body: {
          supplier_id: testSupplierId,
          date: '2026-09-10',
          delivery_date: '2026-09-15',
          notes: 'Test enterprise PO sync',
          status: 'Draft',
          items: [
            {
              item_code: `ITEM_${uniqueSuffix}_A`,
              name: 'Premium Basmati Rice 25kg',
              unit: 'BAG',
              qty: 10,
              unit_price: 1500.0,
            },
            {
              item_code: `ITEM_${uniqueSuffix}_B`,
              name: 'Cold Pressed Sunflower Oil 15L',
              unit: 'TIN',
              qty: 5,
              unit_price: 2100.0,
            },
          ],
        },
        user: { id: 1, name: 'Store Manager', isAdmin: true, roles: [{ key: 'admin' }] },
      };

      let responseData = null;
      let statusCode = 200;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          responseData = data;
          return res;
        },
      };

      await purchaseOrderController.create(req, res, (err) => {
        if (err) throw err;
      });

      expect(statusCode).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data.po_number).toMatch(/^PO-/);
      expect(responseData.data.status).toBe('Draft');
      expect(parseFloat(responseData.data.total_amount)).toBe(10 * 1500 + 5 * 2100); // 25,500 > 10,000 threshold

      testPoId = responseData.data.id;

      // Verify DB persistence of items
      const poItems = await db('purchase_order_items').where('po_id', testPoId);
      expect(poItems.length).toBe(2);
      expect(parseFloat(poItems[0].total_price)).toBe(parseFloat(poItems[0].qty) * parseFloat(poItems[0].unit_price));
    });

    it('retrieves detailed PO with computed summary and supplier links', async () => {
      const req = {
        params: { id: testPoId },
      };

      let responseData = null;
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
      };

      await purchaseOrderController.getOne(req, res, (err) => {
        if (err) throw err;
      });

      expect(responseData.success).toBe(true);
      expect(responseData.data.id).toBe(testPoId);
      expect(responseData.data.items.length).toBe(2);
      expect(responseData.data.supplier_name).toBe(`Test Vendor Swarm ${uniqueSuffix}`);
    });

    it('transitions PO status from draft to approved', async () => {
      const req = {
        params: { id: testPoId },
        body: { status: 'Approved' },
        user: { id: 1, name: 'Store Manager', isAdmin: true },
      };

      let responseData = null;
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
      };

      await purchaseOrderController.update(req, res, (err) => {
        if (err) throw err;
      });

      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('Approved');

      const poInDb = await db('purchase_orders').where('id', testPoId).first();
      expect(poInDb.status).toBe('Approved');
    });
  });

  describe('Module 3: Reorder Points & Stockout Sentinel Swarm', () => {
    it('executes reorder points alerts engine without errors', async () => {
      const req = {};
      let responseData = null;
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
      };

      await reorderController.alerts(req, res, (err) => {
        if (err) throw err;
      });

      expect(responseData.success).toBe(true);
      expect(Array.isArray(responseData.data)).toBe(true);
    });

    it('queries reorder rules list successfully with pagination', async () => {
      const req = {
        query: {},
        pagination: { offset: 0, limit: 10, page: 1, sort: 'name', order: 'asc' },
      };
      let responseData = null;
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
      };

      await reorderController.list(req, res, (err) => {
        if (err) throw err;
      });

      expect(responseData.success).toBe(true);
      expect(Array.isArray(responseData.data)).toBe(true);
    });
  });

  describe('Module 7: Master Data Governance - Departments Swarm', () => {
    it('lists departments including our newly provisioned unit', async () => {
      const req = { user: { isAdmin: true } };
      let responseData = null;
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
      };

      await departmentController.list(req, res, (err) => {
        if (err) throw err;
      });

      expect(responseData.success).toBe(true);
      expect(Array.isArray(responseData.data)).toBe(true);
      const found = responseData.data.find((d) => d.id === testDeptId);
      expect(found).toBeDefined();
      expect(found.chef_name).toBe('Executive Chef Test');
    });

    it('updates department metadata properly', async () => {
      const req = {
        params: { id: testDeptId },
        body: {
          name: `Updated Culinary Unit ${uniqueSuffix}`,
          code: `TC${uniqueSuffix.slice(-3)}`,
          chef_name: 'Chef Anthony Bourdain',
        },
      };

      let responseData = null;
      const res = {
        json: (data) => {
          responseData = data;
          return res;
        },
      };

      await departmentController.update(req, res, (err) => {
        if (err) throw err;
      });

      expect(responseData.success).toBe(true);
      const deptInDb = await db('departments').where('id', testDeptId).first();
      expect(deptInDb.name).toBe(`Updated Culinary Unit ${uniqueSuffix}`);
      expect(deptInDb.chef_name).toBe('Chef Anthony Bourdain');
    });
  });

  describe('Module 8: User Management & RBAC Sentinel Swarm', () => {
    it('verifies roles and core permissions table integrity', async () => {
      const roles = await db('roles').select('*');
      expect(roles.length).toBeGreaterThanOrEqual(1);

      const roleKeys = roles.map((r) => r.key);
      expect(roleKeys).toContain('admin');

      const permissions = await db('permissions').select('*');
      expect(permissions.length).toBeGreaterThanOrEqual(5);
    });
  });
});
