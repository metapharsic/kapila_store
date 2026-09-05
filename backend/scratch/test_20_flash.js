const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');

async function test20Flash() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  console.log("Using key:", GEMINI_API_KEY ? "Present" : "Missing");
  
  // Test gemini-2.0-flash model
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const imgPath = "C:\\Users\\Dell\\.gemini\\antigravity\\brain\\6a6c311b-db8f-4d5a-bd1f-3df1a2aa58c9\\uploaded_media_1782064874876.png";
  if (!fs.existsSync(imgPath)) {
    console.error("Image does not exist at:", imgPath);
    return;
  }
  const base64 = fs.readFileSync(imgPath).toString('base64');
  
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64
            }
          },
          {
            text: "Perform OCR on this image. Extract all text, numbers, and words clearly. Return only the raw text extracted."
          }
        ]
      }
    ]
  };

  try {
    console.log("Calling Gemini 2.0 Flash API...");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    console.log("Response status:", response.status);
    const result = await response.json();
    if (!response.ok) {
      console.error("API error:", JSON.stringify(result, null, 2));
    } else {
      console.log("OCR Success!");
      console.log("Extracted Text:\n", result.candidates?.[0]?.content?.parts?.[0]?.text.slice(0, 300));
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test20Flash();
