const { Kafka } = require("kafkajs");

// Fire-and-forget event bus for the inventory domain. Kafka being down must
// NEVER break a stock/indent/issuance mutation — same fail-safe contract as
// auditService.auditLog. Connection is lazy (only on first publish) so app
// boot doesn't hang waiting on a broker that may not be running yet.
const kafka = new Kafka({
  clientId: "kapila-backend",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  retry: { retries: 2 },
});

const producer = kafka.producer();
let connected = false;
let connecting = null;

async function ensureConnected() {
  if (connected) return true;
  if (!connecting) {
    connecting = producer.connect()
      .then(() => { connected = true; })
      .catch((err) => { console.error("[Kafka] connect failed:", err.message); })
      .finally(() => { connecting = null; });
  }
  await connecting;
  return connected;
}

// topic examples: "stock-events", "indent-events", "issuance-events"
// Returns true/false so callers can fall back to a direct in-process path
// when Kafka is unreachable (e.g. the reorder-breach check) instead of
// silently losing that side-effect.
async function publish(topic, event) {
  try {
    const ok = await ensureConnected();
    if (!ok) return false;
    await producer.send({
      topic,
      messages: [{ key: String(event.id ?? ""), value: JSON.stringify({ ...event, ts: new Date().toISOString() }) }],
    });
    return true;
  } catch (err) {
    console.error(`[Kafka] publish to ${topic} failed:`, err.message);
    return false;
  }
}

function isHealthy() {
  return connected;
}

module.exports = { publish, isHealthy, ensureConnected };
