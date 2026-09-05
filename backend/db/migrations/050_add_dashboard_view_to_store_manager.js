/**
 * StoreManagerHome.jsx calls /api/dashboard/store-home, /morning-briefing,
 * /adhoc-summary — all gated on dashboard.view — but Store Manager never had
 * that permission, so every dashboard widget 403'd (KPI counters, AI
 * briefing, adhoc summary). Same class of bug as the handoffs permission gap.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const perm = await knex("permissions").where("key", "dashboard.view").first();
  const role = await knex("roles").where("name", "Store Manager").first();
  if (perm && role) {
    await knex("role_permissions").insert({ role_id: role.id, permission_id: perm.id }).onConflict(["role_id", "permission_id"]).ignore();
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const perm = await knex("permissions").where("key", "dashboard.view").first();
  const role = await knex("roles").where("name", "Store Manager").first();
  if (perm && role) {
    await knex("role_permissions").where({ role_id: role.id, permission_id: perm.id }).del();
  }
};
