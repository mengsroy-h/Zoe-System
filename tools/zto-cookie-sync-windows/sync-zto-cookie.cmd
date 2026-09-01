@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules\playwright-core\package.json" (
    echo ❌ មិនទាន់ Setup។ សូម double-click setup.cmd ម្តងជាមុនសិន។
    pause
    exit /b 1
)

if not exist "%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\config.json" (
    echo ❌ មិនទាន់មាន Netlify config។ សូម double-click setup.cmd ម្តងជាមុនសិន។
    pause
    exit /b 1
)

if not exist "%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\netlify-token.dpapi" (
    echo ❌ មិនទាន់មាន Netlify token ដែលបានអ៊ិនគ្រីប។ សូម double-click setup.cmd ម្តងជាមុនសិន។
    pause
    exit /b 1
)

node sync-zto-cookie.js
set "RESULT=%ERRORLEVEL%"
pause
exit /b %RESULT%
