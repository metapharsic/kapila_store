/**
 * 068_create_inbound_dc_and_invoice_match.js
 * Migration for Inbound Delivery Challan (DC) and 3-Way Invoice Matching.
 * Adapted from MK Paper Mill ERP (inboundDc.js) for Hotel Kapila hospitality operations.
 *
 * Handles early-morning fresh produce, milk, meat, bread, and gas arriving with
 * Delivery Challans before tax invoice arrival. Supports provisional stock credits
 * and seamless week/month-end invoice reconciliation into confirmed GRNs.
 */

exports.up = async function (knex) {
  // 1. Create inbound_dcs table
  const hasInboundDcs = await knex.schema.hasTable("inbound_dcs");
  if (!hasInboundDcs) {
    await knex.schema.createTable("inbound_dcs", (table) => {
      table.bigIncrements("id").primary();
      table.string("dc_number", 60).notNullable().unique().index();
      table.integer("supplier_id").unsigned().nullable()
        .references("id").inTable("suppliers").onDelete("SET NULL");
      table.string("supplier_name", 150).notNullable();
      table.date("dc_date").notNullable().index();
      table.string("challan_no", 100).nullable().index();
      table.string("vehicle_number", 50).nullable();
      table.string("driver_name", 100).nullable();
      table.string("driver_phone", 50).nullable();
      table.string("status", 40).notNullable().defaultTo("RECEIVED").index(); // RECEIVED, INVOICE_MATCHED, GRN_COMPLETED, CANCELLED
      table.decimal("provisional_total_value", 12, 2).notNullable().defaultTo(0);
      table.decimal("matched_invoice_total", 12, 2).nullable();
      table.string("matched_invoice_no", 100).nullable().index();
      table.date("matched_invoice_date").nullable();
      table.bigInteger("converted_grn_id").unsigned().nullable()
        .references("id").inTable("goods_receipt_notes").onDelete("SET NULL");
      table.string("converted_grn_no", 50).nullable();
      table.text("remarks").nullable();
      table.string("received_by", 100).nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now()).index();
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    });
    console.log("[Migration 068] Created table 'inbound_dcs'.");
  }

  // 2. Create inbound_dc_items table
  const hasInboundDcItems = await knex.schema.hasTable("inbound_dc_items");
  if (!hasInboundDcItems) {
    await knex.schema.createTable("inbound_dc_items", (table) => {
      table.bigIncrements("id").primary();
      table.bigInteger("inbound_dc_id").unsigned().notNullable()
        .references("id").inTable("inbound_dcs").onDelete("CASCADE");
      table.bigInteger("stock_id").unsigned().nullable()
        .references("id").inTable("stock").onDelete("SET NULL");
      table.string("item_code", 50).notNullable().index();
      table.string("item_name", 150).notNullable();
      table.string("category", 80).nullable();
      table.decimal("qty", 10, 3).notNullable();
      table.string("unit", 30).notNullable();
      table.decimal("estimated_unit_price", 10, 2).notNullable().defaultTo(0);
      table.decimal("estimated_total_value", 12, 2).notNullable().defaultTo(0);
      table.string("batch_no", 80).nullable();
      table.date("expiry_date").nullable();
      table.string("storage_zone", 100).nullable().defaultTo("Central Store");
      
      // 3-Way Match verified line data
      table.decimal("matched_invoice_qty", 10, 3).nullable();
      table.decimal("matched_invoice_price", 10, 2).nullable();
      table.decimal("matched_invoice_total", 12, 2).nullable();
      table.string("match_status", 30).notNullable().defaultTo("PENDING"); // PENDING, MATCHED, DISCREPANCY

      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

      table.index(["inbound_dc_id"], "idx_inbound_dc_items_dc_id");
      table.index(["item_code"], "idx_inbound_dc_items_item_code");
    });
    console.log("[Migration 068] Created table 'inbound_dc_items'.");
  }

  // 3. Seed inbound_dc permissions
  const permissions = [
    { key: "inbound_dc.view", resource: "inbound_dc", action: "view", label: "View Inbound Delivery Challans" },
    { key: "inbound_dc.create", resource: "inbound_dc", action: "create", label: "Receive Goods via Inbound DC" },
    { key: "inbound_dc.match", resource: "inbound_dc", action: "match", label: "Perform 3-Way Invoice Match and GRN Conversion" },
    { key: "inbound_dc.cancel", resource: "inbound_dc", action: "cancel", label: "Cancel Inbound DC and Reverse Provisional Stock" }
  ];

  for (const p of permissions) {
    const existing = await knex("permissions").where("key", p.key).first();
    let permId = existing?.id;
    if (!existing) {
      const [newPerm] = await knex("permissions").insert(p).returning("*");
      permId = newPerm.id;
    }

    // Assign to admin and store_manager
    const adminRole = await knex("roles").where("name", "admin").first();
    if (adminRole && permId) {
      await knex("role_permissions").insert({ role_id: adminRole.id, permission_id: permId }).onConflict(["role_id", "permission_id"]).ignore();
    }
    const smRole = await knex("roles").where("name", "store_manager").first();
    if (smRole && permId) {
      await knex("role_permissions").insert({ role_id: smRole.id, permission_id: permId }).onConflict(["role_id", "permission_id"]).ignore();
    }
  }
  console.log("[Migration 068] Seeded Inbound DC permissions for admin and store_manager.");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("inbound_dc_items");
  await knex.schema.dropTableIfExists("inbound_dcs");
  await knex("permissions").whereIn("key", [
    "inbound_dc.view",
    "inbound_dc.create",
    "inbound_dc.match",
    "inbound_dc.cancel"
  ]).del();
};
