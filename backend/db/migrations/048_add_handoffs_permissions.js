/**
 * handoffs.view / handoffs.create referenced by routes/handoffRoutes.js and
 * requirePermission() middleware, but never seeded into `permissions` — the
 * shift-handoff endpoint (with its AI summary) was unreachable by every role,
 * including Admin. This seeds the permission rows and grants them to Admin
 * and Store Manager.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const perms = [
    { key: "handoffs.view", resource: "handoffs", action: "view", label: "View Shift Handoffs" },
    { key: "handoffs.create", resource: "handoffs", action: "create", label: "Create Shift Handoffs" },
  ];

  await knex("permissions").insert(perms).onConflict("key").ignore();

  const insertedPerms = await knex("permissions").whereIn("key", ["handoffs.view", "handoffs.create"]).select("id");
  const roles = await knex("roles").whereIn("name", ["Admin", "Store Manager"]).select("id");

  const rolePermissions = [];
  roles.forEach((r) => {
    insertedPerms.forEach((p) => {
      rolePermissions.push({ role_id: r.id, permission_id: p.id });
    });
  });

  if (rolePermissions.length) {
    await knex("role_permissions").insert(rolePermissions).onConflict(["role_id", "permission_id"]).ignore();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const perms = await knex("permissions").whereIn("key", ["handoffs.view", "handoffs.create"]).select("id");
  const permIds = perms.map((p) => p.id);
  if (permIds.length) {
    await knex("role_permissions").whereIn("permission_id", permIds).del();
    await knex("permissions").whereIn("id", permIds).del();
  }
};
