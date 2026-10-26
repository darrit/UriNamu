@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Setup-Windows.ps1" %*
if errorlevel 1 (
  echo Setup failed. See the error message above.
  pause
  exit /b 1
)
