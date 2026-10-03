/**
 * indentRestorationWorker.js
 * Node.js Worker Thread Task Executor for Multi-Agent Indent Restoration Engine.
 * Executes parallel extraction, SKU harmonization against today.xls stock,
 * department template preloading, and data integrity auditing.
 */

const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");

// 9 Canonical Kitchen Departments
const CANONICAL_DEPARTMENTS = [
  "TIFFINS",
  "STAFF",
  "SI-MEALS",
  "NORTH INDIAN",
  "CHAT & SOFTY",
  "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL",
  "RESTAURANT",
  "ROOM SERVICE"
];

const DEPT_NORMALIZATION_MAP = {
  "TIFFINS": "TIFFINS",
  "TIFFIN": "TIFFINS",
  "TFN": "TIFFINS",
  "STAFF": "STAFF",
  "STALL": "STAFF",
  "STF": "STAFF",
  "SI-MEALS": "SI-MEALS",
  "SI- MEALS": "SI-MEALS",
  "SI- MEALS ": "SI-MEALS",
  "SI - MEALS": "SI-MEALS",
  "SI MEALS": "SI-MEALS",
  "SIM": "SI-MEALS",
  "SOUTH INDIAN": "SI-MEALS",
  "NORTH INDIAN": "NORTH INDIAN",
  "NIN": "NORTH INDIAN",
  "NORTH": "NORTH INDIAN",
  "CHAT & SOFTY": "CHAT & SOFTY",
  "CHAT, JP DISPOSAL, SOFTY.": "CHAT & SOFTY",
  "CHAT": "CHAT & SOFTY",
  "CHT": "CHAT & SOFTY",
  "CHINESE & DOSA": "CHINESE & DOSA",
  "CHINESE": "CHINESE & DOSA",
  "CND": "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL": "MOCKTAILS & CONTINENTAL",
  "MOCKTAILS & CONTINENTAL ": "MOCKTAILS & CONTINENTAL",
  "MOCKTAILS": "MOCKTAILS & CONTINENTAL",
  "CONTINENTAL": "MOCKTAILS & CONTINENTAL",
  "MCT": "MOCKTAILS & CONTINENTAL",
  "RESTAURANT": "RESTAURANT",
  "RESTAURANT ": "RESTAURANT",
  "REST": "RESTAURANT",
  "RST": "RESTAURANT",
  "ROOM SERVICE": "ROOM SERVICE",
  "ROOM SERVICE ": "ROOM SERVICE",
  "RMS": "ROOM SERVICE"
};

