import { GoogleGenAI } from '@google/genai';
import { logger } from '@/src/utils/logger';
import { ModelUsageEntry, ModelUsageTrace, ModelExecutionSummary, AnalysisMode, AnalyticMode } from '@/src/types';
import { incrementApiBudget } from '../ai/apiBudget';
import { AIProviderTaskType, hasGroqApiKey, isGroqMode, isHuggingMode, hasHuggingFaceApiKey, resolveHuggingFaceModel, logKeyPolicyDecision, resolveProviderPolicy } from '../ai/providerRouter';
import { getGroqConfig, groqTextCompletion } from '../ai/groqClient';
import { hfChatCompletion, hfVisionAnalysis } from '../ai/huggingFaceClient';

export function logModelUsage(trace: ModelUsageTrace, entry: ModelUsageEntry) {
  if (!trace.entries) trace.entries = [];
  trace.entries.push(entry);
}

export type TaskImportance = 'COGNITIVE' | 'MODERATE' | 'BANAL' | 'AUXILIARY';

/**
 * Rigidly decides which model to use based on the user's selected mode and task importance.
 */
export function resolveModelMode(
  mode: AnalysisMode | AnalyticMode | string,
  importance: TaskImportance,
  nodeName?: string
): "flash" | "pro" {
  const normMode = (mode || 'FLASH').toUpperCase() as AnalyticMode;

  if (normMode === 'FLASH' || normMode === 'TEST') return "flash";

  if (normMode === 'PRO') {
    // Pro for cognitive, Flash for banal
    return importance === 'COGNITIVE' ? "pro" : "flash";
  }

  if (normMode === 'SMART') {
    // PRO for these specific high-value nodes and their retry/finalization aliases
    const proNodes = [
      "Video Summary Extraction",
      "Content Hierarchy Reasoner",
      "Video Analysis Generation",
      "Strategic Market Analysis"
    ];
    const normalizedNode = (nodeName || "").trim();
    const isProNode = proNodes.some((entry) =>
      normalizedNode === entry ||
      normalizedNode.startsWith(`${entry} (`) ||
      normalizedNode.startsWith(`${entry} `) ||
      normalizedNode === `${entry} Fallback`
    );
    const smartProAliases = [
      "Final Viral Analysis",
      "Analyze Content",
      "Viral Brain Analysis",
      "Decision Gate",
      "Query Alignment Validation",
      "Video Relevance Validation",
      "Comparable Videos Gem Search",
    ];
    if (isProNode || smartProAliases.includes(normalizedNode)) {
      return "pro";
    }
    return "flash";
  }

  return "flash";
}

export function computeFidelity(trace?: ModelUsageTrace): "FULL" | "PARTIAL" | "LOW" {
  if (!trace || !trace.entries || trace.entries.length === 0) return "FULL";
  const total = trace.entries.length;
  const fallbacks = trace.entries.filter(e => e.fallback).length;

  if (fallbacks === 0) return "FULL";
  if (fallbacks < total / 2) return "PARTIAL";
  return "LOW";
}

// --- GLOBAL FALLBACK POLICY ---
// The philosophy: Try the most capable available, anchor to gemini-1.5-flash for stability.
export const PRO_FALLBACK_CHAIN = ['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];
export const FLASH_FALLBACK_CHAIN = ['gemini-2.0-flash', 'gemini-1.5-flash'];
export const LITE_FALLBACK_CHAIN = ['gemini-2.0-flash', 'gemini-1.5-flash'];

export function getModelFallbackChain(plannedModelName: string): string[] {
  let chain: string[];
  if (plannedModelName.includes('pro')) chain = [...PRO_FALLBACK_CHAIN];
  else if (plannedModelName.includes('flash') && !plannedModelName.includes('lite')) chain = [...FLASH_FALLBACK_CHAIN];
  else chain = [...LITE_FALLBACK_CHAIN];

  if (!chain.includes(plannedModelName)) {
    chain.unshift(plannedModelName);
  }
  return chain;
}

export function getNextModelInChain(currentModel: string, chain: string[]): string | null {
  const currentIndex = chain.indexOf(currentModel);
  if (currentIndex !== -1 && currentIndex < chain.length - 1) {
    return chain[currentIndex + 1];
  }
  return null;
}

export function computeExecutionSummary(trace?: ModelUsageTrace): ModelExecutionSummary {
  const entries = trace?.entries || [];
  const fidelity = computeFidelity(trace);
  
  const proUsed = entries.some(e => e.actual === 'pro');
  const proPlanned = entries.some(e => e.planned === 'pro');
  const proFallbackCount = entries.filter(e => e.planned === 'pro' && e.actual === 'flash').length;
  const totalFallbacks = entries.filter(e => e.fallback).length;
  
  const allFlash = entries.length > 0 && entries.every(e => e.actual === 'flash');
  const allPro = entries.length > 0 && entries.every(e => e.actual === 'pro');
  
  let executionMode: "FLASH_ONLY" | "PRO_ONLY" | "MIXED" = "MIXED";
  if (allFlash) executionMode = "FLASH_ONLY";
  else if (allPro) executionMode = "PRO_ONLY";
  
  let proStatus: "NOT_REQUESTED" | "USED" | "DEGRADED_TO_FLASH" = "NOT_REQUESTED";
  if (!proPlanned) {
    proStatus = "NOT_REQUESTED";
  } else if (proUsed) {
    proStatus = "USED";
  } else {
    proStatus = "DEGRADED_TO_FLASH";
  }

  const totalTokens = entries.reduce((acc, curr) => acc + (curr.tokensUsed || 0), 0);
  const totalCost = entries.reduce((acc, curr) => acc + (curr.cost || 0), 0);
  const modelsUsed = [...new Set(entries.map(e => e.modelName || 'unknown'))];

  return {
    totalTokens,
    totalCost,
    modelsUsed,
    fidelity,
    executionMode
  };
}

let exhaustedKeys = new Set<string>();
let blockedKeys = new Set<string>();
let systemKeys: string[] = [];
let failedModels = new Set<string>();

export function getFailedModels(): Set<string> {
  return failedModels;
}

export function normalizeApiKeyValue(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const obj = input as any;
    if (typeof obj.key === "string") return obj.key;
    if (typeof obj.value === "string") return obj.value;
    if (typeof obj.apiKey === "string") return obj.apiKey;
  }
  return "";
}

