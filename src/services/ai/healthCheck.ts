import { getAI, discoverGeminiModels, invalidateModelDiscoveryCache } from '../gemini/core';
import { resolveGroqApiKeys } from './groqClient';
import { logger } from '@/src/utils/logger';

export interface HealthCheckResult {
  provider: 'Gemini' | 'YouTube' | 'Groq' | 'Hugging Face' | 'OpenRouter';
  maskedKey: string;
  status: 'OK' | 'GEMINI_PARTIAL_OK' | 'INVALID_KEY' | 'RATE_LIMIT' | 'QUOTA_EXCEEDED' | 'QUOTA_DEPLETED' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR' | 'MODEL_NOT_FOUND' | 'MODEL_UNAVAILABLE' | 'PAYLOAD_TOO_LARGE' | 'ROUTER_ERROR' | 'GEMINI_MODEL_UNAVAILABLE' | 'GEMINI_NO_GENERATE_CONTENT_MODEL_AVAILABLE' | 'MISSING_KEY' | 'PARSER_ERROR';
  model?: string;
  latencyMs?: number;
  message?: string;
  source?: string;
}

function maskKey(key: string): string {
  if (!key) return 'NO_KEY';
  if (key.length <= 8) return '***';
  if (key.startsWith('sk-or')) return `sk-or-...${key.slice(-4)}`;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// We will resolve Gemini & Groq keys here to get the 'source' properly without modifying core orchestration
export async function runAllKeysHealthCheck(youtubeApiKey?: string): Promise<HealthCheckResult[]> {
  logger.info("[KEY_HEALTHCHECK_START] Running API keys health check independent execution");
  const startTime = Date.now();
  
  // NOTE: This check ignores terminal run flag as it is a health check, not an analysis run.
  logger.info("[RUN_TERMINATED_FLAG_IGNORED_FOR_KEY_TEST] reason=KEY_TEST_IS_NOT_ANALYSIS_RUN");

  const results: HealthCheckResult[] = [];

  const checkGemini = async (): Promise<HealthCheckResult[]> => {
    const results: HealthCheckResult[] = [];
    const geminiCandidates = new Map<string, string[]>();
    const addGeminiCandidate = (k: any, source: string) => {
        if (typeof k !== 'string' || !k.trim()) return;
        const kv = k.trim();
        if (kv.length <= 5 || kv.includes('MY_GEMINI_API_KEY') || kv.includes('YOUR_API_KEY')) return;
        if (kv.toLowerCase().startsWith('gsk_')) return;
        
        const sources = geminiCandidates.get(kv) || [];
        if (!sources.includes(source)) sources.push(source);
        geminiCandidates.set(kv, sources);
    };

    const env = typeof process !== 'undefined' && process.env ? process.env : {};
    const metaEnv = (import.meta as any).env || {};
    addGeminiCandidate(metaEnv.VITE_GEMINI_API_KEY, 'VITE_GEMINI_API_KEY');
    try { addGeminiCandidate(env.GEMINI_API_KEY, 'GEMINI_API_KEY (Env)'); } catch(e){}
    try { addGeminiCandidate(env.GOOGLE_API_KEY, 'GOOGLE_API_KEY (Env)'); } catch(e){}
    try { addGeminiCandidate(env.API_KEY, 'API_KEY (Env)'); } catch(e){}
    addGeminiCandidate((globalThis as any).GEMINI_API_KEY, 'GLOBAL_GEMINI_API_KEY');
    const { apiKey: coreGeminiKey } = getAI(undefined, false, 'AUXILIARY', 'TEST_LIGHT');
    addGeminiCandidate(coreGeminiKey, 'core_resolved');

    for (const [key, sources] of geminiCandidates.entries()) {
        const sourceLabels = sources.join(' + ');
        const startGemini = Date.now();
        let status: HealthCheckResult['status'] = 'UNKNOWN_ERROR';
        let message = 'OK';
        const modelName = env.VITE_GEMINI_MODEL || metaEnv.VITE_GEMINI_MODEL || "gemini-2.0-flash";
        
        logger.info(`[GEMINI_KEY_TEST_START] keySource=${sourceLabels} model=${modelName}`);

        try {
            const { ai } = getAI(key, false, 'AUXILIARY', 'TEST_LIGHT');
            if (!ai) {
                logger.error(`[GEMINI_KEY_TEST_RESULT] status=MISSING_KEY reason=getAI_null`);
                results.push({ provider: 'Gemini', source: sourceLabels, maskedKey: maskKey(key), status: 'MISSING_KEY', latencyMs: Date.now() - startGemini, message: 'Client AI non inizializzato' });
                continue;
            }

            logger.info(`[GEMINI_KEY_TEST_MODEL_AUDIT] model=${modelName} source=default_audit`);

            await (ai as any).models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: "health check" }] }],
                config: { maxOutputTokens: 2, temperature: 0 },
            });
            status = 'OK';
        } catch (error: any) {
            const errText = error?.message || String(error);
            const errCode = (error as any).status || (error as any).code || 'NO_CODE';
            
            if (errText.includes('m...') || errText.includes('models') || errText.includes('undefined')) {
                status = 'PARSER_ERROR';
            } else if (errCode === 401 || errText.includes('API_KEY_INVALID') || errText.includes('unauthorized')) {
                status = 'UNAUTHORIZED';
            } else if (errCode === 404 || errText.includes('not found') || errText.includes('MODEL_NOT_FOUND')) {
                status = 'MODEL_NOT_FOUND';
            } else if (errCode === 429 || errText.includes('quota') || errText.includes('exhausted')) {
                status = 'QUOTA_EXCEEDED';
            } else if (errCode === 503 || errText.includes('unavailable')) {
                status = 'MODEL_UNAVAILABLE';
            } else {
                status = 'NETWORK_ERROR';
            }
            message = errText.substring(0, 200);
            logger.error(`[GEMINI_KEY_TEST_RESULT] status=${status} keySource=${sourceLabels} errorCode=${errCode} message=${message}`);
        }

        if (status === 'OK') {
            logger.info(`[GEMINI_KEY_TEST_RESULT] status=OK model=${modelName} keySource=${sourceLabels} latency=${Date.now() - startGemini}ms`);
        }
        results.push({ provider: 'Gemini', source: sourceLabels, maskedKey: maskKey(key), status, model: modelName, latencyMs: Date.now() - startGemini, message });
    }
    return results;
  };

  const checkYouTube = async (): Promise<HealthCheckResult> => {
     const metaEnv = (import.meta as any).env || {};
     const env = typeof process !== 'undefined' && process.env ? process.env : {};
     const effectiveYtKey =
       youtubeApiKey ||
       metaEnv.VITE_YOUTUBE_API_KEY ||
       env.YOUTUBE_API_KEY ||
       metaEnv.VITE_GOOGLE_YOUTUBE_API_KEY ||
       env.GOOGLE_YOUTUBE_API_KEY ||
       (env as any).youtube_api_key ||
       "";
     const startYt = Date.now();
     
     if (!effectiveYtKey) return { provider: 'YouTube', maskedKey: 'NON CONFIGURATA', status: 'INVALID_KEY', message: 'NON CONFIGURATA' };

     try {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 12000);
        const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=Ks-_Mh1QhMc&key=${effectiveYtKey}`, { method: 'GET', signal: controller.signal as any });
        clearTimeout(tId);
        
        if (!ytRes.ok) return { provider: 'YouTube', source: 'System Runtime', maskedKey: maskKey(effectiveYtKey), status: 'INVALID_KEY', latencyMs: Date.now() - startYt, message: `[${ytRes.status}] Error` };
        return { provider: 'YouTube', source: 'System Runtime', maskedKey: maskKey(effectiveYtKey), status: 'OK', latencyMs: Date.now() - startYt, message: 'ATTIVA' };
     } catch (err: any) {
        return { provider: 'YouTube', source: 'System Runtime', maskedKey: maskKey(effectiveYtKey), status: 'NETWORK_ERROR', latencyMs: Date.now() - startYt, message: err?.message || 'Network error' };
     }
  };

  const checkGroq = async (): Promise<HealthCheckResult> => {
    const startGroq = Date.now();
    try {
      const res = await fetch('/api/diag/groq');
      const data = await res.json();
      return { 
        provider: 'Groq', 
        source: 'System & Backend',
        maskedKey: data.status === 'MISSING_KEY' ? 'N/A' : 'SECRET', 
        status: data.status, 
        latencyMs: data.latencyMs || (Date.now() - startGroq),
        message: data.message
      };
    } catch (err: any) {
      return { provider: 'Groq', maskedKey: 'ERROR', status: 'NETWORK_ERROR', message: err.message };
    }
  };

  const checkHuggingFace = async (): Promise<HealthCheckResult> => {
     const startHF = Date.now();
     try {
        const res = await fetch('/api/diag/huggingface');
        const data = await res.json();
        return { 
          provider: 'Hugging Face', 
          source: 'System & Backend',
          maskedKey: data.maskedKey || 'SECRET', 
          status: data.status, 
          model: data.model,
          latencyMs: data.latencyMs || (Date.now() - startHF),
          message: data.message
        };
     } catch (err: any) {
        return { provider: 'Hugging Face', maskedKey: 'ERROR', status: 'NETWORK_ERROR', message: err.message };
     }
  };

  const checkOpenRouter = async (): Promise<HealthCheckResult> => {
    const startOR = Date.now();
    try {
       const res = await fetch('/api/diag/openrouter?model=backend-resolve');
       const data = await res.json();
       return { 
         provider: 'OpenRouter', 
         source: 'System & Backend',
         maskedKey: data.maskedKey || 'SECRET', 
         status: data.status, 
         model: data.model,
         latencyMs: data.latencyMs || (Date.now() - startOR),
         message: data.message
       };
    } catch (err: any) {
       return { provider: 'OpenRouter', maskedKey: 'ERROR', status: 'NETWORK_ERROR', message: err.message };
    }
 };

  const [geminiRes, youtubeRes, groqRes, hfRes, orRes] = await Promise.allSettled([
    checkGemini(),
    checkYouTube(),
    checkGroq(),
    checkHuggingFace(),
    checkOpenRouter()
  ]);

  // Combine results safely
  if (geminiRes.status === 'fulfilled') results.push(...geminiRes.value);
  else logger.error(`[KEY_TEST_GEMINI_FAILED]`, geminiRes.reason);

  if (youtubeRes.status === 'fulfilled') results.push(youtubeRes.value);
  else logger.error(`[KEY_TEST_YT_FAILED]`, youtubeRes.reason);

  if (groqRes.status === 'fulfilled') results.push(groqRes.value);
  else logger.error(`[KEY_TEST_GROQ_FAILED]`, groqRes.reason);

  if (hfRes.status === 'fulfilled') results.push(hfRes.value);
  else logger.error(`[KEY_TEST_HF_FAILED]`, hfRes.reason);

  if (orRes.status === 'fulfilled') results.push(orRes.value);
  else logger.error(`[KEY_TEST_OR_FAILED]`, orRes.reason);

  logger.info(`[KEY_HEALTHCHECK_COMPLETED] Total latency: ${Date.now() - startTime}ms`);
  return results;
}
