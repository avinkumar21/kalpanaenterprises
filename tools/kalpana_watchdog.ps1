# Resilient Continuous 24/7 Watchdog & Multi-Channel Self-Healing Monitor
# Automatically monitors and recovers:
# - Web Frontend (Port 80)
# - ARKA Print Engine (Port 8082)
# - Cloudflare 4G/5G Tunnel (cloudflared.exe)
# - Customer Multi-Channel Intake Verification (Daily Health Logging)

$root = (Get-Item $PSScriptRoot).Parent.FullName
$logDir = Join-Path $root "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$watchdogLog = Join-Path $logDir "watchdog.log"
$frontendLog = Join-Path $logDir "frontend_out.log"
$printLog = Join-Path $logDir "print_engine_out.log"

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

Write-Log "Kalpana Enterprise 24/7 Resilient Watchdog Started. Monitoring Port 80, Port 8082, and cloudflared.exe." "STARTUP"

$iteration = 0

while ($true) {
    try {
        $iteration++

        # 1. Check Print Engine Port 8082
        if (-not (Test-Port 8082)) {
            Write-Log "Port 8082 (Print Engine) unresponsive or stopped. Executing self-healing restart..." "WARN"
            $backendDir = Join-Path $root "backend"
            $cmdArgs = "/c ""cd /d ""$backendDir"" && node.exe src/server.js > ""$printLog"" 2>&1"""
            Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArgs -WindowStyle Hidden
            Write-Log "ARKA Print Engine relaunch command dispatched." "HEAL"
            Start-Sleep -Seconds 5
        }

        # 2. Check Cloudflare Tunnel
        if (-not (Test-Process "cloudflared")) {
            Write-Log "Cloudflare Tunnel (cloudflared.exe) stopped. Relaunching..." "WARN"
            $tunnelScript = Join-Path $root "tools\start_mobile_tunnel.ps1"
            $psArgs = "-ExecutionPolicy Bypass -File ""$tunnelScript"""
            Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -WindowStyle Hidden
            Write-Log "Cloudflare Tunnel relaunch command dispatched." "HEAL"
            Start-Sleep -Seconds 5
        }

        # 3. Check Frontend Port 80
        if (-not (Test-Port 80)) {
            Write-Log "Port 80 unresponsive or stopped. Executing self-healing restart for Web Frontend..." "WARN"
            $uiDir = Join-Path $root "frontend"
            $cmdArgs = "/c ""cd /d ""$uiDir"" && npm run dev > ""$frontendLog"" 2>&1"""
            Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArgs -WindowStyle Hidden
            Write-Log "Web Frontend relaunch command dispatched." "HEAL"
            Start-Sleep -Seconds 6
        }

        # 4. Periodic Deep Channel Verification (Every 2 minutes)
        if ($iteration % 8 -eq 0) {
            $verifyScript = Join-Path $root "tools\verify_all_channels.ps1"
            if (Test-Path $verifyScript) {
                Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -File ""$verifyScript""" -WindowStyle Hidden
            }
        }
    } catch {
        Write-Log "Watchdog loop error: $($_.Exception.Message)" "ERROR"
    }

    Start-Sleep -Seconds 15 # Poll and monitor every 15 seconds
}
