const fs = require('fs');
const path = require('path');
const db = require('../database/index.js');
const Logger = require('../logs/logger');

let imaps = null;
let simpleParser = null;
try {
    imaps = require('imap-simple');
    const mailparser = require('mailparser');
    simpleParser = mailparser.simpleParser;
} catch (e) {
    Logger.warn('EMAIL_WATCHER', 'imap-simple or mailparser npm packages not found. Run npm install --save imap-simple mailparser to enable email polling.');
}

let pollTimer = null;
let isPolling = false;
let totalDownloadedSession = 0;
let lastCheckTimestamp = null;
let lastErrorMsg = null;

const ALLOWED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.doc', '.bmp'];

const EmailWatcher = {
    start() {
        this.stop();
        if (!imaps || !simpleParser) {
            Logger.warn('EMAIL_WATCHER', 'Email automation disabled: Required email library modules are missing.');
            return;
        }

        const settings = db.getSettings();
        if (!settings.enableEmailWatcher) {
            Logger.info('EMAIL_WATCHER', 'Email Attachment Watcher is disabled in system configuration.');
            return;
        }

        if (!settings.emailImapUser || !settings.emailImapPassword) {
            Logger.warn('EMAIL_WATCHER', 'Email Watcher enabled but IMAP credentials (user/password) are empty.');
            return;
        }

        const intervalSec = Number(settings.emailPollingIntervalSec) || 30;
        Logger.info('EMAIL_WATCHER', `Starting 24/7 Automated Email Attachment Watcher checking [${settings.emailImapUser}] every ${intervalSec}s...`);

        // Initial check on boot (slight delay to let system stabilize)
        setTimeout(() => this.pollInbox(), 4000);

        // Schedule continuous polling interval
        pollTimer = setInterval(() => this.pollInbox(), intervalSec * 1000);
    },

    stop() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
            Logger.info('EMAIL_WATCHER', 'Automated Email Attachment Watcher stopped.');
        }
    },

    async pollInbox() {
        if (isPolling) return;
        if (!imaps || !simpleParser) return;

        const settings = db.getSettings();
        if (!settings.enableEmailWatcher || !settings.emailImapUser || !settings.emailImapPassword) return;

        isPolling = true;
        lastCheckTimestamp = new Date().toISOString();

        const config = {
            imap: {
                user: settings.emailImapUser.trim(),
                password: settings.emailImapPassword.trim(),
                host: (settings.emailImapHost || 'imap.gmail.com').trim(),
                port: Number(settings.emailImapPort) || 993,
                tls: settings.emailImapTls !== false,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 15000
            }
        };

        let connection = null;
        try {
            connection = await imaps.connect(config);
            await connection.openBox('INBOX');

            const searchCriteria = ['UNSEEN'];
            const fetchOptions = {
                bodies: [''], // Fetch full message body for attachment parsing
                markSeen: false
            };

            const messages = await connection.search(searchCriteria, fetchOptions);
            if (messages && messages.length > 0) {
                Logger.info('EMAIL_WATCHER', `Detected ${messages.length} unread customer email(s). Inspecting attachments...`);
                const targetFolder = settings.whatsAppFolder || 'D:\\whatspp';
                if (!fs.existsSync(targetFolder)) {
                    fs.mkdirSync(targetFolder, { recursive: true });
                }

                for (const msg of messages) {
                    try {
                        const allData = msg.parts.find(p => p.which === '');
                        if (!allData || !allData.body) continue;

                        const parsed = await simpleParser(allData.body);
                        const senderEmail = parsed.from && parsed.from.value && parsed.from.value[0] ? parsed.from.value[0].address : 'unknown_customer';
                        const senderClean = (senderEmail.split('@')[0] || 'customer').replace(/[^a-zA-Z0-9_-]/g, '');

                        let extractedCount = 0;
                        if (parsed.attachments && parsed.attachments.length > 0) {
                            for (const att of parsed.attachments) {
                                const origName = att.filename || 'attachment.png';
                                const ext = path.extname(origName).toLowerCase();
                                if (!ALLOWED_EXTS.includes(ext)) {
                                    Logger.warn('EMAIL_WATCHER', `Skipping non-document email attachment [${origName}] (${ext}) from [${senderEmail}].`);
                                    continue;
                                }

                                const cleanOrigName = origName.replace(/[^a-zA-Z0-9._-]/g, '_');
                                const stdFilename = `email_${Date.now()}_${senderClean}_${cleanOrigName}`;
                                const destPath = path.join(targetFolder, stdFilename);

                                fs.writeFileSync(destPath, att.content);
                                extractedCount++;
                                totalDownloadedSession++;
                                Logger.info('EMAIL_WATCHER', `✅ Downloaded attachment [${stdFilename}] from email [${senderEmail}] cleanly into watched folder!`);
                            }
                        }

                        // Mark message as seen so we don't process it repeatedly
                        const uid = msg.attributes.uid;
                        await connection.addFlags(uid, ['\\Seen']);
                        if (extractedCount > 0) {
                            Logger.info('EMAIL_WATCHER', `Processed ${extractedCount} file(s) from [${senderEmail}] and marked email SEEN.`);
                        }
                    } catch (err) {
                        Logger.error('EMAIL_WATCHER', `Failed parsing email message UID ${msg.attributes.uid}: ${err.message}`);
                    }
                }
            }
            lastErrorMsg = null;
        } catch (err) {
            lastErrorMsg = err.message;
            Logger.error('EMAIL_WATCHER', `IMAP Polling Error for [${settings.emailImapUser}]: ${err.message}`);
        } finally {
            if (connection) {
                try {
                    connection.end();
                } catch (e) { /* ignore end errors */ }
            }
            isPolling = false;
        }
    },

    async testConnection(testConfig = null) {
        if (!imaps || !simpleParser) {
            return { success: false, message: "Required npm packages 'imap-simple' and 'mailparser' are not installed." };
        }

        const settings = db.getSettings();
        const cfg = testConfig || {
            user: settings.emailImapUser,
            password: settings.emailImapPassword,
            host: settings.emailImapHost,
            port: settings.emailImapPort,
            tls: settings.emailImapTls
        };

        if (!cfg.user || !cfg.password) {
            return { success: false, message: "⚠️ IMAP User Email and App Password must not be empty." };
        }

        Logger.info('EMAIL_WATCHER', `Testing IMAP live connection to [${cfg.host}:${cfg.port}] for user [${cfg.user}]...`);
        const config = {
            imap: {
                user: cfg.user.trim(),
                password: cfg.password.trim(),
                host: (cfg.host || 'imap.gmail.com').trim(),
                port: Number(cfg.port) || 993,
                tls: cfg.tls !== false,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 12000
            }
        };

        let conn = null;
        try {
            conn = await imaps.connect(config);
            const box = await conn.openBox('INBOX');
            conn.end();
            Logger.info('EMAIL_WATCHER', `✅ IMAP connection confirmed! Inbox total messages: ${box.messages.total}`);
            return { 
                success: true, 
                message: `✅ IMAP Authentication successful! Successfully connected to INBOX (${box.messages.total} total emails found).` 
            };
        } catch (err) {
            if (conn) try { conn.end(); } catch (e) {}
            Logger.warn('EMAIL_WATCHER', `Test connection failed: ${err.message}`);
            return { 
                success: false, 
                message: `❌ IMAP Login Failed: ${err.message}. If using Gmail or Microsoft 365, make sure you created an App Password in 2-Step Verification!` 
            };
        }
    },

    getStatus() {
        const settings = db.getSettings();
        return {
            enabled: Boolean(settings.enableEmailWatcher),
            active: pollTimer !== null,
            user: settings.emailImapUser || 'Not configured',
            host: settings.emailImapHost || 'imap.gmail.com',
            pollingIntervalSec: settings.emailPollingIntervalSec || 30,
            lastChecked: lastCheckTimestamp || 'Never polled yet',
            totalDownloadedSession,
            lastError: lastErrorMsg || 'None'
        };
    }
};

module.exports = EmailWatcher;