export function maskApiKeySafe(input: unknown): string {
  const key = normalizeApiKeyValue(input).trim();
  if (!key) return "KEY_NOT_AVAILABLE";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function maskKey(key?: unknown) {
  return maskApiKeySafe(key);
}

function isValidGroqKey(key: unknown): key is string {
  const value = normalizeApiKeyValue(key).trim();
  return !!value && value.toLowerCase().startsWith('gsk_');
}

function isValidGeminiKey(key: unknown): key is string {
  const value = normalizeApiKeyValue(key).trim();
  if (!value || value.length <= 5) return false;
  if (isValidGroqKey(value)) return false;
  const s = value as string;
  return s.startsWith('AIza') || s.startsWith('GEMI');
}

function pushCandidateSource(
  sourceMap: Map<string, Set<string>>,
  key: unknown,
  source: string
) {
  const normalized = normalizeApiKeyValue(key).trim();
  if (!normalized) return;
  if (!sourceMap.has(normalized)) sourceMap.set(normalized, new Set());
  sourceMap.get(normalized)!.add(source);
}

function getKeySourceLabel(sourceMap: Map<string, Set<string>>, key?: string): string {
  if (!key) return 'UNKNOWN_SOURCE';
  const labels = Array.from(sourceMap.get(key)?.values() || []);
  if (labels.length === 0) return 'UNKNOWN_SOURCE';
  return labels.join('+');
}

const GEMINI_DEFAULT_ENV_SOURCE_LABELS = [
  'ENV_VITE_GEMINI_API_KEY',
  'ENV_GEMINI_API_KEY',
  'ENV_GOOGLE_API_KEY',
  'ENV_API_KEY'
] as const;

function isDefaultGeminiEnvSource(keySource?: string): boolean {
  if (!keySource) return false;
  return GEMINI_DEFAULT_ENV_SOURCE_LABELS.some((label) => keySource.includes(label));
}

function getUploadFallbackKeys(primaryKey?: string): string[] {
  const { allAvailable } = getAI(undefined, false, 'MODERATE', 'MULTIMODAL_SUMMARY');
  const normalizedPrimary = typeof primaryKey === 'string' ? primaryKey.trim() : '';
  return Array.from(new Set(
    allAvailable.filter((key) => !!key && key.trim() && key.trim() !== normalizedPrimary)
  ));
}

/**
 * Updates the internal system keys list. This is typically used to sync 
 * keys found on the server (like the 'up' secret) into the client.
 */
export function setSystemKeys(keys: string[]) {
  systemKeys = Array.from(new Set(keys.filter((k) => isValidGeminiKey(k))));
  resetQuotaStatus(); // Reset status to try new keys immediately
  logger.info(`[Gemini] System Keys Updated: ${systemKeys.length} keys registered.`);
  if (systemKeys.length > 0) {
    const masked = systemKeys.map((k, i) => `K${i + 1}=${maskApiKeySafe(k)}`);
    logger.info(`[Gemini] Key Priority Chain: ${masked.join(' -> ')}`);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gemini-keys-updated'));
  }
}

let lastKeyResetTime = Date.now();

const AUTO_RESET_INTERVAL = 2 * 60 * 1000; // 2 minutes (faster recovery)

function maybeResetKeys() {
  const now = Date.now();
  if (now - lastKeyResetTime > AUTO_RESET_INTERVAL) {
    logger.info("[Gemini] Auto-resetting blocked and exhausted keys for a fresh attempt.");
    exhaustedKeys.clear();
    blockedKeys.clear();
    lastKeyResetTime = now;
  }
}

export function getQuotaStatus(apiKey?: string) {
  maybeResetKeys();
  const normalized = normalizeApiKeyValue(apiKey).trim();
  if (!normalized) return exhaustedKeys.size > 0;
  return exhaustedKeys.has(normalized);
}

export function resetQuotaStatus(apiKey?: string) {
  const normalized = normalizeApiKeyValue(apiKey).trim();
  if (normalized) {
    exhaustedKeys.delete(normalized);
    blockedKeys.delete(normalized);
  } else {
    exhaustedKeys.clear();
    blockedKeys.clear();
    lastKeyResetTime = Date.now();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gemini-quota-status', { detail: { status: 'OK' } }));
  }
}

export function resetRuntimeProviderState() {
  resetQuotaStatus();
  if (typeof window !== 'undefined') {
     window.dispatchEvent(new CustomEvent('provider-runtime-state-reset'));
  }
  logger.info("[PROVIDER_RUNTIME_STATE_RESET] reason=USER_RESET_RESULTS clearedGeminiTransient=true clearedGroqTransient=true clearedYouTubeTransient=true keysPreserved=true");
}

const discoveredModelCache = new Map<string, { model: string, expires: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export async function discoverGeminiModels(apiKey: string): Promise<string[]> {
  const tryDiscovery = async (version: string) => {
    try {
      logger.info(`[GEMINI_MODEL_DISCOVERY_STARTED] apiVersion=${version}`);
      const res = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`);
      if (!res.ok) {
          logger.warn(`[GeminiDiscovery] [LIST_MODELS_FAILED] version=${version} status=${res.status}`);
          return [];
      }
      const data = await res.json();
      const models = data.models || [];
      
      return models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));
    } catch (e) {
      return [];
    }
  };

  // Try v1beta first, then v1
  let models = await tryDiscovery('v1beta');
  if (models.length === 0) {
      models = await tryDiscovery('v1');
  }

  return models;
}

export async function discoverGeminiModel(apiKey: string): Promise<string | null> {
  const cached = discoveredModelCache.get(apiKey);
  if (cached && Date.now() < cached.expires) {
    logger.info(`[GeminiDiscovery] [LIST_MODELS_CACHE_HIT] model=${cached.model}`);
    return cached.model;
  }

  const models = await discoverGeminiModels(apiKey);
  
  const priority = [
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  for (const p of priority) {
    if (models.includes(p)) {
      logger.info(`[GEMINI_MODEL_DISCOVERY_RESULT] selectedModel=${p} source=listModels`);
      discoveredModelCache.set(apiKey, { model: p, expires: Date.now() + CACHE_TTL });
      return p;
    }
  }

  if (models.length > 0) {
    const first = models[0];
    discoveredModelCache.set(apiKey, { model: first, expires: Date.now() + CACHE_TTL });
    return first;
  }
  return null;
}

export function invalidateModelDiscoveryCache(apiKey?: string) {
  if (apiKey) discoveredModelCache.delete(apiKey);
  else discoveredModelCache.clear();
}

function isAiStudioLikeHost(hostname: string): boolean {
  const normalized = (hostname || '').toLowerCase();
  return (
    normalized.includes('ais-dev') ||
    normalized.includes('ais-pre') ||
    normalized.includes('aistudio.google.com') ||
    normalized.includes('iadispatcher') ||
    normalized.includes('cloudshell') ||
    normalized.endsWith('.google.com')
  );
}

export function getAI(providedKey?: string, forceFree = false, importance: TaskImportance = 'BANAL', taskType: AIProviderTaskType = 'MULTIMODAL_SUMMARY') {
  maybeResetKeys();
  const isPlaceholder = (val?: string) => {
    if (!val || typeof val !== 'string') return true;
    const v = val.trim().toUpperCase();
    
    // Explicitly reject Groq-like keys at the earliest point
    if (v.startsWith('GSK_')) {
        logger.warn(`[GEMINI_KEY_REJECTED_GSK] key=${maskKey(val)}`);
        return false;
    }
    
    return ['MY_GEMINI_API_KEY', 'YOUR_API_KEY', 'GEMINI_API_KEY_HERE', 'MY_APP_URL', 'PLACEHOLDER', 'TODO_KEYHERE'].some(p => v.includes(p));
  };

  const envVars = typeof process !== 'undefined' && process.env ? process.env : {};
  const metaEnv = (import.meta as any).env || {};
  const geminiEnvCandidates = [
    { value: metaEnv.VITE_GEMINI_API_KEY, source: 'ENV_VITE_GEMINI_API_KEY' },
    { value: envVars.GEMINI_API_KEY, source: 'ENV_GEMINI_API_KEY' },
    { value: envVars.GOOGLE_API_KEY, source: 'ENV_GOOGLE_API_KEY' },
    { value: envVars.API_KEY, source: 'ENV_API_KEY' },
  ];

  let geminiPlatformKey: string | undefined;
  for (const candidate of geminiEnvCandidates) {
    if (typeof candidate.value === 'string' && candidate.value.trim()) {
      geminiPlatformKey = candidate.value.trim();
      break;
    }
  }

  const policy = resolveProviderPolicy(taskType);
  
  // [GEMINI_GROQ_DIAGNOSTIC_LOG]
  const currentModelTier = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;

  if ((currentModelTier === 'groq' || isGroqMode(taskType) || isGroqMode(providedKey)) && taskType !== 'TEST_LIGHT' && taskType !== 'EYE_EAR_MULTIMODAL') {
    logger.info("[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] getAI called for key resolution during Groq mode. Blocking.", { taskType, importance });
    // We return a limited set to prevent actual calls but allow the app to initialize if needed
    return {
      ai: null as any,
      isPaid: false,
      apiKey: '',
      taskType,
      keySource: 'BLOCKED_EXTERNAL_MODE',
      keySourceMap: new Map(),
      allAvailable: [],
      onlyBlockedCandidates: []
    };
  }

  const prefix = currentModelTier === 'groq' ? '[GEMINI_DIAGNOSTIC_ONLY] ' : '';

  if (Math.random() < 0.1 || providedKey) {
    logger.info(`${prefix}[getAI] Selected Task: ${taskType}. Env platform key present: ${!!geminiPlatformKey}`);
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isAiStudioPreview = isAiStudioLikeHost(hostname);
  const preferPlatformKey =
    !!geminiPlatformKey &&
    !isPlaceholder(geminiPlatformKey) &&
    (isAiStudioPreview || importance === 'COGNITIVE' || importance === 'MODERATE');
  logKeyPolicyDecision(taskType, !!geminiPlatformKey && !isPlaceholder(geminiPlatformKey), policy);

  const validateKey = (k: any, source = 'UNKNOWN_SOURCE'): k is string => {
    if (typeof k !== 'string' || !k.trim()) return false;
    const kv = k.trim();
    if (kv.length <= 5 || isPlaceholder(kv)) return false;
    if (isValidGroqKey(kv)) {
      logger.warn(`[GEMINI_KEY_FILTER_REJECTED_NON_GEMINI_KEY] source=${source} keyMask=${maskKey(kv)} reason=GROQ_KEY_PREFIX_GSK`);
      return false;
    }
    if (!isValidGeminiKey(kv)) {
      logger.warn(`[GEMINI_KEY_FILTER_REJECTED_NON_GEMINI_KEY] source=${source} keyMask=${maskKey(kv)} reason=INVALID_GEMINI_PREFIX`);
      return false;
    }
    return true;
  };

  const keySourceMap = new Map<string, Set<string>>();

  if (validateKey(providedKey, 'PROVIDED_KEY')) pushCandidateSource(keySourceMap, providedKey, 'PROVIDED_KEY');
  systemKeys.forEach((k, i) => {
    if (validateKey(k, `SYSTEM_CHAIN_K${i + 1}`)) pushCandidateSource(keySourceMap, k, `SYSTEM_CHAIN_K${i + 1}`);
  });
  geminiEnvCandidates.forEach(({ value, source }) => {
    if (validateKey(value, source)) pushCandidateSource(keySourceMap, value, source);
  });
  
  const globalKey = (globalThis as any).GEMINI_API_KEY;
  if (validateKey(globalKey, 'GLOBAL_GEMINI_API_KEY')) pushCandidateSource(keySourceMap, globalKey, 'GLOBAL_GEMINI_API_KEY');

  // Build a list of all potential keys from all environments (already filtered)
  const availableKeys = Array.from(keySourceMap.keys());
  
  // Sorting/Prioritizing candidates based on the same logic as before but with filtered list
  const rawCandidates = preferPlatformKey && geminiPlatformKey && validateKey(geminiPlatformKey, 'ENV_PLATFORM_GEMINI_KEY') 
    ? [geminiPlatformKey, ...availableKeys]
    : [providedKey || '', ...availableKeys];

  // Flatten and normalize candidates (already normalized by validateKey but doing Set for safety)
  const candidates = Array.from(new Set(rawCandidates.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim())));
  
  // Filter for blocked/exhausted (final validation passed earlier)
  let validCandidates = candidates.filter(k => validateKey(k));
  logger.info(`[GEMINI_KEY_CANDIDATES_AFTER_FILTER] count=${validCandidates.length} keys=${validCandidates.map(maskKey).join(',') || 'none'}`);
  
  const platformKeyStr = (geminiPlatformKey && validateKey(geminiPlatformKey, 'ENV_PLATFORM_GEMINI_KEY')) ? geminiPlatformKey.trim() : undefined;
  const providedKeyStr = (providedKey && validateKey(providedKey, 'PROVIDED_KEY')) ? providedKey.trim() : undefined;

  const stableKeyNormalized = platformKeyStr;
  if (stableKeyNormalized && !policy.allowStableGeminiKey) {
    const nonStableCandidates = validCandidates.filter((k) => k !== stableKeyNormalized && !exhaustedKeys.has(k) && !blockedKeys.has(k));
    if (nonStableCandidates.length > 0) {
      logger.info(`[GEMINI_DEFAULT_KEY_BLOCKED] taskType=${taskType} stableKey=${maskKey(stableKeyNormalized)} reason=TEXTUAL_POLICY nonStableCandidates=${nonStableCandidates.length}`);
      validCandidates = nonStableCandidates;
    } else {
      logger.info(`[GEMINI_DEFAULT_KEY_ALLOWED_CRITICAL] taskType=${taskType} stableKey=${maskKey(stableKeyNormalized)} reason=NO_ALTERNATIVE_WORKING_KEYS`);
    }
  }
  
  // SPECIAL AI STUDIO PREVIEW LOGIC:
  // If we are in an AI Studio preview and we have a platform key, prioritize it for video analysis
  // as foreign keys often fail in this sandboxed environment.
  if (geminiPlatformKey && !isPlaceholder(geminiPlatformKey) && validateKey(geminiPlatformKey, 'ENV_PLATFORM_GEMINI_KEY')) {
    const pk = geminiPlatformKey.trim();
    if (!validCandidates.includes(pk) && validateKey(pk, 'ENV_PLATFORM_GEMINI_KEY')) {
      validCandidates.push(pk);
    }
    // If the providedKey is a "foreign" one (not the platform one), 
    // and we have the platform one, we'll put the platform one near the top 
    // for high-res tasks if needed, but for now just ensure it's available.
  }
  
  // Separate blocked from non-blocked
  const nonExhaustedCandidates = validCandidates.filter(k => !exhaustedKeys.has(k) && !blockedKeys.has(k));
  
  let apiKey = '';
  let isPaid = false;

  const providedIsStableKey = !!stableKeyNormalized && !!providedKeyStr && providedKeyStr === stableKeyNormalized;

  if (forceFree) {
    apiKey = nonExhaustedCandidates[0] || '';
    isPaid = false;
  } else if (preferPlatformKey && policy.allowStableGeminiKey && platformKeyStr && !exhaustedKeys.has(platformKeyStr) && !blockedKeys.has(platformKeyStr) && !isPlaceholder(platformKeyStr)) {
    apiKey = platformKeyStr;
    isPaid = false;
    logger.info(`[Gemini] [KeySelection] Prioritizing default Gemini key as stable anchor.`);
  } else if (providedKeyStr && !exhaustedKeys.has(providedKeyStr) && !blockedKeys.has(providedKeyStr) && (!providedIsStableKey || policy.allowStableGeminiKey)) {
    apiKey = providedKeyStr;
    isPaid = true;
  } else {
    apiKey = nonExhaustedCandidates[0] || '';
    isPaid = false;
  }

  // Final check to ensure we didn't pick up a gsk_ key somehow
  if (apiKey && apiKey.toLowerCase().startsWith('gsk_')) {
    logger.error(`[GEMINI_KEY_CRITICAL_FAILURE] reason=picked_groq_key_despite_filters key=${maskKey(apiKey)}`);
    apiKey = '';
    isPaid = false;
  }

  if (apiKey) {
    logger.info(`${prefix}[GEMINI_VALID_KEY_SELECTED] key=${maskKey(apiKey)}`);
  } else if (validCandidates.length > 0) {
    logger.warn(`${prefix}[GEMINI_NO_VALID_PROVIDER_KEY] All candidates excluded or exhausted.`);
  }

  // Debug logging
  const isRequested = !!providedKey;
  if (validCandidates.length > 0 && (isRequested || Math.random() < 0.02)) {
    const logDetails = validCandidates.map(k => {
      const masked = maskKey(k);
      const source = getKeySourceLabel(keySourceMap, k);
      let status = blockedKeys.has(k) ? "BLOCKED" : (exhaustedKeys.has(k) ? "EXHAUSTED" : "AVAILABLE");
      if (k === apiKey) status += " (SELECTED)";
      return `${masked} [${source}] (${status})`;
    }).join(', ');
    logger.info(`${prefix}[Gemini] Key Selection Audit: [ ${logDetails} ]`);
  }

  if (apiKey) {
    const keySource = getKeySourceLabel(keySourceMap, apiKey);
    logger.info(`${prefix}[Gemini] Key Source Selected: ${maskKey(apiKey)} <= ${keySource}`);
  }

  if (!apiKey && validCandidates.length > 0) {
    logger.warn("[Gemini] No selectable API key remains: all discovered keys are exhausted or blocked.");
  }

  if (apiKey && !isValidGeminiKey(apiKey)) {
    throw new Error('GEMINI_KEY_RESOLUTION_FAILED_NON_GEMINI_KEY');
  }

  const aiInstance = new GoogleGenAI({ 
    apiKey,
    fetch: window.fetch,
    httpOptions: { fetch: window.fetch }
  } as any);

  const blockedList = validCandidates.filter(k => blockedKeys.has(k) || exhaustedKeys.has(k));

  return {
    ai: aiInstance,
    isPaid,
    apiKey,
    taskType,
    keySource: getKeySourceLabel(keySourceMap, apiKey),
    keySourceMap,
    allAvailable: nonExhaustedCandidates,
    onlyBlockedCandidates: blockedList
  };
}

export function checkQuota(apiKey?: string) {
  if (apiKey && exhaustedKeys.has(apiKey)) {
    const now = Date.now();
    if (now - lastKeyResetTime < AUTO_RESET_INTERVAL) {
       throw new Error(`QUOTA_EXHAUSTED: La chiave API (${maskApiKeySafe(apiKey)}) ha raggiunto il limite. Cambia chiave o attendi.`);
    }
  }
}

export async function checkProxyHealth(): Promise<boolean> {
  const url = '/api/gemini/upload/health';
  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    const status = response.status;
    const ok = response.ok;
    const text = await response.text();
    
    let isJson = contentType.includes("application/json");
    if (!isJson && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
        isJson = true;
    }

    logger.info(`[UPLOAD_PROXY_HEALTHCHECK] url=${url} status=${status} contentType=${contentType} ok=${isJson && ok}`);
    
    if (!isJson || !ok) {
        logger.error(`[UPLOAD_PROXY_UNAVAILABLE] reason=NON_JSON_HEALTHCHECK status=${status} contentType=${contentType} bodyPreview=${text.substring(0, 100)}`);
        return false;
    }
    return true;
  } catch (e) {
    logger.error(`[UPLOAD_PROXY_UNAVAILABLE] reason=CONNECTION_ERROR error=${e}`);
    return false;
  }
}

export async function uploadToGeminiProxy(file: File, apiKey: string, onProgress?: (text: string, progress?: number) => void): Promise<string> {
  const url = '/api/gemini/upload';
  logger.info(`[UPLOAD_PROXY_ENDPOINT] url=${url} method=POST hasBody=true fileName=${file.name} fileType=${file.type} fileSizeMB=${(file.size / 1024 / 1024).toFixed(2)}`);
  
  if (onProgress) onProgress("Inizio caricamento tramite proxy server...", 10);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('apiKey', apiKey);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    const contentType = response.headers.get("content-type") || "";
    const status = response.status;
    const statusText = response.statusText;
    const rawText = await response.text();

    if (!response.ok) {
      if (!contentType.includes("application/json") || rawText.startsWith("<!doctype") || rawText.startsWith("<html")) {
        logger.error(`[UPLOAD_PROXY_NON_JSON_RESPONSE] status=${status} statusText=${statusText} contentType=${contentType} url=${url} bodyPreview=${rawText.substring(0, 300)}`);
        throw new Error(`UPLOAD_PROXY_NON_JSON_RESPONSE: Il proxy di upload ha restituito HTML invece di JSON. Probabile endpoint proxy non disponibile o redirect. Upload video non completato. (Status: ${status})`);
      }
      
      let errorData: any = {};
      try {
        errorData = JSON.parse(rawText);
      } catch (e) {}
      
      throw new Error(errorData.error || `Proxy upload failed with status ${status}: ${rawText.substring(0, 100)}`);
    }

    if (!contentType.includes("application/json")) {
      logger.error(`[UPLOAD_PROXY_NON_JSON_RESPONSE] status=${status} statusText=${statusText} contentType=${contentType} url=${url} bodyPreview=${rawText.substring(0, 300)}`);
       throw new Error(`UPLOAD_PROXY_NON_JSON_RESPONSE: Risposta non-JSON ricevuta dal proxy.`);
    }

    const data = JSON.parse(rawText);
    if (onProgress) onProgress("Caricamento tramite proxy completato.", 100);
    return data.fileUri;
  } catch (error: any) {
    logger.error("[Gemini] Proxy upload error:", error);
    throw error;
  }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error("Timeout converting file to base64"));
    }, 60000); // 60 seconds
    reader.readAsDataURL(file);
    reader.onload = () => {
      clearTimeout(timeout);
      const base64String = reader.result?.toString().split(',')[1];
      if (base64String) resolve(base64String);
      else reject(new Error("Failed to convert file to base64"));
    };
    reader.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
    reader.onabort = () => {
        clearTimeout(timeout);
        reject(new Error("FileReader aborted"));
    };
  });
}

export async function uploadToGemini(file: File, apiKey: string, onProgress?: (text: string, progress?: number) => void, signal?: AbortSignal): Promise<string> {
  const analysisModelTier = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
  if (analysisModelTier === 'groq' || isGroqMode(apiKey)) {
    logger.info("[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] uploadToGemini called during Groq mode. Blocking.");
    throw new Error("[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] Gemini uploads are disabled in external mode. Skipping redundant upload.");
  }

  logger.info("[REAL_UPLOAD_START]");
  const getKeyFingerprint = (k: string) => {
    const normalized = normalizeApiKeyValue(k).trim();
    return normalized ? normalized.slice(-4) : "NONE";
  };
  const keyFingerprint = getKeyFingerprint(apiKey);
  logger.info(`[Gemini] [KEY_FINGERPRINT_UPLOAD_INIT] ${keyFingerprint}`);

  const isPreview = typeof window !== 'undefined' && isAiStudioLikeHost(window.location.hostname);
  
  const sanitizedName = `${(file.name || 'video_upload')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 30)}_${Date.now()}`;
    
  const performDirectUpload = async (activeKey: string): Promise<string> => {
    logger.info("[REAL_UPLOAD_DIRECT_ATTEMPT]", { initUrl: `https://generativelanguage.googleapis.com/upload/v1beta/files?key=REDACTED` });
    try {
      if (onProgress) onProgress("Inizio caricamento diretto su Google...", 5);
      
      const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${activeKey}`;
      logger.info("[UPLOAD_INIT_URL]", { initUrl: initUrl.replace(activeKey, 'REDACTED') });

      const initResponse = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': file.size.toString(),
          'X-Goog-Upload-Header-Content-Type': file.type || 'video/mp4',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          file: { display_name: sanitizedName } 
        }),
        signal
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        logger.error("[REAL_UPLOAD_DIRECT_INIT_FAILED]", { status: initResponse.status, error: errorText });
        throw new Error(`Inizializzazione fallita (${initResponse.status}): ${errorText}`);
      }

      const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
      logger.info("[REAL_UPLOAD_DIRECT_SESSION_URL]", { uploadUrl });
      
      if (!uploadUrl) throw new Error("X-Goog-Upload-URL non trovato.");

      if (onProgress) onProgress("Invio dati binari...", 20);

      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        // Append API key if not already present, as it might be required for the session URL
        const finalUploadUrl = uploadUrl.includes('?') ? `${uploadUrl}&key=${activeKey}` : `${uploadUrl}?key=${activeKey}`;
        xhr.open("PUT", finalUploadUrl, true);
        
        if (signal) {
          signal.addEventListener('abort', () => {
            xhr.abort();
            reject(new DOMException("Aborted", "AbortError"));
          });
        }
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.file?.uri) {
                if (onProgress) onProgress("Caricamento completato.", 100);
                logger.info("[UPLOAD_PUT_SUCCESS]", { fileUri: response.file.uri });
                resolve(response.file.uri);
              } else reject(new Error("Missing file.uri in response"));
            } catch (e) { reject(new Error("Invalid JSON")); }
          } else {
             logger.error("[REAL_UPLOAD_DIRECT_XHR_FAILED]", { status: xhr.status, response: xhr.responseText });
             reject(new Error(`Upload fallito (HTTP ${xhr.status}): ${xhr.responseText}`));
          }
        };

        xhr.onerror = () => {
          logger.error("[REAL_UPLOAD_DIRECT_XHR_NETWORK_ERROR]");
          reject(new Error("Network error."));
        };
        xhr.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize');
        xhr.setRequestHeader('X-Goog-Upload-Offset', '0');
        xhr.send(file);
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') logger.error("[REAL_UPLOAD_DIRECT_FAILED]", { error: e.message });
      throw e;
    }
  };

  // EXECUTION: Strictly Direct in Preview, 1 attempt total.
  const fallbackKeys = getUploadFallbackKeys(apiKey);
  const uploadKeyChain = [apiKey, ...fallbackKeys].filter(Boolean);

  if (isPreview) {
      if (file.size > 40 * 1024 * 1024) {
          throw new Error("File troppo grande (> 40MB) per analisi diretta. Usa Lite Analysis.");
      }
      logger.info("[REAL_ANALYSIS_PROFILE_SELECTED] AI_STUDIO_PREVIEW_DIRECT");
      let lastError: any;
      for (const candidateKey of uploadKeyChain) {
        try {
          if (candidateKey !== apiKey) {
            logger.warn(`[UPLOAD_KEY_FALLBACK] Retrying direct upload with alternate Gemini key ${maskKey(candidateKey)}.`);
          }
          return await performDirectUpload(candidateKey);
        } catch (err: any) {
          lastError = err;
          const msg = String(err?.message || err || "");
          const retryable = /quota|403|401|permission|resource_exhausted|exhausted/i.test(msg);
          if (!retryable) throw err;
        }
      }
      throw lastError || new Error("Upload diretto fallito su tutte le chiavi disponibili.");
  }

  // Fallback allowed for production: 1 Direct, 1 Proxy
  try {
    let lastError: any;
    for (const candidateKey of uploadKeyChain) {
      try {
        if (candidateKey !== apiKey) {
          logger.warn(`[UPLOAD_KEY_FALLBACK] Retrying upload with alternate Gemini key ${maskKey(candidateKey)}.`);
        }
        return await performDirectUpload(candidateKey);
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err || "");
        const retryable = /quota|403|401|permission|resource_exhausted|exhausted/i.test(msg);
        if (!retryable) throw err;
      }
    }
    throw lastError;
  } catch (err: any) {
    if (isPreview) {
       logger.info("[REAL_UPLOAD_PROXY_BLOCKED_IN_PREVIEW]");
       throw err;
    }
    logger.warn("[REAL_ANALYSIS_RETRY]", { reason: err.message });
    return await uploadToGeminiProxy(file, apiKey, onProgress);
  }
}


export async function getFileStatus(fileUri: string, apiKey: string, signal?: AbortSignal): Promise<string> {
  if (typeof window !== 'undefined' && (window as any).__VIRAL_RUN_TERMINATED === true) {
    logger.warn(`[getFileStatus] Aborted by __VIRAL_RUN_TERMINATED flag (run manually stopped)`);
    return 'ACTIVE'; // Return active to stop the loop
  }
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 120000); // 120s timeout
  
  const combinedController = new AbortController();
  
  const abortHandler = () => {
    combinedController.abort();
    clearTimeout(timeoutId);
  };
  
  // Link both signals
  signal?.addEventListener('abort', abortHandler, { once: true });
  timeoutController.signal.addEventListener('abort', abortHandler, { once: true });

  try {
    let fetchUrl = `/api/file-status?fileUri=${encodeURIComponent(fileUri)}`;
    if (apiKey) fetchUrl += `&apiKey=${encodeURIComponent(apiKey)}`;
    
    const response = await fetch(fetchUrl, {
      signal: combinedController.signal 
    });
    
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortHandler);
    timeoutController.signal.removeEventListener('abort', abortHandler);

    if (!response.ok) {
      if (response.status === 404) {
        logger.error(`[Gemini] getFileStatus: File not found 404 for ${fileUri}`);
        return 'NOT_FOUND';
      }
      logger.warn(`[Gemini] getFileStatus failed: ${response.status} ${response.statusText} for URL: ${fetchUrl}`);
      return 'ERROR';
    }
    const data = await response.json();
    return data.state || 'ACTIVE';
  } catch (e: any) {
    if (e.name === 'AbortError' || e.name === 'DOMException') {
      logger.error(`[Gemini] getFileStatus aborted or timeout (45s)`);
      return 'TIMEOUT';
    }
    logger.error(`[Gemini] getFileStatus error:`, e);
    return 'ERROR';
  }
}

export async function waitForFileActive(fileUri: string, apiKey: string, onProgress?: (text: string) => void, signal?: AbortSignal): Promise<void> {
  logger.info("[REAL_FILE_STATUS_POLL_START]", { fileUri });
  let activeStatusKey = apiKey;
  let state = await getFileStatus(fileUri, activeStatusKey, signal);
  let attempts = 0;
  const maxAttempts = 300; 

  while ((state === 'PROCESSING' || state === 'TIMEOUT' || state === 'NOT_FOUND' || state === 'ERROR') && attempts < maxAttempts) {
    if (typeof window !== 'undefined' && (window as any).__VIRAL_RUN_TERMINATED === true) {
        logger.info("[POLLING_STOPPED_TERMINAL_STATE] state=TERMINATED source=waitForFileActive");
        return;
    }
    if (signal?.aborted) {
        logger.info("[REAL_ANALYSIS_STOPPED_TO_PROTECT_QUOTA]");
        throw new DOMException("Aborted", "AbortError");
    }
    attempts++;
    
    logger.info("[REAL_ANALYSIS_FILE_STATUS_POLL]", { attempts, state });
    
    if (state === 'NOT_FOUND' || state === 'ERROR') {
       if (attempts > 2) {
         logger.warn("[REAL_ANALYSIS_MAX_RETRY_REACHED]", { attempts, state });
         logger.info("[REAL_FILE_STATUS_POLL_STOPPED]");
         throw new Error(`File non trovato o errore server ripetuto: ${state}`);
       }
       logger.info("[REAL_ANALYSIS_RETRY]", { attempts, state });
    }
    
    if (state === 'NOT_FOUND') {
       if (onProgress) onProgress(`File non ancora indicizzato da Google (tentativo ${attempts})...`);
       await new Promise(r => setTimeout(r, 3000));
    } else if (state === 'ERROR') {
       if (onProgress) onProgress(`Server Google momentaneamente occupato (tentativo ${attempts})...`);
       await new Promise(r => setTimeout(r, 4000));
    } else {
       if (onProgress) onProgress(`Elaborazione video su Google... (Stato: ${state}, tentativo ${attempts})`);
       await new Promise(r => setTimeout(r, 2000));
    }
    
    if ((state === 'NOT_FOUND' || state === 'ERROR') && attempts <= 2) {
      const fallbackKey = getUploadFallbackKeys(activeStatusKey)[0];
      if (fallbackKey) {
        logger.warn(`[UPLOAD_STATUS_KEY_FALLBACK] Retrying file status with alternate key ${maskKey(fallbackKey)}.`);
        activeStatusKey = fallbackKey;
      }
    }
    state = await getFileStatus(fileUri, activeStatusKey, signal);
  }

  if (state === 'FAILED') {
    logger.error("[REAL_FILE_STATUS_POLL_STOPPED]", { reason: "FAILED" });
    throw new Error(`FILE_PROCESSING_FAILED: L'elaborazione del video su Google Ã¨ fallita.`);
  }

  if (state !== 'ACTIVE') {
    logger.error("[REAL_FILE_STATUS_POLL_STOPPED]", { reason: "TIMEOUT_NOT_ACTIVE" });
    throw new Error(`FILE_NOT_ACTIVE: Il file Ã¨ in stato ${state} dopo ${attempts} tentativi.`);
  }
  
  logger.info("[REAL_ANALYSIS_READY_FOR_MODEL]");
  if (onProgress) onProgress("File pronto (ACTIVE). Avvio analisi...");
}

export function selectModel(preferred: string, fallback = 'gemini-1.5-flash', providedKey?: string, taskType: AIProviderTaskType = 'CORE_ANALYSIS'): string {
  const { isPaid, apiKey } = getAI(providedKey, false, 'BANAL', taskType);

  // Map legacy/internal names to the correct, modern model names
  const baseMapping: Record<string, string> = {
    'flash': 'gemini-1.5-flash',
    'pro': 'gemini-1.5-pro',
    'lite': 'gemini-1.5-flash',
    'test': 'gemini-1.5-flash',
    'gemini-1.5-flash': 'gemini-1.5-flash',
    'gemini-1.5-pro': 'gemini-1.5-pro',
    'gemini-flash': 'gemini-1.5-flash',
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-3-flash-preview': 'gemini-1.5-flash',
    'models/gemini-3-flash-preview': 'gemini-1.5-flash',
    'gemini-2.0-pro-exp-02-05': 'gemini-1.5-pro', // Fallback for expired experimental model
    'groq': 'gemini-1.5-flash', // safety net if 'groq' makes it to Gemini calls
  };

  // If we have a discovered model in cache for this key, prefer it if preferred is a generic tier
  if ((preferred === 'flash' || preferred === 'pro' || preferred === 'lite') && apiKey) {
     const cached = discoveredModelCache.get(apiKey);
     if (cached && Date.now() < cached.expires) {
        const mappedCached = baseMapping[cached.model] || cached.model;
        return mappedCached;
     }
  }
  
  let mappedPreferred = baseMapping[preferred] || preferred;
  
  // Guard: if preferred is empty or "flash" use fallback
  if (!mappedPreferred) {
    mappedPreferred = baseMapping[fallback] || fallback;
  }
  
  // Guard: Final resolution for generic names - use modern strings
  if (mappedPreferred === 'pro') mappedPreferred = 'gemini-1.5-pro';
  if (mappedPreferred === 'lite') mappedPreferred = 'gemini-1.5-flash';
  if (mappedPreferred === 'flash') mappedPreferred = 'gemini-1.5-flash';
  if (mappedPreferred === 'groq') mappedPreferred = 'gemini-1.5-flash';
  
  // Guard: We no longer forcefully downgrade Pro models to Flash on free keys
  // because Gemini 3.1 Pro allows 2 RPM even on free tier.
  // We let the network retry logic (executeWithNetworkRetry) handle the 429 quota errors.
  
  return mappedPreferred;
}

export const executeWithNetworkRetry = async (
  op: (ai: any, modelName?: string) => Promise<any>, 
  retries = 1, // Reduced default as per rule
  fallbackOp?: (ai: any, modelName?: string) => Promise<any>, 
  customTimeoutMs?: number, 
  providedApiKey?: string, 
  onProgress?: (text: string) => void, 
  modelName?: string,
  trace?: ModelUsageTrace,
  layer?: string,
  plannedMode?: AnalysisMode | string,
  forcePro?: boolean,
  importance: TaskImportance = 'COGNITIVE',
  disableKeyRotation?: boolean,
  callReason?: string,
  inputSource?: 'video_file' | 'file_uri' | 'video_summary' | 'local_data' | 'text_input' | 'niche_text' | 'script_text' | 'video_frames' | 'hierarchy_data' | 'multi_modal_feedback',
  canUseLocalFallback: boolean = false,
  disableFallbackAcrossModels: boolean = false,
  taskType: AIProviderTaskType = 'MULTIMODAL_SUMMARY'
) => {
  let effectiveTaskType = taskType;
  const isVideoInput = ['video_file', 'file_uri', 'video_frames', 'multi_modal_feedback'].includes(inputSource || '');
  const groqRuntime = getGroqConfig();
  const groqAvailableForTask = hasGroqApiKey() && groqRuntime.hasHealthyKeys && !groqRuntime.allKeysInCooldown;
  
  const analysisModelTier = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
  const isGroqFullMode = isGroqMode(plannedMode) || (analysisModelTier === 'groq');

  if (isGroqFullMode) {
    logger.info(`[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] module=${layer || 'unknown'} task=${taskType || 'unknown'} reason=engine_mode_exclusion`);
    const error = new Error(`[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] Gemini is disabled in external provider mode. Skipping redundant call for ${layer || taskType}.`);
    (error as any).recoverable = true;
    (error as any).shouldRouteToGroq = true;
    (error as any).isExternalBlock = true;
    throw error;
  }

  if (taskType === 'MULTIMODAL_SUMMARY') {
    if (!isVideoInput) {
      effectiveTaskType = 'CORE_ANALYSIS';
      logger.info(`[TEXT_INPUT_MULTIMODAL_DOWNGRADED] fromTask=MULTIMODAL_SUMMARY toTask=CORE_ANALYSIS reason=NO_VISUAL_PAYLOAD provider=GROQ_FALLBACK_POTENTIAL module=${layer || 'unknown'}`);
    } else {
      logger.info(`[MULTIMODAL_SUMMARY_GEMINI_ALLOWED] module=${layer || 'unknown'} reason=HAS_VISUAL_PAYLOAD hasVisualPayload=true inputSource=${inputSource || 'unknown'}`);
    }
  }

  let { apiKey, ai, isPaid, keySource, allAvailable, onlyBlockedCandidates } = getAI(providedApiKey, false, importance, effectiveTaskType);
  
  if (disableKeyRotation && providedApiKey) {
    apiKey = providedApiKey;
    const aiInstance = new GoogleGenAI({ 
      apiKey,
      fetch: window.fetch,
      httpOptions: { fetch: window.fetch }
    } as any);
    ai = aiInstance;
    isPaid = true; 
  }

  // LOGGING OBBLIGATORIO ANTI QUOTE WASTE
  logger.info(`[GEMINI_CALL_REASON] module=${layer || 'unknown'} reason=${callReason || 'not_specified'} inputSource=${inputSource || 'unknown'} canUseLocalFallback=${canUseLocalFallback}`);
  const isHeavyMultimodal = isVideoInput;
  const hfKey = localStorage.getItem('huggingface_api_key') || '';
  
  // --- HUGGING/GROQ-HYBRID VISION INTERCEPTION ---
  if (isHeavyMultimodal && (isHuggingMode(plannedMode) || isGroqMode(plannedMode))) {
    logger.info(`[HUGGING_VISION_MODE_ACTIVE] task=${effectiveTaskType} model=HF-Vision layer=${layer}`);
    // For now, we skip the interception here because frames are not available.
    // The analysis should be handled at the specific transcription/analysis tasks layer.
  }

  const isDefaultGeminiKey = isDefaultGeminiEnvSource(keySource) ? 1 : 0;
  const retryPolicy = resolveProviderPolicy(effectiveTaskType);
  const isTextualPolicyTask = ['MARKET_TEXT', 'MARKET_VALIDATION', 'SCENE_DNA', 'PROMPT_STRATEGY', 'PROMPT_TEXT', 'PROMPT_JUDGE', 'SCENE_MASTER', 'EDITORIAL_TEXT', 'COVER_TEXT', 'JSON_CLEANUP', 'CHAT_ASSISTANT', 'IDEA_ANALYSIS', 'SCRIPT_ANALYSIS', 'CORE_ANALYSIS', 'BLUE_OCEAN'].includes(effectiveTaskType);

  const isGroqAlreadyAttempted = callReason === 'GROQ_REASONING_FAILED' || 
    (callReason && callReason.includes('FAILED')) || 
    (callReason && callReason.includes('fallback')) || 
    (callReason && callReason.includes('BYPASSED')) ||
    callReason === 'GROQ_FAILED' || 
    callReason === 'GroqFirstTextTask_GeminiStep';

  const isGeminiBlocked = isGroqFullMode || (!isHeavyMultimodal && isTextualPolicyTask && groqAvailableForTask && !isGroqAlreadyAttempted);

  if (isTextualPolicyTask || isGroqFullMode) {
    logger.info(`[GEMINI_BLOCK_CHECK]`, {
      module: layer || 'unknown',
      task: effectiveTaskType,
      groqAvailable: groqAvailableForTask,
      groqAlreadyAttempted: isGroqAlreadyAttempted,
      callReason: callReason || 'none',
      willBlockGemini: isGeminiBlocked,
      sourceFunction: 'getAI',
      isGroqFullMode
    });
  }

  if (isGeminiBlocked) {
    logger.info(`[FALLBACK_DECISION]`, {
      module: layer || 'unknown',
      groqAvailable: groqAvailableForTask,
      groqSucceeded: false,
      groqHasValidOutput: false,
      groqAlreadyAttempted: isGroqAlreadyAttempted,
      geminiFallbackAllowed: false,
      reason: isGroqFullMode ? "EXTERNAL_MODE_MANDATORY_BLOCK" : "BLOCKING_GEMINI_TO_FORCE_GROQ"
    });
    logger.info(`[TEXT_ROUTER_GEMINI_FALLBACK_DECISION] allowed=false reason=TEXT_TASK_AND_GROQ_AVAILABLE module=${layer || 'unknown'} taskType=${effectiveTaskType} callReason=${callReason || 'not_specified'} isGroqAlreadyAttempted=${isGroqAlreadyAttempted}`);
    const err = new Error(`GEMINI_TEXT_FALLBACK_BLOCKED_GROQ_AVAILABLE`);
    (err as any).recoverable = true;
    (err as any).shouldRouteToGroq = true;
    (err as any).module = layer || 'unknown';
    (err as any).taskType = effectiveTaskType;
    throw err;
  } else if (isTextualPolicyTask) {
    logger.info(`[FALLBACK_DECISION]`, {
      module: layer || 'unknown',
      groqAvailable: groqAvailableForTask,
      groqSucceeded: false,
      groqHasValidOutput: false,
      groqAlreadyAttempted: isGroqAlreadyAttempted,
      geminiFallbackAllowed: true,
      reason: isGroqAlreadyAttempted ? "PROCEEDING_WITH_GEMINI_GROQ_ALREADY_FAILED" : "PROCEEDING_WITH_GEMINI_GROQ_UNAVAILABLE"
    });
    logger.info(`[TEXT_ROUTER_GEMINI_FALLBACK_DECISION] allowed=true module=${layer || 'unknown'} taskType=${effectiveTaskType} callReason=${callReason || 'not_specified'} isGroqAlreadyAttempted=${isGroqAlreadyAttempted}`);
  }

  incrementApiBudget({
    geminiCallCount: 1,
    defaultKeyUsageCount: isDefaultGeminiKey,
    defaultGeminiKeyUsageCount: isDefaultGeminiKey,
    defaultGeminiKeyTextTaskUsageCount: isDefaultGeminiKey && !isHeavyMultimodal ? 1 : 0,
    defaultGeminiKeyVisionUsageCount: isDefaultGeminiKey && isHeavyMultimodal ? 1 : 0,
    stableKeyEmergencyUsageCount: isDefaultGeminiKey && !retryPolicy.allowStableGeminiKey ? 1 : 0,
    normalGeminiKeyUsageCount: isDefaultGeminiKey ? 0 : 1,
    normalGeminiKeyVisionUsageCount: !isDefaultGeminiKey && isHeavyMultimodal ? 1 : 0,
    normalGeminiKeyTextFallbackUsageCount: !isDefaultGeminiKey && !isHeavyMultimodal && isTextualPolicyTask ? 1 : 0,
    geminiVisionCallCount: isHeavyMultimodal ? 1 : 0,
    geminiTextFallbackCallCount: !isHeavyMultimodal && isTextualPolicyTask ? 1 : 0,
    heavyMultimodalCallCount: isHeavyMultimodal ? 1 : 0,
    textOnlyCallCount: isHeavyMultimodal ? 0 : 1,
  });
  if (!isHeavyMultimodal && isTextualPolicyTask) {
    logger.info(`[GEMINI_TEXT_TASK_FALLBACK_USED] taskType=${effectiveTaskType} reason=${groqAvailableForTask ? 'BLOCKED_BY_GROQ' : (hasGroqApiKey() ? 'GROQ_EXHAUSTED_OR_COOLDOWN' : 'GROQ_NOT_CONFIGURED')}`);
  }

  checkQuota(apiKey);
  
  if (!apiKey) {
    if (onlyBlockedCandidates && onlyBlockedCandidates.length > 0) {
      throw new Error("All provided API keys have been blocked (403) or exhausted. Please provide a new, valid API key in Settings.");
    }
    throw new Error("API key is missing. Please provide a valid API key.");
  }

  // CORE LOGIC: Resolve which model tier we REALLY want based on mode and importance
  const resolvedTier = forcePro ? "pro" : resolveModelMode(plannedMode || 'FLASH', importance, layer);
  
  let modelNameForResolution = modelName || resolvedTier;
  if (modelNameForResolution === 'test') {
    const models = await discoverGeminiModels(apiKey);
    const multimodal = models.filter(m => m.includes('gemini-1.5'));
    modelNameForResolution = multimodal[0] || 'gemini-1.5-flash';
    logger.info("[GEMINI_MODEL_RESOLVED]", {
      selectedModel: "test",
      resolvedModel: modelNameForResolution,
      taskType: effectiveTaskType,
      source: "discovery",
      reason: "TEST_MODE_ALIAS_RESOLVED"
    });
  }
  
  const initialModelName = selectModel(
    modelNameForResolution,
    'gemini-1.5-flash',
    apiKey
  );

  logger.info("[GEMINI_MODEL_RESOLVED]", {
    selectedModel: modelName || resolvedTier,
    resolvedModel: initialModelName,
    reason: "MODEL_RESOLUTION_FROM_TIER_OR_NAME"
  });

  // RIGID FALLBACK: Mode FLASH and TEST NEVER use Pro.
  const normMode = (plannedMode?.toString() || 'FLASH').toUpperCase();
  const allowPro = normMode === 'PRO' || normMode === 'SMART' || forcePro === true;

  const fallbackChain = getModelFallbackChain(initialModelName).filter(m => {
    if (!allowPro && m.includes('pro')) return false;
    if (failedModels.has(m)) return false;
    return true;
  });

  const attemptedModels: string[] = [];
  let currentModelName = initialModelName;

  // --- TRACING LOGIC START ---
  let traceEntry: ModelUsageEntry | undefined;
  if (trace && layer) {
    traceEntry = {
      modelId: initialModelName,
      requestedModelId: initialModelName,
      taskContext: layer,
      layer,
      planned: resolvedTier,
      actual: resolvedTier, // Initial assumption
      fallback: false,
      fallbackReason: "",
      modelName: initialModelName,
      keyLabel: maskKey(apiKey),
      keySource,
      provider: 'GEMINI',
      providerTaskType: effectiveTaskType,
      attemptedModels,
      fallbackChain,
      fallbackDepth: 0,
      status: "success",
      duration: 0,
      timestamp: Date.now()
    };
    logModelUsage(trace, traceEntry);
  }
  // --- TRACING LOGIC END ---
  
  let currentApiKey = apiKey;
  let currentAiInstance = ai;
  const maxRetriesPerModel = retries;
  const startTime = Date.now();

  // New robust loop that iterates through models and then retries
  for (const modelAttempt of fallbackChain) {
    currentModelName = modelAttempt;
    
    for (let retry = 0; retry <= maxRetriesPerModel; retry++) {
      let timeoutId: any;
      const timeoutMs = customTimeoutMs || 120000; 
      
      try {
        checkQuota(currentApiKey);
        if (!attemptedModels.includes(currentModelName)) attemptedModels.push(currentModelName);
        
        const timeoutMs = customTimeoutMs || 120000;
        
        const globalMode = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
        const prefix = globalMode === 'groq' ? '[GEMINI_DIAGNOSTIC_ONLY] ' : '';

        // --- ADDED SURGICAL LOGS ---
        logger.info(`${prefix}[GEMINI_CHAIN_ATTEMPT_START]
module=${layer || 'unknown'}
task=${effectiveTaskType}
model=${currentModelName}
attemptIndex=${retry}
totalAttempts=${maxRetriesPerModel}
timeoutMs=${timeoutMs}`);
        
        const attemptLabel = `${prefix}[Gemini] [${layer || 'Core'}] Model=${currentModelName} Attempt=${retry + 1}`;
        
        logger.info(`${prefix}[GEMINI_MULTIMODAL_MODEL_CALL_ATTEMPT]`, {
          module: layer || 'Core',
          taskType: effectiveTaskType,
          selectedModel: currentModelName,
          resolvedModel: currentModelName,
          inputSource: inputSource || 'unknown',
          hasVisualPayload: isHeavyMultimodal,
          forcePro: forcePro,
          testMode: false,
          reason: "attempt"
        });
        
        logger.info(`${attemptLabel} (forcePro: ${forcePro})`);
        
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        if (onProgress) {
          onProgress(`[Gemini] ${layer || 'Chiamata AI'}: ${currentModelName.replace('gemini-', '')} (tentativo ${retry + 1})...`);
        }

        const currentOp = (retry > 0 && fallbackOp) ? fallbackOp : op;
        
        const attemptStartTime = Date.now();
        const res = await Promise.race([
          currentOp(currentAiInstance, currentModelName), 
          timeoutPromise
        ]);
        if (timeoutId) clearTimeout(timeoutId);
        
        if (traceEntry) {
          traceEntry.modelId = currentModelName;
          traceEntry.actual = currentModelName.includes('pro') ? 'pro' : 'flash';
          traceEntry.modelName = currentModelName;
          traceEntry.fallback = currentModelName !== initialModelName;
          traceEntry.fallbackDepth = Math.max(0, fallbackChain.indexOf(currentModelName));
          traceEntry.keyLabel = maskKey(currentApiKey);
          traceEntry.keySource = keySource;
          traceEntry.duration = Date.now() - startTime;
        }
        
        logger.info(`[GEMINI_CHAIN_ATTEMPT_SUCCESS]
module=${layer || 'unknown'}
task=${effectiveTaskType}
model=${currentModelName}
attemptIndex=${retry}
durationMs=${Date.now() - attemptStartTime}`);

        logger.info(`${attemptLabel} succeeded!`);
        return res;
      } catch (e: any) {
        if (timeoutId) clearTimeout(timeoutId);
        const errorMsg = e.message || String(e);
        const statusCode = e.status || (e.response?.status) || (e.error?.code);
        
        const isBlocked = statusCode === 403 || statusCode === 401 || errorMsg.includes('blocked') || errorMsg.includes('PERMISSION_DENIED');
        const isQuota = statusCode === 429 || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('too many requests');
        const isModelUnavailable = statusCode === 404 || errorMsg.includes('404') || errorMsg.includes('model') || errorMsg.includes('not found');
        const is500 = (statusCode && statusCode >= 500) || errorMsg.toLowerCase().includes('internal error');
        const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('deadline exceeded');
        
        logger.warn(`[GEMINI_CHAIN_ATTEMPT_ERROR]
module=${layer || 'unknown'}
task=${effectiveTaskType}
model=${currentModelName}
attemptIndex=${retry}
status=${statusCode || 'unknown'}
errorName=${e.name || 'Error'}
errorMessage=${errorMsg}
wasTimeout=${isTimeout}`);

        logger.warn(`[Gemini Attempt Failed] model=${currentModelName} retry=${retry} error=${errorMsg} status=${statusCode}`);

        if (isModelUnavailable) {
          logger.warn(`[Gemini] [MODEL_UNAVAILABLE] model=${currentModelName}. Invalidating discovery cache and switching to next model in chain.`);
          
          if (layer === "Video Summary Extraction") {
            logger.error("[GEMINI_VIDEO_SUMMARY_MODEL_404]", {
              model: currentModelName,
              module: "Video Summary Extraction",
              errorStatus: "NOT_FOUND",
              action: "MARK_UNAVAILABLE_AND_TRY_NEXT"
            });
          }
          
          failedModels.add(currentModelName);
          invalidateModelDiscoveryCache(currentApiKey);
          if (traceEntry) {
            traceEntry.fallback = true;
            traceEntry.fallbackReason = "MODEL_UNAVAILABLE_FALLBACK";
          }
          break; // Exit retry loop for this model, fallbackChain will move to next model
        }

        if (isBlocked && !disableKeyRotation) {
          const previouslyBlocked = blockedKeys.has(currentApiKey);
          blockedKeys.add(currentApiKey);
          const nextInfo = getAI(undefined, false, importance, taskType);
          // Only continue if we actually transitioned to a NEW, unblocked key
          if (nextInfo.apiKey && nextInfo.apiKey !== currentApiKey && !blockedKeys.has(nextInfo.apiKey)) {
            logger.info(`[Gemini] [KEY_ROTATION_BLOCK] ${maskKey(currentApiKey)} -> ${maskKey(nextInfo.apiKey)} (${nextInfo.keySource})`);
            currentApiKey = nextInfo.apiKey;
            currentAiInstance = nextInfo.ai;
            keySource = nextInfo.keySource;
            if (traceEntry) {
              traceEntry.fallback = true;
              traceEntry.fallbackReason = "KEY_BLOCKED";
              traceEntry.keyLabel = maskKey(currentApiKey);
              traceEntry.keySource = keySource;
            }
            // Only decrement if we were not already blocked, to avoid infinite loop on same key
            if (!previouslyBlocked) retry--;
            continue;
          } else {
            logger.warn(`[Gemini] No alternative unblocked keys available after blocking ${maskKey(currentApiKey)}`);
          }
        }

        if (isQuota) {
          const previouslyExhausted = exhaustedKeys.has(currentApiKey);
          exhaustedKeys.add(currentApiKey);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gemini-quota-status', { detail: { status: 'EXHAUSTED', key: currentApiKey } }));
          }
          if (!disableKeyRotation) {
            const nextInfo = getAI(undefined, false, importance, taskType);
            if (nextInfo.apiKey && nextInfo.apiKey !== currentApiKey && !exhaustedKeys.has(nextInfo.apiKey)) {
              logger.info(`[Gemini] [KEY_ROTATION_QUOTA] ${maskKey(currentApiKey)} -> ${maskKey(nextInfo.apiKey)} (${nextInfo.keySource})`);
              currentApiKey = nextInfo.apiKey;
              currentAiInstance = nextInfo.ai;
              keySource = nextInfo.keySource;
              if (traceEntry) {
                traceEntry.fallback = true;
                traceEntry.fallbackReason = "KEY_QUOTA";
                traceEntry.keyLabel = maskKey(currentApiKey);
                traceEntry.keySource = keySource;
              }
              if (!previouslyExhausted) retry--;
              continue;
            } else {
              logger.warn(`[Gemini] No alternative non-exhausted keys available after quota error on ${maskKey(currentApiKey)}`);
              if ((nextInfo.allAvailable?.length || 0) === 0 && (nextInfo.onlyBlockedCandidates?.length || 0) > 0) {
                throw new Error("QUOTA_EXHAUSTED_ALL_KEYS: Tutte le chiavi API disponibili hanno esaurito le quote o sono bloccate.");
              }
            }
          }
          // If we have more models in chain, move to next model immediately
          if (disableFallbackAcrossModels) {
            logger.info(`[Gemini] Model ${currentModelName} quota exhausted. disableFallbackAcrossModels=true, failing immediately.`);
            throw new Error(`EXECUTION_FAILED: Model ${currentModelName} quota exhausted and cross-model fallback is disabled for ${layer}`);
          }
          if (traceEntry) {
            traceEntry.fallback = true;
            traceEntry.fallbackReason = "MODEL_QUOTA_FALLBACK";
          }
          break; 
        }

        if (retry < maxRetriesPerModel) {
          await new Promise(r => setTimeout(r, (retry + 1) * 1500));
          continue;
        }
        
        // If we reach here, retries for THIS model are exhausted, loop to NEXT model in fallbackChain
        if (disableFallbackAcrossModels) {
          logger.info(`[Gemini] Model ${currentModelName} exhausted. disableFallbackAcrossModels=true, failing immediately.`);
          throw new Error(`EXECUTION_FAILED: Model ${currentModelName} failed and cross-model fallback is disabled for ${layer}. Error: ${errorMsg}`);
        }
        if (traceEntry) {
          traceEntry.fallback = true;
          traceEntry.fallbackReason = isTimeout ? "MODEL_TIMEOUT_FALLBACK" : is500 ? "MODEL_SERVER_FALLBACK" : "MODEL_RETRY_FALLBACK";
        }
        logger.info(`[Gemini] Model ${currentModelName} exhausted. Moving to next in chain...`);
        break;
      }
    }
  }

  if (!disableKeyRotation) {
    let platformKeyStr: string | undefined;
    try {
      platformKeyStr =
        (import.meta as any).env?.VITE_GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.API_KEY;
    } catch (e) {}
    if (platformKeyStr && currentApiKey !== platformKeyStr && !exhaustedKeys.has(platformKeyStr) && !blockedKeys.has(platformKeyStr) && retryPolicy.allowStableGeminiKey) {
      logger.info(`[GEMINI_PRIMARY_KEY_FAILED_TRYING_DEFAULT] module=${layer} reason=fallback_chain_failed primaryKeyMask=${maskKey(currentApiKey)} defaultKeyAvailable=true`);
      
      currentApiKey = platformKeyStr;
      const { GoogleGenAI } = await import("@google/genai");
      currentAiInstance = new GoogleGenAI({ apiKey: currentApiKey, fetch: window.fetch, httpOptions: { fetch: window.fetch } } as any);
      
      logger.info(`[GEMINI_DEFAULT_KEY_USED_AS_PARACHUTE] module=${layer} reason=fallback_chain_failed keyMask=${maskKey(currentApiKey)}`);
      
      for (const modelAttempt of fallbackChain) {
        currentModelName = modelAttempt;
        try {
          logger.info(`[Gemini] [Parachute] Model=${currentModelName}`);
          incrementApiBudget({
            defaultKeyUsageCount: 1,
            defaultGeminiKeyUsageCount: 1,
            defaultGeminiKeyVisionUsageCount: isHeavyMultimodal ? 1 : 0,
            defaultGeminiKeyTextTaskUsageCount: !isHeavyMultimodal ? 1 : 0,
            stableKeyEmergencyUsageCount: 1
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after 120000ms`)), customTimeoutMs || 120000));
          const parachuteStartTime = Date.now();
          const res = await Promise.race([
            op(currentAiInstance, currentModelName), 
            timeoutPromise
          ]);
          logger.info(`[GEMINI_DEFAULT_KEY_CALL_SUCCEEDED] module=${layer} latencyMs=${Date.now() - parachuteStartTime}`);
          return res;
        } catch (parachuteErr: any) {
          logger.warn(`[Gemini Parachute Failed] model=${currentModelName} error=${parachuteErr.message}`);
        }
      }
    }
  }

  if (layer === "Video Summary Extraction") {
    logger.error("[GEMINI_VIDEO_SUMMARY_CHAIN_EXHAUSTED_DEBUG]", {
      attemptedModels,
      failedModels: Array.from(failedModels),
      conclusion: "All models failed"
    });
  }

  logger.error(`[GEMINI_CHAIN_EXHAUSTED_DETAIL]
module=${layer || 'unknown'}
task=${effectiveTaskType}
modelsTried=${attemptedModels.join(', ')}`);

  logger.error(`[GEMINI_FALLBACK_CHAIN_EXHAUSTED] module=${layer} finalError=All models in fallback chain failed`);
  throw new Error(`EXECUTION_FAILED: All models in fallback chain failed for ${layer}`);
};

export const parseDataUrl = (url: string | undefined | null) => {
  if (!url) return null;
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  return match ? { mimeType: match[1], data: match[2] } : null;
};

export const copyToClipboard = async (text: string) => { const fallbackCopy = () => { const textArea = document.createElement('textarea'); textArea.value = text; textArea.style.position = 'fixed'; textArea.style.left = '-999999px'; textArea.style.top = '-999999px'; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { document.execCommand('copy'); textArea.remove(); return true; } catch (err) { textArea.remove(); return false; } }; try { if (navigator.clipboard && window.isSecureContext) { try { await navigator.clipboard.writeText(text); return true; } catch (err) { return fallbackCopy(); } } else { return fallbackCopy(); } } catch (err) { return false; } };

import { jsonrepair } from 'jsonrepair';

export function safeParseJSON(text: string, fallback: any = {}): any {
  if (!text) return fallback;
  
  const trimmed = text.trim();
  
  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch (e: any) {
    try {
        const repaired = jsonrepair(trimmed);
        return JSON.parse(repaired);
    } catch (repairErr) {
        // Fallback to strict extraction if jsonrepair fails
        const errorMsg = e.message || String(e);
        const isTrailingGarbage = errorMsg.includes("Unexpected non-whitespace character after JSON") || 
                                 errorMsg.includes("after JSON data");

        try {
          // Look for the first { or [
          const firstBrace = text.indexOf('{');
          const firstBracket = text.indexOf('[');
          let start = -1;

          if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace;
          } else if (firstBracket !== -1) {
            start = firstBracket;
          }

          if (start !== -1) {
            if (isTrailingGarbage) {
                let depth = 0;
                const charStart = text[start];
                const charEnd = charStart === '{' ? '}' : ']';
                const openChar = charStart;
                
                for (let i = start; i < text.length; i++) {
                    if (text[i] === openChar) depth++;
                    else if (text[i] === charEnd) depth--;
                    
                    if (depth === 0 && i > start) {
                        try {
                            const candidate = text.substring(start, i + 1);
                            return JSON.parse(candidate);
                        } catch (parseErr) {}
                    }
                }
            }

            const lastBrace = text.lastIndexOf('}');
            const lastBracket = text.lastIndexOf(']');
            let end = -1;
            if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                end = lastBrace;
            } else if (firstBracket !== -1) {
                end = lastBracket;
            }

            if (end > start) {
                const candidate = text.substring(start, end + 1);
                try {
                    return JSON.parse(candidate);
                } catch(e) {
                    return JSON.parse(jsonrepair(candidate));
                }
            }
          }
        } catch (innerE) {
          logger.error("[Gemini] safeParseJSON extraction failed:", innerE);
        }
        
        logger.warn("[Gemini] safeParseJSON fallback used for text:", text.substring(0, 100) + "...");
        return fallback;
    }
  }
}

export const cleanPerformanceMarkers = (text: string) => {
  if (!text) return '';
  return text
    .replace(/\[(?:Tono|Volume|Ritmo|Pausa|Dinamica|Performance)[^\]]*\]/gi, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
};

export const sanitizePrompt = (text: string, apiKey?: string, model?: string) => {
  if (!text) return '';
  
  let cleaned = cleanPerformanceMarkers(text);
  
  if (cleaned.trim().startsWith('{')) {
    try {
      const parsed = safeParseJSON(cleaned);
      if (parsed.prompt) cleaned = parsed.prompt;
    } catch (e) {}
  }

  const extractRegex = /(?:\*\*Prompt:\*\*|\*\*Prompt\*\*|\nPrompt:|^Prompt:|\n> \*\*Prompt:\*\*|^> \*\*Prompt:\*\*|\n> Prompt:|^> Prompt:)\s*([\s\S]*?)(?=\n\n###|\n\n---|Option \d+|\n\n\*\*Key|\n\n\*\*Notes|$)/i;
  const match = cleaned.match(extractRegex);
  
  if (match && match[1]) {
    cleaned = match[1];
  } else {
    const startOfPrompt = cleaned.search(/(?:A cinematic|Cinematic|Shot on|Medium shot|Close up|Wide shot|A detailed|A realistic|A hyper-realistic|Camera starts|The scene opens)/i);
    if (startOfPrompt > 30) {
      cleaned = cleaned.substring(startOfPrompt);
    }
  }

  const trailingRegex = /\n\n(?:###|---|Option \d+|Key|Notes|Analysis|Optimization|Tactics|Sora|Suggested|Viral|Enhancements|Execution|Why this works)/i;
  const trailingIndex = cleaned.search(trailingRegex);
  if (trailingIndex !== -1) {
    cleaned = cleaned.substring(0, trailingIndex);
  }

  cleaned = cleaned
    .replace(/(?:Ecco|Here is|Here are|Per ottimizzare|To optimize|To push|The goal|Option \d+|Sora 2\.0 Master Prompt|Why these prompts|This prompt|In this optimized|The following|Here are three optimized prompt variations).*?[:\s-]*/im, '')
    .replace(/<(?!original_script|optimized_script|\/original_script|\/optimized_script)[^>]*>/g, '') 
    .replace(/^>\s*/gm, '') 
    .replace(/### .*?\n/g, '') 
    .replace(/\*\*Prompt:\*\*/gi, '') 
    .replace(/\*\*/g, '') 
    .replace(/---[\s\S]*$/g, '') 
    .trim();
    
  if (cleaned.toLowerCase().includes('to optimize') || cleaned.toLowerCase().includes('here is') || cleaned.toLowerCase().includes('this prompt') || cleaned.toLowerCase().includes('the goal')) {
     const paragraphs = cleaned.split('\n\n');
     for (const p of paragraphs) {
        if (p.match(/(?:A cinematic|Cinematic|Shot on|Medium shot|Close up|Wide shot|A detailed|A realistic|A hyper-realistic|Camera starts|The scene opens)/i)) {
            cleaned = p;
            break;
        }
     }
  }

  if (cleaned.includes('Option 1:')) {
    const parts = cleaned.split(/Option \d+:/i);
    if (parts.length > 1) cleaned = parts[1];
  }

  cleaned = cleaned.replace(/Option \d+:\s*/gi, '');

  return cleaned.trim();
};

export const getBypassedWord = async (word: string, apiKey?: string) => {
  const { ai } = getAI(apiKey, false, 'COGNITIVE', 'CORE_ANALYSIS');
  const model = selectModel('flash', 'gemini-2.0-flash', apiKey);
  
  const prompt = `Genera un BREVE e NEUTRALE placeholder semantico (massimo 3-5 parole) per l'entità: "${word}".
  
  REGOLE CRITICHE:
  1. NON usare mai il nome originale o brand.
  2. PRESERVA L'IDENTITÀ SEMANTICA: Il risultato deve evocare esattamente lo stesso concetto/soggetto senza usare il nome vietato.
  3. Il risultato deve essere BREVE (massimo 3-5 parole) in INGLESE. NON generare paragrafi lunghi.
  
  Esempi:
  - "ABBA" -> "a 1970s Swedish pop group"
  - "Agnetha" -> "a blonde Scandinavian female singer"
  - "Gimme! Gimme! Gimme!" -> "a 1970s disco-pop anthem"
  - "Maresciallo" -> "an italian police officer"
  
  Restituisci SOLO il placeholder breve.`;

  try {
    const response = await executeWithNetworkRetry(async (currentAi, modelName) => {
      return await currentAi.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
    }, 1, undefined, 30000);
    return response.text?.trim() || word.split('').join('_');
  } catch (e) {
    return word.split('').join('_');
  }
};

export async function preflightCheckGeminiQuota(apiKey?: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { ai } = getAI(apiKey, false, 'COGNITIVE', 'CORE_ANALYSIS');
    const model = selectModel('flash', 'flash', apiKey);
    
    // We send a medium prompt to verify the quota is sufficient for real tasks.
    const prompt = `Please generate a structured analysis of a hypothetical video. This is a preflight quota check. Reply with exactly 150 words describing the visual, semantic, and narrative structure of a futuristic cityscape video. Ensure the output is formatted with clear headings.`;
    
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        maxOutputTokens: 250,
        temperature: 0.1,
      }
    });
    
    if (response && response.text) {
      logger.info("[PRECHECK_GEMINI_QUOTA] status=OK");
      return { ok: true };
    }
    
    logger.warn("[PRECHECK_GEMINI_QUOTA] status=INSUFFICIENT reason=empty_response");
    return { ok: false, reason: "Quota Gemini insufficiente o risposta vuota" };

  } catch (error: any) {
    logger.error("[PRECHECK_GEMINI_QUOTA] ERROR", error);
    if (error.status === 429 || error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
      logger.warn("[PRECHECK_GEMINI_QUOTA] status=INSUFFICIENT reason=429_quota_exceeded");
      return { ok: false, reason: "Quota Gemini insufficiente (Errore 429)" };
    }
    return { ok: false, reason: "Errore durante il preflight check di Gemini: " + error.message };
  }
}

export interface GroqTextTaskParams {
  prompt: string;
  systemInstruction: string;
  layer: string;
  apiKey?: string;
  timeoutMs?: number;
  taskType?: AIProviderTaskType;
  model: string;
  onProgress?: (text: string) => void;
  trace?: ModelUsageTrace;
  modelTier?: string;
  callReason?: string;
  inputSource?: string;
  preferGroq?: boolean;
  geminiOp: (ai: any, modelName: string) => Promise<any>;
}

/**
 * Executes a text-heavy task prioritizing Groq if available.
 * Handles fallbacks, logging, and progress updates specifically for multi-provider pipelines.
 */
export async function executeGroqFirstTextTask(params: GroqTextTaskParams): Promise<{ text: string; isDegraded?: boolean; visualVerification?: boolean }> {
  const globalMode = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
  const effectiveModelTier = params.modelTier || globalMode || 'flash';
  const effectiveTaskType = params.taskType || (params.layer === 'Video Analysis Generation' ? 'CORE_ANALYSIS' : 'IDEA_ANALYSIS');
  const hfKey = localStorage.getItem('huggingface_api_key') || '';
  
  const isGroqDiagnostic = globalMode === 'groq';

  // --- HUGGING MODE (100% HF) ---
  if (isHuggingMode(effectiveModelTier)) {
    if (params.onProgress) params.onProgress(`Tentativo primario con Hugging Face per ${params.layer}...`);
    const hfModel = resolveHuggingFaceModel('text');
    logger.info(`[HUGGING_MODE_EXECUTION] task=${effectiveTaskType} model=${hfModel}`);
    
    try {
      const text = await hfChatCompletion([
        { role: 'system', content: params.systemInstruction },
        { role: 'user', content: params.prompt }
      ], hfKey, hfModel);
      
      if (text) {
        if (params.onProgress) params.onProgress(`Hugging Face ha completato ${params.layer} con successo.`);
        return { text, isDegraded: false };
      }
    } catch (hfErr) {
      logger.error(`[HUGGING_MODE_FAILED] layer=${params.layer} error=${hfErr}`);
      throw hfErr;
    }
  }

  // --- GROQ MODE (Hybrid: Groq for audio, HF for vision/reasoning) ---
  if (isGroqMode(effectiveModelTier) || isGroqDiagnostic) {
     // For reasoning tasks in Groq mode, we use HF as requested by user
     if (params.onProgress) params.onProgress(`Tentativo Groq Hybrid (HF) per ${params.layer}...`);
     const hfModel = resolveHuggingFaceModel('text');
     logger.info(`[GROQ_HYBRID_MODE_EXECUTION] task=${effectiveTaskType} model=${hfModel} globalMode=${globalMode}`);
     
     try {
       const text = await hfChatCompletion([
         { role: 'system', content: params.systemInstruction },
         { role: 'user', content: params.prompt }
       ], hfKey, hfModel);
       
       if (text) {
         if (params.onProgress) params.onProgress(`Groq Hybrid (HF) ha completato ${params.layer} con successo.`);
         return { text, isDegraded: false };
       }
     } catch (hfErr) {
       logger.warn(`[GROQ_HYBRID_HF_FAILED] falling back to Groq Llama for text task... error=${hfErr}`);
     }

     // FALLBACK TO GROQ LLAMA (not Gemini) if HF fails in Groq Mode
     if (hasGroqApiKey()) {
       try {
         const groq = await groqTextCompletion({
           messages: [
             { role: 'system', content: params.systemInstruction },
             { role: 'user', content: params.prompt.length > 25000 ? (params.prompt.substring(0, 25000) + "... [TRUNCATED]") : params.prompt },
           ],
           task: effectiveTaskType,
           responseFormat: 'json_object',
           timeoutMs: params.timeoutMs,
         });
         if (groq?.text) return { text: groq.text, isDegraded: true };
       } catch (groqErr) {
         logger.error(`[GROQ_MODE_TOTAL_FAILURE] layer=${params.layer} error=${groqErr}`);
         throw groqErr;
       }
     }
     
     // Se siamo qui e siamo in Groq mode, non dobbiamo MAI scendere a Gemini
     throw new Error(`[GROQ_MODE_FAILED] Impossible to complete ${params.layer} without Gemini (which is blocked).`);
  }

  const groqAvailableForTask = hasGroqApiKey() && isGroqMode(params.modelTier) && resolveProviderPolicy(effectiveTaskType).preferredProvider === 'GROQ';

  let groqAttempted = false;
  let groqSucceeded = false;

  if (params.preferGroq && groqAvailableForTask) {
    groqAttempted = true;
    if (params.onProgress) params.onProgress(`Tentativo primario con Groq per ${params.layer}...`);
    try {
      const groq = await groqTextCompletion({
        messages: [
          { role: 'system', content: params.systemInstruction },
          { role: 'user', content: params.prompt.length > 25000 ? (params.prompt.substring(0, 25000) + "... [TRUNCATED DUE TO SIZE]") : params.prompt },
        ],
        task: effectiveTaskType,
        responseFormat: 'json_object',
        timeoutMs: params.timeoutMs,
      });

      if (groq?.text) {
        groqSucceeded = true;
        if (params.onProgress) params.onProgress(`Groq ha completato ${params.layer} con successo.`);
        return { text: groq.text };
      } else {
        throw new Error("Groq returned empty or invalid text output");
      }
    } catch (groqErr) {
      logger.warn(`[GROQ_PRIMARY_TASK_FAILED] module=${params.layer} error=${groqErr instanceof Error ? groqErr.message : String(groqErr)} fallingBackToGemini=true`);
      logger.info(`[FALLBACK_DECISION]`, {
        module: params.layer,
        groqAvailable: groqAvailableForTask,
        groqSucceeded: false,
        groqHasValidOutput: false,
        geminiFallbackAllowed: true,
        reason: "Groq failed or returned invalid output during primary attempt"
      });
      if (params.onProgress) params.onProgress(`Groq fallito, ripiego su Gemini per ${params.layer}...`);
    }
  }

  try {
    const geminiCallReason = groqAttempted ? "GROQ_REASONING_FAILED" : `GROQ_REASONING_BYPASSED_${params.callReason || "Default"}`;
    const prefix = globalMode === 'groq' ? '[GEMINI_DIAGNOSTIC_ONLY] ' : '';
    
    logger.info(`${prefix}[MODEL_CALL_START] provider=gemini model=${params.model} task=${effectiveTaskType} layer=${params.layer} callReason=${geminiCallReason}`);
    logger.info(`${prefix}[FALLBACK_DECISION]`, {
        module: params.layer,
        groqAvailable: groqAvailableForTask,
        groqSucceeded: false,
        groqHasValidOutput: false,
        groqAlreadyAttempted: groqAttempted,
        geminiFallbackAllowed: true,
        reason: groqAttempted ? "GROQ_FAILED_STEPPING_TO_GEMINI" : "BYPASSING_GROQ_FOR_MULTIMODAL_OR_FORCE"
    });
    
    const result = await executeWithNetworkRetry(
      (ai, dynamicModel) => params.geminiOp(ai, dynamicModel || params.model),
      1,
      undefined,
      params.timeoutMs || 300000,
      params.apiKey,
      params.onProgress,
      params.model,
      params.trace,
      params.layer,
      undefined,
      false,
      'COGNITIVE',
      false,
      geminiCallReason,
      (params.inputSource as any) || 'text_input',
      false,
      false,
      effectiveTaskType
    );

    return { text: typeof result?.text === 'function' ? result.text() : (result?.text || JSON.stringify(result)) };
  } catch (err: any) {
    logger.error(`[MODEL_CALL_ERROR] provider=gemini model=${params.model} task=${effectiveTaskType} layer=${params.layer}`, {
      status: err?.status || err?.code || 'UNKNOWN',
      message: err?.message || String(err),
      response: err?.response?.data || 'N/A'
    });
    const isBlocked = err?.message?.includes('GEMINI_TEXT_FALLBACK_BLOCKED_GROQ_AVAILABLE');
    const isQuota = err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('429');
    const errorDetail = isBlocked ? "Gemini Fallback blocked by policy (Groq available)" : (isQuota ? "Gemini Quota Exhausted" : (err?.message || String(err)));

    if (isBlocked && groqAvailableForTask) {
      logger.warn(`[GEMINI_TEXT_FALLBACK_BLOCK_RECOVERED_WITH_GROQ] module=${params.layer} taskType=${effectiveTaskType} pipelineContinues=true`);
      try {
        const groq = await groqTextCompletion({
          messages: [
            { role: 'system', content: params.systemInstruction },
            { role: 'user', content: params.prompt.length > 25000 ? (params.prompt.substring(0, 25000) + "... [TRUNCATED DUE TO SIZE]") : params.prompt },
          ],
          task: effectiveTaskType,
          responseFormat: 'json_object',
          timeoutMs: params.timeoutMs,
        });

        if (groq?.text) {
          return { text: groq.text };
        }
        throw new Error("Groq recovery returned empty text");
      } catch (groqErr) {
        logger.info(`[FALLBACK_DECISION]`, {
            module: params.layer,
            groqAvailable: groqAvailableForTask,
            groqSucceeded: false,
            groqHasValidOutput: false,
            geminiFallbackAllowed: true,
            reason: "Groq failed or returned invalid output during recovery attempt"
        });
        logger.warn(`[FALLBACK_GROQ_FAILED_ALLOW_GEMINI] module=${params.layer} error=${groqErr instanceof Error ? groqErr.message : String(groqErr)} reason=Groq available but no valid output`);
        
        // Tentativo finale con Gemini forzato
        if (params.onProgress) params.onProgress(`Groq è fallito come fallback. Tentativo di emergenza finale con Gemini...`);
        try {
           logger.info(`[FALLBACK_GEMINI_STARTED] module=${params.layer} reason=GROQ_FAILED_DURING_RECOVERY`);
           const finalGeminiResult = await executeWithNetworkRetry(
             (ai, dynamicModel) => params.geminiOp(ai, dynamicModel || params.model),
             1,
             undefined,
             params.timeoutMs || 300000,
             params.apiKey,
             params.onProgress,
             params.model,
             params.trace,
             params.layer,
             undefined,
             false,
             'COGNITIVE',
             false,
             "GROQ_FAILED", 
             (params.inputSource as any) || 'text_input',
             false,
             false,
             effectiveTaskType
           );
           return { text: typeof finalGeminiResult?.text === 'function' ? finalGeminiResult.text() : (finalGeminiResult?.text || JSON.stringify(finalGeminiResult)) };
        } catch (finalGeminiErr: any) {
           logger.error(`[FALLBACK_GEMINI_FAILED] module=${params.layer} status=${finalGeminiErr?.status || 'FAIL'} response=${finalGeminiErr?.message || 'N/A'}`);
           logger.error(`[PIPELINE_FAILED_NO_TEXT_FALLBACK] module=${params.layer} reason=Gemini and Groq both failed`);
           throw new Error(`TEXT_TASK_FAILED: Both Groq and Gemini failed. Error: ${finalGeminiErr?.message || 'Unknown'}`);
        }
      }
    }

    if (params.layer === 'Video Analysis Generation' || params.layer === 'Final Viral Analysis' || params.layer === 'Blue Ocean Niches' || params.layer === 'Analyze Content') {
       const canContinueTextOnly = Boolean(params.prompt && params.prompt.length > 100) || ['video_summary', 'script_text', 'local_data', 'text_input'].includes(params.inputSource || '');

       if (canContinueTextOnly && groqAvailableForTask) {
          logger.warn(`[GEMINI_ALL_VIDEO_KEYS_FAILED_GROQ_TEXT_FALLBACK] module=${params.layer} visualVerification=false pipelineContinues=true`);
          try {
              const groq = await groqTextCompletion({
                messages: [
                  { role: 'system', content: params.systemInstruction + "\n\nIMPORTANT: Visual/frame analysis failed or is limited. Continue using provided text context." },
                  { role: 'user', content: params.prompt.length > 25000 ? (params.prompt.substring(0, 25000) + "... [TRUNCATED DUE TO SIZE]") : params.prompt },
                ],
                task: effectiveTaskType,
                responseFormat: 'json_object',
                timeoutMs: params.timeoutMs,
              });
              
              return { 
                text: groq.text,
                isDegraded: true,
                visualVerification: false
              };
          } catch (groqErr) {
             logger.error(`[PIPELINE_FAILED_NO_TEXT_FALLBACK] module=${params.layer} reason=Gemini and Groq both failed`);
             const fallbackReason = isBlocked ? "GEMINI_FALLBACK_BLOCKED_BY_POLICY" : (isQuota ? "GEMINI_QUOTA_EXHAUSTED" : "GEMINI_PROVIDER_ERROR");
             throw new Error(`VIDEO_ANALYSIS_FAILED_NO_TEXT_FALLBACK_AVAILABLE: ${fallbackReason}. Detail: ${err instanceof Error ? err.message : String(err)}`);
          }
       }
    }
    const aiConfigError = getAI(params.apiKey, false, 'COGNITIVE', effectiveTaskType);
    const isNotFound = err?.status === 404 || err?.message?.includes('404');
    
    if (isNotFound) {
        logger.warn(`[TEXT_MODULE_KEY_OR_MODEL_404]`, {
            module: params.layer,
            keySource: aiConfigError.keySource,
            model: params.model,
            action: "MARK_UNAVAILABLE_FOR_THIS_RUN"
        });
    } else if (isQuota) {
        logger.warn(`[GEMINI_KEY_QUOTA_LIMITED]`, {
            keySource: aiConfigError.keySource,
            keyMasked: maskKey(aiConfigError.apiKey),
            errorCode: 429,
            action: "SKIP_KEY_FOR_THIS_RUN"
        });
    }

    throw err;
  }
}
