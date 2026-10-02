<#
.SYNOPSIS
    Kapila IMS - Enterprise Multi-Agent GitHub Push Pipeline
.DESCRIPTION
    Analyzes local changes, displays subsystem impact matrices, scans for secret leaks,
    stages files, generates diffstat metrics, and safely pushes to GitHub.
.PARAMETER Message
    Commit message. If omitted, prompts interactively with a smart timestamped default.
.PARAMETER Branch
    Target Git branch (defaults to current branch or 'main').
.PARAMETER Remote
    Target Git remote (defaults to 'origin').
.PARAMETER DryRun
    If specified, displays change impact and preview without committing or pushing.
#>

[CmdletBinding()]
param (
    [Alias("m")]
    [string]$Message,
    [string]$Branch,
    [string]$Remote = "origin",
    [switch]$DryRun,
    [switch]$Force,
    [switch]$NoPrompt
)

$ErrorActionPreference = "Continue"

# Helper functions for UI output
function Write-Header {
    param ([string]$Text)
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Yellow
    Write-Host "========================================================================" -ForegroundColor Cyan
}

function Write-Step {
    param ([string]$Agent, [string]$Step, [string]$Details)
    Write-Host " [$Agent] " -ForegroundColor DarkYellow -NoNewline
    Write-Host "$Step " -ForegroundColor White -NoNewline
    if ($Details) { Write-Host "($Details)" -ForegroundColor Gray } else { Write-Host "" }
}

function Write-Success {
    param ([string]$Text)
    Write-Host "  [OK] $Text" -ForegroundColor Green
}

function Write-Warn {
    param ([string]$Text)
    Write-Host "  [WARN] $Text" -ForegroundColor Yellow
}

function Write-Err {
    param ([string]$Text)
    Write-Host "  [ERROR] $Text" -ForegroundColor Red
}

function Wait-Prompt {
    param ([string]$Msg = "Press Enter to continue")
    if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
        Read-Host $Msg
    }
}

Clear-Host
Write-Header "KAPILA INVENTORY - ENTERPRISE GITHUB PUSH PIPELINE"

# Multi-Agent Swarm Header
Write-Host "  Agent Swarm Operational Status:" -ForegroundColor DarkGray
Write-Host "  ------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  [Agent 1: Architect]   " -ForegroundColor Cyan -NoNewline; Write-Host "Repository Topology & Branch Guard" -ForegroundColor White
Write-Host "  [Agent 2: Data/Impact] " -ForegroundColor Cyan -NoNewline; Write-Host "Diff Analysis & Subsystem Impact Matrix" -ForegroundColor White
Write-Host "  [Agent 3: Security]    " -ForegroundColor Cyan -NoNewline; Write-Host "Secret Leak & Sensitive File Scanner" -ForegroundColor White
Write-Host "  [Agent 4: UI/UX Engine]" -ForegroundColor Cyan -NoNewline; Write-Host "Terminal Change Dashboard & Diffstat" -ForegroundColor White
Write-Host "  [Agent 5: Core Sync]   " -ForegroundColor Cyan -NoNewline; Write-Host "Staging, Commit & Upstream Push" -ForegroundColor White
Write-Host "  [Agent 6: DevOps & QA] " -ForegroundColor Cyan -NoNewline; Write-Host "Verification & Remote Validation" -ForegroundColor White
Write-Host "  [Agent 7: Patcher]     " -ForegroundColor Cyan -NoNewline; Write-Host "Auto-Generate Production Patch Bundle" -ForegroundColor White
Write-Host "  ------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# 1. Verify Git Installation
Write-Step "Agent 1" "Verifying Git installation..."
try {
    $gitVer = (git --version 2>&1).Trim()
    Write-Success "$gitVer detected"
} catch {
    Write-Err "Git is not installed or not found in system PATH."
    Write-Host "  Please install Git from https://git-scm.com/download/win and rerun." -ForegroundColor Yellow
    Wait-Prompt "Press Enter to exit"
    exit 1
}

