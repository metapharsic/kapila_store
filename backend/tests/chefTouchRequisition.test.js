const db = require('../db');
const indentController = require('../controllers/indentController');

describe('Chef Touch Requisition Cockpit & Multi-Agent Radar Suite', () => {
  let createdIndentId = null;
  let createdNotificationId = null;

  afterAll(async () => {
    try {
      if (createdIndentId) {
        await db('approval_requests').where('module', 'indents').where('resource_id', createdIndentId).del();
        await db('indent_items').where('indent_id', createdIndentId).del();
        await db('indents').where('id', createdIndentId).del();
      }
      if (createdNotificationId) {
        await db('notifications').where('id', createdNotificationId).del();
      }
    } catch (e) {
      console.error('Test cleanup error:', e.message);
    }
    await db.destroy();
  });

  it('1. Should return keen station requirement radar with live store telemetry and 4-agent status', async () => {
    const req = {
      query: { dept: 'TIFFINS' },
      user: { id: 1, name: 'Chef Test', role: 'chef' }
    };
    const res = {
      statusCode: 200,
      status: jest.fn(function(code) { this.statusCode = code; return this; }),
      json: jest.fn(function(data) { this.data = data; return this; })
    };
    const next = jest.fn();

    await indentController.getChefRadar(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];

    expect(body.success).toBe(true);
    expect(body.dept).toBe('TIFFINS');
    expect(Array.isArray(body.subcategories)).toBe(true);
    expect(Array.isArray(body.catalog_items)).toBe(true);
    expect(Array.isArray(body.disposables)).toBe(true);
    expect(Array.isArray(body.critical_items)).toBe(true);

    // Verify 4-Agent pipeline
    expect(body.agents).toBeDefined();
    expect(body.agents.scout.status).toBe('ONLINE');
    expect(body.agents.recipe.status).toBe('ONLINE');
    expect(body.agents.guardian.status).toBe('ONLINE');
    expect(body.agents.dispatcher.status).toBe('ONLINE');
  });

  it('2. Should atomically submit chef indent with both ingredients and packaging disposables', async () => {
    const req = {
      body: {
        dept: 'TIFFINS',
        shift: 'NIGHT_INDENT',
        priority: 'NORMAL',
        date: new Date().toISOString().slice(0, 10),
        submittedBy: 'Chef Terminal Touchpad',
        remarks: 'Nightly test requisition via touch workspace',
        items: [
          {
            name: 'Idli Rava Premium',
            unit: 'KG',
            qty: 15,
            requestedQty: 15,
            price: 38
          },
          {
            name: 'Box Container 500 Ml',
            unit: 'PCS',
            qty: 100,
            requestedQty: 100,
            price: 4.5
          }
        ]
      },
      user: { id: 1, name: 'Chef Test', role: 'chef' }
    };
    const res = {
      statusCode: 200,
      status: jest.fn(function(code) { this.statusCode = code; return this; }),
      json: jest.fn(function(data) { this.data = data; return this; })
    };
    const next = jest.fn();

    await indentController.chefSubmit(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];

    expect(body.success).toBe(true);
    const indentObj = body.data || body.indent || body;
    expect(indentObj.id).toBeDefined();
    createdIndentId = indentObj.id;

    // Verify saved in DB
    const savedItems = await db('indent_items').where('indent_id', createdIndentId);
    expect(savedItems.length).toBe(2);
  });

  it('3. Should trigger instant stockout alert to Store Manager via notifyStockout', async () => {
    const req = {
      body: {
        itemName: 'Idly Rice Premium',
        itemCode: 'TFN-RICE-01',
        dept: 'TIFFINS',
        requestedQty: 25,
        unit: 'KG'
      },
      user: { id: 1, name: 'Chef Test', role: 'chef' }
    };
    const res = {
      statusCode: 200,
      status: jest.fn(function(code) { this.statusCode = code; return this; }),
      json: jest.fn(function(data) { this.data = data; return this; })
    };
    const next = jest.fn();

    await indentController.notifyStockout(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];

    expect(body.success).toBe(true);
    expect(body.alerted).toBe(true);
    expect(body.notificationId).toBeDefined();
    createdNotificationId = body.notificationId;

    // Verify notification was stored in DB with critical severity
    const notif = await db('notifications').where('id', createdNotificationId).first();
    expect(notif).toBeDefined();
    expect(notif.severity).toBe('critical');
    expect(notif.type).toBe('low_stock');
    expect(notif.title).toContain('Stockout Alert');
    expect(notif.message).toContain('Idly Rice Premium');
  });
});
