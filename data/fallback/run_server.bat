@echo off
:: BatchGotAdmin
:-------------------------------------
REM  --> Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

REM --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params = %*
    echo UAC.ShellExecute "cmd.exe", "/c %~s0 %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

echo Opening Firewall Port 8080...
netsh advfirewall firewall show rule name="Kalpan Directory Server" >nul
if not ERRORLEVEL 1 (
    echo Rule already exists.
) else (
    netsh advfirewall firewall add rule name="Kalpan Directory Server" dir=in action=allow protocol=TCP localport=8080
)

echo Configuring URL ACL...
netsh http add urlacl url=http://*:8080/ user=Everyone

echo Starting Server...
powershell.exe -ExecutionPolicy Bypass -File .\server.ps1
pause
