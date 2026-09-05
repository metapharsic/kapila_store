exports.up = async (knex) => {
  const hasReturns = await knex.schema.hasTable("returns");
  if (!hasReturns) {
    await knex.schema.createTable("returns", (t) => {
      t.increments("id").primary();
      t.string("return_number", 60).unique().notNullable();
      t.date("date").notNullable();
      t.string("department", 100).notNullable();
      t.string("status", 40).notNullable().defaultTo("Pending");
      t.string("remarks", 255).nullable();
      t.string("initiated_by", 100).nullable();
      t.timestamps(true, true);
    });
  }

  const hasReturnItems = await knex.schema.hasTable("return_items");
  if (!hasReturnItems) {
    await knex.schema.createTable("return_items", (t) => {
      t.increments("id").primary();
      t.integer("return_id").references("id").inTable("returns").onDelete("CASCADE").notNullable();
      t.string("item_code", 50).nullable();
      t.string("name", 120).notNullable();
      t.float("qty").notNullable();
      t.string("unit", 30).notNullable();
    });
  }

  const hasBudgetCol = await knex.schema.hasColumn("departments", "monthly_budget_cap");
  if (!hasBudgetCol) {
    await knex.schema.alterTable("departments", (t) => {
      t.float("monthly_budget_cap").notNullable().defaultTo(50000.0);
    });
  }
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("return_items");
  await knex.schema.dropTableIfExists("returns");
  const hasBudgetCol = await knex.schema.hasColumn("departments", "monthly_budget_cap");
  if (hasBudgetCol) {
    await knex.schema.alterTable("departments", (t) => {
      t.dropColumn("monthly_budget_cap");
    });
  }
};
