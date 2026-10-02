<#
.SYNOPSIS
    Kapila IMS - Enterprise Multi-Agent GitHub Pull Pipeline
.DESCRIPTION
    Safely fetches remote updates, performs pre-merge impact analysis (incoming commits,
    diffstat, affected subsystems), detects conflict risks, stashes dirty trees,
    and alerts on required dependency installations or database migrations.
.PARAMETER Branch
    Target Git branch (defaults to current branch or 'main').
.PARAMETER Remote
    Target Git remote (defaults to 'origin').
.PARAMETER AutoStash
    Automatically stash uncommitted changes before pull and reapply afterwards.
.PARAMETER Rebase
    Use git pull --rebase instead of standard merge pull.
#>

[CmdletBinding()]
param (
    [string]$Branch,
    [string]$Remote = "origin",
    [switch]$AutoStash,
    [switch]$Rebase,
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
Write-Header "KAPILA INVENTORY - ENTERPRISE GITHUB PULL PIPELINE"

# Multi-Agent Swarm Header
Write-Host "  Agent Swarm Operational Status:" -ForegroundColor DarkGray
Write-Host "  ------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  [Agent 1: Architect]   " -ForegroundColor Cyan -NoNewline; Write-Host "Repository Topology & Upstream Verification" -ForegroundColor White
Write-Host "  [Agent 2: Data/Impact] " -ForegroundColor Cyan -NoNewline; Write-Host "Pre-Merge Change & Diffstat Inspector" -ForegroundColor White
Write-Host "  [Agent 3: Stash Guard] " -ForegroundColor Cyan -NoNewline; Write-Host "Working Tree Cleanliness & Conflict Guard" -ForegroundColor White
Write-Host "  [Agent 4: UI/UX Engine]" -ForegroundColor Cyan -NoNewline; Write-Host "Incoming Commits & Affected Files Dashboard" -ForegroundColor White
Write-Host "  [Agent 5: Core Sync]   " -ForegroundColor Cyan -NoNewline; Write-Host "Safe Fetch & Non-Destructive Pull" -ForegroundColor White
Write-Host "  [Agent 6: DevOps & QA] " -ForegroundColor Cyan -NoNewline; Write-Host "Post-Pull Dependency & Migration Alerts" -ForegroundColor White
Write-Host "  [Agent 7: Patcher]     " -ForegroundColor Cyan -NoNewline; Write-Host "Post-Pull Patch Bundle & Service Restart" -ForegroundColor White
Write-Host "  ------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# 1. Verify Git & Repository
Write-Step "Agent 1" "Verifying local Git repository..."
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot

if (-not (Test-Path "$repoRoot\.git")) {
    Write-Err "Directory is not a Git repository: $repoRoot"
    Write-Host "  Please run 'Push to GitHub.bat' first to initialize the repository." -ForegroundColor Yellow
    Wait-Prompt "Press Enter to exit"
    exit 1
}

# Determine Current Branch & Remote
$currentBranch = (git branch --show-current 2>$null)
if (-not $currentBranch) { $currentBranch = "main" }
if (-not $Branch) { $Branch = $currentBranch }

$allRemotes = (git remote 2>$null)
$remoteUrl = ""
if ($allRemotes -contains $Remote) {
    $remoteUrl = (git remote get-url $Remote 2>$null).Trim()
}
if (-not $remoteUrl) {
    Write-Err "Remote '$Remote' is not configured."
    Write-Host "  Please run 'Push to GitHub.bat' to configure remote origin." -ForegroundColor Yellow
    Wait-Prompt "Press Enter to exit"
    exit 1
}

Write-Success "Repository: $repoRoot"
Write-Success "Branch    : $Branch"
Write-Success "Remote    : $Remote ($remoteUrl)"

# 2. Check Working Tree Cleanliness (Agent 3: Stash Guard)
Write-Step "Agent 3" "Checking local working tree cleanliness..."
$dirtyFiles = (git status --porcelain 2>$null)
$stashed = $false

if ($dirtyFiles -and $dirtyFiles.Count -gt 0) {
    Write-Warn "You have $($dirtyFiles.Count) uncommitted local change(s)."
    Write-Host "  Uncommitted files:" -ForegroundColor Yellow
    $dirtyFiles | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    if ($dirtyFiles.Count -gt 10) {
        Write-Host "    ... and $($dirtyFiles.Count - 10) more" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "  Select how to handle local changes before pulling:" -ForegroundColor Yellow
    Write-Host "    [1] Safe Stash (Recommended: temporarily stash, pull, then reapply)" -ForegroundColor Green
    Write-Host "    [2] Abort Pull (exit so you can review and commit your changes)" -ForegroundColor Cyan
    Write-Host "    [3] Attempt direct pull anyway (may fail if overlapping files exist)" -ForegroundColor Yellow
    
    $choice = "1"
    if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
        $inputChoice = Read-Host "  Enter choice (1/2/3, default 1)"
        if ($inputChoice) { $choice = $inputChoice }
    }

    if ($choice -eq "2") {
        Write-Host "Pull aborted by user. Please commit or stash your changes." -ForegroundColor Yellow
        exit 0
    } elseif ($choice -eq "1" -or $AutoStash) {
        Write-Step "Agent 3" "Stashing local changes..."
        $stashTimestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        git stash save "auto-stash-before-pull-$stashTimestamp"
        $stashed = $true
        Write-Success "Local changes safely stashed."
    }
} else {
    Write-Success "Working tree is clean. Ready to pull."
}

# 3. Non-Destructive Fetch (Agent 5: Safe Sync)
Write-Step "Agent 5" "Fetching updates from remote '$Remote'..."
Write-Host "  Executing: git fetch $Remote" -ForegroundColor DarkGray
git fetch $Remote
if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to connect to remote '$Remote'. Check your internet connection or GitHub credentials."
    if ($stashed) {
        Write-Warn "Restoring your stashed local changes..."
        git stash pop | Out-Null
    }
    Wait-Prompt "Press Enter to exit"
    exit 1
}
Write-Success "Fetch completed successfully."

