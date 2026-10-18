@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing Knob Orbit, one-time setup...
  call npm install
)
call npm run build:ui
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
