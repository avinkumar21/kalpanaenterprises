// API Client for ARKA Prints Auto Document Engine

const API_BASE = '/api/prints';

export interface SystemStatus {
  status: string;
  serviceName: string;
  timestamp: string;
  watcher: {
    active: boolean;
    targetFolder: string;
    folderExists: boolean;
    pollingIntervalMs: number;
    filesReceivedSession: number;
  };
  metrics: {
    filesToday: number;
    pendingJobs: number;
    printingJobs: number;
    completedToday: number;
    failedToday: number;
    queueLength: number;
    activePrinters: number;
  };
  lastFileReceived: string;
  lastPrintedFile: string;
  recentActivity: Array<any>;
}

export interface PrinterInfo {
  id?: string;
  name: string;
  driverName: string;
  status: string;
  isDefault: boolean;
  isPrimary?: boolean;
  isSecondary?: boolean;
  isFallback?: boolean;
  lastChecked?: string;
}

export interface QueueJob {
  id: string;
  fileId: string;
  customerName: string;
  fileName: string;
  processedPath: string;
  originalPath: string;
  printer: string;
  copies: number;
  status: 'Pending' | 'Processing' | 'Printing' | 'Completed' | 'Failed' | 'Cancelled' | 'Retry';
  priority: number;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryItem {
  id: string;
  fileId: string;
  customerFile: string;
  originalPath: string;
  processedPath: string;
  pages: number;
  printerName: string;
  printTime: string;
  status: string;
  copies: number;
  retryCount: number;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  category: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details?: string;
}

class PrintsApi {
  async fetchStatus(): Promise<SystemStatus> {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      // Return offline simulation state
      return {
        status: 'OFFLINE',
        serviceName: 'ARKA Print Service (Unreachable)',
        timestamp: new Date().toISOString(),
        watcher: { active: false, targetFolder: 'D:\\whatspp', folderExists: false, pollingIntervalMs: 2000, filesReceivedSession: 0 },
        metrics: { filesToday: 0, pendingJobs: 0, printingJobs: 0, completedToday: 0, failedToday: 0, queueLength: 0, activePrinters: 0 },
        lastFileReceived: 'Service offline',
        lastPrintedFile: 'Service offline',
        recentActivity: []
      };
    }
  }

  async getHistory(limit = 100): Promise<HistoryItem[]> {
    const res = await fetch(`${API_BASE}/history?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  }

  async getPrinters(refresh = false): Promise<PrinterInfo[]> {
    const res = await fetch(`${API_BASE}/printers?refresh=${refresh}`);
    if (!res.ok) return [];
    return await res.json();
  }

  async getQueue(): Promise<QueueJob[]> {
    const res = await fetch(`${API_BASE}/queue`);
    if (!res.ok) return [];
    return await res.json();
  }

  async getLogs(category = 'ALL', level = 'ALL', limit = 150): Promise<LogEntry[]> {
    const res = await fetch(`${API_BASE}/logs?category=${category}&level=${level}&limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  }

  async getStatistics(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/statistics`);
    if (!res.ok) return [];
    return await res.json();
  }

  async getSettings(): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) return {};
    return await res.json();
  }

  async saveSettings(settings: Record<string, any>): Promise<any> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return await res.json();
  }

  async testPrinter(printerName: string): Promise<any> {
    const res = await fetch(`${API_BASE}/test-printer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer: printerName })
    });
    return await res.json();
  }

  async clearQueue(): Promise<any> {
    const res = await fetch(`${API_BASE}/clear-queue`, { method: 'POST' });
    return await res.json();
  }

  async retryJob(jobId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/queue/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    return await res.json();
  }

  async cancelJob(jobId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/queue/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    return await res.json();
  }

  async deleteDocument(id: string, fileId?: string, fileName?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/delete-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fileId, fileName })
    });
    return await res.json();
  }

  async deleteAllDocuments(): Promise<any> {
    const res = await fetch(`${API_BASE}/delete-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return await res.json();
  }

  async setPriority(jobId: string, priority: number): Promise<any> {
    const res = await fetch(`${API_BASE}/queue/priority`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, priority })
    });
    return await res.json();
  }

  async reprint(historyId: string, printer?: string, copies?: number): Promise<any> {
    const res = await fetch(`${API_BASE}/reprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historyId, printer, copies })
    });
    return await res.json();
  }

  async manualPrint(jobId: string, printer?: string, copies?: number): Promise<any> {
    const res = await fetch(`${API_BASE}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, printer, copies })
    });
    return await res.json();
  }

  async overrideImage(jobId: string, overrides: Record<string, any>): Promise<any> {
    const res = await fetch(`${API_BASE}/override-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, ...overrides })
    });
    return await res.json();
  }

  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload-file`, {
      method: 'POST',
      body: formData
    });
    return await res.json();
  }

  getDownloadUrl(type: 'original' | 'processed', id: string): string {
    return `${API_BASE}/download/${type}/${id}`;
  }

  async fetchPrinterStatus(): Promise<Record<string, string>> {
    try {
      const res = await fetch(`${API_BASE}/printer-status`);
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  getPreviewUrl(id: string): string {
    return `${API_BASE}/preview/${id}`;
  }

  async uploadDocument(file: File, copies: number = 1, colorMode: string = 'Color'): Promise<any> {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('copies', copies.toString());
    formData.append('colorMode', colorMode);
    const res = await fetch(`${API_BASE}/upload-document`, {
      method: 'POST',
      body: formData
    });
    return await res.json();
  }

  async fetchEmailWatcherStatus(): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/email-watcher/status`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async testEmailWatcherConnection(config: any): Promise<any> {
    const res = await fetch(`${API_BASE}/email-watcher/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return await res.json();
  }
}

export const api = new PrintsApi();
