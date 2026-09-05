exports.up = async (knex) => {
  const hasRating = await knex.schema.hasColumn("suppliers", "rating");
  if (!hasRating) {
    await knex.schema.alterTable("suppliers", (t) => {
      t.float("rating").notNullable().defaultTo(5.0); // rating 1.0 to 5.0
    });
  }
};

exports.down = async (knex) => {
  const hasRating = await knex.schema.hasColumn("suppliers", "rating");
  if (hasRating) {
    await knex.schema.alterTable("suppliers", (t) => {
      t.dropColumn("rating");
    });
  }
};
