const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const db = require('../../../data/local_db/index.js');
const Logger = require('../../../services/logs/logger.js');
const PrinterManager = require('../../../services/print/drivers/printer_manager.js');
const PrintQueue = require('../../../services/print/queue/print_queue.js');
const FolderWatcher = require('../../../services/watchers/folder_watcher.js');
const EmailWatcher = require('../../../services/watchers/email_watcher.js');
const { processDocument, mergeIdCards, detectDocumentBorders, autoCropDocument } = require('../../../services/image_processor/index.js');

const router = express.Router();

const rootDir = path.resolve(__dirname, '../../../');
const incomingDir = path.join(rootDir, 'storage', 'incoming');
const processedDir = path.join(rootDir, 'storage', 'processed');
if (!fs.existsSync(incomingDir)) fs.mkdirSync(incomingDir, { recursive: true });
if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
const upload = multer({ dest: incomingDir });

// Strips invalid/conflicting ICC color profile chunks from palette PNGs to prevent libvips interpretation space crashes
function sanitizePngBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50) return buffer;
    try {
        const chunks = [buffer.slice(0, 8)];
        let offset = 8;
        while (offset < buffer.length) {
            const len = buffer.readUInt32BE(offset);
            const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
            if (type !== 'iCCP' && type !== 'eXIf') {
                chunks.push(buffer.slice(offset, offset + 12 + len));
            }
            offset += 12 + len;
        }
        return Buffer.concat(chunks);
    } catch {
        return buffer;
    }
}

// Helper to get local Wi-Fi IPv4 address
function getLocalLanIp() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    if (interfaces['Wi-Fi']) {
        const v4 = interfaces['Wi-Fi'].find(i => i.family === 'IPv4' && !i.internal);
        if (v4) return v4.address;
    }
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.'))) {
                return iface.address;
            }
        }
    }
    return '192.168.31.233';
}

