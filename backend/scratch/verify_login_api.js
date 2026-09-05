const db = require("../db");
const bcrypt = require("bcryptjs");

async function testAllAccounts() {
  console.log("=== VERIFYING CREDENTIALS FOR ALL ACCOUNTS ===");
  
  const accounts = [
    { email: "store@kapila.com", code: "KPL-STORE", name: "Store Keeper", pin: "1234", pass: "ChangeMe123!" },
    { email: "Chef@kapila.com", code: "KPL-CHEF", name: "Main Chef", pin: "1234", pass: "ChangeMe123!" },
    { email: "admin@kapila.local", code: "KPL-ADMIN", name: "General Admin", pin: "1234", pass: "ChangeMe123!" },
  ];

  for (const acc of accounts) {
    const user = await db("users").where({ email: acc.email }).first();
    if (!user) {
      console.error(`User not found: ${acc.email}`);
      continue;
    }

    const passValid = await bcrypt.compare(acc.pass, user.password_hash);
    const pinValid = user.pin_hash ? await bcrypt.compare(acc.pin, user.pin_hash) : false;

    console.log(`[${acc.code}] ${acc.name}:`);
    console.log(`  - Email/Pass (${acc.email} / ${acc.pass}): ${passValid ? "✅ VALID" : "❌ INVALID"}`);
    console.log(`  - PIN (${acc.pin}): ${pinValid ? "✅ VALID" : "❌ INVALID"}`);
  }
  process.exit(0);
}

testAllAccounts().catch(e => {
  console.error(e);
  process.exit(1);
});
