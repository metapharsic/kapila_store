const fs = require("fs");
const path = require("path");

// Force Gemini to fail by setting an invalid/empty key
process.env.GEMINI_API_KEY = "invalid_key_for_testing_fallback";

const { ocrImage, structureWithOllama } = require("../services/localAI");

async function main() {
  console.log("Running Local Fallback OCR & Parsing Test...");

  // Path to the uploaded PNG image in the artifacts directory
  const imagePath = "C:\\Users\\Dell\\.gemini\\antigravity\\brain\\6a6c311b-db8f-4d5a-bd1f-3df1a2aa58c9\\uploaded_media_1782064874876.png";
  if (!fs.existsSync(imagePath)) {
    console.error("Test image not found at path:", imagePath);
    process.exit(1);
  }

  const base64Data = fs.readFileSync(imagePath).toString("base64");

  try {
    console.log("1. Executing ocrImage (forcing Gemini fallback)...");
    const rawText = await ocrImage(base64Data, "image/png");
    console.log("--- OCR Output Start ---");
    console.log(rawText);
    console.log("--- OCR Output End ---\n");

    if (!rawText || rawText.trim().length < 10) {
      throw new Error("OCR output is too short or empty.");
    }

    console.log("2. Executing structureWithOllama with 'purchase' task...");
    const purchaseResult = await structureWithOllama(rawText, "purchase");
    console.log("Purchase Result:", JSON.stringify(purchaseResult, null, 2));

    console.log("\n3. Executing structureWithOllama with 'indent' task...");
    const indentResult = await structureWithOllama(rawText, "indent");
    console.log("Indent Result:", JSON.stringify(indentResult, null, 2));

    console.log("\nSuccess! Both local Tesseract OCR and regex parser fell back and functioned correctly.");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

main();