# 2. Check Git Repository Initialization
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot

$isRepo = Test-Path "$repoRoot\.git"
if (-not $isRepo) {
    Write-Warn "Directory is not a Git repository: $repoRoot"
    Write-Host "  [First-Time Setup Wizard]" -ForegroundColor Yellow
    $initChoice = Read-Host "  Would you like to initialize this project as a Git repository now? (Y/n)"
    if ($initChoice -match "^[Nn]") {
        Write-Host "Aborted. Git repository required." -ForegroundColor Gray
        exit 0
    }

    Write-Step "Agent 1" "Initializing Git repository (main branch)..."
    git init -b main | Out-Null
    Write-Success "Git repository initialized at $repoRoot"
}

# Check Git user configuration
$userName = (git config --get user.name 2>$null)
$userEmail = (git config --get user.email 2>$null)
if (-not $userName -or -not $userEmail) {
    Write-Warn "Git author identity is not set."
    if (-not $userName) {
        $userName = Read-Host "  Enter your Git Name (e.g. John Doe)"
        if ($userName) { git config user.name "$userName" }
    }
    if (-not $userEmail) {
        $userEmail = Read-Host "  Enter your Git Email (e.g. john@hotelkapila.com)"
        if ($userEmail) { git config user.email "$userEmail" }
    }
}
Write-Success "Author Identity: $userName <$userEmail>"

# Check Remote Origin
$allRemotes = (git remote 2>$null)
$existingRemote = ""
if ($allRemotes -contains $Remote) {
    $existingRemote = (git remote get-url $Remote 2>$null).Trim()
}
if (-not $existingRemote) {
    if ($DryRun) {
        $existingRemote = "https://github.com/USER/kapila_store.git (Dry Run Preview)"
        Write-Warn "Remote '$Remote' not configured yet (using placeholder for Dry Run preview)."
    } else {
        Write-Warn "Remote '$Remote' is not configured."
        Write-Host "  [Remote Repository Configuration]" -ForegroundColor Yellow
        $remoteUrl = ""
        if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
            $remoteUrl = Read-Host "  Enter your GitHub Repository URL (e.g. https://github.com/username/kapila_store.git)"
            $remoteUrl = $remoteUrl.Trim()
        }
        if (-not $remoteUrl) {
            Write-Err "No remote URL provided. Cannot push to GitHub without a remote."
            Wait-Prompt "Press Enter to exit"
            exit 1
        }
        git remote add $Remote $remoteUrl
        $existingRemote = $remoteUrl
        Write-Success "Remote '$Remote' configured -> $existingRemote"
    }
} else {
    Write-Success "Target Remote: $Remote ($existingRemote)"
}

# Determine Current Branch
$currentBranch = (git branch --show-current 2>$null)
if (-not $currentBranch) {
    # Could be unborn branch
    $currentBranch = "main"
}
if (-not $Branch) {
    $Branch = $currentBranch
}
Write-Success "Target Branch: $Branch"

# 3. Security Scan (Agent 3: Security Guard)
Write-Step "Agent 3" "Scanning for sensitive credentials & secret leaks..."
$leaksFound = @()
$forbiddenPatterns = @(
    "backend/.env$",
    "frontend/.env$",
    "^\.env$",
    "\.pem$",
    "\.key$",
    "id_rsa",
    "\.dump$",
    "kapila_full_restore\.sql"
)

$statusLines = (git status --porcelain 2>$null)
foreach ($line in $statusLines) {
    if ($line.Length -gt 3) {
        $file = $line.Substring(3).Trim()
        foreach ($pattern in $forbiddenPatterns) {
            if ($file -match $pattern) {
                $leaksFound += $file
            }
        }
    }
}

