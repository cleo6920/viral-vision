type LogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  data?: any;
};

const STORAGE_KEY = 'viralwizard_logs_buffer';

function safeClone(obj: any): any {
  try {
    const seen = new WeakSet();
    const clone = (original: any): any => {
      if (original === null || typeof original !== 'object') return original;
      if (original instanceof File || original instanceof Blob) {
        return `[File/Blob: ${original.type} size: ${original.size}]`;
      }
      if (seen.has(original)) return '[Circular]';
      seen.add(original);
      if (Array.isArray(original)) return original.map(clone);
      return Object.fromEntries(Object.entries(original).map(([k, v]) => [k, clone(v)]));
    };
    return clone(obj);
  } catch (e) {
    return '[Unserializable Data]';
  }
}

const getInitialLogs = (): LogEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

let globalLogs: LogEntry[] = getInitialLogs();

const saveLogs = () => {
  if (typeof window === 'undefined') return;
  try {
    // Optimization: Cap logs in memory before saving to prevent stringify explosion
    if (globalLogs.length > 400) {
      globalLogs = globalLogs.slice(-300);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalLogs));
  } catch (e) {
    // If it fails (quota), clear more logs
    if (globalLogs.length > 100) {
      globalLogs = globalLogs.slice(-50);
      saveLogs();
    }
  }
};

class BlackBoxLogger {
  private get logs(): LogEntry[] {
    return globalLogs;
  }

  constructor() {
    this.info("BlackBoxLogger instance created");
    if (typeof window !== 'undefined') {
      (window as any).__VIRAL_LOGGER__ = this;
    }
  }

  info(message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      source: 'App',
      message,
      data: data ? safeClone(data) : undefined
    };
    this.logs.push(entry);
    saveLogs();
    console.log(`[LOGGER-INFO] ${message}`, data || '');
  }

  warn(message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      source: 'App',
      message,
      data: data ? safeClone(data) : undefined
    };
    this.logs.push(entry);
    saveLogs();
    console.warn(`[LOGGER-WARN] ${message}`, data || '');
  }

  error(message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      source: 'App',
      message,
      data: data ? safeClone(data) : undefined
    };
    this.logs.push(entry);
    saveLogs();
    console.error(`[LOGGER-ERROR] ${message}`, data || '');
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  exportLogs(): string {
    console.log("[LOGGER] Exporting logs, count:", this.logs.length);
    return JSON.stringify(this.logs, null, 2);
  }

  downloadLogs() {
    this.info("EXPORT_PAYLOAD_READY", { logCount: this.logs.length });
    const blob = new Blob([this.exportLogs()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viralwizard_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clear() {
    globalLogs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const logger = new BlackBoxLogger();
