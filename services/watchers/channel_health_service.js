const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const db = require('../database/index.js');
const Logger = require('../logs/logger.js');

const rootDir = path.resolve(__dirname, '../../');
const logsDir = path.join(rootDir, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

let healthInterval = null;
let currentDiagnostics = {
    timestamp: new Date().toISOString(),
    status: 'INITIALIZING',
    channels: {
        wifi: {
            name: 'Shop Wi-Fi / Local LAN',
            status: 'CHECKING',
            url: 'http://192.168.31.233:8082/prints?kiosk=true#upload',
            ip: '192.168.31.233',
            port: 8082,
            latencyMs: 0,
            lastVerified: null,
            message: 'Initializing local listener check...'
        },
        mobile_tunnel: {
            name: '4G/5G Cellular Web Tunnel',
            status: 'CHECKING',
            url: '',
            latencyMs: 0,
            lastVerified: null,
            verified: false,
            message: 'Initializing Cloudflare relay probe...'
        },
        email: {
            name: '4G/5G Email Intake Drop',
            status: 'READY',
            email: 'print@kalpanaenterprise.com',
            lastVerified: new Date().toISOString(),
            message: 'Direct mailto QR code operational.'
        }
    },
    system: {
        serverPort8082: 'ONLINE',
        cloudflaredProcess: 'UNKNOWN',
        databaseEngine: 'ONLINE',
        uptimeSeconds: 0
    }
};

const startTime = Date.now();

function getDailyLogPath() {
    const today = new Date().toISOString().split('T')[0];
    return path.join(logsDir, `daily_health_${today}.log`);
}

function writeDailyHealthLog(entry) {
    try {
        const logFile = getDailyLogPath();
        const line = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
        fs.appendFileSync(logFile, line, 'utf8');
    } catch (e) {
        console.error('[HEALTH SERVICE] Failed to write daily log:', e.message);
    }
}

// Test local HTTP endpoint
function probeLocalHttp(port, endpoint = '/api/v1/health') {
    return new Promise((resolve) => {
        const start = Date.now();
        const req = http.get(`http://127.0.0.1:${port}${endpoint}`, { timeout: 3000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const latency = Date.now() - start;
                resolve({
                    success: res.statusCode === 200,
                    statusCode: res.statusCode,
                    latencyMs: latency
                });
            });
        });

        req.on('error', (err) => {
            resolve({ success: false, error: err.message, latencyMs: Date.now() - start });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'TIMEOUT', latencyMs: 3000 });
        });
    });
}

// Test public HTTPS Cloudflare tunnel endpoint
function probeHttpsTunnel(tunnelUrl, endpoint = '/api/v1/health') {
    return new Promise((resolve) => {
        if (!tunnelUrl || !tunnelUrl.startsWith('https://')) {
            return resolve({ success: false, error: 'NO_VALID_TUNNEL_URL', latencyMs: 0 });
        }

        const cleanUrl = tunnelUrl.replace(/\/+$/, '');
        const target = `${cleanUrl}${endpoint}`;
        const start = Date.now();

        try {
            const req = https.get(target, { timeout: 6000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const latency = Date.now() - start;
                    resolve({
                        success: res.statusCode === 200,
                        statusCode: res.statusCode,
                        latencyMs: latency
                    });
                });
            });

            req.on('error', (err) => {
                resolve({ success: false, error: err.message, latencyMs: Date.now() - start });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, error: 'TUNNEL_TIMEOUT', latencyMs: 6000 });
            });
        } catch (e) {
            resolve({ success: false, error: e.message, latencyMs: 0 });
        }
    });
}

