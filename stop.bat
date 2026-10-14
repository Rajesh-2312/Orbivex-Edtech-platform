@echo off
title Orbivex - Stopping...
color 0C

echo.
echo  Stopping Orbivex services...

:: Kill the API and frontend windows started by start.bat
taskkill /FI "WINDOWTITLE eq Orbivex API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Orbivex Frontend*" /T /F >nul 2>&1

echo.
echo  [OK] All Orbivex services stopped.
echo.
pause
