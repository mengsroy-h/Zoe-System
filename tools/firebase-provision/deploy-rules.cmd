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

node -e "const v=process.versions.node.split('.').map(Number);process.exit((v[0]===22&&(v[1]>22||v[1]===22&&v[2]>=2)||v[0]===24&&v[1]>=15)?0:1)"
if errorlevel 1 (
    echo ERROR: Node.js 22.22.2 or newer in 22.x, or 24.15.0 or newer in 24.x is required.
    pause
    exit /b 1
)

node provision.js rules --all --verify %*
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo Something needs attention. Read the messages above.
pause
exit /b %RESULT%
