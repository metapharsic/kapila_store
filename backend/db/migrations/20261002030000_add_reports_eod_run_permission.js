exports.up = async function (knex) {
  await knex("permissions").insert({
    key: "reports.eod_run",
    resource: "reports",
    action: "eod_run",
    label: "Run End-of-Day Stock Report (WhatsApp + Excel)",
    description: "Allows triggering the real-time per-item end-of-day report, sent via WhatsApp digest and full Excel workbook",
  }).onConflict("key").ignore();

  const perm = await knex("permissions").where({ key: "reports.eod_run" }).first();

  const roles = await knex("roles").whereIn("key", ["admin", "manager"]);
  for (const role of roles) {
    await knex("role_permissions")
      .insert({ role_id: role.id, permission_id: perm.id })
      .onConflict(["role_id", "permission_id"]).ignore();
  }
};

exports.down = async function (knex) {
  const perm = await knex("permissions").where({ key: "reports.eod_run" }).first();
  if (perm) {
    await knex("role_permissions").where({ permission_id: perm.id }).del();
    await knex("permissions").where({ id: perm.id }).del();
  }
};
