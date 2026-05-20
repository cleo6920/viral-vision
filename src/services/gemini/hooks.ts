import { getAI, selectModel, executeWithNetworkRetry } from './core';
import { COMPARISON_SCHEMA } from './schemas';
import { ExternalMarketData, ModelUsageTrace } from '../../types';
import { safeParseJSON } from '../../utils/json';
import { groqTextCompletion } from '../ai/groqClient';
import { hasGroqApiKey } from '../ai/providerRouter';

export async function compareHooks(hookA: string, hookB: string, niche: string, apiKey?: string, modelTier: string = 'flash', externalMarketData?: ExternalMarketData, trace?: ModelUsageTrace): Promise<any> {
  if (hasGroqApiKey()) {
    const prompt = `
      Sei un esperto di algoritmi TikTok e YouTube Shorts.
      Confronta questi due hook e determina quale ha il maggior potenziale virale nella nicchia: "${niche}".
      Hook A: "${hookA}"
      Hook B: "${hookB}"
      ${externalMarketData && externalMarketData.status === 'SUCCESS' ? `Dati di mercato: ${JSON.stringify(externalMarketData)}` : 'No data mode: solo critica strutturale.'}
      Restituisci SOLO JSON valido.
    `;
    const response = await groqTextCompletion({
      responseFormat: 'json_object',
      task: 'hook_comparison',
      messages: [
        { role: 'system', content: 'Rispondi solo con JSON valido, senza testo extra.' },
        { role: 'user', content: prompt },
      ],
      timeoutMs: 120000,
    });
    return safeParseJSON(response.text || '{}');
  }
  const executeComparison = async (currentModelTier: string) => {
    const { ai } = getAI(apiKey);
    const model = selectModel(currentModelTier === 'pro' ? 'pro' : 'flash', 'flash', apiKey);
    
    const prompt = `
      Sei un esperto di algoritmi TikTok e YouTube Shorts.
      Confronta questi due hook e determina quale ha il maggior potenziale virale nella nicchia: "${niche}".
      
      Hook A: "${hookA}"
      Hook B: "${hookB}"
      
      ${externalMarketData && externalMarketData.status === 'SUCCESS' ? `
      DATI DI MERCATO ESTERNI (REALI):
      ${JSON.stringify(externalMarketData)}
      
      Usa questi dati reali per validare quale hook risuona meglio con il mercato attuale.
      ` : `
      ⚠️ NO DATA MODE: Nessun dato di mercato esterno valido disponibile.
      ${externalMarketData?.marketSummary || ''}
      Opera in NO_DATA_MODE. Non fare affermazioni strategiche sul mercato. Solo critica strutturale.
      `}

      Analizza:
      1. Curiosity Gap (quanto spinge a guardare il resto?)
      2. Pattern Interrupt (quanto è inaspettato?)
      3. Chiarezza (si capisce subito di cosa si parla?)
      
      Restituisci un JSON strutturato.
    `;

    const response = await executeWithNetworkRetry((currentAi, dynamicModel) => currentAi.models.generateContent({
      model: dynamicModel || model,
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json", responseSchema: COMPARISON_SCHEMA }
    }), 2, undefined, 300000, apiKey, undefined, model, trace, "Hook Comparison", currentModelTier as "flash" | "pro"); 
    return safeParseJSON(response.text || '{}');
  };

  try {
    return await executeComparison(modelTier);
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
    if (isQuotaError && modelTier === 'pro') {
      console.warn("[Gemini] Quota exceeded for PRO model in compareHooks. Auto-switching to FLASH mode.");
      return await executeComparison('flash');
    }
    throw err;
  }
}

