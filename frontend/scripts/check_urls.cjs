const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const content = fs.readFileSync(path.join(__dirname, '../src/data/services.ts'), 'utf8');
const regex = /url:\s*'([^']+)'/g;
let match;
const urls = [];
while ((match = regex.exec(content)) !== null) {
  urls.push(match[1]);
}

async function checkUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    // adding realistic user agent and ignoring SSL errors as many indian govt sites have broken certs
    const options = {
      rejectUnauthorized: false,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    };
    const req = client.get(url, options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve({url, status: res.statusCode, ok: true});
      } else if (res.statusCode === 403 || res.statusCode === 401) {
          // 403 usually means the site is alive but blocking automated tools, consider it alive
          resolve({url, status: res.statusCode, ok: true});
      } else {
        resolve({url, status: res.statusCode, ok: false});
      }
    });
    req.on('error', (e) => resolve({url, error: e.message, ok: false}));
    req.on('timeout', () => {
      req.destroy();
      resolve({url, error: 'timeout', ok: false});
    });
  });
}

async function main() {
  console.log(`Checking ${urls.length} URLs...`);
  // Process in chunks to avoid slamming connections
  const broken = [];
  const chunkSize = 10;
  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(u => checkUrl(u)));
    broken.push(...results.filter(r => !r.ok));
  }
  console.log('BROKEN LINKS:');
  console.log(JSON.stringify(broken, null, 2));
}

main();
