const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const fs = require("fs");
const localAI = require("../services/localAI");

async function main() {
  const imgPath = "C:\\Users\\Dell\\.gemini\\antigravity-ide\\brain\\648b105d-88b5-49ab-b3c7-c17ed87408b8\\.user_uploaded\\media_1788872980327.png";
  if (!fs.existsSync(imgPath)) {
    console.error("Image file not found at", imgPath);
    return;
  }
  const base64 = fs.readFileSync(imgPath).toString("base64");
  console.log("Image size (bytes):", fs.statSync(imgPath).size);
  console.log("Calling localAI.ocrImage...");
  try {
    const text = await localAI.ocrImage(base64, "image/png");
    console.log("=== OCR RESULT ===");
    console.log(text);
    fs.writeFileSync(path.join(__dirname, "extracted_image_ocr.txt"), text);
  } catch (err) {
    console.error("OCR Error:", err.message);
  }
}

main();
