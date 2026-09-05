exports.up = (knex) =>
  knex.schema
    .alterTable("indent_items", (t) => {
      t.string("unit", 20).notNullable().defaultTo("kg");
    })
    .alterTable("issuance_items", (t) => {
      t.string("unit", 20).notNullable().defaultTo("kg");
    });

exports.down = (knex) =>
  knex.schema
    .alterTable("indent_items", (t) => {
      t.dropColumn("unit");
    })
    .alterTable("issuance_items", (t) => {
      t.dropColumn("unit");
    });
