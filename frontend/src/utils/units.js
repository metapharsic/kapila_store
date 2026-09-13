export const normalizeUnit = (unit) => {
  if (!unit) return "";
  let u = unit.toString().toLowerCase().trim();
  if (["kgs", "kilo", "kilogram", "kilograms"].includes(u)) return "kg";
  if (["gm", "gms", "gram", "grams"].includes(u)) return "g";
  if (["l", "ltr", "ltrs", "liter", "liters", "litre", "litres"].includes(u)) return "L";
  if (["mls", "milliliter", "milliliters"].includes(u)) return "ml";
  if (["pc", "piece", "pieces", "nos", "no", "number", "unit", "units"].includes(u)) return "pcs";
  if (["pkt", "pkts", "packet", "packets", "pack", "packs"].includes(u)) return "pkt";
  if (["btl", "btls", "bottle", "bottles"].includes(u)) return "bottle";
  if (["dz", "dozens", "dozen"].includes(u)) return "dozen";
  if (["boxes", "box"].includes(u)) return "box";
  if (["tin", "tins", "can", "cans"].includes(u)) return "tin";
  if (["jar", "jars"].includes(u)) return "jar";
  if (["bulk"].includes(u)) return "bulk";
  return u;
};

export const getUnitDimension = (unit) => {
  const u = normalizeUnit(unit);
  if (["kg", "g"].includes(u)) return "weight";
  if (["L", "ml"].includes(u)) return "volume";
  if (["pcs", "dozen"].includes(u)) return "count";
  if (["box", "pkt", "bottle", "tin", "jar", "bulk"].includes(u)) return "packaging";
  return "other";
};

export const getDimensionConfig = (dimensionOrUnit) => {
  const dim = ["weight", "volume", "count", "packaging", "other"].includes(dimensionOrUnit)
    ? dimensionOrUnit
    : getUnitDimension(dimensionOrUnit);

  switch (dim) {
    case "weight":
      return {
        dimension: "weight",
        label: "Weight",
        shortLabel: "WT",
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.12)",
        border: "rgba(56, 189, 248, 0.3)",
        description: "Mass (kg, g)"
      };
    case "volume":
      return {
        dimension: "volume",
        label: "Volume",
        shortLabel: "VOL",
        color: "#2dd4bf",
        bg: "rgba(45, 212, 191, 0.12)",
        border: "rgba(45, 212, 191, 0.3)",
        description: "Liquid (L, ml)"
      };
    case "count":
      return {
        dimension: "count",
        label: "Count",
        shortLabel: "CNT",
        color: "#fbbf24",
        bg: "rgba(251, 191, 36, 0.12)",
        border: "rgba(251, 191, 36, 0.3)",
        description: "Units (pcs, dozen)"
      };
    case "packaging":
      return {
        dimension: "packaging",
        label: "Packaging",
        shortLabel: "PKG",
        color: "#a78bfa",
        bg: "rgba(167, 139, 250, 0.12)",
        border: "rgba(167, 139, 250, 0.3)",
        description: "Container (box, pkt, bottle, tin, jar)"
      };
    default:
      return {
        dimension: "other",
        label: "General",
        shortLabel: "GEN",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.12)",
        border: "rgba(148, 163, 184, 0.3)",
        description: "Unspecified"
      };
  }
};

export const getCompatibleUnits = (baseUnit) => {
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

export const areUnitsCompatible = (fromUnit, toUnit, itemName = "") => {
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

export const getConversionMultiplier = (fromUnit, toUnit, itemName = "") => {
  const f = normalizeUnit(fromUnit);
  const t = normalizeUnit(toUnit);
  
  if (f === t) return 1;

  // Weight
  if (f === "g" && t === "kg") return 0.001;
  if (f === "kg" && t === "g") return 1000;

  // Volume
  if (f === "ml" && t === "L") return 0.001;
  if (f === "L" && t === "ml") return 1000;

  // Count
  if (f === "dozen" && t === "pcs") return 12;
  if (f === "pcs" && t === "dozen") return 1 / 12;
  
  if (f === "box" && t === "pcs") return 24; // Standard assumption
  if (f === "pcs" && t === "box") return 1 / 24;

  // Packaging 1:1 equivalencies where applicable
  if (["bottle", "tin", "jar", "bulk", "pkt"].includes(f) && t === "pcs") return 1;
  if (["bottle", "tin", "jar", "bulk", "pkt"].includes(t) && f === "pcs") return 1;

  // Pack size extraction from item name (e.g. "Butter 500 Gm")
  if (itemName) {
    const pkgMatch = itemName.match(/(\d+(?:\.\d+)?)\s*(gm|g|kg|ml|l|ltr|litre|liter|grams|kilograms|liters|litres)\b/i);
    if (pkgMatch) {
      const pkgVal = parseFloat(pkgMatch[1]);
      const pkgNormalizedUnit = normalizeUnit(pkgMatch[2]);

      // Convert pcs/pkt/box to weight/volume
      if (["pcs", "pkt", "box"].includes(f) && ["kg", "g", "L", "ml"].includes(t)) {
        let pcsToPkg = pkgVal;
        if (f === "box") pcsToPkg = pkgVal * 24;
        const pkgToT = getConversionMultiplier(pkgNormalizedUnit, t);
        if (pkgToT !== null) {
          return pcsToPkg * pkgToT;
        }
      }

      // Convert weight/volume to pcs/pkt/box
      if (["kg", "g", "L", "ml"].includes(f) && ["pcs", "pkt", "box"].includes(t)) {
        const fToPkg = getConversionMultiplier(f, pkgNormalizedUnit);
        if (fToPkg !== null) {
          let pkgToT = 1 / pkgVal;
          if (t === "box") pkgToT = (1 / pkgVal) / 24;
          return fToPkg * pkgToT;
        }
      }
    }
  }

  return null; // Unknown/Incompatible conversion
};

export const calculateNormalizedQty = (qty, fromUnit, toUnit, itemName = "") => {
  const mult = getConversionMultiplier(fromUnit, toUnit, itemName);
  if (mult === null) return null;
  return (parseFloat(qty) || 0) * mult;
};

export const CANONICAL_UNITS = [
  "kg", "g", "L", "ml", "pcs", "dozen", "box", "pkt", "bottle", "tin", "jar", "bulk"
];


