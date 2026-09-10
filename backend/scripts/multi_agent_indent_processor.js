const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const xlsx = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const imgDir = path.join(__dirname, '../scratch/extracted_indents');
const outDir = path.join(__dirname, '../scratch/indent_page_results');
const masterFile = path.join(__dirname, '../scratch/all_indents_master.json');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CANONICAL_DEPTS = [
  'TIFFINS',
  'STAFF',
  'SI-MEALS',
  'NORTH INDIAN',
  'CHAT & SOFTY',
  'CHINESE & DOSA',
  'MOCKTAILS & CONTINENTAL',
  'RESTAURANT',
  'ROOM SERVICE'
];

function normalizeDept(raw) {
  if (!raw) return 'CENTRAL STORE';
  const u = raw.toUpperCase().trim();
  if (u.includes('TIFFIN')) return 'TIFFINS';
  if (u.includes('STAFF') || u.includes('STALL')) return 'STAFF';
  if (u.includes('SI-MEAL') || u.includes('SOUTH') || u.includes('MEALS')) return 'SI-MEALS';
  if (u.includes('NORTH')) return 'NORTH INDIAN';
  if (u.includes('CHAT') || u.includes('SOFTY')) return 'CHAT & SOFTY';
  if (u.includes('CHINESE') || u.includes('DOSA')) return 'CHINESE & DOSA';
  if (u.includes('MOCKTAIL') || u.includes('CONTINENTAL')) return 'MOCKTAILS & CONTINENTAL';
  if (u.includes('TEA') || u.includes('JUICE') || u.includes('FALUDA') || u.includes('RESTAURANT')) return 'RESTAURANT';
  if (u.includes('ROOM')) return 'ROOM SERVICE';
  return raw.trim();
}

