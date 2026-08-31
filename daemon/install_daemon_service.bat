@echo off
title Install ARKA Local Print Service Daemon (QZ Tray Model)
color 0B
cd /d "D:\Arka\kalpana-enterprises"

echo ===============================================================
echo     INSTALLING ARKA LOCAL PRINT DAEMON AS BACKGROUND SERVICE   
echo                  (Automatic Startup on Boot)                  
echo ===============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_service.ps1"

echo.
echo ===============================================================
echo Installation script finished.
echo ===============================================================
pause
