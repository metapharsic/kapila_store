/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("night_audits", (t) => {
    t.increments("id").primary();
    t.date("audit_date").unique().notNullable();
    t.integer("performed_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.decimal("total_material_issued_cost", 14, 2).notNullable().defaultTo(0);
    t.decimal("total_food_waste_cost", 14, 2).notNullable().defaultTo(0);
    t.decimal("total_kitchen_direct_cost", 14, 2).notNullable().defaultTo(0);
    t.decimal("total_food_revenue", 14, 2).notNullable().defaultTo(0);
    t.decimal("food_cost_percentage", 6, 2).notNullable().defaultTo(0);
    t.decimal("target_food_cost_pct", 6, 2).notNullable().defaultTo(32.0);
    t.decimal("variance_pct", 6, 2).notNullable().defaultTo(0);
    t.jsonb("department_breakdown").nullable();
    t.jsonb("discrepancies_flagged").nullable();
    t.string("audit_status", 20).notNullable().defaultTo("DRAFT"); // DRAFT, SUBMITTED, REVIEWED
    t.text("rollover_notes").nullable();
    t.timestamp("submitted_at").nullable();
    t.integer("reviewed_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.text("review_notes").nullable();
    t.timestamp("reviewed_at").nullable();
    t.timestamps(true, true);
    t.index(["audit_status"], "idx_night_audits_status");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("night_audits");
};
