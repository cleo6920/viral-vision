import { incrementApiBudget } from './apiBudget';
import { hasGroqApiKey, resolveGroqTextModel } from './providerRouter';
import { logger } from '../../utils/logger';

const EMBEDDED_GROQ_FALLBACK_KEYS: string[] = [];

// Session-level registry for Groq keys orchestration
interface GroqKeyEntry {
  key: string;
  masked: string;
  status: 'HEALTHY' | 'LIMITED';
  cooldownUntil: number;
  assignedCount: number;
  role: 'AUDIO' | 'STRUCTURE' | 'CREATIVE' | 'GENERAL';
}

const GROQ_KEY_REGISTRY: GroqKeyEntry[] = [];
const COOLDOWN_DURATION_MS = 15 * 60 * 1000;
let roundRobinIndex = 0;
let lastCallTime = 0;
const MIN_CALL_DELAY = 750;

function normalizeApiKeyValue(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const obj = input as any;
    if (typeof obj.key === "string") return obj.key;
    if (typeof obj.value === "string") return obj.value;
    if (typeof obj.apiKey === "string") return obj.apiKey;
  }
  return "";
}

function isValidGroqKey(key: unknown): key is string {
  const value = normalizeApiKeyValue(key).trim();
  return !!value && value.startsWith('gsk_');
}

function isValidGeminiKeyLike(key: unknown): key is string {
  const value = normalizeApiKeyValue(key).trim();
  return !!value && (value.startsWith('AIza') || value.startsWith('GEMI'));
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function throttleGroqCall(task: string) {
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < MIN_CALL_DELAY) {
        const delay = MIN_CALL_DELAY - elapsed;
        logger.info(`[GROQ_THROTTLE_WAIT] task=${task} delayMs=${delay}`);
        await sleep(delay);
    }
    lastCallTime = Date.now();
}

export function resolveGroqApiKeys(): string[] {
  const candidates = new Set<string>();
  const env = typeof process !== 'undefined' && process.env ? process.env : {};
  const metaEnv = (import.meta as any).env || {};
  
  // 1. Support GROQ_API_KEYS comma-separated list
  const multiKeys = env.GROQ_API_KEYS || metaEnv.VITE_GROQ_API_KEYS || '';
  if (typeof multiKeys === 'string' && multiKeys.includes(',')) {
    multiKeys.split(',').forEach(k => {
      const trimmed = normalizeApiKeyValue(k).trim();
      if (isValidGroqKey(trimmed)) candidates.add(trimmed);
      else if (isValidGeminiKeyLike(trimmed)) logger.warn(`[GROQ_KEY_FILTER_REJECTED_NON_GROQ_KEY] source=GROQ_API_KEYS keyMask=${maskGroqKey(trimmed) || (trimmed as string).slice(0, 4)} reason=GEMINI_KEY_PREFIX`);
    });
  }

  // 2. Support standard numbered keys
  const sources = [
    { name: 'GROQ_API_KEY', val: env.GROQ_API_KEY },
    { name: 'VITE_GROQ_API_KEY', val: metaEnv.VITE_GROQ_API_KEY },
    { name: 'GROQ_API_KEY_1', val: env.GROQ_API_KEY_1 },
    { name: 'VITE_GROQ_API_KEY_1', val: metaEnv.VITE_GROQ_API_KEY_1 },
    { name: 'GROQ_API_KEY_2', val: env.GROQ_API_KEY_2 },
    { name: 'VITE_GROQ_API_KEY_2', val: metaEnv.VITE_GROQ_API_KEY_2 },
    { name: 'GROQ_API_KEY_3', val: env.GROQ_API_KEY_3 },
    { name: 'VITE_GROQ_API_KEY_3', val: metaEnv.VITE_GROQ_API_KEY_3 },
    { name: 'GLOBAL_GROQ_API_KEY', val: (globalThis as any).GROQ_API_KEY },
  ];

  sources.forEach(s => {
      if (isValidGroqKey(s.val)) {
          const normalized = normalizeApiKeyValue(s.val).trim();
          logger.info(`[GROQ_KEY_SOURCE_DETECTED] source=${s.name} masked=${maskGroqKey(normalized)}`);
          candidates.add(normalized);
      } else if (isValidGeminiKeyLike(s.val)) {
          logger.warn(`[GROQ_KEY_FILTER_REJECTED_NON_GROQ_KEY] source=${s.name} keyMask=${maskGroqKey(s.val)} reason=GEMINI_KEY_PREFIX`);
      }
  });

  for (const key of EMBEDDED_GROQ_FALLBACK_KEYS) {
    if (isValidGroqKey(key)) candidates.add(normalizeApiKeyValue(key).trim());
  }

  const filtered = Array.from(candidates).filter((k) => isValidGroqKey(k));
  logger.info(`[GROQ_KEY_CANDIDATES_AFTER_FILTER] count=${filtered.length} keys=${filtered.map(maskGroqKey).join(',') || 'none'}`);
  return filtered;
}