# 4. Pre-Merge Impact Analysis (Agent 2 & Agent 4)
Write-Step "Agent 2" "Analyzing incoming changes and calculating impact..."

$targetRef = "$Remote/$Branch"
$refExists = (git rev-parse --verify $targetRef 2>$null)
if (-not $refExists) {
    Write-Warn "Remote tracking branch '$targetRef' does not exist yet."
    Write-Host "  The remote repository might not have this branch pushed yet." -ForegroundColor Gray
    if ($stashed) { git stash pop | Out-Null }
    Read-Host "Press Enter to exit"
    exit 0
}

# Calculate commits ahead / behind
$counts = (git rev-list --left-right --count "HEAD...$targetRef" 2>$null)
$behindCount = 0
$aheadCount = 0
if ($counts -match "(\d+)\s+(\d+)") {
    $aheadCount = [int]$Matches[1]
    $behindCount = [int]$Matches[2]
}

# Get incoming commit list
$incomingCommits = (git log "HEAD..$targetRef" --oneline --no-merges 2>$null)

# Get incoming affected files and diffstat
$incomingDiffstat = (git diff --stat "HEAD..$targetRef" 2>$null)
$incomingFiles = (git diff --name-only "HEAD..$targetRef" 2>$null)

# Subsystems affected by incoming changes
$subsystems = @{
    "Frontend UI/UX" = 0
    "Backend & APIs" = 0
    "Database & Migrations" = 0
    "Package Dependencies" = 0
    "Documentation" = 0
    "Configuration & Tools" = 0
}

$depsChanged = $false
$migrationsChanged = $false
$envChanged = $false

foreach ($file in $incomingFiles) {
    if ($file -match "package\.json$" -or $file -match "package-lock\.json$") {
        $subsystems["Package Dependencies"]++
        $depsChanged = $true
    }
    if ($file -match "^backend/migrations/" -or $file -match "knexfile" -or $file -match "\.sql$") {
        $subsystems["Database & Migrations"]++
        $migrationsChanged = $true
    }
    if ($file -match "^frontend/") { $subsystems["Frontend UI/UX"]++ }
    elseif ($file -match "^backend/") { $subsystems["Backend & APIs"]++ }
    elseif ($file -match "\.md$" -or $file -match "^docs/") { $subsystems["Documentation"]++ }
    else { $subsystems["Configuration & Tools"]++ }

    if ($file -match "\.env\.example") { $envChanged = $true }
}

# Display Impact Dashboard
Write-Host ""
Write-Host "========================================================================" -ForegroundColor DarkCyan
Write-Host "             [*** WHAT CHANGES ARE GETTING EFFECTED ON PULL ***]        " -ForegroundColor White
Write-Host "========================================================================" -ForegroundColor DarkCyan

