exports.up = async (knex) => {
  const hasCol = await knex.schema.hasColumn("indent_items", "issued_qty");
  if (!hasCol) {
    await knex.schema.table("indent_items", (t) => {
      t.decimal("issued_qty", 12, 3).notNullable().defaultTo(0);
    });
  }
};

exports.down = (knex) =>
  knex.schema.table("indent_items", (t) => {
    t.dropColumn("issued_qty");
  });
