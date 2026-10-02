/**
 * 069_create_report_settings.js
 * Admin-configurable thresholds for the Cross-Module Intelligence report
 * (price-spike % and dormancy-days), previously hardcoded in reportController.js.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable("report_settings");
  if (!exists) {
    await knex.schema.createTable("report_settings", (table) => {
      table.string("key", 100).primary();
      table.jsonb("value").notNullable();
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
  }

  await knex("report_settings")
    .insert([
      { key: "price_spike_pct", value: JSON.stringify(12) },
      { key: "dormancy_days", value: JSON.stringify(7) },
    ])
    .onConflict("key")
    .ignore();
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("report_settings");
};
