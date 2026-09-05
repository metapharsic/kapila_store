exports.up = (knex) =>
  knex.schema.createTable("stock", (t) => {
    t.increments("id");
    t.string("name", 100).notNullable();
    t.float("qty").notNullable();
    t.float("remaining").notNullable();
    t.string("unit", 20).notNullable().defaultTo("kg");
    t.date("date").notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["name"], "idx_stock_name");
    t.index(["date"], "idx_stock_date");
  });

exports.down = (knex) => knex.schema.dropTable("stock");
