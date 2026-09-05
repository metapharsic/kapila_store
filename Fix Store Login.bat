@echo off
title Kapila Inventory - Fix Store Login
color 0B

echo.
echo  Hotel Kapila Inventory - Fix Store Manager / Chef Login
echo  --------------------------------------------------
echo.
echo  This will (re)create the Store Manager and Chef login
echo  accounts and permissions. It is safe to run more than once.
echo.

cd /d %~dp0backend
call node scripts\seed_user_accounts.js

echo.
echo  --------------------------------------------------
echo  Done. Check the messages above for any errors.
echo  --------------------------------------------------
echo.
pause
