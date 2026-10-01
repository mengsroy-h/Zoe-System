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

node provision.js rules --all %*
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" goto done
node provision.js verify --all
set "RESULT=%ERRORLEVEL%"
:done
if not "%RESULT%"=="0" echo Something needs attention. Read the messages above.
pause
exit /b %RESULT%
