exports.up = (knex) =>
  knex.schema.createTable("leftovers", (t) => {
    t.increments("id");
    t.string("dept", 50).notNullable();
    t.date("date").notNullable();
    t.string("item", 100).notNullable();
    t.float("qty").notNullable();
    t.string("unit", 20).notNullable().defaultTo("plates");
    t.boolean("carried_forward").defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["dept", "date"], "idx_leftovers_dept_date");
  });

exports.down = (knex) => knex.schema.dropTable("leftovers");
