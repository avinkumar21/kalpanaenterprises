@echo off
title Configure Kalpana Enterprise Custom Domain
NET SESSION >nul 2>&1
if %errorLevel% == 0 (
    echo Administrator privileges confirmed.
) else (
    echo Requesting Administrative Privileges...
    powershell -Command "Start-Process '%~s0' -Verb RunAs"
    exit /b
)

echo Configuring KalpanaEnterprise domain mapping in Windows hosts file...
powershell -ExecutionPolicy Bypass -File "%~dp0configure_hosts.ps1"

echo.
pause
