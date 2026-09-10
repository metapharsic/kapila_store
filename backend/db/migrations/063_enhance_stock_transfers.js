/**
 * 063_enhance_stock_transfers.js
 * Enhances stock_transfers and stock_transfer_items for enterprise multi-agent operations:
 * - Transfer archetypes (Store->Dept, Dept->Dept, Dept->Store)
 * - Financial valuation (total_value, unit_price)
 * - Two-stage handshake transit statuses and timestamps
 * - Line item received quantities, condition status, and storage rack/shelf/bin positioning
 */

exports.up = async function (knex) {
  // Enhance stock_transfers
  const hasTransfers = await knex.schema.hasTable("stock_transfers");
  if (hasTransfers) {
    await knex.schema.alterTable("stock_transfers", (t) => {
      t.string("transfer_type", 50).defaultTo("STORE_TO_DEPT").index();
      t.decimal("total_value", 12, 2).defaultTo(0);
      t.string("transit_status", 50).defaultTo("DISPATCHED").index();
      t.timestamp("dispatched_at", { useTz: true }).nullable();
      t.timestamp("received_at", { useTz: true }).nullable();
      t.text("rejection_reason").nullable();
    });
  }

  // Enhance stock_transfer_items
  const hasItems = await knex.schema.hasTable("stock_transfer_items");
  if (hasItems) {
    await knex.schema.alterTable("stock_transfer_items", (t) => {
      t.float("received_qty").nullable();
      t.float("transit_variance").defaultTo(0);
      t.decimal("unit_price", 12, 2).defaultTo(0);
      t.decimal("total_value", 12, 2).defaultTo(0);
      t.string("condition_status", 50).defaultTo("Good");
      t.string("rack", 50).nullable();
      t.string("shelf", 50).nullable();
      t.string("bin", 50).nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasItems = await knex.schema.hasTable("stock_transfer_items");
  if (hasItems) {
    await knex.schema.alterTable("stock_transfer_items", (t) => {
      t.dropColumn("bin");
      t.dropColumn("shelf");
      t.dropColumn("rack");
      t.dropColumn("condition_status");
      t.dropColumn("total_value");
      t.dropColumn("unit_price");
      t.dropColumn("transit_variance");
      t.dropColumn("received_qty");
    });
  }

  const hasTransfers = await knex.schema.hasTable("stock_transfers");
  if (hasTransfers) {
    await knex.schema.alterTable("stock_transfers", (t) => {
      t.dropColumn("rejection_reason");
      t.dropColumn("received_at");
      t.dropColumn("dispatched_at");
      t.dropColumn("transit_status");
      t.dropColumn("total_value");
      t.dropColumn("transfer_type");
    });
  }
};
