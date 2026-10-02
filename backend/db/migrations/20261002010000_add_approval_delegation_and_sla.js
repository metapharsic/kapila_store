exports.up = async (knex) => {
  await knex.schema.alterTable("approval_requests", (t) => {
    t.integer("delegated_to").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.integer("delegated_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.timestamp("delegated_at").nullable();
    t.boolean("sla_breached").notNullable().defaultTo(false);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("approval_requests", (t) => {
    t.dropColumn("delegated_to");
    t.dropColumn("delegated_by");
    t.dropColumn("delegated_at");
    t.dropColumn("sla_breached");
  });
};
