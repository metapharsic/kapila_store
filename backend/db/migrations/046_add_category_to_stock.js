exports.up = async (knex) => {
  await knex.schema.alterTable("stock", (t) => {
    t.string("category", 60).nullable();
    t.index(["category"], "idx_stock_category");
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("stock", (t) => {
    t.dropIndex(["category"], "idx_stock_category");
    t.dropColumn("category");
  });
};
