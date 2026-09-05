const db = require("../db");
const bcrypt = require("bcryptjs");

async function runTests() {
  console.log("=== Testing Store Login & Admin Monitoring Flow ===");

  // 1. Check database store_sessions table and user pin_hash
  const users = await db("users").whereIn("employee_code", ["KPL-STORE", "KPL-CHEF", "KPL-ADM"]).select("id", "name", "email", "employee_code", "pin_hash");
  console.log("Found Users:", users.map(u => ({ code: u.employee_code, name: u.name, hasPin: !!u.pin_hash })));

  // Ensure store keeper has pin_hash for 1234
  let storeUser = users.find(u => u.employee_code === "KPL-STORE");
  if (storeUser && !storeUser.pin_hash) {
    const pinHash = await bcrypt.hash("1234", 10);
    await db("users").where("id", storeUser.id).update({ pin_hash: pinHash });
    console.log("Updated KPL-STORE with PIN 1234");
  }

  // 2. Test manual session creation & invalidation query
  const [session] = await db("store_sessions").insert({
    user_id: storeUser.id,
    terminal_code: "STORE-MAIN-TAB-01",
    shift_type: "Morning",
    status: "ACTIVE",
    login_at: db.fn.now(),
    last_ping_at: db.fn.now(),
  }).returning("*");
  console.log("Created Store Session:", { id: session.id, status: session.status, terminal: session.terminal_code });

  // 3. Test heartbeat ping
  await db("store_sessions").where("id", session.id).update({ last_ping_at: db.fn.now() });
  const updated = await db("store_sessions").where("id", session.id).first();
  console.log("Heartbeat Ping Updated:", { id: updated.id, last_ping_at: updated.last_ping_at });

  // 4. Test kill-switch termination
  await db("store_sessions").where("id", session.id).update({
    status: "TERMINATED_BY_ADMIN",
    terminated_reason: "Test kill-switch verification",
    logout_at: db.fn.now(),
  });
  const terminated = await db("store_sessions").where("id", session.id).first();
  console.log("Kill Switch Result:", { id: terminated.id, status: terminated.status, reason: terminated.terminated_reason });

  // Clean up test session
  await db("store_sessions").where("id", session.id).del();
  console.log("Test completed successfully!");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
