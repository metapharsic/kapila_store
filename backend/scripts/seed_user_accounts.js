const db = require("../db");
const bcrypt = require("bcryptjs");
const { ROLE_PERMISSION_KEYS } = require("../config/permissions");

async function seedUsers() {
  try {
    console.log("Seeding user accounts...");

    // 1. Ensure store_manager role exists
    let storeManagerRole = await db("roles").where({ key: "store_manager" }).first();
    if (!storeManagerRole) {
      const [inserted] = await db("roles").insert({
        key: "store_manager",
        name: "Store Manager",
        description: "Store inventory manager access",
        is_system: true
      }).returning("*");
      storeManagerRole = inserted;
      console.log("Created store_manager role.");
    }

    // Sync store_manager role permissions
    const smPermKeys = ROLE_PERMISSION_KEYS.store_manager || [];
    const permissions = await db("permissions").whereIn("key", smPermKeys).select("id");
    
    // Clear existing permissions for store_manager
    await db("role_permissions").where({ role_id: storeManagerRole.id }).del();
    
    const rolePermissions = permissions.map(p => ({
      role_id: storeManagerRole.id,
      permission_id: p.id
    }));
    if (rolePermissions.length > 0) {
      await db("role_permissions").insert(rolePermissions);
      console.log(`Synced ${rolePermissions.length} permissions for store_manager role.`);
    }

    // 2. Create store@kapila.com user
    const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
    let storeUser = await db("users")
      .where({ email: "store@kapila.com" })
      .orWhere({ email: "store@kapila.local" })
      .orWhere({ employee_code: "KPL-STORE" })
      .first();
    if (!storeUser) {
      const [inserted] = await db("users").insert({
        employee_code: "KPL-STORE",
        name: "Store Keeper",
        email: "store@kapila.com",
        password_hash: passwordHash,
        is_active: true,
        must_change_password: false
      }).returning("*");
      storeUser = inserted;
      console.log("Created user store@kapila.com");
    }

    // Map store@kapila.com to store_manager role
    const hasSMRole = await db("user_roles").where({ user_id: storeUser.id, role_id: storeManagerRole.id }).first();
    if (!hasSMRole) {
      await db("user_roles").insert({
        user_id: storeUser.id,
        role_id: storeManagerRole.id
      });
      console.log("Assigned store_manager role to store@kapila.com");
    }

    // 3. Create Chef@kapila.com user
    let chefUser = await db("users")
      .where({ email: "Chef@kapila.com" })
      .orWhere({ email: "chef@kapila.local" })
      .orWhere({ employee_code: "KPL-CHEF" })
      .first();
    if (!chefUser) {
      const [inserted] = await db("users").insert({
        employee_code: "KPL-CHEF",
        name: "Main Chef",
        email: "Chef@kapila.com",
        password_hash: passwordHash,
        is_active: true,
        must_change_password: false
      }).returning("*");
      chefUser = inserted;
      console.log("Created user Chef@kapila.com");
    }

    // Map Chef@kapila.com to chef role
    const chefRole = await db("roles").where({ key: "chef" }).first();
    if (chefRole) {
      const hasChefRole = await db("user_roles").where({ user_id: chefUser.id, role_id: chefRole.id }).first();
      if (!hasChefRole) {
        await db("user_roles").insert({
          user_id: chefUser.id,
          role_id: chefRole.id
        });
        console.log("Assigned chef role to Chef@kapila.com");
      }
    }

    // Map Chef@kapila.com to all departments
    const departments = await db("departments").select("id");
    for (const dept of departments) {
      const hasDept = await db("user_departments").where({ user_id: chefUser.id, department_id: dept.id }).first();
      if (!hasDept) {
        await db("user_departments").insert({
          user_id: chefUser.id,
          department_id: dept.id
        });
      }
    }
    console.log(`Mapped Chef@kapila.com to all ${departments.length} departments.`);

    console.log("User accounts seeded successfully!");
  } catch (error) {
    console.error("Seeding users failed:", error);
  } finally {
    db.destroy();
  }
}

seedUsers();
