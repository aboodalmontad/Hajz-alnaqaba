@echo off
chcp 65001 > nul
title نظام إدارة الدور - نقابة المحامين بحلب (دائرة الوكالات)
echo ======================================================
echo    تشغيل نظام إدارة الدور المحلي - نقابة المحامين بحلب
echo ======================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [خطأ] لم يتم العثور على Node.js في جهازك. يرجى تثبيت Node.js أولاً من الموقع الرسمي:
    echo https://nodejs.org/
    echo ثم حاول تشغيل هذا الملف مرة أخرى.
    pause
    exit /b 1
)

echo [1/3] التحقق من تثبيت الحزم والمكتبات اللازمة...
if not exist "node_modules" (
    call npm install
)

echo [2/3] بناء وتشغيل الخادم المحلي على المنفذ 3000...
echo [ملاحظة] يرجى عدم إغلاق هذه النافذة أثناء عمل النظام.
echo.
npm run start

pause
