@echo off
setlocal enabledelayedexpansion
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

set "CFG=%LOCALAPPDATA%\Zoe-System\money-check"
set "REPOFILE=%CFG%\repo.txt"
set "REPO="

rem 1) normal case: this folder is still inside the project
if exist "%~dp0..\..\audit-tools\money-reality-check.js" (
  for %%I in ("%~dp0..\..") do set "REPO=%%~fI"
)

rem 2) a folder we were told about last time
if not defined REPO if exist "%REPOFILE%" (
  for /f "usebackq delims=" %%L in ("%REPOFILE%") do set "REPO=%%L"
)
if defined REPO if not exist "!REPO!\audit-tools\money-reality-check.js" set "REPO="

rem 3) ask the user once, then remember it
if not defined REPO (
  echo This tool needs the Zoe-System project folder
  echo   ^(it reads the real money code out of ZoeW\app.js^).
  echo.
  echo If you do not have it: open the GitHub page, click Code, then
  echo Download ZIP, and unzip it somewhere like D:\Zoe-System.
  echo.
  echo Drag the Zoe-System folder onto this window and press Enter.
  set /p "REPO=Zoe-System folder: "
  set "REPO=!REPO:"=!"
  if "!REPO:~-1!"=="\" set "REPO=!REPO:~0,-1!"
)

if not exist "!REPO!\audit-tools\money-reality-check.js" (
  echo.
  echo ERROR: that folder does not look like Zoe-System.
  echo   Expected to find: audit-tools\money-reality-check.js
  echo   You gave        : !REPO!
  echo.
  pause
  exit /b 1
)
if not exist "!REPO!\ZoeW\app.js" (
  echo.
  echo ERROR: ZoeW\app.js not found inside !REPO!
  echo   The project folder looks incomplete.
  echo.
  pause
  exit /b 1
)
if not exist "%CFG%" mkdir "%CFG%" >nul 2>nul
> "%REPOFILE%" echo !REPO!

set "DUMP=%~1"
if "%DUMP%"=="" (
  echo.
  echo Step 1  Firebase Console  ^>  Realtime Database  ^>  3 dots  ^>  Export JSON
  echo Step 2  Drag the downloaded file onto this window, then press Enter.
  echo.
  set /p "DUMP=Dump file: "
)
set "DUMP=!DUMP:"=!"
if not exist "!DUMP!" (
  echo.
  echo ERROR: file not found: !DUMP!
  echo.
  pause
  exit /b 1
)

set "REPORT=%USERPROFILE%\Desktop\zoe-money-report.txt"
set "SAFE=%USERPROFILE%\Desktop\zoe-dump-SAFE-TO-SHARE.json"

echo.
echo Project : !REPO!
echo Reading... (nothing is uploaded, nothing is written to Firebase)
echo.
node "!REPO!\audit-tools\money-reality-check.js" "!DUMP!" --report "%REPORT%"
set "CODE=!ERRORLEVEL!"
if !CODE! GEQ 2 (
  echo.
  echo ERROR: the check could not run - nothing was measured.
  echo   This is a tool problem, NOT a money problem.
  echo.
  pause
  exit /b !CODE!
)

echo.
echo Making a share-safe copy (phone numbers and barcodes removed)...
node "!REPO!\audit-tools\redact-dump.js" "!DUMP!" "%SAFE%"

echo.
if exist "%REPORT%" start "" notepad "%REPORT%"
echo The Khmer report opened in Notepad. It is also saved on your Desktop.
echo.
echo SAFE TO SEND : zoe-money-report.txt          (Desktop)
echo SAFE TO SEND : zoe-dump-SAFE-TO-SHARE.json   (Desktop)
echo DO NOT SEND  : the original export from Firebase (real phone numbers)
echo.
pause
exit /b !CODE!
