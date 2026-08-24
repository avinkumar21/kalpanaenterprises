export const ACTIVE_PRODUCTION_TUNNEL = 'https://leader-appendix-mixer-jelsoft.trycloudflare.com';
export const SHOP_LAN_BASE = 'http://192.168.31.233:8082';

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || '';

    // 1. Explicit query parameter ?tunnel=... or ?api=...
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tunnelParam = urlParams.get('tunnel') || urlParams.get('api');
      if (tunnelParam && tunnelParam.trim() && !tunnelParam.includes('political-abilities')) {
        let trimmed = tunnelParam.trim().replace(/\/+$/, '');
        if (window.localStorage) {
          window.localStorage.setItem('arka_tunnel_url', trimmed);
          window.localStorage.setItem('arka_api_url', trimmed);
        }
        if (!trimmed.endsWith('/api/prints')) {
          trimmed += '/api/prints';
        }
        return trimmed;
      }
    } catch {}

    // 2. When accessing over Cloudflare tunnel or external tunnel, use current origin
    if (hostname.includes('trycloudflare.com') || hostname.includes('loca.lt') || hostname.includes('tunnel')) {
      return `${window.location.origin}/api/prints`;
    }

    // 3. When accessing on local LAN or localhost, use relative path or local port 8082
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      if (window.location.port === '8082' || window.location.port === '80' || !window.location.port) {
        return '/api/prints';
      }
      return `${window.location.protocol}//${hostname}:8082/api/prints`;
    }

    // 4. Saved active API or tunnel in localStorage
    try {
      const customApi = window.localStorage?.getItem('arka_api_url');
      if (customApi && customApi.trim() && !customApi.includes('political-abilities')) {
        let trimmed = customApi.trim().replace(/\/+$/, '');
        if (!trimmed.endsWith('/api/prints')) trimmed += '/api/prints';
        return trimmed;
      }

      const savedTunnel = window.localStorage?.getItem('arka_tunnel_url');
      if (savedTunnel && savedTunnel.includes('trycloudflare.com') && !savedTunnel.includes('political-abilities')) {
        let trimmed = savedTunnel.trim().replace(/\/+$/, '');
        if (!trimmed.endsWith('/api/prints')) trimmed += '/api/prints';
        return trimmed;
      }
    } catch {}

    // 5. When accessing from Vercel or any other public domain, use active Cloudflare tunnel
    if (hostname.includes('vercel.app') || !hostname.startsWith('192.168.')) {
      return `${ACTIVE_PRODUCTION_TUNNEL}/api/prints`;
    }

    if (window.location.origin && window.location.origin !== 'null') {
      return `${window.location.origin}/api/prints`;
    }
  }
  return `${ACTIVE_PRODUCTION_TUNNEL}/api/prints`;
}

export function setCustomApiBase(url: string | null): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (!url || !url.trim() || url.includes('political-abilities')) {
      window.localStorage.removeItem('arka_api_url');
    } else {
      window.localStorage.setItem('arka_api_url', url.trim());
    }
  }
}

