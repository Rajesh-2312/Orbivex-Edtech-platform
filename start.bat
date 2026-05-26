@echo off
title Orbivex - Starting...
color 0A

echo.
echo  =============================================
echo    Orbivex EdTech Platform - Startup
echo  =============================================
echo.

:: ─── Check Docker ───
docker info >nul 2>&1
if errorlevel 1 (
  echo  [ERROR] Docker Desktop is not running.
  echo  Please start Docker Desktop first, then re-run this script.
  echo.
  pause
  exit /b 1
)
echo  [OK] Docker Desktop is running.

:: ─── Start Backend Services ───
echo.
echo  Starting backend services (API + Ollama + Redis)...
docker compose up -d --build
if errorlevel 1 (
  echo  [ERROR] docker compose failed. Check the output above.
  pause
  exit /b 1
)
echo  [OK] Backend services started.

:: ─── Pull AI model if needed ───
echo.
echo  Checking AI model (tinyllama)...
docker compose exec -T ollama ollama list 2>nul | findstr "tinyllama" >nul
if errorlevel 1 (
  echo  Pulling tinyllama model (first-time only, ~600 MB)...
  docker compose exec -T ollama ollama pull tinyllama
) else (
  echo  [OK] tinyllama model already present.
)

:: ─── Start Frontend ───
echo.
echo  Starting frontend dev server...
echo  (It will open at http://localhost:5173)
echo.
echo  =============================================
echo    Services Running:
echo    Frontend  ->  http://localhost:5173
echo    Backend   ->  http://localhost:3001
echo    Ollama    ->  http://localhost:11435
echo  =============================================
echo.
echo  Press Ctrl+C in this window to stop the frontend.
echo  To stop backend: run  docker compose down
echo.

cd frontend
npm run dev