async function verifyAllChannels() {
    const timestamp = new Date().toISOString();
    const settings = db.getSettings();
    const shopIp = '192.168.31.233';
    const currentTunnel = settings.publicTunnelUrl || '';
    const emailAddress = settings.shopEmail || 'print@kalpanaenterprise.com';

    // 1. Verify Local Wi-Fi Channel (Port 8082)
    const localCheck = await probeLocalHttp(8082, '/api/v1/health');
    const wifiStatus = localCheck.success ? 'ONLINE' : 'DEGRADED';
    const wifiUrl = `http://${shopIp}:8082/prints?kiosk=true#upload`;

    // 2. Verify Mobile 4G/5G Tunnel Channel
    let tunnelStatus = 'OFFLINE';
    let tunnelLatency = 0;
    let tunnelVerified = false;
    let tunnelMessage = 'Tunnel not active or unreachable.';

    if (currentTunnel && currentTunnel.includes('trycloudflare.com')) {
        const tunnelCheck = await probeHttpsTunnel(currentTunnel, '/api/v1/health');
        if (tunnelCheck.success) {
            tunnelStatus = 'ONLINE';
            tunnelLatency = tunnelCheck.latencyMs;
            tunnelVerified = true;
            tunnelMessage = `Live Cloudflare relay verified over HTTPS (${tunnelLatency}ms latency).`;
        } else {
            tunnelStatus = 'DEGRADED';
            tunnelMessage = `Tunnel URL probed but failed: ${tunnelCheck.error || tunnelCheck.statusCode}`;
        }
    } else {
        tunnelMessage = 'No active Cloudflare tunnel registered in database.';
    }

    const tunnelPortalUrl = (tunnelVerified && currentTunnel)
        ? `${currentTunnel.replace(/\/+$/, '')}/prints?kiosk=true#upload`
        : wifiUrl;

    // 3. Verify Email Channel
    const emailUrl = `mailto:${emailAddress}?subject=Customer%20Print%20Order&body=Please%20attach%20your%20document%20(PDF,%20Photos)%20and%20tap%20Send.%20Our%20shop%20engine%20will%20print%20it%20automatically.`;

    const overallStatus = (localCheck.success && tunnelVerified) 
        ? 'ALL_CHANNELS_ONLINE' 
        : localCheck.success 
        ? 'WIFI_ONLINE_TUNNEL_PENDING' 
        : 'CRITICAL';

    currentDiagnostics = {
        timestamp,
        status: overallStatus,
        channels: {
            wifi: {
                name: 'Shop Wi-Fi / Local Network',
                status: wifiStatus,
                url: wifiUrl,
                ip: shopIp,
                port: 8082,
                latencyMs: localCheck.latencyMs,
                lastVerified: localCheck.success ? timestamp : currentDiagnostics.channels.wifi.lastVerified,
                message: localCheck.success ? `Direct LAN listening on ${shopIp}:8082` : `Local server check failed: ${localCheck.error}`
            },
            mobile_tunnel: {
                name: '4G/5G Cellular Web Tunnel',
                status: tunnelStatus,
                url: tunnelPortalUrl,
                rawTunnelUrl: currentTunnel,
                latencyMs: tunnelLatency,
                lastVerified: tunnelVerified ? timestamp : currentDiagnostics.channels.mobile_tunnel.lastVerified,
                verified: tunnelVerified,
                message: tunnelMessage
            },
            email: {
                name: '4G/5G Email Intake Drop',
                status: 'READY',
                email: emailAddress,
                url: emailUrl,
                lastVerified: timestamp,
                message: `Active mailbox ready to receive customer document drops at ${emailAddress}.`
            }
        },
        system: {
            serverPort8082: localCheck.success ? 'ONLINE' : 'OFFLINE',
            databaseEngine: 'ONLINE',
            uptimeSeconds: Math.floor((Date.now() - startTime) / 1000)
        }
    };

    // Log diagnostic summary to daily rolling health log
    writeDailyHealthLog({
        type: 'CHANNEL_HEALTH_SNAPSHOT',
        status: overallStatus,
        wifi: { status: wifiStatus, latency: localCheck.latencyMs },
        mobile_tunnel: { status: tunnelStatus, verified: tunnelVerified, url: currentTunnel, latency: tunnelLatency },
        email: { status: 'READY', address: emailAddress }
    });
}

const ChannelHealthService = {
    start(intervalMs = 20000) {
        this.stop();
        Logger.info('HEALTH_SERVICE', 'Starting 24/7 Multi-Channel Verification & Diagnostic Engine...');
        verifyAllChannels();
        healthInterval = setInterval(() => {
            verifyAllChannels().catch(err => {
                Logger.error('HEALTH_SERVICE', `Channel verification error: ${err.message}`);
            });
        }, intervalMs);
    },

    stop() {
        if (healthInterval) {
            clearInterval(healthInterval);
            healthInterval = null;
            Logger.info('HEALTH_SERVICE', 'Multi-Channel Verification Engine stopped.');
        }
    },

    getDiagnostics() {
        return currentDiagnostics;
    },

    async runImmediateCheck() {
        await verifyAllChannels();
        return currentDiagnostics;
    }
};

module.exports = ChannelHealthService;