Write-Host "  Sync Status:" -ForegroundColor Yellow
Write-Host "    * Local is ahead by  : " -ForegroundColor DarkGray -NoNewline; Write-Host "$aheadCount commit(s)" -ForegroundColor $(if ($aheadCount -gt 0) { "Yellow" } else { "Green" })
Write-Host "    * Local is behind by : " -ForegroundColor DarkGray -NoNewline; Write-Host "$behindCount commit(s)" -ForegroundColor $(if ($behindCount -gt 0) { "Cyan" } else { "Green" })

if ($behindCount -eq 0) {
    Write-Host ""
    Write-Success "Already up to date! There are no incoming changes from GitHub."
    if ($stashed) {
        Write-Step "Agent 3" "Restoring your stashed local changes..."
        git stash pop
        Write-Success "Stash restored."
    }
    Write-Host "========================================================================" -ForegroundColor DarkCyan
    Wait-Prompt "Press Enter to finish"
    exit 0
}

Write-Host ""
Write-Host "  Incoming Commits ($behindCount):" -ForegroundColor Yellow
foreach ($c in $incomingCommits) {
    Write-Host "    v $c" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  Subsystems Affected by Incoming Pull:" -ForegroundColor Yellow
foreach ($sub in $subsystems.Keys) {
    $cnt = $subsystems[$sub]
    if ($cnt -gt 0) {
        Write-Host "    [$cnt files] " -ForegroundColor Cyan -NoNewline
        Write-Host "$sub" -ForegroundColor White
    }
}

if ($incomingDiffstat) {
    Write-Host ""
    Write-Host "  Incoming Files Diffstat:" -ForegroundColor Yellow
    $incomingDiffstat | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
}

Write-Host "========================================================================" -ForegroundColor DarkCyan
Write-Host ""

# 5. Execute Pull (Agent 5: Safe Sync)
Write-Step "Agent 5" "Pulling updates into local branch '$Branch'..."

# Capture current HEAD before pull so we can show rollback command
$BEFORE_HASH = (git rev-parse HEAD 2>$null)
$BEFORE_SHORT = (git rev-parse --short HEAD 2>$null)

$pullCmd = @("pull", $Remote, $Branch)
if ($Rebase) {
    $pullCmd += "--rebase"
    Write-Host "  Executing: git pull --rebase $Remote $Branch" -ForegroundColor DarkGray
} else {
    Write-Host "  Executing: git pull $Remote $Branch" -ForegroundColor DarkGray
}

& git @pullCmd
$pullExitCode = $LASTEXITCODE


if ($pullExitCode -ne 0) {
    Write-Err "Pull encountered conflicts or failed to merge."
    Write-Host ""
    Write-Host "  Conflict Resolution Steps:" -ForegroundColor Yellow
    Write-Host "  1. Look for conflict markers (<<<<<<< HEAD) in affected files." -ForegroundColor White
    Write-Host "  2. Edit files to resolve conflicting lines, then run 'git add <file>'." -ForegroundColor White
    Write-Host "  3. Complete merge with 'git commit'." -ForegroundColor White
    Write-Host "  4. Or abort this pull completely with: git merge --abort" -ForegroundColor White
    Write-Host "  See GIT_TROUBLESHOOTING.md for complete guide." -ForegroundColor Cyan
    Write-Host ""
    Wait-Prompt "Press Enter to exit"
    exit 1
}

Write-Success "Merge completed successfully."

# Restore Stash if needed
if ($stashed) {
    Write-Step "Agent 3" "Restoring stashed local changes..."
    git stash pop
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Stash pop had conflicts with incoming pulled changes!"
        Write-Host "  Your local changes are still safe in Git stash." -ForegroundColor Yellow
        Write-Host "  Run 'git stash list' and inspect conflicts." -ForegroundColor Yellow
    } else {
        Write-Success "Local changes successfully restored."
    }
}

# 6. Post-Pull Operational Alerts (Agent 6: DevOps & QA)
Write-Host ""
Write-Header "POST-PULL SYSTEM ALERTS & ACTION ITEMS"

$actionsNeeded = $false

