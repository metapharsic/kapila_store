<#
.SYNOPSIS
    Kapila IMS - Intelligent Patch Engine (Create / Apply / List / Verify)
.DESCRIPTION
    A production-grade patching pipeline for Kapila Hotel Inventory Management System.
    Supports creating portable .patch bundles from commits, listing available patches,
    dry-run verification without file changes, and safe intelligent application with
    migration detection, dependency alerts, conflict guarding, and rollback instructions.
.PARAMETER Mode
    create  - Generate a .patch file from unpushed or ranged commits
    apply   - Apply a .patch file to the working tree (with full pre-flight checks)
    list    - Display all available patches in the patches directory
    verify  - Dry-run apply (checks for conflicts WITHOUT modifying any files)
.PARAMETER PatchFile
    For apply/verify modes: path to the .patch file to process.
    For create mode: optional custom filename (auto-named by default).
.PARAMETER CommitRange
    For create mode: git range like 'HEAD~3..HEAD' or 'abc123..def456'.
    Defaults to 'origin/main..HEAD' (all local unpushed commits).
.PARAMETER NoPrompt
    Run non-interactively (skip all confirmation prompts, use safe defaults).
.PARAMETER AutoApplyLatest
    For apply mode: automatically pick and apply the newest patch without prompting.
#>

[CmdletBinding()]
param (
    [ValidateSet("create", "apply", "list", "verify")]
    [string]$Mode = "list",

    [string]$PatchFile,
    [string]$CommitRange,
    [switch]$NoPrompt,
    [switch]$AutoApplyLatest
)

$ErrorActionPreference = "Continue"
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot
$patchDir = Join-Path $repoRoot "patches"

# ========================== UI HELPERS ==========================================

function Write-Header {
    param ([string]$Text)
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Yellow
    Write-Host "========================================================================" -ForegroundColor Cyan
}

function Write-Section {
    param ([string]$Text)
    Write-Host ""
    Write-Host "  == $Text ==" -ForegroundColor DarkCyan
    Write-Host "  ----------------------------------------------------------------" -ForegroundColor DarkGray
}

function Write-Step {
    param ([string]$Agent, [string]$Step, [string]$Details = "")
    Write-Host " [$Agent] " -ForegroundColor DarkYellow -NoNewline
    Write-Host "$Step " -ForegroundColor White -NoNewline
    if ($Details) { Write-Host "($Details)" -ForegroundColor Gray } else { Write-Host "" }
}

function Write-Ok   { param([string]$T); Write-Host "  [OK]   $T" -ForegroundColor Green }
function Write-Warn { param([string]$T); Write-Host "  [WARN] $T" -ForegroundColor Yellow }
function Write-Err  { param([string]$T); Write-Host "  [ERR]  $T" -ForegroundColor Red }
function Write-Info { param([string]$T); Write-Host "  [INFO] $T" -ForegroundColor Cyan }

function Wait-Prompt {
    param ([string]$Msg = "Press Enter to continue")
    if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
        Read-Host $Msg
    }
}

function Confirm-Action {
    param ([string]$Prompt, [string]$Default = "Y")
    if ($NoPrompt -or [Console]::IsInputRedirected) { return $true }
    $answer = Read-Host "  $Prompt [Y/n] (default $Default)"
    if (-not $answer) { $answer = $Default }
    return ($answer -match "^[Yy]")
}

# ========================== GIT GUARD ===========================================

function Assert-Git {
    try {
        $v = (git --version 2>&1).Trim()
        Write-Ok "Git detected: $v"
    } catch {
        Write-Err "Git is not installed or not in PATH."
        exit 1
    }
    if (-not (Test-Path "$repoRoot\.git")) {
        Write-Err "Not a Git repository: $repoRoot"
        exit 1
    }
}

# ========================== PATCH METADATA PARSER ================================

