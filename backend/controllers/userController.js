const db = require("../db");
const { hashPassword } = require("../services/passwordService");
const { revokeUserRefreshTokens } = require("../services/authService");
const { auditLog } = require("../services/auditService");

function cleanUser(row) {
  const { password_hash, ...safe } = row;
  return safe;
}

async function hydrateUsers(users) {
  const ids = users.map((u) => u.id);
  if (!ids.length) return [];
  const roles = await db("roles")
    .join("user_roles", "user_roles.role_id", "roles.id")
    .whereIn("user_roles.user_id", ids)
    .select("user_roles.user_id", "roles.id", "roles.key", "roles.name");
  const departments = await db("departments")
    .join("user_departments", "user_departments.department_id", "departments.id")
    .whereIn("user_departments.user_id", ids)
    .select("user_departments.user_id", "departments.id", "departments.name", "departments.code");
  return users.map((user) => ({
    ...cleanUser(user),
    roles: roles.filter((role) => role.user_id === user.id).map(({ user_id, ...role }) => role),
    departments: departments.filter((dept) => dept.user_id === user.id).map(({ user_id, ...dept }) => dept),
  }));
}

async function list(req, res, next) {
  try {
    const { q, is_active, role, department_id } = req.query;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const offset = (page - 1) * limit;

    const filter = (qb) => {
      if (q) qb.where((inner) => inner.whereILike("users.name", `%${q}%`).orWhereILike("users.email", `%${q}%`));
      if (is_active === "true" || is_active === "false") qb.where("users.is_active", is_active === "true");
      if (role) {
        qb.whereIn("users.id", db("user_roles").join("roles", "roles.id", "user_roles.role_id").where("roles.key", role).select("user_roles.user_id"));
      }
      if (department_id) {
        qb.whereIn("users.id", db("user_departments").where("department_id", department_id).select("user_id"));
      }
    };

    const [{ count }] = await db("users").modify(filter).count("users.id as count");
    const users = await db("users").modify(filter)
      .orderBy([
        { column: "users.created_at", order: "desc" },
        { column: "users.id", order: "desc" }
      ])
      .offset(offset).limit(limit);
    res.json({ success: true, data: await hydrateUsers(users), total: parseInt(count), page, limit });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const user = await db("users").where("id", req.params.id).first();
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    const [hydrated] = await hydrateUsers([user]);
    res.json({ success: true, data: hydrated });
  } catch (err) { next(err); }
}

async function syncAssignments(trx, userId, roleIds = [], departmentIds = []) {
  await trx("user_roles").where("user_id", userId).del();
  if (roleIds.length) {
    await trx("user_roles").insert(roleIds.map((role_id) => ({ user_id: userId, role_id })));
  }

  await trx("user_departments").where("user_id", userId).del();
  if (departmentIds.length) {
    await trx("user_departments").insert(departmentIds.map((department_id) => ({ user_id: userId, department_id })));
  }
}

async function create(req, res, next) {
  try {
    const { employee_code, name, email, phone, temporary_password, role_ids = [], department_ids = [], is_active = true } = req.body;
    const password_hash = await hashPassword(temporary_password || "ChangeMe123!");
    const result = await db.transaction(async (trx) => {
      const [user] = await trx("users").insert({
        employee_code: employee_code || null,
        name,
        email,
        phone: phone || null,
        password_hash,
        is_active,
        must_change_password: true,
        created_by: req.user.id,
      }).returning("*");
      await syncAssignments(trx, user.id, role_ids, department_ids);
      return user;
    });
    const [hydrated] = await hydrateUsers([result]);
    await auditLog(req, { action: "users.create", resource: "users", resourceId: result.id, after: hydrated });
    res.status(201).json({ success: true, data: hydrated });
  } catch (err) { next(err); }
}

async function ensureNotLastAdmin(userId, roleIds, isActive) {
  const adminRole = await db("roles").where("key", "admin").first();
  if (!adminRole) return;
  const keepsAdmin = roleIds?.includes(adminRole.id) && isActive !== false;
  const currentHasAdmin = await db("user_roles").where({ user_id: userId, role_id: adminRole.id }).first();
  if (!currentHasAdmin || keepsAdmin) return;
  const [{ count }] = await db("users")
    .join("user_roles", "user_roles.user_id", "users.id")
    .where("user_roles.role_id", adminRole.id)
    .where("users.is_active", true)
    .whereNot("users.id", userId)
    .count("users.id as count");
  if (parseInt(count, 10) === 0) {
    throw Object.assign(new Error("Cannot remove or deactivate the last active admin."), { status: 400 });
  }
}

async function update(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    const before = await db("users").where("id", userId).first();
    if (!before) return res.status(404).json({ success: false, error: "User not found" });
    if (userId === req.user.id && req.body.role_ids) {
      return res.status(400).json({ success: false, error: "Users cannot edit their own roles." });
    }
    await ensureNotLastAdmin(userId, req.body.role_ids || [], req.body.is_active);

    const result = await db.transaction(async (trx) => {
      const updateBody = {
        name: req.body.name,
        phone: req.body.phone || null,
        is_active: req.body.is_active !== undefined ? req.body.is_active : before.is_active,
        updated_by: req.user.id,
        updated_at: trx.fn.now(),
      };
      const [user] = await trx("users").where("id", userId).update(updateBody).returning("*");
      if (req.body.role_ids || req.body.department_ids) {
        const existingRoles = req.body.role_ids || (await trx("user_roles").where("user_id", userId).pluck("role_id"));
        const existingDepartments = req.body.department_ids || (await trx("user_departments").where("user_id", userId).pluck("department_id"));
        await syncAssignments(trx, userId, existingRoles, existingDepartments);
      }
      return user;
    });
    if (!result.is_active) await revokeUserRefreshTokens(userId);
    const [hydrated] = await hydrateUsers([result]);
    await auditLog(req, { action: "users.update", resource: "users", resourceId: userId, before: cleanUser(before), after: hydrated });
    res.json({ success: true, data: hydrated });
  } catch (err) { next(err); }
}

async function setActive(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    await ensureNotLastAdmin(userId, undefined, req.body.is_active);
    const [user] = await db("users").where("id", userId).update({
      is_active: !!req.body.is_active,
      updated_by: req.user.id,
      updated_at: db.fn.now(),
    }).returning("*");
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (!user.is_active) await revokeUserRefreshTokens(userId);
    await auditLog(req, { action: user.is_active ? "users.activate" : "users.deactivate", resource: "users", resourceId: user.id, after: cleanUser(user) });
    res.json({ success: true, data: cleanUser(user) });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const password_hash = await hashPassword(req.body.temporary_password || "ChangeMe123!");
    const [user] = await db("users").where("id", req.params.id).update({
      password_hash,
      must_change_password: true,
      updated_by: req.user.id,
      updated_at: db.fn.now(),
    }).returning("*");
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    await revokeUserRefreshTokens(user.id);
    await auditLog(req, { action: "users.password_reset", resource: "users", resourceId: user.id });
    res.json({ success: true, data: cleanUser(user) });
  } catch (err) { next(err); }
}

async function activity(req, res, next) {
  try {
    const rows = await db("audit_logs").where("actor_user_id", req.params.id).orderBy("created_at", "desc").limit(100);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, setActive, resetPassword, activity };
