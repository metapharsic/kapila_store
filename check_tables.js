const db = require("./backend/db");
async function main() {
  const t = await db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log(t.rows.map(r => r.table_name));
  process.exit(0);
}
main();