function Get-PatchMeta {
    param ([string]$Path)
    $lines      = Get-Content $Path -TotalCount 30 -ErrorAction SilentlyContinue
    $subject    = ($lines | Where-Object { $_ -match "^Subject:" } | Select-Object -First 1) -replace "^Subject:\s*", ""
    $fromDate   = ($lines | Where-Object { $_ -match "^Date:" }    | Select-Object -First 1) -replace "^Date:\s*", ""
    $fromAuthor = ($lines | Where-Object { $_ -match "^From " }    | Select-Object -First 1)
    $sha        = ""
    if ($fromAuthor -match "^From ([a-f0-9]{7,40})") { $sha = $Matches[1].Substring(0, [Math]::Min(7,$Matches[1].Length)) }
    $fileItem   = Get-Item $Path
    return @{
        FileName = $fileItem.Name
        FullPath = $fileItem.FullName
        Subject  = if ($subject) { $subject } else { "(multi-commit bundle)" }
        Date     = if ($fromDate) { $fromDate } else { $fileItem.LastWriteTime.ToString("yyyy-MM-dd HH:mm") }
        SHA      = $sha
        SizeKB   = [Math]::Round($fileItem.Length / 1KB, 1)
        Modified = $fileItem.LastWriteTime
    }
}

# ========================== SUBSYSTEM DETECTOR ==================================

function Get-SubsystemImpact {
    param ([string[]]$Files)
    $s = @{
        "Frontend UI/UX"        = 0
        "Backend and APIs"      = 0
        "Database/Migrations"   = 0
        "Package Dependencies"  = 0
        "Scripts/Dev Tools"     = 0
        "Documentation"         = 0
        "Configuration"         = 0
    }
    $flags = @{ deps=$false; migrations=$false; env=$false }
    foreach ($f in $Files) {
        if ($f -match "package(-lock)?\.json$")                              { $s["Package Dependencies"]++;  $flags.deps       = $true }
        if ($f -match "^backend/migrations/" -or $f -match "knexfile")       { $s["Database/Migrations"]++;   $flags.migrations = $true }
        if ($f -match "^frontend/")                                           { $s["Frontend UI/UX"]++ }
        elseif ($f -match "^backend/")                                        { $s["Backend and APIs"]++ }
        elseif ($f -match "\.(md|txt)$" -or $f -match "^docs/")              { $s["Documentation"]++ }
        elseif ($f -match "^scripts/" -or $f -match "\.(bat|ps1|sh)$")       { $s["Scripts/Dev Tools"]++ }
        elseif ($f -match "\.(env|yaml|yml|json)$" -or $f -match "^config/") { $s["Configuration"]++ }
        if ($f -match "\.env\.example")                                        { $flags.env = $true }
    }
    return @{ Subsystems = $s; Flags = $flags }
}

function Show-SubsystemImpact {
    param ($Impact)
    foreach ($key in $Impact.Subsystems.Keys) {
        $cnt = $Impact.Subsystems[$key]
        if ($cnt -gt 0) {
            Write-Host "    [$cnt file(s)] " -ForegroundColor Cyan -NoNewline
            Write-Host "$key" -ForegroundColor White -NoNewline
            Write-Host " [AFFECTED]" -ForegroundColor Green
        }
    }
}

function Show-PostApplyActions {
    param ($Flags)
    $needed = $false
    if ($Flags.deps) {
        $needed = $true
        Write-Warn "DEPENDENCY CHANGE: package.json or package-lock.json changed."
        Write-Host "      Action Required:" -ForegroundColor Yellow
        Write-Host "        cd frontend  `&`& npm install" -ForegroundColor Cyan
        Write-Host "        cd backend   `&`& npm install" -ForegroundColor Cyan
    }
    if ($Flags.migrations) {
        $needed = $true
        Write-Warn "MIGRATION DETECTED: New database migration files included."
        Write-Host "      Action Required:" -ForegroundColor Yellow
        Write-Host "        cd backend `&`& npx knex migrate:latest" -ForegroundColor Cyan
    }
    if ($Flags.env) {
        $needed = $true
        Write-Warn "ENV TEMPLATE UPDATED: Review new variables in .env.example"
    }
    if (-not $needed) {
        Write-Ok "No dependency or migration actions required."
    }
    return $needed
}

# ========================== MODE: LIST ==========================================

