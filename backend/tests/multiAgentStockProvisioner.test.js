const db = require('../db');
const MultiAgentStockProvisioner = require('../services/multiAgentStockProvisioner');

describe('Multi-Agent Stock Provisioning Suite', () => {
  let createdStockId = null;
  let testItemCode = null;

  afterAll(async () => {
    try {
      if (createdStockId) {
        await db('stock').where('id', createdStockId).del();
        await db('stock_ledger').where('stock_id', createdStockId).del();
      }
      if (testItemCode) {
        await db('reorder_points').where('item_code', testItemCode).del();
      }
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  describe('1. Agent CatalogScout & SpatialArchitect Consultation', () => {
    it('should match an existing SKU like Milk and assign walk-in dairy chiller', async () => {
      const result = await MultiAgentStockProvisioner.consultItem({
        name: 'Milk',
        unit: 'L',
        price: 55,
        qty: 10
      });

      expect(result.success).toBe(true);
      expect(result.catalog.status).toBe('EXISTING_SKU_FOUND');
      expect(result.catalog.matched_item).toBeDefined();
      expect(result.catalog.proposed_sku).toMatch(/^KPL-\d+$/);
      expect(result.spatial.recommended_zone).toContain('Dairy Chiller');
      expect(result.spatial.storage_temperature).toContain('2°C');
      expect(result.threads.thread_1_scout.status).toBe('COMPLETED');
    });

    it('should propose the next sequential KPL SKU and classify dry grains for a new flour/atta item', async () => {
      const result = await MultiAgentStockProvisioner.consultItem({
        name: 'Organic Sharbati Whole Wheat Atta',
        unit: 'kg',
        price: 52,
        qty: 50
      });

      expect(result.success).toBe(true);
      expect(result.catalog.proposed_sku).toMatch(/^KPL-\d{4}$/);
      expect(result.spatial.recommended_zone).toContain('Heavy Grains');
      expect(result.threads.thread_3_spatial.status).toBe('COMPLETED');
      expect(result.veritas.unit_compatible).toBe(true);
    });
  });

  describe('2. Agent PricingStrategist & Veritas Compliance', () => {
    it('should detect when unit price exceeds market average by >15% and issue warning alert', async () => {
      const result = await MultiAgentStockProvisioner.consultItem({
        name: 'Milk',
        unit: 'L',
        price: 250, // Significantly higher than normal milk price
        qty: 5
      });

      expect(result.success).toBe(true);
      expect(result.pricing.assessment).toBe('HIGH_ALERT');
      expect(result.pricing.variance_pct).toBeGreaterThan(15);
      expect(result.veritas.alerts.some(a => a.field === 'price')).toBe(true);
    });

    it('should detect dimensional incompatibility if unit does not match master dimension', async () => {
      const result = await MultiAgentStockProvisioner.consultItem({
        name: 'Milk',
        unit: 'kg', // Milk master is in L (Volume vs Weight)
        price: 55,
        qty: 10
      });

      expect(result.success).toBe(true);
      expect(result.veritas.unit_compatible).toBe(false);
      expect(result.veritas.alerts.some(a => a.field === 'unit')).toBe(true);
    });
  });

  describe('3. Atomic Stock Provisioning with Double-Entry Ledger Guarantee', () => {
    it('should provision stock, insert into stock table, and create immutable stock_ledger entry', async () => {
      const provisionPayload = {
        name: 'Swarm Basmati Gold Selection',
        qty: 25,
        unit: 'kg',
        price: 90,
        category: 'Rice',
        date: '2026-10-03',
        rack_number: 'B-02',
        shelf_number: '3',
        bin_number: '1',
        invoice_no: 'INV-TEST-SWARM-001',
        notes: 'Multi-Agent Automated Provision Test'
      };

      const result = await MultiAgentStockProvisioner.provisionItem(
        { name: 'Store Auditor' },
        provisionPayload
      );

      expect(result.success).toBe(true);
      expect(result.stock).toBeDefined();
      expect(result.stock.id).toBeDefined();
      expect(result.stock.remaining).toBe(25);
      expect(result.stock.rack_location).toContain('Rack B-02 / Shelf 3 / Bin 1');

      createdStockId = result.stock.id;
      testItemCode = result.stock.item_code;

      // Verify immutable double-entry ledger entry was created
      const ledgerEntries = await db('stock_ledger')
        .where('stock_id', createdStockId)
        .where('transaction_type', 'INWARD_PURCHASE');

      expect(ledgerEntries.length).toBe(1);
      expect(parseFloat(ledgerEntries[0].qty)).toBe(25);
      expect(parseFloat(ledgerEntries[0].unit_price)).toBe(90);
      expect(parseFloat(ledgerEntries[0].total_value)).toBe(2250);
      expect(ledgerEntries[0].department).toBe('CENTRAL STORE');

      // Verify reorder_points row sync
      const rop = await db('reorder_points').where('item_code', testItemCode).first();
      expect(rop).toBeDefined();
      expect(rop.name).toBe('Swarm Basmati Gold Selection');
      expect(rop.is_active).toBe(true);
    });
  });
});
