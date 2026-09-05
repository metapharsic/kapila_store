// Store manager could create AND approve AND issue the same indent — no
// segregation of duties. Approval stays with Manager/Admin/Chef; store
// manager keeps view/create/edit/delete/export.
const REVOKED = ["indents.approve"];

exports.up = async (knex) => {
  const role = await knex("roles").where({ key: "store_manager" }).first();
  if (!role) return;
  const permissionIds = await knex("permissions").whereIn("key", REVOKED).pluck("id");
  if (permissionIds.length) {
    await knex("role_permissions")
      .where({ role_id: role.id })
      .whereIn("permission_id", permissionIds)
      .del();
  }
};

exports.down = async (knex) => {
  const role = await knex("roles").where({ key: "store_manager" }).first();
  if (!role) return;
  const permissionIds = await knex("permissions").whereIn("key", REVOKED).pluck("id");
  const rows = permissionIds.map((permission_id) => ({ role_id: role.id, permission_id }));
  if (rows.length) await knex("role_permissions").insert(rows);
};
