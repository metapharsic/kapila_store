const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../db');

const API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const IMG_DIR = path.join(__dirname, '../scratch/extracted_indents');
const RAW_DIR = path.join(__dirname, '../scratch/14th_aug_raw_agent_results');

if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

// ============================================================================
// AGENT 1: Multi-Modal Vision Intake Agent (IndentVisionExtractorAgent)
// ============================================================================
async function extractPageWithVision(pageNo) {
  const pStr = String(pageNo).padStart(2, '0');
  const cacheFile = path.join(RAW_DIR, `page_${pStr}_extracted.json`);

  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached && cached.categories && cached.categories.length > 0) {
        console.log(`[Agent 1: Vision] Page ${pStr} loaded from cache.`);
        return cached;
      }
    } catch (e) {}
  }

  const imgPath = path.join(IMG_DIR, `14th_August_Transfers_p${pStr}.jpg`);
  if (!fs.existsSync(imgPath)) {
    throw new Error(`Image not found: ${imgPath}`);
  }

  const b64 = (await sharp(imgPath).resize({ width: 1400 }).jpeg({ quality: 80 }).toBuffer()).toString('base64');

  const prompt = `You are an expert hospitality inventory auditor for Hotel Kapila.
This image is a Hotel Kapila Material Transfer / Indent voucher from 14th August.
Carefully examine the entire voucher page (headers, table columns, handwritten and printed details).
Extract:
1. "document_title": Title of form (e.g. Indent/Requisition Form).
2. "date": Date as printed or written (e.g. 2026-08-14 or 14/08/26).
3. "voucher_number": Voucher/Indent number if visible.
4. "department_name": Destination department/counter (e.g. NORTH INDIAN, TIFFINS, STAFF, SI-MEALS, CHAT & SOFTY, CHINESE & DOSA, MOCKTAILS & CONTINENTAL, RESTAURANT, ROOM SERVICE).
5. "categories": Array of categories mentioned on this sheet. On these printed indent forms, items are organized under Category / Section headers (for example: "NORTH INDIAN", "VEGETABLES", "South indian Tiffines", "Dosa Batter", "Dosa", "Sount indian meals.", "Cookies", "Stall", "Softy ice cream", "disposable", "disposable jalpan", "Chinese", "continental", "Mocktails & Ice cream", "tea", "juice", "Room Services", etc.). If there is no explicit sub-header, use the sheet's primary category/department name.
   For each category:
   - "category_name": Name of the category as mentioned on the indent form.
   - "items": Array of all items listed under this category. Include ALL items printed or written on this page:
     * "line_number": Numeric line/row number.
     * "item_name": Full clean item name as written/printed in Title Case.
     * "quantity": Numeric quantity issued/requested (number or null if blank/not issued).
     * "unit": Unit of measurement (kg, g, L, ml, pcs, pkt, tin, bottle, bundle, box, etc.).
     * "notes": Any handwritten remarks or ticks if present.

Return ONLY raw valid JSON (no markdown formatting, no code block backticks):
{
  "page_number": ${pageNo},
  "document_title": "string",
  "date": "YYYY-MM-DD",
  "voucher_number": "string or null",
  "department_name": "string",
  "categories": [
    {
      "category_name": "string",
      "items": [
        { "line_number": 1, "item_name": "string", "quantity": 0, "unit": "string", "notes": null }
      ]
    }
  ]
}`;

  const models = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-2.5-flash'
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log(`[Agent 1: Vision] Trying model ${model} for Page ${pStr}...`);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: b64 } },
              { text: prompt }
            ]
          }]
        })
      });

      const data = await res.json();
      if (!res.ok || !data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        console.warn(`[Agent 1: Vision] Model ${model} returned status ${res.status}: ${data.error?.message?.slice(0, 100)}`);
        lastError = new Error(data.error?.message || `HTTP ${res.status}`);
        continue;
      }

      let text = data.candidates[0].content.parts[0].text.trim();
      if (text.startsWith('```json')) text = text.slice(7);
      if (text.startsWith('```')) text = text.slice(3);
      if (text.endsWith('```')) text = text.slice(0, -3);
      text = text.trim();

      const parsed = JSON.parse(text);
      parsed.page_number = pageNo;
      fs.writeFileSync(cacheFile, JSON.stringify(parsed, null, 2));
      console.log(`[Agent 1: Vision] Page ${pStr} successfully extracted via ${model} (${parsed.categories.reduce((s, c) => s + c.items.length, 0)} items across ${parsed.categories.length} categories).`);
      return parsed;
    } catch (err) {
      console.warn(`[Agent 1: Vision] Error with ${model}: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error(`All models failed for page ${pStr}`);
}

// Process with small rate-limiting
async function extractAll15Pages() {
  const pages = [];
  for (let i = 1; i <= 15; i++) {
    const pageData = await extractPageWithVision(i);
    pages.push(pageData);
    await new Promise((r) => setTimeout(r, 1200));
  }
  return pages;
}

if (require.main === module) {
  extractAll15Pages()
    .then((pages) => {
      console.log(`\nAll 15 pages extracted! Total pages: ${pages.length}`);
      const summary = pages.map((p) => ({
        page: p.page_number,
        dept: p.department_name,
        categories: p.categories.map((c) => `${c.category_name} (${c.items.length} items)`).join(', ')
      }));
      console.table(summary);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Vision extraction failed:', err);
      process.exit(1);
    });
}

module.exports = {
  extractAll15Pages,
  extractPageWithVision,
};
