exports.up = async (knex) => {
  const hasPlanId = await knex.schema.hasColumn("issuances", "production_plan_id");
  if (!hasPlanId) {
    await knex.schema.alterTable("issuances", (t) => {
      t.integer("production_plan_id").references("id").inTable("production_plans").onDelete("SET NULL").nullable();
    });
  }
};

exports.down = async (knex) => {
  const hasPlanId = await knex.schema.hasColumn("issuances", "production_plan_id");
  if (hasPlanId) {
    await knex.schema.alterTable("issuances", (t) => {
      t.dropColumn("production_plan_id");
    });
  }
};