export interface SystemStatus {
  status: string;
  serviceName: string;
  timestamp: string;
  publicTunnelUrl?: string;
  lanIp?: string;
  wifiUrl?: string;
  mobileUrl?: string;
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
  fileId?: string;
  customerName?: string;
  fileName?: string;
  customerFile?: string;
  processedPath?: string;
  originalPath?: string;
  printer?: string;
  copies?: number;
  colorMode?: 'Color' | 'BlackWhite' | string;
  status?: 'Pending' | 'Processing' | 'Printing' | 'Completed' | 'Failed' | 'Cancelled' | 'Retry' | string;
  priority?: number;
  attempts?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface HistoryItem {
  id: string;
  fileId: string;
  customerFile: string;
  originalPath: string;
  processedPath: string;
  pages: number;
  printerName: string;
  colorMode?: 'Color' | 'BlackWhite' | string;
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

export async function fetchWithFallback(endpointPath: string, options?: RequestInit): Promise<Response> {
  const primaryBase = getApiBase();
  const candidateBases: string[] = [
    primaryBase,
    `${ACTIVE_PRODUCTION_TUNNEL}/api/prints`,
    'http://192.168.31.233:8082/api/prints',
    'http://localhost:8082/api/prints',
    'http://127.0.0.1:8082/api/prints',
    '/api/prints'
  ];

  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '';
    const origin = window.location.origin;
    if (origin && origin !== 'null') {
      candidateBases.push(`${origin}/api/prints`);
    }

    const savedTunnel = window.localStorage?.getItem('arka_tunnel_url');
    if (savedTunnel && savedTunnel.includes('trycloudflare.com') && !savedTunnel.includes('political-abilities')) {
      let trimmed = savedTunnel.trim().replace(/\/+$/, '');
      if (!trimmed.endsWith('/api/prints')) trimmed += '/api/prints';
      candidateBases.unshift(trimmed);
    }
    const savedApi = window.localStorage?.getItem('arka_api_url');
    if (savedApi && !savedApi.includes('political-abilities')) {
      let trimmed = savedApi.trim().replace(/\/+$/, '');
      if (!trimmed.endsWith('/api/prints')) trimmed += '/api/prints';
      candidateBases.unshift(trimmed);
    }
  }

  const uniqueBases = Array.from(new Set(candidateBases.filter(Boolean).map(b => b.trim().replace(/\/+$/, ''))));

  let lastError: any = null;
  const isUpload = options?.body instanceof FormData || endpointPath.includes('upload');
  const timeoutMs = (options as any)?.timeout || (isUpload ? 180000 : 8000);

  for (const base of uniqueBases) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
      const res = await fetch(`${base}${cleanPath}`, {
        ...options,
        signal: options?.signal || controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        if (typeof window !== 'undefined' && window.localStorage && base.startsWith('http') && !base.includes('vercel.app')) {
          const rawBase = base.replace(/\/api\/prints$/, '');
          window.localStorage.setItem('arka_api_url', rawBase);
          if (rawBase.includes('trycloudflare.com')) {
            window.localStorage.setItem('arka_tunnel_url', rawBase);
          }
        }
        return res;
      } else {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Server responded with status ${res.status}`);
      }
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to connect to print server across all endpoints');
}

class PrintsApi {
  async fetchStatus(): Promise<SystemStatus> {
    try {
      const res = await fetchWithFallback('/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
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
    try {
      const res = await fetchWithFallback(`/history?limit=${limit}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async getPrinters(refresh = false): Promise<PrinterInfo[]> {
    try {
      const res = await fetchWithFallback(`/printers?refresh=${refresh}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async getQueue(): Promise<QueueJob[]> {
    try {
      const res = await fetchWithFallback('/queue');
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async getLogs(category = 'ALL', level = 'ALL', limit = 150): Promise<LogEntry[]> {
    try {
      const res = await fetchWithFallback(`/logs?category=${category}&level=${level}&limit=${limit}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async getStatistics(): Promise<any[]> {
    try {
      const res = await fetchWithFallback('/statistics');
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async getSettings(): Promise<Record<string, any>> {
    try {
      const res = await fetchWithFallback('/settings');
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  }

  async saveSettings(settings: Record<string, any>): Promise<any> {
    const res = await fetchWithFallback('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return await res.json();
  }

  async testPrinter(printerName: string): Promise<any> {
    const res = await fetchWithFallback('/test-printer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printer: printerName })
    });
    return await res.json();
  }

  async clearQueue(): Promise<any> {
    const res = await fetchWithFallback('/clear-queue', { method: 'POST' });
    return await res.json();
  }

  async retryJob(jobId: string): Promise<any> {
    const res = await fetchWithFallback('/queue/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    return await res.json();
  }

  async cancelJob(jobId: string): Promise<any> {
    const res = await fetchWithFallback('/queue/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    return await res.json();
  }

  async deleteDocument(id: string, fileId?: string, fileName?: string): Promise<any> {
    const res = await fetchWithFallback('/delete-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fileId, fileName })
    });
    return await res.json();
  }

  async deleteAllDocuments(): Promise<any> {
    const res = await fetchWithFallback('/delete-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return await res.json();
  }

  async setPriority(jobId: string, priority: number): Promise<any> {
    const res = await fetchWithFallback('/queue/priority', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, priority })
    });
    return await res.json();
  }

  async reprint(historyId: string, printer?: string, copies?: number): Promise<any> {
    const res = await fetchWithFallback('/reprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historyId, printer, copies })
    });
    return await res.json();
  }

  async manualPrint(jobId: string, printer?: string, copies?: number, colorMode?: string): Promise<any> {
    const res = await fetchWithFallback('/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, printer, copies, colorMode })
    });
    return await res.json();
  }

  async overrideImage(jobId: string, overrides: Record<string, any>): Promise<any> {
    const res = await fetchWithFallback('/override-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, ...overrides })
    });
    return await res.json();
  }

  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchWithFallback('/upload-file', {
      method: 'POST',
      body: formData
    });
    return await res.json();
  }

  getDownloadUrl(type: 'original' | 'processed', id: string): string {
    return `${getApiBase()}/download/${type}/${id}`;
  }

  async fetchPrinterStatus(): Promise<Record<string, string>> {
    try {
      const res = await fetchWithFallback('/printer-status');
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  }

  getPreviewUrl(id: string): string {
    return `${getApiBase()}/preview/${id}`;
  }

  async uploadDocument(fileOrFiles: File | File[], copies: number = 1, colorMode: string = 'BlackWhite'): Promise<any> {
    const formData = new FormData();
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    files.forEach(f => {
      formData.append('document', f);
    });
    formData.append('copies', copies.toString());
    formData.append('colorMode', colorMode);
    const res = await fetchWithFallback('/upload-document', {
      method: 'POST',
      body: formData
    });
    return await res.json();
  }

  async fetchEmailWatcherStatus(): Promise<any> {
    try {
      const res = await fetchWithFallback('/email-watcher/status');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async mergeAndUploadIdCard(frontFile: File, backFile: File, orientation: 'vertical' | 'horizontal' = 'vertical', copies: number = 1, colorMode: string = 'Color'): Promise<any> {
    const formData = new FormData();
    formData.append('front', frontFile);
    formData.append('back', backFile);
    formData.append('orientation', orientation);
    formData.append('copies', copies.toString());
    formData.append('colorMode', colorMode);
    const res = await fetchWithFallback('/merge-id-card', {
      method: 'POST',
      body: formData
    });
    return await res.json();
  }

  async fetchChannelDiagnostics(): Promise<any> {
    try {
      const res = await fetchWithFallback('/channel-diagnostics');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async verifyChannelsNow(): Promise<any> {
    try {
      const res = await fetchWithFallback('/channel-diagnostics/verify-now', {
        method: 'POST'
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  getApiBase(): string {
    return getApiBase();
  }

  setCustomApiBase(url: string | null): void {
    setCustomApiBase(url);
  }
}

export const api = new PrintsApi();


