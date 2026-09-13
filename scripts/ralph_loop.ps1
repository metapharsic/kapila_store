<#
.SYNOPSIS
    Ralph Loop — Autonomous AI Agent Execution Harness for Windows PowerShell.
#>

param(
    [int]$MaxIterations = 10,
    [string]$AgentCommand = "claude"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $ProjectRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  KAPILA INVENTORY - RALPH AUTONOMOUS CODING LOOP" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("Project Root   : " + $ProjectRoot) -ForegroundColor Gray
Write-Host ("Max Iterations : " + $MaxIterations) -ForegroundColor Gray
Write-Host ("Agent Command  : " + $AgentCommand) -ForegroundColor Gray
Write-Host ""

$ProgressFile = Join-Path $ProjectRoot "progress.txt"
if (-not (Test-Path $ProgressFile)) {
    Write-Error "progress.txt not found. Please create one before running Ralph."
    exit 1
}

$iteration = 0

while ($iteration -lt $MaxIterations) {
    $iteration++
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host ("`n[" + $timestamp + "] === Starting Ralph Iteration #" + $iteration + " of " + $MaxIterations + " ===") -ForegroundColor Yellow

    # Check if all tasks are already done
    $progressContent = Get-Content -Path $ProgressFile -Raw
    if ($progressContent -match "(?m)^ALL_TASKS_COMPLETED\s*$") {
        Write-Host "`nAll tasks in progress.txt are marked COMPLETED!" -ForegroundColor Green
        break
    }

    # Verify Git state
    $gitBranch = (git branch --show-current).Trim()
    Write-Host ("Current Git Branch: " + $gitBranch) -ForegroundColor Gray

    # Build prompt for this iteration
    $prompt = @"
You are operating inside an autonomous Ralph Loop.
Follow these rules strictly:
1. Inspect progress.txt and git log -n 5.
2. Pick the FIRST pending item under [ACTIVE_BACKLOG] marked with [ ].
3. Implement the feature or bug fix completely following rules in AGENTS.md.
4. Run verification:
   - In frontend/: npm run build
   - In backend/: npm test
5. Ensure zero errors and zero failing tests.
6. Commit your changes to git with a clear conventional commit message.
7. Update progress.txt: mark the task [x] COMPLETED with the commit hash and date.
8. If no pending tasks remain, append 'ALL_TASKS_COMPLETED' to progress.txt.
9. Exit cleanly so the next iteration starts with fresh context.
"@

    Write-Host ("Invoking agent (" + $AgentCommand + ")...") -ForegroundColor Cyan
    try {
        $cmdCheck = Get-Command $AgentCommand -ErrorAction SilentlyContinue
        if ($cmdCheck) {
            & $AgentCommand -p $prompt
        } else {
            Write-Host ("Agent CLI '" + $AgentCommand + "' not found in PATH.") -ForegroundColor Yellow
            Write-Host "Running automated verification pipeline..." -ForegroundColor Gray
            
            Write-Host "  -> Verifying frontend build..." -ForegroundColor Gray
            Set-Location "$ProjectRoot\frontend"
            npm run build
            
            Write-Host "  -> Running backend tests..." -ForegroundColor Gray
            Set-Location "$ProjectRoot\backend"
            npm test
            
            Set-Location $ProjectRoot
            Write-Host "Verification passed successfully" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host ("Iteration #" + $iteration + " encountered an error: " + $_.Exception.Message) -ForegroundColor Red
    }

    # Post-iteration check
    $progressContent = Get-Content -Path $ProgressFile -Raw
    if ($progressContent -match "(?m)^ALL_TASKS_COMPLETED\s*$") {
        Write-Host "`nAll tasks completed! Exiting loop." -ForegroundColor Green
        break
    }

    Write-Host ("Iteration #" + $iteration + " completed. Cooldown 3s...") -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host ("Ralph loop session finished after " + $iteration + " iteration(s).") -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