if ($leaksFound.Count -gt 0) {
    Write-Err "SECURITY WARNING: Found files matching sensitive patterns!"
    foreach ($leak in $leaksFound) {
        Write-Host "   -> $leak" -ForegroundColor Red
    }
    Write-Host "  These files should NOT be committed to GitHub." -ForegroundColor Red
    $ignoreOrAbort = Read-Host "  Do you want to ignore them and abort? (Y/n)"
    if ($ignoreOrAbort -notmatch "^[Nn]") {
        Write-Host "Aborted push for security protection. Please check .gitignore." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Success "Zero secret leaks detected in pending files."
}

# 4. Change Impact Matrix (Agent 2 & Agent 4)
Write-Step "Agent 2" "Analyzing changes and computing impact matrix..."

$untracked = @()
$modified = @()
$added = @()
$deleted = @()
$renamed = @()

$subsystems = @{
    "Frontend UI/UX" = 0
    "Backend & APIs" = 0
    "Database & Migrations" = 0
    "Documentation" = 0
    "Scripts & Dev Tools" = 0
    "Configuration" = 0
}

foreach ($line in $statusLines) {
    if ($line.Length -lt 3) { continue }
    $code = $line.Substring(0, 2).Trim()
    $file = $line.Substring(3).Trim()

    if ($code -eq "??") { $untracked += $file }
    elseif ($code -eq "M" -or $line.Substring(1,1) -eq "M") { $modified += $file }
    elseif ($code -eq "A" -or $line.Substring(0,1) -eq "A") { $added += $file }
    elseif ($code -eq "D" -or $line.Substring(1,1) -eq "D") { $deleted += $file }
    elseif ($code -eq "R") { $renamed += $file }
    else { $modified += $file }

    # Categorize Subsystems
    if ($file -match "^frontend/") { $subsystems["Frontend UI/UX"]++ }
    elseif ($file -match "^backend/migrations/" -or $file -match "knexfile" -or $file -match "\.sql$") { $subsystems["Database & Migrations"]++ }
    elseif ($file -match "^backend/") { $subsystems["Backend & APIs"]++ }
    elseif ($file -match "\.md$" -or $file -match "^docs/" -or $file -match "^Documentation/") { $subsystems["Documentation"]++ }
    elseif ($file -match "^scripts/" -or $file -match "\.bat$" -or $file -match "\.ps1$") { $subsystems["Scripts & Dev Tools"]++ }
    else { $subsystems["Configuration"]++ }
}

$totalChanges = $untracked.Count + $modified.Count + $added.Count + $deleted.Count + $renamed.Count

# Check for unpushed commits
$unpushedCommits = @()
$hasRemoteRef = (git rev-parse --verify "$Remote/$Branch" 2>$null)
if ($hasRemoteRef) {
    $unpushedCommits = (git log "$Remote/$Branch..HEAD" --oneline 2>$null)
}

# Display Impact Dashboard
Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkCyan
Write-Host "                 [*** WHAT CHANGES ARE GETTING EFFECTED ***]             " -ForegroundColor White
Write-Host "========================================================================" -ForegroundColor DarkCyan

Write-Host "  Files Changed Summary:" -ForegroundColor Yellow
Write-Host "    * New / Untracked : " -ForegroundColor DarkGray -NoNewline; Write-Host "$($untracked.Count)" -ForegroundColor Cyan
Write-Host "    * Modified Files  : " -ForegroundColor DarkGray -NoNewline; Write-Host "$($modified.Count)" -ForegroundColor Yellow
Write-Host "    * Staged Additions: " -ForegroundColor DarkGray -NoNewline; Write-Host "$($added.Count)" -ForegroundColor Green
Write-Host "    * Deleted Files   : " -ForegroundColor DarkGray -NoNewline; Write-Host "$($deleted.Count)" -ForegroundColor Red
Write-Host "    * Renamed Files   : " -ForegroundColor DarkGray -NoNewline; Write-Host "$($renamed.Count)" -ForegroundColor Magenta
Write-Host "    ----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "    * Total Files     : " -ForegroundColor DarkGray -NoNewline; Write-Host "$totalChanges" -ForegroundColor White

Write-Host ""
Write-Host "  Subsystem Impact Breakdown:" -ForegroundColor Yellow
foreach ($sub in $subsystems.Keys) {
    $cnt = $subsystems[$sub]
    if ($cnt -gt 0) {
        $badge = " [MODIFIED]"
        Write-Host "    [$cnt files] " -ForegroundColor Cyan -NoNewline
        Write-Host "$sub" -ForegroundColor White -NoNewline
        Write-Host $badge -ForegroundColor Green
    }
}

# Show detailed diffstat
Write-Host ""
Write-Host "  Detailed Line Changes (Diffstat):" -ForegroundColor Yellow
$diffstat = (git diff --stat 2>$null)
$stagedDiffstat = (git diff --cached --stat 2>$null)

if ($diffstat) {
    Write-Host "  -- Working Tree Diff --" -ForegroundColor DarkGray
    $diffstat | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
}
if ($stagedDiffstat) {
    Write-Host "  -- Staged Diff --" -ForegroundColor DarkGray
    $stagedDiffstat | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
}

# Display files list
if ($totalChanges -gt 0) {
    Write-Host ""
    Write-Host "  Affected Files Detail:" -ForegroundColor Yellow
    foreach ($f in $modified) { Write-Host "    [MODIFIED]  $f" -ForegroundColor Yellow }
    foreach ($f in $untracked) { Write-Host "    [NEW FILE]  $f" -ForegroundColor Cyan }
    foreach ($f in $added) { Write-Host "    [STAGED]    $f" -ForegroundColor Green }
    foreach ($f in $deleted) { Write-Host "    [DELETED]   $f" -ForegroundColor Red }
    foreach ($f in $renamed) { Write-Host "    [RENAMED]   $f" -ForegroundColor Magenta }
}

# Show unpushed commits if any
if ($unpushedCommits -and $unpushedCommits.Count -gt 0) {
    Write-Host ""
    Write-Host "  Unpushed Local Commits ($($unpushedCommits.Count)):" -ForegroundColor Yellow
    foreach ($c in $unpushedCommits) {
        Write-Host "    ^ $c" -ForegroundColor Cyan
    }
}

Write-Host "========================================================================" -ForegroundColor DarkCyan
Write-Host ""

# Check if anything needs to be done
if ($totalChanges -eq 0 -and (-not $unpushedCommits -or $unpushedCommits.Count -eq 0)) {
    Write-Success "Everything is already in sync with GitHub. No changes to commit or push."
    Wait-Prompt "Press Enter to exit"
    exit 0
}

# Dry Run Exit
if ($DryRun) {
    Write-Warn "DRY RUN MODE ENABLED: No changes were committed or pushed."
    Wait-Prompt "Press Enter to exit"
    exit 0
}

# 5. Commit Workflow (Agent 5: Core Sync)
if ($totalChanges -gt 0) {
    Write-Step "Agent 5" "Preparing commit..."
    
    if (-not $Message) {
        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        $defaultMsg = "feat(kapila): update store system - $timestamp"
        if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
            Write-Host "  Enter commit message (Press ENTER for default: '$defaultMsg'):" -ForegroundColor Yellow
            $inputMsg = Read-Host "  Commit Message"
            if ($inputMsg.Trim()) {
                $Message = $inputMsg.Trim()
            } else {
                $Message = $defaultMsg
            }
        } else {
            $Message = $defaultMsg
        }
    }

    Write-Step "Agent 5" "Staging all changes (git add -A)..."
    git add -A
    
    Write-Step "Agent 5" "Creating Git commit..."
    git commit -m "$Message"
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Commit failed. Please check error messages above."
        Wait-Prompt "Press Enter to exit"
        exit 1
    }
    Write-Success "Commit created: $Message"
}

