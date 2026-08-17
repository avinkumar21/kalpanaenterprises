const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

// Dynamic Route Loader for Prints API
app.use('/api/prints', apiRouter);

// Serve Frontend SPA Dist Bundle
const distPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}

// Health Check Endpoint (Required for Phase 1 Vercel/Watchdog)
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
        service: "ARKA Platform V2 – Auto WhatsApp Printing & Document Processing Engine",
        status: "RUNNING_24_7",
        port: process.env.PORT || 8082,
        timestamp: new Date().toISOString()
    });
});

// Catch-all SPA router for /prints and customer upload kiosk
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/storage/')) {
        return next();
    }
    if (fs.existsSync(path.join(distPath, 'index.html'))) {
        return res.sendFile(path.join(distPath, 'index.html'));
    }
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

function monitorCloudflareTunnel() {
    const check = () => {
        try {
            const tunnelLogPath = path.resolve(__dirname, '../../logs/tunnel.log');
            if (fs.existsSync(tunnelLogPath)) {
                const content = fs.readFileSync(tunnelLogPath, 'utf8');
                const matches = content.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
                if (matches && matches.length > 0) {
                    const latestUrl = matches[matches.length - 1];
                    const currentSettings = db.getSettings();
                    if (currentSettings.publicTunnelUrl !== latestUrl) {
                        db.saveSettings({ ...currentSettings, publicTunnelUrl: latestUrl });
                        console.log(`[TUNNEL] Detected active Cloudflare HTTPS Tunnel: ${latestUrl}`);
                    }
                }
            }
        } catch (e) {
            console.error('[TUNNEL WATCHER ERROR]', e.message);
        }
    };
    check();
    setInterval(check, 4000);
}

const ChannelHealthService = require('../../services/watchers/channel_health_service.js');

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`=== ARKA Print Engine Server Booted on Port ${PORT} ===`);
    
    await PrinterManager.refreshPrintersList();
    PrintQueue.start(2500);
    FolderWatcher.start();
    EmailWatcher.start();
    ChannelHealthService.start(20000);
    monitorCloudflareTunnel();
});

// Graceful Shutdown for PM2
function handleShutdown(signal) {
    console.log(`Received shutdown signal (${signal}). Shutting down gracefully...`);
    FolderWatcher.stop();
    EmailWatcher.stop();
    PrintQueue.stop();
    ChannelHealthService.stop();
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
