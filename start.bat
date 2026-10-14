@echo off
title Orbivex - Starting...
color 0A

echo.
echo  =============================================
echo    Orbivex EdTech Platform - Startup
echo  =============================================
echo.

:: ─── Check Node.js ───
node --version >nul 2>&1
if errorlevel 1 (
  echo  [ERROR] Node.js is not installed or not on PATH.
  echo  Install Node.js 20+ from https://nodejs.org and re-run this script.
  echo.
  pause
  exit /b 1
)
echo  [OK] Node.js found.

:: ─── Install backend dependencies (first time only) ───
if not exist "backend\node_modules" (
  echo  Installing backend dependencies...
  pushd backend
  call npm install
  popd
)

:: ─── Install frontend dependencies (first time only) ───
if not exist "frontend\node_modules" (
  echo  Installing frontend dependencies...
  pushd frontend
  call npm install
  popd
)

:: ─── Start Backend API ───
echo.
echo  Starting backend API (http://localhost:3001)...
start "Orbivex API" cmd /k "cd backend && node --env-file=../.env server.js"

:: ─── Start Frontend Dev Server ───
echo  Starting frontend (http://localhost:5173)...
start "Orbivex Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo  =============================================
echo    Orbivex is starting.
echo    Frontend : http://localhost:5173
echo    API      : http://localhost:3001
echo    Health   : http://localhost:3001/api/health
echo.
echo    AI: NVIDIA NIM (primary) + OpenRouter
echo    (fallback). Set NVIDIA_API_KEY and
echo    OPENROUTER_API_KEY in .env
echo.
echo    To stop: run stop.bat or close the windows.
echo  =============================================
echo.
pause
