@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo ❌ រកមិនឃើញ Node.js។ សូមដំឡើង Node.js 22 LTS រួចបើក setup.cmd ម្តងទៀត។
    echo    https://nodejs.org/
    pause
    exit /b 1
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo ❌ រកមិនឃើញ Windows PowerShell។ ឧបករណ៍ត្រូវការ PowerShell ដើម្បីអ៊ិនគ្រីប Token ដោយ DPAPI។
    pause
    exit /b 1
)

node -e "const [M,m]=process.versions.node.split('.').map(Number);process.exit(M>22||(M===22&&m>=17)?0:1)"
if errorlevel 1 (
    echo ❌ ត្រូវការ Node.js 22.17.0 ឬថ្មីជាងនេះ។
    pause
    exit /b 1
)

echo ⏳ កំពុងដំឡើង dependency ក្នុងថតឧបករណ៍...
call npm install --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
    echo ❌ npm install បរាជ័យ។ ពិនិត្យអ៊ីនធឺណិត រួចសាកម្តងទៀត។
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure.ps1"
if errorlevel 1 (
    echo ❌ រក្សា Netlify config មិនបាន។
    pause
    exit /b 1
)

node sync-zto-cookie.js --verify-setup
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo ❌ Setup មិនទាន់រួចរាល់។
pause
exit /b %RESULT%
