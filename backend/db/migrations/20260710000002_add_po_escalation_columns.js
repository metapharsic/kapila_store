exports.up = async (knex) => {
  const hasSmCol = await knex.schema.hasColumn("purchase_orders", "sm_notified_at");
  if (!hasSmCol) {
    await knex.schema.alterTable("purchase_orders", (t) => {
      t.timestamp("sm_notified_at").nullable();
      t.timestamp("admin_notified_at").nullable();
    });
  }
};

exports.down = async (knex) => {
  const hasSmCol = await knex.schema.hasColumn("purchase_orders", "sm_notified_at");
  if (hasSmCol) {
    await knex.schema.alterTable("purchase_orders", (t) => {
      t.dropColumn("sm_notified_at");
      t.dropColumn("admin_notified_at");
    });
  }
};
