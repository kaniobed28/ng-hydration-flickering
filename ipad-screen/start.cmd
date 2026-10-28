@echo off
rem Starts the iPad second screen and opens the PC page in Edge.
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 1 >nul & start msedge http://localhost:8080"
node server.js
pause
