const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

async function testSinglePage(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const start = buf.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]));
  const end = buf.indexOf(Buffer.from([0xFF, 0xD9]), start) + 2;
  const raw = buf.slice(start, end);

  console.log(`Extracted image from ${path.basename(pdfPath)}: ${raw.length} bytes`);

  const resized = await sharp(raw)
    .resize({ width: 1600 })
    .jpeg({ quality: 85 })
    .toBuffer();

  const b64 = resized.toString('base64');

  const prompt = `You are an expert inventory auditor for Hotel Kapila. This is a material transfer / indent voucher page.
Read this document very carefully and extract:
1. Date of transfer/indent
2. Transfer / Indent Number / Voucher Number
3. From Department / Location (e.g. Central Store)
4. To Department / Location (e.g. TIFFINS, SI-MEALS, STAFF, NORTH INDIAN, CHAT & SOFTY, CHINESE & DOSA, MOCKTAILS & CONTINENTAL, RESTAURANT, ROOM SERVICE, etc.)
5. Complete list of all items requested/transferred, with:
   - name: exact item name
   - qty: quantity transferred/issued
   - unit: unit of measurement (kg, g, ltr, ml, nos, pkt, tin, bottle, etc.)
   - rate: unit rate if available (or null)
   - amount: total value if available (or null)

Return ONLY a JSON object:
{
  "date": "YYYY-MM-DD",
  "voucher_no": "string",
  "from_dept": "string",
  "to_dept": "string",
  "items": [
    { "name": "string", "qty": 0, "unit": "string", "rate": null, "amount": null }
  ]
}`;

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: b64 } },
          { text: prompt }
        ]
      }]
    })
  });

  const data = await res.json();
  if (data.error) {
    console.error('API Error:', data.error);
    return null;
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('Result text:\n', text);
  return text;
}

const targetPdf = path.join(__dirname, '../../Project_requirement/Indents/15/15th_August_Transfer_Page_01.pdf');
testSinglePage(targetPdf).catch(console.error);
