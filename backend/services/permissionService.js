const db = require("../db");

async function getUserAuthContext(userId) {
  const user = await db("users")
    .select("id", "employee_code", "name", "email", "phone", "is_active", "must_change_password", "last_login_at")
    .where("id", userId)
    .first();
  if (!user) return null;

  const roles = await db("roles")
    .join("user_roles", "user_roles.role_id", "roles.id")
    .where("user_roles.user_id", userId)
    .where("roles.is_active", true)
    .select("roles.id", "roles.key", "roles.name");

  const permissions = await db("permissions")
    .distinct("permissions.key")
    .join("role_permissions", "role_permissions.permission_id", "permissions.id")
    .join("roles", "roles.id", "role_permissions.role_id")
    .join("user_roles", "user_roles.role_id", "roles.id")
    .where("user_roles.user_id", userId)
    .where("roles.is_active", true)
    .pluck("permissions.key");

  const departments = await db("departments")
    .join("user_departments", "user_departments.department_id", "departments.id")
    .where("user_departments.user_id", userId)
    .select("departments.id", "departments.name", "departments.code");

  return {
    ...user,
    roles,
    permissions,
    departments,
    isAdmin: roles.some((role) => role.key === "admin"),
    isManager: roles.some((role) => role.key === "manager" || role.key === "store_manager"),
  };
}

function hasPermission(user, permission) {
  if (!user || !permission) return false;
  if (user.isAdmin) return true;
  const permissions = user.permissions instanceof Set ? user.permissions : new Set(user.permissions || []);
  return permissions.has(permission);
}

async function getDepartmentNames(user) {
  if (!user || user.isAdmin) return null;
  if (user.departments && user.departments.length > 0) {
    return user.departments.map((dept) => dept.name);
  }
  const assigned = await db("departments")
    .join("user_departments", "user_departments.department_id", "departments.id")
    .where("user_departments.user_id", user.id)
    .pluck("departments.name");

  if (assigned.length > 0) {
    return assigned;
  }
  return db("departments").pluck("name");
}

async function assertDepartmentAccess(user, deptName) {
  if (!deptName || user?.isAdmin || user?.isManager) return;
  const departmentNames = await getDepartmentNames(user);
  if (!departmentNames) return;
  const allowed = departmentNames.some((name) => name.toLowerCase() === String(deptName).toLowerCase());
  if (!allowed) {
    throw Object.assign(new Error("Department access denied."), { status: 403 });
  }
}

async function applyDepartmentScope(query, user, column = "dept") {
  if (!user || user.isAdmin || user.isManager) return query;
  const departmentNames = await getDepartmentNames(user);
  if (!departmentNames || !departmentNames.length) {
    query.whereRaw("1 = 0");
    return query;
  }
  query.whereIn(column, departmentNames);
  return query;
}

module.exports = {
  getUserAuthContext,
  hasPermission,
  getDepartmentNames,
  assertDepartmentAccess,
  applyDepartmentScope,
};
