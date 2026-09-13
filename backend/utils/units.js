// ── Unit normalization + conversion (CommonJS build) ──────────────────────────
// Single source of truth for units across scan, indent, issuance and stock.
// Mirrors backend/utils/units.ts for native CommonJS environments and scripts.

const UNIT_ALIASES = {
  // weight — kilograms
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg", kgm: "kg",
  // weight — grams
  g: "g", gm: "g", gms: "g", grm: "g", grms: "g", gram: "g", grams: "g", gramme: "g", grammes: "g",
  // volume — litres
  l: "L", ltr: "L", ltrs: "L", lts: "L", lt: "L", litre: "L", litres: "L", liter: "L", liters: "L",
  // volume — millilitres
  ml: "ml", mls: "ml", milliliter: "ml", millilitre: "ml", milliliters: "ml", millilitres: "ml",
  // count — pieces
  pc: "pcs", pcs: "pcs", piece: "pcs", pieces: "pcs", no: "pcs", "no's": "pcs", nos: "pcs",
  "nos.": "pcs", "no.": "pcs", number: "pcs", numbers: "pcs", unit: "pcs", units: "pcs",
  ea: "pcs", each: "pcs", dish: "pcs", block: "pcs", nug: "pcs",
  // count — dozen
  dozen: "dozen", dozens: "dozen", dz: "dozen", doz: "dozen",
  // packaging (atomic — no cross-unit conversion, treated whole)
  box: "box", boxes: "box", case: "box", cases: "box", carton: "box", ctn: "box",
  bottle: "bottle", bottles: "bottle", btl: "bottle",
  pkt: "pkt", pkts: "pkt", packet: "pkt", packets: "pkt", pack: "pkt", packs: "pkt",
  tin: "tin", tins: "tin", can: "tin", cans: "tin",
  jar: "jar", jars: "jar",
  bulk: "bulk",
};

const normalizeUnit = (raw) => {
  const u = (raw || "").toString().trim().toLowerCase().replace(/[.\s]+$/, "");
  if (!u) return "pcs";
  return UNIT_ALIASES[u] || u;
};

const getConversionMultiplier = (fromUnit, toUnit, itemName = "") => {
  const f = normalizeUnit(fromUnit).toLowerCase();
  const t = normalizeUnit(toUnit).toLowerCase();
  if (f === t) return 1;

  // Weight
  if (f === "g" && t === "kg") return 0.001;
  if (f === "kg" && t === "g") return 1000;

  // Volume
  if (f === "ml" && t === "l") return 0.001;
  if (f === "l" && t === "ml") return 1000;

  // Count & Packaging 1:1 Equivalencies in Hotel Inventory
  if ((f === "bottle" && t === "pcs") || (f === "pcs" && t === "bottle")) return 1;
  if ((f === "tin" && t === "pcs") || (f === "pcs" && t === "tin")) return 1;
  if ((f === "jar" && t === "pcs") || (f === "pcs" && t === "jar")) return 1;
  if ((f === "bulk" && t === "pcs") || (f === "pcs" && t === "bulk")) return 1;
  if ((f === "bulk" && t === "pkt") || (f === "pkt" && t === "bulk")) return 1;
  if ((f === "pkt" && t === "pcs") || (f === "pcs" && t === "pkt")) return 1;

  // Count conversions
  if (f === "dozen" && t === "pcs") return 12;
  if (f === "pcs" && t === "dozen") return 1 / 12;
  if (f === "box" && t === "pcs") return 24; // standard assumption
  if (f === "pcs" && t === "box") return 1 / 24;

  // Pack size extraction from item name (e.g. "Butter 500 Gm", "Cheese 500g")
  if (itemName) {
    const pkgMatch = itemName.match(/(\d+(?:\.\d+)?)\s*(gm|g|kg|ml|l|ltr|litre|liter|grams|kilograms|liters|litres)\b/i);
    if (pkgMatch) {
      const pkgVal = parseFloat(pkgMatch[1]);
      const pkgNormalizedUnit = normalizeUnit(pkgMatch[2]).toLowerCase();

      // Convert pcs/pkt/box/bulk to weight/volume
      if (["pcs", "pkt", "box", "bulk"].includes(f) && ["kg", "g", "l", "ml"].includes(t)) {
        let pcsToPkg = pkgVal;
        if (f === "box") pcsToPkg = pkgVal * 24;
        const pkgToT = getConversionMultiplier(pkgNormalizedUnit, t);
        if (pkgToT !== null) {
          return pcsToPkg * pkgToT;
        }
      }

      // Convert weight/volume to pcs/pkt/box/bulk
      if (["kg", "g", "l", "ml"].includes(f) && ["pcs", "pkt", "box", "bulk"].includes(t)) {
        const fToPkg = getConversionMultiplier(f, pkgNormalizedUnit);
        if (fToPkg !== null) {
          let pkgToT = 1 / pkgVal;
          if (t === "box") pkgToT = (1 / pkgVal) / 24;
          return fToPkg * pkgToT;
        }
      }
    }
  }

  return null; // incompatible dimensions
};

