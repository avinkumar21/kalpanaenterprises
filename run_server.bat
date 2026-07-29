@echo off
title Kalpana Enterprise Server Launcher
echo ===================================================
echo   Kalpana Enterprise Dashboard Server Launcher
echo ===================================================
echo.
echo Select which server(s) or background services to start:
echo --- Interactive Session Servers ---
echo [1] Start Modern Web Frontend (React) in this window - Port 80
echo [2] Start Fallback Data Backend in this window - Port 8080
echo [3] Start Both Frontend and Backend in new windows
echo.
echo --- Always-On Background Service (24/7 Resilient Uptime) ---
echo [5] Install ^& Start Always-On Background Watchdog Service
echo [6] Check Service ^& TCP Port Uptime Status
echo [7] Stop ^& Uninstall Background Watchdog Service
echo.
echo [4] Exit
echo.
set /p choice="Enter choice (1-7): "

if "%choice%"=="1" goto frontend
if "%choice%"=="2" goto backend
if "%choice%"=="3" goto both
if "%choice%"=="4" goto exit
if "%choice%"=="5" goto service_install
if "%choice%"=="6" goto service_status
if "%choice%"=="7" goto service_stop
goto invalid

:frontend
echo.
echo Starting React Web Frontend on Port 80...
cd /d "%~dp0gravity_web_ui"
cmd /c "npm run dev"
goto end

:backend
echo.
echo Starting PowerShell Backend Listener on Port 8080...
cd /d "%~dp0kalpan_data"
powershell -ExecutionPolicy Bypass -File .\server.ps1
goto end

:both
echo.
echo Starting Both Frontend (Port 80) and Backend (Port 8080)...
echo Launching Backend in a new window...
start cmd /k "title Kalpana Backend Listener && cd /d "%~dp0kalpan_data" && powershell -ExecutionPolicy Bypass -File .\server.ps1"
echo Starting Frontend in this window...
cd /d "%~dp0gravity_web_ui"
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
