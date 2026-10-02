exports.up = (knex) =>
  knex.schema.table("stock_adjustments", (t) => {
    t.integer("session_id")
      .nullable()
      .references("id")
      .inTable("reconciliation_sessions")
      .onDelete("SET NULL");
  });

exports.down = (knex) =>
  knex.schema.table("stock_adjustments", (t) => {
    t.dropColumn("session_id");
  });
