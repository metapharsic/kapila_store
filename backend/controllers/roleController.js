const db = require("../db");
const { auditLog } = require("../services/auditService");

async function list(req, res, next) {
  try {
    const roles = await db("roles").orderBy("name");
    const roleIds = roles.map((r) => r.id);
    const permissions = roleIds.length
      ? await db("permissions")
        .join("role_permissions", "role_permissions.permission_id", "permissions.id")
        .whereIn("role_permissions.role_id", roleIds)
        .select("role_permissions.role_id", "permissions.id", "permissions.key", "permissions.label")
      : [];
    res.json({
      success: true,
      data: roles.map((role) => ({
        ...role,
        permissions: permissions.filter((p) => p.role_id === role.id).map(({ role_id, ...p }) => p),
      })),
    });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { key, name, description, permission_ids = [] } = req.body;
    const role = await db.transaction(async (trx) => {
      const [row] = await trx("roles").insert({ key, name, description: description || null, is_system: false }).returning("*");
      if (permission_ids.length) {
        await trx("role_permissions").insert(permission_ids.map((permission_id) => ({ role_id: row.id, permission_id })));
      }
      return row;
    });
    await auditLog(req, { action: "roles.create", resource: "roles", resourceId: role.id, after: role });
    res.status(201).json({ success: true, data: role });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, description, is_active, permission_ids } = req.body;
    const before = await db("roles").where("id", req.params.id).first();
    if (!before) return res.status(404).json({ success: false, error: "Role not found" });
    const role = await db.transaction(async (trx) => {
      const [row] = await trx("roles").where("id", req.params.id).update({
        name: name || before.name,
        description: description !== undefined ? description : before.description,
        is_active: is_active !== undefined ? is_active : before.is_active,
        updated_at: trx.fn.now(),
      }).returning("*");
      if (permission_ids) {
        await trx("role_permissions").where("role_id", row.id).del();
        if (permission_ids.length) {
          await trx("role_permissions").insert(permission_ids.map((permission_id) => ({ role_id: row.id, permission_id })));
        }
      }
      return row;
    });
    await auditLog(req, { action: "roles.update", resource: "roles", resourceId: role.id, before, after: role });
    res.json({ success: true, data: role });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const role = await db("roles").where("id", req.params.id).first();
    if (!role) return res.status(404).json({ success: false, error: "Role not found" });
    if (role.is_system) return res.status(400).json({ success: false, error: "System roles cannot be deleted" });
    await db("roles").where("id", role.id).del();
    await auditLog(req, { action: "roles.delete", resource: "roles", resourceId: role.id, before: role });
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, remove };
