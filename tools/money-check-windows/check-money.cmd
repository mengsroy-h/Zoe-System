@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Zoe money reality check  (read-only, offline)
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo   1. Open https://nodejs.org
  echo   2. Download the LTS version and install it.
  echo   3. Close this window and run this file again.
  echo.
  pause
  exit /b 1
)

set "DUMP=%~1"
if "%DUMP%"=="" (
  echo Step 1  Firebase Console  ^>  Realtime Database  ^>  3 dots  ^>  Export JSON
  echo Step 2  Drag the downloaded file onto this window, then press Enter.
  echo.
  set /p "DUMP=Dump file: "
)

set "DUMP=%DUMP:"=%"
if not exist "%DUMP%" (
  echo.
  echo ERROR: file not found: %DUMP%
  echo.
  pause
  exit /b 1
)

set "REPORT=%USERPROFILE%\Desktop\zoe-money-report.txt"

echo.
echo Reading... (nothing is uploaded, nothing is written to Firebase)
echo.
node "..\..\audit-tools\money-reality-check.js" "%DUMP%" --report "%REPORT%"
set "CODE=%ERRORLEVEL%"

echo.
echo Making a share-safe copy (phone numbers and barcodes removed)...
set "SAFE=%USERPROFILE%\Desktop\zoe-dump-SAFE-TO-SHARE.json"
node "..\..\audit-tools\redact-dump.js" "%DUMP%" "%SAFE%"
echo.
if exist "%REPORT%" start "" notepad "%REPORT%"
echo The Khmer report opened in Notepad. It is also saved on your Desktop.
echo.
echo SAFE TO SEND : zoe-money-report.txt          (Desktop)
echo SAFE TO SEND : zoe-dump-SAFE-TO-SHARE.json   (Desktop)
echo DO NOT SEND  : the original export from Firebase (real phone numbers)
echo.
pause
exit /b %CODE%
