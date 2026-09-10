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

// Map file path to system module domain
function analyzeFileArea(filePath) {
  const p = filePath.replace(/\\/g, "/").toLowerCase();
  if (p.includes("frontend/src/screens/systemconfig") || p.includes("systemconfig")) return "System Configuration & Auto-Sync";
  if (p.includes("frontend/src/screens/")) return "Frontend UI Module";
  if (p.includes("frontend/src/components/agents/")) return "Agent Status Telemetry";
  if (p.includes("frontend/src/components/")) return "Frontend UI Component";
  if (p.includes("frontend/src/api/") || p.includes("frontend/src/context/")) return "Frontend State & API Client";
  if (p.includes("backend/controllers/systemconfig") || p.includes("systemconfigcontroller")) return "System Config Controller";
  if (p.includes("backend/controllers/")) return "Backend API Controller";
  if (p.includes("backend/routes/")) return "API Route Endpoint";
  if (p.includes("backend/db/migrations/")) return "Database Relational Migration";
  if (p.includes("backend/db/seeds/")) return "Database Master Seed";
  if (p.includes("backend/tests/")) return "Automated Enterprise Test";
  if (p.includes("backend/services/") || p.includes("backend/middleware/")) return "Backend Service & Security Middleware";
  if (p.includes("docs/")) return "Enterprise Documentation";
  if (p.includes("package.json") || p.includes("vite.config") || p.includes(".env")) return "Build, Environment & Config";
  return "Core System Asset";
}

// Parse porcelain or name-status lines into rich file descriptor objects
function parseGitFileStatus(line, isNameStatus = false) {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  let code = "M";
  let filePath = trimmed;

  if (isNameStatus) {
    const parts = trimmed.split(/\s+/);
    code = parts[0] || "M";
    filePath = parts.slice(1).join(" ");
  } else {
    // git status --porcelain format (first 2 chars are status)
    code = line.slice(0, 2).trim();
    filePath = line.slice(2).trim();
  }

  filePath = filePath.replace(/^"|"$/g, "");

  let status = "MODIFIED";
  let statusLabel = "Modified";
  let color = "#3b82f6";

  if (code.includes("?") || code === "A" || code.startsWith("A")) {
    status = "ADDED";
    statusLabel = "New / Added";
    color = "#10b981";
  } else if (code.includes("D")) {
    status = "DELETED";
    statusLabel = "Deleted";
    color = "#ef4444";
  } else if (code.includes("R")) {
    status = "RENAMED";
    statusLabel = "Renamed";
    color = "#8b5cf6";
  }

  return {
    raw_code: code,
    status,
    status_label: statusLabel,
    color,
    path: filePath,
    filename: path.basename(filePath),
    area: analyzeFileArea(filePath),
  };
}

// Automatically analyze changed files and infer functionalities
function detectFunctionalities(fileList, customMessage = "") {
  const funcs = new Set();
  const filePaths = (fileList || []).map((f) => (typeof f === "string" ? f : f.path || "")).join(" ").toLowerCase();
  const msgLower = (customMessage || "").toLowerCase();

  if (filePaths.includes("systemconfig") || filePaths.includes("system_config") || filePaths.includes("patches") || msgLower.includes("system config") || msgLower.includes("sync")) {
    funcs.add("System Configuration & GitHub Auto-Sync Engine");
  }
  if (filePaths.includes("auth") || filePaths.includes("rbac") || filePaths.includes("permission") || filePaths.includes("login") || msgLower.includes("auth")) {
    funcs.add("Enterprise Auth, RBAC & Multi-Role Security Protocols");
  }
  if (filePaths.includes("stock") || filePaths.includes("reconciliation") || filePaths.includes("ledger") || msgLower.includes("stock")) {
    funcs.add("Multi-Agent Stock Reconciliation & Double-Entry Ledger System");
  }
  if (filePaths.includes("indent") || filePaths.includes("issuance") || filePaths.includes("recipe") || msgLower.includes("indent")) {
    funcs.add("Kitchen Indents, Portion Planning & Batch Issuance Processing");
  }
  if (filePaths.includes("purchase") || filePaths.includes("supplier") || filePaths.includes("grn") || filePaths.includes("po") || msgLower.includes("po")) {
    funcs.add("Procure-to-Pay (P2P), Suppliers & PO Management");
  }
  if (filePaths.includes("cmms") || filePaths.includes("kitchen_assets") || msgLower.includes("cmms") || msgLower.includes("maintenance")) {
    funcs.add("Kitchen Assets & Preventive Maintenance (CMMS)");
  }
  if (filePaths.includes("gate") || filePaths.includes("utilities") || msgLower.includes("gate") || msgLower.includes("utilities")) {
    funcs.add("Security Gate Passes & Daily Utility Meter Tracking");
  }
  if (filePaths.includes("migration") || filePaths.includes("db/")) {
    funcs.add("Database Relational Schema Evolution & Data Integrity");
  }
  if (filePaths.includes("test") || filePaths.includes("tests/")) {
    funcs.add("Continuous Integration & Automated Test Suite Verification");
  }
  if (filePaths.includes("frontend") || filePaths.includes("screens/") || filePaths.includes("components/")) {
    funcs.add("Interactive Responsive UI/UX & Modal Feedback Flow");
  }

  if (funcs.size === 0) {
    funcs.add("General System Maintenance, Code Refactoring & Enhancements");
  }

  return Array.from(funcs);
}

