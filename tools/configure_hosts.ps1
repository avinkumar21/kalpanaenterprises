# Configure Windows Hosts File for KalpanaEnterprise
# Requires Administrator Privileges

$hostsPath = "$env:WINDIR\System32\drivers\etc\hosts"
try {
    $content = Get-Content $hostsPath -ErrorAction Stop
    
    # Remove old or duplicate entries for KalpanaEnterprise or obsolete dead IPs
    $cleanContent = $content | Where-Object { $_ -notmatch "KalpanaEnterprise" -and $_ -notmatch "192\.168\.31\.112" }
    
    # Ensure no trailing blank lines clutter the file before adding our clean entry
    $cleanContent += ""
    $cleanContent += "127.0.0.1    KalpanaEnterprise"
    
    Set-Content -Path $hostsPath -Value $cleanContent -Force -Encoding ASCII
    Write-Host "Successfully updated system hosts file!" -ForegroundColor Green
    Write-Host "Domain http://KalpanaEnterprise now cleanly maps to 127.0.0.1 (localhost)." -ForegroundColor Cyan
    exit 0
} catch {
    Write-Error "Failed to update hosts file: $($_.Exception.Message)"
    Write-Host "Please ensure you run this script as Administrator." -ForegroundColor Red
    exit 1
}
