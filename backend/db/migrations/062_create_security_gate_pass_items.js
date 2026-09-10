/**
 * 062_create_security_gate_pass_items.js
 * Migration to create structured line items for Security Gate Passes,
 * supporting item addition, append, delete, itemized viewing, and printing.
 */

exports.up = async function (knex) {
  // 1. Create security_gate_pass_items table
  const hasTable = await knex.schema.hasTable("security_gate_pass_items");
  if (!hasTable) {
    await knex.schema.createTable("security_gate_pass_items", (table) => {
      table.bigIncrements("id").primary();
      table.bigInteger("gate_pass_id").unsigned().notNullable()
        .references("id").inTable("security_gate_passes").onDelete("CASCADE");
      table.string("item_name", 150).notNullable();
      table.float("qty").notNullable().defaultTo(1);
      table.string("unit", 30).notNullable().defaultTo("units");
      table.string("package_type", 80).nullable(); // Crates, Sacks/Bags, Boxes/Cartons, Cans, Drums, Bundles, Loose
      table.string("remarks", 255).nullable();
      table.boolean("is_returnable").notNullable().defaultTo(false);
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table.index(["gate_pass_id"], "idx_gate_pass_items_pass_id");
      table.index(["item_name"], "idx_gate_pass_items_name");
    });
    console.log("[Migration 062] Created table 'security_gate_pass_items'.");
  }

  // 2. Ensure security.delete permission exists
  const hasDeletePerm = await knex("permissions").where("key", "security.delete").first();
  if (!hasDeletePerm) {
    const [perm] = await knex("permissions").insert({
      key: "security.delete",
      resource: "security",
      action: "delete",
      label: "Delete Security Gate Pass & Line Items"
    }).returning("*");

    // Assign to admin role
    const adminRole = await knex("roles").where("name", "admin").first();
    if (adminRole && perm) {
      await knex("role_permissions").insert({
        role_id: adminRole.id,
        permission_id: perm.id
      }).onConflict(["role_id", "permission_id"]).ignore();
    }

    // Assign to store_manager role
    const smRole = await knex("roles").where("name", "store_manager").first();
    if (smRole && perm) {
      await knex("role_permissions").insert({
        role_id: smRole.id,
        permission_id: perm.id
      }).onConflict(["role_id", "permission_id"]).ignore();
    }
    console.log("[Migration 062] Seeded 'security.delete' permission.");
  }

  // 3. Seed initial sample items for existing passes if empty
  const countItems = await knex("security_gate_pass_items").count("id as count").first();
  if (parseInt(countItems.count, 10) === 0) {
    const passes = await knex("security_gate_passes").select("id", "pass_number", "pass_type", "material_description").limit(20);
    const sampleItems = [];

    for (const p of passes) {
      if (p.pass_type === "INWARD_MATERIAL") {
        sampleItems.push(
          { gate_pass_id: p.id, item_name: "Fresh Tomatoes (Grade A)", qty: 15, unit: "crates", package_type: "Plastic Crates", remarks: "Kitchen supply", is_returnable: false },
          { gate_pass_id: p.id, item_name: "Red Onions", qty: 5, unit: "bags", package_type: "Jute Sacks", remarks: "50kg each", is_returnable: false },
          { gate_pass_id: p.id, item_name: "Potatoes", qty: 4, unit: "bags", package_type: "Jute Sacks", remarks: "40kg each", is_returnable: false }
        );
      } else if (p.pass_type === "RGP_RETURNABLE") {
        sampleItems.push(
          { gate_pass_id: p.id, item_name: "47.5kg Commercial LPG Cylinders (Empty Refill)", qty: 12, unit: "cylinders", package_type: "HP Gas Cylinders", remarks: "Returnable delivery", is_returnable: true }
        );
      } else {
        sampleItems.push(
          { gate_pass_id: p.id, item_name: p.material_description || "General Materials", qty: 1, unit: "lot", package_type: "Packages", remarks: "Inspected at gate", is_returnable: false }
        );
      }
    }

    if (sampleItems.length > 0) {
      await knex("security_gate_pass_items").insert(sampleItems);
      console.log(`[Migration 062] Seeded ${sampleItems.length} initial gate pass items.`);
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("security_gate_pass_items");
  const perm = await knex("permissions").where("key", "security.delete").first();
  if (perm) {
    await knex("role_permissions").where("permission_id", perm.id).del();
    await knex("permissions").where("id", perm.id).del();
  }
};
