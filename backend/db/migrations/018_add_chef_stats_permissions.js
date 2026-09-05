exports.up = async (knex) => {
  const newPermissions = [
    { key: "chef_stats.view", resource: "chef_stats", action: "view", label: "View chef statistics" },
    { key: "chef_stats.export", resource: "chef_stats", action: "export", label: "Export chef statistics" }
  ];

  for (const perm of newPermissions) {
    const existing = await knex("permissions").where("key", perm.key).first();
    if (!existing) {
      await knex("permissions").insert(perm);
    }
  }

  const roles = await knex("roles").select("id", "key");
  const permissions = await knex("permissions")
    .whereIn("key", ["chef_stats.view", "chef_stats.export"])
    .select("id", "key");

  const roleByKey = Object.fromEntries(roles.map((r) => [r.key, r.id]));
  const permByKey = Object.fromEntries(permissions.map((p) => [p.key, p.id]));

  const rolePermissions = [];

  const viewPermId = permByKey["chef_stats.view"];
  if (viewPermId) {
    for (const rKey of ["admin", "manager", "chef", "employee"]) {
      if (roleByKey[rKey]) {
        const existing = await knex("role_permissions")
          .where({ role_id: roleByKey[rKey], permission_id: viewPermId })
          .first();
        if (!existing) {
          rolePermissions.push({ role_id: roleByKey[rKey], permission_id: viewPermId });
        }
      }
    }
  }

  const exportPermId = permByKey["chef_stats.export"];
  if (exportPermId) {
    for (const rKey of ["admin", "manager"]) {
      if (roleByKey[rKey]) {
        const existing = await knex("role_permissions")
          .where({ role_id: roleByKey[rKey], permission_id: exportPermId })
          .first();
        if (!existing) {
          rolePermissions.push({ role_id: roleByKey[rKey], permission_id: exportPermId });
        }
      }
    }
  }

  if (rolePermissions.length > 0) {
    await knex("role_permissions").insert(rolePermissions);
  }
};

exports.down = async (knex) => {
  const permIds = await knex("permissions")
    .whereIn("key", ["chef_stats.view", "chef_stats.export"])
    .pluck("id");

  if (permIds.length > 0) {
    await knex("role_permissions").whereIn("permission_id", permIds).del();
    await knex("permissions").whereIn("id", permIds).del();
  }
};
