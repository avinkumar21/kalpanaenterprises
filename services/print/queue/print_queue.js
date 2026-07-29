const db = require('../../../data/local_db/index.js');
const Logger = require('../../logs/logger.js');
const PrinterManager = require('../drivers/printer_manager.js');
const path = require('path');
const fs = require('fs');

let isProcessing = false;
let queueInterval = null;

const PrintQueue = {
    start(intervalMs = 2500) {
        if (queueInterval) clearInterval(queueInterval);
        Logger.info('QUEUE', `Starting asynchronous non-blocking Print Queue worker loop (${intervalMs}ms interval).`);
        queueInterval = setInterval(() => this.processNext(), intervalMs);
    },

    stop() {
        if (queueInterval) {
            clearInterval(queueInterval);
            queueInterval = null;
        }
        Logger.info('QUEUE', "Print Queue worker stopped.");
    },

    async addJob({ id, fileId, customerName, fileName, processedPath, originalPath, printer, copies = 1, priority = 1, autoStart = true }) {
        const item = {
            id: id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            fileId: fileId || `file_${Date.now()}`,
            customerName: customerName || 'WhatsApp Customer',
            fileName: fileName || path.basename(processedPath),
            processedPath,
            originalPath: originalPath || processedPath,
            printer: printer || db.getSettings().defaultPrinter || 'HP508140DE1D63(HP Laser MFP 131 133 135-138)',
            copies: Number(copies) || 1,
            status: 'Pending',
            priority: Number(priority) || 1,
            attempts: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        db.addQueueItem(item);
        Logger.info('QUEUE', `Added job [${item.id}] for file [${item.fileName}] to Print Queue (Priority: ${item.priority})`);
        
        if (autoStart) {
            setTimeout(() => this.processNext(), 100);
        }
        return item;
    },

    async processNext() {
        if (isProcessing) return;

        try {
            const allJobs = db.getQueue();
            const pendingJobs = allJobs.filter(j => j.status === 'Pending' || j.status === 'Retry');
            
            if (pendingJobs.length === 0) return;

            isProcessing = true;
            // Get highest priority job
            const job = pendingJobs[0];

            Logger.info('QUEUE', `Picking job [${job.id}] (${job.fileName}) for processing (Attempt ${job.attempts + 1}/3)...`);
            db.updateQueueStatus(job.id, 'Printing', job.attempts + 1);

            try {
                // Check if target printer is actually online before spooling
                let targetPrinter = job.printer;
                const statusCheck = await PrinterManager.testPrinter(targetPrinter);
                if (!statusCheck.success || statusCheck.status === 'OFFLINE') {
                    const settings = db.getSettings();
                    const altPrinter = targetPrinter === settings.primaryPrinter ? settings.secondaryPrinter : settings.primaryPrinter;
                    if (altPrinter && altPrinter !== targetPrinter) {
                        Logger.info('QUEUE', `Target printer [${targetPrinter}] is offline. Checking alternative [${altPrinter}]...`);
                        const altCheck = await PrinterManager.testPrinter(altPrinter);
                        if (altCheck.success && altCheck.status !== 'OFFLINE') {
                            targetPrinter = altPrinter;
                            Logger.info('QUEUE', `Auto-routing job to online printer: [${targetPrinter}]`);
                        }
                    }
                }

                // Execute print operation
                const res = await PrinterManager.printFile(job.processedPath, targetPrinter, job.copies);
                
                // Complete job
                db.updateQueueStatus(job.id, 'Completed');
                db.incrementStatistic('totalPrinted');
                Logger.info('QUEUE', `Job [${job.id}] completed successfully on printer [${res.printer}].`);

                // Archive original file to /storage/archive/
                const rootDir = path.resolve(__dirname, '../../');
                const archiveDir = path.join(rootDir, 'storage', 'archive');
                if (job.originalPath && fs.existsSync(job.originalPath) && job.originalPath !== job.processedPath) {
                    const archPath = path.join(archiveDir, path.basename(job.originalPath));
                    try {
                        fs.renameSync(job.originalPath, archPath);
                        job.originalPath = archPath;
                    } catch (e) {
                        try { fs.copyFileSync(job.originalPath, archPath); } catch(ex){}
                    }
                }

                // Add to history
                db.addHistoryItem({
                    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    fileId: job.fileId,
                    customerFile: job.fileName,
                    originalPath: job.originalPath,
                    processedPath: job.processedPath,
                    pages: 1,
                    printerName: res.printer,
                    printTime: new Date().toISOString(),
                    status: 'Success',
                    copies: job.copies,
                    retryCount: job.attempts
                });

            } catch (printErr) {
                Logger.error('QUEUE', `Job [${job.id}] failed during print execution: ${printErr.message}`);
                
                const newAttempts = (job.attempts || 0) + 1;
                if (newAttempts < 3) {
                    Logger.logRetry(`Requeuing job [${job.id}] for Retry (${newAttempts}/3 attempts spent).`);
                    db.updateQueueStatus(job.id, 'Retry', newAttempts);
                } else {
                    Logger.error('QUEUE', `Job [${job.id}] exceeded maximum retries (3 attempts). Moving to Failed status and folder.`);
                    db.updateQueueStatus(job.id, 'Failed', newAttempts);
                    db.incrementStatistic('totalFailed');

                    // Move file to /storage/failed/
                    const rootDir = path.resolve(__dirname, '../../');
                    const failedDir = path.join(rootDir, 'storage', 'failed');
                    if (fs.existsSync(job.processedPath)) {
                        const failedPath = path.join(failedDir, path.basename(job.processedPath));
                        try { fs.copyFileSync(job.processedPath, failedPath); } catch (e) {}
                    }

                    // Add failed entry to history
                    db.addHistoryItem({
                        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        fileId: job.fileId,
                        customerFile: job.fileName,
                        originalPath: job.originalPath,
                        processedPath: job.processedPath,
                        pages: 1,
                        printerName: job.printer || 'Unknown',
                        printTime: new Date().toISOString(),
                        status: 'Failed',
                        copies: job.copies,
                        retryCount: newAttempts
                    });
                }
            }
        } catch (e) {
            Logger.error('QUEUE', `Unexpected error in queue loop: ${e.message}`);
        } finally {
            isProcessing = false;
        }
    },

    retryJob(jobId) {
        Logger.info('QUEUE', `Manual retry triggered for job [${jobId}]`);
        db.updateQueueStatus(jobId, 'Pending', 0);
        setTimeout(() => this.processNext(), 100);
    },

    cancelJob(jobId) {
        Logger.info('QUEUE', `Job [${jobId}] cancelled by operator.`);
        db.updateQueueStatus(jobId, 'Cancelled');
    },

    updatePriority(jobId, newPriority) {
        const queue = db.getQueue();
        const item = queue.find(j => j.id === jobId);
        if (item) {
            item.priority = Number(newPriority);
            db.addQueueItem(item);
            Logger.info('QUEUE', `Updated priority of job [${jobId}] to ${newPriority}.`);
        }
    },

    clearCompleted() {
        db.clearCompletedQueue();
        Logger.info('QUEUE', "Cleared completed, cancelled, and failed jobs from queue.");
    }
};

module.exports = PrintQueue;
