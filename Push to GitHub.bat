@echo off
title Kapila Inventory - Push to GitHub
color 0B

echo.
echo  ========================================================================
echo   KAPILA INVENTORY - ENTERPRISE GITHUB PUSH LAUNCHER
echo  ========================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\git_push.ps1" %*

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Script exited with code %errorlevel%.
    echo  Run 'Git Troubleshoot.bat' to diagnose any Git or network issues.
    echo.
    pause
    exit /b %errorlevel%
)