function initKeyRegistry() {
  if (GROQ_KEY_REGISTRY.length > 0) return;
  const keys = resolveGroqApiKeys();
  if (keys.length === 0) return;

  keys.forEach((key, index) => {
    let role: GroqKeyEntry['role'] = 'GENERAL';
    if (keys.length === 2) {
      role = index === 0 ? 'AUDIO' : 'CREATIVE';
    } else if (keys.length >= 3) {
      if (index === 0) role = 'AUDIO';
      else if (index === 1) role = 'STRUCTURE';
      else role = 'CREATIVE';
    }

    GROQ_KEY_REGISTRY.push({
      key,
      masked: maskGroqKey(key),
      status: 'HEALTHY',
      cooldownUntil: 0,
      assignedCount: 0,
      role
    });
  });

  const registryLog = GROQ_KEY_REGISTRY.map((e, i) => 
    `{index:${i}, key:"${e.masked}", role:"${e.role}", status:"${e.status}"}`
  ).join(',\n   ');

  logger.info(`[GROQ_KEY_REGISTRY_INIT]
count=${GROQ_KEY_REGISTRY.length}
keys=[
   ${registryLog}
]`);
}

function getTaskRole(taskName?: string): GroqKeyEntry['role'] {
  const task = (taskName || 'generic').toLowerCase();
  
  if (task.includes('audio') || task.includes('whisper') || task.includes('market_signals') || task.includes('market_query')) {
    return 'AUDIO';
  }
  if (task.includes('dna') || task.includes('structure') || task.includes('analysis') || task.includes('psychological') || task.includes('judge')) {
    return 'STRUCTURE';
  }
  if (task.includes('creative') || task.includes('strategy') || task.includes('prompt') || task.includes('publishing')) {
    return 'CREATIVE';
  }
  return 'GENERAL';
}

function isEssentialTask(taskName?: string): boolean {
  const task = (taskName || 'generic').toLowerCase();
  const essentialKeywords = [
    'transcription', 'audio', 'market_signals', 'market_query', 'alignment',
    'dna', 'strategy', 'prompts', 'hierarchy', 'analysis', 'blue_ocean', 'hook'
  ];
  return essentialKeywords.some(k => task.includes(k));
}

function selectKeyForTask(taskName?: string): GroqKeyEntry | null {
  initKeyRegistry();
  const now = Date.now();
  const allHealthy = GROQ_KEY_REGISTRY.filter(e => e.status === 'HEALTHY' && now > e.cooldownUntil);
  
  if (allHealthy.length === 0) {
    // ... [existing exhaustion code] ...
    const totalKeys = GROQ_KEY_REGISTRY.length;
    const healthyKeys = GROQ_KEY_REGISTRY.filter(e => e.status === 'HEALTHY' && now <= e.cooldownUntil).length;
    const limitedKeys = GROQ_KEY_REGISTRY.filter(e => e.status === 'LIMITED' || now <= e.cooldownUntil).length;
    const cooldownKeys = GROQ_KEY_REGISTRY.filter(e => e.status === 'LIMITED' || now <= e.cooldownUntil).map(e => ({
       key: e.masked,
       role: e.role,
       cooldownRemainingMs: Math.max(0, e.cooldownUntil - now),
    }));

    let reason = "routing_non_compatibile";
    if (totalKeys === 0) reason = "chiave_non_configurata";
    else if (healthyKeys === 0 && limitedKeys === 0) reason = "nessuna_chiave_sana";
    else if (healthyKeys === 0) reason = "tutte_chiavi_in_cooldown";

    logger.error(`[GROQ_ALL_KEYS_EXHAUSTED]
task=${taskName}
totalKeys=${totalKeys}
healthyKeys=${healthyKeys}
limitedKeys=${limitedKeys}
cooldownKeys=${JSON.stringify(cooldownKeys)}
reason=${reason}`);
    
    return null;
  }
  
  const role = getTaskRole(taskName);
  
  let candidates = allHealthy.filter(e => e.role === role);
  let usedFallback = false;
  
  if (candidates.length === 0) {
      if (isEssentialTask(taskName)) {
          candidates = allHealthy;
          usedFallback = true;
      } else {
          logger.warn(`[GROQ_OPTIONAL_TASK_SKIPPED_DUE_TO_COOLDOWN] task=${taskName} role=${role}`);
          return null;
      }
  }
  
  const entry = candidates[roundRobinIndex % candidates.length];
  const oldIndex = roundRobinIndex % candidates.length;
  roundRobinIndex++;
  const newIndex = roundRobinIndex % candidates.length;
  
  if (usedFallback) {
      logger.info(`[GROQ_ROUTING_FALLBACK] task=${taskName} fromRole=${role} toKey=${entry.masked} reason=primary_limited_or_unavailable`);
  } else {
      logger.info(`[GROQ_KEY_ROTATION_SELECTED] module=${taskName} keyIndex=${oldIndex} keyMask=${entry.masked} role=${entry.role} operationalMode=PRODUCTION modelTier=VERSATILE`);
  }
  
  entry.assignedCount++;
  return entry;
}

