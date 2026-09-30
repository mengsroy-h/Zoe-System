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

echo Installing the pinned firebase-tools into this folder...
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
    echo ERROR: npm ci failed. Check the internet connection and try again.
    pause
    exit /b 1
)

echo.
echo A browser window opens: sign in with the Google account that owns the customer projects.
node provision.js login
if errorlevel 1 (
    echo ERROR: Google sign-in did not finish.
    pause
    exit /b 1
)

node provision.js doctor
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo ERROR: Setup did not complete.
pause
exit /b %RESULT%
