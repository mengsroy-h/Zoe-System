@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo ERROR: Windows PowerShell was not found.
    pause
    exit /b 1
)

if not exist "%~dp0schedule.ps1" (
    echo ERROR: schedule.ps1 is missing. Download the tool folder again.
    pause
    exit /b 1
)

if /i "%~1"=="remove" goto remove
if /i "%~1"=="/remove" goto remove
if /i "%~1"=="uninstall" goto remove

if not exist "%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\config.json" (
    echo ERROR: Setup is not complete. Run setup.cmd first.
    pause
    exit /b 1
)

REM The gate asks the tool itself, so a key that exists but cannot be
REM unlocked is reported instead of registering a task that dies silently.
node sync-zto-cookie.js --auto-ready
if errorlevel 1 (
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule.ps1"
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%

:remove
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule.ps1" -Remove
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
