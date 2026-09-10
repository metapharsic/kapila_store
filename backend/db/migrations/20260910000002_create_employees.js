/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("employees", (t) => {
    t.increments("id").primary();
    t.string("emp_code", 30).unique().notNullable();
    t.string("first_name", 80).notNullable();
    t.string("last_name", 80).nullable();
    t.string("department", 60).notNullable();
    t.string("designation", 80).nullable();
    t.string("phone", 30).nullable();
    t.string("email", 160).nullable();
    t.string("aadhaar_last4", 4).nullable();
    t.date("joining_date").notNullable();
    t.string("salary_type", 20).notNullable().defaultTo("MONTHLY"); // MONTHLY, DAILY_WAGE
    t.decimal("basic_salary", 12, 2).nullable();
    t.decimal("daily_wage", 12, 2).nullable();
    t.string("emergency_contact", 60).nullable();
    t.text("notes").nullable();
    t.string("status", 20).notNullable().defaultTo("ACTIVE"); // ACTIVE, INACTIVE
    t.integer("default_shift_pattern_id").unsigned().references("id").inTable("shift_patterns").onDelete("SET NULL").nullable();
    t.integer("created_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.timestamps(true, true);
    t.index(["department"], "idx_employees_department");
    t.index(["status"], "idx_employees_status");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("employees");
};
