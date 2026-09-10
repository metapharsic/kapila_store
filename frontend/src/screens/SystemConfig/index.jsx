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
  Sparkles, FileText, ChevronRight, X, ExternalLink, Calendar, Hash, Tag,
  ArrowRight, Info
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
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStage, setPullStage] = useState("");
  const [pullResult, setPullResult] = useState(null);
  const [showPullModal, setShowPullModal] = useState(false);

  // Push states
  const [pushing, setPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState(0);
  const [pushStage, setPushStage] = useState("");
  const [commitMsgInput, setCommitMsgInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("feat");
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  // Patch selection states
  const [selectedPatchIds, setSelectedPatchIds] = useState([]);
  const [applyingPatches, setApplyingPatches] = useState(false);
  const [patchFilter, setPatchFilter] = useState("PENDING"); // "PENDING" | "APPLIED" | "ALL"
  const [inspectingPatch, setInspectingPatch] = useState(null);

  const flash = (text, color = COLORS.success) => {
    setMsg({ text, color });
    setTimeout(() => setMsg(""), 5000);
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.systemConfig.getConfig();
      if (res.success) {
        setConfigData(res.data);
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

  // Format date helper with complete time and weekday
  const formatCompleteDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // 1. Check for remote GitHub updates
  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateCheckResult(null);
    try {
      const res = await api.systemConfig.checkUpdates();
      if (res.success) {
        setUpdateCheckResult(res.data);
        if (res.data.has_updates) {
          flash(`Found ${res.data.incoming_commits_count} new commit(s) on GitHub! Review incoming files and pull.`, COLORS.gold);
        } else {
          flash("System is completely up to date with remote GitHub origin ✓", COLORS.success);
        }
      } else {
        flash(res.error || "Failed to check GitHub updates", COLORS.danger);
      }
    } catch (err) {
      flash("Error checking GitHub: " + err.message, COLORS.danger);
    } finally {
      setCheckingUpdates(false);
    }
  };

  // 2. Automatically pull updates from GitHub with complete progress bar
  const handlePullUpdates = async () => {
    setPulling(true);
    setPullProgress(15);
    setPullStage("Contacting remote GitHub repository (git fetch)...");
    setPullResult(null);
    setShowPullModal(true);

    const progressTimer = setInterval(() => {
      setPullProgress((prev) => {
        if (prev < 40) {
          setPullStage("Fetching origin commit tree & calculating deltas...");
          return prev + 15;
        }
        if (prev < 75) {
          setPullStage("Fast-forward merging commit objects into local workspace...");
          return prev + 15;
        }
        if (prev < 90) {
          setPullStage("Registering system patches & scanning database migrations...");
          return prev + 5;
        }
        return prev;
      });
    }, 400);

    try {
      const res = await api.systemConfig.pullUpdates();
      clearInterval(progressTimer);
      setPullProgress(100);
      setPullStage("Synchronization complete!");

      if (res.success) {
        setPullResult(res.data);
        if (res.data.has_new_commits) {
          flash(`Successfully pulled ${res.data.pulled_patches_count} commit patch(es) from GitHub! Review and apply.`, COLORS.success);
        } else {
          flash("No new commits on remote — workspace is already up to date.", COLORS.info);
        }
        await loadConfig();
      } else {
        flash(res.error || "Failed to pull from GitHub", COLORS.danger);
      }
    } catch (err) {
      clearInterval(progressTimer);
      flash("Pull error: " + err.message, COLORS.danger);
    } finally {
      setPulling(false);
    }
  };

  // 3. Apply selected patches
  const handleApplyPatches = async () => {
    if (selectedPatchIds.length === 0) {
      return flash("Select at least one commit patch to apply.", COLORS.danger);
    }
    setApplyingPatches(true);
    try {
      const res = await api.systemConfig.applyPatches(selectedPatchIds);
      if (res.success) {
        flash(`Applied ${res.data.applied_count} patch(es)! System version updated to ${res.data.new_version} (${res.data.migration_status}) ✓`, COLORS.success);
        setSelectedPatchIds([]);
        await loadConfig();
      } else {
        flash(res.error || "Failed to apply patches.", COLORS.danger);
      }
    } catch (err) {
      flash("Patch application error: " + err.message, COLORS.danger);
    } finally {
      setApplyingPatches(false);
    }
  };

  // 4. Push local commits to GitHub with complete progress bar
  const handlePushUpdates = async () => {
    const uncommittedFiles = configData?.uncommitted_files || [];
    if (uncommittedFiles.length === 0) {
      return flash("No uncommitted changes detected to push.", COLORS.warning);
    }

    setPushing(true);
    setPushProgress(20);
    setPushStage("Analyzing workspace modifications & computing change vectors...");
    setPushResult(null);

    const progressTimer = setInterval(() => {
      setPushProgress((prev) => {
        if (prev < 45) {
          setPushStage("Staging local files into Git tracking index (git add -A)...");
          return prev + 15;
        }
        if (prev < 70) {
          setPushStage("Building cryptographic commit object & signing SHA hash...");
          return prev + 15;
        }
        if (prev < 90) {
          setPushStage(`Pushing commit pack to remote origin/${configData?.git_branch || "main"}...`);
          return prev + 10;
        }
        return prev;
      });
    }, 450);

    try {
      const finalMsg = commitMsgInput.trim() 
        ? `${selectedCategory}: ${commitMsgInput.trim()}`
        : `${selectedCategory}(kapila): system update - ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;

      const res = await api.systemConfig.pushUpdates(finalMsg, selectedCategory);
      clearInterval(progressTimer);
      setPushProgress(100);
      setPushStage("Pushed successfully to remote GitHub origin!");

      if (res.success) {
        setPushResult(res.data);
        flash(`Successfully pushed Commit #${res.data.commit_number} (${res.data.commit_hash}) to GitHub!`, COLORS.success);
        setCommitMsgInput("");
        await loadConfig();
      } else {
        flash(res.error || "Failed to push to GitHub.", COLORS.danger);
      }
    } catch (err) {
      clearInterval(progressTimer);
      flash("Push error: " + err.message, COLORS.danger);
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
  const uncommittedFiles = configData?.uncommitted_files || [];
  const uncommittedFuncs = configData?.uncommitted_functionalities || [];

  return (
    <Section title="System Configuration & GitHub Sync" sub="Automated GitHub versioning, auto-sync, and 1-click patch deployment">
      {/* Telemetry Bar */}
      <SystemConfigAgentStatusBar />

      {msg && <p style={{ color: msg.color, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{msg.text}</p>}
      {error && <ErrorMsg error={error} />}

      {/* Top Environment & Version Metrics Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <Card style={{ padding: 18, borderLeft: `4px solid ${COLORS.gold}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              System Version
            </span>
            <Sparkles size={16} color={COLORS.gold} />
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
          <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6", marginTop: 4 }}>
            {configData?.git_branch || "main"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <span>Commit #{configData?.git_head_commit_number || "—"}</span>
            <span>•</span>
            <span style={{ fontFamily: "monospace", color: COLORS.text }}>{configData?.git_head_hash || "—"}</span>
          </div>
        </Card>

        <Card style={{ padding: 18, borderLeft: `4px solid ${pendingPatches.length > 0 ? COLORS.warning : COLORS.success}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Pending Patches
            </span>
            <GitPullRequest size={16} color={pendingPatches.length > 0 ? COLORS.warning : COLORS.success} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: pendingPatches.length > 0 ? COLORS.warning : COLORS.success, marginTop: 4 }}>
            {pendingPatches.length} commit{pendingPatches.length === 1 ? "" : "s"}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>
            {pendingPatches.length > 0 ? "Requires user selection & apply" : "All patches applied ✓"}
          </span>
        </Card>

        <Card style={{ padding: 18, borderLeft: `4px solid #8b5cf6` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Last Sync Timestamp
            </span>
            <Clock size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginTop: 8 }}>
            {formatCompleteDate(configData?.last_git_sync_at)}
          </div>
          <span style={{ fontSize: 11, color: COLORS.muted }}>GitHub origin tracking</span>
        </Card>
      </div>

      {/* GitHub Sync Notification Banner */}
      {pendingPatches.length > 0 && (
        <div
          style={{
            background: "rgba(244, 200, 75, 0.12)",
            border: `1px solid ${COLORS.gold}88`,
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
            <AlertTriangle size={22} color={COLORS.gold} style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: 0, fontSize: 14, color: COLORS.text, fontWeight: 700 }}>
                GitHub Sync Notification: {pendingPatches.length} New Commit Patch(es) Pulled & Ready
              </h4>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: COLORS.muted }}>
                Latest code updates have been pulled from GitHub into system staging. Review the patches and click "Apply Selected Patches" to integrate them.
              </p>
            </div>
          </div>
          <Btn
            onClick={handleApplyPatches}
            loading={applyingPatches}
            style={{ background: COLORS.gold, color: "#18181b", fontWeight: 700 }}
          >
            Apply {selectedPatchIds.length} Patch(es) Now →
          </Btn>
        </div>
      )}

      {/* Control Actions Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Left Box: Pull from GitHub */}
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Download size={18} color="#3b82f6" />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
                GitHub Inward Sync (Pull from GitHub)
              </h3>
            </div>
            <span style={{ fontSize: 11, background: "#3b82f618", color: "#3b82f6", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
              origin/{configData?.git_branch || "main"}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
            Fetch incoming files and commit patches from GitHub. Displays the complete progress bar, incoming file list, commit numbers, full date/time, and functionality.
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
            <div style={{ background: COLORS.bg, padding: 14, borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ color: COLORS.text }}>Remote Origin Status:</strong>
                {updateCheckResult.has_updates ? (
                  <span style={{ color: COLORS.warning, fontWeight: 700 }}>
                    {updateCheckResult.incoming_commits_count} incoming commit(s) available
                  </span>
                ) : (
                  <span style={{ color: COLORS.success, fontWeight: 600 }}>Matches origin/{updateCheckResult.target_branch} ✓</span>
                )}
              </div>

              {updateCheckResult.incoming_files_count > 0 && (
                <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                    <strong>Incoming Files ({updateCheckResult.incoming_files_count}):</strong>
                  </div>
                  <div style={{ maxHeight: 100, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {updateCheckResult.incoming_files.slice(0, 5).map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <span style={{ color: f.color, fontWeight: 700, fontSize: 10, background: f.color + "18", padding: "1px 5px", borderRadius: 4 }}>
                          {f.status_label}
                        </span>
                        <span style={{ fontFamily: "monospace", color: COLORS.text }}>{f.path}</span>
                      </div>
                    ))}
                    {updateCheckResult.incoming_files.length > 5 && (
                      <span style={{ fontSize: 10, color: COLORS.muted }}>+ {updateCheckResult.incoming_files.length - 5} more files...</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Right Box: Push Local Changes to GitHub */}
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Upload size={18} color={COLORS.success} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
                Push Local Changes to GitHub
              </h3>
            </div>
            <span style={{ fontSize: 11, background: uncommittedFiles.length > 0 ? "rgba(16, 185, 129, 0.15)" : COLORS.bg, color: uncommittedFiles.length > 0 ? COLORS.success : COLORS.muted, padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
              {uncommittedFiles.length} file(s) modified
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
            Inspect all modified files, review automatically detected functionality, and push changes to remote GitHub with a complete progress bar, commit number, and timestamp.
          </p>

          <div style={{ background: COLORS.bg, padding: 12, borderRadius: 8, border: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: COLORS.muted }}>
                Head Commit: <strong>#{configData?.git_head_commit_number || "—"}</strong> ({configData?.git_head_hash || "—"})
              </span>
              <span style={{ fontSize: 11, color: COLORS.muted }}>
                {formatCompleteDate(configData?.git_head_commit_date)}
              </span>
            </div>

            {uncommittedFuncs.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {uncommittedFuncs.slice(0, 3).map((func, i) => (
                  <span key={i} style={{ fontSize: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: "2px 8px", borderRadius: 10, color: COLORS.muted }}>
                    {func}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
            <Btn
              onClick={() => {
                setPushResult(null);
                setShowPushModal(true);
              }}
              icon={<Upload size={14} />}
              style={{ background: COLORS.success, fontWeight: 600 }}
            >
              Push Local Changes ({uncommittedFiles.length} files) →
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
            background: COLORS.surface,
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
                    background: patchFilter === st ? COLORS.brandLight : "transparent",
                    color: patchFilter === st ? COLORS.text : COLORS.muted,
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
                  style={{ background: COLORS.gold, color: "#18181b", fontWeight: 700, fontSize: 12 }}
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
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bg }}>
                <th style={{ padding: "10px 14px", width: 40, textAlign: "center" }}></th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Commit # & Hash</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Commit Message & Functionality</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Files</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Author</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: COLORS.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Complete Date & Time</th>
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
                      <td colSpan={7} style={{ textAlign: "center", color: COLORS.muted, padding: 36 }}>
                        No commit patches found in this view.
                      </td>
                    </tr>
                  );
                }

                return displayPatches.map((patch) => {
                  const isPending = patch.status === "PENDING";
                  const isChecked = selectedPatchIds.includes(patch.id);
                  let patchFuncs = [];
                  try {
                    patchFuncs = typeof patch.functionalities === "string" ? JSON.parse(patch.functionalities) : patch.functionalities || [];
                  } catch {
                    patchFuncs = [];
                  }

                  let patchFiles = [];
                  try {
                    patchFiles = typeof patch.files_list === "string" ? JSON.parse(patch.files_list) : patch.files_list || [];
                  } catch {
                    patchFiles = [];
                  }

                  return (
                    <tr
                      key={patch.id}
                      style={{
                        borderBottom: `1px solid ${COLORS.border}22`,
                        background: isChecked ? `${COLORS.brandLight}` : "transparent",
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
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {patch.commit_number && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: COLORS.bg, padding: "1px 6px", borderRadius: 10, color: COLORS.muted }}>
                              #{patch.commit_number}
                            </span>
                          )}
                          <span style={{ fontFamily: "monospace", color: COLORS.brand, fontWeight: 700 }}>
                            {patch.commit_hash}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
                          {patch.commit_message}
                        </div>
                        {patchFuncs.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {patchFuncs.map((fn, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: 10,
                                  background: "rgba(59, 130, 246, 0.1)",
                                  color: "#3b82f6",
                                  padding: "1px 6px",
                                  borderRadius: 8,
                                  fontWeight: 500,
                                }}
                              >
                                {fn}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={() => setInspectingPatch(patch)}
                          style={{
                            background: "transparent",
                            border: `1px solid ${COLORS.border}`,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            cursor: "pointer",
                            color: COLORS.text,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <FileText size={12} color={COLORS.muted} />
                          {patch.files_changed_count || patchFiles.length} file(s)
                        </button>
                      </td>
                      <td style={{ padding: "10px 14px", color: COLORS.muted, fontSize: 12 }}>
                        {patch.author || "Developer"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: isPending ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: isPending ? COLORS.warning : COLORS.success,
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          {isPending ? "PENDING" : "APPLIED"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: COLORS.muted, fontSize: 11, whiteSpace: "nowrap" }}>
                        {formatCompleteDate(patch.commit_timestamp || patch.pulled_at)}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PUSH TO GITHUB MODAL (With Live Files, Progress Bar, Commit Number, Complete Date/Time, and Functionality) */}
      {showPushModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(5px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Card style={{ maxWidth: 680, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 24, overflow: "hidden" }}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Upload size={20} color={COLORS.success} />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.text }}>
                  Push Local Changes to GitHub
                </h3>
              </div>
              <button
                onClick={() => {
                  if (!pushing) setShowPushModal(false);
                }}
                disabled={pushing}
                style={{ background: "transparent", border: "none", cursor: pushing ? "not-allowed" : "pointer", color: COLORS.muted }}
              >
                <X size={18} />
              </button>
            </div>

            {/* If push is completed successfully, display the Enterprise Deployment Summary Card */}
            {pushResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "12px 0" }}>
                <div style={{ background: "rgba(16, 185, 129, 0.12)", border: `1px solid ${COLORS.success}`, borderRadius: 10, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <CheckCircle2 size={24} color={COLORS.success} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.success }}>
                        Push Completed & Deployed to GitHub Successfully!
                      </h4>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>
                        Branch: <strong>origin/{pushResult.branch}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: COLORS.surface, padding: 14, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                    <div>
                      <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>
                        Commit Number
                      </span>
                      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ background: COLORS.bg, padding: "2px 8px", borderRadius: 6 }}>
                          Commit #{pushResult.commit_number}
                        </span>
                        <span style={{ fontFamily: "monospace", color: COLORS.brand }}>
                          ({pushResult.commit_hash})
                        </span>
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>
                        Complete Date & Time
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 4 }}>
                        {formatCompleteDate(pushResult.commit_timestamp)}
                      </div>
                    </div>

                    <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                      <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>
                        Functionality Included
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {(pushResult.functionalities || []).map((fn, idx) => (
                          <span key={idx} style={{ fontSize: 11, background: "rgba(16, 185, 129, 0.15)", color: COLORS.success, padding: "2px 10px", borderRadius: 12, fontWeight: 600 }}>
                            {fn}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>
                        Files Pushed ({pushResult.files_pushed_count})
                      </span>
                      <div style={{ maxHeight: 120, overflowY: "auto", marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {(pushResult.files_pushed || []).map((f, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                            <span style={{ color: f.color, fontWeight: 700, fontSize: 10, background: f.color + "18", padding: "1px 5px", borderRadius: 4 }}>
                              {f.status_label}
                            </span>
                            <span style={{ fontFamily: "monospace", color: COLORS.text }}>{f.path}</span>
                            <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: "auto" }}>{f.area}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Btn
                    onClick={() => {
                      setShowPushModal(false);
                      setPushResult(null);
                    }}
                    style={{ background: COLORS.brand, color: "#18181b", fontWeight: 700 }}
                  >
                    Done & Close
                  </Btn>
                </div>
              </div>
            ) : (
              /* Pre-push or In-progress Push View */
              <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
                {/* 1. Files Being Pushed Section */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
                      <FileText size={14} color={COLORS.brand} />
                      Files Being Pushed ({uncommittedFiles.length})
                    </span>
                    <span style={{ fontSize: 11, color: COLORS.muted }}>
                      Target: origin/{configData?.git_branch || "main"}
                    </span>
                  </div>

                  <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 8, background: COLORS.bg, padding: 8 }}>
                    {uncommittedFiles.length === 0 ? (
                      <div style={{ textAlign: "center", color: COLORS.muted, padding: 20, fontSize: 12 }}>
                        No modified files detected. Workspace is clean.
                      </div>
                    ) : (
                      uncommittedFiles.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderBottom: i < uncommittedFiles.length - 1 ? `1px solid ${COLORS.border}55` : "none" }}>
                          <span style={{ color: f.color, fontWeight: 700, fontSize: 10, background: f.color + "18", padding: "2px 6px", borderRadius: 4 }}>
                            {f.status_label}
                          </span>
                          <span style={{ fontFamily: "monospace", fontSize: 11.5, color: COLORS.text }}>
                            {f.path}
                          </span>
                          <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: "auto" }}>
                            {f.area}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Functionality & Commit Message */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, display: "block", marginBottom: 6 }}>
                    Functionality & Module Category
                  </label>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    {[
                      { key: "feat", label: "feat (Feature)" },
                      { key: "fix", label: "fix (Bug Fix)" },
                      { key: "sync", label: "sync (GitHub Sync)" },
                      { key: "security", label: "security (RBAC / Auth)" },
                      { key: "refactor", label: "refactor (Optimization)" },
                    ].map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setSelectedCategory(c.key)}
                        disabled={pushing}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 14,
                          fontSize: 11,
                          fontWeight: 600,
                          border: `1px solid ${selectedCategory === c.key ? COLORS.brand : COLORS.border}`,
                          background: selectedCategory === c.key ? COLORS.brandLight : COLORS.surface,
                          color: selectedCategory === c.key ? COLORS.text : COLORS.muted,
                          cursor: pushing ? "not-allowed" : "pointer",
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <Input
                    label="Commit Message & Functionality Description"
                    placeholder="e.g. system configuration auto-sync and patch manager"
                    value={commitMsgInput}
                    onChange={(e) => setCommitMsgInput(e.target.value)}
                    disabled={pushing}
                  />

                  {uncommittedFuncs.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: COLORS.muted }}>Detected Capabilities:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {uncommittedFuncs.map((fn, idx) => (
                          <span key={idx} style={{ fontSize: 10.5, background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", padding: "1px 7px", borderRadius: 8 }}>
                            {fn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Complete Progress Bar */}
                {pushing && (
                  <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
                        {pushStage}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.brand }}>
                        {pushProgress}%
                      </span>
                    </div>

                    {/* Visual Progress Track */}
                    <div style={{ width: "100%", height: 8, background: COLORS.surface, borderRadius: 4, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                      <div
                        style={{
                          width: `${pushProgress}%`,
                          height: "100%",
                          background: `linear-gradient(90deg, ${COLORS.brand}, ${COLORS.success})`,
                          transition: "width 0.35s ease-in-out",
                          boxShadow: `0 0 10px ${COLORS.brand}88`,
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.muted, marginTop: 6 }}>
                      <span>Stage 1: Staging</span>
                      <span>Stage 2: Committing</span>
                      <span>Stage 3: Pushing</span>
                      <span>Stage 4: Synced</span>
                    </div>
                  </div>
                )}

                {/* Modal Footer Controls */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <Btn variant="ghost" onClick={() => setShowPushModal(false)} disabled={pushing}>
                    Cancel
                  </Btn>
                  <Btn
                    onClick={handlePushUpdates}
                    loading={pushing}
                    style={{ background: COLORS.success, color: "#ffffff", fontWeight: 700 }}
                  >
                    Confirm & Push to GitHub Now →
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PULL FROM GITHUB MODAL (With Live Files, Progress Bar, Commit Number, Complete Date/Time, and Functionality) */}
      {showPullModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(5px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Card style={{ maxWidth: 680, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 24, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Download size={20} color="#3b82f6" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.text }}>
                  Pull Updates from GitHub
                </h3>
              </div>
              <button
                onClick={() => {
                  if (!pulling) setShowPullModal(false);
                }}
                disabled={pulling}
                style={{ background: "transparent", border: "none", cursor: pulling ? "not-allowed" : "pointer", color: COLORS.muted }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Progress Bar View */}
            {pulling && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 18, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                    {pullStage}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>
                    {pullProgress}%
                  </span>
                </div>

                <div style={{ width: "100%", height: 8, background: COLORS.surface, borderRadius: 4, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                  <div
                    style={{
                      width: `${pullProgress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #3b82f6, #10b981)",
                      transition: "width 0.3s ease-in-out",
                      boxShadow: "0 0 10px #3b82f688",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: COLORS.muted, marginTop: 8 }}>
                  <span>Fetch Origin</span>
                  <span>Analyze Commits</span>
                  <span>Fast-Forward Merge</span>
                  <span>Register Patches</span>
                </div>
              </div>
            )}

            {/* Pull Result View */}
            {pullResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
                <div style={{ background: pullResult.has_new_commits ? "rgba(16, 185, 129, 0.12)" : COLORS.bg, border: `1px solid ${pullResult.has_new_commits ? COLORS.success : COLORS.border}`, borderRadius: 10, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    {pullResult.has_new_commits ? (
                      <CheckCircle2 size={24} color={COLORS.success} />
                    ) : (
                      <Info size={24} color="#3b82f6" />
                    )}
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: pullResult.has_new_commits ? COLORS.success : COLORS.text }}>
                        {pullResult.has_new_commits
                          ? `Successfully Pulled ${pullResult.pulled_patches_count} Commit Patch(es)!`
                          : "Workspace is Already Up to Date with GitHub Origin"}
                      </h4>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>
                        Branch: <strong>origin/{pullResult.branch}</strong> ({pullResult.before_hash} → {pullResult.after_hash})
                      </span>
                    </div>
                  </div>

                  {pullResult.has_new_commits ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: COLORS.surface, padding: 14, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                      <div>
                        <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>
                          Pulled Commit Patches
                        </span>
                        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>
                          {pullResult.pulled_patches.map((p, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              {p.commit_number && (
                                <span style={{ background: COLORS.bg, padding: "1px 6px", borderRadius: 6, fontSize: 11 }}>
                                  Commit #{p.commit_number}
                                </span>
                              )}
                              <span style={{ fontFamily: "monospace", color: COLORS.brand }}>
                                {p.commit_hash}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>
                          Complete Date & Time
                        </span>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginTop: 4 }}>
                          {pullResult.pulled_patches.map((p, idx) => (
                            <div key={idx} style={{ marginBottom: 4 }}>
                              {formatCompleteDate(p.commit_timestamp)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                        <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>
                          Functionalities Pulled
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          {(pullResult.functionalities || []).map((fn, idx) => (
                            <span key={idx} style={{ fontSize: 11, background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "2px 10px", borderRadius: 12, fontWeight: 600 }}>
                              {fn}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", fontWeight: 600 }}>
                          Files Pulled ({pullResult.pulled_files_count})
                        </span>
                        <div style={{ maxHeight: 130, overflowY: "auto", marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          {(pullResult.pulled_files || []).map((f, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                              <span style={{ color: f.color, fontWeight: 700, fontSize: 10, background: f.color + "18", padding: "1px 5px", borderRadius: 4 }}>
                                {f.status_label}
                              </span>
                              <span style={{ fontFamily: "monospace", color: COLORS.text }}>{f.path}</span>
                              <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: "auto" }}>{f.area}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 12, fontSize: 12, color: COLORS.muted }}>
                      Current HEAD is at commit <strong>{configData?.git_head_hash}</strong> ({formatCompleteDate(configData?.git_head_commit_date)}). No remote updates are pending.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => setShowPullModal(false)}>
                    Close
                  </Btn>
                  {pullResult.has_new_commits && (
                    <Btn
                      onClick={() => {
                        setShowPullModal(false);
                        handleApplyPatches();
                      }}
                      style={{ background: COLORS.gold, color: "#18181b", fontWeight: 700 }}
                    >
                      Apply Pulled Patches Now →
                    </Btn>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* PATCH FILE INSPECTION MODAL */}
      {inspectingPatch && (
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
          <Card style={{ maxWidth: 600, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                  Patch Inspection: #{inspectingPatch.commit_number || "—"} ({inspectingPatch.commit_hash})
                </h3>
                <span style={{ fontSize: 11, color: COLORS.muted }}>
                  {formatCompleteDate(inspectingPatch.commit_timestamp || inspectingPatch.pulled_at)}
                </span>
              </div>
              <button
                onClick={() => setInspectingPatch(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.muted }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>
              {inspectingPatch.commit_message}
            </div>

            {/* Functionalities */}
            {(() => {
              let funcs = [];
              try {
                funcs = typeof inspectingPatch.functionalities === "string" ? JSON.parse(inspectingPatch.functionalities) : inspectingPatch.functionalities || [];
              } catch {
                funcs = [];
              }
              if (funcs.length === 0) return null;
              return (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>Functionality:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {funcs.map((fn, idx) => (
                      <span key={idx} style={{ fontSize: 10.5, background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", padding: "2px 8px", borderRadius: 10 }}>
                        {fn}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Files List */}
            <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, background: COLORS.bg }}>
              {(() => {
                let files = [];
                try {
                  files = typeof inspectingPatch.files_list === "string" ? JSON.parse(inspectingPatch.files_list) : inspectingPatch.files_list || [];
                } catch {
                  files = [];
                }

                if (files.length === 0) {
                  return <div style={{ fontSize: 11, color: COLORS.muted, textAlign: "center", padding: 16 }}>No file list metadata recorded for this patch.</div>;
                }

                return files.map((f, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: idx < files.length - 1 ? `1px solid ${COLORS.border}44` : "none" }}>
                    <span style={{ color: f.color || "#3b82f6", fontWeight: 700, fontSize: 10, background: (f.color || "#3b82f6") + "18", padding: "1px 5px", borderRadius: 4 }}>
                      {f.status_label || f.status || "MODIFIED"}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.text }}>{f.path}</span>
                    <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: "auto" }}>{f.area}</span>
                  </div>
                ));
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <Btn onClick={() => setInspectingPatch(null)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text }}>
                Close
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </Section>
  );
}
