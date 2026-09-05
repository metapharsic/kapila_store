const bcrypt = require("bcryptjs");
const { PERMISSIONS, ROLE_PERMISSION_KEYS } = require("../../config/permissions");

exports.up = async (knex) => {
  await knex.schema.createTable("users", (t) => {
    t.increments("id").primary();
    t.string("employee_code", 50).unique().nullable();
    t.string("name", 120).notNullable();
    t.string("email", 160).unique().notNullable();
    t.string("phone", 30).nullable();
    t.string("password_hash", 255).notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.boolean("must_change_password").notNullable().defaultTo(true);
    t.timestamp("last_login_at").nullable();
    t.timestamp("password_changed_at").nullable();
    t.integer("created_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.integer("updated_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.timestamps(true, true);
    t.index(["email"], "idx_users_email");
    t.index(["is_active"], "idx_users_active");
  });

  await knex.schema.createTable("roles", (t) => {
    t.increments("id").primary();
    t.string("key", 60).unique().notNullable();
    t.string("name", 100).notNullable();
    t.text("description").nullable();
    t.boolean("is_system").notNullable().defaultTo(false);
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable("permissions", (t) => {
    t.increments("id").primary();
    t.string("key", 100).unique().notNullable();
    t.string("resource", 80).notNullable();
    t.string("action", 40).notNullable();
    t.string("label", 120).notNullable();
    t.text("description").nullable();
    t.timestamps(true, true);
    t.index(["resource", "action"], "idx_permissions_resource_action");
  });

  await knex.schema.createTable("role_permissions", (t) => {
    t.increments("id").primary();
    t.integer("role_id").references("id").inTable("roles").onDelete("CASCADE").notNullable();
    t.integer("permission_id").references("id").inTable("permissions").onDelete("CASCADE").notNullable();
    t.unique(["role_id", "permission_id"]);
  });

  await knex.schema.createTable("user_roles", (t) => {
    t.increments("id").primary();
    t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
    t.integer("role_id").references("id").inTable("roles").onDelete("RESTRICT").notNullable();
    t.unique(["user_id", "role_id"]);
  });

  await knex.schema.createTable("user_departments", (t) => {
    t.increments("id").primary();
    t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
    t.integer("department_id").references("id").inTable("departments").onDelete("CASCADE").notNullable();
    t.unique(["user_id", "department_id"]);
  });

  await knex.schema.createTable("refresh_tokens", (t) => {
    t.increments("id").primary();
    t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
    t.string("token_hash", 255).unique().notNullable();
    t.timestamp("expires_at").notNullable();
    t.timestamp("revoked_at").nullable();
    t.string("created_ip", 80).nullable();
    t.string("user_agent", 500).nullable();
    t.timestamps(true, true);
    t.index(["user_id"], "idx_refresh_tokens_user");
    t.index(["expires_at"], "idx_refresh_tokens_expiry");
  });

  await knex.schema.createTable("password_reset_tokens", (t) => {
    t.increments("id").primary();
    t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
    t.string("token_hash", 255).unique().notNullable();
    t.timestamp("expires_at").notNullable();
    t.timestamp("used_at").nullable();
    t.integer("created_by").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable("audit_logs", (t) => {
    t.increments("id").primary();
    t.integer("actor_user_id").references("id").inTable("users").onDelete("SET NULL").nullable();
    t.string("actor_name", 120).nullable();
    t.string("action", 80).notNullable();
    t.string("resource", 80).notNullable();
    t.string("resource_id", 80).nullable();
    t.integer("department_id").references("id").inTable("departments").onDelete("SET NULL").nullable();
    t.string("department_name", 120).nullable();
    t.jsonb("before").nullable();
    t.jsonb("after").nullable();
    t.jsonb("metadata").nullable();
    t.string("ip_address", 80).nullable();
    t.string("user_agent", 500).nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["actor_user_id"], "idx_audit_actor");
    t.index(["resource", "resource_id"], "idx_audit_resource");
    t.index(["action"], "idx_audit_action");
    t.index(["created_at"], "idx_audit_created");
  });

  await knex("permissions").insert(PERMISSIONS.map((p) => ({
    key: p.key,
    resource: p.resource,
    action: p.action,
    label: p.label,
    description: p.description || null,
  })));

  const roles = [
    { key: "admin", name: "Admin", description: "Full system access", is_system: true },
    { key: "manager", name: "Manager", description: "Operational and reporting access", is_system: true },
    { key: "chef", name: "Chef", description: "Kitchen workflow access", is_system: true },
    { key: "employee", name: "Employee", description: "Daily task access", is_system: true },
  ];
  await knex("roles").insert(roles);

  const roleRows = await knex("roles");
  const permissionRows = await knex("permissions");
  const roleByKey = Object.fromEntries(roleRows.map((r) => [r.key, r]));
  const permissionByKey = Object.fromEntries(permissionRows.map((p) => [p.key, p]));
  const rolePermissionRows = [];

  for (const [roleKey, permissionKeys] of Object.entries(ROLE_PERMISSION_KEYS)) {
    for (const permissionKey of permissionKeys) {
      if (roleByKey[roleKey] && permissionByKey[permissionKey]) {
        rolePermissionRows.push({
          role_id: roleByKey[roleKey].id,
          permission_id: permissionByKey[permissionKey].id,
        });
      }
    }
  }
  await knex("role_permissions").insert(rolePermissionRows);

  const adminEmail = process.env.ADMIN_EMAIL || "admin@kapila.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const [admin] = await knex("users").insert({
    employee_code: "KPL-ADMIN",
    name: "Kapila Admin",
    email: adminEmail,
    password_hash: passwordHash,
    is_active: true,
    must_change_password: !process.env.ADMIN_PASSWORD,
  }).returning("*");

  await knex("user_roles").insert({ user_id: admin.id, role_id: roleByKey.admin.id });
};

exports.down = async (knex) => {
  await knex.schema
    .dropTableIfExists("audit_logs")
    .dropTableIfExists("password_reset_tokens")
    .dropTableIfExists("refresh_tokens")
    .dropTableIfExists("user_departments")
    .dropTableIfExists("user_roles")
    .dropTableIfExists("role_permissions")
    .dropTableIfExists("permissions")
    .dropTableIfExists("roles")
    .dropTableIfExists("users");
};
