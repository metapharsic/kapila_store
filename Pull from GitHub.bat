@echo off
title Kapila Inventory - Pull from GitHub
color 0A

echo.
echo  ========================================================================
echo   KAPILA INVENTORY - ENTERPRISE GITHUB PULL LAUNCHER
echo  ========================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\git_pull.ps1" %*

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Script exited with code %errorlevel%.
    echo  Run 'Git Troubleshoot.bat' to diagnose any Git, merge, or network issues.
    echo.
    pause
    exit /b %errorlevel%
)
