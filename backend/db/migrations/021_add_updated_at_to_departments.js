exports.up = async function (knex) {
  // Add updated_at if not exists
  const hasCol = await knex.schema.hasColumn("departments", "updated_at");
  if (!hasCol) {
    await knex.schema.alterTable("departments", (t) => {
      t.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  const hasCol = await knex.schema.hasColumn("departments", "updated_at");
  if (hasCol) {
    await knex.schema.alterTable("departments", (t) => {
      t.dropColumn("updated_at");
    });
  }
};
