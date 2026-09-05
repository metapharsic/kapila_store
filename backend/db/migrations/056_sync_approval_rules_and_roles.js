exports.up = async (knex) => {
  // 1. Fetch relevant roles
  const smRole = await knex("roles").where("key", "store_manager").first();
  const managerRole = await knex("roles").where("key", "manager").first();
  const adminRole = await knex("roles").where("key", "admin").first();

  // 2. Missing operational permissions for store_manager
  const neededKeys = [
    "grn.create",
    "grn.scan",
    "reconciliation.view",
    "reconciliation.create",
    "transfers.view",
    "transfers.create",
    "reorder_points.create",
    "reorder_points.edit",
  ];

  if (smRole) {
    const perms = await knex("permissions").whereIn("key", neededKeys).select("id", "key");
    const existingPermIds = await knex("role_permissions")
      .where("role_id", smRole.id)
      .pluck("permission_id");

    const toInsert = perms
      .filter((p) => !existingPermIds.includes(p.id))
      .map((p) => ({ role_id: smRole.id, permission_id: p.id }));

    if (toInsert.length) {
      await knex("role_permissions").insert(toInsert);
    }
  }

  // 3. Clear and re-seed approval_rules with correct role assignments
  if (adminRole && (smRole || managerRole)) {
    const operationalApproverId = smRole ? smRole.id : managerRole.id;

    await knex("approval_rules").del();

    await knex("approval_rules").insert([
      // Purchase Orders: Low/Standard amounts up to 25k -> Store Manager, > 25k -> Admin
      { module: "purchase_orders", min_amount: 0.00, max_amount: 25000.00, role_id: operationalApproverId, sequence: 1 },
      { module: "purchase_orders", min_amount: 25000.01, max_amount: null, role_id: adminRole.id, sequence: 1 },

      // Indents: Department indent approval -> Admin (or Store Manager)
      { module: "indents", min_amount: 0.00, max_amount: null, role_id: adminRole.id, sequence: 1 },

      // Reconciliations / Discrepancy write-offs: <= 5k -> Store Manager, > 5k -> Admin
      { module: "reconciliations", min_amount: 0.00, max_amount: 5000.00, role_id: operationalApproverId, sequence: 1 },
      { module: "reconciliations", min_amount: 5000.01, max_amount: null, role_id: adminRole.id, sequence: 1 },

      // Transfers: Stock transfers between store and kitchen -> Store Manager
      { module: "transfers", min_amount: 0.00, max_amount: null, role_id: operationalApproverId, sequence: 1 },
    ]);
  }
};

exports.down = async (knex) => {
  // Revert approval rules
  await knex("approval_rules").del();
};
