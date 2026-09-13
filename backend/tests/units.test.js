const {
  normalizeUnit,
  getUnitDimension,
  getCompatibleUnits,
  areUnitsCompatible,
  getConversionMultiplier,
  calculateNormalizedQty,
  CANONICAL_UNITS,
} = require("../utils/units");

describe("Unit Dimension & Compatibility Engine", () => {
  describe("Unit Normalization", () => {
    it("normalizes common weight variations to canonical 'kg' and 'g'", () => {
      expect(normalizeUnit("kgs")).toBe("kg");
      expect(normalizeUnit("kilo")).toBe("kg");
      expect(normalizeUnit("kilograms")).toBe("kg");
      expect(normalizeUnit("gm")).toBe("g");
      expect(normalizeUnit("gms")).toBe("g");
      expect(normalizeUnit("grams")).toBe("g");
    });

    it("normalizes common volume variations to canonical 'L' and 'ml'", () => {
      expect(normalizeUnit("l")).toBe("L");
      expect(normalizeUnit("ltr")).toBe("L");
      expect(normalizeUnit("liters")).toBe("L");
      expect(normalizeUnit("litres")).toBe("L");
      expect(normalizeUnit("mls")).toBe("ml");
      expect(normalizeUnit("milliliters")).toBe("ml");
    });

    it("normalizes counts and packaging", () => {
      expect(normalizeUnit("pc")).toBe("pcs");
      expect(normalizeUnit("pieces")).toBe("pcs");
      expect(normalizeUnit("nos")).toBe("pcs");
      expect(normalizeUnit("doz")).toBe("dozen");
      expect(normalizeUnit("boxes")).toBe("box");
      expect(normalizeUnit("pkts")).toBe("pkt");
    });
  });

  describe("Unit Dimensions", () => {
    it("categorizes physical dimensions accurately", () => {
      expect(getUnitDimension("kg")).toBe("weight");
      expect(getUnitDimension("g")).toBe("weight");
      expect(getUnitDimension("L")).toBe("volume");
      expect(getUnitDimension("ml")).toBe("volume");
      expect(getUnitDimension("pcs")).toBe("count");
      expect(getUnitDimension("dozen")).toBe("count");
      expect(getUnitDimension("box")).toBe("packaging");
      expect(getUnitDimension("pkt")).toBe("packaging");
      expect(getUnitDimension("bottle")).toBe("packaging");
    });
  });

  describe("Compatibility Rules (areUnitsCompatible)", () => {
    it("strictly forbids weight vs volume cross-dimensions", () => {
      expect(areUnitsCompatible("L", "kg", "Atta")).toBe(false);
      expect(areUnitsCompatible("ml", "kg", "Atta")).toBe(false);
      expect(areUnitsCompatible("kg", "L", "Milk")).toBe(false);
      expect(areUnitsCompatible("g", "L", "Oil")).toBe(false);
    });

    it("allows intra-dimensional conversions", () => {
      expect(areUnitsCompatible("g", "kg", "Atta")).toBe(true);
      expect(areUnitsCompatible("kg", "g", "Sugar")).toBe(true);
      expect(areUnitsCompatible("ml", "L", "Milk")).toBe(true);
      expect(areUnitsCompatible("L", "ml", "Diesel")).toBe(true);
      expect(areUnitsCompatible("pcs", "dozen", "Eggs")).toBe(true);
    });

    it("allows packaging conversions where appropriate", () => {
      expect(areUnitsCompatible("pkt", "kg", "Salt")).toBe(true);
      expect(areUnitsCompatible("bottle", "L", "Mineral Water")).toBe(true);
      expect(areUnitsCompatible("tin", "L", "Refined Oil")).toBe(true);
    });
  });

  describe("Conversion Multipliers & Quantities", () => {
    it("calculates accurate weight and volume multipliers", () => {
      expect(getConversionMultiplier("g", "kg")).toBe(0.001);
      expect(getConversionMultiplier("kg", "g")).toBe(1000);
      expect(getConversionMultiplier("ml", "L")).toBe(0.001);
      expect(getConversionMultiplier("L", "ml")).toBe(1000);
      expect(getConversionMultiplier("dozen", "pcs")).toBe(12);
      expect(getConversionMultiplier("pcs", "dozen")).toBeCloseTo(1 / 12, 4);
    });

    it("evaluates monetary valuation correctly with sub-units", () => {
      // 500g Cashews at ₹800 per kg = ₹400
      const mult = getConversionMultiplier("g", "kg", "Cashews");
      const normQty = 500 * mult;
      expect(normQty).toBe(0.5);
      expect(normQty * 800).toBe(400);
    });

    it("returns null for incompatible conversions", () => {
      expect(getConversionMultiplier("L", "kg", "Atta")).toBeNull();
      expect(getConversionMultiplier("kg", "L", "Milk")).toBeNull();
    });
  });

  describe("Compatible Unit Lists", () => {
    it("returns dimensionally constrained unit options", () => {
      const kgOptions = getCompatibleUnits("kg");
      expect(kgOptions).toContain("kg");
      expect(kgOptions).toContain("g");
      expect(kgOptions).not.toContain("L");
      expect(kgOptions).not.toContain("ml");

      const lOptions = getCompatibleUnits("L");
      expect(lOptions).toContain("L");
      expect(lOptions).toContain("ml");
      expect(lOptions).not.toContain("kg");
      expect(lOptions).not.toContain("g");
    });
  });
});
