/**
 * Migration 066: Wire Store Manager Indent Approval Rule
 * Ensures the approval_rules table assigns module 'indents' to role 'store_manager',
 * allowing the Store Manager to review and approve kitchen requisitions.
 */
exports.up = async (knex) => {
  const smRole = await knex("roles").where("key", "store_manager").first();
  if (!smRole) {
    console.warn("[Migration 066] store_manager role not found, skipping.");
    return;
  }

  const existingRule = await knex("approval_rules")
    .where("module", "indents")
    .where("sequence", 1)
    .first();

  if (existingRule) {
    await knex("approval_rules")
      .where("id", existingRule.id)
      .update({
        role_id: smRole.id,
        min_amount: 0.00,
        max_amount: null,
        updated_at: knex.fn.now(),
      });
    console.log(`[Migration 066] Updated indents approval rule #${existingRule.id} to role_id=${smRole.id} (store_manager).`);
  } else {
    await knex("approval_rules").insert({
      module: "indents",
      min_amount: 0.00,
      max_amount: null,
      department_id: null,
      role_id: smRole.id,
      sequence: 1,
    });
    console.log(`[Migration 066] Inserted new indents approval rule for role_id=${smRole.id} (store_manager).`);
  }
};

exports.down = async (knex) => {
  const adminRole = await knex("roles").where("key", "admin").first();
  if (adminRole) {
    await knex("approval_rules")
      .where("module", "indents")
      .where("sequence", 1)
      .update({
        role_id: adminRole.id,
        updated_at: knex.fn.now(),
      });
  }
};
