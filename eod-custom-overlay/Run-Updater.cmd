@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%Run-Updater.ps1"

echo EoD Custom Overlay Config-Driven Updater
echo Mode is read from updater.config.json (manual or auto)

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
set EXIT_CODE=%ERRORLEVEL%

if "%EXIT_CODE%"=="0" (
    echo Updater finished successfully.
) else (
    echo Updater failed. Check logs in logs\updater\ or logs\autoupdater\
)

echo.
pause
exit /b %EXIT_CODE%
