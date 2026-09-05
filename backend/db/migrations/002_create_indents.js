exports.up = (knex) =>
  knex.schema
    .createTable("indents", (t) => {
      t.increments("id");
      t.string("dept", 50).notNullable();
      t.date("date").notNullable();
      t.enu("status", ["pending", "issued", "cancelled"]).defaultTo("pending");
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.index(["dept", "date"], "idx_indents_dept_date");
      t.index(["status"], "idx_indents_status");
    })
    .createTable("indent_items", (t) => {
      t.increments("id");
      t.integer("indent_id").notNullable().references("id").inTable("indents").onDelete("CASCADE");
      t.string("name", 100).notNullable();
      t.float("qty").notNullable();
    });

exports.down = (knex) =>
  knex.schema.dropTable("indent_items").dropTable("indents");
