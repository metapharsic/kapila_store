exports.up = async function (knex) {
  await knex("permissions").insert({
    key: "system.reset",
    resource: "system",
    action: "reset",
    label: "System Reset",
    description: "Allows truncating selected system data groups (admin only)",
  }).onConflict("key").ignore();

  const adminRole = await knex("roles").where({ key: "admin" }).first();
  if (adminRole) {
    const perm = await knex("permissions").where({ key: "system.reset" }).first();
    await knex("role_permissions")
      .insert({ role_id: adminRole.id, permission_id: perm.id })
      .onConflict(["role_id", "permission_id"]).ignore();
  }
};

exports.down = async function (knex) {
  const perm = await knex("permissions").where({ key: "system.reset" }).first();
  if (perm) {
    await knex("role_permissions").where({ permission_id: perm.id }).del();
    await knex("permissions").where({ id: perm.id }).del();
  }
};
