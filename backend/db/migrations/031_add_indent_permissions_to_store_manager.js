const INDENT_PERMISSIONS = [
  "indents.view",
  "indents.create",
  "indents.edit",
  "indents.delete",
  "indents.approve",
  "indents.export",
];

exports.up = async (knex) => {
  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  if (!storeManagerRole) return;

  const permissionIds = await knex("permissions")
    .whereIn("key", INDENT_PERMISSIONS)
    .pluck("id");

  const existing = await knex("role_permissions")
    .where({ role_id: storeManagerRole.id })
    .whereIn("permission_id", permissionIds)
    .pluck("permission_id");
  const existingSet = new Set(existing.map(Number));

  const rows = permissionIds
    .map(Number)
    .filter((id) => !existingSet.has(id))
    .map((permission_id) => ({ role_id: storeManagerRole.id, permission_id }));

  if (rows.length) {
    await knex("role_permissions").insert(rows);
  }
};

exports.down = async (knex) => {
  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  if (!storeManagerRole) return;

  const permissionIds = await knex("permissions")
    .whereIn("key", INDENT_PERMISSIONS)
    .pluck("id");

  await knex("role_permissions")
    .where({ role_id: storeManagerRole.id })
    .whereIn("permission_id", permissionIds)
    .del();
};