if ($depsChanged) {
    $actionsNeeded = $true
    Write-Warn "DEPENDENCY CHANGE DETECTED!"
    Write-Host "    package.json or package-lock.json was updated in this pull." -ForegroundColor Yellow
    Write-Host "    Recommended action:" -ForegroundColor White
    Write-Host "      cd frontend && npm install" -ForegroundColor Cyan
    Write-Host "      cd backend  && npm install" -ForegroundColor Cyan
    Write-Host ""
    if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
        $runNpm = Read-Host "  Run npm install in frontend and backend now? [Y/n] (default Y)"
        if (-not $runNpm -or $runNpm -match "^[Yy]") {
            Write-Step "Agent 6" "Running npm install in frontend..."
            $frontendDir = Join-Path $repoRoot "frontend"
            if (Test-Path $frontendDir) {
                Push-Location $frontendDir
                npm install
                Pop-Location
                Write-Success "Frontend npm install complete."
            } else { Write-Warn "frontend\ directory not found, skipping." }

            Write-Step "Agent 6" "Running npm install in backend..."
            $backendDir = Join-Path $repoRoot "backend"
            if (Test-Path $backendDir) {
                Push-Location $backendDir
                npm install
                Pop-Location
                Write-Success "Backend npm install complete."
            } else { Write-Warn "backend\ directory not found, skipping." }
        }
    }
}

if ($migrationsChanged) {
    $actionsNeeded = $true
    Write-Warn "DATABASE MIGRATION DETECTED!"
    Write-Host "    New database schema or migration files were pulled." -ForegroundColor Yellow
    Write-Host "    Recommended action:" -ForegroundColor White
    Write-Host "      cd backend && npx knex migrate:latest" -ForegroundColor Cyan
    Write-Host ""
    if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
        $runMig = Read-Host "  Run 'npx knex migrate:latest' in backend now? [Y/n] (default Y)"
        if (-not $runMig -or $runMig -match "^[Yy]") {
            Write-Step "Agent 6" "Running database migrations..."
            $backendDir = Join-Path $repoRoot "backend"
            if (Test-Path $backendDir) {
                Push-Location $backendDir
                npx knex migrate:latest
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Database migrations completed successfully."
                } else {
                    Write-Warn "Migration command returned errors. Review the output above."
                }
                Pop-Location
            } else { Write-Warn "backend\ directory not found, skipping migration." }
        }
    }
}

if ($envChanged) {
    $actionsNeeded = $true
    Write-Warn "ENVIRONMENT TEMPLATE (.env.example) UPDATED!"
    Write-Host "    Review any new configuration variables required for Kapila IMS." -ForegroundColor Yellow
    Write-Host "    Compare .env.example to your active .env files and add missing keys." -ForegroundColor White
}

if (-not $actionsNeeded) {
    Write-Success "All files merged smoothly. No dependency or database migrations required."
}

# Rollback reference
Write-Host ""
$currentShort = (git rev-parse --short HEAD 2>$null)
Write-Success "Local repository is now at commit: $currentShort"
Write-Host ""
Write-Host "  ROLLBACK (if pull introduced issues):" -ForegroundColor DarkGray
Write-Host "    git reset --hard <previous-SHA>" -ForegroundColor Yellow
if ($BEFORE_HASH) {
    Write-Host "    e.g. git reset --hard $BEFORE_HASH" -ForegroundColor Yellow
}

# Agent 7: Service Restart Offer
Write-Host ""
Write-Step "Agent 7" "Checking service restart options..."
$restartScript = Join-Path $repoRoot "Stop Kapila.bat"
$startScript   = Join-Path $repoRoot "Start Kapila.bat"
if ((Test-Path $restartScript) -and (Test-Path $startScript)) {
    Write-Host ""
    if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
        $restartAnswer = Read-Host "  Restart Kapila services now to apply pulled changes? [Y/n] (default N)"
        if ($restartAnswer -match "^[Yy]") {
            Write-Step "Agent 7" "Stopping Kapila services..."
            Start-Process -FilePath $restartScript -Wait -WindowStyle Normal
            Start-Sleep -Seconds 2
            Write-Step "Agent 7" "Starting Kapila services..."
            Start-Process -FilePath $startScript -WindowStyle Normal
            Write-Success "Kapila services restarted with latest pulled code."
        } else {
            Write-Host "  Services not restarted. Run 'Start Kapila.bat' manually when ready." -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  (Start Kapila.bat / Stop Kapila.bat not found — restart manually if needed)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "All agent operations completed." -ForegroundColor DarkGray
Wait-Prompt "Press Enter to finish"
