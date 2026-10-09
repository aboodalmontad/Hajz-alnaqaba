# Aleppo Bar Association - Queue Management System
# Script for PowerShell on Windows

$Host.UI.RawUI.WindowTitle = "Aleppo Bar Association - Queue Management System"
Set-Location -LiteralPath $PSScriptRoot

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Aleppo Bar Association - Queue Management System" -ForegroundColor Cyan
Write-Host "  نظام إدارة الدور والانتظار - نقابة المحامين بحلب" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js LTS from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

# Check package.json
if (-not (Test-Path "package.json")) {
    $found = Get-ChildItem -Directory -Recurse -Depth 2 | Where-Object { Test-Path (Join-Path $_.FullName "package.json") } | Select-Object -First 1
    if ($found) {
        Write-Host "[INFO] Found project in $($found.FullName)" -ForegroundColor Green
        Set-Location -LiteralPath $found.FullName
    } else {
        Write-Host "======================================================" -ForegroundColor Red
        Write-Host "[ERROR] package.json not found in $PWD" -ForegroundColor Red
        Write-Host "يرجى فك ضغط مجلد المشروع وتشغيل السكربت من داخل المجلد." -ForegroundColor Yellow
        Write-Host "======================================================" -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
}

# Remove any broken leftover folder
if (Test-Path "node_modules\@supabase") {
    Remove-Item -Recurse -Force "node_modules\@supabase" -ErrorAction SilentlyContinue
}

# Install lightweight dependencies if needed
if (-not (Test-Path "node_modules\express")) {
    Write-Host "[1/3] Installing lightweight server dependencies (express, socket.io)..." -ForegroundColor Yellow
    npm install express socket.io --legacy-peer-deps --fetch-retries=5 --fetch-retry-mintimeout=5000
}

Write-Host ""
Write-Host "[3/3] Starting local server on port 3000..." -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " السيرفر يعمل الآن على المنفذ 3000" -ForegroundColor Green
Write-Host " يرجى إبقاء هذه النافذة مفتوحة طوال فترة عمل النظام" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path "server.mjs") {
    node server.mjs
} else {
    npm run dev
}
