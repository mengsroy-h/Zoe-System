@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules\playwright-core\package.json" (
    echo ERROR: Setup is not complete. Run setup.cmd first.
    pause
    exit /b 1
)

if not exist "%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\config.json" (
    echo ERROR: Netlify configuration is missing. Run setup.cmd first.
    pause
    exit /b 1
)

if not exist "%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\netlify-token.dpapi" (
    echo ERROR: The encrypted Netlify token is missing. Run setup.cmd first.
    pause
    exit /b 1
)

node sync-zto-cookie.js
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
