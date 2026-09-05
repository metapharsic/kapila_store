const { Kafka } = require("kafkajs");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require("../db");

async function checkKafkaStatus() {
  console.log("Checking Kafka broker status...");
  const kafka = new Kafka({
    clientId: "kapila-test-client",
    brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
    retry: { retries: 1 }
  });
  
  const admin = kafka.admin();
  try {
    await admin.connect();
    console.log("✅ Kafka Admin connected successfully!");
    
    const topics = await admin.listTopics();
    console.log("Active Topics in Kafka:", topics);
    
    // Check db event log count
    const logCount = await db("kafka_event_log").count("id as count").first();
    console.log("Database 'kafka_event_log' rows count:", logCount.count);
    
    await admin.disconnect();
  } catch (err) {
    console.error("❌ Kafka Connection Failed:", err.message);
  } finally {
    process.exit(0);
  }
}

checkKafkaStatus();
