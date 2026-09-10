const db = require("../db");
const systemConfigController = require("../controllers/systemConfigController");

describe("System Configuration & GitHub Patch Management", () => {
  afterAll(async () => {
    await db.destroy();
  });

  it("has seeded default system configurations", async () => {
    const configs = await db("system_configs").select("*");
    const configMap = {};
    configs.forEach((c) => {
      configMap[c.config_key] = c.config_value;
    });

    expect(configMap.app_version).toBeDefined();
    expect(configMap.git_branch).toBe("main");
  });

  it("successfully retrieves system configuration via controller", async () => {
    const req = {};
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await systemConfigController.getConfig(req, res);

    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data.app_version).toBeDefined();
    expect(result.data.git_branch).toBeDefined();
    expect(Array.isArray(result.data.pending_patches)).toBe(true);
  });

  it("registers a pending patch and applies it successfully with version bump", async () => {
    // 1. Insert a mock pending patch
    const testHash = "a1b2c3d";
    await db("system_patches").where("commit_hash", testHash).del();

    const [inserted] = await db("system_patches").insert({
      commit_hash: testHash,
      commit_message: "feat: automated sync update test",
      author: "Test Developer",
      commit_date: "2026-09-11",
      files_changed_count: 3,
      status: "PENDING",
      pulled_at: db.fn.now(),
    }).returning("id");

    const patchId = typeof inserted === "object" ? inserted.id : inserted;
    expect(patchId).toBeDefined();

    // 2. Apply patch via controller
    const req = {
      body: { patch_ids: [patchId] },
      user: { name: "Test Auditor" },
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await systemConfigController.applyPatches(req, res);

    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data.applied_count).toBe(1);
    expect(result.data.new_version).toBeDefined();

    // Verify patch status is now APPLIED
    const updatedPatch = await db("system_patches").where("id", patchId).first();
    expect(updatedPatch.status).toBe("APPLIED");
    expect(updatedPatch.applied_by).toBe("Test Auditor");

    // Verify audit log entry was created
    const audit = await db("audit_logs")
      .where("action", "APPLY_GITHUB_PATCHES")
      .orderBy("id", "desc")
      .first();
    expect(audit).toBeDefined();
  });

  it("stores and queries enriched patch metadata with commit numbers, file lists, and functionality", async () => {
    const testHash = "b7c8d9e";
    await db("system_patches").where("commit_hash", testHash).del();

    const filesList = [
      { path: "frontend/src/screens/SystemConfig/index.jsx", status: "MODIFIED", area: "System Configuration & Auto-Sync" },
      { path: "backend/controllers/systemConfigController.js", status: "MODIFIED", area: "System Config Controller" }
    ];
    const funcs = ["System Configuration & GitHub Auto-Sync Engine", "Interactive Responsive UI/UX & Modal Feedback Flow"];

    const [inserted] = await db("system_patches").insert({
      commit_hash: testHash,
      full_hash: "b7c8d9e1234567890abcdef1234567890abcdef1",
      commit_number: 7,
      commit_timestamp: "2026-09-11 05:25:00 +0530",
      commit_message: "feat: enriched push/pull with progress and files",
      author: "Test Engineer",
      commit_date: "2026-09-11",
      files_changed_count: 2,
      files_list: JSON.stringify(filesList),
      functionalities: JSON.stringify(funcs),
      status: "PENDING",
      pulled_at: db.fn.now(),
    }).returning("id");

    const patchId = typeof inserted === "object" ? inserted.id : inserted;
    const patch = await db("system_patches").where("id", patchId).first();

    expect(patch.commit_number).toBe(7);
    expect(patch.full_hash).toContain("b7c8d9e");
    expect(patch.commit_timestamp).toBeDefined();
    expect(patch.files_changed_count).toBe(2);

    // Clean up
    await db("system_patches").where("id", patchId).del();
  });
});
