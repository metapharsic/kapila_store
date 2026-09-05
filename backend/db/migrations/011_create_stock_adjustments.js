exports.up = (knex) =>
  knex.schema.createTable("stock_adjustments", (t) => {
    t.increments("id").primary();
    t.integer("stock_id").references("id").inTable("stock").onDelete("CASCADE").notNullable();
    t.float("qty").notNullable(); // positive or negative adjustment
    t.string("reason").notNullable(); // "Audit Correction", "Spoiled / Spilled", "Pest Damage", "Kitchen Theft"
    t.date("date").notNullable();
    t.string("notes").nullable();
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTable("stock_adjustments");
