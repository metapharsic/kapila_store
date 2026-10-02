/**
 * 20261002000000_add_report_performance_indexes.js
 * Adds missing indexes used heavily by reporting/dashboard queries
 * (item history, cross-module insights, data quality audit):
 * - indent_items(item_code), indent_items(indent_id)
 * - issuance_items(item_code), issuance_items(issuance_id)
 * - goods_receipt_items(item_code), goods_receipt_items(grn_id)
 * - stock_ledger(balance_qty_after)
 */

exports.up = async function (knex) {
  await knex.schema.alterTable("indent_items", (table) => {
    table.index(["item_code"], "idx_indent_items_item_code");
    table.index(["indent_id"], "idx_indent_items_indent_id");
  });

  await knex.schema.alterTable("issuance_items", (table) => {
    table.index(["item_code"], "idx_issuance_items_item_code");
    table.index(["issuance_id"], "idx_issuance_items_issuance_id");
  });

  await knex.schema.alterTable("goods_receipt_items", (table) => {
    table.index(["item_code"], "idx_goods_receipt_items_item_code");
    table.index(["grn_id"], "idx_goods_receipt_items_grn_id");
  });

  await knex.schema.alterTable("stock_ledger", (table) => {
    table.index(["balance_qty_after"], "idx_stock_ledger_balance_qty_after");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("indent_items", (table) => {
    table.dropIndex(["item_code"], "idx_indent_items_item_code");
    table.dropIndex(["indent_id"], "idx_indent_items_indent_id");
  });

  await knex.schema.alterTable("issuance_items", (table) => {
    table.dropIndex(["item_code"], "idx_issuance_items_item_code");
    table.dropIndex(["issuance_id"], "idx_issuance_items_issuance_id");
  });

  await knex.schema.alterTable("goods_receipt_items", (table) => {
    table.dropIndex(["item_code"], "idx_goods_receipt_items_item_code");
    table.dropIndex(["grn_id"], "idx_goods_receipt_items_grn_id");
  });

  await knex.schema.alterTable("stock_ledger", (table) => {
    table.dropIndex(["balance_qty_after"], "idx_stock_ledger_balance_qty_after");
  });
};
