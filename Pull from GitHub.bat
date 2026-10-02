@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Kapila Inventory - Pull from GitHub
color 0A

echo.
echo  ========================================================================
echo    KAPILA INVENTORY MANAGEMENT SYSTEM
echo    ENTERPRISE GITHUB PULL WIZARD  ^|  Multi-Agent Pipeline
echo  ========================================================================
echo.
echo  Agent Swarm initializing...
echo   [Agent 1] Repository topology ^& upstream verification
echo   [Agent 2] Pre-merge change ^& diffstat inspector
echo   [Agent 3] Working tree cleanliness ^& conflict guard
echo   [Agent 4] Incoming commits ^& affected files dashboard
echo   [Agent 5] Safe fetch ^& non-destructive pull
echo   [Agent 6] Post-pull dependency ^& migration alerts
echo   [Agent 7] Service restart ^& post-pull patch bundle
echo.
echo  ========================================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Git is not installed or not in system PATH.
    echo  Please install Git from https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

where powershell.exe >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] PowerShell not found.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set BRANCH=%%i
if "%BRANCH%"=="" set BRANCH=main
for /f "tokens=*" %%i in ('git remote get-url origin 2^>nul') do set REMOTE=%%i

echo  Repository : %CD%
echo  Branch     : [%BRANCH%]
echo  Remote     : origin ^(%REMOTE%^)
echo.
echo  ========================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\git_pull.ps1" %*

if %errorlevel% neq 0 (
    echo.
    color 0C
    echo  [ERROR] Pull pipeline exited with code %errorlevel%.
    echo  Run 'Git Troubleshoot.bat' to diagnose any Git, merge, or network issues.
    echo.
    pause
    exit /b %errorlevel%
)
