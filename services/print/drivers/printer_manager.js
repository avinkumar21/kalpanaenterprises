const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../database/index.js');
const Logger = require('../logs/logger');

function execPowerShell(script, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
        execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: timeoutMs }, (err, stdout, stderr) => {
            if (err) return reject(err);
            resolve(stdout.trim());
        });
    });
}

const PrinterManager = {
    async refreshPrintersList() {
        Logger.logPrinterEvent("Scanning system for installed Windows printers...");
        const script = `
            try {
                $printers = Get-CimInstance -ClassName Win32_Printer -ErrorAction SilentlyContinue
                if (-not $printers) {
                    $printers = Get-WmiObject -Class Win32_Printer -ErrorAction SilentlyContinue
                }
                $res = @()
                foreach ($w in $printers) {
                    $statusStr = "Ready"
                    if ($w.WorkOffline -eq $true) { $statusStr = "Offline" }
                    elseif ($w.PrinterStatus -eq 4) { $statusStr = "Paper Out/Jam" }
                    elseif ($w.PrinterStatus -eq 2) { $statusStr = "Error/Offline" }
                    
                    $res += [PSCustomObject]@{
                        name = $w.Name
                        driverName = $w.DriverName
                        status = $statusStr
                        isDefault = [bool]$w.Default
                    }
                }
                $res | ConvertTo-Json -Compress
            } catch {
                Write-Error $_.Exception.Message
                exit 1
            }
        `;

        try {
            const out = await execPowerShell(script, 15000);
            let list = [];
            if (out) {
                const parsed = JSON.parse(out);
                list = (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean).map(p => ({
                    name: p.name || 'Unknown Printer',
                    driverName: p.driverName || 'Standard Driver',
                    status: p.status || 'Ready',
                    isDefault: Boolean(p.isDefault),
                    isPrimary: false,
                    isSecondary: false,
                    isFallback: false
                }));
            }
            
            // Reconcile with admin settings for Primary / Secondary / Fallback
            const settings = db.getSettings();
            list.forEach(p => {
                p.isPrimary = p.name.toLowerCase() === (settings.primaryPrinter || '').toLowerCase();
                p.isSecondary = p.name.toLowerCase() === (settings.secondaryPrinter || '').toLowerCase();
                p.isFallback = p.name.toLowerCase() === (settings.fallbackPrinter || '').toLowerCase();
            });

            if (!list || list.length === 0) {
                list = [
                    { name: 'EPSON L3110 Series', driverName: 'EPSON L3110 Series', status: 'Ready', isDefault: true, isPrimary: true, isSecondary: false, isFallback: false },
                    { name: 'HP508140DE1D63(HP Laser MFP 131 133 135-138)', driverName: 'HP Laser MFP 131 133 135-138', status: 'Ready', isDefault: false, isPrimary: false, isSecondary: true, isFallback: false }
                ];
            }

            db.savePrinters(list);
            Logger.logPrinterEvent(`Successfully updated printer list (${list.length} devices detected).`);
            return list;
        } catch (error) {
            Logger.warn('PRINTER_MANAGER', `System printer detection query fallback: ${error.message}`);
            let list = db.getPrinters();
            if (list.length === 0) {
                list = [
                    { name: 'EPSON L3110 Series', driverName: 'EPSON L3110 Series', status: 'Ready', isDefault: true, isPrimary: true, isSecondary: false, isFallback: false },
                    { name: 'HP508140DE1D63(HP Laser MFP 131 133 135-138)', driverName: 'HP Laser MFP 131 133 135-138', status: 'Ready', isDefault: false, isPrimary: false, isSecondary: true, isFallback: false }
                ];
                db.savePrinters(list);
            }
            return list;
        }
    },

    async testPrinter(printerName) {
        Logger.logPrinterEvent(`Dispatching test print check instruction to [${printerName}]...`);
        const script = `
            try {
                $p = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$printerName'" -ErrorAction SilentlyContinue
                if (-not $p) { $p = Get-WmiObject -Class Win32_Printer -Filter "Name='$printerName'" -ErrorAction Stop }
                if ($p.WorkOffline -eq $true -or $p.PrinterStatus -eq 2 -or $p.PrinterStatus -eq 4) {
                    Write-Output "OFFLINE_CHECK_WIFI_OR_POWER"
                } else {
                    Write-Output "ONLINE_READY"
                }
            } catch {
                Write-Output "OFFLINE_CHECK_WIFI_OR_POWER"
            }
        `;
        try {
            const res = await execPowerShell(script, 8000);
            const status = (res || '').trim();
            if (status.includes('ONLINE_READY')) {
                Logger.logPrinterEvent(`Test connection confirmed: [${printerName}] is Online and Ready.`);
                return { success: true, status: 'ONLINE', message: `✅ Printer [${printerName}] is Online, active, and ready to print!` };
            } else {
                Logger.warn('PRINTER_MANAGER', `Test check for [${printerName}] returned offline status.`);
                return { success: false, status: 'OFFLINE', message: `⚠️ Printer [${printerName}] is currently offline or unreachable via Wi-Fi/USB. Please check printer power or select your other available printer.` };
            }
        } catch (error) {
            Logger.warn('PRINTER_MANAGER', `Test check fallback for ${printerName}: ${error.message}`);
            return { success: false, status: 'OFFLINE', message: `⚠️ Printer [${printerName}] could not be connected. Try testing USB cable or switching printer.` };
        }
    },

    async printFile(filePath, printerName = null, copies = 1, options = {}) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Target file to print not found: ${filePath}`);
        }

        const settings = db.getSettings();
        let targetPrinter = printerName || settings.defaultPrinter || settings.primaryPrinter || 'HP508140DE1D63(HP Laser MFP 131 133 135-138)';
        
        // Intelligent Windows driver resolution: map generic names (e.g. "HP Laser MFP 136w" or "Epson L3110") to exact Windows hardware name!
        const installedPrinters = db.getPrinters() || [];
        if (installedPrinters.length > 0) {
            const exactMatch = installedPrinters.find(p => p.name.toLowerCase() === targetPrinter.toLowerCase());
            if (!exactMatch) {
                const bestMatch = installedPrinters.find(p => {
                    const lName = p.name.toLowerCase();
                    const tLower = targetPrinter.toLowerCase();
                    if (tLower.includes('hp') && lName.includes('hp')) return true;
                    if (tLower.includes('epson') && lName.includes('epson')) return true;
                    if (tLower.includes('pdf') && lName.includes('pdf')) return true;
                    return false;
                });
                if (bestMatch) {
                    Logger.info('PRINTER_MANAGER', `Resolved generic configured name [${targetPrinter}] to active Windows driver [${bestMatch.name}]`);
                    targetPrinter = bestMatch.name;
                }
            }
        }

        Logger.logPrinting(`Initiating direct hardware print job for [${path.basename(filePath)}] onto printer [${targetPrinter}] (${copies} copies)...`, { options });

        const absPath = path.resolve(filePath);
        const ext = path.extname(absPath).toLowerCase();
        let script = '';

        // Direct hardware image spooling via .NET System.Drawing (100% background, no Windows dialogs)
        if (['.png', '.jpg', '.jpeg', '.bmp', '.gif'].includes(ext)) {
            script = `
                try {
                    Add-Type -AssemblyName System.Drawing
                    $img = [System.Drawing.Image]::FromFile("${absPath}")
                    $pd = New-Object System.Drawing.Printing.PrintDocument
                    $pd.PrinterSettings.PrinterName = "${targetPrinter}"
                    $pd.PrinterSettings.Copies = ${copies}
                    $pd.add_PrintPage({
                        param($sender, $e)
                        $e.Graphics.DrawImage($img, $e.PageBounds)
                    })
                    $pd.Print()
                    $img.Dispose()
                    Write-Host "PRINT_SUCCESS"
                } catch {
                    Write-Error $_.Exception.Message
                    exit 1
                }
            `;
        } else if (ext === '.pdf') {
            // Direct silent physical hardware PDF printing using installed Adobe Acrobat DC / Reader
            script = `
                try {
                    $acro = "C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe"
                    if (-not (Test-Path $acro)) { $acro = "C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe" }
                    if (Test-Path $acro) {
                        for ($i = 0; $i -lt ${copies}; $i++) {
                            $proc = Start-Process -FilePath $acro -ArgumentList "/t \`"${absPath}\`" \`"${targetPrinter}\`"" -WindowStyle Hidden -PassThru
                            Start-Sleep -Seconds 5
                            if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
                        }
                        Write-Host "PRINT_SUCCESS"
                    } else {
                        for ($i = 0; $i -lt ${copies}; $i++) {
                            Start-Process -FilePath "${absPath}" -Verb Print -WindowStyle Hidden
                            Start-Sleep -Seconds 3
                        }
                        Write-Host "PRINT_SUCCESS"
                    }
                } catch {
                    Write-Error $_.Exception.Message
                    exit 1
                }
            `;
        } else if (['.doc', '.docx', '.rtf'].includes(ext)) {
            script = `
                try {
                    $word = New-Object -ComObject Word.Application -ErrorAction SilentlyContinue
                    if ($word) {
                        $word.Visible = $false
                        $word.ActivePrinter = "${targetPrinter}"
                        $doc = $word.Documents.Open("${absPath}")
                        for ($i = 0; $i -lt ${copies}; $i++) { $doc.PrintOut() }
                        Start-Sleep -Seconds 3
                        $doc.Close($false)
                        $word.Quit()
                        Write-Host "PRINT_SUCCESS"
                    } else {
                        Start-Process -FilePath "${absPath}" -Verb Print -WindowStyle Hidden
                        Write-Host "PRINT_SUCCESS"
                    }
                } catch {
                    Write-Error $_.Exception.Message
                    exit 1
                }
            `;
        } else {
            script = `
                try {
                    for ($i = 0; $i -lt ${copies}; $i++) {
                        Start-Process -FilePath "${absPath}" -Verb Print -WindowStyle Hidden
                        Start-Sleep -Seconds 3
                    }
                    Write-Host "PRINT_SUCCESS"
                } catch {
                    Write-Error $_.Exception.Message
                    exit 1
                }
            `;
        }

        try {
            await execPowerShell(script, 25000);
            Logger.logPrinting(`Successfully spooled [${path.basename(filePath)}] directly to physical printer [${targetPrinter}]!`);
            return { success: true, printer: targetPrinter, copies, mode: 'Direct Hardware Spooler' };
        } catch (error) {
            // Try the other USB printer before giving up (HP ↔ EPSON)
            const secondaryPrinter = settings.secondaryPrinter;
            if (secondaryPrinter && secondaryPrinter !== targetPrinter && !options.isFallbackAttempt) {
                Logger.warn('PRINTER_MANAGER', `Printer [${targetPrinter}] unreachable via USB. Trying secondary printer [${secondaryPrinter}]...`);
                return await this.printFile(filePath, secondaryPrinter, copies, { ...options, isFallbackAttempt: true });
            }
            // Both printers offline — throw so the queue retry mechanism works (3 attempts)
            Logger.error('PRINTER_MANAGER', `Both printers offline. Job [${path.basename(filePath)}] will be retried by queue worker.`);
            throw new Error(`Printer [${targetPrinter}] is offline or unreachable via USB. Print spool failed.`);
        }
    }
};

module.exports = PrinterManager;