export async function generateBulkHooks(topic: string, count: number = 5, apiKey?: string, modelTier: string = 'flash', externalMarketData?: ExternalMarketData, trace?: ModelUsageTrace): Promise<string[]> {
  if (hasGroqApiKey()) {
    const prompt = `
      Genera ${count} hook virali per video brevi sul tema: "${topic}".
      ${externalMarketData && externalMarketData.status === 'SUCCESS' ? `Dati di mercato: ${JSON.stringify(externalMarketData)}` : 'No data mode: solo struttura.'}
      Devono essere brevi, punchy e molto diversi tra loro.
      Restituisci SOLO un array JSON di stringhe.
    `;
    const response = await groqTextCompletion({
      responseFormat: 'json_object',
      task: 'bulk_hook_generation',
      messages: [
        { role: 'system', content: 'Rispondi con un oggetto JSON del tipo {"hooks":["..."]}.' },
        { role: 'user', content: prompt },
      ],
      timeoutMs: 120000,
    });
    const parsed = safeParseJSON(response.text || '{}');
    return Array.isArray(parsed?.hooks) ? parsed.hooks : [];
  }
  const executeGeneration = async (currentModelTier: string) => {
    const { ai } = getAI(apiKey);
    const model = selectModel(currentModelTier === 'pro' ? 'pro' : 'flash', 'flash', apiKey);
    
    const prompt = `
      Genera ${count} hook virali per video brevi sul tema: "${topic}".
      
      ${externalMarketData && externalMarketData.status === 'SUCCESS' ? `
      DATI DI MERCATO ESTERNI (REALI):
      ${JSON.stringify(externalMarketData)}
      
      Usa questi dati reali per generare hook che siano allineati con ciò che sta funzionando ora.
      ` : `
      ⚠️ NO DATA MODE: Nessun dato di mercato esterno valido disponibile.
      ${externalMarketData?.marketSummary || ''}
      Opera in NO_DATA_MODE. Non fare affermazioni strategiche sul mercato. Solo critica strutturale.
      `}

      Devono essere brevi (max 2 secondi parlati), punchy e usare pattern psicologici (es. Negatività, Segreto, Errore Comune).
      Restituisci SOLO un array JSON di stringhe.
    `;

    const response = await executeWithNetworkRetry((currentAi, dynamicModel) => currentAi.models.generateContent({
      model: dynamicModel || model,
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json" }
    }), 2, undefined, 300000, apiKey, undefined, model, trace, "Bulk Hook Generation", currentModelTier as "flash" | "pro"); 
    
    const result = JSON.parse(response.text || '[]');
    return Array.isArray(result) ? result : [];
  };

  try {
    return await executeGeneration(modelTier);
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
    if (isQuotaError && modelTier === 'pro') {
      console.warn("[Gemini] Quota exceeded for PRO model in generateBulkHooks. Auto-switching to FLASH mode.");
      return await executeGeneration('flash');
    }
    throw err;
  }
}

