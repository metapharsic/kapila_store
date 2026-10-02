exports.up = async function (knex) {
  await knex("permissions").insert({
    key: "reports.indent_intelligence_run",
    resource: "reports",
    action: "indent_intelligence_run",
    label: "Run Indent & Purchase Intelligence Report (WhatsApp + Excel)",
    description: "Allows triggering the daily indent/purchase/GRN/anomaly/approval-time intelligence report, sent via WhatsApp digest and full Excel workbook",
  }).onConflict("key").ignore();

  const perm = await knex("permissions").where({ key: "reports.indent_intelligence_run" }).first();

  const roles = await knex("roles").whereIn("key", ["admin", "manager", "store_manager"]);
  for (const role of roles) {
    await knex("role_permissions")
      .insert({ role_id: role.id, permission_id: perm.id })
      .onConflict(["role_id", "permission_id"]).ignore();
  }
};

exports.down = async function (knex) {
  const perm = await knex("permissions").where({ key: "reports.indent_intelligence_run" }).first();
  if (perm) {
    await knex("role_permissions").where({ permission_id: perm.id }).del();
    await knex("permissions").where({ id: perm.id }).del();
  }
};
