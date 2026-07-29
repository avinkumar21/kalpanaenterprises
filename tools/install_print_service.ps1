param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "start", "stop", "uninstall", "status")]
    [string]$Action
)

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin -and $Action -in @("install", "start", "stop", "uninstall")) {
    Write-Host "Action '$Action' requires Administrator privileges. Requesting UAC elevation..." -ForegroundColor Yellow
    $argsList = "-ExecutionPolicy Bypass -File ""$($MyInvocation.MyCommand.Path)"" -Action $Action"
    Start-Process -FilePath powershell -ArgumentList $argsList -Verb RunAs -Wait
    exit 0
}

$taskName = "ARKA-PrintService"
$root = (Get-Item $PSScriptRoot).Parent.FullName
$nodeExe = "node.exe"
$serverScript = Join-Path $root "modules\prints\backend\server.js"

switch ($Action) {
    "install" {
        Write-Host "Registering Windows Scheduled Task [$taskName] for 24/7 continuous operation..." -ForegroundColor Cyan
        $action = New-ScheduledTaskAction -Execute $nodeExe -Argument """$serverScript""" -WorkingDirectory (Join-Path $root "modules\prints")
        $trigger1 = New-ScheduledTaskTrigger -AtStartup
        $trigger2 = New-ScheduledTaskTrigger -AtLogOn
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)
        
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger1,$trigger2 -Settings $settings -Description "ARKA Platform V2 Auto WhatsApp Printing & Document Processing Engine" -Force | Out-Null
        Write-Host "Successfully registered ARKA Print Service!" -ForegroundColor Green
        
        Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Write-Host "ARKA Print Service launched in background!" -ForegroundColor Green
    }
    "start" {
        if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
            & $MyInvocation.MyCommand.Path -Action "install"
            exit 0
        }
        Start-ScheduledTask -TaskName $taskName
        Write-Host "ARKA Print Service started." -ForegroundColor Green
    }
    "stop" {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Write-Host "ARKA Print Service stopped." -ForegroundColor Yellow
    }
    "uninstall" {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "ARKA Print Service unregistered from Task Scheduler." -ForegroundColor Green
    }
    "status" {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        $state = if ($task) { "Registered [$($task.State)]" } else { "Not Registered" }
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "          ARKA Print Service (24/7 Engine)" -ForegroundColor Cyan
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host " Windows Task : $state" -ForegroundColor White
        
        $portCheck = New-Object System.Net.Sockets.TcpClient
        try {
            $portCheck.Connect("127.0.0.1", 8082)
            Write-Host " Print Engine : ONLINE  (http://localhost:8082/status)" -ForegroundColor Green
            $portCheck.Close()
        } catch {
            Write-Host " Print Engine : OFFLINE (Port 8082 not active)" -ForegroundColor Red
        }
        Write-Host "==========================================================" -ForegroundColor Cyan
    }
}
