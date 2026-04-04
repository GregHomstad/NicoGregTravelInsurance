@echo off
title TripKavach Dev Environment
echo ============================================
echo   TripKavach Dev Environment
echo ============================================
echo.
echo Starting API server (port 3002)...
start "TripKavach API Server" cmd /k "cd /d %~dp0 && set VAULT_KEY=TkV8x#mR2$pQw9Lz&& node server/index.js"
echo Starting Vite dev server (port 5174)...
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5174
echo.
echo Opening browser...
echo.
npm run dev
