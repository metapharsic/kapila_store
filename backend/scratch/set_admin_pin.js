const db = require("../db");
const bcrypt = require("bcryptjs");

async function fixAdminPin() {
  const pinHash = await bcrypt.hash("1234", 10);
  await db("users").where({ email: "admin@kapila.local" }).update({ pin_hash: pinHash });
  console.log("Updated admin@kapila.local with PIN 1234");
  process.exit(0);
}

fixAdminPin().catch(err => {
  console.error(err);
  process.exit(1);
});
