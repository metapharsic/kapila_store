// approval_rules had ZERO entry for module="indents" — every indent has been
// silently auto-approving with no human review since whatever wiped this rule
// (original migration 032 seeded it, but it's missing in this live DB).
// createApprovalRequest() falls back to instant auto-approve when no rule
// matches, which is exactly what was happening: 5/5 live indents sat at
// status='approved' with zero rows in approval_requests.
exports.up = async (knex) => {
  const storeManagerRole = await knex("roles").where({ key: "store_manager" }).first();
  if (!storeManagerRole) return;

  const exists = await knex("approval_rules").where({ module: "indents", sequence: 1 }).first();
  if (exists) return;

  await knex("approval_rules").insert({
    module: "indents",
    min_amount: 0.00,
    max_amount: null,
    department_id: null,
    role_id: storeManagerRole.id,
    sequence: 1,
  });
};

exports.down = (knex) =>
  knex("approval_rules").where({ module: "indents", sequence: 1 }).del();
