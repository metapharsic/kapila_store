const db = require("../db");
const bcrypt = require("bcryptjs");

async function checkUsers() {
  const users = await db("users").select("id", "employee_code", "name", "email", "is_active", "password_hash", "pin_hash");
  console.log("=== USERS IN DATABASE ===");
  for (const u of users) {
    const isDefaultPass = await bcrypt.compare("ChangeMe123!", u.password_hash);
    const isDefaultPin = u.pin_hash ? await bcrypt.compare("1234", u.pin_hash) : false;
    console.log({
      id: u.id,
      code: u.employee_code,
      name: u.name,
      email: u.email,
      active: u.is_active,
      passwordMatchesChangeMe123: isDefaultPass,
      pinMatches1234: isDefaultPin,
    });
  }
  process.exit(0);
}

checkUsers().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