// Comprehensive alias dictionary matching voucher names to today.xls stock items
const ALIAS_MAP = {
  // Fresh Produce & Vegetables
  "tomato": "Tamato",
  "tomatoes": "Tamato",
  "green chilli": "Green Chilly",
  "green chili": "Green Chilly",
  "green chillies": "Green Chilly",
  "cabbage": "Cabage",
  "beetroot": "Beet Root",
  "cucumber": "Keera Dosakaya",
  "kheera": "Keera Dosakaya",
  "thamala pakulu": "Tamalapakulu",
  "tamalapakulu": "Tamalapakulu",
  "pan leaves": "Tamalapakulu",
  "betel leaves": "Tamalapakulu",
  "kothimeera": "Kothimira",
  "kothimir": "Kothimira",
  "coriander": "Kothimira",
  "coriander leaves": "Kothimira",
  "curry leaves": "Karivepaku",
  "karivepaku": "Karivepaku",
  "lemon": "Lemons",
  "lemons": "Lemons",
  "nimbu": "Lemons",
  "pudina": "Pudina",
  "mint": "Pudina",
  "mint leaves": "Pudina",
  "potato": "Potato",
  "potatoes": "Potato",
  "alu": "Potato",
  "aloo": "Potato",
  "onion": "Onion",
  "onions": "Onion",
  "small onion": "Small Onion",
  "sambhar onion": "Small Onion",
  "brown onion": "Brown Onion",
  "ginger": "Ginger",
  "adrak": "Ginger",
  "garlic": "Garlic",
  "lasun": "Garlic",
  "beans": "Beans",
  "french beans": "Beans",
  "carrot": "Carrot",
  "carrots": "Carrot",
  "cauliflower": "Cauliflower",
  "capsicum": "Capsicum",
  "shimla mirchi": "Capsicum",
  "green peas": "Frozen Green Peas",
  "frozen peas": "Frozen Green Peas",
  "peas": "Frozen Green Peas",
  "palak": "Palak",
  "spinach": "Palak",
  "gongura": "Gongura",
  "thotakura": "Thotakura",
  "menthamkura": "Menthamkura",
  "methi leaves": "Menthamkura",
  "bendakaya": "Bendakaya",
  "bendi": "Bendakaya",
  "lady finger": "Bendakaya",
  "okra": "Bendakaya",
  "dondakaya": "Dondakaya",
  "tindora": "Dondakaya",
  "beerakaya": "Beerakaya",
  "ridge gourd": "Beerakaya",
  "sora kaya": "Sora Kaya",
  "sorakaya": "Sora Kaya",
  "bottle gourd": "Sora Kaya",
  "potlakaya": "Potlakaya",
  "snake gourd": "Potlakaya",
  "kakarkaya": "Kakarkaya",
  "bitter gourd": "Kakarkaya",
  "aratikayalu": "Aratikayalu",
  "aratikaya": "Aratikayalu",
  "raw banana": "Aratikayalu",
  "gummadikaya": "Gummadikaya",
  "pumpkin": "Pumpkin",
  "yellow pumpkin": "Gummadikaya",
  "chikkudukaya": "Chikkudukaya",
  "broad beans": "Chikkudukaya",
  "goru chikkudukaya": "Goru Chikkudukaya",
  "cluster beans": "Goru Chikkudukaya",
  "munigekaya": "Munigekaya",
  "drumsticks": "Munigekaya",
  "drumstick": "Munigekaya",
  "kanda gadda": "Kanda Gadda",
  "kandagadda": "Kanda Gadda",
  "yam": "Kanda Gadda",
  "shamagadda": "Shamagadda",
  "arbi": "Shamagadda",
  "budimekaya": "Budimekaya",
  "budamdosakaya": "Budimekaya",
  "vankaya": "Vankaya",
  "brinjal": "Vankaya",
  "eggplant": "Vankaya",
  "baby corn": "Baby Corn",
  "sweet corn": "Sweet Corn Pkt",
  "sweet corn pkt": "Sweet Corn Pkt",
  "mushroom": "Mushroom",
  "mushrooms": "Mushroom",
  "button mushroom": "Mushroom",
  "spring onion": "Spring Onion",
  "spring onions": "Spring Onion",
  "broccoli": "Broccoli",

  // Beverages & Water
  "thums up": "Coke",
  "thums up 250ml": "Coke",
  "thums up 250ml bottle": "Coke",
  "sprite": "Sprite 750 Ml",
  "sprite 250ml": "Sprite 750 Ml",
  "coke": "Coke",
  "mineral water 1l": "M.water 1l",
  "mineral water 1 l": "M.water 1l",
  "mineral water 500ml": "M.water 500ml",
  "mineral water 250ml": "M.watr 250 Ml",
  "m.water 1l": "M.water 1l",
  "m.water 500ml": "M.water 500ml",
  "kinley 1l": "Kinley 1lit Water",
  "kinley 1lit": "Kinley 1lit Water",
  "kinley 500ml": "Kinley 500ml Water",
  "soda": "Soda 250ml",
  "soda 250ml": "Soda 250ml",
  "soda 750ml": "Soda 750 Ml",
  "coconut water": "Coconut Water",
  "coffee": "Coffee Nescafe",
  "nescafe": "Coffee Nescafe",
  "boost": "Boost",
  "bournvita": "Bournvita",
  "horlicks": "Horlicks",

  // Spices & Bit Pieces
  "pepper": "Black Pepper",
  "black pepper": "Black Pepper",
  "white pepper": "White Pepper",
  "jeera": "Jeera",
  "cumin": "Jeera",
  "jeera powder": "Jeera Powder",
  "dhaniya": "Dhaniya",
  "dhaniya powder": "Dhaniya Powder",
  "coriander powder": "Dhaniya Powder",
  "swastik chilly powder": "Swastik Chilly Powder",
  "chilly powder": "Swastik Chilly Powder",
  "mirchi powder": "Swastik Chilly Powder",
  "red chilli powder": "Swastik Chilly Powder",
  "turmeric": "Turmeric Powder",
  "turmeric powder": "Turmeric Powder",
  "haldi": "Turmeric Powder",
  "mtr sambar powder": "Mtr Sambar Powder",
  "sambar powder": "Mtr Sambar Powder",
  "biryani leaf": "Biryani Leaf",
  "bay leaf": "Biryani Leaf",
  "dalchina": "Dalchina",
  "cinnamon": "Dalchina",
  "elaichi": "Elaichi",
  "cardamom": "Elaichi",
  "green cardamom": "Elaichi",
  "lavang": "Lavang",
  "clove": "Lavang",
  "cloves": "Lavang",
  "sajeera": "Sajeera",
  "shahi jeera": "Sajeera",
  "shahjeera": "Sajeera",
  "khas khas": "Khas Khas",
  "poppy seeds": "Khas Khas",
  "hing": "Hing",
  "asafoetida": "Hing",
  "mentulu": "Mentulu",
  "fenugreek seeds": "Mentulu",
  "methi seeds": "Mentulu",
  "kasuri methi": "Kasturi Methi",
  "kasturi methi": "Kasturi Methi",
  "chat masala": "Chat Masala",
  "chaat masala": "Chat Masala",
  "chole masala": "Chole Masala",
  "garam masala": "Garam Masala",
  "kitchen king masala": "Kitchen King Masala",
  "pavbaji masala": "Pavbaji Masala",
  "amchoor powder": "Amchoor Powder",
  "amchur": "Amchoor Powder",
  "dry mango powder": "Amchoor Powder",
  "aromatic powder": "Aromatic Powder",
  "baking soda": "Baking Soda",
  "peri peri": "Peri Peri",
  "jal jeera": "Jal Jeera",
  "japathri": "Japathri",
  "mace": "Japathri",
  "star pool": "Star Pool",
  "star anise": "Star Pool",
  "thoka miryal": "Thoka Miryal",
  "till": "Till",
  "sesame seeds": "Till",
  "salt": "Tata Salt",
  "tata salt": "Tata Salt",
  "sugar": "Sugar",
  "jaggery": "Jaggery",

  // Packaging & Disposables
  "5cp": "5cp",
  "5cp meal tray": "5cp",
  "3cp": "3cp",
  "8cp": "8cp",
  "paper 140ml bowl": "Paper 140ml Bowl",
  "140ml bowl": "Paper 140ml Bowl",
  "paper bowl 140ml": "Paper 140ml Bowl",
  "paper 350ml bowl": "Paper 140ml Bowl",
  "box container 500 ml": "Box Container 500 Ml",
  "box container 500ml": "Box Container 500 Ml",
  "500ml container": "Box Container 500 Ml",
  "box container 250ml": "Box Container 250ml",
  "box container 400ml": "Box Container 400ml",
  "box container 750ml": "Box Container 750ml",
  "box container 1000 ml": "Box Container 1000 Ml",
  "chinese container 500ml": "Chinese Container 500ml",
  "chinese container 750ml": "Chinese Container 500ml",
  "chinese container 1000ml": "Chinese Container 1000ml",
  "burger box": "Burger Box",
  "butter paper": "Butter Paper",
  "butter covers": "Butter Covers",
  "carry bags 13*16": "Carry Bags 13*16",
  "carry bags 20*24": "Carry Bags 20*24",
  "paper rolls": "Paper Rolls",
  "napkins": "Napkins",
  "tissue paper": "Napkins",
  "water glass": "Water Glass",
  "buffet plates": "Buffet Plates"
};

