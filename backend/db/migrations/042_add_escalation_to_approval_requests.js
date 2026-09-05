exports.up = (knex) =>
  knex.schema.alterTable("approval_requests", (t) => {
    t.timestamp("escalated_at").nullable();
  });

exports.down = (knex) =>
  knex.schema.alterTable("approval_requests", (t) => {
    t.dropColumn("escalated_at");
  });
