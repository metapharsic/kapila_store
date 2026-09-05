exports.up = async function (knex) {
  await knex("permissions").insert({
    key: "indents.day_close",
    resource: "indents",
    action: "day_close",
    label: "Send Indent Day-Close WhatsApp Digest",
    description: "Allows sending the end-of-day WhatsApp digest of fully-issued indents",
  }).onConflict("key").ignore();

  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  if (storeManagerRole) {
    const perm = await knex("permissions").where({ key: "indents.day_close" }).first();
    await knex("role_permissions")
      .insert({ role_id: storeManagerRole.id, permission_id: perm.id })
      .onConflict(["role_id", "permission_id"]).ignore();
  }
};

exports.down = async function (knex) {
  const perm = await knex("permissions").where({ key: "indents.day_close" }).first();
  if (perm) {
    await knex("role_permissions").where({ permission_id: perm.id }).del();
    await knex("permissions").where({ id: perm.id }).del();
  }
};