# 6. Push to GitHub (Agent 6: DevOps / QA)
Write-Step "Agent 6" "Pushing branch '$Branch' to remote '$Remote'..."
Write-Host "  Executing: git push -u $Remote $Branch" -ForegroundColor DarkGray

$pushArgs = @("push", "-u", $Remote, $Branch)
if ($Force) {
    Write-Warn "FORCE FLAG SPECIFIED! Pushing with lease..."
    $pushArgs += "--force-with-lease"
}

& git @pushArgs
if ($LASTEXITCODE -ne 0) {
    Write-Err "Push failed!"
    Write-Host ""
    Write-Host "  Troubleshooting Suggestions:" -ForegroundColor Yellow
    Write-Host "  1. If rejected due to remote changes, run 'Pull from GitHub.bat' first." -ForegroundColor White
    Write-Host "  2. If authentication failed, ensure you are logged into GitHub via Git Credential Manager or SSH." -ForegroundColor White
    Write-Host "  3. Run 'Git Troubleshoot.bat' to run full diagnostics." -ForegroundColor White
    Write-Host ""
    Wait-Prompt "Press Enter to exit"
    exit 1
}

# Post-Push Verification
Write-Host ""
Write-Header "PUSH COMPLETED SUCCESSFULLY!"
$latestCommit = (git rev-parse --short HEAD 2>$null)
Write-Success "Pushed to: $existingRemote"
Write-Success "Branch: $Branch"
Write-Success "Commit SHA: $latestCommit"

