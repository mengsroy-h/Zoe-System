@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found.
    echo Install Node.js 22 LTS, then run setup.cmd again:
    echo https://nodejs.org/
    pause
    exit /b 1
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo ERROR: Windows PowerShell was not found.
    echo PowerShell is required to encrypt the Netlify token with DPAPI.
    pause
    exit /b 1
)

node -e "const [M,m]=process.versions.node.split('.').map(Number);process.exit(M>22||(M===22&&m>=17)?0:1)"
if errorlevel 1 (
    echo ERROR: Node.js 22.17.0 or newer is required.
    pause
    exit /b 1
)

echo Installing the pinned dependency in this tool folder...
call npm install --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
    echo ERROR: npm install failed. Check the internet connection and try again.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure.ps1"
if errorlevel 1 (
    echo ERROR: Netlify configuration could not be saved.
    pause
    exit /b 1
)

node sync-zto-cookie.js --verify-setup
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo ERROR: Setup did not complete.
pause
exit /b %RESULT%
