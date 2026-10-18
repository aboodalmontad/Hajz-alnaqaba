@echo off
title Aleppo Bar Association - Windows Firewall Port 3000 Fix
color 0A
cls

echo ======================================================
echo   Aleppo Bar Association - Queue Management System
echo   Fix Windows Firewall for Local Server (Port 3000)
echo ======================================================
echo.
echo [INFO] Adding inbound firewall rule to allow Port 3000
echo        on Private, Public, and Domain networks...
echo.

netsh advfirewall firewall delete rule name="Aleppo Queue System (Port 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="Aleppo Queue System (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any

if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo  [SUCCESS] Port 3000 is now ALLOWED on all networks!
    echo  Other devices and phones can now access the server
    echo  even when Internet is connected or active.
    echo ======================================================
) else (
    echo.
    echo ======================================================
    echo  [NOTE] Please run this file as ADMINISTRATOR:
    echo  Right-click fix_firewall.bat -^> 'Run as administrator'
    echo ======================================================
)

echo.
pause
