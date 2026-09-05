exports.up = (knex) =>
  knex.schema
    .createTable("stock_transfers", (t) => {
      t.increments("id").primary();
      t.string("transfer_number", 50).unique().notNullable();
      t.date("date").notNullable();
      t.string("from_location", 100).notNullable().defaultTo("Store"); // Store or dept name
      t.string("to_location", 100).notNullable();
      t.string("status", 20).notNullable().defaultTo("Pending"); // Pending | Accepted | Rejected
      t.string("initiated_by", 100).nullable();
      t.string("accepted_by", 100).nullable();
      t.text("remarks").nullable();
      t.timestamps(true, true);
    })
    .createTable("stock_transfer_items", (t) => {
      t.increments("id").primary();
      t.integer("transfer_id").references("id").inTable("stock_transfers").onDelete("CASCADE").notNullable();
      t.string("item_code", 20).notNullable();
      t.string("name", 100).notNullable();
      t.float("qty").notNullable();
      t.string("unit", 20).notNullable();
      t.string("batch_no", 50).nullable();
      t.timestamps(true, true);
    })
    .createTable("reorder_points", (t) => {
      t.increments("id").primary();
      t.string("item_code", 20).unique().notNullable();
      t.string("name", 100).notNullable();
      t.float("min_qty").notNullable();
      t.float("reorder_qty").notNullable();
      t.integer("lead_time_days").notNullable().defaultTo(3);
      t.integer("preferred_supplier_id").references("id").inTable("suppliers").onDelete("SET NULL").nullable();
      t.boolean("is_active").notNullable().defaultTo(true);
      t.text("notes").nullable();
      t.timestamps(true, true);
    });

exports.down = (knex) =>
  knex.schema
    .dropTableIfExists("reorder_points")
    .dropTableIfExists("stock_transfer_items")
    .dropTableIfExists("stock_transfers");
