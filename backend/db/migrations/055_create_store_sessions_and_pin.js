const bcrypt = require("bcryptjs");

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Add pin_hash to users table if not exists
  const hasPinHash = await knex.schema.hasColumn("users", "pin_hash");
  if (!hasPinHash) {
    await knex.schema.alterTable("users", (t) => {
      t.string("pin_hash", 255).nullable();
    });
  }

  // 2. Create store_sessions table
  const hasStoreSessions = await knex.schema.hasTable("store_sessions");
  if (!hasStoreSessions) {
    await knex.schema.createTable("store_sessions", (t) => {
      t.increments("id").primary();
      t.integer("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
      t.string("terminal_code", 80).defaultTo("STORE-MAIN-TAB-01");
      t.string("shift_type", 50).defaultTo("Morning"); // Morning, Evening, Night
      t.string("status", 40).notNullable().defaultTo("ACTIVE"); // ACTIVE, IDLE, CLOSED, TERMINATED_BY_ADMIN
      t.string("ip_address", 80).nullable();
      t.string("user_agent", 500).nullable();
      t.timestamp("login_at").notNullable().defaultTo(knex.fn.now());
      t.timestamp("last_ping_at").notNullable().defaultTo(knex.fn.now());
      t.timestamp("logout_at").nullable();
      t.integer("terminated_by").references("id").inTable("users").onDelete("SET NULL").nullable();
      t.text("terminated_reason").nullable();
      t.timestamps(true, true);

      t.index(["user_id"], "idx_store_sessions_user");
      t.index(["status"], "idx_store_sessions_status");
      t.index(["last_ping_at"], "idx_store_sessions_ping");
    });
  }

  // 3. Seed default PIN "1234" for store and chef accounts if pin_hash is empty
  const defaultPinHash = await bcrypt.hash("1234", 10);
  await knex("users")
    .whereNull("pin_hash")
    .andWhere((qb) => {
      qb.whereILike("email", "%store%")
        .orWhereILike("email", "%chef%")
        .orWhereILike("employee_code", "%STORE%")
        .orWhereILike("employee_code", "%CHEF%");
    })
    .update({ pin_hash: defaultPinHash });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("store_sessions");
  const hasPinHash = await knex.schema.hasColumn("users", "pin_hash");
  if (hasPinHash) {
    await knex.schema.alterTable("users", (t) => {
      t.dropColumn("pin_hash");
    });
  }
};
