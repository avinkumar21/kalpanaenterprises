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

const multer = require('multer');

const app = express();

// Private Network Access & CORS Headers (allows HTTPS web app to call http://localhost:5000 without mixed-content blocks)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const rootDir = path.resolve(__dirname, '../../');
const incomingDir = path.join(rootDir, 'storage', 'incoming');
if (!fs.existsSync(incomingDir)) fs.mkdirSync(incomingDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, incomingDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '') || '.pdf';
        const cleanName = path.basename(file.originalname || 'document', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${Date.now()}_${cleanName}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Health & Ping Endpoints for Desktop Daemon Detection
app.get(['/health', '/ping'], (req, res) => {
    res.json({
        status: 'ONLINE',
        service: 'ARKA Local Print Service Daemon',
        version: '2.5.0',
        port: 5000,
        desktop: true,
        hpWifiIp: PrinterManager.HP_WIFI_IP || '192.168.31.2',
        timestamp: new Date().toISOString()
    });
});

// REST API Endpoint: POST /print (Requirement 2)
// Exposes http://localhost:5000/print for the web app to send print jobs directly
app.post('/print', upload.single('file'), async (req, res) => {
    try {
        let filePath = '';
        let originalName = '';

        if (req.file) {
            filePath = req.file.path;
            originalName = req.file.originalname;
        } else if (req.body.filePath && fs.existsSync(req.body.filePath)) {
            filePath = req.body.filePath;
            originalName = path.basename(filePath);
        } else if (req.body.base64) {
            const cleanBase64 = req.body.base64.replace(/^data:.*?;base64,/, '');
            const buf = Buffer.from(cleanBase64, 'base64');
            originalName = req.body.filename || `job_${Date.now()}.pdf`;
            filePath = path.join(incomingDir, `${Date.now()}_${originalName}`);
            fs.writeFileSync(filePath, buf);
        } else {
            return res.status(400).json({ success: false, error: 'No print file or data provided. Send a multipart file or base64/filePath JSON.' });
        }

        const copies = Math.max(1, parseInt(req.body.copies) || 1);
        const colorMode = (req.body.colorMode || 'Black & White').toLowerCase().includes('color') ? 'Color' : 'BlackWhite';
        const requestedPrinter = req.body.printer || null;

        // Auto-detect routing based on user specifications:
        // - Epson printer: Always connected via USB -> bind directly to Windows spooler
        // - HP printer: Configure static IP on ARKA Wi-Fi. Before sending a job, ping the printer IP to confirm connectivity. If unreachable, fallback to USB cable connection.
        const defaultTarget = colorMode === 'Color' ? 'EPSON L3110 Series' : 'HP Laser MFP 131 133 135-138';
        const resolvedPrinter = (await PrinterManager.resolveActivePrinter(requestedPrinter, { colorMode })) || defaultTarget;
        const connectionUsed = resolvedPrinter && resolvedPrinter.includes('(Wi-Fi)') ? 'Wi-Fi (192.168.31.2)' : 'USB (Direct Spooler)';

        console.log(`[DAEMON /print] Received job: [${originalName}] => Routed to: [${resolvedPrinter}] (${copies} copies, Mode: ${colorMode}, Conn: ${connectionUsed})`);

        await PrinterManager.printFile(filePath, resolvedPrinter, copies, { colorMode });

        res.json({
            success: true,
            jobId: `job_${Date.now()}`,
            filename: originalName,
            printer: resolvedPrinter,
            connection: connectionUsed,
            copies,
            colorMode,
            status: 'Printed',
            message: `Document successfully dispatched to physical printer [${resolvedPrinter}] via ${connectionUsed}.`
        });
    } catch (err) {
        console.error(`[DAEMON /print ERROR] ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/print', async (req, res) => {
    const printers = await PrinterManager.refreshPrintersList();
    res.json({
        service: 'ARKA Local Print Service Daemon',
        status: 'ONLINE',
        endpoint: 'POST http://localhost:5000/print',
        description: 'REST API for Web App direct local desktop printing',
        printers
    });
});

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
        port: 5000,
        secondaryPort: 8082,
        timestamp: new Date().toISOString()
    });
});

// Catch-all SPA router for /prints and customer upload kiosk
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/storage/') || req.path === '/print') {
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

const PORT = 5000;
const SECONDARY_PORT = 8082;

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

function ensureCloudflareTunnel() {
    const tunnelScript = path.resolve(__dirname, '../../tools/tunnel_manager.js');
    if (!fs.existsSync(tunnelScript)) return;

    const { exec } = require('child_process');
    exec('tasklist /FI "IMAGENAME eq cloudflared.exe"', (err, stdout) => {
        if (!stdout || !stdout.includes('cloudflared.exe')) {
            console.log('[SERVER] Booting integrated Cloudflare 4G/5G Tunnel Manager...');
            try {
                const child = require('child_process').spawn('node.exe', [tunnelScript], {
                    detached: false,
                    stdio: 'inherit'
                });
                child.unref();
            } catch (e) {
                console.error('[SERVER] Failed to spawn tunnel manager:', e.message);
            }
        } else {
            console.log('[SERVER] Cloudflare Tunnel is already running in background.');
        }
    });
}

const ChannelHealthService = require('../../services/watchers/channel_health_service.js');

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`=== ARKA Local Print Service Daemon Booted on Port ${PORT} (REST API: http://localhost:5000/print) ===`);
    
    // Also bind Port 8082 for existing services & backwards compatibility
    try {
        app.listen(SECONDARY_PORT, '0.0.0.0', () => {
            console.log(`=== ARKA Secondary Port ${SECONDARY_PORT} Active for backwards compatibility ===`);
        });
    } catch (e) {
        console.warn(`Could not bind secondary port ${SECONDARY_PORT}: ${e.message}`);
    }

    await PrinterManager.refreshPrintersList();
    PrintQueue.start(2500);
    FolderWatcher.start();
    EmailWatcher.start();
    ChannelHealthService.start(20000);
    monitorCloudflareTunnel();
    ensureCloudflareTunnel();
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
