/**
 * inventoryWorker.js
 * Node.js Worker Thread Task Executor for Multi-Agent Inventory Pipeline.
 */
const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");

function normalizeUnit(raw) {
  const u = (raw || "pcs").toString().trim().toLowerCase().replace(/[.\s]+$/, "");
  const UNIT_ALIASES = {
    kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
    g: "g", gm: "g", gms: "g", gram: "g", grams: "g",
    l: "L", ltr: "L", ltrs: "L", lts: "L", lt: "L", litre: "L", litres: "L", liter: "L", "ltr.": "L",
    ml: "ml", mls: "ml",
    pc: "pcs", pcs: "pcs", piece: "pcs", pieces: "pcs", no: "pcs", "no's": "pcs", nos: "pcs", "nos.": "pcs",
    ea: "pcs", each: "pcs", dish: "pcs", block: "pcs",
    dozen: "dozen", dz: "dozen",
    box: "box", boxes: "box", case: "box", cases: "box", carton: "box",
    bottle: "bottle", bottles: "bottle", btl: "bottle",
    pkt: "pkt", pkts: "pkt", packet: "pkt", packets: "pkt", pack: "pkt", packs: "pkt",
    tin: "tin", tins: "tin", can: "tin",
    jar: "jar", jars: "jar",
  };
  return UNIT_ALIASES[u] || (u ? u : "pcs");
}

function inferCategory(itemName, existingCat) {
  if (existingCat && existingCat.trim()) return existingCat.trim();
  const name = (itemName || "").toLowerCase();
  if (/apple|grape|fruit|banana|mango|anar|kiwi|orange|avacado|melon|papaya|lemon|pineapple|strawberry|pomegranate/i.test(name)) return "Fruits";
  if (/broccoli|onion|potato|tomato|chilli|carrot|cabbage|palak|coriander|ginger|garlic|vegetable|veg|cucumber|beans|capsicum|cauliflower|peas|mint|pudina/i.test(name)) return "Vegetables";
  if (/dal|bobberlu|urad|chana|moong|toor|rajma|gram|pulse|cereal|grain/i.test(name)) return "Cereals";
  if (/rice|basmati|poha/i.test(name)) return "Rice";
  if (/syrup|crush|squash/i.test(name)) return "Syrup";
  if (/cheese|milk|butter|paneer|curd|cream|dairy|khoya/i.test(name)) return "Dairy";
  if (/cookie|biscuit|cake|bread|bun|bake|rusk|pastry|muffin|paste/i.test(name)) return "Bakery";
  if (/powder|masala|spices|spice|jeera|amchoor|pepper|clove|cardamom|elaichi|cinnamon|turmeric|chilli powder|homa/i.test(name)) return "Spices";
  if (/atta|flour|maida|sooji|rava|besan|corn flour/i.test(name)) return "Flour";
  if (/oil|ghee|vanaspati/i.test(name)) return "Oils";
  if (/sauce|ketchup|mayo|vinegar|soya|chilli sauce/i.test(name)) return "Sauces";
  if (/tea|coffee|boost|bournvita|horlicks|beverage|drink|water|juice|coke|soda/i.test(name)) return "Beverages";
  if (/spoon|fork|knife|plate|glass|bowl|cover|wrap|foil|disposal|paper|container|box|pouch|bag|napkin|tissue|wiper/i.test(name)) return "Disposal";
  if (/clean|soap|scrub|detergent|bleach|dettol|sanitizer|wash|cloth|mop|harpic|colin/i.test(name)) return "House Keeping";
  if (/badam|almond|kaju|cashew|pista|walnut|raisin|kishmish|anjeer|dates|dry fruit/i.test(name)) return "Dry Friuts";
  if (/chicken|mutton|fish|prawn|egg|meat/i.test(name)) return "Meat";
  return "General";
}

if (parentPort) {
  const { stage, payload } = workerData || {};

  try {
    if (stage === "PARSE_HTML") {
      const { htmlContent } = payload;
      // Fast parsing of HTML table rows
      const rowMatches = htmlContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      const parsedItems = [];

      for (let i = 0; i < rowMatches.length; i++) {
        const row = rowMatches[i];
        const cellMatches = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        const cells = cellMatches.map(c => c.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code)).trim());

        // Skip metadata header rows (0..3) and column title row (4)
        if (i < 4) continue;
        if (cells[0] === "Item" || cells[0] === "Name:" || cells[0] === "Kitchen Name:") continue;

        if (cells.length >= 10 && cells[0]) {
          const item = cells[0];
          const cat = cells[1];
          const subcat = cells[2];
          const hsn = cells[3];
          const sap = cells[4];
          const total = parseFloat(cells[5]) || 0;
          const stock = parseFloat(cells[6]) || 0;
          const rawUnit = cells[7] || "pcs";
          const avgPrice = parseFloat(cells[8]) || 0;
          const avgPriceNoTax = parseFloat(cells[9]) || 0;

          parsedItems.push({
            raw_index: i,
            item,
            category: cat,
            sub_category: subcat,
            hsn,
            sap,
            total_value: total,
            stock_qty: stock,
            raw_unit: rawUnit,
            avg_price: avgPrice,
            avg_price_no_tax: avgPriceNoTax
          });
        }
      }

      parentPort.postMessage({
        success: true,
        stage: "PARSE_HTML",
        thread_id: process.pid,
        items_count: parsedItems.length,
        items: parsedItems
      });

    } else if (stage === "HARMONIZE_TAXONOMY") {
      const { rawItems } = payload;
      const harmonized = [];
      let unitsNormalized = 0;
      let categoriesImputed = 0;

      rawItems.forEach((it, idx) => {
        const canonicalUnit = normalizeUnit(it.raw_unit);
        if (canonicalUnit !== it.raw_unit) unitsNormalized++;

        let finalCat = it.category;
        if (!finalCat || !finalCat.trim()) {
          finalCat = inferCategory(it.item, "");
          categoriesImputed++;
        }

        const skuCode = "KPL-" + String(idx + 1).padStart(4, "0");

        harmonized.push({
          ...it,
          sku: skuCode,
          canonical_unit: canonicalUnit,
          canonical_category: finalCat,
          is_out_of_stock: it.stock_qty <= 0,
          min_alert_qty: it.stock_qty > 0 ? Math.max(1, Math.round(it.stock_qty * 0.25 * 10) / 10) : 5,
          reorder_qty: it.stock_qty > 0 ? Math.max(2, Math.round(it.stock_qty * 0.5 * 10) / 10) : 10,
        });
      });

      parentPort.postMessage({
        success: true,
        stage: "HARMONIZE_TAXONOMY",
        thread_id: process.pid,
        items_count: harmonized.length,
        units_normalized: unitsNormalized,
        categories_imputed: categoriesImputed,
        items: harmonized
      });
    } else {
      parentPort.postMessage({ success: false, error: `Unknown worker stage: ${stage}` });
    }
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message, stack: err.stack });
  }
}
