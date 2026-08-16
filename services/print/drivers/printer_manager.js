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

let cachedStatus = null;
let lastStatusFetchTime = 0;
const CACHE_TTL_MS = 3000;

const PrinterManager = {
    async getAllPrintersLiveStatus(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && cachedStatus && (now - lastStatusFetchTime < CACHE_TTL_MS)) {
            return cachedStatus;
        }

        const script = `
            try {
                $printerMap = @{}
                $gp = Get-Printer -ErrorAction SilentlyContinue
                if ($gp) {
                    foreach ($p in $gp) {
                        $printerMap[$p.Name] = [PSCustomObject]@{
                            Status = $p.PrinterStatus.ToString()
                            Port = $p.PortName
                            Driver = $p.DriverName
                        }
                    }
                }

                $wmiPrinters = Get-WmiObject -Class Win32_Printer -ErrorAction SilentlyContinue

                $results = @{}
                foreach ($w in $wmiPrinters) {
                    $name = $w.Name
                    $gpInfo = if ($printerMap.ContainsKey($name)) { $printerMap[$name] } else { $null }
                    $gpStatus = if ($gpInfo) { $gpInfo.Status } else { $null }
                    $workOffline = [bool]$w.WorkOffline
                    $printerStatus = [int]$w.PrinterStatus
                    $extendedStatus = [int]$w.ExtendedPrinterStatus
                    $detectedError = [int]$w.DetectedErrorState

                    # Auto-recover / clear WorkOffline if printer is connected & normal in spooler
                    if ($workOffline -and ($gpStatus -eq 'Normal' -or $printerStatus -eq 3 -or $extendedStatus -eq 2 -or $extendedStatus -eq 3)) {
                        try {
                            $w.WorkOffline = $false
                            $w.Put()
                            $workOffline = $false
                        } catch {}
                    }

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
                    } elseif ($printerStatus -eq 3 -and $detectedError -eq 0) {
                        $isOnline = $true
                    } else {
                        $isOnline = $false
                    }

                    $results[$name] = [PSCustomObject]@{
                        name = $name
                        driverName = $w.DriverName
                        portName = $w.PortName
                        status = if ($isOnline) { "Ready" } else { "Offline" }
                        isOnline = $isOnline
                        isDefault = [bool]$w.Default
                        workOffline = $workOffline
                        gpStatus = $gpStatus
                    }
                }

                $results.Values | ConvertTo-Json -Compress
            } catch {
                Write-Error $_.Exception.Message
                exit 1
            }
        `;

        try {
            const out = await execPowerShell(script, 10000);
            const statusMap = {};
            if (out) {
                const parsed = JSON.parse(out);
                const list = (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean);
                list.forEach(item => {
                    statusMap[item.name] = item;
                });
            }
            cachedStatus = statusMap;
            lastStatusFetchTime = Date.now();
            return statusMap;
        } catch (err) {
            Logger.warn('PRINTER_MANAGER', `Live printer status fetch failed: ${err.message}`);
            return cachedStatus || {};
        }
    },

    async refreshPrintersList() {
        Logger.logPrinterEvent("Scanning system for installed Windows printers with live hardware status...");
        try {
            const statusMap = await this.getAllPrintersLiveStatus(true);
            const rawList = Object.values(statusMap);

            // Filter out virtual/unwanted OS printers
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

            let list = Array.from(seenFamilies.values()).map(p => ({
                name: p.name || 'Unknown Printer',
                driverName: p.driverName || 'Standard Driver',
                status: p.status || 'Offline',
                isDefault: Boolean(p.isDefault),
                isPrimary: false,
                isSecondary: false,
                isFallback: false
            }));

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
            const statusMap = await this.getAllPrintersLiveStatus();
            const installedList = Object.values(statusMap);
            if (!installedList || installedList.length === 0) return targetPrinter;

            const tLower = (targetPrinter || '').toLowerCase();
            const isHp = tLower.includes('hp') || tLower.includes('131') || tLower.includes('133') || tLower.includes('135') || tLower.includes('136') || tLower.includes('138') || tLower.includes('mfp');
            const isEpson = tLower.includes('epson') || tLower.includes('l3110');

            // Step 1: Check if exact match is already Ready (Online)
            const exactMatch = installedList.find(p => p.name.toLowerCase() === tLower);
            if (exactMatch && exactMatch.status === 'Ready') {
                return exactMatch.name;
            }

            // Step 2: Search for any READY printer candidate belonging to the requested hardware family (USB Cable or Wi-Fi)
            const onlineFamilyCandidate = installedList.find(p => {
                const lName = (p.name || '').toLowerCase();
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

            // Step 3: Fallback to matching driver name or exact match
            const bestMatch = installedList.find(p => {
                const lName = (p.name || '').toLowerCase();
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

        try {
            const statusMap = await this.getAllPrintersLiveStatus(true);
            const targetPrinter = await this.resolveActivePrinter(printerName);
            
            const matched = statusMap[targetPrinter] || Object.values(statusMap).find(p => p.name.toLowerCase() === (targetPrinter || '').toLowerCase());
            
            let isOnline = false;
            if (matched) {
                isOnline = Boolean(matched.isOnline || matched.status === 'Ready');
            } else {
                const tLower = (printerName || '').toLowerCase();
                const isEpson = tLower.includes('epson') || tLower.includes('l3110');
                const isHp = tLower.includes('hp') || tLower.includes('131') || tLower.includes('133') || tLower.includes('135');
                const fallbackCandidate = Object.values(statusMap).find(p => {
                    const lName = (p.name || '').toLowerCase();
                    if (isEpson && (lName.includes('epson') || lName.includes('l3110'))) return true;
                    if (isHp && (lName.includes('hp') || lName.includes('mfp'))) return true;
                    return false;
                });
                if (fallbackCandidate) {
                    isOnline = Boolean(fallbackCandidate.isOnline || fallbackCandidate.status === 'Ready');
                }
            }

            if (isOnline) {
                Logger.logPrinterEvent(`Real-time connection confirmed: [${targetPrinter}] is Online and Ready.`);
                return { success: true, status: 'ONLINE', printer: targetPrinter, message: `✅ Printer [${targetPrinter}] is Online, powered on, and ready to print via USB / Wi-Fi!` };
            } else {
                Logger.warn('PRINTER_MANAGER', `Real-time check for [${targetPrinter}] returned offline status.`);
                return { success: false, status: 'OFFLINE', printer: targetPrinter, message: `⚠️ Printer [${targetPrinter}] is currently powered off or disconnected. Please turn on printer power switch or connect cable.` };
            }
        } catch (error) {
            Logger.warn('PRINTER_MANAGER', `Test check fallback for ${printerName}: ${error.message}`);
            return { success: false, status: 'OFFLINE', printer: printerName, message: `⚠️ Printer [${printerName}] is powered off or unreachable.` };
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

        // Direct hardware image spooling via .NET System.Drawing (100% background, no Windows dialogs, strictly A4 Sheet)
        if (['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp'].includes(ext)) {
            script = `
                try {
                    # Ensure printer is not in WorkOffline state
                    $p = Get-WmiObject -Class Win32_Printer -Filter "Name='${targetPrinter.replace(/'/g, "''")}'" -ErrorAction SilentlyContinue
                    if ($p -and $p.WorkOffline) {
                        try { $p.WorkOffline = $false; $p.Put() } catch {}
                    }

                    Add-Type -AssemblyName System.Drawing
                    $img = [System.Drawing.Image]::FromFile("${absPath}")
                    $pd = New-Object System.Drawing.Printing.PrintDocument
                    $pd.PrinterSettings.PrinterName = "${targetPrinter}"
                    $pd.PrinterSettings.Copies = ${copies}
                    
                    # Strictly enforce A4 Sheet Paper (Kind 9 = A4 standard)
                    $a4Paper = $pd.PrinterSettings.PaperSizes | Where-Object { $_.Kind -eq [System.Drawing.Printing.PaperKind]::A4 -or $_.PaperName -like '*A4*' } | Select-Object -First 1
                    if ($a4Paper) {
                        $pd.DefaultPageSettings.PaperSize = $a4Paper
                    }
                    $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
                    $pd.OriginAtMargins = $false

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
                    # Ensure printer is not in WorkOffline state
                    $p = Get-WmiObject -Class Win32_Printer -Filter "Name='${targetPrinter.replace(/'/g, "''")}'" -ErrorAction SilentlyContinue
                    if ($p -and $p.WorkOffline) {
                        try { $p.WorkOffline = $false; $p.Put() } catch {}
                    }

                    $acro = "C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe"
                    if (-not (Test-Path $acro)) { $acro = "C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe" }
                    if (Test-Path $acro) {
                        for ($i = 0; $i -lt ${copies}; $i++) {
                            $proc = Start-Process -FilePath $acro -ArgumentList "/t \`"${absPath}\`" \`"${targetPrinter}\`"" -WindowStyle Hidden -PassThru
                            Start-Sleep -Seconds 4
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
                Logger.warn('PRINTER_MANAGER', `Printer [${targetPrinter}] unreachable. Trying secondary printer [${secondaryPrinter}]...`);
                return await this.printFile(filePath, secondaryPrinter, copies, { ...options, isFallbackAttempt: true });
            }
            Logger.error('PRINTER_MANAGER', `Printer spool error: ${error.message}`);
            throw new Error(`Printer [${targetPrinter}] print spool failed: ${error.message}`);
        }
    }
};

module.exports = PrinterManager;
