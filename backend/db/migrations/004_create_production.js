exports.up = (knex) =>
  knex.schema.createTable("production", (t) => {
    t.increments("id");
    t.string("dept", 50).notNullable();
    t.date("date").notNullable();
    t.integer("plates").notNullable();
    t.text("notes").nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["dept", "date"], "idx_production_dept_date");
  });

exports.down = (knex) => knex.schema.dropTable("production");
