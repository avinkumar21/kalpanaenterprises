const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const db = require('../data/local_db/index.js');

const root = path.resolve(__dirname, '../');
const logsDir = path.join(root, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'tunnel.log');

const cloudflaredPath = fs.existsSync('C:\\Program Files (x86)\\cloudflared\\cloudflared.exe') 
    ? 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe' 
    : 'cloudflared';

const RELAY_TOPIC = 'kalpana_enterprises_tunnel_v2';
let isShuttingDown = false;
let currentTunnelUrl = null;
let broadcastInterval = null;

function broadcastTunnelUrl(url) {
    if (!url || !url.startsWith('https://')) return;
    try {
        const req = https.request(`https://ntfy.sh/${RELAY_TOPIC}`, {
            method: 'POST',
            headers: { 'Title': 'ARKA_ACTIVE_TUNNEL' }
        }, (res) => {
            if (res.statusCode === 200) {
                console.log(`[TUNNEL_RELAY] Successfully broadcast live tunnel to ntfy.sh/${RELAY_TOPIC}`);
            }
        });
        req.on('error', (err) => {
            console.warn(`[TUNNEL_RELAY] Broadcast warning: ${err.message}`);
        });
        req.write(url.trim());
        req.end();
    } catch (e) {
        console.warn(`[TUNNEL_RELAY] Broadcast exception: ${e.message}`);
    }

    // Also persist to local active_tunnel.json in root and frontend/public
    try {
        const payload = JSON.stringify({ tunnelUrl: url.trim(), updatedAt: new Date().toISOString() }, null, 2);
        fs.writeFileSync(path.join(root, 'active_tunnel.json'), payload, 'utf8');
        const pubDir = path.join(root, 'frontend', 'public');
        if (fs.existsSync(pubDir)) {
            fs.writeFileSync(path.join(pubDir, 'active_tunnel.json'), payload, 'utf8');
        }
    } catch (e) {
        console.warn(`[TUNNEL_RELAY] Failed to write active_tunnel.json: ${e.message}`);
    }
}

function startTunnel() {
    if (isShuttingDown) return;

    fs.writeFileSync(logFile, '');
    const stream = fs.createWriteStream(logFile, { flags: 'a' });

    console.log(`[TUNNEL] Launching Cloudflare Express Tunnel with IPv4 edge routing targeting http://127.0.0.1:8082...`);

    const child = spawn(cloudflaredPath, [
        'tunnel',
        '--edge-ip-version', '4',
        '--protocol', 'http2',
        '--url', 'http://127.0.0.1:8082'
    ], {
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
            if (tunnelUrl !== currentTunnelUrl) {
                currentTunnelUrl = tunnelUrl;
                console.log(`\n==========================================================`);
                console.log(`[TUNNEL] Active Public Relay URL detected: ${tunnelUrl}`);
                console.log(`==========================================================\n`);
                try {
                    db.saveSettings({ publicTunnelUrl: tunnelUrl });
                    console.log(`[TUNNEL] Saved active tunnel URL into local system configuration.`);
                } catch (e) {
                    console.error(`[TUNNEL] Failed to save tunnel URL:`, e.message);
                }
                broadcastTunnelUrl(tunnelUrl);

                if (broadcastInterval) clearInterval(broadcastInterval);
                broadcastInterval = setInterval(() => {
                    if (currentTunnelUrl) broadcastTunnelUrl(currentTunnelUrl);
                }, 180000); // Re-broadcast every 3 minutes to keep cache warm
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

process.on('SIGINT', () => { isShuttingDown = true; if (broadcastInterval) clearInterval(broadcastInterval); process.exit(0); });
process.on('SIGTERM', () => { isShuttingDown = true; if (broadcastInterval) clearInterval(broadcastInterval); process.exit(0); });

startTunnel();
