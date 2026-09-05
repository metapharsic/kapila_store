const REMOVED_STORE_MANAGER_PERMISSIONS = [
  "departments.view",
  "indents.view",
  "indents.approve",
];

exports.up = async (knex) => {
  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  if (!storeManagerRole) return;

  const permissionIds = await knex("permissions")
    .whereIn("key", REMOVED_STORE_MANAGER_PERMISSIONS)
    .pluck("id");

  if (permissionIds.length) {
    await knex("role_permissions")
      .where({ role_id: storeManagerRole.id })
      .whereIn("permission_id", permissionIds)
      .del();
  }
};

exports.down = async (knex) => {
  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  if (!storeManagerRole) return;

  const permissionIds = await knex("permissions")
    .whereIn("key", REMOVED_STORE_MANAGER_PERMISSIONS)
    .pluck("id");

  const existingIds = await knex("role_permissions")
    .where({ role_id: storeManagerRole.id })
    .whereIn("permission_id", permissionIds)
    .pluck("permission_id");
  const existingIdSet = new Set(existingIds.map(Number));

  const missingRows = permissionIds
    .map(Number)
    .filter((permissionId) => !existingIdSet.has(permissionId))
    .map((permissionId) => ({
      role_id: storeManagerRole.id,
      permission_id: permissionId,
    }));

  if (missingRows.length) {
    await knex("role_permissions").insert(missingRows);
  }
};
