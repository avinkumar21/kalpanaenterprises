const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../database/index.js');
const Logger = require('../logs/logger');
const { processDocument } = require('../image_processor/index.js');
const PrintQueue = require('../print/queue/print_queue.js');

let watcherInstance = null;
let pollInterval = null;
const seenHashes = new Set();
const processedFiles = new Set();

const IGNORE_EXTS = ['.tmp', '.crontab', '.crontmp', '.part', '.download', '.swp', '.temp'];

function calculateFileHash(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (e) {
        return null;
    }
}

function isFileReady(filePath) {
    try {
        const stat1 = fs.statSync(filePath);
        if (stat1.size === 0) return false; // partial or zero-byte file
        
        // Attempt opening file read/write to check lock
        const fd = fs.openSync(filePath, 'r');
        fs.closeSync(fd);
        return true;
    } catch (e) {
        return false; // locked by downloading browser or process
    }
}

function getUniversalPrintsFolder() {
    const settings = db.getSettings();

    // 1. If explicit custom folder in settings is specified and valid (not old hardcoded D:\WhatsApp default), use it
    if (settings.whatsAppFolder && settings.whatsAppFolder.trim() && !settings.whatsAppFolder.includes('D:\\WhatsApp') && !settings.whatsAppFolder.includes('D:\\whatspp')) {
        try {
            if (!fs.existsSync(settings.whatsAppFolder)) {
                fs.mkdirSync(settings.whatsAppFolder, { recursive: true });
            }
            return settings.whatsAppFolder;
        } catch (e) {}
    }

    // 2. Project workspace root /prints (e.g. d:\Arka\prints)
    const projectPrintsDir = path.resolve(__dirname, '../../prints');
    try {
        if (!fs.existsSync(projectPrintsDir)) {
            fs.mkdirSync(projectPrintsDir, { recursive: true });
        }
        return projectPrintsDir;
    } catch (e) {}

    // 3. User Home directory / prints (e.g. C:\Users\<Username>\prints)
    const os = require('os');
    const userPrintsDir = path.join(os.homedir(), 'prints');
    try {
        if (!fs.existsSync(userPrintsDir)) {
            fs.mkdirSync(userPrintsDir, { recursive: true });
        }
        return userPrintsDir;
    } catch (e) {}

    // 4. Fallback storage/prints
    const storageDir = path.resolve(__dirname, '../../storage', 'prints');
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    return storageDir;
}

