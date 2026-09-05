/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("anomaly_alerts", (table) => {
    table.increments("id").primary();
    table.string("item").notNullable();
    table.string("department").notNullable();
    table.date("date").notNullable();
    table.decimal("baseline_ratio", 10, 4).notNullable();
    table.decimal("current_ratio", 10, 4).notNullable();
    table.string("severity").defaultTo("Critical");
    table.text("description");
    table.enum("status", ["UNREAD", "ACKNOWLEDGED", "RESOLVED"]).defaultTo("UNREAD");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("resolved_at");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("anomaly_alerts");
};
