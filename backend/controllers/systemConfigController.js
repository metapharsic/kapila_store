const { exec } = require("child_process");
const util = require("util");
const path = require("path");
const db = require("../db");
const execAsync = util.promisify(exec);

const REPO_ROOT = path.resolve(__dirname, "../../");

async function runGit(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: REPO_ROOT });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return { ok: false, error: err.message, stdout: err.stdout?.trim() || "", stderr: err.stderr?.trim() || "" };
  }
}

// GET /api/system/config
exports.getConfig = async (req, res) => {
  try {
    const configs = await db("system_configs").select("*");
    const configMap = {};
    configs.forEach((c) => {
      configMap[c.config_key] = c.config_value;
    });

    // Fetch Git repository metadata
    const branchRes = await runGit("git rev-parse --abbrev-ref HEAD");
    const hashRes = await runGit("git rev-parse --short HEAD");
    const remoteRes = await runGit("git remote get-url origin");
    const statusRes = await runGit("git status --short");

    const pendingPatchesCount = await db("system_patches")
      .where("status", "PENDING")
      .count("id as count")
      .first();

    const pendingPatches = await db("system_patches")
      .where("status", "PENDING")
      .orderBy("id", "desc");

    const appliedPatches = await db("system_patches")
      .where("status", "APPLIED")
      .orderBy("id", "desc")
      .limit(10);

    return res.json({
      success: true,
      data: {
        app_version: configMap.app_version || "v1.4.2",
        git_auto_pull_enabled: configMap.git_auto_pull_enabled === "true",
        git_branch: branchRes.stdout || configMap.git_branch || "main",
        git_head_hash: hashRes.stdout || "—",
        git_remote_url: remoteRes.stdout || "origin",
        has_uncommitted_changes: !!statusRes.stdout,
        uncommitted_files: statusRes.stdout ? statusRes.stdout.split("\n").filter(Boolean) : [],
        last_git_sync_at: configMap.last_git_sync_at || null,
        pending_patches_count: parseInt(pendingPatchesCount?.count || 0),
        pending_patches: pendingPatches,
        applied_patches: appliedPatches,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/system/check-updates
exports.checkGitHubUpdates = async (req, res) => {
  try {
    const branchRes = await runGit("git rev-parse --abbrev-ref HEAD");
    const targetBranch = branchRes.stdout || "main";

    // Fetch remote branch
    const fetchRes = await runGit(`git fetch origin ${targetBranch}`);
    if (!fetchRes.ok) {
      return res.status(400).json({
        success: false,
        error: `Git fetch failed: ${fetchRes.stderr || fetchRes.error}`,
      });
    }

    // Compare local HEAD vs origin/branch
    const logRes = await runGit(
      `git log HEAD..origin/${targetBranch} --pretty=format:"%h|%an|%ad|%s" --date=short`
    );

    const incomingCommits = [];
    if (logRes.stdout) {
      const lines = logRes.stdout.split("\n").filter(Boolean);
      lines.forEach((line) => {
        const [hash, author, date, message] = line.split("|");
        incomingCommits.push({ hash, author, date, message });
      });
    }

    return res.json({
      success: true,
      data: {
        target_branch: targetBranch,
        has_updates: incomingCommits.length > 0,
        incoming_commits_count: incomingCommits.length,
        incoming_commits: incomingCommits,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/system/pull-updates
exports.pullGitHubUpdates = async (req, res) => {
  try {
    const branchRes = await runGit("git rev-parse --abbrev-ref HEAD");
    const targetBranch = branchRes.stdout || "main";

    const beforeHashRes = await runGit("git rev-parse --short HEAD");
    const beforeHash = beforeHashRes.stdout;

    // Pull from GitHub
    const pullRes = await runGit(`git pull origin ${targetBranch}`);
    if (!pullRes.ok) {
      return res.status(400).json({
        success: false,
        error: `Git pull failed: ${pullRes.stderr || pullRes.error}`,
      });
    }

    const afterHashRes = await runGit("git rev-parse --short HEAD");
    const afterHash = afterHashRes.stdout;

    const hasNewCommits = beforeHash !== afterHash;
    const pulledPatches = [];

    if (hasNewCommits) {
      const logRes = await runGit(
        `git log ${beforeHash}..${afterHash} --pretty=format:"%h|%an|%ad|%s" --date=short`
      );

      if (logRes.stdout) {
        const lines = logRes.stdout.split("\n").filter(Boolean);
        for (const line of lines) {
          const [hash, author, date, message] = line.split("|");
          
          // Get files changed count for this commit
          const statRes = await runGit(`git show --stat --oneline ${hash}`);
          const fileLines = (statRes.stdout || "").split("\n").filter((l) => l.includes("|"));

          // Register patch in system_patches table if not already present
          const existing = await db("system_patches").where("commit_hash", hash).first();
          if (!existing) {
            const [inserted] = await db("system_patches").insert({
              commit_hash: hash,
              commit_message: message || "GitHub sync update",
              author: author || "GitHub Developer",
              commit_date: date || new Date().toISOString().slice(0, 10),
              files_changed_count: fileLines.length,
              status: "PENDING",
              pulled_at: db.fn.now(),
            }).returning("id");
            const newId = typeof inserted === "object" ? inserted.id : inserted;
            pulledPatches.push({ id: newId, commit_hash: hash, commit_message: message, author, files_changed_count: fileLines.length });
          }
        }
      }

      // Update system configuration timestamp
      const nowStr = new Date().toISOString();
      await db("system_configs")
        .where("config_key", "last_git_sync_at")
        .update({ config_value: nowStr, updated_at: db.fn.now() });

      // Create a system notification to alert users
      try {
        const { sendNotification } = require("./notificationController");
        const adminRole = await db("roles").where({ key: "admin" }).first();
        if (adminRole) {
          await sendNotification({
            recipient_role_id: adminRole.id,
            title: "GitHub Updates Pulled",
            message: `${lines.length} new commit patch(es) pulled from GitHub (${beforeHash} → ${afterHash}). Review and select patches to apply in System Configuration.`,
            type: "system_update",
            severity: "warning",
          });
        }
      } catch (notifyErr) {
        console.error("Failed to send pull notification:", notifyErr.message);
      }
    }

    return res.json({
      success: true,
      data: {
        branch: targetBranch,
        before_hash: beforeHash,
        after_hash: afterHash,
        has_new_commits: hasNewCommits,
        pulled_patches_count: pulledPatches.length,
        pulled_patches: pulledPatches,
        git_output: pullRes.stdout,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/system/apply-patches
exports.applyPatches = async (req, res) => {
  try {
    const { patch_ids } = req.body;
    let query = db("system_patches").where("status", "PENDING");

    if (Array.isArray(patch_ids) && patch_ids.length > 0) {
      query = query.whereIn("id", patch_ids);
    }

    const pendingPatches = await query;
    if (pendingPatches.length === 0) {
      return res.status(400).json({ success: false, error: "No pending patches selected to apply." });
    }

    const appliedIds = [];
    const userName = req.user?.name || "System Admin";

    for (const patch of pendingPatches) {
      await db("system_patches")
        .where("id", patch.id)
        .update({
          status: "APPLIED",
          applied_at: db.fn.now(),
          applied_by: userName,
        });
      appliedIds.push(patch.id);
    }

    // Auto-run database migrations if new migrations were pulled
    let migrationStatus = "No new migrations";
    try {
      const [batch, migrations] = await db.migrate.latest();
      if (migrations.length > 0) {
        migrationStatus = `Migrated batch ${batch}: ${migrations.join(", ")}`;
      }
    } catch (migErr) {
      migrationStatus = `Migration notice: ${migErr.message}`;
    }

    // Update app version string (e.g. bump patch version v1.4.2 -> v1.4.3 or attach latest hash)
    const currentVerConfig = await db("system_configs").where("config_key", "app_version").first();
    let currentVer = currentVerConfig?.config_value || "v1.4.2";
    const verMatch = currentVer.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    let newVer = currentVer;
    if (verMatch) {
      const major = verMatch[1];
      const minor = verMatch[2];
      const patchNum = parseInt(verMatch[3]) + 1;
      newVer = `v${major}.${minor}.${patchNum}`;
      await db("system_configs")
        .where("config_key", "app_version")
        .update({ config_value: newVer, updated_at: db.fn.now() });
    }

    // Log in audit_logs
    await db("audit_logs").insert({
      action: "APPLY_GITHUB_PATCHES",
      resource: "system_patches",
      resource_id: String(appliedIds.join(",")),
      metadata: JSON.stringify({
        applied_patch_ids: appliedIds,
        patches_count: appliedIds.length,
        new_version: newVer,
        migration_status: migrationStatus,
      }),
      actor_name: userName,
      created_at: db.fn.now(),
    });

    return res.json({
      success: true,
      data: {
        applied_count: appliedIds.length,
        applied_patch_ids: appliedIds,
        previous_version: currentVer,
        new_version: newVer,
        migration_status: migrationStatus,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/system/push-updates
exports.pushGitHubUpdates = async (req, res) => {
  try {
    const { commit_message } = req.body;
    const branchRes = await runGit("git rev-parse --abbrev-ref HEAD");
    const targetBranch = branchRes.stdout || "main";

    // Stage all changes
    const addRes = await runGit("git add -A");
    if (!addRes.ok) {
      return res.status(400).json({ success: false, error: `Git add failed: ${addRes.error}` });
    }

    const defaultMsg = `sync: kapila ims automated update ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const finalMsg = (commit_message || defaultMsg).replace(/"/g, '\\"');

    // Commit
    const commitRes = await runGit(`git commit -m "${finalMsg}"`);
    // Note: if git commit has nothing to commit, it will return non-zero exit code, which is okay

    // Push to remote
    const pushRes = await runGit(`git push origin ${targetBranch}`);
    if (!pushRes.ok) {
      return res.status(400).json({
        success: false,
        error: `Git push failed: ${pushRes.stderr || pushRes.error}`,
      });
    }

    const newHashRes = await runGit("git rev-parse --short HEAD");

    return res.json({
      success: true,
      data: {
        branch: targetBranch,
        commit_hash: newHashRes.stdout,
        commit_message: finalMsg,
        git_output: pushRes.stdout,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
