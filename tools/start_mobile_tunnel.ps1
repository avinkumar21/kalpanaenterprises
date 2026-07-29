# Kalpana Enterprise V2 - Zero-Cost 4G/5G Cloudflare Express Web Tunnel Booter
# Launches a zero-warning, instant public HTTPS relay directly to local Port 80 (Vite Web App)
# Utilizes HTTP/2 Protocol over TCP to prevent Windows UDP firewall idle timeout disconnects!

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Kalpana Enterprise V2: Booting Cloudflare 4G/5G Express Tunnel " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$port = 80

Write-Host "`n[1/3] Verifying Local Port $port availability..." -ForegroundColor Yellow
$port80 = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $conn = $tcp.BeginConnect("127.0.0.1", $port, $null, $null)
    if ($conn.AsyncWaitHandle.WaitOne(1000, $false)) { $tcp.EndConnect($conn); $tcp.Close(); $port80 = $true }
} catch {}

if (-not $port80) {
    Write-Host "WARNING: Port $port is currently offline. Please start your Gravity Web UI server first!" -ForegroundColor Red
    Write-Host "You can start all services by running: service_manager.ps1 -Action restart" -ForegroundColor Yellow
    exit 1
}

Write-Host "[2/3] Port $port is ONLINE! Initiating Cloudflare Stable HTTP/2 Relay..." -ForegroundColor Green
Write-Host "Connecting to Cloudflare edge routing over TCP..." -ForegroundColor Cyan

Write-Host "`n[3/3] Tunnel Connection Active! Your public HTTPS address will appear below." -ForegroundColor Green
Write-Host "💡 Copy the 'https://...trycloudflare.com' URL and paste it into your Shop Desktop Counter Display!" -ForegroundColor Magenta
Write-Host "Customers on 4G/5G mobile data will open your portal INSTANTLY with zero IP checks and stable uptime!" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

# Launch Cloudflare Quick Tunnel forwarding directly to Port 80 using HTTP/2
cmd.exe /c "npx.cmd -y cloudflared tunnel --protocol http2 --url http://localhost:80"
