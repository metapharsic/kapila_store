exports.up = (knex) =>
  knex.schema.alterTable("indents", (t) => {
    t.timestamp("sm_notified_at").nullable();
    t.timestamp("admin_notified_at").nullable();
  });

exports.down = (knex) =>
  knex.schema.alterTable("indents", (t) => {
    t.dropColumn("sm_notified_at");
    t.dropColumn("admin_notified_at");
  });