export async function generateWizardHooks(genre: string, idea: string, apiKey: string, modelTier: string = 'flash', trace?: ModelUsageTrace): Promise<string[]> {
  if (hasGroqApiKey()) {
    const prompt = `
      Genera 3 hook virali per un video breve.
      Genere: "${genre}"
      Idea: "${idea}"
      
      Regole CRITICHE:
      1. Assicurati che ogni hook sia una frase COMPLETA. Non troncare a metà.
      2. Se la frase non sta in una riga, finiscila correttamente.
      3. Massimo 12-15 parole per hook.
      4. Restituisci SOLO un oggetto JSON con una chiave "hooks" che contiene l'array di stringhe.
    `;
    const response = await groqTextCompletion({
      responseFormat: 'json_object',
      task: 'wizard_hook_generation',
      messages: [
        { role: 'system', content: 'Rispondi con un oggetto JSON del tipo {"hooks":["..."]}. Assicurati che le frasi siano complete.' },
        { role: 'user', content: prompt },
      ],
      timeoutMs: 120000,
    });
    console.log("[WIZARD_HOOK_GENERATION_PROVIDER_RESPONSE] groq", response.text);
    const parsed = safeParseJSON(response.text || '{}');
    const hooks = Array.isArray(parsed?.hooks) ? parsed.hooks : (Array.isArray(parsed) ? parsed : []);
    const validHooks = (hooks as any[]).filter(h => {
      if (typeof h !== 'string' || h.trim().length < 5) return false;
      const t = h.trim();
      // Basic check for obvious truncation (ends with space or lacks ending punctuation in a long sentence)
      if (t.length > 20 && !/[.!?…",]/.test(t.slice(-3))) {
        // We allow it but with a warning, or we could reject. For now, let's keep it but log.
        console.warn(`[HOOK_SUSPECTED_TRUNCATION] ${t}`);
      }
      return true;
    });
    if (validHooks.length === 0) {
      console.warn("[WIZARD_HOOK_GENERATION_EMPTY] no valid hooks found");
    } else {
      console.log(`[WIZARD_HOOKS_PARSED_COUNT] count=${validHooks.length}`);
    }
    return validHooks;
  }
  const executeGeneration = async (currentModelTier: string) => {
    const { ai } = getAI(apiKey);
    const model = selectModel(currentModelTier === 'pro' ? 'pro' : 'flash', 'flash', apiKey);
    
    const prompt = `
      Genera 3 hook virali per un video breve.
      Genere: "${genre}"
      Idea: "${idea}"
      
      Regole:
      1. Usa il Curiosity Gap.
      2. Max 15 parole per hook.
      3. Devono essere molto diversi tra loro (es. uno basato su un errore, uno su un segreto, uno su una statistica shock).
      
      Restituisci SOLO un oggetto JSON con una chiave "hooks" che contiene l'array di stringhe.
    `;

    const response = await executeWithNetworkRetry((currentAi, dynamicModel) => currentAi.models.generateContent({
      model: dynamicModel || model,
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json" }
    }), 2, undefined, 300000, apiKey, undefined, model, trace, "Wizard Hook Generation", currentModelTier as "flash" | "pro"); 
    
    console.log("[WIZARD_HOOK_GENERATION_PROVIDER_RESPONSE] gemini text length", response.text?.length);
    const result = safeParseJSON(response.text || '{"hooks": []}');
    const hooks = Array.isArray(result?.hooks) ? result.hooks : (Array.isArray(result) ? result : []);
    const validHooks = hooks.filter(h => typeof h === 'string' && h.trim().length > 0);
    if (validHooks.length === 0) {
      console.warn("[WIZARD_HOOK_GENERATION_EMPTY] no valid hooks found");
    } else {
      console.log(`[WIZARD_HOOKS_PARSED_COUNT] count=${validHooks.length}`);
    }
    return validHooks;
  };

  try {
    return await executeGeneration(modelTier);
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
    if (isQuotaError && modelTier === 'pro') {
      console.warn("[Gemini] Quota exceeded for PRO model in generateWizardHooks. Auto-switching to FLASH mode.");
      return await executeGeneration('flash');
    }
    throw err;
  }
}

export async function compareWizardHooks(genre: string, idea: string, hookA: string, hookB: string, apiKey: string, modelTier: string = 'flash', trace?: ModelUsageTrace): Promise<any> {
  if (hasGroqApiKey()) {
    const prompt = `
      Analizza questi due hook e scegli il migliore per la viralità su TikTok/Shorts.
      Genere: "${genre}"
      Idea: "${idea}"
      Hook 1: "${hookA}"
      Hook 2: "${hookB}"
      Restituisci SOLO JSON valido con recommendedWinner, verdict, improvements.
    `;
    const response = await groqTextCompletion({
      responseFormat: 'json_object',
      task: 'wizard_hook_comparison',
      messages: [
        { role: 'system', content: 'Rispondi solo con JSON valido.' },
        { role: 'user', content: prompt },
      ],
      timeoutMs: 120000,
    });
    return safeParseJSON(response.text || '{}');
  }
  const executeComparison = async (currentModelTier: string) => {
    const { ai } = getAI(apiKey);
    const model = selectModel(currentModelTier === 'pro' ? 'pro' : 'flash', 'flash', apiKey);
    
    const prompt = `
      Analizza questi due hook e scegli il migliore per la viralità su TikTok/Shorts.
      Genere: "${genre}"
      Idea: "${idea}"
      Hook 1: "${hookA}"
      Hook 2: "${hookB}"
      
      Restituisci un JSON con questa struttura:
      {
        "recommendedWinner": "A" o "B" (A per Hook 1, B per Hook 2),
        "verdict": "Spiegazione psicologica del perché vince",
        "improvements": "Come renderlo ancora più forte"
      }
    `;

    const response = await executeWithNetworkRetry((currentAi, dynamicModel) => currentAi.models.generateContent({
      model: dynamicModel || model,
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json" }
    }), 2, undefined, 300000, apiKey, undefined, model, trace, "Wizard Hook Comparison", currentModelTier as "flash" | "pro"); 
    
    return safeParseJSON(response.text || '{}');
  };

  try {
    return await executeComparison(modelTier);
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
    if (isQuotaError && modelTier === 'pro') {
      console.warn("[Gemini] Quota exceeded for PRO model in compareWizardHooks. Auto-switching to FLASH mode.");
      return await executeComparison('flash');
    }
    throw err;
  }
}