const FolderWatcher = {
    getDropFolder() {
        return getUniversalPrintsFolder();
    },

    start() {
        this.stop();
        const targetFolder = getUniversalPrintsFolder();

        // Ensure target folder exists
        if (!fs.existsSync(targetFolder)) {
            try {
                fs.mkdirSync(targetFolder, { recursive: true });
                Logger.logFolderEvent(`Created automated print drop folder: ${targetFolder}`);
            } catch (e) {
                Logger.warn('WATCHER', `Could not create folder [${targetFolder}]: ${e.message}`);
            }
        }

        // List of all folders to watch (Universal prints folder + optional legacy D:\WhatsApp if present)
        const foldersToWatch = [targetFolder];
        if (fs.existsSync('D:\\WhatsApp') && !foldersToWatch.includes('D:\\WhatsApp')) {
            foldersToWatch.push('D:\\WhatsApp');
        }

        // Seed existing files currently in watched folders so they remain visible without re-printing on reboot
        foldersToWatch.forEach(folder => {
            try {
                if (fs.existsSync(folder)) {
                    fs.readdirSync(folder).forEach(file => {
                        const fp = path.join(folder, file);
                        if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
                            processedFiles.add(fp);
                        }
                    });
                }
            } catch (e) {}
        });

        const settings = db.getSettings();
        const intervalMs = settings.pollingIntervalMs || 2000;
        Logger.info('WATCHER', `Starting Dual-Layer Folder Watcher on [${targetFolder}] (fs.watch + ${intervalMs}ms polling backup)`);

        // Layer 1: fs.watch event driver on all active folders
        try {
            watcherInstance = fs.watch(targetFolder, { persistent: true }, (eventType, filename) => {
                if (filename) {
                    const fullPath = path.join(targetFolder, filename);
                    if (fs.existsSync(fullPath)) {
                        this.handleDetectedFile(fullPath);
                    }
                }
            });
            watcherInstance.on('error', (err) => Logger.error('WATCHER', `fs.watch warning: ${err.message}`));
        } catch (watchErr) {
            Logger.warn('WATCHER', `fs.watch initialization error (${watchErr.message}), relying on polling loop.`);
        }

        // Layer 2: Polling backup loop for all watched directories
        pollInterval = setInterval(() => {
            foldersToWatch.forEach(folder => {
                try {
                    if (fs.existsSync(folder)) {
                        const files = fs.readdirSync(folder);
                        files.forEach(file => {
                            const fp = path.join(folder, file);
                            if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
                                this.handleDetectedFile(fp);
                            }
                        });
                    }
                } catch (pollErr) {
                    // Suppress temporary locked directory warnings
                }
            });
        }, intervalMs);
    },

    stop() {
        if (watcherInstance) {
            watcherInstance.close();
            watcherInstance = null;
        }
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        Logger.info('WATCHER', "Folder Watcher shut down gracefully.");
    },

    async handleDetectedFile(filePath) {
        const fileName = path.basename(filePath);
        if (processedFiles.has(filePath)) return;

        const ext = path.extname(filePath).toLowerCase();
        if (IGNORE_EXTS.includes(ext)) return;

        if (!isFileReady(filePath)) {
            // File is still being transmitted/downloaded by WhatsApp Web
            return;
        }

        // Deduplication hash check with 30-second TTL to allow customers to re-print same file later
        const hash = calculateFileHash(filePath);
        if (hash && seenHashes.has(hash)) {
            return;
        }
        if (hash) {
            seenHashes.add(hash);
            setTimeout(() => seenHashes.delete(hash), 30000);
        }
        processedFiles.add(filePath);

        Logger.logFileDetection(`New completed file download detected in WhatsApp folder: [${fileName}]`);
        db.incrementStatistic('totalReceived');

        try {
            const rootDir = path.resolve(__dirname, '../../');
            const incomingDir = path.join(rootDir, 'storage', 'incoming');
            const processedDir = path.join(rootDir, 'storage', 'processed');
            
            // Step 1: Stage to incoming via copy so the original stays visible in D:\WhatsApp for shop review!
            const stagedPath = path.join(incomingDir, `${Date.now()}_${fileName}`);
            try {
                fs.copyFileSync(filePath, stagedPath);
            } catch (e) {
                Logger.error('WATCHER', `Failed to copy file to staging directory: ${e.message}`);
                return;
            }

            // Step 2: Enhance & process document (Default to Black & White)
            const isExplicitColor = fileName.toLowerCase().includes('_color_') || fileName.toLowerCase().includes('_colour_');
            const colorMode = isExplicitColor ? 'Color' : 'BlackWhite';

            const settings = db.getSettings();
            const processRes = await processDocument(stagedPath, processedDir, {
                enhancementLevel: settings.imageEnhancementLevel || 'Moderate',
                autoCrop: settings.enableEnhancement !== false,
                enableOCR: settings.enableOCR === true,
                colorMode: colorMode
            });

            db.incrementStatistic('totalProcessed');
            Logger.info('WATCHER', `Successfully processed [${fileName}] ➔ Printable copy ready at [${processRes.outputFileName}]`);

            // Step 3: Queue or await Operator override in Customer Print Dashboard
            const isAutoPrint = settings.enableAutoPrint !== false;
            const targetPrinter = isExplicitColor ? 'EPSON L3110 Series' : (settings.defaultPrinter || 'HP Laser MFP 131 133 135-138');
            await PrintQueue.addJob({
                fileId: `doc_${Date.now()}`,
                customerName: 'Customer Print',
                fileName: fileName,
                processedPath: processRes.outputPath,
                originalPath: stagedPath,
                printer: targetPrinter,
                copies: Number(settings.copies) || 1,
                colorMode: colorMode,
                priority: 1,
                autoStart: isAutoPrint
            });

            // Safety-net: schedule extra processNext() calls in case the first one from addJob
            // found isProcessing=true (another job was mid-spool). This ensures the new job
            // gets picked up within seconds rather than waiting for the next 2.5s queue interval.
            if (isAutoPrint) {
                setTimeout(() => PrintQueue.processNext(), 2000);
                setTimeout(() => PrintQueue.processNext(), 5000);
            }

            Logger.info('WATCHER', `Job queued cleanly for [${fileName}]. Auto-Print status: ${isAutoPrint}`);

        } catch (error) {
            Logger.error('WATCHER', `Error processing detected file [${fileName}]: ${error.message}`);
            db.incrementStatistic('totalFailed');
            processedFiles.delete(filePath); // allow retry if fixed
        }
    },

    getStatus() {
        const settings = db.getSettings();
        const targetFolder = getUniversalPrintsFolder();
        return {
            active: watcherInstance !== null || pollInterval !== null,
            targetFolder,
            folderExists: fs.existsSync(targetFolder),
            pollingIntervalMs: settings.pollingIntervalMs || 2000,
            filesReceivedSession: seenHashes.size
        };
    }
};

module.exports = FolderWatcher;
module.exports.getUniversalPrintsFolder = getUniversalPrintsFolder;
