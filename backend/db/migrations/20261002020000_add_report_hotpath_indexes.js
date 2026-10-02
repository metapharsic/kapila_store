/**
 * 20261002020000_add_report_hotpath_indexes.js
 * Adds indexes for Reports/Intelligence hot-path queries. Uses
 * "CREATE INDEX IF NOT EXISTS" so it's safe to re-run even if some of
 * these indexes already exist from an earlier/partial migration run.
 */

exports.up = async function (knex) {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_stock_ledger_type_created_at ON stock_ledger ("transaction_type", "created_at")');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_stock_ledger_item_code ON stock_ledger ("item_code")');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_indents_status ON indents ("status")');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_goods_receipt_notes_date ON goods_receipt_notes ("date")');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_goods_receipt_notes_supplier_id ON goods_receipt_notes ("supplier_id")');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_stock_ledger_type_created_at');
  await knex.raw('DROP INDEX IF EXISTS idx_stock_ledger_item_code');
  await knex.raw('DROP INDEX IF EXISTS idx_indents_status');
  await knex.raw('DROP INDEX IF EXISTS idx_goods_receipt_notes_date');
  await knex.raw('DROP INDEX IF EXISTS idx_goods_receipt_notes_supplier_id');
};
