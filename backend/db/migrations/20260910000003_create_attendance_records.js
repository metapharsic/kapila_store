/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("attendance_records", (t) => {
    t.increments("id").primary();
    t.integer("employee_id").unsigned().notNullable().references("id").inTable("employees").onDelete("CASCADE");
    t.date("attendance_date").notNullable();
    t.integer("shift_pattern_id").unsigned().references("id").inTable("shift_patterns").onDelete("SET NULL").nullable();
    t.string("shift_type", 20).notNullable(); // SPLIT, MORNING, EVENING, NIGHT, GENERAL
    t.time("in_time_1").nullable();
    t.time("out_time_1").nullable();
    t.time("in_time_2").nullable();
    t.time("out_time_2").nullable();
    t.string("status", 20).notNullable().defaultTo("PRESENT"); // PRESENT, HALF_DAY, ABSENT, PAID_LEAVE, WEEK_OFF
    t.decimal("overtime_hours", 5, 2).notNullable().defaultTo(0);
    t.text("notes").nullable();
    t.integer("marked_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.timestamps(true, true);
    t.unique(["employee_id", "attendance_date"]);
    t.index(["attendance_date"], "idx_attendance_records_date");
    t.index(["shift_type"], "idx_attendance_records_shift_type");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("attendance_records");
};
