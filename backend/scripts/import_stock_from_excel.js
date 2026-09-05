const db = require("../db");
const xlsx = require("xlsx");
const path = require("path");

const FILE = path.join(__dirname, "../../Documentation/Current stock with price.xlsx");
const TODAY = new Date().toISOString().slice(0, 10);

function normalizeUnit(raw) {
  const u = (raw || "kg").toString().trim().toLowerCase().replace(/\.*$/, "");
  if (["kg", "kgs", "kilo"].some(x => u === x)) return "kg";
  if (["litre", "ltr", "lts", "l"].some(x => u === x)) return "L";
  if (["ml"].some(x => u === x)) return "ml";
  if (["pcs", "pc", "piece", "pieces", "nos", "no's", "nos.", "dish"].some(x => u === x)) return "pcs";
  if (["bottle", "bottles"].some(x => u === x)) return "bottle";
  if (["box", "boxes", "case"].some(x => u === x)) return "box";
  if (["pkt", "pkts", "packet", "packets"].some(x => u === x)) return "pkt";
  if (["dozen"].some(x => u === x)) return "dozen";
  if (["tin"].some(x => u === x)) return "tin";
  if (["jar"].some(x => u === x)) return "jar";
  if (["bulk"].some(x => u === x)) return "bulk";
  if (["block"].some(x => u === x)) return "pcs";
  return "pcs";
}

function toItemCode(name, idx) {
  return "KPL-" + String(idx + 1).padStart(4, "0");
}

async function run() {
  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = xlsx.utils.sheet_to_json(ws, { header: 1 });

  // Row 2 (index 2) = headers: S.NO, Item, Category, Current Stock, Unit, Price
  const rows = raw.slice(3); // data starts row index 3

  const items = [];
  for (const r of rows) {
    const sno = r[0];
    const name = (r[1] || "").toString().trim();
    const qty  = parseFloat(r[3]) || 0;
    const unit = normalizeUnit(r[4]);
    const price = parseFloat(r[5]) || 0;

    if (!name || isNaN(Number(sno))) continue;
    items.push({ name, qty, unit, price });
  }

  console.log(`Parsed ${items.length} items from Excel.`);

  // Clear existing stock (already truncated, but be safe)
  await db("stock").del();
  console.log("stock table cleared.");

  const BATCH = 50;
  let inserted = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const rows = chunk.map((it, j) => ({
      name:          it.name,
      qty:           it.qty,
      remaining:     it.qty,
      unit:          it.unit,
      date:          TODAY,
      price:         it.price,
      supplier:      "Opening Stock",
      item_code:     toItemCode(it.name, i + j),
      batch_no:      `OPEN-${TODAY.replace(/-/g,"")}`,
      expiry_date:   null,
      min_alert_qty: null,
    }));
    await db("stock").insert(rows);
    inserted += rows.length;
    console.log(`Inserted ${inserted}/${items.length}...`);
  }

  // Also seed reorder_points at 10% of qty
  await db("reorder_points").del();
  const stockRows = await db("stock").select("item_code","name","qty","unit");
  const rp = stockRows.map(s => ({
    item_code:            s.item_code,
    name:                 s.name,
    min_qty:              Math.max(1, Math.round(s.qty * 0.1 * 10) / 10),
    reorder_qty:          Math.max(2, Math.round(s.qty * 0.3 * 10) / 10),
    lead_time_days:       3,
    preferred_supplier_id: null,
    is_active:            true,
  }));
  for (let i = 0; i < rp.length; i += BATCH) {
    await db("reorder_points").insert(rp.slice(i, i + BATCH));
  }
  console.log(`Seeded ${rp.length} reorder points.`);

  console.log(`\nDONE. ${inserted} stock rows imported from Excel.`);
  process.exit(0);
}

run().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
