exports.up = async (knex) => {
  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  const recipesViewPerm = await knex("permissions").where({ key: "recipes.view" }).first();

  if (storeManagerRole && recipesViewPerm) {
    const existing = await knex("role_permissions")
      .where({ role_id: storeManagerRole.id, permission_id: recipesViewPerm.id })
      .first();

    if (!existing) {
      await knex("role_permissions").insert({
        role_id: storeManagerRole.id,
        permission_id: recipesViewPerm.id,
      });
    }
  }
};

exports.down = async (knex) => {
  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  const recipesViewPerm = await knex("permissions").where({ key: "recipes.view" }).first();

  if (storeManagerRole && recipesViewPerm) {
    await knex("role_permissions")
      .where({ role_id: storeManagerRole.id, permission_id: recipesViewPerm.id })
      .del();
  }
};
