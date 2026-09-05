const db = require("../db");

// Role keys to notify — change here, not in individual cron files.
// Add "store_manager" here if that role is created later.
const RECIPIENT_ROLE_KEYS = {
    manager: "manager",
    admin: "admin",
    chef: "chef",
};

// Resolves a single role key to its live DB ID.
// Logs a clear error if not found. Does NOT throw — cron must continue.
async function resolveRoleId(roleKey, cronName) {
    const role = await db("roles").where({ key: roleKey }).first();
    if (!role) {
        console.error(
            `[${cronName}] WARNING: Role key "${roleKey}" not found in roles table. Notification for this role skipped.`
        );
        return null;
    }
    return role.id;
}

// Resolves multiple role keys at once. Skips missing ones without throwing.
// IMPORTANT: call this ONCE per cron run, before any notification loop —
// not inside a per-item loop, to avoid redundant DB queries.
async function resolveRoleIds(roleKeys, cronName) {
    const results = await Promise.all(
        roleKeys.map((key) => resolveRoleId(key, cronName))
    );
    return results.filter((id) => id !== null);
}

module.exports = { resolveRoleId, resolveRoleIds, RECIPIENT_ROLE_KEYS };