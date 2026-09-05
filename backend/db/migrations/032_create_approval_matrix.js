exports.up = async (knex) => {
  // 1. Create approval_rules table
  const hasRules = await knex.schema.hasTable("approval_rules");
  if (!hasRules) {
    await knex.schema.createTable("approval_rules", (t) => {
      t.increments("id").primary();
      t.string("module", 50).notNullable(); // "purchase_orders" | "indents" | "transfers" | "reconciliations"
      t.decimal("min_amount", 10, 2).notNullable().defaultTo(0.00);
      t.decimal("max_amount", 10, 2).nullable();
      t.integer("department_id").references("id").inTable("departments").onDelete("CASCADE").nullable();
      t.integer("role_id").references("id").inTable("roles").onDelete("CASCADE").notNullable();
      t.integer("sequence").notNullable().defaultTo(1);
      t.timestamps(true, true);
    });
  }

  // 2. Create approval_requests table
  const hasRequests = await knex.schema.hasTable("approval_requests");
  if (!hasRequests) {
    await knex.schema.createTable("approval_requests", (t) => {
      t.increments("id").primary();
      t.string("module", 50).notNullable();
      t.integer("resource_id").notNullable();
      t.string("status", 20).notNullable().defaultTo("pending"); // "pending" | "approved" | "rejected"
      t.integer("current_sequence").notNullable().defaultTo(1);
      t.integer("created_by").references("id").inTable("users").onDelete("SET NULL").nullable();
      t.integer("approved_by").references("id").inTable("users").onDelete("SET NULL").nullable();
      t.integer("rejected_by").references("id").inTable("users").onDelete("SET NULL").nullable();
      t.text("notes").nullable();
      t.timestamps(true, true);
    });
  }

  // 3. Seed some default rules based on roles (if they exist)
  const managerRole = await knex("roles").where("key", "store_manager").first();
  const adminRole = await knex("roles").where("key", "admin").first();
  
  if (managerRole && adminRole) {
    await knex("approval_rules").insert([
      // PO Rules
      { module: "purchase_orders", min_amount: 0.00, max_amount: 25000.00, role_id: managerRole.id, sequence: 1 },
      { module: "purchase_orders", min_amount: 25000.01, max_amount: null, role_id: adminRole.id, sequence: 1 },
      
      // Indent Rules (Managers approve indents)
      { module: "indents", min_amount: 0.00, max_amount: null, role_id: managerRole.id, sequence: 1 },

      // Reconciliation Rules
      { module: "reconciliations", min_amount: 0.00, max_amount: 5000.00, role_id: managerRole.id, sequence: 1 },
      { module: "reconciliations", min_amount: 5000.01, max_amount: null, role_id: adminRole.id, sequence: 1 }
    ]);
  }
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("approval_requests");
  await knex.schema.dropTableIfExists("approval_rules");
};