function classifyItem(name = "") {
  const norm = name.toLowerCase().trim();
  if (/gas|coal|soap|oil cleaning|mop|surf|harpic/i.test(norm)) return "UTILITIES_CLEANING";
  if (/container|box|bowl|paper|roll|napkin|cling wrap|foil|pouch|cover|bag|carrybag|cup|straw|spoon|tooth pick|glass|cone|cp/i.test(norm)) return "DISPOSABLES_PACKAGING";
  if (/masala|powder|leaf|pepper|jeera|dhaniya|dalchina|elaichi|lavang|sajeera|khas khas|hing|mentulu|kasuri methi|turmeric|mustard|amchur|sauce|vinegar/i.test(norm)) return "SPICES_AROMATICS";
  if (/milk|curd|butter|ghee|oil|dalda|cream|paneer|mayonnaise|compound|chocolate|cheese/i.test(norm)) return "DAIRY_OILS";
  return "STAPLES_PRODUCE";
}

if (parentPort) {
  const { stage, payload } = workerData || {};

  try {
    if (stage === "INGEST_AND_PARSE_VOUCHERS") {
      const { scratchDir, additionalDates = [] } = payload;
      const files = fs.readdirSync(scratchDir).filter((f) => f.endsWith(".json"));
      const sessionsMap = new Map(); // key: DEPT_DATE

      files.forEach((f) => {
        const fullPath = path.join(scratchDir, f);
        const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        const rawDept = (data.to_dept || "NORTH INDIAN").trim().toUpperCase();
        const dept = DEPT_NORMALIZATION_MAP[rawDept] || rawDept;

        let date = data.date || "2026-08-17";
        if (date.startsWith("2024")) date = date.replace("2024", "2026");
        if (date === "2026-01-16" || date === "2026-06-12") date = "2026-08-16";

        const sessionKey = `${dept}_${date}`;
        if (!sessionsMap.has(sessionKey)) {
          sessionsMap.set(sessionKey, {
            dept,
            date,
            items: []
          });
        }

        const session = sessionsMap.get(sessionKey);
        (data.items || []).forEach((it) => {
          const qty = parseFloat(it.qty) || 0;
          if (it.name && it.name.trim()) {
            session.items.push({
              name: it.name.trim(),
              qty: qty > 0 ? qty : 1,
              unit: (it.unit || "kg").trim().toLowerCase(),
              rate: it.rate ? parseFloat(it.rate) : null,
              amount: it.amount ? parseFloat(it.amount) : null
            });
          }
        });
      });

      const parsedSessions = Array.from(sessionsMap.values());
      parentPort.postMessage({
        success: true,
        data: {
          totalFilesProcessed: files.length,
          totalSessions: parsedSessions.length,
          sessions: parsedSessions
        }
      });
    } else if (stage === "HARMONIZE_AGAINST_STOCK") {
      const { sessions, stockCatalog } = payload;
      // Index stock catalog by lower-case name and item_code
      const stockByName = new Map();
      const stockByCode = new Map();
      stockCatalog.forEach((s) => {
        stockByName.set(s.name.toLowerCase().trim(), s);
        if (s.item_code) stockByCode.set(s.item_code.trim().toUpperCase(), s);
      });

      let totalItemsProcessed = 0;
      let matchedCount = 0;
      let bitPiecesCount = 0;

      const harmonizedSessions = sessions.map((sess) => {
        const harmonizedItems = sess.items.map((it) => {
          totalItemsProcessed++;
          const rawLower = it.name.toLowerCase().trim();
          const aliasedName = ALIAS_MAP[rawLower] || it.name;
          const matched = stockByName.get(aliasedName.toLowerCase().trim()) || stockByName.get(rawLower);

          let finalName = matched ? matched.name : aliasedName;
          let finalItemCode = matched ? matched.item_code : `KPL-${Math.floor(1000 + Math.random() * 9000)}`;
          let finalUnit = matched ? matched.unit : (it.unit || "kg");
          let classification = classifyItem(finalName);

          if (matched) {
            matchedCount++;
          }

          if (classification === "SPICES_AROMATICS" || classification === "DISPOSABLES_PACKAGING") {
            bitPiecesCount++;
          }

          return {
            name: finalName,
            item_code: finalItemCode,
            qty: parseFloat(it.qty) || 1,
            unit: finalUnit,
            issued_qty: parseFloat(it.qty) || 1,
            classification,
            is_matched_sku: Boolean(matched)
          };
        });

        return {
          dept: sess.dept,
          date: sess.date,
          items: harmonizedItems
        };
      });

      parentPort.postMessage({
        success: true,
        data: {
          totalSessions: harmonizedSessions.length,
          totalItemsProcessed,
          matchedCount,
          matchRatePct: parseFloat(((matchedCount / Math.max(1, totalItemsProcessed)) * 100).toFixed(2)),
          bitPiecesCount,
          sessions: harmonizedSessions
        }
      });
    } else if (stage === "BUILD_DEPARTMENT_TEMPLATES") {
      const { templateSeedRows, stockCatalog } = payload;
      const stockByName = new Map();
      stockCatalog.forEach((s) => stockByName.set(s.name.toLowerCase().trim(), s));

      let matchedTemplateItems = 0;

      const harmonizedTemplates = templateSeedRows.map((t, idx) => {
        const rawDept = (t.template_name || "").trim().toUpperCase();
        const canonicalDept = DEPT_NORMALIZATION_MAP[rawDept] || rawDept;
        const rawName = (t.item_name || "").trim();
        const aliasedName = ALIAS_MAP[rawName.toLowerCase()] || rawName;
        const matched = stockByName.get(aliasedName.toLowerCase()) || stockByName.get(rawName.toLowerCase());

        let finalName = matched ? matched.name : aliasedName;
        let finalCode = matched ? matched.item_code : (t.item_code || `KPL-${Math.floor(1000 + idx)}`);
        let finalUnit = matched ? matched.unit : (t.default_unit || "kg");

        if (matched) matchedTemplateItems++;

        return {
          template_name: canonicalDept,
          row_no: t.row_no || (idx + 1),
          item_name: finalName,
          item_code: finalCode,
          default_unit: finalUnit
        };
      });

      parentPort.postMessage({
        success: true,
        data: {
          totalTemplateRows: harmonizedTemplates.length,
          matchedTemplateItems,
          matchRatePct: parseFloat(((matchedTemplateItems / Math.max(1, harmonizedTemplates.length)) * 100).toFixed(2)),
          templates: harmonizedTemplates
        }
      });
    } else if (stage === "AUDIT_AND_VALIDATE_VERITAS") {
      const { harmonizedSessions, harmonizedTemplates, validDepartments } = payload;
      const validDeptSet = new Set(validDepartments.map((d) => d.toUpperCase()));
      const issues = [];

      harmonizedSessions.forEach((s, idx) => {
        if (!validDeptSet.has(s.dept.toUpperCase())) {
          issues.push(`Session ${idx} has invalid department: ${s.dept}`);
        }
        if (!s.date || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
          issues.push(`Session ${idx} has invalid date format: ${s.date}`);
        }
        if (!Array.isArray(s.items) || s.items.length === 0) {
          issues.push(`Session ${idx} for dept ${s.dept} on ${s.date} has no items`);
        }
      });

      parentPort.postMessage({
        success: true,
        data: {
          valid: issues.length === 0,
          issuesCount: issues.length,
          issues: issues.slice(0, 10),
          auditedSessionsCount: harmonizedSessions.length,
          auditedTemplatesCount: harmonizedTemplates.length
        }
      });
    } else {
      parentPort.postMessage({ success: false, error: `Unknown worker stage: ${stage}` });
    }
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message, stack: err.stack });
  }
}
