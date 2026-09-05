const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");

async function main() {
  const imagePath = "C:\\Users\\Dell\\.gemini\\antigravity\\brain\\6a6c311b-db8f-4d5a-bd1f-3df1a2aa58c9\\uploaded_media_1782064874876.png";
  if (!fs.existsSync(imagePath)) {
    console.error("Image file does not exist:", imagePath);
    return;
  }

  console.log("Initializing Tesseract OCR with local traineddata...");
  try {
    const result = await Tesseract.recognize(
      imagePath,
      "eng",
      {
        langPath: path.join(__dirname, ".."),
        logger: m => console.log("Logger:", m.status, Math.round(m.progress * 100) + "%")
      }
    );
    console.log("OCR Result Text:\n", result.data.text);
  } catch (err) {
    console.error("Tesseract Error:", err);
  }
}

main();