// GET /api/system/config
exports.getConfig = async (req, res) => {
  try {
    const configs = await db("system_configs").select("*");
    const configMap = {};
    configs.forEach((c) => {
      configMap[c.config_key] = c.config_value;
    });

    // Git repository metadata
    const branchRes = await runGit("git rev-parse --abbrev-ref HEAD");
    const hashRes = await runGit("git rev-parse --short HEAD");
    const fullHashRes = await runGit("git rev-parse HEAD");
    const remoteRes = await runGit("git remote get-url origin");
    const countRes = await runGit("git rev-list --count HEAD");
    const headDateRes = await runGit("git log -1 --format=%ci HEAD");
    const headMsgRes = await runGit("git log -1 --format=%s HEAD");
    const statusRes = await runGit("git status --porcelain");

    // Parse uncommitted files
    const uncommittedFiles = [];
    if (statusRes.stdout) {
      statusRes.stdout
        .split("\n")
        .filter(Boolean)
        .forEach((line) => {
          const parsed = parseGitFileStatus(line, false);
          if (parsed) uncommittedFiles.push(parsed);
        });
    }

    const uncommittedFunctionalities = detectFunctionalities(uncommittedFiles);

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
      .limit(15);

    return res.json({
      success: true,
      data: {
        app_version: configMap.app_version || "v1.4.2",
        git_auto_pull_enabled: configMap.git_auto_pull_enabled === "true",
        git_branch: branchRes.stdout || configMap.git_branch || "main",
        git_head_hash: hashRes.stdout || "—",
        git_head_full_hash: fullHashRes.stdout || "—",
        git_head_commit_number: parseInt(countRes.stdout || "0", 10),
        git_head_commit_date: headDateRes.stdout || null,
        git_head_commit_message: headMsgRes.stdout || "",
        git_remote_url: remoteRes.stdout || "origin",
        has_uncommitted_changes: uncommittedFiles.length > 0,
        uncommitted_files: uncommittedFiles,
        uncommitted_files_count: uncommittedFiles.length,
        uncommitted_functionalities: uncommittedFunctionalities,
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
      `git log HEAD..origin/${targetBranch} --pretty=format:"%h|%H|%an|%ci|%s"`
    );

    const incomingCommits = [];
    const allIncomingFiles = [];

    if (logRes.stdout) {
      const lines = logRes.stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        const [hash, fullHash, author, date, message] = line.split("|");

        // Inspect files changed for each commit
        const showRes = await runGit(`git show --name-status --oneline ${hash}`);
        const commitFiles = [];
        if (showRes.stdout) {
          showRes.stdout
            .split("\n")
            .slice(1) // skip the oneline commit header
            .filter(Boolean)
            .forEach((fl) => {
              const parsed = parseGitFileStatus(fl, true);
              if (parsed) {
                commitFiles.push(parsed);
                if (!allIncomingFiles.some((af) => af.path === parsed.path)) {
                  allIncomingFiles.push(parsed);
                }
              }
            });
        }

        const countRes = await runGit(`git rev-list --count ${hash}`);
        const commitNumber = parseInt(countRes.stdout || "0", 10);
        const commitFuncs = detectFunctionalities(commitFiles, message);

        incomingCommits.push({
          hash,
          full_hash: fullHash || hash,
          commit_number: commitNumber,
          author,
          date,
          message,
          files_changed_count: commitFiles.length,
          files: commitFiles,
          functionalities: commitFuncs,
        });
      }
    }

    const overallFunctionalities = detectFunctionalities(allIncomingFiles);

    return res.json({
      success: true,
      data: {
        target_branch: targetBranch,
        has_updates: incomingCommits.length > 0,
        incoming_commits_count: incomingCommits.length,
        incoming_commits: incomingCommits,
        incoming_files_count: allIncomingFiles.length,
        incoming_files: allIncomingFiles,
        functionalities: overallFunctionalities,
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
    const afterFullHashRes = await runGit("git rev-parse HEAD");

    const hasNewCommits = beforeHash !== afterHash;
    const pulledPatches = [];
    const allPulledFiles = [];

    if (hasNewCommits) {
      const logRes = await runGit(
        `git log ${beforeHash}..${afterHash} --pretty=format:"%h|%H|%an|%ci|%s"`
      );

      if (logRes.stdout) {
        const lines = logRes.stdout.split("\n").filter(Boolean);
        for (const line of lines) {
          const [hash, fullHash, author, date, message] = line.split("|");

          // Get files changed with status for this commit
          const showRes = await runGit(`git show --name-status --oneline ${hash}`);
          const commitFiles = [];
          if (showRes.stdout) {
            showRes.stdout
              .split("\n")
              .slice(1)
              .filter(Boolean)
              .forEach((fl) => {
                const parsed = parseGitFileStatus(fl, true);
                if (parsed) {
                  commitFiles.push(parsed);
                  if (!allPulledFiles.some((af) => af.path === parsed.path)) {
                    allPulledFiles.push(parsed);
                  }
                }
              });
          }

          const countRes = await runGit(`git rev-list --count ${hash}`);
          const commitNumber = parseInt(countRes.stdout || "0", 10);
          const funcs = detectFunctionalities(commitFiles, message);

          // Register patch in system_patches table if not already present
          const existing = await db("system_patches").where("commit_hash", hash).first();
          if (!existing) {
            const [inserted] = await db("system_patches")
              .insert({
                commit_hash: hash,
                full_hash: fullHash || hash,
                commit_number: commitNumber,
                commit_timestamp: date || new Date().toISOString(),
                commit_message: message || "GitHub sync update",
                author: author || "GitHub Developer",
                commit_date: (date || "").slice(0, 10),
                files_changed_count: commitFiles.length,
                files_list: JSON.stringify(commitFiles),
                functionalities: JSON.stringify(funcs),
                status: "PENDING",
                pulled_at: db.fn.now(),
              })
              .returning("id");

            const newId = typeof inserted === "object" ? inserted.id : inserted;
            pulledPatches.push({
              id: newId,
              commit_hash: hash,
              full_hash: fullHash || hash,
              commit_number: commitNumber,
              commit_timestamp: date,
              commit_message: message,
              author,
              files_changed_count: commitFiles.length,
              files_list: commitFiles,
              functionalities: funcs,
            });
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
          const funcsSummary = detectFunctionalities(allPulledFiles).join(", ");
          await sendNotification({
            recipient_role_id: adminRole.id,
            title: "GitHub Updates Pulled",
            message: `${pulledPatches.length} commit patch(es) pulled (${beforeHash} → ${afterHash}). Files: ${allPulledFiles.length}. Functionality: ${funcsSummary}. Review and select patches to apply.`,
            type: "system_update",
            severity: "warning",
          });
        }
      } catch (notifyErr) {
        console.error("Failed to send pull notification:", notifyErr.message);
      }
    }

    const overallFunctionalities = detectFunctionalities(allPulledFiles);

    return res.json({
      success: true,
      data: {
        branch: targetBranch,
        before_hash: beforeHash,
        after_hash: afterHash,
        after_full_hash: afterFullHashRes.stdout,
        has_new_commits: hasNewCommits,
        pulled_patches_count: pulledPatches.length,
        pulled_patches: pulledPatches,
        pulled_files_count: allPulledFiles.length,
        pulled_files: allPulledFiles,
        functionalities: overallFunctionalities,
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
      if (migrations && migrations.length > 0) {
        migrationStatus = `Migrated batch ${batch}: ${migrations.join(", ")}`;
      }
    } catch (migErr) {
      migrationStatus = `Migration notice: ${migErr.message}`;
    }

    // Update app version string
    const currentVerConfig = await db("system_configs").where("config_key", "app_version").first();
    let currentVer = currentVerConfig?.config_value || "v1.4.2";
    const verMatch = currentVer.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    let newVer = currentVer;
    if (verMatch) {
      const major = verMatch[1];
      const minor = verMatch[2];
      const patchNum = parseInt(verMatch[3], 10) + 1;
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
    const { commit_message, functional_category } = req.body;
    const branchRes = await runGit("git rev-parse --abbrev-ref HEAD");
    const targetBranch = branchRes.stdout || "main";

    // 1. Inspect uncommitted files before staging
    const statusRes = await runGit("git status --porcelain");
    const filesToPush = [];
    if (statusRes.stdout) {
      statusRes.stdout
        .split("\n")
        .filter(Boolean)
        .forEach((line) => {
          const parsed = parseGitFileStatus(line, false);
          if (parsed) filesToPush.push(parsed);
        });
    }

    if (filesToPush.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No local modifications or uncommitted files found to push to GitHub.",
      });
    }

    const detectedFuncs = detectFunctionalities(filesToPush, commit_message);
    if (functional_category && !detectedFuncs.includes(functional_category)) {
      detectedFuncs.unshift(functional_category);
    }

    // 2. Stage all changes
    const addRes = await runGit("git add -A");
    if (!addRes.ok) {
      return res.status(400).json({ success: false, error: `Git add failed: ${addRes.error}` });
    }

    const defaultMsg = `feat(kapila): enterprise system update - ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    const finalMsg = (commit_message || defaultMsg).replace(/"/g, '\\"');

    // 3. Commit
    const commitRes = await runGit(`git commit -m "${finalMsg}"`);
    if (!commitRes.ok && !commitRes.stdout.includes("nothing to commit")) {
      return res.status(400).json({
        success: false,
        error: `Git commit failed: ${commitRes.stderr || commitRes.error}`,
      });
    }

    // 4. Push to remote
    const pushRes = await runGit(`git push origin ${targetBranch}`);
    if (!pushRes.ok) {
      return res.status(400).json({
        success: false,
        error: `Git push failed: ${pushRes.stderr || pushRes.error}`,
      });
    }

    // 5. Gather commit hash, full SHA, count, timestamp
    const newHashRes = await runGit("git rev-parse --short HEAD");
    const newFullHashRes = await runGit("git rev-parse HEAD");
    const newCountRes = await runGit("git rev-list --count HEAD");
    const commitDateRes = await runGit("git log -1 --format=%ci HEAD");
    const authorRes = await runGit("git log -1 --format=%an HEAD");

    const commitNumber = parseInt(newCountRes.stdout || "0", 10);
    const completeDateTime = commitDateRes.stdout || new Date().toISOString();

    // Audit log
    await db("audit_logs").insert({
      action: "PUSH_GITHUB_UPDATES",
      resource: "github_sync",
      resource_id: newHashRes.stdout,
      metadata: JSON.stringify({
        commit_hash: newHashRes.stdout,
        full_hash: newFullHashRes.stdout,
        commit_number: commitNumber,
        commit_timestamp: completeDateTime,
        commit_message: finalMsg,
        branch: targetBranch,
        files_count: filesToPush.length,
        files: filesToPush.map((f) => f.path),
        functionalities: detectedFuncs,
      }),
      actor_name: req.user?.name || "System Admin",
      created_at: db.fn.now(),
    });

    return res.json({
      success: true,
      data: {
        branch: targetBranch,
        commit_hash: newHashRes.stdout,
        full_hash: newFullHashRes.stdout,
        commit_number: commitNumber,
        commit_timestamp: completeDateTime,
        commit_message: finalMsg,
        author: authorRes.stdout || "Developer",
        files_pushed_count: filesToPush.length,
        files_pushed: filesToPush,
        functionalities: detectedFuncs,
        git_output: pushRes.stdout,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
