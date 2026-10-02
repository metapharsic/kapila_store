@echo off
title Kapila Inventory - Setup
color 0B

echo.
echo  Hotel Kapila Inventory System - First-Time Setup
echo  --------------------------------------------------
echo.

:: Check Node.js
echo  [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js was not found on your PATH.
    echo  Please install Node.js version 20 or later from https://nodejs.org
    echo  then run this Setup script again.
    echo.
    pause
    exit /b 1
)
echo      Node.js found.

:: Check PostgreSQL client
echo  [2/5] Checking PostgreSQL (psql)...
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] PostgreSQL (psql) was not found on your PATH.
    echo  Please install PostgreSQL from https://www.postgresql.org/download/
    echo  then run this Setup script again.
    echo.
    pause
    exit /b 1
)
echo      PostgreSQL found.

:: Ensure PostgreSQL database exists
echo  [3/5] Checking/creating database "kapila"...
set PGPASSWORD=postgres
:: NOTE: If your local PostgreSQL install uses a different password for the
:: postgres user, change the line above to match it.
psql -U postgres -h localhost -c "SELECT 1 FROM pg_database WHERE datname='kapila'" 2>nul | findstr /B "1" >nul 2>&1
if %errorlevel% neq 0 (
    echo      Database "kapila" not found. Creating it...
    psql -U postgres -h localhost -c "CREATE DATABASE kapila;" >nul 2>&1
    if %errorlevel% neq 0 (
        echo      [WARNING] Could not automatically create database "kapila".
        echo      Please create it manually:
        echo      psql -U postgres -c "CREATE DATABASE kapila;"
        pause
        exit /b 1
    ) else (
        echo      Database "kapila" created successfully.
    )
) else (
    echo      Database "kapila" already exists.
)

:: Install backend dependencies
echo  [4/5] Installing backend dependencies...
if exist "%~dp0backend\node_modules" (
    echo      backend\node_modules already exists, skipping npm install.
) else (
    pushd "%~dp0backend"
    call npm install
    popd
)

:: Install frontend dependencies
echo      Installing frontend dependencies...
if exist "%~dp0frontend\node_modules" (
    echo      frontend\node_modules already exists, skipping npm install.
) else (
    pushd "%~dp0frontend"
    call npm install
    popd
)

:: Load data
echo  [5/5] Database contents
echo.
echo  Would you like to load the real production data now?
echo  (stock, indents, recipes, users - recommended for normal use)
choice /C YN /M "Load production data"
if errorlevel 2 goto emptyschema
if errorlevel 1 goto loaddata

:loaddata
echo.
echo  Loading production data from backend\exports\kapila_full_restore.sql ...
psql -U postgres -h localhost -d kapila -f "%~dp0backend\exports\kapila_full_restore.sql"
if %errorlevel% neq 0 (
    echo      [WARNING] Restore reported an error. Check the messages above.
) else (
    echo      Production data loaded successfully.
)
goto seedaccounts

:emptyschema
echo.
echo  Setting up an empty schema via migrations...
pushd "%~dp0backend"
call npm run migrate
popd
goto seedaccounts

:seedaccounts
echo.
echo  Setting up Store Manager and Chef login accounts...
pushd "%~dp0backend"
call node scripts\seed_user_accounts.js
if %errorlevel% neq 0 (
    echo      [WARNING] Seed script reported an error. Check the messages above.
    echo      You can re-run it later with Fix Store Login.bat
) else (
    echo      Store Manager and Chef accounts are ready.
)
popd
goto setupdone

:setupdone
echo.
echo  --------------------------------------------------
echo  Setup complete - run Start Kapila.bat to launch the app.
echo  --------------------------------------------------
echo.
pause
