exports.up = (knex) =>
  knex.schema.alterTable("stock", (t) => {
    t.float("price").nullable();
    t.string("supplier", 100).nullable();
  });

exports.down = (knex) =>
  knex.schema.alterTable("stock", (t) => {
    t.dropColumn("price");
    t.dropColumn("supplier");
  });
