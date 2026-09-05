const db = require('../db');

beforeAll(async () => {
  // Ensure we are connected to test DB and run migrations
  if(process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must be run in test environment');
  }
});

afterAll(async () => {
  await db.destroy();
});