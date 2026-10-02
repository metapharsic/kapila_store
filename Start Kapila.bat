@echo off
title Kapila Inventory - Start
color 0A

echo.
echo  =============================================
echo   KAPILA - Hotel Inventory Management System
echo  =============================================
echo.

:: Make sure dependencies are installed
if not exist "%~dp0backend\node_modules" (
    echo.
    echo  [ERROR] Dependencies not installed - please run Setup Kapila.bat first.
    echo.
    pause
    exit /b 1
)
if not exist "%~dp0frontend\node_modules" (
    echo.
    echo  [ERROR] Dependencies not installed - please run Setup Kapila.bat first.
    echo.
    pause
    exit /b 1
)

:: Ensure PostgreSQL database exists
echo  [0/2] Checking PostgreSQL database...
set PGPASSWORD=postgres
:: NOTE: If your local PostgreSQL install uses a different password for the
:: postgres user, change the line above to match it.
psql -U postgres -h localhost -c "SELECT 1 FROM pg_database WHERE datname='kapila'" 2>nul | findstr /B "1" >nul 2>&1
if %errorlevel% neq 0 (
    echo      Database "kapila" not found. Attempting to create it...
    psql -U postgres -h localhost -c "CREATE DATABASE kapila;" >nul 2>&1
    if %errorlevel% neq 0 (
        echo      [WARNING] Could not automatically create database "kapila".
        echo      If you run into database errors, please create it manually:
        echo      psql -U postgres -c "CREATE DATABASE kapila;"
        timeout /t 3 >nul
    ) else (
        echo      Database "kapila" created successfully.
    )
) else (
    echo      Database "kapila" verified.
)

:: Start backend
echo  [1/2] Starting backend (PostgreSQL + Express on :3001)...
start "Kapila Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: Wait 2s for backend to boot
timeout /t 2 /nobreak >nul

:: Start frontend
echo  [2/2] Starting frontend (Vite on :8008)...
start "Kapila Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Wait then open browser
timeout /t 3 /nobreak >nul
echo.
echo  App running at http://localhost:8008
echo  API running at http://localhost:3001/api/health
echo.
start http://localhost:8008

echo  Both servers started.
echo  Press any key in THIS window to shut down both servers.
pause >nul

if exist "%~dp0Stop Kapila.bat" call "%~dp0Stop Kapila.bat"
