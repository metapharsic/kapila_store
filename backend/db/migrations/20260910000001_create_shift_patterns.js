/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("shift_patterns", (t) => {
    t.increments("id").primary();
    t.string("name", 60).notNullable(); // e.g. "Split - Tiffins", "Morning General"
    t.string("shift_type", 20).notNullable(); // SPLIT, MORNING, EVENING, NIGHT, GENERAL
    t.time("start_time").notNullable();
    t.time("end_time").notNullable();
    t.boolean("is_split_shift").notNullable().defaultTo(false);
    t.time("break_start").nullable();
    t.time("break_end").nullable();
    t.string("department", 60).nullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.index(["department"], "idx_shift_patterns_department");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("shift_patterns");
};