const convertQty = (qty, fromUnit, toUnit, itemName = "") => {
  const q = typeof qty === "number" ? qty : parseFloat(qty) || 0;
  const to = normalizeUnit(toUnit);
  const mult = getConversionMultiplier(fromUnit, toUnit, itemName);
  if (mult === null) {
    return { qty: q, unit: to, converted: false };
  }
  return { qty: Math.round(q * mult * 1000) / 1000, unit: to, converted: true };
};

const CANONICAL_UNITS = [
  "kg", "g", "L", "ml", "pcs", "dozen", "box",
  "bottle", "pkt", "tin", "jar", "bulk",
  "plates", "portions",
];

const getUnitDimension = (unit) => {
  const u = normalizeUnit(unit);
  if (["kg", "g"].includes(u)) return "weight";
  if (["L", "ml"].includes(u)) return "volume";
  if (["pcs", "dozen"].includes(u)) return "count";
  if (["box", "pkt", "bottle", "tin", "jar", "bulk"].includes(u)) return "packaging";
  return "other";
};

const getCompatibleUnits = (baseUnit) => {
  if (!baseUnit) {
    return ["kg", "g", "L", "ml", "pcs", "dozen", "box", "pkt", "bottle", "tin", "jar", "bulk"];
  }
  const dim = getUnitDimension(baseUnit);
  if (dim === "weight") {
    return ["kg", "g", "pkt", "box", "bulk"];
  }
  if (dim === "volume") {
    return ["L", "ml", "bottle", "tin", "jar", "box", "bulk"];
  }
  if (dim === "count") {
    return ["pcs", "dozen", "box", "pkt", "bulk"];
  }
  if (dim === "packaging") {
    return ["pcs", "pkt", "box", "bottle", "tin", "jar", "bulk"];
  }
  return ["kg", "g", "L", "ml", "pcs", "dozen", "box", "pkt", "bottle", "tin", "jar", "bulk"];
};

const areUnitsCompatible = (fromUnit, toUnit, itemName = "") => {
  if (!fromUnit || !toUnit) return true;
  const f = normalizeUnit(fromUnit);
  const t = normalizeUnit(toUnit);
  if (f === t) return true;

  const dimF = getUnitDimension(f);
  const dimT = getUnitDimension(t);

  // Weight vs Volume is fundamentally incompatible
  if ((dimF === "weight" && dimT === "volume") || (dimF === "volume" && dimT === "weight")) {
    return false;
  }

  // Pure count (pcs, dozen) cannot convert to weight or volume without explicit pack size in itemName
  if ((dimF === "count" && (dimT === "weight" || dimT === "volume")) ||
      (dimT === "count" && (dimF === "weight" || dimF === "volume"))) {
    const mult = getConversionMultiplier(fromUnit, toUnit, itemName);
    return mult !== null;
  }

  // If conversion multiplier resolves, they are compatible
  const mult = getConversionMultiplier(fromUnit, toUnit, itemName);
  if (mult !== null) return true;

  const allowedForT = getCompatibleUnits(t).map(u => u.toLowerCase());
  const allowedForF = getCompatibleUnits(f).map(u => u.toLowerCase());
  return allowedForT.includes(f.toLowerCase()) || allowedForF.includes(t.toLowerCase());
};

module.exports = {
  UNIT_ALIASES,
  normalizeUnit,
  getConversionMultiplier,
  convertQty,
  CANONICAL_UNITS,
  getUnitDimension,
  getCompatibleUnits,
  areUnitsCompatible,
};

