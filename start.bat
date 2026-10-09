@echo off
title Queue Management System - Aleppo Bar Association
color 0B
cls

echo ======================================================
echo   Aleppo Bar Association - Queue Management System
echo ======================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, please restart your computer and run this file again.
    echo.
    pause
    exit /b 1
)

REM Check if npm is available
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found! Please reinstall Node.js.
    echo.
    pause
    exit /b 1
)

echo [1/3] Checking dependencies (node_modules)...
if not exist "node_modules" (
    echo Installing dependencies for the first time...
    call npm install
)

echo [2/3] Starting local server on port 3000...
echo [NOTE] Please keep this window open while using the system.
echo.
npm run start

pause
