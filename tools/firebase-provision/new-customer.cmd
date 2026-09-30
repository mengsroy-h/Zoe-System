@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found.
    echo Install Node.js 22 LTS from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0])>=20?0:1)"
if errorlevel 1 (
    echo ERROR: Node.js 20 or newer is required.
    pause
    exit /b 1
)

node provision.js new %*
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" echo DONE. Copy the passwords above before closing this window.
if "%RESULT%"=="1" echo FAILED. Read the message above, fix it, then run this file again to continue.
if "%RESULT%"=="3" echo Created, but some security checks could not be measured. Run verify later.
pause
exit /b %RESULT%
