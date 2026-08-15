const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../../../data/local_db/index.js');
const Logger = require('../../logs/logger.js');

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
        Logger.logPrinterEvent("Scanning system for installed Windows printers with live hardware status...");
        const script = `
            try {
                $printerMap = @{}
                $gp = Get-Printer -ErrorAction SilentlyContinue
                if ($gp) {
                    foreach ($p in $gp) {
                        $printerMap[$p.Name] = $p.PrinterStatus.ToString()
                    }
                }

                $cimPrinters = Get-CimInstance -ClassName Win32_Printer -ErrorAction SilentlyContinue
                if (-not $cimPrinters) {
                    $cimPrinters = Get-WmiObject -Class Win32_Printer -ErrorAction SilentlyContinue
                }

                $res = @()
                foreach ($w in $cimPrinters) {
                    $name = $w.Name
                    $gpStatus = if ($printerMap.ContainsKey($name)) { $printerMap[$name] } else { $null }
                    $workOffline = [bool]$w.WorkOffline
                    $printerStatus = [int]$w.PrinterStatus
                    $extendedStatus = [int]$w.ExtendedPrinterStatus
                    $detectedError = [int]$w.DetectedErrorState

                    $isOnline = $false

                    if ($workOffline -eq $true) {
                        $isOnline = $false
                    } elseif ($gpStatus -and ($gpStatus -eq 'Offline' -or $gpStatus -eq 'Error' -or $gpStatus -eq 'PaperJam' -or $gpStatus -eq 'PaperOut' -or $gpStatus -eq 'NotAvailable')) {
                        $isOnline = $false
                    } elseif ($extendedStatus -in @(7, 9, 11)) {
                        # 7=Offline, 9=Error, 11=NotAvailable
                        $isOnline = $false
                    } elseif ($detectedError -and $detectedError -ne 0 -and $detectedError -ne 2) {
                        # 1=Error, 9=Offline, etc.
                        $isOnline = $false
                    } elseif ($printerStatus -in @(2, 4, 7)) {
                        # 2=Error, 7=Offline, 4=Paper Out
                        $isOnline = $false
                    } elseif ($gpStatus -eq 'Normal') {
                        $isOnline = $true
                    } elseif ($printerStatus -eq 3 -and $detectedError -eq 0 -and ($extendedStatus -eq 2 -or $extendedStatus -eq 3)) {
                        $isOnline = $true
                    } else {
                        $isOnline = $false
                    }

                    $res += [PSCustomObject]@{
                        name = $name
                        driverName = $w.DriverName
                        status = if ($isOnline) { "Ready" } else { "Offline" }
                        isDefault = [bool]$w.Default
                        portName = $w.PortName
                        isOnline = $isOnline
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
                const rawList = (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean);

                // Filter out virtual/unwanted OS printers (OneNote, Microsoft Print to PDF, Generic Text Only, Fax, XPS, etc.)
                const unwantedKeywords = ['onenote', 'print to pdf', 'generic', 'text only', 'fax', 'xps', 'root print queue', 'virtual'];
                
                const physicalPrinters = rawList.filter(p => {
                    const lName = (p.name || '').toLowerCase();
                    const lDriver = (p.driverName || '').toLowerCase();
                    if (unwantedKeywords.some(kw => lName.includes(kw) || lDriver.includes(kw))) {
                        return false;
                    }
                    return true;
                });

                // Deduplicate copy duplicates like "EPSON L3110 Series (Copy 1)" when base "EPSON L3110 Series" exists
                const seenFamilies = new Map();
                for (const p of physicalPrinters) {
                    const lName = (p.name || '').toLowerCase();
                    const lDriver = (p.driverName || '').toLowerCase();
                    const isHp = lName.includes('hp') || lDriver.includes('hp') || lName.includes('131') || lName.includes('135') || lName.includes('138');
                    const isEpson = lName.includes('epson') || lDriver.includes('epson') || lName.includes('l3110');
                    const familyKey = isHp ? 'HP' : (isEpson ? 'EPSON' : p.name);

                    if (!seenFamilies.has(familyKey)) {
                        seenFamilies.set(familyKey, p);
                    } else {
                        const existing = seenFamilies.get(familyKey);
                        if (p.status === 'Ready' && existing.status !== 'Ready') {
                            seenFamilies.set(familyKey, p);
                        } else if (!p.name.includes('(Copy') && existing.name.includes('(Copy')) {
                            seenFamilies.set(familyKey, p);
                        }
                    }
                }

                list = Array.from(seenFamilies.values()).map(p => ({
                    name: p.name || 'Unknown Printer',
                    driverName: p.driverName || 'Standard Driver',
                    status: p.status || 'Offline',
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
                    { name: 'EPSON L3110 Series', driverName: 'EPSON L3110 Series', status: 'Offline', isDefault: true, isPrimary: true, isSecondary: false, isFallback: false },
                    { name: 'HP508140DE1D63(HP Laser MFP 131 133 135-138)', driverName: 'HP Laser MFP 131 133 135-138', status: 'Offline', isDefault: false, isPrimary: false, isSecondary: true, isFallback: false }
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
                    { name: 'EPSON L3110 Series', driverName: 'EPSON L3110 Series', status: 'Offline', isDefault: true, isPrimary: true, isSecondary: false, isFallback: false },
                    { name: 'HP508140DE1D63(HP Laser MFP 131 133 135-138)', driverName: 'HP Laser MFP 131 133 135-138', status: 'Offline', isDefault: false, isPrimary: false, isSecondary: true, isFallback: false }
                ];
                db.savePrinters(list);
            }
            return list;
        }
    },

    async resolveActivePrinter(targetPrinter) {
        try {
            const installedPrinters = await this.refreshPrintersList();
            if (!installedPrinters || installedPrinters.length === 0) return targetPrinter;

            const tLower = (targetPrinter || '').toLowerCase();
            const isHp = tLower.includes('hp') || tLower.includes('131') || tLower.includes('133') || tLower.includes('135') || tLower.includes('136') || tLower.includes('138') || tLower.includes('mfp');
            const isEpson = tLower.includes('epson') || tLower.includes('l3110');

            // Step 1: Check if an exact match is already Ready (Online)
            const exactMatch = installedPrinters.find(p => p.name.toLowerCase() === tLower);
            if (exactMatch && exactMatch.status === 'Ready') {
                return exactMatch.name;
            }

            // Step 2: Search for any READY printer candidate belonging to the requested hardware family (USB Cable or Wi-Fi)
            const onlineFamilyCandidate = installedPrinters.find(p => {
                const lName = p.name.toLowerCase();
                const isReady = p.status === 'Ready';
                if (!isReady) return false;
                if (isHp && (lName.includes('hp') || lName.includes('131') || lName.includes('133') || lName.includes('135') || lName.includes('136') || lName.includes('138') || lName.includes('mfp'))) return true;
                if (isEpson && (lName.includes('epson') || lName.includes('l3110'))) return true;
                return false;
            });

            if (onlineFamilyCandidate) {
                Logger.info('PRINTER_MANAGER', `Resolved requested printer [${targetPrinter}] to active ONLINE device [${onlineFamilyCandidate.name}] (${onlineFamilyCandidate.status})`);
                return onlineFamilyCandidate.name;
            }

            // Step 3: Fallback to any matching installed driver name
            const bestMatch = installedPrinters.find(p => {
                const lName = p.name.toLowerCase();
                if (isHp && (lName.includes('hp') || lName.includes('mfp'))) return true;
                if (isEpson && lName.includes('epson')) return true;
                return false;
            });

            return bestMatch ? bestMatch.name : (exactMatch ? exactMatch.name : targetPrinter);
        } catch (e) {
            return targetPrinter;
        }
    },

    async testPrinter(printerName) {
        Logger.logPrinterEvent(`Dispatching real-time printer connectivity check for [${printerName}]...`);

        const targetPrinter = await this.resolveActivePrinter(printerName);
        const safePrinterName = (targetPrinter || '').replace(/'/g, "''");
        const script = `
            try {
                $p = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$safePrinterName'" -ErrorAction SilentlyContinue
                if (-not $p) { $p = Get-WmiObject -Class Win32_Printer -Filter "Name='$safePrinterName'" -ErrorAction SilentlyContinue }
                
                $gp = Get-Printer -Name '$safePrinterName' -ErrorAction SilentlyContinue

                if (-not $p -and -not $gp) {
                    Write-Output "OFFLINE_CHECK_WIFI_OR_POWER"
                    exit 0
                }

                $gpStatus = if ($gp) { $gp.PrinterStatus.ToString() } else { $null }
                $workOffline = if ($p) { [bool]$p.WorkOffline } else { $false }
                $printerStatus = if ($p) { [int]$p.PrinterStatus } else { 0 }
                $extendedStatus = if ($p) { [int]$p.ExtendedPrinterStatus } else { 0 }
                $detectedError = if ($p) { [int]$p.DetectedErrorState } else { 0 }

                $isOnline = $false
                if ($workOffline -eq $true) {
                    $isOnline = $false
                } elseif ($gpStatus -and ($gpStatus -eq 'Offline' -or $gpStatus -eq 'Error' -or $gpStatus -eq 'PaperJam' -or $gpStatus -eq 'PaperOut' -or $gpStatus -eq 'NotAvailable')) {
                    $isOnline = $false
                } elseif ($extendedStatus -in @(7, 9, 11)) {
                    $isOnline = $false
                } elseif ($detectedError -and $detectedError -ne 0 -and $detectedError -ne 2) {
                    $isOnline = $false
                } elseif ($printerStatus -in @(2, 4, 7)) {
                    $isOnline = $false
                } elseif ($gpStatus -eq 'Normal') {
                    $isOnline = $true
                } elseif ($printerStatus -eq 3 -and $detectedError -eq 0 -and ($extendedStatus -eq 2 -or $extendedStatus -eq 3)) {
                    $isOnline = $true
                } else {
                    $isOnline = $false
                }

                if ($isOnline) {
                    Write-Output "ONLINE_READY"
                } else {
                    Write-Output "OFFLINE_CHECK_WIFI_OR_POWER"
                }
            } catch {
                Write-Output "OFFLINE_CHECK_WIFI_OR_POWER"
            }
        `;
        try {
            const res = await execPowerShell(script, 8000);
            const status = (res || '').trim();
            if (status.includes('ONLINE_READY')) {
                Logger.logPrinterEvent(`Real-time connection confirmed: [${targetPrinter}] is Online and Ready via USB Cable / Wi-Fi.`);
                return { success: true, status: 'ONLINE', printer: targetPrinter, message: `✅ Printer [${targetPrinter}] is Online, powered on, and ready to print!` };
            } else {
                Logger.warn('PRINTER_MANAGER', `Real-time check for [${targetPrinter}] returned offline status.`);
                return { success: false, status: 'OFFLINE', printer: targetPrinter, message: `⚠️ Printer [${targetPrinter}] is currently powered off or disconnected. Please turn on printer power switch or connect cable.` };
            }
        } catch (error) {
            Logger.warn('PRINTER_MANAGER', `Test check fallback for ${targetPrinter}: ${error.message}`);
            return { success: false, status: 'OFFLINE', printer: targetPrinter, message: `⚠️ Printer [${targetPrinter}] is powered off or unreachable.` };
        }
    },

    async printFile(filePath, printerName = null, copies = 1, options = {}) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Target file to print not found: ${filePath}`);
        }

        const settings = db.getSettings();
        const configuredPrinter = printerName || settings.defaultPrinter || settings.primaryPrinter || 'EPSON L3110 Series';
        
        // Resolve dual USB Cable / Wi-Fi active hardware driver
        const targetPrinter = await this.resolveActivePrinter(configuredPrinter);

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
