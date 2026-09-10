import { useState, useEffect } from "react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import * as api from "../../api";
import SystemConfigAgentStatusBar from "../../components/agents/SystemConfigAgentStatusBar";
import { 
  GitBranch, GitPullRequest, GitCommit, RefreshCw, Download, Upload, 
  CheckCircle2, AlertTriangle, ShieldCheck, Clock, FileCode, Check, Layers,
  Sparkles
} from "lucide-react";

export default function SystemConfigScreen() {
  const [configData, setConfigData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Update check states
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState(null);

  // Pull states
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState(null);

  // Push states
  const [pushing, setPushing] = useState(false);
  const [commitMsgInput, setCommitMsgInput] = useState("");
  const [showPushModal, setShowPushModal] = useState(false);

  // Patch selection states
  const [selectedPatchIds, setSelectedPatchIds] = useState([]);
  const [applyingPatches, setApplyingPatches] = useState(false);
  const [patchFilter, setPatchFilter] = useState("PENDING"); // "PENDING" | "APPLIED" | "ALL"

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 4000);
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.systemConfig.getConfig();
      if (res.success) {
        setConfigData(res.data);
        // Pre-select all pending patches by default
        if (res.data.pending_patches) {
          setSelectedPatchIds(res.data.pending_patches.map((p) => p.id));
        }
      } else {
        setError(res.error || "Failed to load system configuration.");
      }
    } catch (err) {
      setError("Connection error loading system config.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // 1. Check for remote GitHub updates without modifying workspace
  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateCheckResult(null);
    try {
      const res = await api.systemConfig.checkUpdates();
      if (res.success) {
        setUpdateCheckResult(res.data);
        if (res.data.has_updates) {
          flash(`Found ${res.data.incoming_commits_count} new commit(s) on GitHub! Click "Pull from GitHub" to fetch patches.`, COLORS.accent);
        } else {
          flash("System is up to date with remote GitHub origin ✓", COLORS.success);
        }
      } else {
        flash(res.error || "Failed to check GitHub updates", COLORS.coral);
      }
    } catch (err) {
      flash("Error checking GitHub: " + err.message, COLORS.coral);
    } finally {
      setCheckingUpdates(false);
    }
  };

  // 2. Automatically pull updates from GitHub
  const handlePullUpdates = async () => {
    setPulling(true);
    setPullResult(null);
    try {
      const res = await api.systemConfig.pullUpdates();
      if (res.success) {
        setPullResult(res.data);
        if (res.data.has_new_commits) {
          flash(`Successfully pulled ${res.data.pulled_patches_count} commit patch(es) from GitHub! Review and click "Apply Selected Patches".`, COLORS.success);
        } else {
          flash("No new commits on remote — workspace is already up to date.", COLORS.brand);
        }
        await loadConfig();
      } else {
        flash(res.error || "Failed to pull from GitHub", COLORS.coral);
      }
    } catch (err) {
      flash("Pull error: " + err.message, COLORS.coral);
    } finally {
      setPulling(false);
    }
  };

  // 3. Apply selected patches
  const handleApplyPatches = async () => {
    if (selectedPatchIds.length === 0) {
      return flash("Select at least one commit patch to apply.", COLORS.coral);
    }
    setApplyingPatches(true);
    try {
      const res = await api.systemConfig.applyPatches(selectedPatchIds);
      if (res.success) {
        flash(`Applied ${res.data.applied_count} patch(es)! System version updated to ${res.data.new_version} (${res.data.migration_status}) ✓`, COLORS.success);
        setSelectedPatchIds([]);
        await loadConfig();
      } else {
        flash(res.error || "Failed to apply patches.", COLORS.coral);
      }
    } catch (err) {
      flash("Patch application error: " + err.message, COLORS.coral);
    } finally {
      setApplyingPatches(false);
    }
  };

  // 4. Push local commits to GitHub
  const handlePushUpdates = async () => {
    setPushing(true);
    try {
      const res = await api.systemConfig.pushUpdates(commitMsgInput);
      if (res.success) {
        flash(`Successfully committed and pushed commit ${res.data.commit_hash} to GitHub!`, COLORS.success);
        setShowPushModal(false);
        setCommitMsgInput("");
        await loadConfig();
      } else {
        flash(res.error || "Failed to push to GitHub.", COLORS.coral);
      }
    } catch (err) {
      flash("Push error: " + err.message, COLORS.coral);
    } finally {
      setPushing(false);
    }
  };

  const toggleSelectPatch = (id) => {
    setSelectedPatchIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!configData?.pending_patches) return;
    if (selectedPatchIds.length === configData.pending_patches.length) {
      setSelectedPatchIds([]);
    } else {
      setSelectedPatchIds(configData.pending_patches.map((p) => p.id));
    }
  };

  if (loading && !configData) {
    return (
      <Section title="System Configuration & GitHub Sync" sub="Automated GitHub version control & patch manager">
        <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Loading configuration environment...</div>
      </Section>
    );
  }

  const pendingPatches = configData?.pending_patches || [];
  const appliedPatches = configData?.applied_patches || [];

  return (
    <Section title="System Configuration & GitHub Sync" sub="Automated GitHub versioning, auto-sync, and 1-click patch deployment">
      {/* Swarm Telemetry */}
      <SystemConfigAgentStatusBar />

      {msg && <p style={{ color: msg.color, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{msg.text}</p>}
      {error && <ErrorMsg error={error} />}

      {/* Top Environment & Version Metrics Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
        <Card style={{ padding: 18, borderLeft: `4px solid ${COLORS.accent}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              System Version
            </span>
            <Sparkles size={16} color={COLORS.accent} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>
            {configData?.app_version || "v1.4.2"}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Build release milestone</span>
        </Card>

        <Card style={{ padding: 18, borderLeft: `4px solid #3b82f6` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Git Active Branch
            </span>
            <GitBranch size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6", marginTop: 4 }}>
            {configData?.git_branch || "main"}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>HEAD commit: {configData?.git_head_hash || "—"}</span>
        </Card>

        <Card style={{ padding: 18, borderLeft: `4px solid ${pendingPatches.length > 0 ? COLORS.coral : COLORS.success}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Pending Patches
            </span>
            <GitPullRequest size={16} color={pendingPatches.length > 0 ? COLORS.coral : COLORS.success} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: pendingPatches.length > 0 ? COLORS.coral : COLORS.success, marginTop: 4 }}>
            {pendingPatches.length} commit{pendingPatches.length === 1 ? "" : "s"}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>
            {pendingPatches.length > 0 ? "Requires user selection & apply" : "All patches applied ✓"}
          </span>
        </Card>

        <Card style={{ padding: 18, borderLeft: `4px solid ${COLORS.purple}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Last Sync Timestamp
            </span>
            <Clock size={16} color={COLORS.purple} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 8 }}>
            {configData?.last_git_sync_at ? new Date(configData.last_git_sync_at).toLocaleString("en-IN") : "Not synced yet"}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>Remote GitHub repository</span>
        </Card>
      </div>

      {/* GitHub Sync Notification Banner (Triggers on pending patches) */}
      {pendingPatches.length > 0 && (
        <div
          style={{
            background: "rgba(232, 168, 56, 0.12)",
            border: `1px solid ${COLORS.accent}66`,
            borderRadius: 10,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={22} color={COLORS.accent} style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: 0, fontSize: 14, color: COLORS.accent, fontWeight: 700 }}>
                GitHub Sync Notification: {pendingPatches.length} New Commit Patch(es) Pulled & Available
              </h4>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: COLORS.muted }}>
                Latest code updates have been pulled automatically into the system staging queue. Select patches below and click "Apply Selected Patches" to integrate them.
              </p>
            </div>
          </div>
          <Btn
            onClick={handleApplyPatches}
            loading={applyingPatches}
            style={{ background: COLORS.accent, color: "#18181b", fontWeight: 700 }}
          >
            Apply {selectedPatchIds.length} Patch(es) Now →
          </Btn>
        </div>
      )}

      {/* Control Actions Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Left Action Box: Remote Pull & Check */}
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Download size={18} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
              GitHub Inward Sync (Pull & Check)
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: COLORS.muted, lineHeight: 1.4 }}>
            Fetch incoming commits from GitHub origin. Incoming updates will trigger live notifications and populate the selective patch table.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn
              variant="ghost"
              onClick={handleCheckUpdates}
              loading={checkingUpdates}
              icon={<RefreshCw size={14} />}
              style={{ flex: 1, border: `1px solid ${COLORS.border}` }}
            >
              Check GitHub Updates
            </Btn>
            <Btn
              onClick={handlePullUpdates}
              loading={pulling}
              icon={<Download size={14} />}
              style={{ flex: 1, background: "#3b82f6" }}
            >
              Pull from GitHub
            </Btn>
          </div>

          {updateCheckResult && (
            <div style={{ background: COLORS.bg, padding: 12, borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 11 }}>
              <strong style={{ color: COLORS.text }}>Remote Check Result:</strong>{" "}
              {updateCheckResult.has_updates ? (
                <span style={{ color: COLORS.accent, fontWeight: 700 }}>
                  {updateCheckResult.incoming_commits_count} new commits available on origin/{updateCheckResult.target_branch}
                </span>
              ) : (
                <span style={{ color: COLORS.success }}>Workspace matches origin/{updateCheckResult.target_branch} ✓</span>
              )}
            </div>
          )}
        </Card>

        {/* Right Action Box: Local Commit & Push */}
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Upload size={18} color={COLORS.success} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
              GitHub Outward Push Wizard
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: COLORS.muted, lineHeight: 1.4 }}>
            Stage local code modifications, auto-generate commit messages, and push updates directly to remote origin/{configData?.git_branch || "main"}.
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>
              Uncommitted Files: <strong>{configData?.uncommitted_files?.length || 0}</strong>
            </span>
            <Btn
              onClick={() => setShowPushModal(true)}
              icon={<Upload size={14} />}
              style={{ background: COLORS.success }}
            >
              Push to GitHub...
            </Btn>
          </div>
        </Card>
      </div>

      {/* Patch Selector Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileCode size={18} color={COLORS.brand} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
              System Commit Patches ({pendingPatches.length} Pending / {appliedPatches.length} Applied)
            </h3>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {["PENDING", "APPLIED", "ALL"].map((st) => (
                <button
                  key={st}
                  onClick={() => setPatchFilter(st)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 16,
                    fontSize: 11,
                    fontWeight: 600,
                    border: `1px solid ${patchFilter === st ? COLORS.brand : COLORS.border}`,
                    background: patchFilter === st ? COLORS.brand + "15" : "transparent",
                    color: patchFilter === st ? COLORS.brand : COLORS.muted,
                    cursor: "pointer",
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {pendingPatches.length > 0 && patchFilter !== "APPLIED" && (
              <>
                <Btn small variant="ghost" onClick={toggleSelectAll} style={{ fontSize: 11 }}>
                  {selectedPatchIds.length === pendingPatches.length ? "Deselect All" : "Select All"}
                </Btn>
                <Btn
                  small
                  onClick={handleApplyPatches}
                  loading={applyingPatches}
                  style={{ background: COLORS.accent, color: "#18181b", fontWeight: 700, fontSize: 12 }}
                >
                  Apply Selected ({selectedPatchIds.length})
                </Btn>
              </>
            )}
          </div>
        </div>

        <div className="resp-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                <th style={{ padding: "10px 14px", width: 40, textAlign: "center" }}></th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Commit Hash</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Commit Message</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Author</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Files</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let displayPatches = [];
                if (patchFilter === "PENDING") displayPatches = pendingPatches;
                else if (patchFilter === "APPLIED") displayPatches = appliedPatches;
                else displayPatches = [...pendingPatches, ...appliedPatches];

                if (displayPatches.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: COLORS.muted, padding: 32 }}>
                        No commit patches match the selected filter.
                      </td>
                    </tr>
                  );
                }

                return displayPatches.map((patch) => {
                  const isPending = patch.status === "PENDING";
                  const isChecked = selectedPatchIds.includes(patch.id);
                  return (
                    <tr
                      key={patch.id}
                      style={{
                        borderBottom: `1px solid ${COLORS.border}22`,
                        background: isChecked ? `${COLORS.accent}0D` : "transparent",
                      }}
                    >
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {isPending && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectPatch(patch.id)}
                            style={{ cursor: "pointer" }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: COLORS.brand, fontWeight: 700 }}>
                        {patch.commit_hash}
                      </td>
                      <td style={{ padding: "10px 14px", color: COLORS.text, fontWeight: 500 }}>
                        {patch.commit_message}
                      </td>
                      <td style={{ padding: "10px 14px", color: COLORS.muted, fontSize: 12 }}>
                        {patch.author || "Developer"}
                      </td>
                      <td style={{ padding: "10px 14px", color: COLORS.muted, fontSize: 12 }}>
                        {patch.files_changed_count} file(s)
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: isPending ? "rgba(232, 168, 56, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: isPending ? COLORS.accent : COLORS.success,
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          {isPending ? "PENDING" : "APPLIED"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: COLORS.muted, fontSize: 11 }}>
                        {patch.applied_at
                          ? new Date(patch.applied_at).toLocaleString("en-IN")
                          : new Date(patch.pulled_at).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Push Dialog Modal */}
      {showPushModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card style={{ maxWidth: 500, width: "100%", padding: 24 }}>
            <h3 style={{ marginTop: 0, fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>
              Push Local Changes to GitHub
            </h3>
            <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
              Target Branch: <strong style={{ color: COLORS.brand }}>origin/{configData?.git_branch || "main"}</strong>
            </p>

            <Input
              label="Commit Message (leave blank for timestamped message)"
              placeholder="e.g. feat: system configuration and github auto-sync"
              value={commitMsgInput}
              onChange={(e) => setCommitMsgInput(e.target.value)}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <Btn variant="ghost" onClick={() => setShowPushModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={handlePushUpdates} loading={pushing} style={{ background: COLORS.success }}>
                Commit & Push Now
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </Section>
  );
}
