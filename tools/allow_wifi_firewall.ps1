# Kalpana Enterprise V2 - 1-Click Wi-Fi Firewall Unblocker for QR Scanning
# Run this script once as Administrator to ensure Windows Defender Firewall allows smartphones to scan & upload over Shop Wi-Fi!

if (-Not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Elevating permissions to configure Windows Defender Firewall..." -ForegroundColor Yellow
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Kalpana Enterprise V2: Opening Shop Wi-Fi Ports (80, 8082, 3000)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

Write-Host "`n[1/2] Removing old duplicate firewall rules..." -ForegroundColor Yellow
netsh advfirewall firewall delete rule name="Kalpana Print Shop Ports" 2>$null | Out-Null

Write-Host "[2/2] Adding Inbound TCP rule for incoming smartphone document drops..." -ForegroundColor Green
netsh advfirewall firewall add rule name="Kalpana Print Shop Ports" dir=in action=allow protocol=TCP localport=80,8082,3000,5173 profile=any | Out-Null

Write-Host "`n✅ SUCCESS! Windows Defender Firewall is now open for local QR code transfers." -ForegroundColor Green
Write-Host "Any phone connected to your ARKA Wi-Fi can scan and upload directly to your D:\whatsapp queue!" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Read-Host -Prompt "Press Enter to exit..."