async function processPage(imageFileName, retries = 3) {
  const resultFile = path.join(outDir, imageFileName.replace('.jpg', '.json'));
  if (fs.existsSync(resultFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
      if (existing && existing.items && existing.items.length > 0) {
        console.log(`[CACHED] ${imageFileName} -> Dept: ${existing.to_dept || 'Unknown'}, Items: ${existing.items.length}`);
        return existing;
      }
    } catch (e) {}
  }

  const rawBuf = fs.readFileSync(path.join(imgDir, imageFileName));
  const resized = await sharp(rawBuf)
    .resize({ width: 1100 })
    .jpeg({ quality: 70 })
    .toBuffer();

  const b64 = resized.toString('base64');

  const prompt = `You are an expert hospitality inventory auditor for Hotel Kapila.
This image is a Hotel Kapila Material Transfer / Indent voucher.
Carefully examine the entire voucher page (headers, table columns, hand-written and printed details).
Known departments list:
- TIFFINS (breakfast, idly, vada, morning items)
- STAFF (staff mess, staff food)
- SI-MEALS (South Indian meals, rice, sambar, lunch/dinner meals)
- NORTH INDIAN (North Indian kitchen, curries, gravies, rotis)
- CHAT & SOFTY (chaat counter, pani puri, softy ice cream)
- CHINESE & DOSA (Chinese food, noodles, fried rice, dosa)
- MOCKTAILS & CONTINENTAL (continental, mocktails, shakes, bar)
- RESTAURANT (dining hall, tea counter, juice & faluda, dining service)
- ROOM SERVICE (guest room service)

Extract:
1. "date": Date of voucher (YYYY-MM-DD or as printed).
2. "voucher_no": Transfer / Indent / S.No if visible.
3. "from_dept": Source department (typically "Central Store").
4. "to_dept": Destination department (match strictly to one of the 9 known departments above).
5. "items": Array of all items transferred. For each item:
   - "name": Clean item name in Title Case (e.g. "Sugar", "Milk", "Onion", "Tea Powder", "Maida").
   - "qty": Numeric quantity transferred/issued (float/number).
   - "unit": Unit of measure (kg, g, L, ml, pcs, pkt, tin, bottle, case, etc.).
   - "rate": Rate if printed (number or null).
   - "amount": Amount if printed (number or null).

Return ONLY raw valid JSON (no markdown formatting, no code fencing):
{
  "date": "YYYY-MM-DD",
  "voucher_no": "string",
  "from_dept": "string",
  "to_dept": "string",
  "items": [
    { "name": "string", "qty": 0, "unit": "string", "rate": null, "amount": null }
  ]
}`;

  const models = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.5-flash'];

  for (let attempt = 1; attempt <= retries; attempt++) {
    const model = models[(attempt - 1) % models.length];
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(40000),
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: b64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || res.status === 503) {
          console.warn(`[${res.status}] ${imageFileName} on ${model} (attempt ${attempt}/${retries}). Rotating model...`);
          await delay(4000);
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`);
      }

      const data = await res.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        text = text.substring(firstBrace, lastBrace + 1);
      } else if (firstBrace !== -1) {
        // Incomplete json, close it
        const lastValidObj = text.lastIndexOf('}');
        if (lastValidObj !== -1) {
          text = text.substring(firstBrace, lastValidObj + 1) + ']}';
        }
      }

      const parsed = JSON.parse(text);
      parsed.source_file = imageFileName;
      parsed.normalized_dept = normalizeDept(parsed.to_dept);
      fs.writeFileSync(resultFile, JSON.stringify(parsed, null, 2), 'utf8');
      console.log(`[EXTRACTED] ${imageFileName} -> Dept: "${parsed.normalized_dept}", Items: ${parsed.items?.length || 0}`);
      return parsed;
    } catch (err) {
      console.error(`[ERROR] ${imageFileName} attempt ${attempt} on ${model}:`, err.message);
      if (attempt < retries) {
        await delay(3500);
      }
    }
  }

  return null;
}

function compileMasterReport() {
  const files = fs.readdirSync(outDir).filter(f => f.endsWith('.json'));
  console.log(`Compiling master report from ${files.length} processed page files...`);

  const departmentsMap = {};
  const itemsMap = {};
  let totalItemsCount = 0;

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'));
      const dept = normalizeDept(data.to_dept);
      const date = data.date || 'Unknown Date';

      if (!departmentsMap[dept]) {
        departmentsMap[dept] = {
          name: dept,
          pages: [],
          dates: new Set(),
          total_items_transferred: 0,
          unique_items: new Set(),
        };
      }

      departmentsMap[dept].pages.push(data.source_file || f);
      departmentsMap[dept].dates.add(date);

      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          if (!item.name || typeof item.name !== 'string') continue;
          const cleanName = item.name.trim();
          if (cleanName.length < 2) continue;

          totalItemsCount++;
          departmentsMap[dept].total_items_transferred++;
          departmentsMap[dept].unique_items.add(cleanName);

          const key = cleanName.toLowerCase();
          if (!itemsMap[key]) {
            itemsMap[key] = {
              canonical_name: cleanName,
              units: new Set(),
              departments: new Set(),
              total_qty: 0,
              occurrences: 0,
              dates: new Set(),
              sample_voucher: data.source_file
            };
          }

          if (item.unit) itemsMap[key].units.add(item.unit.toLowerCase().trim());
          itemsMap[key].departments.add(dept);
          itemsMap[key].dates.add(date);
          itemsMap[key].occurrences++;
          const q = parseFloat(item.qty);
          if (!isNaN(q)) itemsMap[key].total_qty += q;
        }
      }
    } catch (err) {
      console.error(`Error reading ${f}:`, err.message);
    }
  }

  // Format objects for export
  const departmentsList = Object.values(departmentsMap).map(d => ({
    department: d.name,
    vouchers_pages_count: d.pages.length,
    dates: Array.from(d.dates).sort(),
    unique_items_count: d.unique_items.size,
    sample_items: Array.from(d.unique_items).slice(0, 15)
  })).sort((a, b) => b.unique_items_count - a.unique_items_count);

  const itemsList = Object.values(itemsMap).map(it => ({
    name: it.canonical_name,
    primary_unit: Array.from(it.units)[0] || 'kg',
    all_units: Array.from(it.units),
    total_qty: Math.round(it.total_qty * 100) / 100,
    frequency: it.occurrences,
    departments: Array.from(it.departments).sort(),
    dates: Array.from(it.dates).sort(),
  })).sort((a, b) => a.name.localeCompare(b.name));

  const masterSummary = {
    generated_at: new Date().toISOString(),
    pages_processed: files.length,
    total_items_logged: totalItemsCount,
    total_unique_items: itemsList.length,
    total_departments: departmentsList.length,
    departments: departmentsList,
    items: itemsList
  };

  fs.writeFileSync(masterFile, JSON.stringify(masterSummary, null, 2), 'utf8');

  // Also write Excel spreadsheet for business reference
  const wb = xlsx.utils.book_new();

  // Sheet 1: Items Master
  const itemsRows = itemsList.map(it => ({
    "Item Name": it.name,
    "Primary Unit": it.primary_unit,
    "All Units Seen": it.all_units.join(', '),
    "Total Transferred Qty": it.total_qty,
    "Indent Frequency": it.frequency,
    "Departments Using Item": it.departments.join(', '),
    "Dates Transferred": it.dates.join(', ')
  }));
  const wsItems = xlsx.utils.json_to_sheet(itemsRows);
  xlsx.utils.book_append_sheet(wb, wsItems, "Indent Items Catalog");

  // Sheet 2: Departments Summary
  const deptRows = departmentsList.map(d => ({
    "Department Name": d.department,
    "Total Pages/Vouchers": d.vouchers_pages_count,
    "Unique Items Count": d.unique_items_count,
    "Dates Active": d.dates.join(', '),
    "Sample Top Items": d.sample_items.join(', ')
  }));
  const wsDepts = xlsx.utils.json_to_sheet(deptRows);
  xlsx.utils.book_append_sheet(wb, wsDepts, "Departments Summary");

  const excelPath = path.join(__dirname, '../scratch/Kapila_Indent_Items_Master.xlsx');
  xlsx.writeFile(wb, excelPath);

  console.log(`Master compilation saved:`);
  console.log(`- JSON: ${masterFile}`);
  console.log(`- Excel: ${excelPath}`);
  console.log(`- Unique items: ${itemsList.length}`);
  console.log(`- Departments: ${departmentsList.length}`);

  return masterSummary;
}

async function runContinuous(batchLimit = 106) {
  const allImages = fs.readdirSync(imgDir).filter(f => f.endsWith('.jpg')).sort();
  console.log(`Starting continuous extraction across ${allImages.length} images (limit: ${batchLimit})...`);

  let count = 0;
  for (const img of allImages.slice(0, batchLimit)) {
    await processPage(img);
    count++;
    if (count % 5 === 0) {
      compileMasterReport();
    }
    await delay(3500);
  }

  const finalSummary = compileMasterReport();
  console.log('ALL EXTRACTION FINISHED!');
  return finalSummary;
}

module.exports = { processPage, compileMasterReport, runContinuous, normalizeDept };

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--compile-only') {
    compileMasterReport();
  } else if (arg && arg.endsWith('.jpg')) {
    processPage(arg).then(() => compileMasterReport()).catch(console.error);
  } else {
    const limit = parseInt(arg, 10) || 106;
    runContinuous(limit).catch(console.error);
  }
}
