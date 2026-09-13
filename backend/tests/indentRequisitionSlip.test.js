const db = require('../db');
const { isDisposableItem, generateIndentRequisitionWorkbook } = require('../services/indentSlipExportService');

describe('Indent Requisition Slip & Consolidated Disposables Service', () => {
  afterAll(async () => {
    await db.destroy();
  });

  describe('Harmonizer & Classifier Agent', () => {
    it('correctly classifies packaging and disposable items vs kitchen food ingredients', () => {
      // Disposables
      expect(isDisposableItem({ name: 'Box Container 500 Ml', category: 'Disposal' })).toBe(true);
      expect(isDisposableItem({ name: 'Silver Foil Roll 1kg', category: 'Disposables' })).toBe(true);
      expect(isDisposableItem({ name: 'Butter Paper Sheet', category: 'General' })).toBe(true);
      expect(isDisposableItem({ name: 'Carry Bags 10x14', category: 'Packaging' })).toBe(true);
      expect(isDisposableItem({ name: 'Cling Wrap Film 300m', category: 'Central Store' })).toBe(true);
      expect(isDisposableItem({ name: 'Buffet Paper Plates 12 inch', category: 'Stores' })).toBe(true);
      expect(isDisposableItem({ name: 'Plastic Spoons Pack', category: 'Disposables' })).toBe(true);

      // Kitchen food ingredients
      expect(isDisposableItem({ name: 'Rice Raw Sona Masoori', category: 'Groceries' })).toBe(false);
      expect(isDisposableItem({ name: 'Fresh Paneer Malai', category: 'Dairy' })).toBe(false);
      expect(isDisposableItem({ name: 'Toor Dal Premium', category: 'Pulses' })).toBe(false);
      expect(isDisposableItem({ name: 'Sunflower Cooking Oil 15L', category: 'Oils' })).toBe(false);
      expect(isDisposableItem({ name: 'Tomatoes Country', category: 'Vegetables' })).toBe(false);
    });
  });

  describe('Requisition Slip & Export Compiler Agent', () => {
    it('generates a branded Hotel Kapila single indent Excel workbook buffer with Section A and Section B', async () => {
      const mockIndent = {
        id: 9901,
        dept: 'TIFFINS',
        date: '2026-09-13',
        shift: 'MORNING',
        priority: 'URGENT',
        submitted_by: 'Head Chef Ravi',
        remarks: '⚡ Early 6 AM breakfast rush prep. Deliver packaging containers directly to packing counter.',
        items: [
          // Section A: Raw Materials
          {
            item_code: 'RAW-RCE-01',
            name: 'Idli Rice Special',
            category: 'Grains',
            unit: 'kg',
            qty: 25,
            price: 42.50,
            notes: 'Soaking for morning batter',
          },
          {
            item_code: 'RAW-DAL-02',
            name: 'Urad Dal Gota',
            category: 'Pulses',
            unit: 'kg',
            qty: 8,
            price: 135.00,
            notes: 'High ferment grade',
          },
          // Section B: Disposables & Packaging
          {
            item_code: 'PKG-BOX-500',
            name: 'Box Container 500 Ml',
            category: 'Disposal',
            unit: 'pcs',
            qty: 150,
            price: 4.20,
            notes: 'For parcel sambar and chutney',
          },
          {
            item_code: 'PKG-CARRY-BG',
            name: 'Carry Bags 12x18 Heavy',
            category: 'Packaging',
            unit: 'pcs',
            qty: 100,
            price: 2.10,
            notes: 'Counter delivery',
          },
        ],
      };

      const workbook = await generateIndentRequisitionWorkbook(mockIndent);
      expect(workbook).toBeDefined();

      const buffer = await workbook.xlsx.writeBuffer();
      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000); // Valid non-empty Excel zip archive

      const sheet = workbook.worksheets[0];
      expect(sheet).toBeDefined();

      // Check header title and department
      const headerVal = sheet.getCell('A1').value;
      expect(headerVal).toContain('HOTEL KAPILA');

      // Check that department is rendered
      let foundDept = false;
      let foundPrepNotes = false;
      let foundSectionA = false;
      let foundSectionB = false;
      let foundSignOff = false;

      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const val = String(cell.value || '').toLowerCase();
          if (val.includes('tiffins')) foundDept = true;
          if (val.includes('early 6 am breakfast rush prep')) foundPrepNotes = true;
          if (val.includes('section a') && val.includes('ingredients')) foundSectionA = true;
          if (val.includes('section b') && val.includes('packaging')) foundSectionB = true;
          if (val.includes('executive chef') || val.includes('head cook')) foundSignOff = true;
        });
      });

      expect(foundDept).toBe(true);
      expect(foundPrepNotes).toBe(true);
      expect(foundSectionA).toBe(true);
      expect(foundSectionB).toBe(true);
      expect(foundSignOff).toBe(true);
    });
  });

  describe('Central Stores Disposables Stock Ingestion', () => {
    it('queries stock table for disposables items with active rates and stock quantities', async () => {
      const items = await db('stock')
        .where((builder) => {
          builder
            .whereIn(db.raw('LOWER(category)'), ['disposal', 'disposables', 'packaging', 'packing', 'paper', 'plastic'])
            .orWhere(db.raw('LOWER(name)'), 'like', '%container%')
            .orWhere(db.raw('LOWER(name)'), 'like', '%box%')
            .orWhere(db.raw('LOWER(name)'), 'like', '%foil%')
            .orWhere(db.raw('LOWER(name)'), 'like', '%wrap%')
            .orWhere(db.raw('LOWER(name)'), 'like', '%carry bag%')
            .orWhere(db.raw('LOWER(name)'), 'like', '%plate%');
        })
        .select('id', 'name', 'item_code', 'category', 'unit', 'price', 'remaining')
        .limit(20);

      expect(items.length).toBeGreaterThan(0);
      const sample = items[0];
      expect(sample).toHaveProperty('name');
      expect(sample).toHaveProperty('unit');
    });
  });
});
