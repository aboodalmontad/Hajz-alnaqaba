@echo off
title Aleppo Bar Association - Queue Management System
color 0B
cls

cd /d "%~dp0"

echo ======================================================
echo   Aleppo Bar Association - Queue Management System
echo ======================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo Please install Node.js from https://nodejs.org/ and restart your PC.
    echo.
    pause
    exit /b 1
)

echo [1/2] Checking and installing required server packages (express, socket.io)...
if not exist "node_modules\express" (
    call npm install express socket.io --legacy-peer-deps
)

if not exist "node_modules\express" (
    echo.
    echo [WARNING] Automatic installation failed. Trying general npm install...
    call npm install --legacy-peer-deps
)

if not exist "node_modules\express" (
    echo.
    echo ======================================================
    echo [ERROR] Cannot find package 'express'.
    echo Please ensure you have an active internet connection
    echo for 10 seconds to download dependencies on first run.
    echo ======================================================
    echo.
    pause
    exit /b 1
)

if not exist "server.mjs" (
    echo [INFO] Building application distribution...
    call npm run build
)

echo.
echo [2/2] Starting local server on port 3000...
echo ======================================================
echo  Server is running! Open browser at: http://localhost:3000
echo  Keep this window open while using the system.
echo ======================================================
echo.

node server.mjs

echo.
echo ======================================================
echo  [NOTE] Server has stopped or encountered an error.
echo  Press any key to close this window...
echo ======================================================
pause