function Invoke-List {
    Clear-Host
    Write-Header "KAPILA PATCH ENGINE -- AVAILABLE PATCHES"

    if (-not (Test-Path $patchDir)) {
        Write-Warn "patches\ directory does not exist yet. Run a Push first to generate patches."
        Wait-Prompt
        exit 0
    }

    $patches = Get-ChildItem -Path $patchDir -Filter "*.patch" | Sort-Object LastWriteTime -Descending
    if ($patches.Count -eq 0) {
        Write-Warn "No .patch files found in patches\ directory."
        Write-Host "  Generate patches by running 'Push to GitHub.bat'" -ForegroundColor Gray
        Wait-Prompt
        exit 0
    }

    Write-Host ""
    Write-Host "  Found $($patches.Count) patch(es):" -ForegroundColor Yellow
    Write-Host ""

    $i = 1
    foreach ($p in $patches) {
        $meta    = Get-PatchMeta $p.FullName
        $tag     = if ($i -eq 1) { "  [LATEST]" } else { "" }
        $dateTag = $meta.Date + $tag
        Write-Host "  [$i] " -ForegroundColor DarkYellow -NoNewline
        Write-Host $meta.FileName -ForegroundColor White
        Write-Host "       Date    : $dateTag" -ForegroundColor Gray
        Write-Host "       Subject : $($meta.Subject)" -ForegroundColor Gray
        Write-Host "       SHA     : $($meta.SHA)" -ForegroundColor DarkGray
        Write-Host "       Size    : $($meta.SizeKB) KB" -ForegroundColor DarkGray
        Write-Host ""
        $i++
    }

    Write-Host "  To apply a patch, run: Apply Patch.bat" -ForegroundColor DarkCyan
    Wait-Prompt "Press Enter to exit"
}

# ========================== MODE: CREATE ========================================

function Invoke-Create {
    Clear-Host
    Write-Header "KAPILA PATCH ENGINE -- CREATING PATCH BUNDLE"

    Write-Step "Agent 1" "Verifying repository state..."
    Assert-Git

    $currentBranch = (git branch --show-current 2>$null)
    if (-not $currentBranch) { $currentBranch = "main" }
    Write-Ok "Branch: $currentBranch"

    if (-not $CommitRange) {
        $hasRemote = (git rev-parse --verify "origin/$currentBranch" 2>$null)
        if ($hasRemote) {
            $CommitRange = "origin/$currentBranch..HEAD"
        } else {
            $CommitRange = "HEAD~1..HEAD"
            Write-Warn "No remote tracking branch found. Defaulting to last commit only: $CommitRange"
        }
    }

    Write-Step "Agent 2" "Analyzing commit range: $CommitRange"
    $commits = (git log $CommitRange --oneline 2>$null)
    if (-not $commits) {
        Write-Warn "No commits found in range '$CommitRange'. Nothing to patch."
        Wait-Prompt
        exit 0
    }

    $commitCount = @($commits).Count
    Write-Ok "$commitCount commit(s) will be included in this patch."
    foreach ($c in $commits) {
        Write-Host "    + $c" -ForegroundColor Cyan
    }

    $changedFiles = @(git diff --name-only $CommitRange 2>$null)
    $impact = Get-SubsystemImpact -Files $changedFiles

    Write-Section "Subsystem Impact"
    Show-SubsystemImpact -Impact $impact

    if (-not (Test-Path $patchDir)) { New-Item -ItemType Directory -Path $patchDir -Force | Out-Null }

    $shortSHA = (git rev-parse --short HEAD 2>$null)
    $ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
    if (-not $PatchFile) {
        $PatchFile = Join-Path $patchDir "kapila_patch_${ts}_${shortSHA}.patch"
    } elseif (-not [System.IO.Path]::IsPathRooted($PatchFile)) {
        $PatchFile = Join-Path $patchDir $PatchFile
    }

    Write-Step "Agent 6" "Generating patch file..."
    Write-Host "  Output: $PatchFile" -ForegroundColor DarkGray

    git format-patch $CommitRange --stdout | Out-File -FilePath $PatchFile -Encoding utf8
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $PatchFile)) {
        Write-Err "Failed to generate patch file."
        exit 1
    }

    $patchSize = [Math]::Round((Get-Item $PatchFile).Length / 1KB, 1)
    Write-Ok "Patch created successfully! ($patchSize KB)"
    Write-Host ""
    Write-Host "  Patch File  : $PatchFile" -ForegroundColor Green
    Write-Host "  Commits     : $commitCount" -ForegroundColor Green
    Write-Host "  SHA Range   : $CommitRange" -ForegroundColor Green
    Write-Host ""
    Write-Host "  To apply on production, copy this file to the target machine and run:" -ForegroundColor Yellow
    Write-Host "    Apply Patch.bat" -ForegroundColor Cyan
    Write-Host "    - or -" -ForegroundColor DarkGray
    Write-Host "    powershell -File scripts\git_patch.ps1 -Mode apply -PatchFile `"$PatchFile`"" -ForegroundColor Cyan

    Wait-Prompt "Press Enter to finish"
}

# ========================== MODE: VERIFY ========================================

function Invoke-Verify {
    param ([string]$TargetPatch)

    Write-Step "Agent 3" "Running dry-run verification (no files will be changed)..."
    Write-Host "  Executing: git apply --check `"$TargetPatch`"" -ForegroundColor DarkGray

    $checkOutput = (git apply --check --ignore-whitespace "$TargetPatch" 2>&1)
    $checkExit = $LASTEXITCODE

    if ($checkExit -eq 0) {
        Write-Ok "Patch verification PASSED -- applies cleanly with zero conflicts!"
        return $true
    } else {
        Write-Err "Patch verification FAILED -- conflicts detected!"
        Write-Host ""
        Write-Host "  Conflict Details:" -ForegroundColor Yellow
        $checkOutput | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "  Resolution Options:" -ForegroundColor Yellow
        Write-Host "    1. Commit or stash your current local changes first." -ForegroundColor White
        Write-Host "    2. Pull latest from GitHub, then re-apply the patch." -ForegroundColor White
        Write-Host "    3. Manually resolve the conflicting sections listed above." -ForegroundColor White
        return $false
    }
}

