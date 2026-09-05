exports.up = (knex) =>
  knex.schema.alterTable("production", (t) => {
    t.string("item_name", 100).nullable();
  });

exports.down = (knex) =>
  knex.schema.alterTable("production", (t) => {
    t.dropColumn("item_name");
  });
