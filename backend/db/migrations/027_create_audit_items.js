exports.up = (knex) =>
  knex.schema.createTable("audit_items", (t) => {
    t.increments("id").primary();
    t.integer("audit_session_id").notNullable().references("id").inTable("audit_sessions").onDelete("CASCADE");
    t.integer("stock_item_id").notNullable().references("id").inTable("stock").onDelete("RESTRICT");
    t.string("item_code").notNullable();
    t.string("item_name").notNullable();
    t.string("unit").notNullable();
    t.decimal("db_qty", 10, 3).notNullable();
    t.decimal("physical_qty", 10, 3).nullable();
    t.decimal("difference", 10, 3).nullable();
    t.string("discrepancy_reason").nullable();
    t.string("action").nullable(); // 'adjust_db' | 'recount' | 'investigate' | null
    t.boolean("db_adjusted").notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTableIfExists("audit_items");
