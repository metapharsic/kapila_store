/**
 * Migration 064: Enrich System Patches with detailed commit metadata, file lists, and functionality
 */
exports.up = async function (knex) {
  const hasPatchesTable = await knex.schema.hasTable("system_patches");
  if (hasPatchesTable) {
    const hasCommitNumber = await knex.schema.hasColumn("system_patches", "commit_number");
    if (!hasCommitNumber) {
      await knex.schema.alterTable("system_patches", (table) => {
        table.integer("commit_number").nullable();
        table.string("full_hash", 40).nullable();
        table.string("commit_timestamp").nullable();
        table.jsonb("files_list").nullable();
        table.jsonb("functionalities").nullable();
      });
    }
  }
};

exports.down = async function (knex) {
  const hasPatchesTable = await knex.schema.hasTable("system_patches");
  if (hasPatchesTable) {
    await knex.schema.alterTable("system_patches", (table) => {
      table.dropColumn("commit_number");
      table.dropColumn("full_hash");
      table.dropColumn("commit_timestamp");
      table.dropColumn("files_list");
      table.dropColumn("functionalities");
    });
  }
};
