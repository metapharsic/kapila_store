/**
 * 056_create_stock_ledger.js
 * Migration to create the double-entry financial stock ledger (P2P Foundation)
 * Adapted from MK Paper Mill ERP into Hotel Kapila Inventory System.
 * 
 * Tracks every inward, outward, adjustment, and return transaction with:
 * - Immutable audit trail
 * - Exact balance before and balance after
 * - Monetary valuation (unit price and total movement value)
 * - Reference document linkage (GRN, Issue, Batch, Return, Opening)
 * - Destination department / source supplier tracking
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasTable("stock_ledger");
  if (!exists) {
    await knex.schema.createTable("stock_ledger", (table) => {
      table.bigIncrements("id").primary();
      table.integer("stock_id").unsigned().nullable().references("id").inTable("stock").onDelete("SET NULL");
      
      table.string("item_code", 50).notNullable().index();
      table.string("item_name", 255).notNullable().index();
      table.string("category", 100).nullable().index();
      
      // Transaction types: 'INWARD_GRN', 'INWARD_PURCHASE', 'OUTWARD_ISSUE', 'ADJUSTMENT_ADD', 'ADJUSTMENT_DEDUCT', 'RETURN_TO_VENDOR', 'OPENING_BALANCE'
      table.string("transaction_type", 50).notNullable().index();
      
      table.decimal("qty", 12, 3).notNullable();
      table.string("unit", 50).notNullable();
      table.decimal("unit_price", 12, 2).defaultTo(0);
      table.decimal("total_value", 12, 2).defaultTo(0);
      
      // Running balance audit trail
      table.decimal("balance_qty_before", 12, 3).notNullable();
      table.decimal("balance_qty_after", 12, 3).notNullable();
      
      table.string("batch_no", 100).nullable();
      table.string("department", 100).nullable().index();
      table.string("supplier", 255).nullable();
      table.string("invoice_no", 100).nullable();
      
      // Reference document linkage: 'GRN', 'ISSUE', 'STOCK', 'ADJUSTMENT', 'RETURN', 'OPENING'
      table.string("reference_doc_type", 50).notNullable().index();
      table.integer("reference_doc_id").nullable();
      table.string("reference_doc_no", 100).nullable();
      
      table.string("reason", 255).nullable();
      table.text("notes").nullable();
      table.string("created_by", 100).nullable();
      table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now()).index();
      
      // Performance composite indexes
      table.index(["item_code", "created_at"]);
      table.index(["transaction_type", "created_at"]);
      table.index(["department", "created_at"]);
    });

    console.log("[Migration 056] Created table 'stock_ledger' successfully.");

    // Backfill opening balance entries for all existing active inventory
    const activeItems = await knex("stock")
      .where("remaining", ">", 0)
      .groupBy("item_code", "name", "category", "unit")
      .select(
        "item_code",
        "name as item_name",
        "category",
        "unit",
        knex.raw("COALESCE(SUM(remaining), 0) as total_remaining"),
        knex.raw("COALESCE(AVG(price), 0) as avg_price")
      );

    if (activeItems.length > 0) {
      console.log(`[Migration 056] Backfilling opening balances for ${activeItems.length} active SKUs...`);
      const openingRows = activeItems.map((item) => {
        const remaining = parseFloat(item.total_remaining);
        const price = parseFloat(item.avg_price);
        const totalVal = Math.round(remaining * price * 100) / 100;
        return {
          item_code: item.item_code || "KPL-GEN",
          item_name: item.item_name,
          category: item.category,
          transaction_type: "OPENING_BALANCE",
          qty: remaining,
          unit: item.unit || "kg",
          unit_price: price,
          total_value: totalVal,
          balance_qty_before: 0,
          balance_qty_after: remaining,
          batch_no: "OPENING-STOCK-2026",
          department: "CENTRAL STORE",
          supplier: "Initial Inventory Audit",
          invoice_no: "INIT-OPENING-001",
          reference_doc_type: "OPENING",
          reference_doc_id: null,
          reference_doc_no: "AUDIT-2026",
          reason: "Double-Entry Ledger Inception",
          notes: "Initial balance backfilled from active stock batches",
          created_by: "System Initializer",
          created_at: knex.fn.now()
        };
      });

      // Insert in chunks of 100
      for (let i = 0; i < openingRows.length; i += 100) {
        await knex("stock_ledger").insert(openingRows.slice(i, i + 100));
      }
      console.log(`[Migration 056] Successfully seeded ${openingRows.length} opening ledger records.`);
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("stock_ledger");
  console.log("[Migration 056] Dropped table 'stock_ledger'.");
};
