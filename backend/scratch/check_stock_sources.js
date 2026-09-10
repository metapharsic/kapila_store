const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function main() {
  const dates = await db("stock").select("date").count("id as count").groupBy("date").orderBy("date", "desc").limit(10);
  console.log("STOCK BY DATE:", dates);

  const suppliers = await db("stock").select("supplier").count("id as count").groupBy("supplier").orderBy("count", "desc").limit(5);
  console.log("TOP SUPPLIERS:", suppliers);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