function markKeyLimited(key: string, task: string, errorText?: string, retryAfter?: string) {
  const entry = GROQ_KEY_REGISTRY.find(e => e.key === key);
  const index = GROQ_KEY_REGISTRY.findIndex(e => e.key === key);
  if (entry) {
    let rateLimitType = 'UNKNOWN';
    if (errorText) {
        if (errorText.includes('RPM')) rateLimitType = 'RPM';
        else if (errorText.includes('TPM')) rateLimitType = 'TPM';
        else if (errorText.includes('TPD')) rateLimitType = 'TPD';
        else if (errorText.includes('RPD')) rateLimitType = 'RPD';
    }

    let cooldownMs = COOLDOWN_DURATION_MS;
    if (retryAfter) {
        cooldownMs = parseInt(retryAfter, 10) * 1000 || cooldownMs;
    } else if (rateLimitType === 'RPM' || rateLimitType === 'TPM') {
        cooldownMs = 60 * 1000; // 1 minute
    }

    entry.status = 'LIMITED';
    entry.cooldownUntil = Date.now() + cooldownMs;
    
    logger.warn(`[GROQ_KEY_FAILED] keyIndex=${index} reason=${rateLimitType} retryWithNext=true`);
    logger.warn(`[GROQ_KEY_TEMP_DISABLED] keyIndex=${index} cooldownMs=${cooldownMs} reason=${rateLimitType}`);
  }
}

export function getGroqConfig() {
  initKeyRegistry();
  const allKeys = GROQ_KEY_REGISTRY.map(e => e.key);
  const healthyKeys = GROQ_KEY_REGISTRY.filter(e => e.status === 'HEALTHY' && Date.now() > e.cooldownUntil).map(e => e.key);
  const selectedKey = healthyKeys[0] || allKeys[0] || '';
  const allKeysInCooldown = allKeys.length > 0 && healthyKeys.length === 0;

  if (selectedKey && !isValidGroqKey(selectedKey)) {
    throw new Error('GROQ_KEY_RESOLUTION_FAILED_NON_GROQ_KEY');
  }
  
  return {
    enabled: allKeys.length > 0 || hasGroqApiKey(),
    hasHealthyKeys: healthyKeys.length > 0,
    allKeysInCooldown,
    apiKey: selectedKey,
    apiKeys: healthyKeys.length > 0 ? healthyKeys : (allKeys.length > 0 ? [allKeys[0]] : []),
    allKeys,
    baseUrl: '/api/groq',
    defaultTextModel: resolveGroqTextModel(),
    defaultSpeechModel: 'whisper-large-v3',
  };
}

