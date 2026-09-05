exports.up = (knex) =>
  knex.schema.createTable("kafka_event_log", (t) => {
    t.increments("id").primary();
    t.string("topic", 100).notNullable();
    t.string("event_type", 100).notNullable();
    t.jsonb("payload").notNullable();
    t.timestamp("produced_at").nullable();   // event's own "ts" field, set by the producer
    t.timestamp("consumed_at").defaultTo(knex.fn.now());
    t.index(["topic"]);
    t.index(["event_type"]);
    t.index(["produced_at"]);
  });

exports.down = (knex) => knex.schema.dropTableIfExists("kafka_event_log");
