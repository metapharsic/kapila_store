const normalizeUnit = (unit) => {
  if (!unit) return "";
  let u = unit.toLowerCase().trim();
  if (["kgs", "kilo", "kilogram", "kilograms"].includes(u)) return "kg";
  if (["gm", "gms", "gram", "grams"].includes(u)) return "g";
  if (["ltr", "ltrs", "liter", "liters", "litre", "litres"].includes(u)) return "l";
  if (["mls", "milliliter", "milliliters"].includes(u)) return "ml";
  if (["pc", "piece", "pieces", "nos", "no", "number"].includes(u)) return "pcs";
  if (["pkt", "pkts", "packet", "packets"].includes(u)) return "pkt";
  if (["btl", "btls", "bottle", "bottles"].includes(u)) return "btl";
  if (["dz", "dozens"].includes(u)) return "dozen";
  if (["boxes"].includes(u)) return "box";
  if (["tin", "tins"].includes(u)) return "tin";
  return u;
};

export const getConversionMultiplier = (fromUnit, toUnit, itemName = "") => {
  const f = normalizeUnit(fromUnit);
  const t = normalizeUnit(toUnit);
  
  if (f === t) return 1;

  // Weight
  if (f === "g" && t === "kg") return 0.001;
  if (f === "kg" && t === "g") return 1000;

  // Volume
  if (f === "ml" && t === "l") return 0.001;
  if (f === "l" && t === "ml") return 1000;

  // Count
  if (f === "dozen" && t === "pcs") return 12;
  if (f === "pcs" && t === "dozen") return 1 / 12;
  
  if (f === "box" && t === "pcs") return 24; // Standard assumption
  if (f === "pcs" && t === "box") return 1 / 24;

  // Pack size extraction from item name (e.g. "Butter 500 Gm")
  if (itemName) {
    const pkgMatch = itemName.match(/(\d+(?:\.\d+)?)\s*(gm|g|kg|ml|l|ltr|litre|liter|grams|kilograms|liters|litres)\b/i);
    if (pkgMatch) {
      const pkgVal = parseFloat(pkgMatch[1]);
      const pkgNormalizedUnit = normalizeUnit(pkgMatch[2]);

      // Convert pcs/pkt/box to weight/volume
      if (["pcs", "pkt", "box"].includes(f) && ["kg", "g", "l", "ml"].includes(t)) {
        let pcsToPkg = pkgVal;
        if (f === "box") pcsToPkg = pkgVal * 24;
        const pkgToT = getConversionMultiplier(pkgNormalizedUnit, t);
        if (pkgToT !== null) {
          return pcsToPkg * pkgToT;
        }
      }

      // Convert weight/volume to pcs/pkt/box
      if (["kg", "g", "l", "ml"].includes(f) && ["pcs", "pkt", "box"].includes(t)) {
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
