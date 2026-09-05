<#
.SYNOPSIS
    Kapila IMS - Enterprise Git Diagnostic & Troubleshooting Engine
.DESCRIPTION
    Runs an exhaustive 10-point health check covering repository topology, remotes,
    credentials, network connectivity, merge conflict markers, large files (>25MB),
    secret leaks (.env), and generates actionable copy-paste solutions.
#>

[CmdletBinding()]
param (
    [switch]$NoPrompt
)

$ErrorActionPreference = "Continue"

function Write-Header {
    param ([string]$Text)
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Yellow
    Write-Host "========================================================================" -ForegroundColor Cyan
}

function Write-TestResult {
    param ([string]$TestName, [string]$Status, [string]$Details, [string]$FixCmd)
    Write-Host " [$Status] " -NoNewline -ForegroundColor $(
        if ($Status -eq "PASS") { "Green" }
        elseif ($Status -eq "WARN") { "Yellow" }
        else { "Red" }
    )
    Write-Host "$TestName " -ForegroundColor White -NoNewline
    if ($Details) { Write-Host "- $Details" -ForegroundColor Gray } else { Write-Host "" }
    if ($FixCmd -and ($Status -eq "WARN" -or $Status -eq "FAIL")) {
        Write-Host "         --> Quick Fix: $FixCmd" -ForegroundColor Cyan
    }
}

Clear-Host
Write-Header "KAPILA INVENTORY - GIT DIAGNOSTIC & TROUBLESHOOTING ENGINE"
Write-Host "  Analyzing environment, repository health, security, and GitHub connectivity..." -ForegroundColor DarkGray
Write-Host ""

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot

$issuesCount = 0
$warningsCount = 0

# Test 1: Git Executable
$gitVer = (git --version 2>&1)
if ($LASTEXITCODE -eq 0 -and $gitVer -match "git version") {
    Write-TestResult "Git Installation" "PASS" $gitVer.Trim()
} else {
    $issuesCount++
    Write-TestResult "Git Installation" "FAIL" "Git is not installed or not in PATH." "Download & install Git from https://git-scm.com/download/win"
}

# Test 2: Repository Root Initialization
$isRepo = Test-Path "$repoRoot\.git"
if ($isRepo) {
    Write-TestResult "Git Repository" "PASS" "Repository initialized at $repoRoot"
} else {
    $issuesCount++
    Write-TestResult "Git Repository" "FAIL" "Directory is NOT a Git repository." "cd '$repoRoot' && git init -b main"
}

# Test 3: User Identity (user.name & user.email)
$userName = (git config --get user.name 2>$null)
$userEmail = (git config --get user.email 2>$null)
if ($userName -and $userEmail) {
    Write-TestResult "Author Identity" "PASS" "$userName <$userEmail>"
} else {
    $warningsCount++
    Write-TestResult "Author Identity" "WARN" "Git username or email is missing." "git config --global user.name 'Your Name' ; git config --global user.email 'you@example.com'"
}

# Test 4: Remote Configuration
$remoteOrigin = (git remote get-url origin 2>$null)
if ($remoteOrigin) {
    Write-TestResult "Remote 'origin'" "PASS" "$remoteOrigin"
} else {
    $warningsCount++
    Write-TestResult "Remote 'origin'" "WARN" "No remote 'origin' configured." "git remote add origin https://github.com/USERNAME/REPO.git"
}

# Test 5: Network Connectivity to GitHub
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $async = $tcp.BeginConnect("github.com", 443, $null, $null)
    $success = $async.AsyncWaitHandle.WaitOne(3000, $false)
    if ($success) {
        $tcp.EndConnect($async)
        $tcp.Close()
        Write-TestResult "GitHub Connectivity" "PASS" "Successfully reached github.com:443"
    } else {
        $warningsCount++
        Write-TestResult "GitHub Connectivity" "WARN" "Timeout connecting to github.com:443" "Check internet connection, proxy settings, or firewall."
    }
} catch {
    $warningsCount++
    Write-TestResult "GitHub Connectivity" "WARN" "Failed to reach github.com:443 ($($_.Exception.Message))" "Check DNS/firewall settings."
}

