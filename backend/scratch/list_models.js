const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function listModels() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log("Supported Models:");
    if (json.models) {
      json.models.forEach(m => console.log(m.name, m.supportedGenerationMethods));
    } else {
      console.log(JSON.stringify(json, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
}

listModels();
