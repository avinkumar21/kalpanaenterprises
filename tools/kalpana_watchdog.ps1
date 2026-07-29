# Resilient Continuous Watchdog for Kalpana Enterprise Servers
# Keeps Web Frontend (Port 80), Data Backend (Port 8080), and Cloudflare Tunnel alive 24/7

$root = (Get-Item $PSScriptRoot).Parent.FullName
$logDir = Join-Path $root "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$watchdogLog = Join-Path $logDir "watchdog.log"
$frontendLog = Join-Path $logDir "frontend_out.log"

function Write-Log([string]$message, [string]$level="INFO") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$timestamp] [$level] $message"
    Add-Content -Path $watchdogLog -Value $entry -Encoding UTF8 -ErrorAction SilentlyContinue
}

function Test-Port([int]$port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $connection = $tcp.BeginConnect("127.0.0.1", $port, $null, $null)
        $success = $connection.AsyncWaitHandle.WaitOne(1000, $false)
        if ($success) {
            $tcp.EndConnect($connection)
            $tcp.Close()
            return $true
        } else {
            $tcp.Close()
            return $false
        }
    } catch {
        return $false
    }
}

function Test-Process([string]$processName) {
    $proc = Get-Process -Name $processName -ErrorAction SilentlyContinue
    if ($proc) { return $true }
    return $false
}

Write-Log "Kalpana Enterprise Watchdog Started. Monitoring Port 80 (React UI), Port 8080 (Fallback Server), and cloudflared.exe." "STARTUP"

while ($true) {
    try {
        # Check Frontend Port 80
        if (-not (Test-Port 80)) {
            Write-Log "Port 80 unresponsive or stopped. Executing self-healing restart for Web Frontend..." "WARN"
            $uiDir = Join-Path $root "frontend"
            $cmdArgs = "/c ""cd /d ""$uiDir"" && npm run dev > ""$frontendLog"" 2>&1"""
            Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArgs -WindowStyle Hidden
            Write-Log "Web Frontend relaunch command dispatched." "HEAL"
            Start-Sleep -Seconds 8
        }

        # Check Backend Port 8080
        if (-not (Test-Port 8080)) {
            Write-Log "Port 8080 unresponsive or stopped. Executing self-healing restart for Data Backend..." "WARN"
            $serverScript = Join-Path $root "data\fallback\server.ps1"
            $psArgs = "-ExecutionPolicy Bypass -File ""$serverScript"""
            Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -WindowStyle Hidden
            Write-Log "Data Backend relaunch command dispatched." "HEAL"
            Start-Sleep -Seconds 3
        }

        # Check Cloudflare Tunnel
        if (-not (Test-Process "cloudflared")) {
            Write-Log "Cloudflare Tunnel (cloudflared.exe) stopped. Relaunching..." "WARN"
            $tunnelScript = Join-Path $root "tools\start_mobile_tunnel.ps1"
            $psArgs = "-ExecutionPolicy Bypass -File ""$tunnelScript"""
            Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -WindowStyle Hidden
            Write-Log "Cloudflare Tunnel relaunch command dispatched." "HEAL"
            Start-Sleep -Seconds 5
        }
        
        # Note: PM2 now manages the Node.js backend (Port 8082). We don't restart it here to avoid conflicts.
    } catch {
        Write-Log "Watchdog loop error: $($_.Exception.Message)" "ERROR"
    }

    Start-Sleep -Seconds 15 # Poll and monitor every 15 seconds
}
