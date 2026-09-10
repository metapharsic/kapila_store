const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const localAI = require('./services/localAI');

async function testGemini() {
  console.log("Checking API Key presence...");
  const health = await localAI.checkAIHealth();
  console.log("Health:", health);

  if (health.ok) {
    console.log("Testing Gemini API call...");
    try {
      const res = await localAI.generateMorningBriefing({ pendingIndents: 1 });
      console.log("Gemini API Response:", res);
    } catch (err) {
      console.error("Gemini API Error:", err.message);
    }
  }
}

testGemini();
