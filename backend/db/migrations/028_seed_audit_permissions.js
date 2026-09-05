exports.up = async (knex) => {
  const newPermissions = [
    { key: "audit.view", resource: "audit", action: "view", label: "View stock audits" },
    { key: "audit.create", resource: "audit", action: "create", label: "Create stock audits" },
    { key: "audit.enter_counts", resource: "audit", action: "enter_counts", label: "Enter stock audit counts" },
    { key: "audit.finalise", resource: "audit", action: "finalise", label: "Finalise stock audits" }
  ];

  for (const perm of newPermissions) {
    const existing = await knex("permissions").where("key", perm.key).first();
    if (!existing) {
      await knex("permissions").insert(perm);
    }
  }

  const roles = await knex("roles").select("id", "key");
  const permissions = await knex("permissions")
    .whereIn("key", ["audit.view", "audit.create", "audit.enter_counts", "audit.finalise"])
    .select("id", "key");

  const roleByKey = Object.fromEntries(roles.map((r) => [r.key, r.id]));
  const permByKey = Object.fromEntries(permissions.map((p) => [p.key, p.id]));

  const rolePermissions = [];

  // Admin role gets all audit permissions
  if (roleByKey["admin"]) {
    for (const key of ["audit.view", "audit.create", "audit.enter_counts", "audit.finalise"]) {
      if (permByKey[key]) {
        const existing = await knex("role_permissions")
          .where({ role_id: roleByKey["admin"], permission_id: permByKey[key] })
          .first();
        if (!existing) {
          rolePermissions.push({ role_id: roleByKey["admin"], permission_id: permByKey[key] });
        }
      }
    }
  }

  // Store Manager role gets view, create, and enter_counts
  if (roleByKey["store_manager"]) {
    for (const key of ["audit.view", "audit.create", "audit.enter_counts"]) {
      if (permByKey[key]) {
        const existing = await knex("role_permissions")
          .where({ role_id: roleByKey["store_manager"], permission_id: permByKey[key] })
          .first();
        if (!existing) {
          rolePermissions.push({ role_id: roleByKey["store_manager"], permission_id: permByKey[key] });
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
    .whereIn("key", ["audit.view", "audit.create", "audit.enter_counts", "audit.finalise"])
    .pluck("id");

  if (permIds.length > 0) {
    await knex("role_permissions").whereIn("permission_id", permIds).del();
    await knex("permissions").whereIn("id", permIds).del();
  }
};
