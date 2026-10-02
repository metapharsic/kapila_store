@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Kapila Inventory - Apply Production Patch
color 0B

echo.
echo  ========================================================================
echo    KAPILA INVENTORY - INTELLIGENT PATCH APPLICATOR
echo  ========================================================================
echo.
echo  This wizard safely applies a .patch bundle to your Kapila installation.
echo  It will:
echo    [1] List all available patches in the patches\ directory
echo    [2] Let you select which patch to apply
echo    [3] Dry-run conflict check BEFORE touching any files
echo    [4] Apply the patch with full rollback instructions
echo    [5] Alert you on npm install / database migration requirements
echo    [6] Optionally restart Kapila services
echo.
echo  ========================================================================
echo.

where powershell.exe >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] PowerShell is not available on this system.
    echo  Please install PowerShell to use the Kapila Patch system.
    echo.
    pause
    exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Git is not installed or not in system PATH.
    echo  Please install Git for Windows: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0patches\" (
    color 0E
    echo  [WARN] No patches\ directory found.
    echo  Run "Push to GitHub.bat" first to generate patch bundles,
    echo  or copy a .patch file into the patches\ directory manually.
    echo.
    pause
    exit /b 0
)

echo  Launching Patch Engine...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass ^
    -File "%~dp0scripts\git_patch.ps1" ^
    -Mode apply ^
    %*

if %errorlevel% neq 0 (
    echo.
    color 0C
    echo  [ERROR] Patch engine exited with code %errorlevel%.
    echo  Review the error messages above for details.
    echo.
    pause
    exit /b %errorlevel%
)
