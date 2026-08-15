const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const db = require('../../../data/local_db/index.js');
const Logger = { info: console.log, error: console.error, warn: console.warn };
const PrinterManager = require('../../../services/print/drivers/printer_manager.js');
const PrintQueue = require('../../../services/print/queue/print_queue.js');
const FolderWatcher = require('../../../services/watchers/folder_watcher.js');
const EmailWatcher = require('../../../services/watchers/email_watcher.js');
const { processDocument } = require('../../../services/image_processor/index.js');

const router = express.Router();

const rootDir = path.resolve(__dirname, '../../');
const incomingDir = path.join(rootDir, 'storage', 'incoming');
const processedDir = path.join(rootDir, 'storage', 'processed');
const upload = multer({ dest: incomingDir });

// GET /api/prints/status - Comprehensive operational health diagnostics
router.get('/status', async (req, res) => {
    try {
        const watcherStatus = FolderWatcher.getStatus();
        const queue = db.getQueue();
        const stats = db.getStatistics();
        const todayStat = stats[0] || { totalReceived: 0, totalProcessed: 0, totalPrinted: 0, totalFailed: 0 };
        const history = db.getHistory(5);
        const printers = db.getPrinters();

        const pendingJobs = queue.filter(j => j.status === 'Pending' || j.status === 'Retry').length;
        const printingJobs = queue.filter(j => j.status === 'Printing').length;

        res.json({
            status: 'ONLINE',
            serviceName: 'ARKA Print Service (24x7 Continuous Engine)',
            timestamp: new Date().toISOString(),
            publicTunnelUrl: db.getSettings().publicTunnelUrl || '',
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
        const [epsonRes, hpRes] = await Promise.all([
            PrinterManager.testPrinter(epsonName),
            PrinterManager.testPrinter(hpName)
        ]);

        const result = {
            [epsonName]: epsonRes.status === 'ONLINE' ? 'Online' : 'Offline',
            [hpName]: hpRes.status === 'ONLINE' ? 'Online' : 'Offline',
            timestamp: new Date().toISOString()
        };

        res.json(result);
    } catch (error) {
        res.json({
            [epsonName]: 'Offline',
            [hpName]: 'Offline',
            timestamp: new Date().toISOString(),
            error: error.message
        });
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
    const { jobId, printer, copies = 1, autoStart = true } = req.body;
    const queue = db.getQueue();
    const history = db.getHistory(500);
    let item = queue.find(j => j.id === jobId || j.fileId === jobId || j.fileName === jobId);
    
    if (!item) {
        const histItem = history.find(h => h.id === jobId || h.fileId === jobId || h.customerFile === jobId);
        if (histItem && (fs.existsSync(histItem.processedPath) || fs.existsSync(histItem.originalPath))) {
            const job = await PrintQueue.addJob({
                fileId: histItem.fileId || histItem.id,
                customerName: 'Manual Print Override',
                fileName: histItem.customerFile,
                processedPath: histItem.processedPath,
                originalPath: histItem.originalPath,
                printer: printer || histItem.printerName || db.getSettings().defaultPrinter,
                copies: Number(copies) || 1,
                priority: 20
            });
            Logger.info('API', `Direct hardware print dispatched for ${histItem.customerFile} onto [${printer || histItem.printerName}]`);
            if (autoStart) setTimeout(() => PrintQueue.processNext(), 50);
            return res.json({ success: true, job });
        }
        return res.status(404).json({ error: "Job ID not found in active queue or history." });
    }

    if (printer) item.printer = printer;
    if (copies) item.copies = Number(copies);
    item.status = 'Pending';
    item.priority = 20;
    db.addQueueItem(item);
    Logger.info('API', `Direct hardware print updated in queue for ${item.fileName} onto [${printer}]`);
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
    const item = queue.find(q => q.id === jobId || q.fileId === jobId) || history.find(h => h.id === jobId || h.fileId === jobId);
    if (!item || (!fs.existsSync(item.processedPath) && !fs.existsSync(item.originalPath))) {
        return res.status(404).json({ error: "Job file not found on disk." });
    }

    try {
        const baseDir = item.processedPath ? path.dirname(item.processedPath) : path.resolve(__dirname, '../../storage/processed');
        // Always start from originalPath whenever cropping, auto-cropping, resetting, or altering filters so we never attempt to crop an already-padded A4 white canvas!
        const useOriginal = reset || autoCrop || trimAllPct > 0 || trimVerticalPct > 0 || trimHorizontalPct > 0 || trimTopPct > 0 || trimBottomPct > 0 || trimLeftPct > 0 || trimRightPct > 0 || filterType || !item.processedPath || !fs.existsSync(item.processedPath);
        const sourcePath = useOriginal ? item.originalPath : item.processedPath;
        const tempPath = path.join(baseDir, `docscan_${Date.now()}_${path.basename(sourcePath)}`);
        
        // Ensure source is an image format suitable for Sharp
        if (!['.png', '.jpg', '.jpeg', '.bmp', '.webp'].includes(path.extname(sourcePath).toLowerCase())) {
            return res.status(400).json({ error: "Cropping is only supported for image document files (PNG, JPG, JPEG)." });
        }

        // Get image metadata cleanly before altering pipeline
        const meta = await sharp(sourcePath).metadata();
        const w = meta.width || 1000;
        const h = meta.height || 1000;
        let instance = sharp(sourcePath);
        
        if (!reset) {
            // Intelligent doc_scanner_kit AI Auto-Crop (Detects document boundaries on wooden desk/table backgrounds)
            if (autoCrop && !trimAllPct && !trimVerticalPct && !trimHorizontalPct && !trimTopPct && !trimBottomPct && !trimLeftPct && !trimRightPct) {
                try {
                    // Downsample to 200x200 raw greyscale buffer for precise row/column edge luminance segmentation
                    const thumb = await sharp(sourcePath).resize(200, 200, { fit: 'fill' }).greyscale().raw().toBuffer();
                    
                    // Calculate reference brightness of top, bottom, left, and right tabletop borders
                    let topBg = 0, bottomBg = 0, leftBg = 0, rightBg = 0;
                    for (let x = 0; x < 200; x++) {
                        topBg += thumb[x];
                        bottomBg += thumb[199 * 200 + x];
                    }
                    topBg /= 200; bottomBg /= 200;
                    for (let y = 0; y < 200; y++) {
                        leftBg += thumb[y * 200];
                        rightBg += thumb[y * 200 + 199];
                    }
                    leftBg /= 200; rightBg /= 200;
                    
                    // Scan inwards to locate actual paper document boundaries (Aadhar card, PAN, tax receipt)
                    let startY = 0, endY = 200, startX = 0, endX = 200;
                    for (let y = 0; y < 90; y++) {
                        let diffCount = 0;
                        for (let x = 10; x < 190; x++) {
                            const val = thumb[y * 200 + x];
                            if (Math.abs(val - topBg) > 16 || val > 175) diffCount++;
                        }
                        if (diffCount > 18) { startY = y; break; }
                    }
                    for (let y = 199; y > 110; y--) {
                        let diffCount = 0;
                        for (let x = 10; x < 190; x++) {
                            const val = thumb[y * 200 + x];
                            if (Math.abs(val - bottomBg) > 16 || val > 175) diffCount++;
                        }
                        if (diffCount > 18) { endY = y; break; }
                    }
                    for (let x = 0; x < 90; x++) {
                        let diffCount = 0;
                        for (let y = 10; y < 190; y++) {
                            const val = thumb[y * 200 + x];
                            if (Math.abs(val - leftBg) > 16 || val > 175) diffCount++;
                        }
                        if (diffCount > 18) { startX = x; break; }
                    }
                    for (let x = 199; x > 110; x--) {
                        let diffCount = 0;
                        for (let y = 10; y < 190; y++) {
                            const val = thumb[y * 200 + x];
                            if (Math.abs(val - rightBg) > 16 || val > 175) diffCount++;
                        }
                        if (diffCount > 18) { endX = x; break; }
                    }

                    const docW = endX - startX;
                    const docH = endY - startY;
                    if (docW > 30 && docH > 30 && (startX > 2 || startY > 2 || endX < 198 || endY < 198)) {
                        const leftPct = Math.max(0, (startX - 2)) / 200;
                        const topPct = Math.max(0, (startY - 2)) / 200;
                        const widthPct = Math.min(1 - leftPct, (docW + 4) / 200);
                        const heightPct = Math.min(1 - topPct, (docH + 4) / 200);
                        
                        const extLeft = Math.floor(w * leftPct);
                        const extTop = Math.floor(h * topPct);
                        const extW = Math.floor(w * widthPct);
                        const extH = Math.floor(h * heightPct);
                        if (extW > 100 && extH > 100 && (extLeft + extW <= w) && (extTop + extH <= h)) {
                            instance = instance.extract({ left: extLeft, top: extTop, width: extW, height: extH });
                            Logger.info('DOC_SCANNER', `doc_scanner_kit AI edge detection isolated bounding box: [${extW}x${extH}] at (${extLeft}, ${extTop})`);
                        }
                    } else {
                        // Fallback auto-crop: slice 4% off all edges to remove tabletop slivers if contrast gradient is subtle
                        const extLeft = Math.floor(w * 0.04);
                        const extTop = Math.floor(h * 0.04);
                        const extW = Math.floor(w * 0.92);
                        const extH = Math.floor(h * 0.92);
                        instance = instance.extract({ left: extLeft, top: extTop, width: extW, height: extH });
                        Logger.info('DOC_SCANNER', `Applied clean fallback edge crop [${extW}x${extH}]`);
                    }
                } catch (errCrop) {
                    try { instance = instance.trim({ threshold: 35 }); } catch (e) {}
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
            
            // pub.dev doc_scanner_kit professional document scanning filter algorithms
            if (filterType === 'magic_color') {
                // Whitens muddy background, enhances text sharpness and vibrancy
                instance = instance.normalize().sharpen(2).modulate({ brightness: 1.08, saturation: 1.3 }).linear(1.15, -8);
                Logger.info('DOC_SCANNER', `Applied doc_scanner_kit Magic Color Boost to job [${jobId}]`);
            } else if (filterType === 'bw_scan') {
                // High contrast pure B/W threshold scan (removes all desk wood grain and lighting shadows)
                instance = instance.greyscale().normalize().linear(1.5, -35).sharpen(1.5);
                Logger.info('DOC_SCANNER', `Applied doc_scanner_kit B/W Document Scan to job [${jobId}]`);
            } else if (filterType === 'clean_noise') {
                // Stain, fingerprint shadow, and sensor blemish cleaner
                instance = instance.median(3).sharpen(1.2).normalize();
                Logger.info('DOC_SCANNER', `Applied doc_scanner_kit Stain & Noise Removal to job [${jobId}]`);
            } else if (filterType === 'grayscale') {
                // Professional smooth leveled grayscale
                instance = instance.greyscale().normalize().linear(1.1, -5);
                Logger.info('DOC_SCANNER', `Applied doc_scanner_kit Professional Grayscale to job [${jobId}]`);
            }

            if (brightness !== 1.0 || contrast !== 1.0) {
                instance = instance.linear(Number(contrast), -(0.05 * 255)).modulate({ brightness: Number(brightness) });
            }
        }

        await instance.png({ quality: 100 }).toFile(tempPath);
        
        // Replace old processed file if it wasn't the original scan
        try { if (item.processedPath && item.processedPath !== item.originalPath && fs.existsSync(item.processedPath)) fs.unlinkSync(item.processedPath); } catch(e){}
        item.processedPath = tempPath;
        item.fileName = path.basename(tempPath);
        item.status = 'Pending';
        
        // Save back into active queue or history cleanly without schema mismatch errors
        if (queue.some(q => q.id === item.id || q.fileId === item.id)) {
            try { db.addQueueItem(item); } catch (e) { console.error('Queue db update error:', e); }
        }
        if (history.some(h => h.id === item.id || h.fileId === item.id)) {
            try { db.addHistoryItem(item); } catch (e) { console.error('History db update error:', e); }
        }

        Logger.info('OPERATOR_DASHBOARD', `Operator applied custom image adjustments (crop/rotate/reset) to job [${jobId}]`);
        res.json({ success: true, job: item });
    } catch (e) {
        res.status(500).json({ error: `Image modification failed: ${e.message}` });
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
            const file = (req.files && req.files[0]) || req.file;
            if (!file) {
                return res.status(400).json({ success: false, error: "No document file provided in request." });
            }

            const originalName = file.originalname || 'document.pdf';
            const ext = path.extname(originalName).toLowerCase();
            const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.doc', '.bmp'];
            
            if (!allowedExts.includes(ext)) {
                if (fs.existsSync(file.path)) try { fs.unlinkSync(file.path); } catch(e){}
                return res.status(400).json({ success: false, error: `Invalid file format (${ext}). Supported types: PDF, PNG, JPG, JPEG, DOCX.` });
            }

            const copies = Math.min(Math.max(Number(req.body.copies) || 1, 1), 50);
            const colorMode = (req.body.colorMode || 'Color').replace(/[^a-zA-Z]/g, '') || 'Color';

            // Retrieve system target folder (D:\WhatsApp or custom setting)
            const settings = db.getSettings();
            const targetFolder = settings.whatsAppFolder || 'D:\\WhatsApp';
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder, { recursive: true });
            }

            // Clean filename and construct standardized web upload timestamped name
            const cleanOrigName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const standardizedFilename = `webupload_${Date.now()}_${copies}c_${colorMode}_${cleanOrigName}`;
            const targetPath = path.join(targetFolder, standardizedFilename);

            // Move uploaded temporary file directly into watched WhatsApp folder
            fs.copyFileSync(file.path, targetPath);
            try { fs.unlinkSync(file.path); } catch (e) {}

            Logger.info('WEB_PORTAL', `QR Counter Upload received: [${standardizedFilename}] (${copies} Copies, ${colorMode} Mode) => Saved directly into [${targetFolder}].`);
            
            res.json({
                success: true,
                message: "Your document has been sent to the print station!",
                filename: standardizedFilename,
                copies,
                colorMode,
                destination: targetFolder
            });
        } catch (error) {
            Logger.error('WEB_PORTAL', `Failed processing web document upload: ${error.message}`);
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

module.exports = router;
