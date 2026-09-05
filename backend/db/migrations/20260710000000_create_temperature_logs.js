exports.up = (knex) =>
  knex.schema.hasTable("temperature_logs").then((exists) => {
    if (!exists) {
      return knex.schema.createTable("temperature_logs", (t) => {
        t.increments("id").primary();
        t.string("storage_location", 100).notNullable();
        t.float("temperature").notNullable();
        t.string("recorded_by", 100).nullable();
        t.timestamps(true, true);
      });
    }
  });

exports.down = (knex) => knex.schema.dropTableIfExists("temperature_logs");
