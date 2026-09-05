exports.up = (knex) =>
  knex.schema
    .createTable("suppliers", (t) => {
      t.increments("id").primary();
      t.string("name", 100).unique().notNullable();
      t.string("contact_name", 100).nullable();
      t.string("phone", 20).nullable();
      t.string("email", 100).nullable();
      t.string("gstin", 20).nullable();
      t.text("address").nullable();
      t.timestamps(true, true);
    })
    .createTable("purchase_orders", (t) => {
      t.increments("id").primary();
      t.string("po_number", 50).unique().notNullable();
      t.integer("supplier_id").references("id").inTable("suppliers").onDelete("RESTRICT").notNullable();
      t.date("date").notNullable();
      t.string("status", 20).notNullable().defaultTo("Draft"); // Draft, Sent, Received, Cancelled
      t.float("total_amount").notNullable().defaultTo(0);
      t.text("notes").nullable();
      t.timestamps(true, true);
    })
    .createTable("purchase_order_items", (t) => {
      t.increments("id").primary();
      t.integer("po_id").references("id").inTable("purchase_orders").onDelete("CASCADE").notNullable();
      t.string("item_code", 20).notNullable();
      t.string("name", 100).notNullable();
      t.float("qty").notNullable();
      t.string("unit", 20).notNullable();
      t.float("unit_price").notNullable();
      t.float("total_price").notNullable();
      t.timestamps(true, true);
    });

exports.down = (knex) =>
  knex.schema
    .dropTableIfExists("purchase_order_items")
    .dropTableIfExists("purchase_orders")
    .dropTableIfExists("suppliers");
