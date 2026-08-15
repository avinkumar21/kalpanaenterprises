const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../');
const logFile = path.join(root, 'logs/tunnel.log');
const cloudflaredPath = fs.existsSync('C:\\Program Files (x86)\\cloudflared\\cloudflared.exe') 
    ? 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe' 
    : 'cloudflared';

// Ensure fresh log file on launch
fs.writeFileSync(logFile, '');
const stream = fs.createWriteStream(logFile, { flags: 'a' });

console.log(`[TUNNEL] Launching Cloudflare Express Tunnel targeting http://127.0.0.1:8082...`);

const child = spawn(cloudflaredPath, ['tunnel', '--url', 'http://127.0.0.1:8082'], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    stream.write(chunk);
});

child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    stream.write(chunk);
});

child.on('exit', (code) => {
    console.log(`[TUNNEL] Process exited with code ${code}`);
    process.exit(code || 0);
});
