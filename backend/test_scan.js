require('dotenv').config();
const localAI = require('./services/localAI');

async function testScan() {
  console.log("Testing text structuring...");
  try {
    const parsed = await localAI.structureWithOllama("Aloo 5 kg, Tamatar 2 kg", "purchase");
    console.log("Parsed:", JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

testScan();
