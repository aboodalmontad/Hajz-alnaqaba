@echo off
cd /d "%~dp0"
echo ======================================================
echo   Aleppo Bar Association - Persistent Server Runner
echo ======================================================
if not exist "node_modules\express" (
    echo Installing dependencies (express, socket.io)...
    call npm install express socket.io --legacy-peer-deps
)
if not exist "server.mjs" (
    call npm run build
)
node server.mjs
echo.
echo ======================================================
echo  [NOTE] Server has stopped. Press any key to exit...
echo ======================================================
pause
