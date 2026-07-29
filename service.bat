@echo off
title Kalpana Enterprise Service Controller
if "%~1"=="" (
    echo Usage: service.bat [start ^| stop ^| install ^| uninstall ^| status ^| restart]
    echo.
    echo Examples:
    echo   service.bat start     - Start/Install the always-on background watchdog
    echo   service.bat status    - Check port uptime and service status
    echo   service.bat stop      - Stop all running web & data background services
    echo.
    powershell -ExecutionPolicy Bypass -File "%~dp0tools\service_manager.ps1" -Action "status"
    pause
    exit /b
)

powershell -ExecutionPolicy Bypass -File "%~dp0tools\service_manager.ps1" -Action "%~1"
