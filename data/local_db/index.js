const path = require('path');
const fs = require('fs');

const dbDir = __dirname;
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'prints.sqlite');
let db = null;
let useSqlite = false;

try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    useSqlite = true;
} catch (e) {
    console.warn("better-sqlite3 native addon not loaded, falling back to pure JSON persistence engine for zero setup compatibility:", e.message);
    useSqlite = false;
}

// Ensure storage folders exist
const rootDir = path.resolve(__dirname, '../../');
const storageDirs = ['incoming', 'processed', 'archive', 'failed', 'logs'].map(d => path.join(rootDir, 'storage', d));
storageDirs.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

// Load default settings
const defaultSettingsPath = path.join(rootDir, 'config', 'default-settings.json');
const defaultSettings = fs.existsSync(defaultSettingsPath) ? JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8')) : {};

if (useSqlite) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            originalName TEXT,
            processedName TEXT,
            fileType TEXT,
            sizeBytes INTEGER,
            pages INTEGER,
            status TEXT,
            createdAt TEXT
        );
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            fileId TEXT,
            customerFile TEXT,
            originalPath TEXT,
            processedPath TEXT,
            pages INTEGER,
            printerName TEXT,
            printTime TEXT,
            status TEXT,
            copies INTEGER,
            retryCount INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS printers (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE,
            driverName TEXT,
            status TEXT,
            isDefault BOOLEAN,
            isPrimary BOOLEAN,
            isSecondary BOOLEAN,
            isFallback BOOLEAN,
            lastChecked TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            category TEXT,
            level TEXT,
            message TEXT,
            details TEXT
        );
        CREATE TABLE IF NOT EXISTS queue (
            id TEXT PRIMARY KEY,
            fileId TEXT,
            customerName TEXT,
            fileName TEXT,
            processedPath TEXT,
            originalPath TEXT,
            printer TEXT,
            copies INTEGER,
            status TEXT,
            priority INTEGER DEFAULT 1,
            attempts INTEGER DEFAULT 0,
            createdAt TEXT,
            updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS statistics (
            date TEXT PRIMARY KEY,
            totalReceived INTEGER DEFAULT 0,
            totalProcessed INTEGER DEFAULT 0,
            totalPrinted INTEGER DEFAULT 0,
            totalFailed INTEGER DEFAULT 0
        );
    `);

    // Seed settings if empty
    const count = db.prepare("SELECT COUNT(*) as count FROM settings").get().count;
    if (count === 0) {
        const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
        for (const [k, v] of Object.entries(defaultSettings)) {
            stmt.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
    }
}

// Pure JSON persistence fallback store if better-sqlite3 isn't available
const jsonStorePath = path.join(dbDir, 'store.json');
let jsonStore = fs.existsSync(jsonStorePath) ? JSON.parse(fs.readFileSync(jsonStorePath, 'utf8')) : {
    files: {}, history: {}, printers: {}, settings: { ...defaultSettings }, logs: [], queue: {}, statistics: {}
};
function saveJsonStore() {
    if (!useSqlite) fs.writeFileSync(jsonStorePath, JSON.stringify(jsonStore, null, 2), 'utf8');
}

module.exports = {
    useSqlite,
    // Settings Repository
    getSettings() {
        if (useSqlite) {
            const rows = db.prepare("SELECT * FROM settings").all();
            const res = { ...defaultSettings };
            rows.forEach(r => {
                let val = r.value;
                if (val === 'true') val = true;
                else if (val === 'false') val = false;
                else if (!isNaN(val) && val.trim() !== '' && r.key !== 'whatsAppFolder' && r.key !== 'adminPasswordHash') val = Number(val);
                res[r.key] = val;
            });
            return res;
        } else {
            try {
                if (fs.existsSync(jsonStorePath)) {
                    jsonStore = JSON.parse(fs.readFileSync(jsonStorePath, 'utf8'));
                }
            } catch {}
            return { ...defaultSettings, ...jsonStore.settings };
        }
    },
    saveSettings(newSettings) {
        if (useSqlite) {
            const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
            for (const [k, v] of Object.entries(newSettings)) {
                stmt.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
            }
        } else {
            jsonStore.settings = { ...jsonStore.settings, ...newSettings };
            saveJsonStore();
        }
    },
    // Queue Repository
    getQueue() {
        if (useSqlite) {
            return db.prepare("SELECT * FROM queue ORDER BY priority DESC, createdAt ASC").all();
        } else {
            return Object.values(jsonStore.queue).sort((a, b) => (b.priority - a.priority) || (new Date(a.createdAt) - new Date(b.createdAt)));
        }
    },
    addQueueItem(item) {
        if (useSqlite) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO queue 
                (id, fileId, customerName, fileName, processedPath, originalPath, printer, copies, status, priority, attempts, createdAt, updatedAt) 
                VALUES (@id, @fileId, @customerName, @fileName, @processedPath, @originalPath, @printer, @copies, @status, @priority, @attempts, @createdAt, @updatedAt)`);
            stmt.run(item);
        } else {
            jsonStore.queue[item.id] = item;
            saveJsonStore();
        }
    },
    updateQueueStatus(id, status, attempts = null) {
        const updatedAt = new Date().toISOString();
        if (useSqlite) {
            if (attempts !== null) {
                db.prepare("UPDATE queue SET status = ?, attempts = ?, updatedAt = ? WHERE id = ?").run(status, attempts, updatedAt, id);
            } else {
                db.prepare("UPDATE queue SET status = ?, updatedAt = ? WHERE id = ?").run(status, updatedAt, id);
            }
        } else {
            if (jsonStore.queue[id]) {
                jsonStore.queue[id].status = status;
                if (attempts !== null) jsonStore.queue[id].attempts = attempts;
                jsonStore.queue[id].updatedAt = updatedAt;
                saveJsonStore();
            }
        }
    },
    deleteQueueItem(id) {
        if (useSqlite) db.prepare("DELETE FROM queue WHERE id = ? OR fileId = ?").run(id, id);
        else {
            Object.keys(jsonStore.queue).forEach(k => {
                if (k === id || jsonStore.queue[k].id === id || jsonStore.queue[k].fileId === id) {
                    delete jsonStore.queue[k];
                }
            });
            saveJsonStore();
        }
    },
    clearCompletedQueue() {
        if (useSqlite) db.prepare("DELETE FROM queue WHERE status IN ('Completed', 'Cancelled', 'Failed')").run();
        else {
            Object.keys(jsonStore.queue).forEach(id => {
                if (['Completed', 'Cancelled', 'Failed'].includes(jsonStore.queue[id].status)) delete jsonStore.queue[id];
            });
            saveJsonStore();
        }
    },
    // History Repository
    getHistory(limit = 100) {
        if (useSqlite) {
            return db.prepare("SELECT * FROM history ORDER BY printTime DESC LIMIT ?").all(limit);
        } else {
            return Object.values(jsonStore.history).sort((a, b) => new Date(b.printTime) - new Date(a.printTime)).slice(0, limit);
        }
    },
    addHistoryItem(item) {
        if (useSqlite) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO history 
                (id, fileId, customerFile, originalPath, processedPath, pages, printerName, printTime, status, copies, retryCount)
                VALUES (@id, @fileId, @customerFile, @originalPath, @processedPath, @pages, @printerName, @printTime, @status, @copies, @retryCount)`);
            stmt.run(item);
        } else {
            jsonStore.history[item.id] = item;
            saveJsonStore();
        }
    },
    deleteHistoryItem(id) {
        if (useSqlite) db.prepare("DELETE FROM history WHERE id = ? OR fileId = ?").run(id, id);
        else {
            Object.keys(jsonStore.history).forEach(k => {
                if (k === id || jsonStore.history[k].id === id || jsonStore.history[k].fileId === id) {
                    delete jsonStore.history[k];
                }
            });
            saveJsonStore();
        }
    },
    deleteDocumentComplete(targetId) {
        if (!targetId) return;
        if (useSqlite) {
            db.prepare("DELETE FROM queue WHERE id = ? OR fileId = ? OR fileName = ?").run(targetId, targetId, targetId);
            db.prepare("DELETE FROM history WHERE id = ? OR fileId = ? OR customerFile = ?").run(targetId, targetId, targetId);
            db.prepare("DELETE FROM files WHERE id = ? OR originalName = ? OR processedName = ?").run(targetId, targetId, targetId);
        } else {
            Object.keys(jsonStore.queue).forEach(k => {
                const i = jsonStore.queue[k];
                if (k === targetId || i.id === targetId || i.fileId === targetId || i.fileName === targetId) delete jsonStore.queue[k];
            });
            Object.keys(jsonStore.history).forEach(k => {
                const i = jsonStore.history[k];
                if (k === targetId || i.id === targetId || i.fileId === targetId || i.customerFile === targetId) delete jsonStore.history[k];
            });
            Object.keys(jsonStore.files).forEach(k => {
                const i = jsonStore.files[k];
                if (k === targetId || i.id === targetId || i.originalName === targetId) delete jsonStore.files[k];
            });
            saveJsonStore();
        }
    },
    clearAllDocuments() {
        if (useSqlite) {
            db.prepare("DELETE FROM queue").run();
            db.prepare("DELETE FROM history").run();
            db.prepare("DELETE FROM files").run();
        } else {
            jsonStore.queue = {};
            jsonStore.history = {};
            jsonStore.files = {};
            saveJsonStore();
        }
        
        // Wipe all cached physical files from storage directories so nothing is retained in UI
        ['incoming', 'processed', 'archive', 'failed'].forEach(folder => {
            try {
                const dir = path.join(rootDir, 'storage', folder);
                if (fs.existsSync(dir)) {
                    fs.readdirSync(dir).forEach(f => {
                        try { fs.unlinkSync(path.join(dir, f)); } catch(e){}
                    });
                }
            } catch(e){}
        });
    },
    // Printers Repository
    getPrinters() {
        if (useSqlite) {
            return db.prepare("SELECT * FROM printers").all();
        } else {
            try {
                if (fs.existsSync(jsonStorePath)) {
                    jsonStore = JSON.parse(fs.readFileSync(jsonStorePath, 'utf8'));
                }
            } catch {}
            return Object.values(jsonStore.printers);
        }
    },
    savePrinters(printersList) {
        if (useSqlite) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO printers 
                (id, name, driverName, status, isDefault, isPrimary, isSecondary, isFallback, lastChecked)
                VALUES (@id, @name, @driverName, @status, @isDefault, @isPrimary, @isSecondary, @isFallback, @lastChecked)`);
            const tx = db.transaction((printers) => {
                printers.forEach(p => stmt.run({
                    id: p.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    name: p.name,
                    driverName: p.driverName || 'Generic driver',
                    status: p.status || 'Ready',
                    isDefault: p.isDefault ? 1 : 0,
                    isPrimary: p.isPrimary ? 1 : 0,
                    isSecondary: p.isSecondary ? 1 : 0,
                    isFallback: p.isFallback ? 1 : 0,
                    lastChecked: new Date().toISOString()
                }));
            });
            tx(printersList);
        } else {
            printersList.forEach(p => {
                const id = p.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                jsonStore.printers[id] = { id, ...p, lastChecked: new Date().toISOString() };
            });
            saveJsonStore();
        }
    },
    // Logs Repository
    addLog(log) {
        const timestamp = new Date().toISOString();
        const entry = { timestamp, category: log.category || 'GENERAL', level: log.level || 'INFO', message: log.message || '', details: log.details ? JSON.stringify(log.details) : '' };
        if (useSqlite) {
            db.prepare("INSERT INTO logs (timestamp, category, level, message, details) VALUES (?, ?, ?, ?, ?)").run(entry.timestamp, entry.category, entry.level, entry.message, entry.details);
        } else {
            jsonStore.logs.unshift({ id: jsonStore.logs.length + 1, ...entry });
            if (jsonStore.logs.length > 1000) jsonStore.logs.pop();
            saveJsonStore();
        }
    },
    getLogs({ category, level, limit = 100 } = {}) {
        if (useSqlite) {
            let sql = "SELECT * FROM logs WHERE 1=1";
            const params = [];
            if (category && category !== 'ALL') { sql += " AND category = ?"; params.push(category); }
            if (level && level !== 'ALL') { sql += " AND level = ?"; params.push(level); }
            sql += " ORDER BY id DESC LIMIT ?";
            params.push(limit);
            return db.prepare(sql).all(...params);
        } else {
            let list = [...jsonStore.logs];
            if (category && category !== 'ALL') list = list.filter(l => l.category === category);
            if (level && level !== 'ALL') list = list.filter(l => l.level === level);
            return list.slice(0, limit);
        }
    },
    // Statistics Repository
    incrementStatistic(metric) { // totalReceived, totalProcessed, totalPrinted, totalFailed
        const date = new Date().toISOString().split('T')[0];
        if (useSqlite) {
            db.prepare(`INSERT INTO statistics (date, ${metric}) VALUES (?, 1) 
                ON CONFLICT(date) DO UPDATE SET ${metric} = ${metric} + 1`).run(date);
        } else {
            if (!jsonStore.statistics[date]) jsonStore.statistics[date] = { date, totalReceived: 0, totalProcessed: 0, totalPrinted: 0, totalFailed: 0 };
            jsonStore.statistics[date][metric] = (jsonStore.statistics[date][metric] || 0) + 1;
            saveJsonStore();
        }
    },
    getStatistics() {
        if (useSqlite) {
            return db.prepare("SELECT * FROM statistics ORDER BY date DESC LIMIT 30").all();
        } else {
            return Object.values(jsonStore.statistics).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
        }
    }
};
