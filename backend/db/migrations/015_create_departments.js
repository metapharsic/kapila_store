exports.up = async (knex) => {
  await knex.schema.createTable("departments", (t) => {
    t.increments("id");
    t.string("name", 100).notNullable().unique();
    t.string("code", 20).notNullable().unique();
    t.string("chef_name", 100);
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // Seed default departments corresponding to the sheet names in the Excel indent sheet
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

exports.down = (knex) => knex.schema.dropTable("departments");
