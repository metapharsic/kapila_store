@echo off
title Kapila Inventory - Git Troubleshooter & Diagnostics
color 0E

echo.
echo  ========================================================================
echo   KAPILA INVENTORY - GIT DIAGNOSTIC & HEALTH ENGINE
echo  ========================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\git_diagnose.ps1"

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Diagnostic exited with code %errorlevel%.
    echo.
    pause
    exit /b %errorlevel%
)
