const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const localAI = require('../services/localAI');

async function testRealOcr() {
  console.log("Reading real image...");
  const imgPath = "C:\\Users\\Dell\\.gemini\\antigravity\\brain\\6a6c311b-db8f-4d5a-bd1f-3df1a2aa58c9\\uploaded_media_1782064874876.png";
  if (!fs.existsSync(imgPath)) {
    console.error("Image does not exist at:", imgPath);
    return;
  }
  const base64 = fs.readFileSync(imgPath).toString('base64');
  console.log("Calling Gemini OCR on real image...");
  try {
    const text = await localAI.ocrImage(base64, "image/png");
    console.log("OCR Success!");
    console.log("Extracted Text:\n", text);
  } catch (err) {
    console.error("OCR Failed with error:", err);
  }
}

testRealOcr();