export function maskGroqKey(apiKey?: unknown): string {
  const value = normalizeApiKeyValue(apiKey).trim();
  if (!value) return '';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function groqTextCompletion(payload: {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  timeoutMs?: number;
  task?: string;
}) {
  const timeoutMs = payload.timeoutMs || 120000;
  const config = getGroqConfig();
  let lastError: any = null;
  const attemptedKeys = new Set<string>();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = Date.now();
  try {
    await throttleGroqCall(payload.task || 'text_completion');
    incrementApiBudget({ groqCallCount: 1, groqTextCallCount: 1, textOnlyCallCount: 1 });
    
    // Use local proxy for chat
    const response = await fetch(`${config.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Key is provided by the server proxy
      },
      body: JSON.stringify({
        model: payload.model || config.defaultTextModel,
        messages: payload.messages,
        temperature: payload.temperature ?? 0.2,
        response_format: payload.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`GROQ_CHAT_HTTP_${response.status}: ${errorText || response.statusText}`);
    }

    const json = await response.json();
    const text = typeof json?.choices?.[0]?.message?.content === 'string'
      ? json.choices[0].message.content.trim()
      : '';

    const latencyMs = Date.now() - startTime;
    logger.info(`[GROQ_CALL_SUCCEEDED] module=${payload.task} latencyMs=${latencyMs}`);

    return {
      text,
      model: json?.model || payload.model || config.defaultTextModel,
      provider: 'GROQ' as const,
      keySource: 'server_proxy',
      raw: json,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function groqWhisperTranscription(payload: {
  file: File | Blob;
  fileName?: string;
  language?: string;
  prompt?: string;
  timeoutMs?: number;
  task?: string;
}) {
  const timeoutMs = payload.timeoutMs || 120000;
  const config = getGroqConfig();
  let lastError: any = null;
  const attemptedKeys = new Set<string>();
  const isTimeoutMessage = (message: string) =>
    message.includes('GROQ_TRANSCRIBE_TIMEOUT') || message.includes('GROQ_TRANSCRIBE_TIMEOUT_' + timeoutMs);
  const decorateTimeoutError = (error: any, source: string) => {
    const message = String(error?.message || error || '');
    const timeoutError = new Error(message || `GROQ_TRANSCRIBE_TIMEOUT_${timeoutMs}`);
    (timeoutError as any).isTimeout = true;
    (timeoutError as any).timeoutMs = timeoutMs;
    (timeoutError as any).source = source;
    return timeoutError;
  };

  const tryServerProxy = async () => {
    const formData = new FormData();
    formData.append('file', payload.file, payload.fileName || 'audio-input.wav');
    formData.append('model', config.defaultSpeechModel);
    if (payload.language) formData.append('language', payload.language);
    if (payload.prompt) formData.append('prompt', payload.prompt);

    console.info("[GROQ_CLIENT_PROXY_TRY] Attempting server-side transcription proxy...");
    
    const response = await fetch('/api/groq/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let parsed: any = null;
      if (errorText && (errorText.trim().startsWith('{') || errorText.trim().startsWith('['))) {
        try {
          parsed = JSON.parse(errorText);
        } catch {
          parsed = null;
        }
      }
      const details = String(parsed?.details || parsed?.error || errorText || response.statusText || '');
      
      console.error("[GROQ_CLIENT_PROXY_FAIL]", {
        status: response.status,
        statusText: response.statusText,
        details
      });

      if (isTimeoutMessage(details)) {
        throw decorateTimeoutError(new Error(details), 'server_proxy');
      }
      throw new Error(`GROQ_SERVER_PROXY_HTTP_${response.status}: ${details || response.statusText}`);
    }

    let rawText = '';
    let json: any;
    try {
      rawText = await response.text();
      json = JSON.parse(rawText);
    } catch (e) {
      console.error("[GROQ_CLIENT_PARSE_FAIL]", { rawText, status: response.status });
      throw new Error(`Invalid JSON from server proxy: ${rawText.slice(0, 100)}`);
    }

    console.log("[GROQ_CLIENT_TRANSCRIPTION_PARSED]", {
      hasText: typeof json?.text === 'string' && json.text.trim().length > 0,
      textPreview: typeof json?.text === 'string' ? json.text.trim().slice(0, 120) : '',
      segmentsCount: Array.isArray(json?.segments) ? json.segments.length : 0,
      duration: typeof json?.duration === 'number' ? json.duration : null,
    });
    return {
      transcript: typeof json?.text === 'string' ? json.text.trim() : '',
      language: typeof json?.language === 'string' ? json.language.trim() : payload.language || '',
      duration: typeof json?.duration === 'number' ? json.duration : null,
      segments: Array.isArray(json?.segments) ? json.segments : [],
      model: config.defaultSpeechModel,
      provider: 'GROQ' as const,
      keySource: 'server_proxy',
      raw: json,
    };
  };

  try {
    return await tryServerProxy();
  } catch (proxyError: any) {
    console.error("[GROQ_CLIENT_TRANSCRIPTION_CRITICAL_FAIL] Server proxy failed.", proxyError);
    // CRITICAL: In AI Studio iframe environment, direct browser -> Groq calls are BLOCKED by CORS.
    // We MUST NOT fall back to direct calls as they will only pollute the console with CORS errors
    // and provide no benefit. We throw the proxy error and let the pipeline handle it.
    throw proxyError;
  }
} // End of function (removing the while(true) loop)


