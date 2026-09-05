exports.up = async (knex) => {
  // Delete all existing departments (CASCADE will handle user_departments links)
  await knex("departments").del();

  // Insert the 6 correct departments
  await knex("departments").insert([
    { name: "South Indian", code: "S-IND", chef_name: "Chef South" },
    { name: "North Indian", code: "N-IND", chef_name: "Chef North" },
    { name: "Continental", code: "CONT", chef_name: "Chef Cont" },
    { name: "Juices", code: "JUICE", chef_name: "Chef Juice" },
    { name: "Bakery", code: "BAKE", chef_name: "Chef Bake" },
    { name: "Chinese", code: "CHIN", chef_name: "Chef Chin" }
  ]);

  // Seed a manager user for testing
  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  const [manager] = await knex("users").insert({
    employee_code: "KPL-MGR",
    name: "Kapila Manager",
    email: "manager@kapila.local",
    password_hash: passwordHash,
    is_active: true,
    must_change_password: false,
  }).returning("*");

  const managerRole = await knex("roles").where({ key: "manager" }).first();
  if (managerRole) {
    await knex("user_roles").insert({ user_id: manager.id, role_id: managerRole.id });
  }
};

exports.down = async (knex) => {
  await knex("departments").del();
  // Restore original dummy ones if we revert
  await knex("departments").insert([
    { name: "TIFFINS", code: "TFN", chef_name: "Chef Ravi Kumar" },
    { name: "STAFF", code: "STF", chef_name: "Chef Mohammed" },
    { name: "SI-MEALS", code: "SIM", chef_name: "Chef Srinivasan" },
    { name: "NORTH INDIAN", code: "NIN", chef_name: "Chef Sharma" },
    { name: "CHAT & SOFTY", code: "CHT", chef_name: "Chef Gupta" },
    { name: "CHINESE & DOSA", code: "CND", chef_name: "Chef Chen" },
    { name: "MOCKTAILS & CONTINENTAL", code: "MCT", chef_name: "Chef David" },
    { name: "RESTAURANT", code: "RST", chef_name: "Manager Anand" },
    { name: "ROOM SERVICE", code: "RMS", chef_name: "Manager Kishore" }
  ]);
};
