/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Create shift_handoffs table
  await knex.schema.createTable("shift_handoffs", (t) => {
    t.increments("id").primary();
    t.date("shift_date").notNullable();
    t.string("shift_type", 50).notNullable(); // e.g. "Morning", "Evening"
    t.integer("user_id").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.text("note").notNullable();
    t.text("ai_summary").nullable();
    t.timestamps(true, true);
    t.unique(["shift_date", "shift_type"]);
  });

  // 2. Insert new permissions for handoffs
  const newPermissions = [
    { key: "handoffs.view", resource: "handoffs", action: "view", label: "View Shift Handoffs", description: "Allows viewing shift handoffs" },
    { key: "handoffs.create", resource: "handoffs", action: "create", label: "Create Shift Handoffs", description: "Allows submitting shift handoffs" }
  ];

  await knex("permissions").insert(newPermissions).onConflict("key").ignore();

  // 3. Grant permissions to store_manager role
  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  if (storeManagerRole) {
    const permissionIds = await knex("permissions")
      .whereIn("key", ["handoffs.view", "handoffs.create"])
      .pluck("id");

    const rolePerms = permissionIds.map((pId) => ({
      role_id: storeManagerRole.id,
      permission_id: pId
    }));

    await knex("role_permissions").insert(rolePerms).onConflict(["role_id", "permission_id"]).ignore();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop role permissions first
  const permissionIds = await knex("permissions")
    .whereIn("key", ["handoffs.view", "handoffs.create"])
    .pluck("id");

  if (permissionIds.length > 0) {
    await knex("role_permissions").whereIn("permission_id", permissionIds).del();
    await knex("permissions").whereIn("id", permissionIds).del();
  }

  await knex.schema.dropTableIfExists("shift_handoffs");
};
