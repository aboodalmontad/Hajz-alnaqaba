@echo off
title Aleppo Bar Association - Queue Management System
color 0B
cls

REM Change directory to where this script is located
cd /d "%~dp0"

echo ======================================================
echo   Aleppo Bar Association - Queue Management System
echo ======================================================
echo.

REM 1. Verify Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart your computer and run start.bat again.
    echo.
    pause
    exit /b 1
)

REM 2. Verify npm is available
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found! Please reinstall Node.js.
    echo.
    pause
    exit /b 1
)

REM 3. Check if package.json exists in current folder or subfolder
if exist "package.json" goto PROJECT_READY

for /d %%D in (*) do (
    if exist "%%D\package.json" (
        echo [INFO] Found project in subfolder: %%D
        cd /d "%~dp0%%D"
        goto PROJECT_READY
    )
)

for /d %%A in (*) do (
    for /d %%B in ("%%A\*") do (
        if exist "%%B\package.json" (
            echo [INFO] Found project in subfolder: %%B
            cd /d "%%B"
            goto PROJECT_READY
        )
    )
)

:PROJECT_NOT_FOUND
echo ======================================================
echo [ERROR] package.json NOT FOUND!
echo ======================================================
echo Current directory: %cd%
echo.
echo File start.bat is running in a folder that does not
echo contain the project files (package.json, server.mjs, dist).
echo.
echo HOW TO FIX:
echo 1. Extract the downloaded ZIP file completely.
echo 2. Open the extracted folder where package.json is located.
echo 3. Make sure start.bat is inside that folder.
echo 4. Double-click start.bat from inside that folder.
echo ======================================================
echo.
pause
exit /b 1

:PROJECT_READY
echo Working directory: %cd%
echo.

REM Remove any broken/locked old temporary folders from prior failed attempts
if exist "node_modules\@supabase" rd /s /q "node_modules\@supabase" 2>nul

echo [1/3] Checking server dependencies...
if not exist "node_modules\express" (
    echo Installing lightweight server dependencies (express, socket.io)...
    echo This will only download ~4MB and takes just a few seconds...
    call npm install express socket.io --legacy-peer-deps --fetch-retries=5 --fetch-retry-mintimeout=5000
)

if not exist "node_modules\express" (
    echo Retrying dependencies installation...
    call npm install --omit=dev --legacy-peer-deps --fetch-retries=5 --fetch-retry-mintimeout=5000
)

if not exist "node_modules\express" (
    echo.
    echo ======================================================
    echo [ERROR] Dependencies installation was interrupted!
    echo Connection timed out or was reset (ECONNRESET).
    echo.
    echo Please make sure your internet is connected for 10 seconds
    echo and run start.bat again.
    echo ======================================================
    echo.
    pause
    exit /b 1
)

echo [2/3] Verified pre-built application distribution (dist).

echo.
echo [3/3] Starting local server on port 3000...
echo ======================================================
echo  Server is now running on port 3000!
echo  Keep this window open while using the system.
echo ======================================================
echo.

if exist "server.mjs" (
    node server.mjs
) else (
    call npm run dev
)

if %errorlevel% neq 0 (
    echo.
    echo [NOTE] Server stopped with status code: %errorlevel%
    pause
)
