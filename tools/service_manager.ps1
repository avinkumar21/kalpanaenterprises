# Windows Service Manager for Kalpana Enterprise Watchdog
# Registers/unregisters a persistent background Scheduled Task for 24/7 continuous availability

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "start", "stop", "uninstall", "status", "restart")]
    [string]$Action
)

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin -and $Action -in @("install", "uninstall")) {
    Write-Host "Action '$Action' requires Administrator privileges. Requesting UAC elevation..." -ForegroundColor Yellow
    $argsList = "-ExecutionPolicy Bypass -File ""$($MyInvocation.MyCommand.Path)"" -Action $Action"
    Start-Process -FilePath powershell -ArgumentList $argsList -Verb RunAs -Wait
    exit 0
}

$taskName = "KalpanaEnterprise-AlwaysOn"
$printTaskName = "ARKA-PrintService"
$root = (Get-Item $PSScriptRoot).Parent.FullName
$watchdogScript = Join-Path $PSScriptRoot "kalpana_watchdog.ps1"
$printInstaller = Join-Path $PSScriptRoot "install_print_service.ps1"

function Get-ServiceStatus {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host "   Kalpana Enterprise Always-On Service Status" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

    # Task Scheduler status for Watchdog
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
        $state = $task.State
        $color = if ($state -eq "Running") { "Green" } else { "Yellow" }
        Write-Host " Background Watchdog Task : Registered [$state]" -ForegroundColor $color
    } else {
        Write-Host " Background Watchdog Task : Not Registered" -ForegroundColor Red
    }

    # Task Scheduler status for Print Service
    $ptask = Get-ScheduledTask -TaskName $printTaskName -ErrorAction SilentlyContinue
    if ($ptask) {
        $pstate = $ptask.State
        $pcolor = if ($pstate -eq "Running") { "Green" } else { "Yellow" }
        Write-Host " ARKA Print Engine Task   : Registered [$pstate]" -ForegroundColor $pcolor
    } else {
        Write-Host " ARKA Print Engine Task   : Not Registered" -ForegroundColor Yellow
    }

    # Test Port 80 (Frontend Web Application)
    $port80 = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $conn = $tcp.BeginConnect("127.0.0.1", 80, $null, $null)
        if ($conn.AsyncWaitHandle.WaitOne(800, $false)) { $tcp.EndConnect($conn); $tcp.Close(); $port80 = $true }
    } catch {}
    if ($port80) {
        Write-Host " Web Frontend (Port 80)   : ONLINE  (http://KalpanaEnterprise)" -ForegroundColor Green
    } else {
        Write-Host " Web Frontend (Port 80)   : OFFLINE" -ForegroundColor Red
    }

    # Test Port 8080 (Backend Fallback Server)
    $port8080 = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $conn = $tcp.BeginConnect("127.0.0.1", 8080, $null, $null)
        if ($conn.AsyncWaitHandle.WaitOne(800, $false)) { $tcp.EndConnect($conn); $tcp.Close(); $port8080 = $true }
    } catch {}
    if ($port8080) {
        Write-Host " Data Backend (Port 8080) : ONLINE  (http://localhost:8080)" -ForegroundColor Green
    } else {
        Write-Host " Data Backend (Port 8080) : OFFLINE" -ForegroundColor Yellow
    }

    # Test Port 8082 (ARKA Prints Auto Processing Engine)
    $port8082 = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $conn = $tcp.BeginConnect("127.0.0.1", 8082, $null, $null)
        if ($conn.AsyncWaitHandle.WaitOne(800, $false)) { $tcp.EndConnect($conn); $tcp.Close(); $port8082 = $true }
    } catch {}
    if ($port8082) {
        Write-Host " ARKA Print Engine (8082) : ONLINE  (http://localhost:8082/api/prints/status)" -ForegroundColor Green
    } else {
        Write-Host " ARKA Print Engine (8082) : OFFLINE" -ForegroundColor Red
    }
    Write-Host "==========================================================`n" -ForegroundColor Cyan
}

