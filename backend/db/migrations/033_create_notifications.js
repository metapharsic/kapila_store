exports.up = async (knex) => {
  const hasTable = await knex.schema.hasTable("notifications");
  if (!hasTable) {
    await knex.schema.createTable("notifications", (t) => {
      t.increments("id").primary();
      t.integer("recipient_user_id").references("id").inTable("users").onDelete("CASCADE").nullable();
      t.integer("recipient_role_id").references("id").inTable("roles").onDelete("CASCADE").nullable();
      t.string("title", 150).notNullable();
      t.text("message").notNullable();
      t.string("type", 50).notNullable(); // "low_stock" | "expiry" | "anomaly" | "approval_pending" | "approval_action"
      t.string("severity", 20).notNullable().defaultTo("info"); // "info" | "warning" | "critical"
      t.boolean("is_read").notNullable().defaultTo(false);
      t.jsonb("metadata").nullable(); // e.g. { "po_id": 12, "indent_id": 4 }
      t.timestamps(true, true);
    });
  }
};

exports.down = (knex) => knex.schema.dropTableIfExists("notifications");
