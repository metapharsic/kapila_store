exports.up = async function (knex) {
  const tables = ["stock", "indents", "issuances", "production", "leftovers", "purchase_orders", "goods_receipt_notes"];

  for (const table of tables) {
    const hasTable = await knex.schema.hasTable(table);
    if (hasTable) {
      const hasCreatedBy = await knex.schema.hasColumn(table, "created_by");
      const hasUpdatedBy = await knex.schema.hasColumn(table, "updated_by");

      await knex.schema.alterTable(table, (t) => {
        if (!hasCreatedBy) t.integer("created_by").references("id").inTable("users").onDelete("SET NULL");
        if (!hasUpdatedBy) t.integer("updated_by").references("id").inTable("users").onDelete("SET NULL");
      });
    }
  }
};

exports.down = async function (knex) {
  const tables = ["stock", "indents", "issuances", "production", "leftovers", "purchase_orders", "goods_receipt_notes"];

  for (const table of tables) {
    const hasTable = await knex.schema.hasTable(table);
    if (hasTable) {
      const hasCreatedBy = await knex.schema.hasColumn(table, "created_by");
      const hasUpdatedBy = await knex.schema.hasColumn(table, "updated_by");

      await knex.schema.alterTable(table, (t) => {
        if (hasCreatedBy) t.dropColumn("created_by");
        if (hasUpdatedBy) t.dropColumn("updated_by");
      });
    }
  }
};
