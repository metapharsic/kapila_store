require("dotenv").config();
const { transcribeAudio } = require("../services/localAI");

async function main() {
  console.log("Testing Gemini API connectivity...");
  try {
    // Try to call structureWithOllama / callGemini using a simple text input
    // We can simulate an audio transcription or OCR request, or since transcribeAudio is simpler,
    // we can pass a dummy base64 string or call it directly.
    // Actually, let's mock or perform a simple call. Let's look at localAI.js exports:
    // module.exports = { ocrImage, structureWithOllama, checkAIHealth, transcribeAudio };
    // Let's call structureWithOllama with a simple text parsing request.
    const { structureWithOllama } = require("../services/localAI");
    
    console.log("Sending simple text to structureWithOllama...");
    const result = await structureWithOllama("Aloo 5 kg, tomato 2 kgs", "text");
    console.log("Success! Gemini response:", JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err.message);
    process.exit(1);
  }
}

main();
