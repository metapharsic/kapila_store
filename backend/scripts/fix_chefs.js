const db = require("../db");
const bcrypt = require("bcryptjs");

async function fixChefs() {
  try {
    console.log("Fixing chefs and department mappings...");

    // 1. Get all departments
    const departments = await db("departments").select("*");
    if (departments.length === 0) {
      console.log("No departments found. Make sure migrations are run.");
      return;
    }

    // 2. Get the chef role
    const chefRole = await db("roles").where("key", "chef").first();
    if (!chefRole) {
      console.log("Chef role not found.");
      return;
    }

    // Sync chef role permissions
    const { ROLE_PERMISSION_KEYS } = require("../config/permissions");
    const chefPermissionKeys = ROLE_PERMISSION_KEYS.chef;

    const permissions = await db("permissions")
      .whereIn("key", chefPermissionKeys)
      .select("id", "key");

    await db("role_permissions").where("role_id", chefRole.id).del();

    const chefRolePermissions = permissions.map((p) => ({
      role_id: chefRole.id,
      permission_id: p.id,
    }));
    await db("role_permissions").insert(chefRolePermissions);
    console.log(`Synced ${chefRolePermissions.length} permissions for Chef role.`);

    // 3. Create or update a chef for each department
    const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
    
    for (const dept of departments) {
      // Create a normalized email/code based on dept name
      const prefix = dept.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const email = `chef.${prefix}@kapila.local`;
      const code = `CH-${dept.code}`;
      const name = dept.chef_name || `Chef ${dept.name}`;

      // Check if user exists by email
      let user = await db("users").where("email", email).first();
      
      if (!user) {
        // Insert new user
        const [insertedUser] = await db("users").insert({
          employee_code: code,
          name: name,
          email: email,
          password_hash: passwordHash,
          is_active: true,
          must_change_password: false
        }).returning("*");
        user = insertedUser;
        console.log(`Created new chef: ${name} (${email})`);
      } else {
        console.log(`Chef already exists: ${name} (${email})`);
      }

      // Ensure user has chef role
      const hasRole = await db("user_roles")
        .where({ user_id: user.id, role_id: chefRole.id })
        .first();
      
      if (!hasRole) {
        await db("user_roles").insert({
          user_id: user.id,
          role_id: chefRole.id
        });
      }

      // Ensure user is mapped to department
      const hasDept = await db("user_departments")
        .where({ user_id: user.id, department_id: dept.id })
        .first();
      
      if (!hasDept) {
        await db("user_departments").insert({
          user_id: user.id,
          department_id: dept.id
        });
        console.log(`Mapped ${name} to department ${dept.name}`);
      }
    }

    console.log("Chefs fixed successfully!");
  } catch (error) {
    console.error("Failed to fix chefs:", error);
  } finally {
    db.destroy();
  }
}

fixChefs();
