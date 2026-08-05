@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-jarvis.ps1"
if errorlevel 1 (
  echo.
  echo J.A.R.V.I.S. konnte nicht gestartet werden.
  pause
)
