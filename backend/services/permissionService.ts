import db from "../db";

export interface Role {
  id: number;
  key: string;
  name: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface UserAuthContext {
  id: number;
  employee_code: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  roles: Role[];
  permissions: string[];
  departments: Department[];
  isAdmin: boolean;
  isManager: boolean;
}

export async function getUserAuthContext(userId: number): Promise<UserAuthContext | null> {
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
    isAdmin: roles.some((role: Role) => role.key === "admin"),
    isManager: roles.some((role: Role) => role.key === "manager" || role.key === "store_manager"),
  };
}

export function hasPermission(user: any, permission: string): boolean {
  if (!user || !permission) return false;
  if (user.isAdmin) return true;
  const permissions = user.permissions instanceof Set ? user.permissions : new Set(user.permissions || []);
  return permissions.has(permission);
}

export async function getDepartmentNames(user: any): Promise<string[] | null> {
  if (!user || user.isAdmin) return null;
  if (user.departments && user.departments.length > 0) {
    return user.departments.map((dept: any) => dept.name);
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

export async function assertDepartmentAccess(user: any, deptName: string | null | undefined): Promise<void> {
  if (!deptName || user?.isAdmin || user?.isManager) return;
  const departmentNames = await getDepartmentNames(user);
  if (!departmentNames) return;
  const allowed = departmentNames.some((name) => name.toLowerCase() === String(deptName).toLowerCase());
  if (!allowed) {
    throw Object.assign(new Error("Department access denied."), { status: 403 });
  }
}

export async function applyDepartmentScope(query: any, user: any, column: string = "dept"): Promise<any> {
  if (!user || user.isAdmin || user.isManager) return query;
  const departmentNames = await getDepartmentNames(user);
  if (!departmentNames || !departmentNames.length) {
    query.whereRaw("1 = 0");
    return query;
  }
  query.whereIn(column, departmentNames);
  return query;
}
