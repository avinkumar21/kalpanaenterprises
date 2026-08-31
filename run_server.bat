@echo off
title Kalpana Enterprise Server Launcher
echo ===================================================
echo   Kalpana Enterprise Dashboard & Print System
echo ===================================================
echo.
echo Select which server(s) or background services to start:
echo --- Interactive Session Servers ---
echo [1] Start Web Frontend in this window (Port 80)
echo [2] Start ARKA Print Engine & Mobile Tunnel (Port 8082)
echo [3] Start Both Frontend (Port 80) and Print Engine (Port 8082)
echo.
echo --- Always-On Background Service (24/7 Resilient Uptime) ---
echo [4] Install ^& Start 24/7 Background Watchdog ^& Print Engine
echo [5] Check Service ^& Hardware Printer Status
echo [6] Stop All Background Services
echo.
echo [7] Exit
echo.
set /p choice="Enter choice (1-7): "

if "%choice%"=="1" goto frontend
if "%choice%"=="2" goto backend
if "%choice%"=="3" goto both
if "%choice%"=="4" goto service_install
if "%choice%"=="5" goto service_status
if "%choice%"=="6" goto service_stop
if "%choice%"=="7" goto exit
goto invalid

:frontend
echo.
echo Starting React Web Frontend on Port 80...
cd /d "%~dp0frontend"
cmd /c "npm run dev"
goto end

:backend
echo.
echo Starting ARKA Print Engine & Cloudflare Tunnel on Port 8082...
cd /d "%~dp0backend"
node src/server.js
goto end

:both
echo.
echo Starting ARKA Print Engine (Port 8082) in a new window...
start cmd /k "title ARKA Print Engine && cd /d "%~dp0backend" && node src/server.js"
echo Starting Web Frontend (Port 80) in this window...
cd /d "%~dp0frontend"
cmd /c "npm run dev"
goto end

:service_install
echo.
echo Installing and launching Always-On Background Service...
call "%~dp0service.bat" start
goto end

:service_status
echo.
call "%~dp0service.bat" status
goto end

:service_stop
echo.
echo Stopping and uninstalling background services...
call "%~dp0service.bat" stop
goto end

:invalid
echo Invalid choice.
pause
goto exit

:end
pause
:exit
