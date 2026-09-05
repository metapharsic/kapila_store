const db = require("../db");

async function cleanup() {
  try {
    const deleted = await db("refresh_tokens")
      .where("expires_at", "<", new Date())
      .orWhereNotNull("revoked_at")
      .delete();
    console.log(`Cleaned up ${deleted} expired or revoked refresh tokens.`);
  } catch (err) {
    console.error("Error cleaning up tokens:", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

cleanup();
