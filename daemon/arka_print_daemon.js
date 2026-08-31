/**
 * ARKA Local Print Service Daemon (Port 5000)
 * Permanent Production Agent (QZ Tray Model) for Shop Desktop
 * 
 * Features:
 * 1. Runs 24/7 background Windows daemon on Port 5000 (REST API: http://localhost:5000/print)
 * 2. Secondary Port 8082 for existing dashboard & legacy compatibility
 * 3. Intelligent Dual-Printer Routing:
 *    - Epson printer: Always connected via USB -> binds directly to Windows Spooler
 *    - HP printer: Configured on static IP 192.168.31.2 on ARKA Wi-Fi.
 *      Pre-flight ping check: If reachable, routes via Wi-Fi; if unreachable, falls back to USB cable (USB002).
 * 4. Real-time WMI/Print Spooler API status polling + auto-clearing stuck print jobs
 * 5. Private Network Access CORS support for HTTPS web apps (Vercel) to print directly to desktop
 */

const path = require('path');
const fs = require('fs');

// Set working directory to project root
const rootDir = path.resolve(__dirname, '..');
process.chdir(rootDir);

console.log('===============================================================');
console.log('      ARKA LOCAL PRINT SERVICE DAEMON - VERSION 2.5.0          ');
console.log('          Permanent Production Agent for Shop Desktop          ');
console.log('===============================================================');
console.log(`[DAEMON] Root Directory: ${rootDir}`);
console.log(`[DAEMON] Initializing hardware printer drivers and spooler bridge...`);

// Delegate to backend server which has full route table, services, and queue
require('../backend/src/server.js');
