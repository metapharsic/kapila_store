// Adds GIN tsvector indexes for full-text search across all item-name columns
exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE stock ADD COLUMN search_vec tsvector
      GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;
    CREATE INDEX idx_stock_fts ON stock USING GIN(search_vec);

    ALTER TABLE indent_items ADD COLUMN search_vec tsvector
      GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;
    CREATE INDEX idx_indent_items_fts ON indent_items USING GIN(search_vec);

    ALTER TABLE issuance_items ADD COLUMN search_vec tsvector
      GENERATED ALWAYS AS (to_tsvector('english', name)) STORED;
    CREATE INDEX idx_issuance_items_fts ON issuance_items USING GIN(search_vec);

    ALTER TABLE leftovers ADD COLUMN search_vec tsvector
      GENERATED ALWAYS AS (to_tsvector('english', item)) STORED;
    CREATE INDEX idx_leftovers_fts ON leftovers USING GIN(search_vec);

    ALTER TABLE production ADD COLUMN search_vec tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(notes, '') || ' ' || dept)
      ) STORED;
    CREATE INDEX idx_production_fts ON production USING GIN(search_vec);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE stock DROP COLUMN search_vec;
    ALTER TABLE indent_items DROP COLUMN search_vec;
    ALTER TABLE issuance_items DROP COLUMN search_vec;
    ALTER TABLE leftovers DROP COLUMN search_vec;
    ALTER TABLE production DROP COLUMN search_vec;
  `);
};
