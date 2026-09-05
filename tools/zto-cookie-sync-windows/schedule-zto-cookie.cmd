@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "TASKNAME=Zoe ZTO Cookie Sync"

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

echo Registering a logon task that refreshes the ZTO cookie only when needed.
echo The task runs: sync-zto-cookie.cmd --auto
echo It checks the Function first and opens the browser only if the cookie is dead.
echo.

schtasks /Create /TN "%TASKNAME%" /TR "\"%~dp0sync-zto-cookie.cmd\" --auto" /SC ONLOGON /RL LIMITED /F
if errorlevel 1 (
    echo ERROR: The scheduled task could not be created.
    pause
    exit /b 1
)

echo.
echo Done. Run "schedule-zto-cookie.cmd remove" to delete the task.
pause
exit /b 0

:remove
schtasks /Delete /TN "%TASKNAME%" /F
if errorlevel 1 (
    echo ERROR: The scheduled task could not be deleted (it may not exist).
    pause
    exit /b 1
)
echo Removed.
pause
exit /b 0
