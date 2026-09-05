exports.up = (knex) =>
  knex.schema
    .createTable("issuances", (t) => {
      t.increments("id");
      t.integer("indent_id").nullable().references("id").inTable("indents").onDelete("SET NULL");
      t.string("dept", 50).notNullable();
      t.date("date").notNullable();
      t.boolean("scanned").defaultTo(false);
      t.timestamp("created_at").defaultTo(knex.fn.now());
      t.index(["dept", "date"], "idx_issuances_dept_date");
    })
    .createTable("issuance_items", (t) => {
      t.increments("id");
      t.integer("issuance_id").notNullable().references("id").inTable("issuances").onDelete("CASCADE");
      t.string("name", 100).notNullable();
      t.float("qty").notNullable();
      t.float("issued").notNullable();
    });

exports.down = (knex) =>
  knex.schema.dropTable("issuance_items").dropTable("issuances");
