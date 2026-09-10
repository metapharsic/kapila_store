const db = require('../db');
jest.mock('../services/auditService', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));
const stockController = require('../controllers/stockController');

describe('Stock Controller API & Warehouse Positioning Suite', () => {
  afterAll(async () => {
    await db.destroy();
  });

  it('should fetch stock list with enterprise warehouse positioning fields', async () => {
    const req = {
      query: { page: 1, limit: 10 },
      pagination: { page: 1, limit: 10, offset: 0 }
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    const next = jest.fn();
    await stockController.list(req, res, next);
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.success).toBe(true);
    expect(Array.isArray(responseData.data)).toBe(true);
    if (responseData.data.length > 0) {
      const item = responseData.data[0];
      expect(item).toHaveProperty('rack_location');
      expect(item).toHaveProperty('storage_zone');
      expect(item).toHaveProperty('purchase_time');
    }
  });

  it('should fetch detailed item audit dossier via getItemDetails', async () => {
    const stockRow = await db('stock').select('id').first();
    if (!stockRow) return;

    const req = { params: { id: stockRow.id } };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    const next = jest.fn();
    await stockController.getItemDetails(req, res, next);
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('item');
    expect(body.data).toHaveProperty('batches');
  });
});