/**
 * Migration 063: Create System Configuration & System Patches tables
 * Supports automated GitHub push/pull, version tracking, patch selection, and notifications.
 */
exports.up = async function (knex) {
  const hasConfigTable = await knex.schema.hasTable("system_configs");
  if (!hasConfigTable) {
    await knex.schema.createTable("system_configs", (table) => {
      table.increments("id").primary();
      table.string("config_key").unique().notNullable();
      table.text("config_value").nullable();
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });

    // Seed default configuration keys
    await knex("system_configs").insert([
      { config_key: "app_version", config_value: "v1.4.2" },
      { config_key: "git_auto_pull_enabled", config_value: "false" },
      { config_key: "git_branch", config_value: "main" },
      { config_key: "last_git_sync_at", config_value: null },
      { config_key: "auto_apply_patches", config_value: "false" },
    ]);
  }

  const hasPatchesTable = await knex.schema.hasTable("system_patches");
  if (!hasPatchesTable) {
    await knex.schema.createTable("system_patches", (table) => {
      table.increments("id").primary();
      table.string("commit_hash", 40).notNullable();
      table.text("commit_message").notNullable();
      table.string("author").nullable();
      table.string("commit_date").nullable();
      table.integer("files_changed_count").defaultTo(0);
      table.string("status", 20).defaultTo("PENDING"); // PENDING | APPLIED | SKIPPED
      table.timestamp("pulled_at").defaultTo(knex.fn.now());
      table.timestamp("applied_at").nullable();
      table.string("applied_by").nullable();
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("system_patches");
  await knex.schema.dropTableIfExists("system_configs");
};
