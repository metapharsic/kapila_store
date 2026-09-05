exports.up = (knex) =>
  knex.schema
    .createTable("goods_receipt_notes", (t) => {
      t.increments("id").primary();
      t.string("grn_number", 50).unique().notNullable();
      t.integer("po_id").references("id").inTable("purchase_orders").onDelete("SET NULL").nullable();
      t.integer("supplier_id").references("id").inTable("suppliers").onDelete("RESTRICT").notNullable();
      t.date("date").notNullable();
      t.string("invoice_no", 50).nullable();
      t.string("received_by", 100).nullable();
      t.text("remarks").nullable();
      t.float("total_amount").notNullable().defaultTo(0);
      t.timestamps(true, true);
    })
    .createTable("goods_receipt_items", (t) => {
      t.increments("id").primary();
      t.integer("grn_id").references("id").inTable("goods_receipt_notes").onDelete("CASCADE").notNullable();
      t.string("item_code", 20).notNullable();
      t.string("name", 100).notNullable();
      t.float("qty_ordered").nullable(); // Can be null if GRN is direct without PO
      t.float("qty_received").notNullable();
      t.float("qty_accepted").notNullable();
      t.float("qty_rejected").notNullable();
      t.string("unit", 20).notNullable();
      t.float("unit_price").notNullable();
      t.float("landed_cost").notNullable();
      t.string("batch_no", 50).nullable();
      t.date("expiry_date").nullable();
      t.timestamps(true, true);
    })
    .alterTable("stock", (t) => {
      t.integer("grn_item_id").references("id").inTable("goods_receipt_items").onDelete("CASCADE").nullable();
      t.string("batch_no", 50).nullable();
      t.integer("supplier_id").references("id").inTable("suppliers").onDelete("SET NULL").nullable();
    });

exports.down = (knex) =>
  knex.schema
    .alterTable("stock", (t) => {
      t.dropColumn("grn_item_id");
      t.dropColumn("batch_no");
      t.dropColumn("supplier_id");
    })
    .dropTableIfExists("goods_receipt_items")
    .dropTableIfExists("goods_receipt_notes");
