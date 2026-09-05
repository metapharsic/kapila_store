const db = require("./db");
const detectAnomalies = require("./cron/anomalyDetector");

async function test() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  // Insert fake data into issuances and production
  // We need a baseline and a spike
  
  // Clean up any existing test data
  await db("issuance_items").whereIn("name", ["Premium Basmati Rice", "Salt"]).del();
  await db("issuances").where("dept", "TIFFINS").del();
  await db("production").where("dept", "TIFFINS").del();
  await db("anomaly_alerts").del();

  console.log("Seeding baseline...");
  for (let i = 2; i <= 8; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = d.toISOString().split("T")[0];
    
    // Baseline: 50 plates, 2.5kg rice (0.05 per plate), 0.5kg salt (0.01 per plate)
    await db("production").insert({ date: dStr, dept: "TIFFINS", plates: 50, created_by: 1 });
    const [issuance] = await db("issuances").insert({ date: dStr, dept: "TIFFINS", scanned: true }).returning("id");
    await db("issuance_items").insert([
      { issuance_id: issuance.id, name: "Premium Basmati Rice", qty: 2.5, issued: 2.5, item_code: "KPL-101", unit: "kg" },
      { issuance_id: issuance.id, name: "Salt", qty: 0.5, issued: 0.5, item_code: "KPL-202", unit: "kg" }
    ]);
  }

  console.log("Seeding spikes for yesterday...");
  await db("production").insert({ date: dateStr, dept: "TIFFINS", plates: 50, created_by: 1 });
  const [spikeIssuance] = await db("issuances").insert({ date: dateStr, dept: "TIFFINS", scanned: true }).returning("id");
  
  // Phase 3 Test Data:
  // Rice (High Value, 20% threshold): Spike by 30% (2.5 -> 3.25) -> SHOULD TRIGGER
  // Salt (Volatile, 60% threshold): Spike by 50% (0.5 -> 0.75) -> SHOULD NOT TRIGGER
  await db("issuance_items").insert([
    { issuance_id: spikeIssuance.id, name: "Premium Basmati Rice", qty: 3.25, issued: 3.25, item_code: "KPL-101", unit: "kg" },
    { issuance_id: spikeIssuance.id, name: "Salt", qty: 0.75, issued: 0.75, item_code: "KPL-202", unit: "kg" }
  ]);

  console.log("Triggering Anomaly Detector...");
  
  // PHASE 2 Validation: Mock the WhatsApp API to ensure it triggers
  process.env.WHATSAPP_TOKEN = "TEST_TOKEN";
  process.env.WHATSAPP_PHONE_ID = "12345";
  process.env.ADMIN_WHATSAPP_NUMBER = "000000000";

  let fetchCalled = false;
  let fetchPayload = null;
  const originalFetch = global.fetch;
  
  global.fetch = async (url, options) => {
    if (url.includes("graph.facebook.com")) {
      fetchCalled = true;
      fetchPayload = JSON.parse(options.body);
      return {
        json: async () => ({ messages: [{ id: "mock_msg_id_123" }] })
      };
    }
    return originalFetch(url, options);
  };

  await detectAnomalies();

  console.log("\n--- TEST SUITE RESULTS ---");
  
  console.log("Phase 1 & 3 (Database Logging & Thresholds): Checking database...");
  const alerts = await db("anomaly_alerts").select("*");
  const riceAlert = alerts.find(a => a.item === "Premium Basmati Rice");
  const saltAlert = alerts.find(a => a.item === "Salt");

  if (riceAlert && !saltAlert) {
    console.log("✅ Phase 1 & 3 PASSED: High-value item triggered on 30% spike. Volatile item ignored 50% spike.");
  } else {
    console.error("❌ Phase 1 & 3 FAILED: Incorrect anomaly detection.");
    console.log("Expected: Rice=Triggered, Salt=Ignored.");
    console.log(`Actual: Rice=${!!riceAlert}, Salt=${!!saltAlert}`);
  }

  console.log("\nPhase 2 (WhatsApp Integration): Checking API call...");
  if (fetchCalled) {
    console.log("✅ Phase 2 PASSED: WhatsApp API was successfully called.");
    console.log("Payload Sent:\n", fetchPayload.text.body);
  } else {
    console.error("❌ Phase 2 FAILED: WhatsApp API was NOT called.");
  }

  // Restore
  global.fetch = originalFetch;

  process.exit(0);
}

test();
