exports.up = (knex) =>
  knex.schema.alterTable("stock", (t) => {
    t.date("expiry_date").nullable();
    t.float("min_alert_qty").nullable();
  });

exports.down = (knex) =>
  knex.schema.alterTable("stock", (t) => {
    t.dropColumn("expiry_date");
    t.dropColumn("min_alert_qty");
  });
