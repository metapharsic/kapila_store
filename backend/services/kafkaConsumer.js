const { Kafka } = require("kafkajs");
const db = require("../db");

// Mirrors every stock/indent/issuance event into Postgres (kafka_event_log) so
// it's queryable with plain SQL/joins, not just readable off the Kafka log.
// Kafka stays the source of truth for the stream; this table is a read-side
// projection — same "consumer" pattern as any event-sourcing setup, just
// simple enough to not need its own service process.
const kafka = new Kafka({
  clientId: "kapila-backend-consumer",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
  retry: { retries: 5 },
});

const TOPICS = [
  "stock-events", "indent-events", "issuance-events",
  "purchase-order-events", "grn-events", "transfer-events",
  "production-events", "leftover-events", "supplier-events",
  "rate-quote-events", "recipe-events",
];
const consumer = kafka.consumer({ groupId: "kapila-event-log" });

async function start() {
  try {
    await consumer.connect();
    await Promise.all(TOPICS.map((topic) => consumer.subscribe({ topic, fromBeginning: true })));

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        let payload;
        try {
          payload = JSON.parse(message.value.toString());
          await db("kafka_event_log").insert({
            topic,
            event_type: payload.type || "unknown",
            payload,
            produced_at: payload.ts || null,
          });
        } catch (err) {
          console.error(`[KafkaConsumer] failed to persist message from ${topic}:`, err.message);
          return;
        }

        // Cross-module sync: indent/issuance creation can breach a reorder
        // point in another module (stock/procurement). This used to be a
        // direct in-process call from indentController/issuanceController —
        // now it's Kafka-driven, so the reorder-breach check runs decoupled
        // from the original request and survives even if that request's
        // process restarts before the check finishes.
        if ((payload.type === "indent.create" || payload.type === "issuance.create") && Array.isArray(payload.items)) {
          try {
            const { checkAndDraftReorderPOs } = require("./reorderAutoPO");
            const sourceLabel = payload.type === "indent.create" ? `indent #${payload.id}` : `issuance #${payload.id}`;
            await checkAndDraftReorderPOs(payload.items, sourceLabel, payload.creator_user_id || null);
          } catch (err) {
            console.error(`[KafkaConsumer] reorder-check failed for ${topic}:`, err.message);
          }
        }
      },
    });

    console.log(`[KafkaConsumer] listening on: ${TOPICS.join(", ")}`);
  } catch (err) {
    // Broker not up yet, or transient network issue — don't crash the app.
    // The consumer just stays disconnected until the broker becomes reachable.
    console.error("[KafkaConsumer] failed to start:", err.message);
  }
}

module.exports = { start };
