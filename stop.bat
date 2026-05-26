@echo off
title Orbivex - Stopping...
color 0C

echo.
echo  Stopping Orbivex backend services...
docker compose down
echo.
echo  [OK] All backend services stopped.
echo.
pause
