@echo off
title Kapila Inventory - Stop
color 0C

echo.
echo  Stopping Kapila Inventory System...
echo  ---------------------------------------
echo.

:: Kill node processes on ports 3001 and 8008
echo  [1/2] Stopping backend (port 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo  [2/2] Stopping frontend (port 8008)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8008 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Also close the named terminal windows (wildcard, since cmd may append
:: the running command to the window title)
taskkill /FI "WINDOWTITLE eq Kapila Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Kapila Frontend*" /F >nul 2>&1

echo.
echo  Backend stopped
echo  Frontend stopped
echo.
echo  All Kapila servers have been shut down.
echo  Press any key to close...
pause >nul
