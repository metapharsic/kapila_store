exports.up = async (knex) => {
  await knex.raw("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_stock_name_trgm ON stock USING gin (LOWER(name) gin_trgm_ops)");

  await knex.schema.createTable("stock_aliases", (t) => {
    t.increments("id");
    t.string("alias", 200).notNullable();
    t.string("item_code", 50).notNullable();
    t.string("canonical_name", 200).notNullable();
    t.string("created_by", 100).notNullable().defaultTo("system");
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.unique(["alias"]);
    t.index(["item_code"]);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("stock_aliases");
  await knex.raw("DROP INDEX IF EXISTS idx_stock_name_trgm");
};
