const fs = require('fs');
const sharp = require('sharp');
require('dotenv').config();

(async () => {
  const b64 = (await sharp('scratch/extracted_indents/14th_August_Transfers_p09.jpg')
    .resize({ width: 1100 })
    .jpeg({ quality: 70 })
    .toBuffer()).toString('base64');
  console.log('Payload ready, calling gemini-3.5-flash-lite...');
  const start = Date.now();
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + process.env.GEMINI_API_KEY, {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: b64 } },
          { text: 'Extract department and items from this voucher as raw JSON { "to_dept": "...", "items": [{"name": "...", "qty": 1, "unit": "kg"}] }' }
        ]
      }]
    })
  });
  console.log('Status:', res.status, 'in', (Date.now() - start) + 'ms');
  const data = await res.json();
  if (data.candidates) {
    console.log('Candidate text:\n', data.candidates[0].content.parts[0].text.slice(0, 300));
  } else {
    console.log('Error payload:', data);
  }
})();
