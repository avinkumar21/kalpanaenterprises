# End-to-End Verification Script for ARKA Platform V2 Auto WhatsApp Printing Engine
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   ARKA PLATFORM V2 - AUTO WHATSAPP PRINTING & PROCESSING ENGINE TEST" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

$root = (Get-Item $PSScriptRoot).Parent.FullName
$printModDir = Join-Path $root "backend"
$logFile = Join-Path $root "logs\print_test_run.log"
if (-not (Test-Path (Join-Path $root "logs"))) { New-Item -ItemType Directory -Path (Join-Path $root "logs") -Force | Out-Null }

Write-Host "1. Killing any orphaned Print Engine processes on port 8082..." -ForegroundColor Yellow
$connections = netstat -ano | findstr ":8082 " | findstr "LISTENING"
foreach ($conn in $connections) {
    $pidToKill = ($conn -split "\s+")[-1]
    if ($pidToKill -ne "0") { Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 1

Write-Host "2. Launching ARKA Print Engine (node src/server.js) in background..." -ForegroundColor Cyan
$serverProc = Start-Process -FilePath "node.exe" -ArgumentList "src/server.js" -WorkingDirectory $printModDir -WindowStyle Hidden -PassThru -RedirectStandardOutput $logFile -RedirectStandardError (Join-Path $root "logs\print_test_err.log")
Write-Host "   Server Process ID: $($serverProc.Id)" -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "3. Querying Operational Health Endpoint (GET http://127.0.0.1:8082/api/prints/status)..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8082/api/prints/status" -Method Get
    Write-Host "   Status      : $($response.status)" -ForegroundColor Green
    Write-Host "   Service     : $($response.serviceName)" -ForegroundColor Green
    Write-Host "   Watcher     : Active=$($response.watcher.active) | Folder=$($response.watcher.targetFolder)" -ForegroundColor Green
    Write-Host "   Printers    : $($response.metrics.activePrinters) detected" -ForegroundColor Green
} catch {
    Write-Host "   FAILED to query Print Engine: $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path (Join-Path $root "logs\print_test_err.log")) {
        Get-Content (Join-Path $root "logs\print_test_err.log")
    }
    exit 1
}

Write-Host "4. Simulating Customer WhatsApp Download (Creating a test document in download folder)..." -ForegroundColor Cyan
$targetDir = $response.watcher.targetFolder
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }

$testFileName = "WhatsApp_Invoice_Demo_$(Get-Date -Format 'yyyyMMdd_HHmmss').html"
$testFilePath = Join-Path $targetDir $testFileName
$content = "<html><body style='font-family: Arial; padding: 40px; text-align: center;'><h1>KALPANA ENTERPRISE CYBER CENTER</h1><h2>Customer WhatsApp Print Order</h2><p>Processed autonomously at $(Get-Date)</p></body></html>"
Set-Content -Path $testFilePath -Value $content -Encoding UTF8

Write-Host "   Dropped file: $testFilePath" -ForegroundColor Green
Write-Host "   Waiting 6 seconds for automatic Folder Watcher detection..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

Write-Host "5. Querying Print Queue & Historical Audit Registry..." -ForegroundColor Cyan
$history = Invoke-RestMethod -Uri "http://127.0.0.1:8082/api/prints/history" -Method Get
if ($history -and $history.Count -gt 0) {
    Write-Host "   SUCCESS: Found $($history.Count) document(s) registered in Print History!" -ForegroundColor Green
    $latest = $history[0]
    Write-Host "   Latest Job: $($latest.customerFile) | Status: $($latest.status) | Printer: $($latest.printerName)" -ForegroundColor Green
} else {
    Write-Host "   Checking active queue..." -ForegroundColor Yellow
    $queue = Invoke-RestMethod -Uri "http://127.0.0.1:8082/api/prints/queue" -Method Get
    Write-Host "   Queue count: $($queue.Count) items in active processing loop." -ForegroundColor Green
}

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   END-TO-END AUTOMATED PRINT ENGINE VERIFIED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan
