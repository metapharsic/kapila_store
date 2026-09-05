exports.up = async (knex) => {
  // Check if we are running on PostgreSQL or SQLite
  const isPostgres = knex.client.config.client === "pg";
  
  if (isPostgres) {
    // Drop the old check constraint on status enum
    await knex.raw(`
      ALTER TABLE indents 
      DROP CONSTRAINT IF EXISTS indents_status_check
    `);
    
    // Add the new check constraint supporting "approved"
    await knex.raw(`
      ALTER TABLE indents 
      ADD CONSTRAINT indents_status_check 
      CHECK (status IN ('pending', 'approved', 'issued', 'cancelled'))
    `);
  } else {
    // SQLite doesn't strictly enforce enum constraints, but we can recreate or do nothing
  }
};

exports.down = async (knex) => {
  const isPostgres = knex.client.config.client === "pg";
  if (isPostgres) {
    await knex.raw(`
      ALTER TABLE indents 
      DROP CONSTRAINT IF EXISTS indents_status_check
    `);
    await knex.raw(`
      ALTER TABLE indents 
      ADD CONSTRAINT indents_status_check 
      CHECK (status IN ('pending', 'issued', 'cancelled'))
    `);
  }
};
