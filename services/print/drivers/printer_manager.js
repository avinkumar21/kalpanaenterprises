const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const db = require('../../../data/local_db/index.js');
const Logger = require('../../logs/logger.js');

const HP_WIFI_STATIC_IP = '192.168.31.2';

function checkHpWifiConnectivity(ip = HP_WIFI_STATIC_IP, timeoutMs = 1200) {
    return new Promise((resolve) => {
        const sock = new net.Socket();
        sock.setTimeout(timeoutMs);
        sock.connect(9100, ip, () => {
            sock.destroy();
            resolve(true);
        });
        sock.on('error', () => {
            const sock80 = new net.Socket();
            sock80.setTimeout(timeoutMs);
            sock80.connect(80, ip, () => {
                sock80.destroy();
                resolve(true);
            });
            sock80.on('error', () => resolve(false));
            sock80.on('timeout', () => { sock80.destroy(); resolve(false); });
        });
        sock.on('timeout', () => {
            sock.destroy();
            resolve(false);
        });
    });
}

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
const CACHE_TTL_MS = 2500;

const PrinterManager = {
    HP_WIFI_IP: HP_WIFI_STATIC_IP,
    checkHpWifiConnectivity,

    async getAllPrintersLiveStatus(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && cachedStatus && (now - lastStatusFetchTime < CACHE_TTL_MS)) {
            return cachedStatus;
        }

        const script = `
            try {
                # Auto-clear any stuck/error print jobs from Windows Spooler
                Get-PrintJob -PrinterName * -ErrorAction SilentlyContinue | Where-Object { $_.JobStatus -like '*Error*' -or $_.JobStatus -like '*Retained*' } | Remove-PrintJob -ErrorAction SilentlyContinue

                $printerMap = @{}
                $gp = Get-Printer -ErrorAction SilentlyContinue
                if ($gp) {
                    foreach ($p in $gp) {
                        $printerMap[$p.Name] = [PSCustomObject]@{
                            Status = $p.PrinterStatus.ToString()
                            Port = $p.PortName
                            Driver = $p.DriverName
                            Location = $p.Location
                            WorkOffline = $p.WorkOffline
                        }
                    }
                }

                # Real-time hardware check: Query PnP Device Manager for physical device presence
                $pnpPrinters = Get-PnpDevice -Class 'Printer' -ErrorAction SilentlyContinue

                $wmiPrinters = Get-WmiObject -Class Win32_Printer -ErrorAction SilentlyContinue

                $results = @{}
                foreach ($w in $wmiPrinters) {
                    $name = $w.Name
                    $gpInfo = if ($printerMap.ContainsKey($name)) { $printerMap[$name] } else { $null }
                    $gpStatus = if ($gpInfo) { $gpInfo.Status } else { $null }
                    $location = if ($gpInfo) { $gpInfo.Location } else { $w.Location }
                    $workOffline = [bool]$w.WorkOffline
                    $printerStatus = [int]$w.PrinterStatus
                    $extendedStatus = [int]$w.ExtendedPrinterStatus

                    $isUsb = $w.PortName -like 'USB*'
                    $pnpPresent = $false
                    if ($isUsb) {
                        $matchedPnp = $pnpPrinters | Where-Object { 
                            ($_.FriendlyName -eq $name -or $_.InstanceId -like "*$name*" -or $_.InstanceId -like "*$($w.PortName)*") -and $_.Present -eq $true 
                        }
                        $pnpPresent = [bool]$matchedPnp
                    }

                    # Physical connection rule:
                    # USB devices MUST have PnP hardware presence ($pnpPresent == $true) AND not in WorkOffline state
                    $isOnline = $false
                    if ($isUsb) {
                        $isOnline = $pnpPresent -and (-not $workOffline)
                    } elseif ($w.PortName -like 'IP_*' -or $w.PortName -like '192.168.*' -or $name -like '*(Wi-Fi)*') {
                        $isOnline = (-not $workOffline) -and ($gpStatus -ne 'Offline')
                    } elseif ($workOffline -eq $true -or $gpStatus -eq 'Offline') {
                        $isOnline = $false
                    } elseif ($extendedStatus -in @(7, 9, 11) -or $printerStatus -in @(2, 4, 7)) {
                        $isOnline = $false
                    } else {
                        $isOnline = $true
                    }

                    $results[$name] = [PSCustomObject]@{
                        name = $name
                        driverName = $w.DriverName
                        portName = $w.PortName
                        location = $location
                        status = if ($isOnline) { "Ready" } else { "Offline" }
                        isOnline = $isOnline
                        pnpPresent = $pnpPresent
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
            const [out, isHpWifiAlive] = await Promise.all([
                execPowerShell(script, 10000),
                checkHpWifiConnectivity()
            ]);

            const statusMap = {};
            if (out) {
                const parsed = JSON.parse(out);
                const list = (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean);
                
                for (const item of list) {
                    const lName = (item.name || '').toLowerCase();
                    const isHpWifi = lName.includes('wi-fi') || item.portName === `IP_${HP_WIFI_STATIC_IP}` || item.portName?.includes('192.168.');
                    const isHpUsb = (lName.includes('hp') || lName.includes('131') || lName.includes('135') || lName.includes('138')) && !isHpWifi;
                    const isEpson = lName.includes('epson') || lName.includes('l3110');

                    if (isHpWifi) {
                        item.connection = `Wi-Fi (${HP_WIFI_STATIC_IP})`;
                        item.isOnline = Boolean(isHpWifiAlive && !item.workOffline);
                        item.status = item.isOnline ? 'Ready (Wi-Fi)' : 'Offline (Wi-Fi Unreachable)';
                    } else if (isHpUsb) {
                        item.connection = 'USB (Fallback Cable)';
                        item.isOnline = Boolean(item.pnpPresent && !item.workOffline);
                        item.status = item.isOnline ? 'Ready (USB Cable)' : 'Offline (USB Disconnected)';
                    } else if (isEpson) {
                        item.connection = 'USB (Spooler)';
                        item.isOnline = Boolean(item.pnpPresent && !item.workOffline);
                        item.status = item.isOnline ? 'Ready (USB Spooler)' : 'Offline (USB Disconnected)';
                    }
                    statusMap[item.name] = item;
                }
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
                status: p.isOnline ? (p.status || 'Ready') : 'Offline',
                isOnline: Boolean(p.isOnline),
                connection: p.connection || 'USB',
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
                    { name: 'EPSON L3110 Series', driverName: 'EPSON L3110 Series', status: 'Ready', isDefault: false, isPrimary: false, isSecondary: true, isFallback: false },
                    { name: 'HP Laser MFP 131 133 135-138', driverName: 'HP Laser MFP 131 133 135-138', status: 'Ready', isDefault: true, isPrimary: true, isSecondary: false, isFallback: false }
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
                    { name: 'EPSON L3110 Series', driverName: 'EPSON L3110 Series', status: 'Ready', isDefault: false, isPrimary: false, isSecondary: true, isFallback: false },
                    { name: 'HP Laser MFP 131 133 135-138', driverName: 'HP Laser MFP 131 133 135-138', status: 'Ready', isDefault: true, isPrimary: true, isSecondary: false, isFallback: false }
                ];
                db.savePrinters(list);
            }
            return list;
        }
    },

    async resolveActivePrinter(targetPrinter, options = {}) {
        try {
            const settings = db.getSettings();
            const isColorRequested = Boolean(
                options.colorMode === 'Color' || 
                options.isColor === true || 
                String(options.colorMode || '').toLowerCase().includes('color')
            );

            if (!targetPrinter || targetPrinter === 'default' || targetPrinter === 'auto') {
                targetPrinter = isColorRequested ? 'EPSON L3110 Series' : (settings.defaultPrinter || 'HP Laser MFP 131 133 135-138');
            }

            const statusMap = await this.getAllPrintersLiveStatus();
            const installedList = Object.values(statusMap);
            if (!installedList || installedList.length === 0) return targetPrinter || 'EPSON L3110 Series';

            // If Color is requested and no specific target or target is a monochrome laser, prioritize Epson L3110
            if (isColorRequested && (!targetPrinter || targetPrinter.toLowerCase().includes('hp') || targetPrinter.toLowerCase().includes('131') || targetPrinter.toLowerCase().includes('135'))) {
                const epsonPrinter = installedList.find(p => p.name.toLowerCase().includes('epson') || p.name.toLowerCase().includes('l3110'));
                if (epsonPrinter) {
                    Logger.info('PRINTER_MANAGER', `Colour printout requested: Automatically routed job to Color InkTank printer [${epsonPrinter.name}]`);
                    return epsonPrinter.name;
                }
            }

            const tLower = (targetPrinter || '').toLowerCase();
            const isHp = tLower.includes('hp') || tLower.includes('131') || tLower.includes('133') || tLower.includes('135') || tLower.includes('136') || tLower.includes('138') || tLower.includes('mfp');
            const isEpson = tLower.includes('epson') || tLower.includes('l3110');

            if (isHp) {
                // Check if HP Wi-Fi static IP (192.168.31.2) is pingable / reachable
                const isWifiOnline = await checkHpWifiConnectivity();
                if (isWifiOnline) {
                    const wifiPrinter = installedList.find(p => p.name.includes('(Wi-Fi)') || p.portName === `IP_${HP_WIFI_STATIC_IP}`);
                    if (wifiPrinter && (wifiPrinter.isOnline || (wifiPrinter.status && wifiPrinter.status.includes('Ready')))) {
                        Logger.info('PRINTER_MANAGER', `HP Printer: Wi-Fi connectivity confirmed to ${HP_WIFI_STATIC_IP}. Routing job to [${wifiPrinter.name}].`);
                        return wifiPrinter.name;
                    }
                }
                // If Wi-Fi is unreachable, fallback to USB cable connection
                const usbPrinter = installedList.find(p => (p.name.includes('HP Laser MFP') && !p.name.includes('(Wi-Fi)')) || p.portName === 'USB002');
                if (usbPrinter) {
                    Logger.info('PRINTER_MANAGER', `HP Printer: Wi-Fi unreachable. Routing job to direct USB cable fallback [${usbPrinter.name}] (USB002).`);
                    return usbPrinter.name;
                }
            }

            // Step 1: Check if exact match is already Ready (Online)
            const exactMatch = installedList.find(p => p.name.toLowerCase() === tLower);
            if (exactMatch && exactMatch.status === 'Ready') {
                return exactMatch.name;
            }

            // Step 2: Search for any READY printer candidate belonging to the requested hardware family
            const onlineFamilyCandidate = installedList.find(p => {
                const lName = (p.name || '').toLowerCase();
                const isReady = p.status === 'Ready' || (p.status && p.status.includes('Ready'));
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
                isOnline = Boolean(matched.isOnline === true);
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
                    isOnline = Boolean(fallbackCandidate.isOnline === true);
                }
            }

            const tLower = (targetPrinter || printerName || '').toLowerCase();
            const isEpson = tLower.includes('epson') || tLower.includes('l3110');

            if (isOnline) {
                Logger.logPrinterEvent(`Real-time connection confirmed: [${targetPrinter}] is Online and Ready.`);
                return { 
                    success: true, 
                    status: 'ONLINE', 
                    printer: targetPrinter, 
                    message: isEpson 
                        ? `✅ Printer [${targetPrinter}] is Online, powered on, and ready to print (Color & B/W)!` 
                        : `✅ Printer [${targetPrinter}] is Online and ready to print!`
                };
            } else {
                Logger.warn('PRINTER_MANAGER', `Real-time check for [${targetPrinter}] returned offline status.`);
                return { 
                    success: false, 
                    status: 'OFFLINE', 
                    printer: targetPrinter, 
                    message: isEpson
                        ? `⚠️ Printer [${targetPrinter}] is currently powered off or cable disconnected. Please check connection and power switch.`
                        : `⚠️ Printer [${targetPrinter}] is currently powered off or cable disconnected. Please check connection and power switch.`
                };
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

        const isColor = Boolean(
            options.colorMode === 'Color' || 
            options.isColor === true || 
            String(options.colorMode || '').toLowerCase().includes('color')
        );

        const settings = db.getSettings();
        const configuredPrinter = printerName || (isColor ? 'EPSON L3110 Series' : (settings.defaultPrinter || settings.primaryPrinter || 'HP Laser MFP 131 133 135-138'));
        
        // Resolve active hardware driver
        const targetPrinter = await this.resolveActivePrinter(configuredPrinter, { colorMode: isColor ? 'Color' : 'BlackWhite' });

        Logger.logPrinting(`Initiating direct hardware print job for [${path.basename(filePath)}] onto printer [${targetPrinter}] (${copies} copies, Mode: ${isColor ? 'Color' : 'B&W'})...`, { options });

        const absPath = path.resolve(filePath);
        const ext = path.extname(absPath).toLowerCase();
        let script = '';

        const colorBoolStr = isColor ? '$true' : '$false';

        // Direct hardware image spooling via .NET System.Drawing (100% background, no Windows dialogs, strictly A4 Sheet)
        if (['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp'].includes(ext)) {
            script = `
                try {
                    # Automatically purge any previous stuck error jobs on target printer
                    try {
                        Get-PrintJob -PrinterName "${targetPrinter.replace(/'/g, "''")}" -ErrorAction SilentlyContinue | Where-Object { $_.JobStatus -like '*Error*' } | Remove-PrintJob -ErrorAction SilentlyContinue
                    } catch {}

                    # Ensure printer is not in WorkOffline state
                    $p = Get-WmiObject -Class Win32_Printer -Filter "Name='${targetPrinter.replace(/'/g, "''")}'" -ErrorAction SilentlyContinue
                    if ($p -and $p.WorkOffline) {
                        try { $p.WorkOffline = $false; $null = $p.Put() } catch {}
                    }

                    Add-Type -AssemblyName System.Drawing
                    $img = [System.Drawing.Image]::FromFile("${absPath}")
                    $pd = New-Object System.Drawing.Printing.PrintDocument
                    $pd.PrinterSettings.PrinterName = "${targetPrinter}"
                    $pd.PrinterSettings.Copies = ${copies}
                    
                    # Color Mode configuration: Color ($true) or B/W Monochrome ($false)
                    $pd.DefaultPageSettings.Color = ${colorBoolStr}
                    try { $pd.PrinterSettings.DefaultPageSettings.Color = ${colorBoolStr} } catch {}

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
            // Direct silent physical hardware PDF printing using Windows Native WinRT PDF Engine + .NET PrintDocument
            script = `
                try {
                    # Automatically purge any previous stuck error jobs on target printer
                    try {
                        Get-PrintJob -PrinterName "${targetPrinter.replace(/'/g, "''")}" -ErrorAction SilentlyContinue | Where-Object { $_.JobStatus -like '*Error*' } | Remove-PrintJob -ErrorAction SilentlyContinue
                    } catch {}

                    # Ensure printer is not in WorkOffline state
                    $p = Get-WmiObject -Class Win32_Printer -Filter "Name='${targetPrinter.replace(/'/g, "''")}'" -ErrorAction SilentlyContinue
                    if ($p -and $p.WorkOffline) {
                        try { $p.WorkOffline = $false; $null = $p.Put() } catch {}
                    }

                    Add-Type -AssemblyName System.Drawing
                    Add-Type -AssemblyName System.Runtime.WindowsRuntime

                    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
                    Function AwaitWinRt($WinRtTask, $ResultType) {
                        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
                        $netTask = $asTask.Invoke($null, @($WinRtTask))
                        $netTask.Wait(-1) | Out-Null
                        return $netTask.Result
                    }

                    $asActionTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
                    Function AwaitWinRtAction($WinRtTask) {
                        $netTask = $asActionTask.Invoke($null, @($WinRtTask))
                        $netTask.Wait(-1) | Out-Null
                    }

                    [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
                    [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
                    [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

                    $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync("${absPath}")
                    $file = AwaitWinRt $fileTask ([Windows.Storage.StorageFile])
                    $pdfDocTask = [Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)
                    $pdfDoc = AwaitWinRt $pdfDocTask ([Windows.Data.Pdf.PdfDocument])

                    $totalPages = $pdfDoc.PageCount
                    $global:pageIndex = 0

                    $pd = New-Object System.Drawing.Printing.PrintDocument
                    $pd.PrinterSettings.PrinterName = "${targetPrinter}"
                    $pd.PrinterSettings.Copies = ${copies}
                    $pd.DefaultPageSettings.Color = ${colorBoolStr}
                    try { $pd.PrinterSettings.DefaultPageSettings.Color = ${colorBoolStr} } catch {}

                    $a4Paper = $pd.PrinterSettings.PaperSizes | Where-Object { $_.Kind -eq [System.Drawing.Printing.PaperKind]::A4 -or $_.PaperName -like '*A4*' } | Select-Object -First 1
                    if ($a4Paper) { $pd.DefaultPageSettings.PaperSize = $a4Paper }
                    $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
                    $pd.OriginAtMargins = $false

                    $pd.add_PrintPage({
                        param($sender, $e)
                        if ($global:pageIndex -lt $totalPages) {
                            $page = $pdfDoc.GetPage($global:pageIndex)
                            $memStream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
                            $renderTask = $page.RenderToStreamAsync($memStream)
                            AwaitWinRtAction $renderTask
                            
                            $netStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStream($memStream)
                            $img = [System.Drawing.Image]::FromStream($netStream)
                            
                            $e.Graphics.DrawImage($img, $e.PageBounds)
                            
                            $img.Dispose()
                            $netStream.Dispose()
                            $memStream.Dispose()
                            $page.Dispose()
                            
                            $global:pageIndex++
                            $e.HasMorePages = ($global:pageIndex -lt $totalPages)
                        } else {
                            $e.HasMorePages = $false
                        }
                    })

                    $pd.Print()
                    $pd.Dispose()
                    Write-Host "PRINT_SUCCESS"
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
            const execTimeout = ext === '.pdf' ? 240000 : 35000;
            await execPowerShell(script, execTimeout);
            Logger.logPrinting(`Successfully spooled [${path.basename(filePath)}] directly to physical printer [${targetPrinter}] (${isColor ? 'Color' : 'B&W'})!`);
            return { success: true, printer: targetPrinter, copies, mode: isColor ? 'Color Direct Hardware Spooler' : 'B&W Direct Hardware Spooler' };
        } catch (error) {
            // If HP Wi-Fi print failed, fall back immediately to the USB cable connection
            if (targetPrinter.includes('(Wi-Fi)') && !options.isUsbFallback) {
                Logger.warn('PRINTER_MANAGER', `HP Wi-Fi spool failed (${error.message}). Seamlessly switching to direct USB cable printer...`);
                return await this.printFile(filePath, 'HP Laser MFP 131 133 135-138', copies, { ...options, isUsbFallback: true });
            }

            // Try secondary printer before giving up only if secondary is defined and different
            const secondaryPrinter = settings.secondaryPrinter;
            if (secondaryPrinter && secondaryPrinter !== targetPrinter && !options.isFallbackAttempt) {
                Logger.warn('PRINTER_MANAGER', `Printer [${targetPrinter}] print failed. Trying secondary printer [${secondaryPrinter}]...`);
                return await this.printFile(filePath, secondaryPrinter, copies, { ...options, isFallbackAttempt: true });
            }
            Logger.error('PRINTER_MANAGER', `Printer spool error: ${error.message}`);
            throw new Error(`Printer [${targetPrinter}] print spool failed: ${error.message}`);
        }
    }
};

module.exports = PrinterManager;