// GET /api/prints/status - Comprehensive operational health diagnostics
router.get('/status', async (req, res) => {
    try {
        const watcherStatus = FolderWatcher.getStatus();
        const queue = db.getQueue();
        const stats = db.getStatistics();
        const todayStat = stats[0] || { totalReceived: 0, totalProcessed: 0, totalPrinted: 0, totalFailed: 0 };
        const history = db.getHistory(5);
        const printers = db.getPrinters();
        const publicTunnelUrl = db.getSettings().publicTunnelUrl || '';
        const lanIp = getLocalLanIp();

        const pendingJobs = queue.filter(j => j.status === 'Pending' || j.status === 'Retry').length;
        const printingJobs = queue.filter(j => j.status === 'Printing').length;

        res.json({
            status: 'ONLINE',
            serviceName: 'ARKA Print Service (24x7 Continuous Engine)',
            timestamp: new Date().toISOString(),
            publicTunnelUrl: publicTunnelUrl,
            lanIp: lanIp,
            wifiUrl: `http://${lanIp}:8082/prints?kiosk=true#upload`,
            mobileUrl: publicTunnelUrl ? `${publicTunnelUrl.replace(/\/+$/, '')}/prints?kiosk=true#upload` : '',
            watcher: watcherStatus,
            metrics: {
                filesToday: todayStat.totalReceived,
                pendingJobs,
                printingJobs,
                completedToday: todayStat.totalPrinted,
                failedToday: todayStat.totalFailed,
                queueLength: queue.length,
                activePrinters: printers.length
            },
            lastFileReceived: history[0] ? history[0].customerFile : 'None yet',
            lastPrintedFile: history.find(h => h.status === 'Success')?.customerFile || 'None yet',
            recentActivity: history
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/prints/printer-status - Live status check for shop printers (USB & Wi-Fi)
router.get('/printer-status', async (req, res) => {
    const epsonName = 'EPSON L3110 Series';
    const hpName = 'HP508140DE1D63(HP Laser MFP 131 133 135-138)';

    try {
        const statusMap = await PrinterManager.getAllPrintersLiveStatus(true);
        const allPrinters = Object.values(statusMap);

        const epsonPrinters = allPrinters.filter(p => (p.name || '').toLowerCase().includes('epson') || (p.name || '').toLowerCase().includes('l3110'));
        const epsonOnline = Boolean(epsonPrinters.some(p => p.isOnline === true));

        const hpWifiPrinter = allPrinters.find(p => p.name.includes('(Wi-Fi)') || p.portName === `IP_${PrinterManager.HP_WIFI_IP}`);
        const hpWifiOnline = Boolean(hpWifiPrinter && hpWifiPrinter.isOnline === true);

        const hpUsbPrinters = allPrinters.filter(p => (p.name || '').toLowerCase().includes('hp') && !p.name.includes('(Wi-Fi)'));
        const hpUsbOnline = Boolean(hpUsbPrinters.some(p => p.isOnline === true));

        const hpOnline = hpWifiOnline || hpUsbOnline;

        const result = {
            [epsonName]: epsonOnline ? 'Online' : 'Offline',
            [hpName]: hpOnline ? 'Online' : 'Offline',
            'EPSON L3110 Series': epsonOnline ? 'Online' : 'Offline',
            'HP Laser MFP 131 133 135-138': hpOnline ? 'Online' : 'Offline',
            'HP Laser MFP 131 133 135-138 (Wi-Fi)': hpWifiOnline ? 'Online' : 'Offline',
            messages: {
                [epsonName]: epsonOnline 
                    ? `✅ Printer [EPSON L3110 Series] is Online, powered on, and ready to print via USB Cable!` 
                    : `⚠️ Printer [EPSON L3110 Series] is currently disconnected or powered off. USB cable is not connected to the shop desktop.`,
                [hpName]: hpOnline 
                    ? (hpWifiOnline ? `✅ Printer [HP Laser MFP 131 133 135-138] is Online via ARKA Wi-Fi (${PrinterManager.HP_WIFI_IP})!` : `✅ Printer [HP Laser MFP 131 133 135-138] is Online via direct USB cable!`)
                    : `⚠️ Printer [HP Laser MFP 131 133 135-138] is currently offline or disconnected.`
            },
            timestamp: new Date().toISOString()
        };

        res.json(result);
    } catch (error) {
        res.json({
            [epsonName]: 'Offline',
            [hpName]: 'Offline',
            'EPSON L3110 Series': 'Offline',
            'HP Laser MFP 131 133 135-138': 'Offline',
            messages: {
                [epsonName]: '⚠️ Printer is currently powered off or disconnected.',
                [hpName]: '⚠️ Printer is currently powered off or disconnected.'
            },
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// POST & GET /api/prints/test-printer - Real-time connectivity test for specific printer
router.all('/test-printer', async (req, res) => {
    try {
        const printerName = req.body?.printer || req.query?.printer || 'EPSON L3110 Series';
        const result = await PrinterManager.testPrinter(printerName);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, status: 'OFFLINE', error: err.message });
    }
});

// GET /api/prints/history
router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    res.json(db.getHistory(limit));
});

// GET /api/prints/printers
router.get('/printers', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        let list = db.getPrinters();
        if (list.length === 0 || forceRefresh) {
            list = await PrinterManager.refreshPrintersList();
        }
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/prints/queue
router.get('/queue', (req, res) => {
    res.json(db.getQueue());
});

// GET /api/prints/logs
router.get('/logs', (req, res) => {
    const category = req.query.category || 'ALL';
    const level = req.query.level || 'ALL';
    const limit = parseInt(req.query.limit) || 150;
    res.json(db.getLogs({ category, level, limit }));
});

// GET /api/prints/statistics
router.get('/statistics', (req, res) => {
    res.json(db.getStatistics());
});

// GET /api/prints/settings
router.get('/settings', (req, res) => {
    res.json(db.getSettings());
});

// POST /api/prints/settings
router.post('/settings', (req, res) => {
    try {
        db.saveSettings(req.body);
        Logger.logServiceEvent("Administrator settings updated.", req.body);
        // Restart watchers to take up new folder, credentials, or polling intervals
        FolderWatcher.start();
        EmailWatcher.start();
        res.json({ success: true, settings: db.getSettings() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/prints/reprint
router.post('/reprint', async (req, res) => {
    const { historyId, printer, copies } = req.body;
    const history = db.getHistory(500);
    const item = history.find(h => h.id === historyId);
    if (!item || !fs.existsSync(item.processedPath)) {
        return res.status(404).json({ error: "Original processed document no longer in storage." });
    }

    const job = await PrintQueue.addJob({
        fileId: item.fileId,
        customerName: 'Reprint Override',
        fileName: item.customerFile,
        processedPath: item.processedPath,
        originalPath: item.originalPath,
        printer: printer || item.printerName || db.getSettings().defaultPrinter,
        copies: Number(copies) || 1,
        priority: 10 // top priority for manual reprint
    });

    Logger.info('API', `Manual reprint dispatched for ${item.customerFile}`);
    res.json({ success: true, job });
});

// POST /api/prints/print (Manual Override / Custom job dispatch)
router.post('/print', async (req, res) => {
    const { jobId, printer, copies = 1, colorMode, autoStart = true } = req.body;
    const queue = db.getQueue();
    const history = db.getHistory(500);
    let item = queue.find(j => j.id === jobId || j.fileId === jobId || j.fileName === jobId);
    
    const resolvedColorMode = colorMode ? (String(colorMode).toLowerCase().includes('color') ? 'Color' : 'BlackWhite') : undefined;

    if (!item) {
        const histItem = history.find(h => h.id === jobId || h.fileId === jobId || h.customerFile === jobId);
        if (histItem && (fs.existsSync(histItem.processedPath) || fs.existsSync(histItem.originalPath))) {
            const jobColor = resolvedColorMode || histItem.colorMode || (histItem.customerFile && (histItem.customerFile.toLowerCase().includes('_color_') || histItem.customerFile.toLowerCase().includes('_colour_')) ? 'Color' : 'BlackWhite');
            const targetPrinter = printer || (jobColor === 'Color' ? 'EPSON L3110 Series' : (histItem.printerName || db.getSettings().defaultPrinter));
            
            const job = await PrintQueue.addJob({
                fileId: histItem.fileId || histItem.id,
                customerName: 'Manual Print Override',
                fileName: histItem.customerFile,
                processedPath: histItem.processedPath,
                originalPath: histItem.originalPath,
                printer: targetPrinter,
                copies: Number(copies) || 1,
                colorMode: jobColor,
                priority: 20
            });
            Logger.info('API', `Direct hardware print dispatched for ${histItem.customerFile} onto [${targetPrinter}] (${jobColor})`);
            if (autoStart) setTimeout(() => PrintQueue.processNext(), 50);
            return res.json({ success: true, job });
        }
        return res.status(404).json({ error: "Job ID not found in active queue or history." });
    }

    if (printer) item.printer = printer;
    if (copies) item.copies = Number(copies);
    if (resolvedColorMode) item.colorMode = resolvedColorMode;
    item.status = 'Pending';
    item.priority = 20;
    db.addQueueItem(item);
    Logger.info('API', `Direct hardware print updated in queue for ${item.fileName} onto [${item.printer}] (${item.colorMode || 'B&W'})`);
    if (autoStart) setTimeout(() => PrintQueue.processNext(), 50);
    res.json({ success: true, job: item });
});

// POST /api/prints/test-printer
router.post('/test-printer', async (req, res) => {
    try {
        const { printer } = req.body;
        const result = await PrinterManager.testPrinter(printer || db.getSettings().defaultPrinter);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/prints/clear-queue
router.post('/clear-queue', (req, res) => {
    PrintQueue.clearCompleted();
    res.json({ success: true, message: "Queue purged of inactive jobs." });
});

// POST queue overrides
router.post('/queue/retry', (req, res) => {
    PrintQueue.retryJob(req.body.jobId);
    res.json({ success: true });
});

router.post('/queue/cancel', (req, res) => {
    PrintQueue.cancelJob(req.body.jobId);
    res.json({ success: true });
});

router.post('/queue/priority', (req, res) => {
    PrintQueue.updatePriority(req.body.jobId, req.body.priority);
    res.json({ success: true });
});

// GET /api/prints/download/:type/:id - Secure binary serving of documents
router.get('/download/:type/:id', (req, res) => {
    const { type, id } = req.params; // type = 'original' or 'processed'
    const history = db.getHistory(500);
    const queue = db.getQueue();
    const item = history.find(i => i.id === id || i.fileId === id) || queue.find(q => q.id === id || q.fileId === id);

    if (!item) return res.status(404).send("Document reference not found in registry.");

    const filePath = type === 'original' ? item.originalPath : item.processedPath;
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send("File is no longer physically stored on disk.");
    }

    res.download(filePath, path.basename(filePath));
});

// GET /api/prints/preview/:id - Serving document previews for Customer Print Dashboard
router.get('/preview/:id', (req, res) => {
    const { id } = req.params;
    const queue = db.getQueue();
    const history = db.getHistory(500);
    const item = queue.find(q => q.id === id || q.fileId === id || q.fileName === id) || history.find(h => h.id === id || h.fileId === id || h.customerFile === id);

    if (!item || (!fs.existsSync(item.processedPath) && !fs.existsSync(item.originalPath))) {
        return res.status(404).send("Preview file unavailable.");
    }

    const fileToServe = (item.processedPath && fs.existsSync(item.processedPath)) ? item.processedPath : item.originalPath;
    res.sendFile(path.resolve(fileToServe));
});

// POST /api/prints/override-image - Interactive live manual crop, auto-crop, rotate, and brightness tuning
router.post('/override-image', async (req, res) => {
    const { jobId, rotate = 0, brightness = 1.0, contrast = 1.0, autoCrop, trimAllPct = 0, trimVerticalPct = 0, trimHorizontalPct = 0, filterType, reset } = req.body;
    const { trimTopPct = 0, trimBottomPct = 0, trimLeftPct = 0, trimRightPct = 0 } = req.body;
    const queue = db.getQueue();
    const history = db.getHistory(500);
    const item = queue.find(q => q.id === jobId || q.fileId === jobId || q.fileName === jobId) || history.find(h => h.id === jobId || h.fileId === jobId || h.customerFile === jobId);
    
    const settings = db.getSettings();
    const targetFolder = settings.whatsAppFolder || 'D:\\WhatsApp';
    
    let sourcePath = '';
    if (item) {
        const candidatePaths = [
            item.originalPath,
            item.processedPath,
            path.join(targetFolder, item.fileName || ''),
            path.join(targetFolder, path.basename(item.originalPath || '')),
            path.join(incomingDir, item.fileName || ''),
            path.join(processedDir, item.fileName || '')
        ].filter(Boolean);

        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                sourcePath = p;
                break;
            }
        }
    }

    if (!sourcePath && jobId) {
        const directCandidate = path.join(targetFolder, jobId);
        if (fs.existsSync(directCandidate)) {
            sourcePath = directCandidate;
        }
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: "Job file not found on disk." });
    }

    try {
        const baseDir = processedDir;
        const tempPath = path.join(baseDir, `docscan_${Date.now()}_${path.basename(sourcePath)}`);
        
        // Ensure source is an image format suitable for Sharp
        if (!['.png', '.jpg', '.jpeg', '.bmp', '.webp'].includes(path.extname(sourcePath).toLowerCase())) {
            return res.status(400).json({ error: "Cropping is only supported for image document files (PNG, JPG, JPEG)." });
        }

        // Read and normalize buffer to standard baseline sRGB buffer to eliminate any libvips palette/interpretation space errors
        const fileBuffer = fs.readFileSync(sourcePath);
        const sanitized = sanitizePngBuffer(fileBuffer);
        const cleanBuffer = await sharp(sanitized, { failOnError: false, ignoreIcc: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 100 })
            .toBuffer();

        const meta = await sharp(cleanBuffer, { failOnError: false, ignoreIcc: true }).metadata();
        const w = meta.width || 1000;
        const h = meta.height || 1000;
        let instance = sharp(cleanBuffer, { failOnError: false });
        let detectedBorders = null;

        if (!reset) {
            // Intelligent doc_scanner_kit AI Auto-Crop (Detects document boundaries on wooden desk/table backgrounds)
            if (autoCrop && !trimAllPct && !trimVerticalPct && !trimHorizontalPct && !trimTopPct && !trimBottomPct && !trimLeftPct && !trimRightPct) {
                try {
                    detectedBorders = await detectDocumentBorders(cleanBuffer);
                    if (detectedBorders.hasSignificantBorders) {
                        const cutLeft = Math.floor(w * (detectedBorders.leftPct / 100));
                        const cutRight = Math.floor(w * (detectedBorders.rightPct / 100));
                        const cutTop = Math.floor(h * (detectedBorders.topPct / 100));
                        const cutBottom = Math.floor(h * (detectedBorders.bottomPct / 100));

                        const extractW = Math.max(50, w - cutLeft - cutRight);
                        const extractH = Math.max(50, h - cutTop - cutBottom);

                        if (extractW > 50 && extractH > 50 && (cutLeft + extractW <= w) && (cutTop + extractH <= h)) {
                            instance = instance.extract({ left: cutLeft, top: cutTop, width: extractW, height: extractH });
                            Logger.info('DOC_SCANNER', `doc_scanner_kit AI edge detection isolated bounding box: [${extractW}x${extractH}] at (${cutLeft}, ${cutTop}) (Borders cut: T:${detectedBorders.topPct}%, B:${detectedBorders.bottomPct}%, L:${detectedBorders.leftPct}%, R:${detectedBorders.rightPct}%)`);
                        }
                    } else {
                        // Subtle fallback edge crop
                        const cutLeft = Math.floor(w * 0.02);
                        const cutTop = Math.floor(h * 0.02);
                        const extractW = Math.floor(w * 0.96);
                        const extractH = Math.floor(h * 0.96);
                        instance = instance.extract({ left: cutLeft, top: cutTop, width: extractW, height: extractH });
                        Logger.info('DOC_SCANNER', `Applied subtle fallback edge crop [${extractW}x${extractH}]`);
                    }
                } catch (errCrop) {
                    Logger.warn('DOC_SCANNER', `Auto-crop error ignored: ${errCrop.message}`);
                }
            }

            // 4-Sided Interactive doc_scanner_kit Manual Cropping
            if (trimAllPct > 0 || trimVerticalPct > 0 || trimHorizontalPct > 0 || trimTopPct > 0 || trimBottomPct > 0 || trimLeftPct > 0 || trimRightPct > 0) {
                const cutLeft = Math.floor(w * (Number(trimAllPct || trimHorizontalPct || trimLeftPct || 0) / 100));
                const cutRight = Math.floor(w * (Number(trimAllPct || trimHorizontalPct || trimRightPct || 0) / 100));
                const cutTop = Math.floor(h * (Number(trimAllPct || trimVerticalPct || trimTopPct || 0) / 100));
                const cutBottom = Math.floor(h * (Number(trimAllPct || trimVerticalPct || trimBottomPct || 0) / 100));
                
                const extractW = w - cutLeft - cutRight;
                const extractH = h - cutTop - cutBottom;
                if (extractW > 50 && extractH > 50 && (cutLeft + extractW <= w) && (cutTop + extractH <= h)) {
                    instance = instance.extract({ left: cutLeft, top: cutTop, width: extractW, height: extractH });
                    Logger.info('DOC_SCANNER', `Manual doc_scanner_kit boundary cropped to [${extractW}x${extractH}]`);
                }
            }

            if (rotate) instance = instance.rotate(Number(rotate));
            
            // doc_scanner_kit professional document scanning filter algorithms
            if (filterType === 'magic_color') {
                instance = instance.normalize().sharpen(2).modulate({ brightness: 1.08, saturation: 1.25 }).linear(1.15, -8);
                Logger.info('DOC_SCANNER', `Applied doc_scanner_kit Magic Color Boost to job [${jobId}]`);
            } else if (filterType === 'bw_scan') {
                instance = instance.greyscale().normalize().linear(1.4, -30).sharpen(1.5);
                Logger.info('DOC_SCANNER', `Applied doc_scanner_kit B/W Document Scan to job [${jobId}]`);
            } else if (filterType === 'clean_noise') {
                instance = instance.median(3).sharpen(1.2).normalize();
                Logger.info('DOC_SCANNER', `Applied doc_scanner_kit Stain & Noise Removal to job [${jobId}]`);
            } else if (filterType === 'grayscale') {
                instance = instance.greyscale().normalize().linear(1.1, -5);
                Logger.info('DOC_SCANNER', `Applied doc_scanner_kit Professional Grayscale to job [${jobId}]`);
            }

            if (brightness !== 1.0 || contrast !== 1.0) {
                instance = instance.linear(Number(contrast), -(0.05 * 255)).modulate({ brightness: Number(brightness) });
            }
        }

        const isCropped = Boolean(
            (detectedBorders && detectedBorders.hasSignificantBorders) ||
            trimAllPct > 0 || trimVerticalPct > 0 || trimHorizontalPct > 0 || trimTopPct > 0 || trimBottomPct > 0 || trimLeftPct > 0 || trimRightPct > 0
        );

        if (isCropped) {
            // Save pure cropped document so preview and print reflect exact document boundaries
            await instance
                .withMetadata({ density: 300 })
                .png({ quality: 100 })
                .toFile(tempPath);
        } else {
            // Always format and fit adjusted image onto standard 300 DPI A4 Sheet Paper canvas
            const A4_PORTRAIT_W = 2480;
            const A4_PORTRAIT_H = 3508;
            const intermediateBuffer = await instance.png().toBuffer();
            const outMeta = await sharp(intermediateBuffer).metadata();
            const isLandscape = (outMeta.width || 0) > (outMeta.height || 0);
            const targetA4Width = isLandscape ? A4_PORTRAIT_H : A4_PORTRAIT_W;
            const targetA4Height = isLandscape ? A4_PORTRAIT_W : A4_PORTRAIT_H;

            await sharp(intermediateBuffer)
                .resize({
                    width: Math.floor(targetA4Width * 0.95),
                    height: Math.floor(targetA4Height * 0.95),
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .extend({
                    top: Math.floor(targetA4Height * 0.025),
                    bottom: Math.floor(targetA4Height * 0.025),
                    left: Math.floor(targetA4Width * 0.025),
                    right: Math.floor(targetA4Width * 0.025),
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .withMetadata({ density: 300 })
                .png({ quality: 100 })
                .toFile(tempPath);
        }
        
        // Update job item references
        if (item) {
            try { if (item.processedPath && item.processedPath !== item.originalPath && fs.existsSync(item.processedPath)) fs.unlinkSync(item.processedPath); } catch(e){}
            item.processedPath = tempPath;
            item.fileName = path.basename(tempPath);
            item.status = 'Pending';
            
            if (queue.some(q => q.id === item.id || q.fileId === item.id)) {
                try { db.addQueueItem(item); } catch (e) { console.error('Queue db update error:', e); }
            }
            if (history.some(h => h.id === item.id || h.fileId === item.id)) {
                try { db.addHistoryItem(item); } catch (e) { console.error('History db update error:', e); }
            }
        }

        Logger.info('OPERATOR_DASHBOARD', `Operator applied custom image adjustments to job [${jobId}] formatted for A4 sheet`);
        res.json({ 
            success: true, 
            job: item || { id: jobId, fileName: path.basename(tempPath), processedPath: tempPath },
            borders: detectedBorders
        });
    } catch (e) {
        Logger.error('DOC_SCANNER', `Image modification failed: ${e.message}\n${e.stack}`);
        res.status(500).json({ error: `Image modification failed: ${e.message}` });
    }
});

// POST /api/prints/detect-borders - Pre-flight document boundary detection without modifying file
router.post('/detect-borders', async (req, res) => {
    const { jobId } = req.body;
    const queue = db.getQueue();
    const history = db.getHistory(500);
    const item = queue.find(q => q.id === jobId || q.fileId === jobId || q.fileName === jobId) || history.find(h => h.id === jobId || h.fileId === jobId || h.customerFile === jobId);
    
    let sourcePath = '';
    if (item) {
        const candidatePaths = [
            item.processedPath,
            item.originalPath,
            path.join(incomingDir, item.fileName || ''),
            path.join(processedDir, item.fileName || '')
        ].filter(Boolean);
        for (const p of candidatePaths) {
            if (fs.existsSync(p)) { sourcePath = p; break; }
        }
    }
    if (!sourcePath && jobId) {
        const directCandidate = path.join(incomingDir, jobId);
        if (fs.existsSync(directCandidate)) sourcePath = directCandidate;
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: "Job file not found on disk." });
    }

    try {
        const borders = await detectDocumentBorders(sourcePath);
        res.json({ success: true, borders });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/prints/delete-document - Permanently delete file from queue, history, files table and storage
router.post('/delete-document', (req, res) => {
    const { id, fileId, fileName, ids } = req.body;
    const targets = Array.isArray(ids) ? ids : [id, fileId, fileName].filter(Boolean);
    
    targets.forEach(targetId => {
        const queue = db.getQueue();
        const history = db.getHistory(500);
        const item = queue.find(q => q.id === targetId || q.fileId === targetId || q.fileName === targetId) || history.find(h => h.id === targetId || h.fileId === targetId || h.customerFile === targetId);
        if (item) {
            try { if (item.processedPath && fs.existsSync(item.processedPath)) fs.unlinkSync(item.processedPath); } catch (e) {}
            try { if (item.originalPath && fs.existsSync(item.originalPath)) fs.unlinkSync(item.originalPath); } catch (e) {}
            if (item.id) db.deleteDocumentComplete(item.id);
            if (item.fileId) db.deleteDocumentComplete(item.fileId);
            if (item.fileName) db.deleteDocumentComplete(item.fileName);
        }
        db.deleteDocumentComplete(targetId);
    });
    
    res.json({ success: true, message: "Document(s) and physical cached files permanently deleted." });
});

// POST /api/prints/delete-all - Instant 100% purge of all items from workspace and storage folders
router.post('/delete-all', (req, res) => {
    db.clearAllDocuments();
    res.json({ success: true, message: "Workspace completely purged and reset." });
});

// POST /api/prints/upload-file - Allow dragging and dropping simulated WhatsApp files into dashboard
router.post('/upload-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded." });
        
        const originalName = req.file.originalname;
        const tempPath = req.file.path;
        const targetPath = path.join(incomingDir, `${Date.now()}_${originalName}`);
        
        fs.renameSync(tempPath, targetPath);
        Logger.logFileDetection(`Manual file uploaded to cyber center dashboard: [${originalName}]`);
        
        // Trigger automated folder watcher handler directly on this file
        await FolderWatcher.handleDetectedFile(targetPath);
        
        res.json({ success: true, message: "File received and processed through engine." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/prints/upload-document - Direct Web Upload Portal (Counter QR Scan Channel)
router.post('/upload-document', (req, res) => {
    upload.any()(req, res, async (err) => {
        if (err) {
            Logger.error('WEB_PORTAL', `Multer file upload stream error: ${err.message}`);
            return res.status(500).json({ success: false, error: `Upload stream interrupted: ${err.message}` });
        }
        try {
            const allUploaded = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
            if (allUploaded.length === 0) {
                return res.status(400).json({ success: false, error: "No document files provided in request." });
            }

            // Deduplicate files by original name and size in case multiple form fields were attached
            const seenFiles = new Set();
            const rawFiles = [];
            for (const f of allUploaded) {
                const key = `${f.originalname || ''}_${f.size || 0}`;
                if (!seenFiles.has(key)) {
                    seenFiles.add(key);
                    rawFiles.push(f);
                } else {
                    if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch(e){}
                }
            }

            const copies = Math.min(Math.max(Number(req.body.copies) || 1, 1), 50);
            const rawColor = String(req.body.colorMode || '').toLowerCase();
            const colorMode = (rawColor.includes('color') || rawColor.includes('colour')) ? 'Color' : 'BlackWhite';

            // Retrieve universal automated prints drop folder (dynamically resolved)
            const targetFolder = FolderWatcher.getDropFolder();
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.doc', '.bmp', '.webp'];
            const processedOutputs = [];

            for (let i = 0; i < rawFiles.length; i++) {
                const file = rawFiles[i];
                const originalName = file.originalname || `document_${i + 1}.pdf`;
                const ext = path.extname(originalName).toLowerCase();
                
                if (!allowedExts.includes(ext)) {
                    if (fs.existsSync(file.path)) try { fs.unlinkSync(file.path); } catch(e){}
                    continue;
                }

                // Clean filename and construct standardized web upload timestamped name
                const cleanOrigName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
                const uniqueSalt = Math.random().toString(36).substring(2, 6);
                const standardizedFilename = `webupload_${Date.now() + i}_${uniqueSalt}_${copies}c_${colorMode}_${cleanOrigName}`;
                const targetPath = path.join(targetFolder, standardizedFilename);

                // Move uploaded temporary file directly into automated prints folder
                fs.copyFileSync(file.path, targetPath);
                try { fs.unlinkSync(file.path); } catch (e) {}

                Logger.info('WEB_PORTAL', `QR Counter Upload received (${i + 1}/${rawFiles.length}): [${standardizedFilename}] (${copies} Copies, ${colorMode} Mode) => Saved into [${targetFolder}].`);
                processedOutputs.push(standardizedFilename);

                // Immediately trigger automated processing and hardware printing
                FolderWatcher.handleDetectedFile(targetPath).catch(err => {
                    Logger.error('WEB_PORTAL', `Immediate auto-print trigger error for [${standardizedFilename}]: ${err.message}`);
                });
            }

            if (processedOutputs.length === 0) {
                return res.status(400).json({ success: false, error: "No valid documents (PDF, PNG, JPG, DOCX) found in upload." });
            }

            res.json({
                success: true,
                message: processedOutputs.length === 1
                    ? "Your document has been sent to the printer!"
                    : `All ${processedOutputs.length} documents have been sent to the printer!`,
                filename: processedOutputs[0],
                filenames: processedOutputs,
                fileCount: processedOutputs.length,
                copies,
                colorMode,
                destination: "prints"
            });
        } catch (error) {
            Logger.error('WEB_PORTAL', `Failed processing web document upload: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// POST /api/prints/merge-id-card - Merge 2-sided ID card (front & back) onto 1 single A4 sheet
router.post('/merge-id-card', (req, res) => {
    upload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }, { name: 'files', maxCount: 2 }])(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        try {
            let frontFile = req.files?.front?.[0] || req.files?.files?.[0];
            let backFile = req.files?.back?.[0] || req.files?.files?.[1];

            if (!frontFile || !backFile) {
                return res.status(400).json({ success: false, error: "Both Front and Back card files are required to merge onto 1 page." });
            }

            const orientation = req.body.orientation || 'vertical'; // 'vertical' (top/bottom) | 'horizontal' (side-by-side)
            const colorMode = (req.body.colorMode || 'Color').replace(/[^a-zA-Z]/g, '') || 'Color';
            const copies = Math.min(Math.max(Number(req.body.copies) || 1, 1), 50);

            const targetFolder = FolderWatcher.getDropFolder();
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            const mergedResult = await mergeIdCards(frontFile.path, backFile.path, targetFolder, {
                orientation,
                colorMode,
                enhance: true
            });

            // Clean up temporary upload files
            try { if (fs.existsSync(frontFile.path)) fs.unlinkSync(frontFile.path); } catch (e) {}
            try { if (fs.existsSync(backFile.path)) fs.unlinkSync(backFile.path); } catch (e) {}

            // Standard prefix so FolderWatcher picks it up cleanly
            const finalFilename = `webupload_${Date.now()}_${copies}c_${colorMode}_IDCard_${orientation}.png`;
            const finalPath = path.join(targetFolder, finalFilename);
            fs.renameSync(mergedResult.outputPath, finalPath);

            Logger.info('WEB_PORTAL', `Merged 2-Sided ID Card created: [${finalFilename}] (${copies} Copies, ${orientation} Layout)`);

            // Immediately trigger automated processing and hardware printing
            FolderWatcher.handleDetectedFile(finalPath).catch(err => {
                Logger.error('WEB_PORTAL', `Immediate auto-print trigger error for [${finalFilename}]: ${err.message}`);
            });

            res.json({
                success: true,
                message: "2-Sided ID Card merged onto 1 page and sent to printer!",
                filename: finalFilename,
                copies,
                colorMode,
                orientation,
                destination: "prints"
            });
        } catch (error) {
            Logger.error('WEB_PORTAL', `Failed merging 2-sided ID Card: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// GET /api/prints/email-watcher/status - Telemetry diagnostics for IMAP poller
router.get('/email-watcher/status', (req, res) => {
    res.json(EmailWatcher.getStatus());
});

// POST /api/prints/email-watcher/test - Live IMAP authentication and connection verification
router.post('/email-watcher/test', async (req, res) => {
    try {
        const result = await EmailWatcher.testConnection(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/prints/channel-diagnostics - Real-time verified multi-channel health status (Wi-Fi, 4G/5G Tunnel, Email)
router.get('/channel-diagnostics', (req, res) => {
    try {
        const ChannelHealthService = require('../../../services/watchers/channel_health_service.js');
        res.json(ChannelHealthService.getDiagnostics());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/prints/channel-diagnostics/verify-now - Force immediate diagnostic probe of all 3 channels
router.post('/channel-diagnostics/verify-now', async (req, res) => {
    try {
        const ChannelHealthService = require('../../../services/watchers/channel_health_service.js');
        const diagnostics = await ChannelHealthService.runImmediateCheck();
        res.json(diagnostics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
