const express = require('express');
const cors = require('cors');
const path = require('path');
const corsOptions = require('../../configs/cors.config.js');

// Assuming services and data are mapped via path.resolve for safety
// In a full migration, we would import these like:
const db = require('../../data/local_db/index.js');
const PrinterManager = require('../../services/print/drivers/printer_manager.js');
const PrintQueue = require('../../services/print/queue/print_queue.js');
const FolderWatcher = require('../../services/watchers/folder_watcher.js');
const EmailWatcher = require('../../services/watchers/email_watcher.js');
const apiRouter = require('./routes/print.routes.js');

const app = express();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic Route Loader Placeholder (Assuming routes are moved)
app.use('/api/prints', apiRouter);
app.use('/prints', apiRouter);

// Health Check Endpoint (Required for Phase 1 Vercel/Watchdog)
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
        service: "ARKA Platform V2 – Auto WhatsApp Printing & Document Processing Engine",
        status: "RUNNING_24_7",
        port: process.env.PORT || 8082,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.redirect('/api/v1/health');
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 8082;

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`=== ARKA Print Engine Server Booted on Port ${PORT} ===`);
    
    // In production after migration, start the background workers here:
    await PrinterManager.refreshPrintersList();
    PrintQueue.start(2500);
    FolderWatcher.start();
    EmailWatcher.start();
});

// Graceful Shutdown for PM2
function handleShutdown(signal) {
    console.log(`Received shutdown signal (${signal}). Shutting down gracefully...`);
    FolderWatcher.stop();
    EmailWatcher.stop();
    PrintQueue.stop();
    server.close(() => {
        console.log("ARKA Print Engine Server terminated safely.");
        process.exit(0);
    });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
    console.error(`[CRITICAL] Uncaught Exception: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason) => {
    console.error(`[CRITICAL] Unhandled Promise Rejection: ${reason}`);
});