# Test 6: Branch & Head Status
if ($isRepo) {
    $currentBranch = (git branch --show-current 2>$null)
    if ($currentBranch) {
        Write-TestResult "Active Branch" "PASS" "On branch '$currentBranch'"
    } else {
        $isDetached = (git status 2>&1) -match "HEAD detached"
        if ($isDetached) {
            $warningsCount++
            Write-TestResult "Active Branch" "WARN" "Repository is in DETACHED HEAD state!" "git switch main  (or git checkout -b my-recovery-branch)"
        } else {
            Write-TestResult "Active Branch" "WARN" "Unborn branch (no commits yet)" "Make your first commit using 'Push to GitHub.bat'"
        }
    }
}

# Test 7: Working Tree Status & Dirty Files
if ($isRepo) {
    $dirty = (git status --porcelain 2>$null)
    if (-not $dirty -or $dirty.Count -eq 0) {
        Write-TestResult "Working Tree" "PASS" "Working tree is clean. Ready for push/pull."
    } else {
        Write-TestResult "Working Tree" "INFO" "$($dirty.Count) pending uncommitted change(s)." "Commit with 'Push to GitHub.bat' or stash with 'git stash'"
    }
}

# Test 8: Merge Conflict Marker Audit
Write-Host ""
Write-Host "  Auditing files for unresolved merge conflict markers..." -ForegroundColor DarkGray
$conflictFiles = @()
try {
    $searchRoots = @(
        (Join-Path $repoRoot "frontend\src"),
        (Join-Path $repoRoot "backend\controllers"),
        (Join-Path $repoRoot "backend\routes"),
        (Join-Path $repoRoot "backend\services"),
        (Join-Path $repoRoot "backend\models"),
        (Join-Path $repoRoot "backend\middleware"),
        (Join-Path $repoRoot "backend\migrations"),
        (Join-Path $repoRoot "backend\tests")
    )
    foreach ($sr in $searchRoots) {
        if (Test-Path $sr) {
            $matches = Get-ChildItem -Path $sr -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx,*.json 2>$null |
                Select-String -Pattern "^<{7} HEAD" -SimpleMatch 2>$null
            if ($matches) {
                foreach ($m in $matches) {
                    $conflictFiles += $m.Path
                }
            }
        }
    }
} catch {}

if ($conflictFiles.Count -eq 0) {
    Write-TestResult "Merge Conflict Markers" "PASS" "No unresolved conflict markers found"
} else {
    $issuesCount++
    Write-TestResult "Merge Conflict Markers" "FAIL" "$($conflictFiles.Count) file(s) contain conflict markers (<<<<<<< HEAD)" "Open conflicting files, resolve code, then git add"
    foreach ($cf in $conflictFiles) {
        Write-Host "         Conflict file: $cf" -ForegroundColor Red
    }
}

# Test 9: Large Files Audit (>25MB)
Write-Host "  Scanning for large files that might exceed GitHub's limits (>25MB)..." -ForegroundColor DarkGray
$largeFiles = @()
# Scan root files
Get-ChildItem -Path $repoRoot -File 2>$null | Where-Object { $_.Length -gt 25MB } | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    $largeFiles += "$($_.FullName) ($sizeMB MB)"
}
# Scan non-ignored top-level directories
$topDirs = Get-ChildItem -Path $repoRoot -Directory 2>$null | Where-Object { $_.Name -notin @('node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage') }
foreach ($td in $topDirs) {
    Get-ChildItem -Path $td.FullName -Recurse -File 2>$null | Where-Object {
        $_.FullName -notmatch "node_modules|dist|build" -and $_.Length -gt 25MB
    } | ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 2)
        $largeFiles += "$($_.FullName) ($sizeMB MB)"
    }
}
if ($largeFiles.Count -eq 0) {
    Write-TestResult "File Size Audit (<25MB)" "PASS" "All project files are within standard GitHub upload limits"
} else {
    $warningsCount++
    Write-TestResult "File Size Audit" "WARN" "$($largeFiles.Count) file(s) exceed 25MB (GitHub limit is 100MB)" "Add to .gitignore or use Git LFS"
    foreach ($lf in $largeFiles) {
        Write-Host "         Large file: $lf" -ForegroundColor Yellow
    }
}

