# ARKA Local Print Service Daemon Installer
# Installs background service and startup hooks (QZ Tray model)

$ErrorActionPreference = 'SilentlyContinue'
$taskName = "ARKA-LocalPrintDaemon"
$projectDir = "D:\Arka\kalpana-enterprises"
$scriptPath = Join-Path $projectDir "daemon\arka_print_daemon.js"
$vbsPath = Join-Path $projectDir "daemon\launch_silent.vbs"
$nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source

if (-not $nodePath) {
    $nodePath = "C:\Program Files\nodejs\node.exe"
}

Write-Host "Configuring ARKA Local Print Service Daemon..." -ForegroundColor Cyan
Write-Host "Project Directory: $projectDir"
Write-Host "Node.js Executable: $nodePath"

# Method 1: Register in Windows Task Scheduler
try {
    # Unregister any existing task
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    $action = New-ScheduledTaskAction -Execute $nodePath -Argument "daemon\arka_print_daemon.js" -WorkingDirectory $projectDir
    $triggerStartup = New-ScheduledTaskTrigger -AtStartup
    $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerStartup, $triggerLogon) -Settings $settings -Description "ARKA Local Print Service Daemon (Port 5000 / 8082)" -RunLevel Highest -ErrorAction Stop
    Write-Host "  [OK] Registered Windows Scheduled Task: $taskName" -ForegroundColor Green
    
    # Start task immediately
    Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
} catch {
    Write-Host "  [NOTE] Elevated Scheduled Task setup: $($_.Exception.Message). Falling back to User-level startup..." -ForegroundColor Yellow
}

# Method 2: Startup Folder Shortcut (100% reliable User-level auto-start)
try {
    $startupFolder = [Environment]::GetFolderPath('Startup')
    $shortcutPath = Join-Path $startupFolder "ArkaPrintDaemon.lnk"
    
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "wscript.exe"
    $shortcut.Arguments = "`"$vbsPath`""
    $shortcut.WorkingDirectory = $projectDir
    $shortcut.Description = "ARKA Local Print Service Daemon (Port 5000)"
    $shortcut.Save()
    
    Write-Host "  [OK] Registered Startup Folder Shortcut at: $shortcutPath" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Failed to write startup shortcut: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "ARKA Local Print Daemon installation complete!" -ForegroundColor Green
Write-Host "Service is configured to start automatically whenever the desktop boots or logs in." -ForegroundColor Green
