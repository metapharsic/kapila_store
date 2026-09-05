exports.up = async (knex) => {
  const hasCol = await knex.schema.hasColumn("indents", "indent_type");
  if (!hasCol) {
    await knex.schema.table("indents", (t) => {
      t.string("indent_type", 10).notNullable().defaultTo("routine");
    });
    // Back-fill existing rows
    await knex("indents").whereNull("indent_type").update({ indent_type: "routine" });
  }
};

exports.down = (knex) =>
  knex.schema.table("indents", (t) => {
    t.dropColumn("indent_type");
  });