# ========================== MODE: APPLY =========================================

function Invoke-Apply {
    Clear-Host
    Write-Header "KAPILA PATCH ENGINE -- INTELLIGENT PATCH APPLICATOR"

    Write-Host "  Agent Swarm Operational Status:" -ForegroundColor DarkGray
    Write-Host "  ------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [Agent 1: Architect]   " -ForegroundColor Cyan -NoNewline; Write-Host "Repository Validation `& Branch Guard" -ForegroundColor White
    Write-Host "  [Agent 2: Inspector]   " -ForegroundColor Cyan -NoNewline; Write-Host "Patch Metadata `& Content Analysis" -ForegroundColor White
    Write-Host "  [Agent 3: Guard]       " -ForegroundColor Cyan -NoNewline; Write-Host "Conflict Dry-Run Verification" -ForegroundColor White
    Write-Host "  [Agent 4: Dashboard]   " -ForegroundColor Cyan -NoNewline; Write-Host "Impact Matrix `& Subsystem Report" -ForegroundColor White
    Write-Host "  [Agent 5: Applicator]  " -ForegroundColor Cyan -NoNewline; Write-Host "Safe Patch Application with Rollback Guard" -ForegroundColor White
    Write-Host "  [Agent 6: Post-Ops]    " -ForegroundColor Cyan -NoNewline; Write-Host "Migration Alerts, npm Install `& Service Restart" -ForegroundColor White
    Write-Host "  ------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""

    # Agent 1: Repo check
    Write-Step "Agent 1" "Verifying repository state..."
    Assert-Git

    $currentBranch = (git branch --show-current 2>$null)
    if (-not $currentBranch) { $currentBranch = "main" }
    Write-Ok "Repository: $repoRoot | Branch: $currentBranch"

    $dirtyFiles = @(git status --porcelain 2>$null)
    if ($dirtyFiles.Count -gt 0) {
        Write-Warn "Working tree has $($dirtyFiles.Count) uncommitted change(s)."
        Write-Host "  Uncommitted files (may conflict with patch):" -ForegroundColor Yellow
        $dirtyFiles | Select-Object -First 8 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        if ($dirtyFiles.Count -gt 8) { Write-Host "    ... and $($dirtyFiles.Count - 8) more" -ForegroundColor DarkGray }
        Write-Host ""
        if (-not (Confirm-Action "Continue anyway? (Recommended: commit or stash changes first)")) {
            Write-Host "Aborted. Please commit or stash local changes before applying a patch." -ForegroundColor Yellow
            exit 0
        }
    } else {
        Write-Ok "Working tree is clean. Safe to apply patch."
    }

    # Select patch file
    Write-Step "Agent 2" "Selecting patch to apply..."

    if (-not $PatchFile -and $AutoApplyLatest) {
        $patches = Get-ChildItem -Path $patchDir -Filter "*.patch" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
        if ($patches.Count -eq 0) {
            Write-Err "No patch files found in patches\ directory."
            exit 1
        }
        $PatchFile = $patches[0].FullName
        Write-Info "Auto-selected latest patch: $($patches[0].Name)"
    }

    if (-not $PatchFile) {
        $patches = Get-ChildItem -Path $patchDir -Filter "*.patch" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
        if (-not $patches -or $patches.Count -eq 0) {
            Write-Err "No .patch files found in patches\ directory."
            Write-Host "  Generate patches by running 'Push to GitHub.bat'" -ForegroundColor Yellow
            Wait-Prompt
            exit 1
        }

        Write-Host ""
        Write-Host "  Available patches:" -ForegroundColor Yellow
        $i = 1
        foreach ($p in $patches) {
            $meta    = Get-PatchMeta $p.FullName
            $tag     = if ($i -eq 1) { "  [LATEST]" } else { "" }
            $dateTag = $meta.Date + $tag
            Write-Host "  [$i] " -ForegroundColor DarkYellow -NoNewline
            Write-Host $meta.FileName -ForegroundColor White -NoNewline
            Write-Host "  ($dateTag)" -ForegroundColor Gray
            Write-Host "       $($meta.Subject)" -ForegroundColor Gray
            $i++
        }
        Write-Host "  [0] Enter custom patch file path" -ForegroundColor DarkGray
        Write-Host ""

        $sel = Read-Host "  Select patch number (default 1 = latest)"
        if (-not $sel -or $sel -eq "1") {
            $PatchFile = $patches[0].FullName
        } elseif ($sel -eq "0") {
            $PatchFile = (Read-Host "  Enter full path to .patch file").Trim()
        } else {
            $idx = [int]$sel - 1
            if ($idx -ge 0 -and $idx -lt $patches.Count) {
                $PatchFile = $patches[$idx].FullName
            } else {
                Write-Err "Invalid selection."
                exit 1
            }
        }
    }

    if (-not (Test-Path $PatchFile)) {
        Write-Err "Patch file not found: $PatchFile"
        exit 1
    }

    # Agent 2: Analyze patch
    Write-Step "Agent 2" "Analyzing patch contents..."
    $meta = Get-PatchMeta $PatchFile
    Write-Host ""
    Write-Host "  +-- Patch Metadata -----------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host "  |  File    : $($meta.FileName)" -ForegroundColor White
    Write-Host "  |  Date    : $($meta.Date)" -ForegroundColor White
    Write-Host "  |  Subject : $($meta.Subject)" -ForegroundColor White
    Write-Host "  |  SHA     : $($meta.SHA)" -ForegroundColor Gray
    Write-Host "  |  Size    : $($meta.SizeKB) KB" -ForegroundColor Gray
    Write-Host "  +-----------------------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host ""

    $patchedFiles = @(git apply --stat "$PatchFile" 2>$null | Where-Object { $_ -match "\|" } | ForEach-Object {
        ($_ -split "\|")[0].Trim()
    })

    $impact = $null
    if ($patchedFiles.Count -gt 0) {
        $impact = Get-SubsystemImpact -Files $patchedFiles
        Write-Host "  Patch Affects $($patchedFiles.Count) file(s):" -ForegroundColor Yellow
        $patchedFiles | ForEach-Object { Write-Host "    * $_" -ForegroundColor Gray }
        Write-Host ""
        Write-Section "Subsystem Impact Matrix"
        Show-SubsystemImpact -Impact $impact
    }

    # Agent 3: Dry-run
    Write-Host ""
    Write-Step "Agent 3" "Running conflict pre-check (dry-run, no changes)..."
    $verifyOk = Invoke-Verify -TargetPatch $PatchFile

    if (-not $verifyOk) {
        Write-Host ""
        if (-not (Confirm-Action "Verification failed. Force-apply anyway? (RISKY - only if you know what you are doing)")) {
            Write-Host "Patch application aborted. No files were modified." -ForegroundColor Yellow
            Wait-Prompt
            exit 0
        }
        Write-Warn "Proceeding with force apply as requested..."
    }

    # Capture rollback SHA before applying
    $beforeSHA   = (git rev-parse HEAD 2>$null)
    $beforeShort = (git rev-parse --short HEAD 2>$null)

    Write-Host ""
    Write-Host "  Rollback SHA (BEFORE apply): $beforeSHA" -ForegroundColor DarkGray
    Write-Host "  If anything goes wrong after apply, run:" -ForegroundColor DarkGray
    Write-Host "    git reset --hard $beforeSHA" -ForegroundColor Yellow

    Write-Host ""
    if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
        if (-not (Confirm-Action "Apply patch '$($meta.FileName)' to working tree now?")) {
            Write-Host "Aborted by user. No changes applied." -ForegroundColor Yellow
            Wait-Prompt
            exit 0
        }
    }

    # Agent 5: Apply patch
    Write-Step "Agent 5" "Applying patch..."
    Write-Host "  Executing: git am --ignore-whitespace `"$PatchFile`"" -ForegroundColor DarkGray

    git am --ignore-whitespace "$PatchFile" 2>&1
    $amExit = $LASTEXITCODE

    if ($amExit -ne 0) {
        Write-Warn "git am failed. Trying git apply fallback..."
        git am --abort 2>$null
        git apply --ignore-whitespace "$PatchFile" 2>&1
        $applyExit = $LASTEXITCODE

        if ($applyExit -ne 0) {
            Write-Err "Patch application FAILED."
            Write-Host ""
            Write-Host "  ROLLBACK COMMAND (restores pre-apply state):" -ForegroundColor Red
            Write-Host "    git reset --hard $beforeSHA" -ForegroundColor Yellow
            Write-Host ""
            Wait-Prompt "Press Enter to exit"
            exit 1
        }
    }

    $afterSHA   = (git rev-parse HEAD 2>$null)
    $afterShort = (git rev-parse --short HEAD 2>$null)

    Write-Ok "Patch applied successfully!"
    Write-Host ""
    Write-Host "  +-- Apply Summary ------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host "  |  Patch    : $($meta.FileName)" -ForegroundColor White
    Write-Host "  |  Before   : $beforeShort" -ForegroundColor Gray
    Write-Host "  |  After    : $afterShort" -ForegroundColor Green
    Write-Host "  +-----------------------------------------------------------------+" -ForegroundColor DarkCyan

    Write-Host ""
    Write-Host "  Files Changed in This Patch:" -ForegroundColor Yellow
    git diff --stat "${beforeSHA}..HEAD" 2>$null | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

    # Agent 6: Post-apply alerts
    Write-Header "POST-PATCH OPERATIONAL ALERTS"
    if ($null -ne $impact -and $patchedFiles.Count -gt 0) {
        $actionsNeeded = Show-PostApplyActions -Flags $impact.Flags
    } else {
        Write-Ok "No post-patch actions required."
    }

    Write-Host ""
    Write-Host "  ROLLBACK INSTRUCTIONS (to undo this patch):" -ForegroundColor DarkGray
    Write-Host "    git reset --hard $beforeSHA" -ForegroundColor Yellow

    # Service restart offer
    Write-Host ""
    $restartScript = Join-Path $repoRoot "Stop Kapila.bat"
    $startScript   = Join-Path $repoRoot "Start Kapila.bat"
    if ((Test-Path $restartScript) -and (Test-Path $startScript)) {
        if (Confirm-Action "Restart Kapila services now to apply changes to the live system?") {
            Write-Step "Agent 6" "Restarting Kapila services..."
            Start-Process -FilePath $restartScript -Wait -WindowStyle Normal
            Start-Sleep -Seconds 3
            Start-Process -FilePath $startScript -WindowStyle Normal
            Write-Ok "Kapila services restarted."
        } else {
            Write-Host "  Remember to restart Kapila manually: Stop Kapila.bat then Start Kapila.bat" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Ok "All patch operations completed successfully."
    Wait-Prompt "Press Enter to finish"
}

# ========================== ENTRY POINT =========================================

Clear-Host
Write-Header "KAPILA INVENTORY -- INTELLIGENT PATCH ENGINE v2.0"

switch ($Mode.ToLower()) {
    "list"   { Invoke-List }
    "create" { Invoke-Create }
    "verify" {
        Assert-Git
        if (-not $PatchFile) {
            Write-Err "-PatchFile is required for verify mode."
            exit 1
        }
        if (-not (Test-Path $PatchFile)) {
            Write-Err "Patch file not found: $PatchFile"
            exit 1
        }
        $ok = Invoke-Verify -TargetPatch $PatchFile
        Write-Host ""
        if ($ok) { Write-Ok "Patch is clean and ready to apply." }
        Wait-Prompt
    }
    "apply"  { Invoke-Apply }
    default  { Invoke-List }
}
