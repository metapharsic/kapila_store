exports.up = async (knex) => {
  const isPostgres = knex.client.config.client === "pg";

  if (isPostgres) {
    // "partial" is written by issuanceController on partial fulfillment but was
    // never added to the check constraint — writing it currently throws.
    await knex.raw(`ALTER TABLE indents DROP CONSTRAINT IF EXISTS indents_status_check`);
    await knex.raw(`
      ALTER TABLE indents
      ADD CONSTRAINT indents_status_check
      CHECK (status IN ('pending', 'approved', 'partial', 'issued', 'cancelled'))
    `);
  }

  // float qty drifts over repeated sums (ledger, dashboard) — move to fixed-point.
  await knex.schema.alterTable("indent_items", (t) => {
    t.decimal("qty", 12, 3).notNullable().alter();
  });
  await knex.schema.alterTable("issuance_items", (t) => {
    t.decimal("qty", 12, 3).notNullable().alter();
    t.decimal("issued", 12, 3).notNullable().alter();
  });
};

exports.down = async (knex) => {
  const isPostgres = knex.client.config.client === "pg";
  if (isPostgres) {
    await knex.raw(`ALTER TABLE indents DROP CONSTRAINT IF EXISTS indents_status_check`);
    await knex.raw(`
      ALTER TABLE indents
      ADD CONSTRAINT indents_status_check
      CHECK (status IN ('pending', 'approved', 'issued', 'cancelled'))
    `);
  }
  await knex.schema.alterTable("indent_items", (t) => {
    t.float("qty").notNullable().alter();
  });
  await knex.schema.alterTable("issuance_items", (t) => {
    t.float("qty").notNullable().alter();
    t.float("issued").notNullable().alter();
  });
};
