const request = require('supertest');
const app = require('../server');

describe('Stock API', () => {
  it('should fetch stock list and return 200', async () => {
    const res = await request(app).get('/api/stock');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});