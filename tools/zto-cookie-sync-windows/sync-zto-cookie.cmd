@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if /I "%~1"=="--help" goto help
node -e "const s=require('./sync-zto-cookie.js');try{s.capturedCookieDisplayOptions(process.argv.slice(1),process.stdin.isTTY===true&&process.stdout.isTTY===true)}catch(e){console.error('ERROR: '+s.safeFailureMessage(e.code));process.exitCode=1}" -- %*
if errorlevel 1 exit /b %ERRORLEVEL%

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

set "ZTOARGS=%*"
node sync-zto-cookie.js %*
set "RESULT=%ERRORLEVEL%"
echo %ZTOARGS% | find /I "--auto" >nul
if errorlevel 1 pause
exit /b %RESULT%

:help
node sync-zto-cookie.js %*
exit /b %ERRORLEVEL%