function Stop-AllServices {
    Write-Host "Stopping Kalpana Enterprise Watchdog and active servers..." -ForegroundColor Yellow
    
    # Stop Scheduled Tasks
    foreach ($t in @($taskName, $printTaskName)) {
        $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
        if ($task) {
            Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue | Out-Null
            Write-Host "Stopped scheduled task [$t]." -ForegroundColor Gray
        }
    }

    # Kill running watchdog and print engine processes
    Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match "kalpana_watchdog.ps1|backend/server.js|backend\\server.js" } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

    # Kill listening servers on port 80, 8080, and 8082
    foreach ($p in 80, 8080, 8082) {
        $connections = netstat -ano | findstr ":$p " | findstr "LISTENING"
        foreach ($conn in $connections) {
            $parts = $conn -split "\s+"
            $pidToKill = $parts[-1]
            if ($pidToKill -and $pidToKill -ne "0") {
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Write-Host "All background servers and watchdog monitors successfully terminated." -ForegroundColor Green
}

function Install-Service {
    Write-Host "Installing and configuring Windows Scheduled Tasks..." -ForegroundColor Cyan
    
    # Install Watchdog task
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File ""$watchdogScript"""
    $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    
    try {
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggerLogon -Settings $settings -Force | Out-Null
        Write-Host "Successfully registered background watchdog task [$taskName]!" -ForegroundColor Green
        Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Out-Null
    } catch {
        Write-Error "Failed to register Scheduled Task: $($_.Exception.Message)"
    }

    # Install Print Engine task
    if (Test-Path $printInstaller) {
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File $printInstaller -Action install
    }
}

switch ($Action.ToLower()) {
    "install" { Install-Service; Get-ServiceStatus }
    "start"   { 
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if (-not $task) { Install-Service } 
        else { 
            Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Out-Null
            $ptask = Get-ScheduledTask -TaskName $printTaskName -ErrorAction SilentlyContinue
            if (-not $ptask -and (Test-Path $printInstaller)) {
                powershell.exe -NoProfile -ExecutionPolicy Bypass -File $printInstaller -Action install
            } elseif ($ptask) {
                Start-ScheduledTask -TaskName $printTaskName -ErrorAction SilentlyContinue | Out-Null
            }
            Start-Sleep -Seconds 4
        }
        Get-ServiceStatus 
    }
    "stop"      { Stop-AllServices; Get-ServiceStatus }
    "uninstall" { 
        Stop-AllServices
        foreach ($t in @($taskName, $printTaskName)) {
            Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
            Write-Host "Unregistered background task [$t]." -ForegroundColor Green
        }
        Get-ServiceStatus 
    }
    "restart"   { 
        Stop-AllServices; Start-Sleep -Seconds 2
        Write-Host "Rebooting entire Kalpana Enterprise application suite (Frontend, Backend, and Print Engine)..." -ForegroundColor Cyan
        
        # Explicitly boot all 3 core application servers in background
        $uiDir = Join-Path $root "gravity_web_ui"
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c ""cd /d ""$uiDir"" && npm.cmd run dev > ""$(Join-Path $root 'logs\frontend_out.log')"" 2>&1""" -WindowStyle Hidden
        
        $backendScript = Join-Path $root "kalpan_data\server.ps1"
        if (Test-Path $backendScript) {
            Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File ""$backendScript""" -WindowStyle Hidden
        }

        $printDir = Join-Path $root "backend"
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c ""cd /d ""$printDir"" && node.exe src/server.js > ""$(Join-Path $root 'logs\print_engine_out.log')"" 2>&1""" -WindowStyle Hidden
        
        # Launch persistent Watchdog loop
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File ""$watchdogScript""" -WindowStyle Hidden
        
        # Also re-trigger Scheduled Tasks if registered
        Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Out-Null
        Start-ScheduledTask -TaskName $printTaskName -ErrorAction SilentlyContinue | Out-Null
        
        Write-Host "Waiting for servers to initialize ports 80, 8080, and 8082..." -ForegroundColor Yellow
        Start-Sleep -Seconds 6
        Get-ServiceStatus 
    }
    "status"    { Get-ServiceStatus }
}
