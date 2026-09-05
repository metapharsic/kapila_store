const db = require("../db");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const LEGACY_DEPARTMENTS = [
  { name: "TIFFINS", code: "TFN", chef_name: "Chef Ravi Kumar" },
  { name: "STAFF", code: "STF", chef_name: "Chef Mohammed" },
  { name: "SI-MEALS", code: "SIM", chef_name: "Chef Srinivasan" },
  { name: "NORTH INDIAN", code: "NIN", chef_name: "Chef Sharma" },
  { name: "CHAT & SOFTY", code: "CHT", chef_name: "Chef Gupta" },
  { name: "CHINESE & DOSA", code: "CND", chef_name: "Chef Chen" },
  { name: "MOCKTAILS & CONTINENTAL", code: "MCT", chef_name: "Chef David" },
  { name: "RESTAURANT", code: "RST", chef_name: "Manager Anand" },
  { name: "ROOM SERVICE", code: "RMS", chef_name: "Manager Kishore" }
];

async function restore() {
  console.log("Restoring legacy departments...");
  
  try {
    // 1. Delete all current departments (this cascades to user_departments)
    await db("departments").del();
    
    // 2. Insert legacy departments
    const inserted = await db("departments").insert(LEGACY_DEPARTMENTS).returning("*");
    console.log("Inserted legacy departments.");

    // 3. Update department_items.json
    const deptItemsPath = path.join(__dirname, "../db/department_items.json");
    let currentItems = {};
    if (fs.existsSync(deptItemsPath)) {
      currentItems = JSON.parse(fs.readFileSync(deptItemsPath, "utf8"));
    }
    
    // Reverse mapping
    const newItems = {
      "TIFFINS": currentItems["South Indian"] || [],
      "STAFF": currentItems["South Indian"] || [],
      "SI-MEALS": currentItems["South Indian"] || [],
      "NORTH INDIAN": currentItems["North Indian"] || [],
      "CHAT & SOFTY": currentItems["Bakery"] || [],
      "CHINESE & DOSA": currentItems["Chinese"] || [],
      "MOCKTAILS & CONTINENTAL": [...(currentItems["Continental"] || []), ...(currentItems["Juices"] || [])],
      "RESTAURANT": currentItems["South Indian"] || [],
      "ROOM SERVICE": currentItems["South Indian"] || []
    };
    
    fs.writeFileSync(deptItemsPath, JSON.stringify(newItems, null, 2));
    console.log("Updated department_items.json");

    // 4. Update data in tables (indents, issuances, production, leftovers)
    // We map back the 6 to standard legacy ones just so existing data shows up
    const reverseMap = {
      'South Indian': 'TIFFINS',
      'North Indian': 'NORTH INDIAN',
      'Continental': 'MOCKTAILS & CONTINENTAL',
      'Juices': 'MOCKTAILS & CONTINENTAL',
      'Bakery': 'CHAT & SOFTY',
      'Chinese': 'CHINESE & DOSA'
    };

    for (const [oldName, newName] of Object.entries(reverseMap)) {
      await db('indents').where('dept', oldName).update({ dept: newName });
      await db('issuances').where('dept', oldName).update({ dept: newName });
      await db('production').where('dept', oldName).update({ dept: newName });
      await db('leftovers').where('dept', oldName).update({ dept: newName });
    }
    console.log("Re-mapped existing transactional data.");

    // 5. Create users for these new chefs
    const chefRole = await db("roles").where("key", "chef").first();
    const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

    for (const dept of inserted) {
      const prefix = dept.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const email = `chef.${prefix}@kapila.local`;
      const code = `CH-${dept.code}`;
      const name = dept.chef_name;

      let user = await db("users").where("email", email).first();
      
      if (!user) {
        const [insertedUser] = await db("users").insert({
          employee_code: code,
          name: name,
          email: email,
          password_hash: passwordHash,
          is_active: true,
          must_change_password: false
        }).returning("*");
        user = insertedUser;
        console.log(`Created chef: ${name} (${email})`);
      }

      const hasRole = await db("user_roles").where({ user_id: user.id, role_id: chefRole.id }).first();
      if (!hasRole) await db("user_roles").insert({ user_id: user.id, role_id: chefRole.id });

      const hasDept = await db("user_departments").where({ user_id: user.id, department_id: dept.id }).first();
      if (!hasDept) await db("user_departments").insert({ user_id: user.id, department_id: dept.id });
    }
    
    // Deactivate old 6 chefs
    const oldChefs = ["southindian", "northindian", "continental", "juices", "bakery", "chinese"];
    for (const c of oldChefs) {
      await db("users").where("email", `chef.${c}@kapila.local`).update({ is_active: false });
    }
    
    console.log("Successfully restored legacy departments and configured chefs!");
  } catch (err) {
    console.error(err);
  } finally {
    db.destroy();
  }
}

restore();
