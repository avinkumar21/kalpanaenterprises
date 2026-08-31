@echo off
title ARKA Local Print Service Daemon (Port 5000)
color 0A
cd /d "D:\Arka\kalpana-enterprises"

echo ===============================================================
echo       ARKA LOCAL PRINT SERVICE DAEMON (PORT 5000 / 8082)        
echo          Permanent Production Agent for Shop Desktop            
echo ===============================================================
echo.
echo [1] Checking Node.js runtime...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in system PATH.
    pause
    exit /b 1
)

echo [2] Checking physical printers...
powershell -Command "Get-Printer | Where-Object { $_.Name -like '*Epson*' -or $_.Name -like '*HP*' } | Select-Object Name, PortName, PrinterStatus | Format-Table -AutoSize"

echo.
echo [3] Testing HP Wi-Fi static IP (192.168.31.2)...
ping -n 1 -w 1000 192.168.31.2 >nul
if %ERRORLEVEL% equ 0 (
    echo [INFO] HP Wi-Fi Printer reachable at 192.168.31.2.
) else (
    echo [WARN] HP Wi-Fi unreachable. USB cable fallback is armed.
)

echo.
echo [4] Starting Print Daemon on http://localhost:5000/print...
echo REST Endpoint: http://localhost:5000/print
echo Health Check:  http://localhost:5000/health
echo Dashboard:     http://localhost:5000/prints
echo Secondary:     http://localhost:8082
echo.
node daemon\arka_print_daemon.js
pause