# Try to parse GitHub web URL
if ($existingRemote -match 'github\.com[:/]([^/]+)/([^/\.]+)') {
    $ghUser = $Matches[1]
    $ghRepo = $Matches[2]
    $webUrl = "https://github.com/$ghUser/$ghRepo/tree/$Branch"
    Write-Host ""
    Write-Host "  View your changes live on GitHub:" -ForegroundColor Green
    Write-Host "  $webUrl" -ForegroundColor Cyan
}

# 7. Auto-Generate Patch Bundle (Agent 7: Patcher)
Write-Host ""
Write-Step "Agent 7" "Generating production patch bundle..."

$patchDir = Join-Path $repoRoot "patches"
if (-not (Test-Path $patchDir)) {
    New-Item -ItemType Directory -Path $patchDir -Force | Out-Null
    Write-Success "Created patches\ directory."
}

$patchTs    = (Get-Date).ToString("yyyyMMdd_HHmmss")
$patchSHA   = (git rev-parse --short HEAD 2>$null)
$patchFile  = Join-Path $patchDir "kapila_patch_${patchTs}_${patchSHA}.patch"

# Reliable range: all commits included in this push, using if/else for PS5.1 compat
$pushDepth = if ($unpushedCommits -and $unpushedCommits.Count -gt 0) { $unpushedCommits.Count } else { 1 }
$patchRange = "HEAD~${pushDepth}..HEAD"

git format-patch $patchRange --stdout 2>$null | Out-File -FilePath $patchFile -Encoding utf8
if ($LASTEXITCODE -eq 0 -and (Test-Path $patchFile) -and (Get-Item $patchFile).Length -gt 0) {
    $patchSizeKB = [Math]::Round((Get-Item $patchFile).Length / 1KB, 1)
    Write-Success "Patch bundle created! ($patchSizeKB KB)"
    Write-Host ""
    Write-Host "  Production Patch File:" -ForegroundColor Yellow
    Write-Host "  $patchFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  To apply on production:" -ForegroundColor Yellow
    Write-Host "    1. Copy the .patch file to the production machine's patches\ folder." -ForegroundColor White
    Write-Host "    2. Run: Apply Patch.bat" -ForegroundColor Cyan
    Write-Host "    - or - powershell -File scripts\git_patch.ps1 -Mode apply" -ForegroundColor DarkGray
} else {
    Write-Warn "Could not auto-generate patch (range may be empty). Run 'Apply Patch.bat' to create one manually."
    if (Test-Path $patchFile) { Remove-Item $patchFile -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
Write-Host "All agent operations completed." -ForegroundColor DarkGray
Wait-Prompt "Press Enter to finish"

