const db = require('../db');
const automaticAlertService = require('../services/automaticAlertService');
const indentController = require('../controllers/indentController');

describe('Automatic Real-Time Intimation Suite (Admin & Store Manager)', () => {
  let createdNotificationIds = [];
  let testIndentId = null;

  afterAll(async () => {
    try {
      if (testIndentId) {
        await db('approval_requests').where('module', 'indents').where('resource_id', testIndentId).del();
        await db('indent_items').where('indent_id', testIndentId).del();
        await db('indents').where('id', testIndentId).del();
      }
      if (createdNotificationIds.length > 0) {
        await db('notifications').whereIn('id', createdNotificationIds).del();
      }
    } catch (e) {
      console.error('Test cleanup error:', e.message);
    }
    await db.destroy();
  });

  it('1. notifyIndentRaised should automatically intimate both Admin and Store Manager with item count and price value', async () => {
    const mockIndent = { id: 98765, dept: 'TIFFINS', shift: 'NIGHT_INDENT', priority: 'NORMAL' };
    const mockItems = [
      { name: 'Idly Rice Premium', qty: 20, unit_price: 45, unit: 'KG' },
      { name: 'Urad Dal Gota', qty: 10, unit_price: 130, unit: 'KG' },
      { name: 'Packaging Box 500ml', qty: 100, unit_price: 4.5, unit: 'PCS' }
    ];
    // Expected value = (20*45) + (10*130) + (100*4.5) = 900 + 1300 + 450 = 2650

    const res = await automaticAlertService.notifyIndentRaised({
      indent: mockIndent,
      items: mockItems,
      user: { name: 'Chef Raghavan' },
      dept: 'TIFFINS',
      shift: 'NIGHT_INDENT',
      priority: 'NORMAL',
      remarks: 'Early morning breakfast prep'
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(3);
    expect(res.totalValue).toBe(2650);

    // Verify notifications were inserted for both admin and store_manager
    const notifs = await db('notifications')
      .whereRaw("metadata::text LIKE '%98765%'")
      .select('*');

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    notifs.forEach((n) => {
      createdNotificationIds.push(n.id);
      expect(n.type).toBe('approval_pending');
      expect(n.title).toContain('New Indent: TIFFINS');
      expect(n.message).toContain('3 items');
      expect(n.message).toContain('2,650.00');
      const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
      expect(meta.item_count).toBe(3);
      expect(meta.total_value).toBe(2650);
    });
  });

  it('2. notifyIssuanceCompleted should automatically intimate both Admin and Store Manager with item count and total price value', async () => {
    const mockIssuance = { id: 87654, dept: 'NORTH INDIAN', indent_id: 12345, reference_doc_no: 'ISS-2026-0042' };
    const mockIssuedItems = [
      { name: 'Paneer Fresh Block', issued: 15, unit_price: 360, unit: 'KG' },
      { name: 'Kasuri Methi', issued: 2, unit_price: 180, unit: 'KG' }
    ];
    // Expected value = (15*360) + (2*180) = 5400 + 360 = 5760

    const res = await automaticAlertService.notifyIssuanceCompleted({
      issuance: mockIssuance,
      items: mockIssuedItems,
      user: { name: 'Storekeeper Murugan' },
      dept: 'NORTH INDIAN',
      indentId: 12345,
      issueSlipNumber: 'ISS-2026-0042'
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(res.totalIssuedValue).toBe(5760);

    // Verify notifications inserted for issuance
    const notifs = await db('notifications')
      .whereRaw("metadata::text LIKE '%87654%'")
      .select('*');

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    notifs.forEach((n) => {
      createdNotificationIds.push(n.id);
      expect(n.type).toBe('approval_action');
      expect(n.title).toContain('Materials Issued: NORTH INDIAN');
      expect(n.message).toContain('2 items');
      expect(n.message).toContain('5,760.00');
      const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
      expect(meta.item_count).toBe(2);
      expect(meta.total_value).toBe(5760);
      expect(meta.issue_slip).toBe('ISS-2026-0042');
    });
  });

  it('3. chefSubmit should automatically trigger intimation with item count and price value', async () => {
    const req = {
      body: {
        dept: 'SI-MEALS',
        shift: 'NIGHT_INDENT',
        priority: 'NORMAL',
        date: new Date().toISOString().slice(0, 10),
        submittedBy: 'Chef Sitaram',
        remarks: 'Afternoon lunch rush staples',
        items: [
          { name: 'Sona Masoori Rice', unit: 'KG', qty: 25, price: 48 },
          { name: 'Toor Dal Premium', unit: 'KG', qty: 10, price: 155 }
        ]
      },
      user: { id: 1, name: 'Chef Sitaram', role: 'chef' }
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
    testIndentId = indentObj.id;

    // Check notifications generated for this indent
    const notifs = await db('notifications')
      .whereRaw(`metadata::text LIKE '%${testIndentId}%'`)
      .select('*');

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    notifs.forEach(n => createdNotificationIds.push(n.id));

    const alertNotifs = notifs.filter(n => n.title && n.title.includes('New Indent: SI-MEALS'));
    expect(alertNotifs.length).toBeGreaterThanOrEqual(1);
    alertNotifs.forEach((n) => {
      expect(n.message).toContain('2 items');
      const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
      expect(meta.item_count).toBe(2);
      expect(meta.total_value).toBeGreaterThan(0);
    });
  });
});
