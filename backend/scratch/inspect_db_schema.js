const db = require('../db');

async function main() {
  const tablesRes = await db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log("ALL TABLES IN KAPILA DB:");
  console.log(tablesRes.rows.map(x => x.table_name).join(', '));

  // Check if stock_ledger exists
  const hasLedger = tablesRes.rows.some(x => x.table_name === 'stock_ledger');
  console.log("\nHas stock_ledger:", hasLedger);
  if (hasLedger) {
    const cols = await db.raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_ledger';");
    console.log("stock_ledger columns:", cols.rows);
  }

  // Check grn and purchase_orders columns
  const hasGrn = tablesRes.rows.some(x => x.table_name === 'grn');
  console.log("Has grn:", hasGrn);
  if (hasGrn) {
    const cols = await db.raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'grn';");
    console.log("grn columns:", cols.rows.map(c => c.column_name));
  }

  const hasPO = tablesRes.rows.some(x => x.table_name === 'purchase_orders');
  console.log("Has purchase_orders:", hasPO);
  if (hasPO) {
    const cols = await db.raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_orders';");
    console.log("purchase_orders columns:", cols.rows.map(c => c.column_name));
  }

  await db.destroy();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
