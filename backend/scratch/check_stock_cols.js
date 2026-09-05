const db = require("../db");

async function checkStockColumns() {
  const sample = await db("stock").first();
  console.log("Stock Table Columns:", Object.keys(sample || {}));
  process.exit(0);
}

checkStockColumns().catch(e => {
  console.error(e);
  process.exit(1);
});
