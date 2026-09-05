exports.up = async (knex) => {
  await knex.schema.createTable("supplier_rate_quotes", (t) => {
    t.increments("id").primary();
    t.string("item_code", 20).notNullable();
    t.string("item_name", 100).notNullable();
    t.string("unit", 20).notNullable();
    t.string("supplier_name", 100).notNullable();
    t.integer("supplier_id").references("id").inTable("suppliers").onDelete("SET NULL").nullable();
    t.decimal("quoted_rate", 10, 2).notNullable();
    t.text("notes").nullable();
    t.integer("quoted_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.timestamps(true, true);
    t.index(["item_code"], "idx_rate_quotes_item_code");
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("supplier_rate_quotes");
};
