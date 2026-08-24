const { spawn } = require('child_process');

const ps = spawn('powershell', ['-NoProfile', '-Command', `
Get-PrintJob -PrinterName "HP Laser MFP 131 133 135-138" -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
Get-PrintJob -PrinterName "EPSON L3110 Series" -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1
$p = Get-WmiObject -Class Win32_Printer | Where-Object { $_.Name -like "*HP Laser MFP 131*" }
[PSCustomObject]@{
    Name = $p.Name
    Port = $p.PortName
    Status = $p.PrinterStatus
    WorkOffline = $p.WorkOffline
} | ConvertTo-Json

$e = Get-WmiObject -Class Win32_Printer | Where-Object { $_.Name -like "*EPSON L3110*" }
[PSCustomObject]@{
    Name = $e.Name
    Port = $e.PortName
    Status = $e.PrinterStatus
    WorkOffline = $e.WorkOffline
} | ConvertTo-Json
`]);

ps.stdout.on('data', d => console.log(d.toString()));
ps.stderr.on('data', d => console.error(d.toString()));
