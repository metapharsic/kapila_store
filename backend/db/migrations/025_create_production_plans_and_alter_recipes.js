exports.up = async (knex) => {
  // Alter recipes table to add base_plates and instructions
  await knex.schema.alterTable("recipes", (t) => {
    t.integer("base_plates").notNullable().defaultTo(100);
    t.text("instructions").nullable();
  });

  // Create production_plans table
  await knex.schema.createTable("production_plans", (t) => {
    t.increments("id").primary();
    t.string("dept", 100).nullable(); // Added dept column for merging Menu Planner
    t.integer("recipe_id").references("id").inTable("recipes").onDelete("CASCADE").notNullable();
    t.integer("planned_plates").notNullable();
    t.integer("plates_sold").nullable();
    t.integer("plates_wasted").nullable();
    t.float("waste_percentage").nullable();
    t.text("waste_reason").nullable();
    t.date("planned_date").notNullable();
    t.string("status", 30).notNullable().defaultTo("Planned"); // "Planned", "Completed"
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // Create production_plan_items table (snapshot of scaled ingredients)
  await knex.schema.createTable("production_plan_items", (t) => {
    t.increments("id").primary();
    t.integer("production_plan_id").references("id").inTable("production_plans").onDelete("CASCADE").notNullable();
    t.string("item_name", 100).notNullable();
    t.float("planned_qty").notNullable();
    t.string("unit", 20).notNullable();
    t.float("wasted_qty").nullable(); // actual estimated waste quantity
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("production_plan_items");
  await knex.schema.dropTableIfExists("production_plans");
  await knex.schema.alterTable("recipes", (t) => {
    t.dropColumn("instructions");
    t.dropColumn("base_plates");
  });
};
