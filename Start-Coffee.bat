@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js LTS, then run this file again.
  pause
  exit /b 1
)
echo Open http://localhost:3000 in your browser.
echo Keep this window open while using Coffee.
node server.js
pause
