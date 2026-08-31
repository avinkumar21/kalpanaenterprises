@echo off
title ARKA Local Print Daemon Status & Diagnostics
color 0E
cd /d "D:\Arka\kalpana-enterprises"

echo ===============================================================
echo        ARKA LOCAL PRINT SERVICE DAEMON STATUS CHECK            
echo ===============================================================
echo.

echo [1] Checking Daemon Ports...
powershell -Command "Get-NetTCPConnection -LocalPort 5000, 8082 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State | Format-Table -AutoSize"

echo.
echo [2] Probing REST Health Endpoint (http://localhost:5000/health)...
curl.exe -s --max-time 3 http://localhost:5000/health
echo.

echo.
echo [3] HP Printer Wi-Fi Connectivity (192.168.31.2)...
ping -n 1 -w 1000 192.168.31.2 >nul
if %ERRORLEVEL% equ 0 (
    echo   [OK] Ping to 192.168.31.2 SUCCEEDED (Wi-Fi Online).
) else (
    echo   [WARN] Ping to 192.168.31.2 FAILED (USB Fallback will be used).
)

echo.
echo [4] Windows Printers & Spooler Health...
powershell -Command "Get-Printer | Where-Object { $_.Name -like '*Epson*' -or $_.Name -like '*HP*' } | Select-Object Name, PortName, PrinterStatus | Format-Table -AutoSize"

echo.
echo [5] Stuck Spooler Jobs Check (0 is ideal)...
powershell -Command "$jobs = Get-PrintJob -PrinterName * -ErrorAction SilentlyContinue; if ($jobs) { $jobs | Select-Object PrinterName, ID, DocumentName, JobStatus } else { Write-Host '  [OK] No stuck print jobs in spooler queue.' -ForegroundColor Green }"

echo.
echo ===============================================================
pause
