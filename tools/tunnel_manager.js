const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('../data/local_db/index.js');

const root = path.resolve(__dirname, '../');
const logsDir = path.join(root, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'tunnel.log');

const cloudflaredPath = fs.existsSync('C:\\Program Files (x86)\\cloudflared\\cloudflared.exe') 
    ? 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe' 
    : 'cloudflared';

let isShuttingDown = false;

function startTunnel() {
    if (isShuttingDown) return;

    fs.writeFileSync(logFile, '');
    const stream = fs.createWriteStream(logFile, { flags: 'a' });

    console.log(`[TUNNEL] Launching Cloudflare Express Tunnel targeting http://127.0.0.1:8082...`);

    const child = spawn(cloudflaredPath, ['tunnel', '--protocol', 'http2', '--url', 'http://127.0.0.1:8082'], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    function handleOutput(chunk) {
        const text = chunk.toString();
        process.stdout.write(text);
        stream.write(text);

        // Extract trycloudflare URL if present
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
            const tunnelUrl = match[0];
            console.log(`[TUNNEL] Active Public Relay URL detected: ${tunnelUrl}`);
            try {
                db.saveSettings({ publicTunnelUrl: tunnelUrl });
                console.log(`[TUNNEL] Saved active tunnel URL into local system configuration.`);
            } catch (e) {
                console.error(`[TUNNEL] Failed to save tunnel URL:`, e.message);
            }
        }
    }

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);

    child.on('exit', (code) => {
        console.log(`[TUNNEL] Process exited with code ${code}. Restarting in 3 seconds...`);
        if (!isShuttingDown) {
            setTimeout(startTunnel, 3000);
        }
    });

    child.on('error', (err) => {
        console.error(`[TUNNEL] Process error:`, err.message);
        if (!isShuttingDown) {
            setTimeout(startTunnel, 3000);
        }
    });
}

process.on('SIGINT', () => { isShuttingDown = true; process.exit(0); });
process.on('SIGTERM', () => { isShuttingDown = true; process.exit(0); });

startTunnel();

