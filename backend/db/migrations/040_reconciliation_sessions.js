exports.up = (knex) =>
  knex.schema.createTable("reconciliation_sessions", (t) => {
    t.increments("id").primary();
    t.string("session_name").notNullable();
    t.string("conducted_by").nullable();
    t.enu("status", ["DRAFT", "SUBMITTED"]).defaultTo("SUBMITTED").notNullable();
    t.integer("item_count").defaultTo(0);
    t.float("total_surplus_value").defaultTo(0);
    t.float("total_shortage_value").defaultTo(0);
    t.integer("surplus_item_count").defaultTo(0);
    t.integer("shortage_item_count").defaultTo(0);
    t.integer("matched_item_count").defaultTo(0);
    t.string("notes").nullable();
    t.timestamp("submitted_at").nullable();
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTable("reconciliation_sessions");
