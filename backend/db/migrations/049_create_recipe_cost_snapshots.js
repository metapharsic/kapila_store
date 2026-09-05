/**
 * AI-standard enhancement #16: track recipe cost over time so a drift (e.g.
 * supplier price hike silently eating margin) can be detected instead of
 * discovered by accident.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("recipe_cost_snapshots", (table) => {
    table.increments("id").primary();
    table.integer("recipe_id").notNullable().references("id").inTable("recipes").onDelete("CASCADE");
    table.specificType("total_cost", "real").notNullable();
    table.timestamp("computed_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["recipe_id", "computed_at"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("recipe_cost_snapshots");
};