# Test 10: Secret Leak & .env Audit
Write-Host "  Scanning for exposed credentials or unignored secret files..." -ForegroundColor DarkGray
$secretLeaks = @()
$envFiles = @("backend/.env", "frontend/.env", ".env")
$giPath = Join-Path $repoRoot ".gitignore"
$giContent = if (Test-Path $giPath) { Get-Content $giPath -Raw } else { "" }

foreach ($ef in $envFiles) {
    $p = Join-Path $repoRoot $ef
    if (Test-Path $p) {
        if ($isRepo) {
            $ignored = (git check-ignore $ef 2>$null)
            if (-not $ignored) {
                $secretLeaks += "$ef is NOT ignored in .gitignore!"
            }
        } else {
            $baseName = Split-Path $ef -Leaf
            if ($giContent -notmatch "(?m)^\s*($([regex]::Escape($ef))|$([regex]::Escape($baseName))|\*\.env|\.env\*)" ) {
                $secretLeaks += "$ef is NOT listed in .gitignore!"
            }
        }
    }
}
if ($secretLeaks.Count -eq 0) {
    Write-TestResult "Secret & .env Protection" "PASS" "Sensitive environment files are safely excluded from Git"
} else {
    $issuesCount++
    Write-TestResult "Secret & .env Protection" "FAIL" "Potential credential exposure!" "Add .env and backend/.env to .gitignore immediately"
    foreach ($sl in $secretLeaks) {
        Write-Host "         Exposed file: $sl" -ForegroundColor Red
    }
}

# Summary Report
Write-Host ""
Write-Header "DIAGNOSTIC SUMMARY & HEALTH SCORE"
$totalTests = 10
$passedTests = $totalTests - ($issuesCount + $warningsCount)
$scorePct = [math]::Round(($passedTests / $totalTests) * 100, 0)

Write-Host "  Overall Git Health Score: " -NoNewline
if ($scorePct -ge 90) { Write-Host "$scorePct% [HEALTHY]" -ForegroundColor Green }
elseif ($scorePct -ge 70) { Write-Host "$scorePct% [WARNINGS DETECTED]" -ForegroundColor Yellow }
else { Write-Host "$scorePct% [CRITICAL ISSUES FOUND]" -ForegroundColor Red }

Write-Host "  * Critical Issues (FAIL) : $issuesCount" -ForegroundColor $(if ($issuesCount -gt 0) { "Red" } else { "Green" })
Write-Host "  * Warnings (WARN)        : $warningsCount" -ForegroundColor $(if ($warningsCount -gt 0) { "Yellow" } else { "Green" })
Write-Host ""

# Action Options
Write-Host "  Recommended Next Steps:" -ForegroundColor Yellow
if ($issuesCount -eq 0 -and $warningsCount -eq 0) {
    Write-Host "    * Your Git setup is in perfect health!" -ForegroundColor Green
    Write-Host "    * To push your latest changes, run 'Push to GitHub.bat'" -ForegroundColor Cyan
    Write-Host "    * To pull updates from your team, run 'Pull from GitHub.bat'" -ForegroundColor Cyan
} else {
    Write-Host "    * Review the copy-paste quick fixes listed above for any FAIL or WARN items." -ForegroundColor White
    Write-Host "    * For detailed instructions on resolving any issue, see GIT_TROUBLESHOOTING.md" -ForegroundColor Cyan
}

if (-not $NoPrompt -and -not [Console]::IsInputRedirected) {
    Read-Host "Press Enter to exit"
}
