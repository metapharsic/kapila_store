exports.up = async (knex) => {
  // Delete incorrect departments
  await knex("departments").del();

  // Restore the correct fixed list of departments per AGENTS.md
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

exports.down = async (knex) => {
  await knex("departments").del();
  await knex("departments").insert([
    { name: "South Indian", code: "S-IND", chef_name: "Chef South" },
    { name: "North Indian", code: "N-IND", chef_name: "Chef North" },
    { name: "Continental", code: "CONT", chef_name: "Chef Cont" },
    { name: "Juices", code: "JUICE", chef_name: "Chef Juice" },
    { name: "Bakery", code: "BAKE", chef_name: "Chef Bake" },
    { name: "Chinese", code: "CHIN", chef_name: "Chef Chin" }
  ]);
};
