/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // We need to add "recipes.create" and "recipes.edit" to store_manager
  const roles = await knex("roles").select("id", "name");
  const storeManagerRole = roles.find((r) => r.name === "store_manager");

  if (storeManagerRole) {
    const permissions = await knex("permissions").whereIn("name", ["recipes.create", "recipes.edit"]).select("id");
    const rolePermissions = permissions.map((p) => ({
      role_id: storeManagerRole.id,
      permission_id: p.id,
    }));
    await knex("role_permissions").insert(rolePermissions).onConflict(["role_id", "permission_id"]).ignore();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const roles = await knex("roles").select("id", "name");
  const storeManagerRole = roles.find((r) => r.name === "store_manager");

  if (storeManagerRole) {
    const permissions = await knex("permissions").whereIn("name", ["recipes.create", "recipes.edit"]).select("id");
    if (permissions.length > 0) {
      const pIds = permissions.map((p) => p.id);
      await knex("role_permissions")
        .where("role_id", storeManagerRole.id)
        .whereIn("permission_id", pIds)
        .del();
    }
  }
};
