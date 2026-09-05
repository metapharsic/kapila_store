const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { parseVoiceIndent, parseNLStockQuery } = require('../services/localAI');

async function runTests() {
  console.log("Testing voice parsing...");
  try {
    const voiceResult = await parseVoiceIndent("Give me 5 packets of milk, 10 kg of butter and 1 box of eggs");
    console.log("Voice Result:", JSON.stringify(voiceResult, null, 2));

    const nlpResult = await parseNLStockQuery("spices under 5kg expiring soon");
    console.log("NLP Result:", JSON.stringify(nlpResult, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
  process.exit(0);
}

runTests();
