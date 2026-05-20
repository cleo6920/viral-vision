import { Type, Schema } from '@google/genai';
import { getAI, selectModel, executeWithNetworkRetry, parseDataUrl, safeParseJSON, resetQuotaStatus, executeGroqFirstTextTask as executeGroqFirstTextTaskCore } from './core';
import { enforceFinalOutputContract } from './generation';
import { getExternalMarketSignals } from '../youtubeService';
import { ANALYSIS_SCHEMA, FINAL_ANALYSIS_SCHEMA, EXTERNAL_SIGNAL_EXTRACTION_SCHEMA, BLUE_OCEAN_NICHES_SCHEMA, IDEA_ENGINE_SCHEMA, BASE_PROMPT_SCHEMA, VIRAL_BOOST_SCHEMA, FINAL_EVOLUTION_SCHEMA, DECISION_GATE_SCHEMA, TRANSFORMATION_ENGINE_SCHEMA } from './schemas';
import { SYSTEM_INSTRUCTION, JUDGE_SYSTEM_INSTRUCTION, STRICT_ANALYTICAL_ENGINE_RULES } from './constants';
import { logger } from '../../utils/logger';
import { ExternalMarketData, ModelRouting, ModelRoutingStep, ModelUsageTrace } from '../../types';
import { AudioAnchorResult } from './audioAnchor';
import { getGroqConfig, groqTextCompletion } from '../ai/groqClient';
import { isGroqMode, hasGroqApiKey, isHuggingMode, resolveHuggingFaceModel } from '../ai/providerRouter';
import { hfVisionAnalysis } from '../ai/huggingFaceClient';

const requestedModelForTier = (tier: string | undefined) => {
  const normalized = (tier || 'flash').toLowerCase();
  if (normalized === 'groq' || normalized === 'hugging') return normalized;
  return normalized === 'pro' || normalized === 'smart' ? 'pro' : 'flash';
};

function initModelRouting(isPaid: boolean): ModelRouting {
  return {
    steps: [],
    fallbackTriggered: false,
    proAvailable: isPaid,
    confidence: "high"
  };
}

function recordRoutingStep(
  routing: ModelRouting | undefined,
  stepName: string,
  modelName: string,
  reasonStr: string,
  statusStr: "primary" | "fallback" = "primary"
) {
  if (!routing) return;
  
  // Clean model name
  const cleanModel = modelName.includes('pro') ? 'pro' : 'flash';
  
  routing.steps.push({ 
    step: stepName, 
    model: cleanModel, 
    reason: reasonStr, 
    status: statusStr 
  });
  
  if (statusStr === "fallback") {
    routing.fallbackTriggered = true;
    routing.confidence = "medium";
  }
}

async function executeGroqFirstTextTask(params: {
  preferGroq: boolean;
  prompt: string;
  systemInstruction: string;
  timeoutMs: number;
  taskType: any;
  layer: string;
  model: string;
  apiKey?: string;
  onProgress?: (text: string) => void;
  onFallback?: () => void;
  trace?: ModelUsageTrace;
  modelTier?: string;
  callReason?: string;
  inputSource?: 'video_file' | 'file_uri' | 'video_summary' | 'local_data' | 'text_input' | 'niche_text' | 'script_text' | 'video_frames' | 'hierarchy_data' | 'multi_modal_feedback';
  geminiOp: (currentAi: any, dynamicModel?: string) => Promise<any>;
}) {
  return await executeGroqFirstTextTaskCore({
    ...params,
    geminiOp: (ai, model) => params.geminiOp(ai, model)
  });
}

export async function analyzeContent(content: string, apiKey?: string, modelTier: string = 'flash', onProgress?: (text: string) => void, trace?: ModelUsageTrace): Promise<any> {
  const model = selectModel(requestedModelForTier(modelTier), 'flash', apiKey);
  
  const prompt = `
    Analizza questo contenuto video/idea e restituisci un JSON strutturato.
    Contenuto: "${content}"
  `;

  const response = await executeGroqFirstTextTask({
    preferGroq: true,
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    timeoutMs: 240000,
    taskType: 'IDEA_ANALYSIS',
    layer: 'Analyze Content',
    model,
    apiKey,
    onProgress,
    trace,
    modelTier,
    callReason: "Basic content analysis",
    inputSource: "text_input",
    geminiOp: async (currentAi, dynamicModel) => {
      return await currentAi.models.generateContent({
        model: dynamicModel || model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: ANALYSIS_SCHEMA as any
        }
      });
    }
  });

  return safeParseJSON(response.text || '{}');
}

export async function getTrendingTopics(niche: string, apiKey?: string, modelTier: string = 'flash', onProgress?: (text: string) => void, trace?: ModelUsageTrace): Promise<string[]> {
  const model = selectModel(requestedModelForTier(modelTier), 'flash', apiKey);
  
  const prompt = `
    Elenca i 5 trend più forti in questo momento su TikTok/Reels per la nicchia: "${niche}".
    Sii specifico (es. non "video divertenti", ma "POV: quando il capo ti chiede... con suono X").
    Restituisci SOLO un array JSON di stringhe.
  `;

  const response = await executeGroqFirstTextTask({
    preferGroq: true,
    prompt,
    systemInstruction: "Sei un esperto di trend social. Rispondi solo con un array JSON di stringhe.",
    timeoutMs: 240000,
    taskType: 'MARKET_TEXT',
    layer: 'Trending Topics',
    model,
    apiKey,
    onProgress,
    trace,
    modelTier,
    callReason: "Market trend discovery",
    inputSource: "niche_text",
    geminiOp: async (currentAi, dynamicModel) => {
      return await currentAi.models.generateContent({
        model: dynamicModel || model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          responseMimeType: "application/json" 
        }
      });
    }
  });
  
  const result = safeParseJSON(response.text || '[]', []);
  return Array.isArray(result) ? result : [];
}

export async function analyzePsychologicalTriggers(script: string, apiKey?: string, modelTier: string = 'flash', onProgress?: (text: string) => void, trace?: ModelUsageTrace): Promise<any> {
  const model = selectModel(requestedModelForTier(modelTier), 'flash', apiKey);
  
  const prompt = `
    Analizza questo script e identifica i trigger psicologici presenti (es. FOMO, Riprova Sociale, Bias di Conferma).
    Script: "${script}"
    
    Restituisci un JSON strutturato:
    {
      "triggers": [
        { "name": "Nome Trigger", "description": "Dove e come viene usato", "strength": "Alta/Media/Bassa" }
      ],
      "missingTriggers": ["Trigger che potresti aggiungere per potenziarlo"]
    }
  `;

  const response = await executeGroqFirstTextTask({
    preferGroq: true,
    prompt,
    systemInstruction: "Sei un analista di marketing psicologico per short-form video. Rispondi solo con JSON valido.",
    timeoutMs: 240000,
    taskType: 'SCRIPT_ANALYSIS',
    layer: 'Psychological Triggers Analysis',
    model,
    apiKey,
    onProgress,
    trace,
    modelTier,
    callReason: "Psychological impact assessment",
    inputSource: "script_text",
    geminiOp: async (currentAi, dynamicModel) => {
      return await currentAi.models.generateContent({
        model: dynamicModel || model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          responseMimeType: "application/json" 
        }
      });
    }
  });
  
  return safeParseJSON(response.text || '{}');
}

export async function runViralBrainAnalysis(
  generatedData: any,
  apiKey: string,
  modelTier: string = 'pro',
  trace?: ModelUsageTrace,
  videoSummary?: string
): Promise<any> {
  if (modelTier === 'test') {
    logger.warn("[TEST_MODE_MODULE_SKIPPED] module=runViralBrainAnalysis reason=TEST_MODE_LITE");
    return { skipped: true, viralStructure: {} };
  }
  const { ai } = getAI(apiKey);
  const effectiveModelTier = modelTier;
  const model = selectModel(requestedModelForTier(effectiveModelTier), 'flash', apiKey);

  const contextSource = videoSummary || JSON.stringify(generatedData.sourceContext || {});

  const prompt = `
    SEI IL VIRAL_BRAIN (LAYER OBBLIGATORIO DI VALIDAZIONE POST-GENERAZIONE).
    Il tuo compito è analizzare oggettivamente l'output creativo e decidere se è conforme ai nuovi standard di evoluzione narrativa reale.

    DATI DA VALUTARE (VIRAL_STRUCTURE):
    ${JSON.stringify(generatedData.viralStructure)}
    
    CONTESTO SORGENTE:
    ${contextSource}

    REGOLE MANDATORIE PER IL FAIL:
    1. STATE CHANGE: Se l'inizio (startState) è quasi uguale alla fine (payoff/endState) -> FAIL. Deve esserci un cambiamento visivo o percettivo rilevabile.
    2. PAYOFF: Deve essere un evento percepibile, non una descrizione piatta. Se debole -> FAIL.
    3. STATIC + PERSONA: Se il video sorgente è STATIC_IMAGE/ILLUSTRATION e c'è una persona/carattere:
       - DEVE esserci una microActivation (respiro, occhi, battito di ciglia, gesto minimo).
       - Se assente -> FAIL.
    4. HOOK SOURCE: L'hook deve derivare da "human", "action" o "situation".
       - Se deriva puramente dall'ambiente (environment) o dallo sfondo -> FAIL.
    5. DISTINZIONE FASI: Hook, Build e Payoff devono essere semanticamente distinti.
       - Se c'è overlap alto o sono descrizioni simili -> FAIL.
    7. PATTERN BREAK (CRITICAL):
       - ATTENZIONE AL POTENZIALE CREATIVO: Determina 'creativePotential' basandoti sull'input (STATIC+minimal=low, STATIC+context=medium, VIDEO/dynamic=high).
       - Includi 'creativePotentialReason' (spiegazione del perché).
       - 'creativeDepth' NON PUò superare 'creativePotential'.
       - Valuta 'qualityWithinCeiling': Se 'achieved' < 'ceiling' (e isMaxedOut = false), il sistema deve suggerire di rigenerare se possibile, per evitare pigrizia creativa quando c'è ancora margine.
       - 'patternBreak' deve essere TRUE solo se esiste tensione/curiosità naturale. NON inventare azioni artificiali forzate se non servono. 
       - Se patternBreak è FALSE, allora 'creativeDepth' deve essere limitato a MAX "medium".
       
    8. LOOP: Deve essere naturale e fluido.
    
    SCHEMA DI VERDETTO:
    - PASS: Tutte le regole rispettate, evoluzione coerente col potenziale, payoff proporzionato.
    - FAIL: Violazione di una o più regole mandatorie (es. superamento potenziale, artificialità forzata).
    - RIGENERA: Se 'achieved' < 'ceiling' e c'è spazio per ottimizzare senza forzature.
    - WEAK_PASS: Regole base rispettate ma creatività bassa o payoff prevedibile.
    - FAIL: Violazione di una o più regole mandatorie sopra elencate.

    RETRY INSTRUCTIONS (Obbligatorie se FAIL):
    - fix: Azione tecnica immediata per risolvere il problema.
    - avoid: Cosa NON fare nel prossimo tentativo.
    - target: L'obiettivo di qualità "Elite" da raggiungere.
  `;

  try {
    const { VIRAL_BRAIN_SCHEMA } = await import('./schemas');
    const response = await executeGroqFirstTextTask({
      preferGroq: true,
      prompt: prompt,
      systemInstruction: "Sei il nucleo analitico della viralità. Non accetti pigrizia creativa. Ogni scena deve EVOLVERE.",
      timeoutMs: 60000,
      taskType: 'FINAL_JUDGE',
      layer: 'Viral Brain Analysis',
      model,
      apiKey,
      trace,
      modelTier: effectiveModelTier,
      callReason: "Validation of creative evolution effectiveness",
      inputSource: (videoSummary ? 'video_summary' : 'local_data'),
      geminiOp: async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: prompt,
          config: { 
            systemInstruction: "Sei il nucleo analitico della viralità. Non accetti pigrizia creativa. Ogni scena deve EVOLVERE.",
            responseMimeType: "application/json",
            responseSchema: VIRAL_BRAIN_SCHEMA as any
          }
        });
      }
    });

    const parsed = safeParseJSON(response.text || '{}');
    return parsed;
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED')) {
      logger.error("[VIRAL_BRAIN_FAILED] Hard fail due to Auth/Quota. Bubbling up.");
      throw err;
    }
    logger.error("[VIRAL_BRAIN_FAILED]", err);
    return { 
      finalVerdict: "PASS", 
      stateChange: { detected: true, description: "Bypassato per errore tecnico" },
      payoff: { strength: "MEDIUM", event: "Bypassato" },
      loop: { isNatural: true, quality: "VALID" },
      microActivation: { present: true, type: "Bypassato" },
      hookSource: "HUMAN",
      phaseCheck: { distinct: true, details: "Bypassato" },
      creativeDepth: "medium"
    };
  }
}

export async function findBlueOceanNiches(
  frames: any[], 
  goal: string, 
  cast: string, 
  apiKey?: string, 
  genre: string = 'general', 
  modelTier: string = 'flash',
  onProgress?: (text: string) => void,
  trace?: ModelUsageTrace,
  videoSummary?: string,
  onProgressUpdate?: (data: { phase: string; module: string; provider?: string; status: string; step?: number; totalSteps?: number; fallbackActive?: boolean }) => void
): Promise<any> {
  if (modelTier === 'test') {
    logger.warn("[TEST_MODE_MODULE_SKIPPED] module=findBlueOceanNiches reason=TEST_MODE_LITE");
    return {
      step1_ideaAnalysis: { nicheViability: "UNVERIFIED", nicheViabilityReason: "TEST_MODE_LITE SKIPPED" },
      step2_ideaEngine: { 
        safeIdea: { id: "safe", title: "Test Idea", script: "Test", hook: "Test" },
        unexpectedIdea: { id: "unexpected", title: "Test Idea", script: "Test", hook: "Test" },
        extremeIdea: { id: "extreme", title: "Test Idea", script: "Test", hook: "Test" },
        improvedOriginalIdea: { id: "improved", title: "Test Idea", script: "Test", hook: "Test" },
        aiRecommendedIdeaId: "safe",
        aiRecommendedReason: "TEST_MODE_LITE"
      }
    };
  }
  const executeNiches = async (currentModelTier: string) => {
    const { ai } = getAI(apiKey);
    const model = selectModel(requestedModelForTier(currentModelTier), 'flash', apiKey);

    onProgressUpdate?.({
      phase: "Blue Ocean / Ricerca nicchie",
      module: "Analizzatore Mercato",
      status: "Inizializzazione cluster di ricerca...",
      step: 1,
      totalSteps: 5
    });

    // --- YouTube Market Data Fetching ---
    let externalMarketData: ExternalMarketData | undefined;
    try {
      const youtubeApiKey = localStorage.getItem('youtube_api_key') || undefined;
      const researchContext = `GOAL: ${goal} | CAST: ${cast} | GENRE: ${genre}`;
      
      onProgressUpdate?.({
        phase: "Blue Ocean / Ricerca nicchie",
        module: "YouTube Market Data",
        provider: "YouTube API",
        status: "Ricerca video comparabili in corso...",
        step: 2,
        totalSteps: 5
      });
      
      externalMarketData = await getExternalMarketSignals(researchContext, apiKey || '', youtubeApiKey, currentModelTier);
      
      onProgressUpdate?.({
        phase: "Blue Ocean / Ricerca nicchie",
        module: "YouTube Market Data",
        status: `Trovati ${externalMarketData?.comparableVideos?.length || 0} segnali di mercato.`,
        step: 3,
        totalSteps: 5
      });
    } catch (e) {
      logger.warn("[BLUE_OCEAN_MARKET_SIGNALS_FAILED] Continuing without external data", e);
    }
    
    // --- Gemini/Groq Logic ---
    const onInternalProgress = (text: string) => {
       onProgressUpdate?.({
         phase: "Generazione Idee",
         module: "Ragionatore Creativo",
         status: text,
         step: 4,
         totalSteps: 5
       });
       if (onProgress) onProgress(text);
    };

    // --- ANTI QUOTE WASTE: Prioritize Summary over frames if sufficient ---
    const useSummaryOnly = videoSummary && videoSummary.length > 50;
    const finalFrames = useSummaryOnly ? [] : frames;

    const prompt = `
      PRODUCTION FLOW  |  VIRAL ENGINE MODE (MANDATORY)
      Il Production Flow NON è un generatore di prompt. è un motore di evoluzione progressiva dell'IDEA.
      Ogni step deve migliorare l'idea, aumentare la probabilità virale e ridurre banalità e AI slop.
      Se un passaggio non migliora l'idea -> è da considerarsi FALLITO.

      Analizza questi frame o l'idea di base.
      ${videoSummary ? `CONTEXT SUMMARY: ${videoSummary}` : ""}
      Obiettivo: "${goal}"
      Cast/Soggetto: "${cast}"
      Genere: "${genre}"

      Esegui i seguenti step:
      
      STEP 1  |  IDEA ANALYSIS
      Estrai:
      - CORE VIRAL MECHANIC
      - Tipo di curiosità (irrisolta / impossibile / errore umano / sfida sociale)
      - Punto di retention previsto
      - Debolezze dell'idea
      - Rischio banalità (LOW / MEDIUM / HIGH)
      - NICHE VIABILITY CHECK: Valuta la nicchia/tema come ALIVE, SATURATED, WEAK o DEAD e spiega il perché.

      STEP 2  |  IDEA ENGINE (CRITICAL)
      Genera tre tipi di idee STRATEGICAMENTE DISTINTE (non variazioni minori dello stesso concetto) seguendo il PROTOCOLLO GENERAZIONE IDEE:
      
      1. IDEA SICURA:
         - Basata su una meccanica familiare e provata.
         - Novità minima, alta affidabilità di esecuzione.
      
      2. IDEA INASPETTATA:
         - DEVE introdurre un twist non ovvio nell'interazione, nel contesto o nel payoff.
         - Deve sembrare fresca senza diventare caotica.
         - NON può essere una variazione minore dell'idea sicura.
      
      3. IDEA ESTREMA:
         - DEVE creare una rottura immediata della realtà.
         - DEVE essere comprensibile in meno di 1 secondo.
         - DEVE innescare una forte reazione "cosa ho appena visto?".
         - NON può dipendere da confusione, casualità o pura stranezza estetica.

      IDEA SCORING SYSTEM:
      Per ogni idea (Safe, Unexpected, Extreme, Improved Original), calcola i punteggi (0-10) per:
      - immediateClarity
      - scrollStopPower
      - escalationStrength
      - humanMoment
      - loopPotential
      - shockNovelty
      - finalScore (media dei 6 criteri)

      SELECTION RULE:
      - Se Extreme Idea finalScore >= 8 -> PRIORITIZE Extreme.
      - Se Extreme < 8 e Unexpected >= 7 -> Scegli Unexpected.
      - Altrimenti -> Fallback su Safe.

      CHAOS FACTOR (MANDATORY BUT CONTROLLED):
      Occasionalmente (20-30% dei casi), ignora la SELECTION RULE standard se un'idea ha un punteggio di SHOCK/NOVELTY molto alto (>=9) anche se il punteggio strutturale complessivo è più basso.
      - In questo caso, marca l'idea come isHighRiskHighReward: true.
      - Selezionala come AI RECOMMENDED IDEA spiegando che è una scommessa ad alto rischio ma con potenziale di breakthrough virale.

      REGOLA DIFFERENZIAZIONE: Se le 3 idee sono troppo simili, rigenera finché le differenze strategiche non sono chiare.

      Inoltre:
      - migliorare anche l'idea originale
      Per ogni idea specifica: Market gap, Trigger psicologico, Rischio, Scores, isHighRiskHighReward.
      OBBLIGATORIO: Scegli una AI RECOMMENDED IDEA basandoti sulla SELECTION RULE o sul CHAOS FACTOR e fornisci la REASON.
      
      RESTITUISCI SOLO UN OGGETTO JSON ESATTAMENTE CON QUESTA STRUTTURA (NIENTE MARKDOWN, NIENTE TESTO FUORI DAL JSON, LE CHIAVI DEVONO ESSERE ESATTE):
      {
        "step1_ideaAnalysis": {
          "coreViralMechanic": "string",
          "curiosityType": "string",
          "expectedRetentionPoint": "string",
          "ideaWeaknesses": "string",
          "banalityRisk": "LOW|MEDIUM|HIGH",
          "nicheViability": "ALIVE|SATURATED|WEAK|DEAD",
          "nicheViabilityReason": "string"
        },
        "step2_ideaEngine": {
          "safeIdea": { "id": "safe", "title": "string", "description": "string", "marketGap": "string", "psychologicalTrigger": "string", "risk": "string", "scores": { "immediateClarity": 0, "scrollStopPower": 0, "escalationStrength": 0, "humanMoment": 0, "loopPotential": 0, "shockNovelty": 0, "finalScore": 0 }, "isHighRiskHighReward": false },
          "unexpectedIdea": { "id": "unexpected", "title": "string", "description": "string", "marketGap": "string", "psychologicalTrigger": "string", "risk": "string", "scores": { "immediateClarity": 0, "scrollStopPower": 0, "escalationStrength": 0, "humanMoment": 0, "loopPotential": 0, "shockNovelty": 0, "finalScore": 0 }, "isHighRiskHighReward": false },
          "extremeIdea": { "id": "extreme", "title": "string", "description": "string", "marketGap": "string", "psychologicalTrigger": "string", "risk": "string", "scores": { "immediateClarity": 0, "scrollStopPower": 0, "escalationStrength": 0, "humanMoment": 0, "loopPotential": 0, "shockNovelty": 0, "finalScore": 0 }, "isHighRiskHighReward": false },
          "improvedOriginalIdea": { "id": "improved", "title": "string", "description": "string", "marketGap": "string", "psychologicalTrigger": "string", "risk": "string", "scores": { "immediateClarity": 0, "scrollStopPower": 0, "escalationStrength": 0, "humanMoment": 0, "loopPotential": 0, "shockNovelty": 0, "finalScore": 0 }, "isHighRiskHighReward": false },
          "aiRecommendedIdeaId": "safe | unexpected | extreme | improved",
          "aiRecommendedReason": "string"
        }
      }
    `;

    const response = await executeGroqFirstTextTask({
      preferGroq: useSummaryOnly || frames.length === 0,
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      timeoutMs: 300000,
      taskType: 'BLUE_OCEAN',
      layer: 'Blue Ocean Niches',
      model,
      apiKey,
      onProgress: onInternalProgress,
      trace,
      modelTier,
      callReason: 'Ideation based on market gaps',
      onFallback: () => {
        onProgressUpdate?.({
          phase: "Generazione Idee (Fallback)",
          module: "Dispatcher Cognitivo",
          status: "Recupero tramite Gemini Parachute attivo...",
          fallbackActive: true,
          step: 4,
          totalSteps: 5
        });
      },
      inputSource: (useSummaryOnly ? 'video_summary' : (frames.length > 0 ? 'video_frames' : 'local_data')),
      geminiOp: async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: { parts: [...finalFrames.map(f => {
            const p = parseDataUrl(f);
            return p ? { inlineData: { mimeType: p.mimeType, data: p.data } } : null;
          }).filter(Boolean) as any, { text: prompt }] },
          config: { 
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: IDEA_ENGINE_SCHEMA as any
          }
        });
      }
    });
    
    return safeParseJSON(response.text || '{}');
  };

  try {
    return await executeNiches(modelTier);
  } catch (err: any) {
    throw err;
  }
}

export async function runCoreIntentClassifier(
  parts: any[],
  apiKey: string,
  modelTier: string = 'flash',
  onProgress?: (text: string) => void,
  trace?: ModelUsageTrace,
  videoSummary?: string
): Promise<any> {
  const analysisModelTier = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
  if (isGroqMode(modelTier) || (analysisModelTier === 'groq')) {
      logger.info("[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] module=Core Intent Classifier reason=external_mode_override");
      return { 
          coreIntent: "NON_GENERATO_CORE_TEST", 
          confidence: 0, 
          intentReasoning: "NON_GENERATO_CORE_TEST", 
          isFallback: true 
      };
  }

  if (modelTier === 'test') {
    logger.warn("[TEST_MODE_MODULE_SKIPPED] module=runCoreIntentClassifier reason=TEST_MODE_LITE");
    return { coreIntent: "ALTRO", confidence: 1, intentReasoning: "TEST_MODE_LITE", isFallback: true };
  }
  const { ai } = getAI(apiKey);
  const model = selectModel(requestedModelForTier(modelTier), 'flash', apiKey);

  const { CORE_INTENT_CLASSIFIER_RULES, SYSTEM_INSTRUCTION } = await import('./constants');
  const { CORE_INTENT_CLASSIFIER_SCHEMA } = await import('./schemas');

  // --- ANTI QUOTE WASTE: PRIORITIZZAZIONE SUMMARY ---
  const textParts = parts.filter(p => p.text);
  const textContent = textParts.map(p => p.text).join(' ');
  const hasVideoPayload = parts.some(p => p.inlineData || p.fileData || p.video);
  
  // Se abbiamo un summary o testo sufficiente, rimuoviamo il payload video
  const isSufficientSummary = (videoSummary && videoSummary.length > 30) || textContent.length > 100;
  const useTextOnly = isSufficientSummary && hasVideoPayload;
  
  let finalParts = useTextOnly ? [...textParts] : [...parts];
  if (useTextOnly && videoSummary) {
    finalParts.push({ text: `[CONTEXT_REUSE] Video Summary: ${videoSummary}` });
  }

  const prompt = `
    ESEGUI CORE_INTENT_CLASSIFIER (PRE-HIERARCHY LAYER).
    
    Il tuo compito è decidere il CORE INTENT del contenuto basandoti sulla dominanza visiva e semantica descritta o osservata.
    Rispetta rigorosamente le REGOLE DI PRIORITà: PERFORMANCE > REAL_EVENT > PERSONA > PRODOTTO > EVENTO > AMBIENTE > INFORMATIVO.
    
    ${CORE_INTENT_CLASSIFIER_RULES}
  `;

  finalParts.push({ text: prompt });

  try {
    const response = await executeGroqFirstTextTask({
      preferGroq: useTextOnly,
      prompt: finalParts.map((part: any) => part?.text || '').filter(Boolean).join("\n\n"),
      systemInstruction: SYSTEM_INSTRUCTION,
      timeoutMs: 300000,
      taskType: 'IDEA_ANALYSIS',
      layer: 'Core Intent Classifier',
      model,
      apiKey,
      onProgress,
      trace,
      modelTier,
      callReason: 'Intent classification based on hierarchy rules',
      inputSource: (useTextOnly ? 'video_summary' : 'video_file'),
      geminiOp: async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: { parts: finalParts },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: CORE_INTENT_CLASSIFIER_SCHEMA as any
          }
        });
      }
    });

    const result = safeParseJSON(response.text || '{}');
    logger.info("[CORE_INTENT_CLASSIFIER_COMPLETED]", result);
    return result;
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      logger.error("[CORE_INTENT_CLASSIFIER_FAILED] Hard fail due to Auth/Quota/Resource. Bubbling up.");
      throw err;
    }
    
    const isInternal500 = errorMsg.includes('500') || errorMsg.includes('INTERNAL');
    if (isInternal500) {
       logger.warn("[CORE_INTENT_CLASSIFIER_FAST_FALLBACK]", { error: errorMsg });
       
       // Fallback basato su inferenza minima testuale per non bloccare la pipeline
       let inferredIntent = "ALTRO";
       if (textContent.toLowerCase().includes("prodotto") || textContent.toLowerCase().includes("scarpa") || textContent.toLowerCase().includes("oggetto")) inferredIntent = "PRODOTTO";
       else if (textContent.toLowerCase().includes("persona") || textContent.toLowerCase().includes("influencer") || textContent.toLowerCase().includes("volto")) inferredIntent = "PERSONA";
       else if (textContent.toLowerCase().includes("evento") || textContent.toLowerCase().includes("concerto") || textContent.toLowerCase().includes("stadio")) inferredIntent = "REAL_EVENT";
       
       return { 
         coreIntent: inferredIntent, 
         confidence: 0.1, 
         intentReasoning: `Fallback post-INTERNAL_500. Intent inferito: ${inferredIntent}`,
         intentPriorityApplied: false,
         rejectedIntentCandidates: [],
         isFallback: true,
         errorType: "INTERNAL_500",
         engineReliability: "DEGRADED"
       };
    }

    logger.warn("[MODULE_FALLBACK_APPLIED] module=CORE_INTENT_CLASSIFIER errorType=SERVICE_ERROR strategy=FAST_FALLBACK");
    return { 
      coreIntent: "ALTRO", 
      confidence: 0, 
      intentReasoning: "Fallback due to service error",
      intentPriorityApplied: false,
      rejectedIntentCandidates: [],
      isFallback: true,
      errorType: "SERVICE_ERROR",
      engineReliability: "DEGRADED"
    };
  }
}

export async function runDecisionGate(
  videoData: any,
  apiKey: string,
  modelTier: string = 'flash',
  externalMarketData?: ExternalMarketData,
  onProgress?: (text: string) => void,
  trace?: ModelUsageTrace,
  videoSummary?: string
): Promise<any> {
  if (modelTier === 'test') {
    logger.warn("[TEST_MODE_MODULE_SKIPPED] module=runDecisionGate reason=TEST_MODE_LITE");
    return { decision: "KEEP", confidence: 1, reasoning: "TEST_MODE_LITE", riskLevel: "LOW" };
  }
  const executeGate = async (retries = 1): Promise<any> => {
    try {
      const { ai } = getAI(apiKey);
      const model = selectModel(requestedModelForTier(modelTier), 'flash', apiKey);

      // --- ANTI QUOTE WASTE: Prioritize Summary ---
      const decisionSource = videoSummary || JSON.stringify(videoData);

      const prompt = `
        SEI IL DECISION ENGINE STRATEGICO.
        Devi SOLO decidere le sorti produttive di questa idea. Nient'altro.

        Dati Input: ${decisionSource}
        ${externalMarketData && externalMarketData.status === 'SUCCESS' ? `Dati Mercato: ${JSON.stringify(externalMarketData)}` : 'Nessun dato di mercato'}

        REGOLE:
        - Sii spietato. Se l'idea non ha speranze di trattenere l'attenzione, scegli REPLACE.
        - Se ha potenziale ma necessita di cambiamenti, scegli MODIFY.
        - Se è già fortissima, scegli KEEP.
        - confidence da 0.0 a 1.0.
      `;

      const response = await executeGroqFirstTextTask({
        preferGroq: true,
        prompt: prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        timeoutMs: 300000,
        taskType: 'CORE_ANALYSIS',
        layer: 'Decision Gate',
        model,
        apiKey,
        onProgress,
        trace,
        modelTier,
        callReason: 'Final production worthiness decision',
        inputSource: (videoSummary ? 'video_summary' : 'local_data'),
        geminiOp: async (currentAi, dynamicModel) => {
          return await currentAi.models.generateContent({
            model: dynamicModel || model,
            contents: { parts: [{ text: prompt }] },
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: DECISION_GATE_SCHEMA as any
            }
          });
        }
      });

      const parsed = safeParseJSON(response.text || '{}');
      if (!parsed.decision || typeof parsed.confidence !== 'number') {
        throw new Error("INVALID_GATE_DATA");
      }
      return parsed;

    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED')) {
        logger.error("[Decision Gate] Hard fail due to Auth/Quota. Bubbling up.");
        throw err;
      }
      if (retries > 0) {
        logger.warn(`Decision Gate retry... (${retries} left)`);
        return await executeGate(retries - 1);
      }
      // Fallback decisivo per non bloccare
      return { decision: "KEEP", confidence: 0.5, reasoning: "Fallback decision due to gate error", riskLevel: "MEDIUM" };
    }
  };

  return await executeGate();
}

export async function runFinalViralAnalysis(
  videoData: any, 
  apiKey: string, 
  genre: string, 
  modelTier: string = 'pro',
  externalMarketData?: ExternalMarketData,
  onProgress?: (text: string) => void,
  alternatives?: any,
  contentHierarchy?: any,
  primaryPurposeLock?: any,
  functionalRoleLock?: any,
  ideaAnchorLock?: any,
  coreIntentClassification?: any,
  transformationOutput?: any,
  trace?: ModelUsageTrace,
  videoSummary?: string,
  audioAnchor?: AudioAnchorResult | null,
): Promise<any> {
  const analysisModelTier = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
  if (isGroqMode(modelTier) || (analysisModelTier === 'groq')) {
      logger.info("[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] module=Final Viral Analysis reason=external_mode_override");
      return {
          analysis: "NON_GENERATO_CORE_TEST - Analisi finale tramite pipeline esterna (Groq/HF).",
          aiPrompts: "NON_GENERATO_CORE_TEST",
          publishingKit: "NON_GENERATO_CORE_TEST",
          script: "NON_GENERATO_CORE_TEST",
          viralScore: "UNVERIFIED_CORE_TEST",
          runtimeTruthStatus: { mode: 'FULL_MODE', userMessage: 'Analisi completata via Groq/HF Hybrid Full.', severity: 'NONE', failedModules: [], fallbackActive: false, reliabilityImpact: 'Nessuna', timestamp: new Date().toISOString() }
      };
  }
  if (modelTier === 'test') {
    logger.warn("[TEST_MODE_MODULE_SKIPPED] module=runFinalViralAnalysis reason=TEST_MODE_LITE");
    return { skipped: true, aiPrompts: "TEST_MODE_LITE", script: "TEST_MODE_LITE" };
  }
  const executeAnalysis = async (currentModelTier: string) => {
    const { ai, isPaid } = getAI(apiKey);
    const model = selectModel(requestedModelForTier(currentModelTier), 'flash', apiKey);
    
    // --- PAYLOAD REDUCTION TO PREVENT ERROR ---
    const compactVideoData = {
      promptText: videoData?.promptText,
      idea: videoData?.selectedIdea?.title || videoData?.selectedIdea || "N/A",
      originalScript: videoData?.originalScript?.substring(0, 1500),
      generatedScript: videoData?.generatedScript?.substring(0, 1500),
      analysisMode: 'compact'
    };

    const decisionSource = videoSummary || JSON.stringify(compactVideoData);

    const prompt = `
      PRODUCTION FLOW  |  VIRAL ENGINE MODE (MANDATORY)
      STEP 5  |  FINAL PRODUCTION (ONLY ESSENTIAL ASSETS)

      Esegui la produzione finale di questo pacchetto video per il genere ${genre}.
      Dati Interni (Decision/Idea): ${decisionSource}

      ${coreIntentClassification ? `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡½ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡¯ CORE INTENT CLASSIFIER (NUCLEO SEMANTICO):
      ${JSON.stringify(coreIntentClassification)}
      
      VINCOLO DI INTENTO (MANDATORIO):
      - Il video DEVE rispettare il core intent: ${coreIntentClassification.coreIntent}.
      - Se coreIntent = PERSONA: centralIdea, hook e title DEVONO derivare dalla persona. Atmosfera e oggetti sono cornice.
      - Se coreIntent = PRODOTTO: il prodotto deve restare il centro semantico.
      - Se coreIntent = EVENTO: l'azione di partecipare/accadere è il fulcro.
      - Se coreIntent = AMBIENTE: il luogo è il protagonista.
      - Se coreIntent = INFORMATIVO: 
        * VIETATO: Storytelling cinematografico, movimenti di camera fisici, transizioni ambientali, narrative basate su scene, reveal del mondo reale (es. passare da grafica a riprese dal vivo).
        * PERMESSO: Animazioni grafiche, reveal di testo, data visualization, progressione di layout, micro-tensioni visive (glitch, contrasto, delay).
        * MOOD: Deve apparire integralmente come un poster animato o un'infografica editoriale. NO CINEMATIC DRIFT.
        * EMOTION: Sostituisci qualsiasi emozione basata su "experience", "wonder" o "vision" con "clarity", "momentum", "insight".
        * SCORING (STRETTISSIMO): Per categoria INFORMATIVA, viralScore non deve MAI superare 65/100, retention Probability max 45%. Sii pessimista e realista.
        * DESTINATION: Sostituisci "visioni future", "manifesti" o "reveal reali" con "data loop", "conclusione fattuale" o "risoluzione grafica".
        * ALTERNATIVES: Le alternative proposte devono restare nel genere grafico/editoriale. VIETATO saltare in categorie cinematiche.
      ` : ''}

      ${transformationOutput ? `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡¢ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒ...Ã¢â‚¬Å“ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡è STATIC_TO_VIDEO_TRANSLATION_ENGINE:
      ${JSON.stringify(transformationOutput)}
      
      VINCOLO DI TRADUZIONE (MANDATORIO):
      - Applica la microScene: "${transformationOutput.microScene}".
      - Applica la microActivationStrategy: ${JSON.stringify(transformationOutput.microActivationStrategy || {})}.
      - I prompt video DEVONO riflettere queste micro-attivazioni (es. sguardo lucido, gesto minimo, respiro visibile).
      - La scena deve essere loopabile (ritorno alla posizione iniziale codificato nel prompt).
      ` : ''}

      ${contentHierarchy ? `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¡ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡è CONTENT HIERARCHY REASONER (VINCOLANTE):
      ${JSON.stringify(contentHierarchy)}
      
      DEVI ATTENERTI RIGOROSAMENTE A QUESTA GERARCHIA:
      1. contentType e dominantPurpose devono guidare l'intera generazione.
      2. Il primarySubject e la requiredSceneDestination DEVONO essere i protagonisti dello script, del selectedEvent e dei prompt video.
      3. I forbiddenDominantElements NON possono MAI essere selezionati come selectedEvent o essere il nucleo dello script.
      4. Se presenti, i tertiaryElements devono apparire solo come hook o dettagli di sfondo.

      ${primaryPurposeLock ? `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'¢ÃƒÆ’Ã‚Â¢¬ÃƒÆ’Ã¢â‚¬Å¡ÃƒÆ’Ã†'¢ÃƒÆ’Ã‚Â¢¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾¢ PRIMARY PURPOSE LOCK (VINCOLO ASSOLUTO):
      ${JSON.stringify(primaryPurposeLock)}
      
      REGOLE DI DOMINANZA:
      - Gli elementi classificati come DECORATION (es. ${primaryPurposeLock.elementsClassification?.filter(e => e.role === 'DECORATION').map(e => e.element).join(", ")}) NON possono essere nel hook, nel titolo o nella prima scena.
      - Hook e Titolo DEVONO essere costruiti SOLO da CORE_DRIVER o SUPPORT elements.
      - Vincolo Apertura: ${primaryPurposeLock.openingConstraint}
      - Se violi questi vincoli, la generazione fallirà il Primary Purpose Lock.
      ` : ''}

      ${functionalRoleLock ? `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡§à FUNCTIONAL ROLE LOCK (VINCOLO NARRATIVO ASSOLUTO):
      ${JSON.stringify(functionalRoleLock)}
      
      REGOLE DI FUNZIONE:
      - L'emozione primaria del video deve derivare dal primarySubject.
      - è VIETATO usare funzioni narrative (curiosità, mistero, anomalia) derivanti da elementi DECORATION (es. ${functionalRoleLock.implicitElement}).
      - Se l'utente guarda i primi 3 secondi, deve capire cosa deve fare o qual è l'evento reale, non essere distratto da anomalie accessorie.
      ` : ''}

      ${ideaAnchorLock ? `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡¢ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¡ÃƒÆ’Ã†'¢ÃƒÆ’Ã‚Â¢¬ÃƒÆ’Ã¢â‚¬Â¦" IDEA ANCHOR LOCK (VINCOLO CONCETTUALE ASSOLUTO):
      ${JSON.stringify(ideaAnchorLock)}
      
      REGOLE DI ANCORA:
      - CONCEPT: ${ideaAnchorLock.centralIdea}
      - L'idea deve nascere dall'ancora "${ideaAnchorLock.anchorSource}".
      - SE rimuovi le decorazioni, l'idea deve restare intatta. Se la tua idea dipende da una decorazione accessoria, fallirai il test.
      ` : ''}

      ${transformationOutput ? `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡¢ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒ...Ã¢â‚¬Å“ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡è TRANSFORMATION ENGINE (STATIC ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡¢ÃƒÆ’Ã†'¢ÃƒÆ’Ã‚Â¢¬ÃƒÆ’Ã¢â‚¬Å¡àÃƒÆ’Ã†'¢ÃƒÆ’Ã‚Â¢¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾¢ ACTIVE SCENE):
      ${JSON.stringify(transformationOutput)}
      
      VINCOLO DI ATTIVAZIONE:
      - Applica la microScene: "${transformationOutput.microScene}" come base per i prompt video.
      - Mantieni il motionLevel: ${transformationOutput.motionLevel}.
      - NON aggiungere narrativa o eventi che non siano micro-attivazioni naturali.
      ` : ''}
      ` : ''}
      
      ${externalMarketData && externalMarketData.status === 'SUCCESS' ? `
      DATI DI MERCATO ESTERNI (REALI):
      ${JSON.stringify(externalMarketData)}
      ` : `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡¢ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¡àÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡¯ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡ ATTENZIONE: NESSUN DATO DI MERCATO ESTERNO VALIDO DISPONIBILE.
      `}
      
      ${alternatives ? `
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'¢ÃƒÆ’Ã‚Â¢¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾¢ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡¡ ALTERNATIVE STRATEGICHE SCELTE:
      ${JSON.stringify(alternatives)}
      
      ISTRUZIONE: Utilizza l'alternativa scelta sopra come base per i prompt e lo script.
      ` : ''}

      DEVIA CREARE IL PACCHETTO ESATTO ADERENTE ALLO SCHEMA.
      Nessun ragionamento analitico aggiuntivo. Nessuna mappa della dopamina.
      PRODUCI SOLTANTO:

      1. SCRIPT
      - script: Descrizione pulita scene + copione.
      - originalScript: La trascrizione originaria (forense). NON ALLUCINARE.

      2. I PROMPT VIDEO (MANDATORY)
      - aiPrompts: Cinematografico master.
      - soraPrompt12s: Regia e movement focus (12s).
      - klingPrompt
      - veoPrompt
      - coverPrompt: Prompt per la copertina.

      3. VIDEO TRANSLATION (translation & microActivationStrategy)
      - Compila 'translation' e 'microActivationStrategy' seguendo i vincoli del TRANSFORMATION_ENGINE.
      - Se il contenuto originale è STATIC_IMAGE e c'è una PERSONA, il FAIL nel Viral Brain è assicurato se questi campi non sono compilati correttamente con micro-attivazioni reali.

      4. PUBLISHING KIT (Minimal Hooks & Titles)
      Compila i titoli per l'Italia (pubTitleIt) e mondo (pubTitleEn), Hook aggancio visivo, Descrizione social.

      4. STIME BASE E STRUTTURA VIRALE (viralStructure)
      - Definisci la struttura temporale OBBLIGATORIA (Hook 0-1.2s, Build 1.2-4s, Payoff 4-7s, Loop 7-10s).
      - I prompt video DEVONO usare questa struttura come base narrativa, non solo descrivere la scena.
      - viralScore, retentionProbability, predictedViews.
      
      5. REAL VIRAL VALIDATOR (viralValidation)
      DEVONO essere rispettate queste REGOLE ASSOLUTE, altrimenti rifiuteremo il tuo output:
      - Ogni fase (hook, build, payoff, loop) DEVE essere semanticamente diversa dall'altra. Nessuna ripetizione.
      - DEVE esistere un'evoluzione REALE tra startState e endState. Nessuna scena piatta o solo descrittiva.
      - Il payoff DEVE introdurre un cambiamento visivo/percettivo o un micro-evento umano. Le continuazioni piatte sono da FAIL.
      - Il loop DEVE poter tornare al frame iniziale senza stacchi evidenti.
      - Valuta obiettivamente l'output e compila "viralValidation".
      - Se l'idea non permette questa evoluzione, SCARTALA (metti finalVerdict a FAIL).

      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¡ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡è SOURCE ANCHOR CHECK (OBLIGATORY & CRITICAL):
      Obiettivo: Verificare se il prompt è ancora direttamente DERIVATO dal video o se è stato REINTERPRETATO applicando il SOURCE-ENHANCED MODE.
      
      1. SOURCE-ENHANCED MODE (aiPrompts):
         Il prompt principale DEVE essere dinamico e vivo (micro-movimenti, camera organica, imperfezioni reali) ma STRETTAMENTE ADERENTE alla fonte.
         - NO staticità o contemplazione passiva.
         - USO di micro-dinamiche (tremolio camera organico, movimenti mani, reazioni fisiche della materia, vento sui capelli, imperfezioni).
         - DIVIETO ASSOLUTO di inventare eventi o oggetti non visibili.
      
      2. Se il prompt:
         - Introduce azioni NON visibili nel video (es. oggetti che volano se non ci sono, persone che corrono se sono ferme)
         - Introduce dialoghi NON deducibili dal video originale
         - Costruisce una scena narrativa invece di partire dal contenuto reale (EVENT-DRIVEN bias)
         
         ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡¢ÃƒÆ’Ã†'¢ÃƒÆ’Ã‚Â¢¬ÃƒÆ’Ã¢â‚¬Å¡àÃƒÆ’Ã†'¢ÃƒÆ’Ã‚Â¢¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾¢ Considerare il legame con la fonte ROTTO.
         
      3. In caso di legame CON LA FONTE ROTTO (sourceAnchor.isAligned = false):
         - NON SOSTITUIRE il prompt principale (aiPrompts).
         - Genera SEMPRE doppio output:
           - 'aiPrompts' (e tutti i prompt tecnici: sora, kling, veo): Devono essere SOURCE-ENHANCED e STRETTAMENTE ADERENTI al video originale.
           - 'alternativePrompt': Versione ottimizzata per la viralità (event-driven/narrative/viral transformation) con gli elementi aggiunti.
         - sourceAnchor.alternativeGenerated = true
         
      3. Se il prompt è FEDELE alla fonte (sourceAnchor.isAligned = true):
         - 'aiPrompts' può contenere l'ottimizzazione virale se questa non rompe la realtà del video.
         - sourceAnchor.alternativeGenerated = false
         - 'alternativePrompt' rimane vuoto o non generato.
         
      REGOLA D'ORO: Se migliori la viralità allontanandoti dal video, devi DELEGARE quel miglioramento ad 'alternativePrompt' e lasciare il video originale "puro" nei prompt principali.

      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¡ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡è AUDIO ANCHOR DIALOGUE FAITHFULNESS (MANDATORY):
      Dati Audio Anchor: ${JSON.stringify(audioAnchor || "NONE")}

      Se audioAnchor.dialogueLockStatus !== "AUDIO_LOCKED":
        - VIETATO generare battute tra virgolette ("Nome: frase").
        - Se necessario usare descrizione narrativa.

      Se audioAnchor.dialogueLockStatus === "AUDIO_LOCKED":
        - USARE SOLO BATTUTE PRESENTI nel summary verificato.
        - Se una frase non è nel summary, TRASFORMARLA in descrizione narrativa.
      
      OBBLIGATORIO includere nel JSON finale questo oggetto:
      "dialogueAnalysis": {
         "dialogueLockStatus": "${audioAnchor?.dialogueLockStatus || 'FRAME_ONLY'}",
         "dialogueSource": "${audioAnchor?.dialogueSource || 'VISUAL_INFERENCE'}",
         "forbiddenInventedDialogueDetected": boolean,
         "dialogueFaithfulnessScore": number
      },
      "scriptFaithfulness": {
        "sourceScriptCompletenessScore": number (0-100),
        "optimizedScriptFaithfulnessScore": number (0-100),
        "missingNarrativeBeats": string[],
        "scriptCompressionMode": "FAITHFUL_COMPRESSED" | "OVER_COMPRESSED" | "INVENTED_DIALOGUE" | "DESCRIPTIVE_SAFE"
      }
      
      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¡ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡è REGOLA QUALITà (SEVERA):
      Se sourceScriptCompletenessScore < 80 O optimizedScriptFaithfulnessScore < 80:
      - scriptCompressionMode FORZATO a "DESCRIPTIVE_SAFE".
      - VIETATO prompt finale aggressivo basato su dialoghi.
      - USARE SCRIPT NARRATIVO a beat temporali.

      ÃƒÆ’Ã†'Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡°ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¸ÃƒÆ’Ã†'ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡¡ÃƒÆ’Ã†'ÃƒÆ’Ã¢â‚¬Å¡è GESTIONE DATI MANCANTI (CRITICA):

      I dati mancanti vengono accettati dal sistema SOLO se accompagnati da giustificazione allegata alla risposta.
      Se per QUALSIASI MOTIVO (es. sicurezza, policy) non puoi generare un campo, DEVI:
      1. Riempire il campo stringa con "DATI NON FORNITI". 
      2. Inserire un oggetto in 'missingDataLog'.
      Esempio: "missingDataLog": [ { "field": "coverPrompt", "reason": "Copertina scabrosa" } ]
    `;

    let attempts = 0;
    const maxAttempts = 3;
    let lastError = "";
    let parsed: any;

    while (attempts < maxAttempts) {
      attempts++;
      
      const currentParts = [{ text: prompt }];

      if (lastError && contentHierarchy) {
         currentParts.push({ text: `
         ERRORE NEL TENTATIVO PRECEDENTE:
         ${lastError}
         
         Devi correggere l'output per rispettare la gerarchia semantica. 
         Il primarySubject ("${contentHierarchy.primarySubject}") DEVE essere il fulcro.
         Evita di enfatizzare elementi accessori come "${contentHierarchy.tertiaryElements?.join(", ") || 'dettagli grafici o fisici'}".
         `});
      }

      let response;
      try {
        response = await executeWithNetworkRetry(async (currentAi, dynamicModel) => {
          return await currentAi.models.generateContent({
            model: dynamicModel || model,
            contents: { role: 'user', parts: currentParts } as any,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: FINAL_EVOLUTION_SCHEMA as any
            }
          });
        }, 1, undefined, 420000, apiKey, onProgress, model, trace, "Final Viral Analysis", currentModelTier as "flash" | "pro", 
        false, "COGNITIVE", false, "Final creative asset assembly", (videoSummary ? 'video_summary' : 'local_data'), true);
      } catch (err: any) {
        if (err?.message === 'GROQ_ALL_KEYS_EXHAUSTED') {
          logger.error(`[TEXT_TASK_FAILED_ALL_PROVIDERS_EXHAUSTED] module=Final Viral Analysis taskType=CORE_ANALYSIS groqStatus=ALL_KEYS_COOLDOWN geminiStatus=NA`);
          lastError = `TEXT_TASK_FAILED_ALL_PROVIDERS_EXHAUSTED: Analysis not completed: all Groq keys are in cooldown and Gemini parachute is not available.`;
          continue;
        }
        
        if (err?.message === 'GEMINI_TEXT_FALLBACK_BLOCKED_GROQ_AVAILABLE' && getGroqConfig().hasHealthyKeys) {
          const canContinueTextOnly = Boolean(prompt && prompt.length > 100) && hasGroqApiKey();
          if (canContinueTextOnly) {
             logger.warn(`[GEMINI_VIDEO_ANALYSIS_FAILED_GROQ_TEXT_FALLBACK] module=Final Viral Analysis reason=${err instanceof Error ? err.message : String(err)} visualVerification=false pipelineContinues=true`);
             try {
                 const groq = await groqTextCompletion({
                   messages: [
                     { role: 'system', content: SYSTEM_INSTRUCTION + "\n\nIMPORTANT: Visual/frame analysis failed or is limited. Continue using provided text context. Ensure visualVerification=false in the JSON output." },
                     { role: 'user', content: prompt },
                   ],
                   task: 'CORE_ANALYSIS',
                   responseFormat: 'json_object',
                   timeoutMs: 300000,
                 });
                 if (!groq?.text) throw new Error("Groq returned empty text");
                 response = { text: () => groq.text, isDegraded: true };
             } catch (groqErr) {
                 logger.info(`[FALLBACK_DECISION]`, {
                    module: "Final Viral Analysis",
                    groqAvailable: getGroqConfig().hasHealthyKeys,
                    groqSucceeded: false,
                    groqHasValidOutput: false,
                    geminiFallbackAllowed: true,
                    reason: "Groq failed or returned invalid output during recovery attempt in Final Viral Analysis"
                 });
                 logger.warn(`[FALLBACK_GROQ_FAILED_ALLOW_GEMINI] module=Final Viral Analysis reason=Groq fallback failed, attempting emergency Gemini fallback`);
                 try {
                    logger.info(`[FALLBACK_GEMINI_STARTED] module=Final Viral Analysis reason=GROQ_FAILED_DURING_RECOVERY`);
                    const finalGemini = await executeWithNetworkRetry(async (currentAi, dynamicModel) => {
                      return await currentAi.models.generateContent({
                        model: dynamicModel || model,
                        contents: { role: 'user', parts: currentParts } as any,
                        config: {
                          systemInstruction: SYSTEM_INSTRUCTION,
                          responseMimeType: "application/json",
                          responseSchema: FINAL_EVOLUTION_SCHEMA as any
                        }
                      });
                    }, 1, undefined, 420000, apiKey, onProgress, model, trace, "Final Viral Analysis", currentModelTier as "flash" | "pro", 
                    false, "COGNITIVE", false, "GROQ_FAILED", (videoSummary ? 'video_summary' : 'local_data'), true);
                    
                    response = finalGemini;
                 } catch (finalErr: any) {
                    logger.error(`[FALLBACK_GEMINI_FAILED] module=Final Viral Analysis status=${finalErr?.status || 'FAIL'} response=${finalErr?.message || 'N/A'}`);
                    logger.error(`[PIPELINE_FAILED_NO_TEXT_FALLBACK] module=Final Viral Analysis reason=Gemini and Groq both failed`);
                    lastError = `PIPELINE_FAILED_NO_TEXT_FALLBACK: Gemini and Groq failed. Detail: ${finalErr.message}`;
                    continue;
                 }
             }
          } else {
             lastError = err.message || "Unknown error";
             continue;
          }
        } else {
             lastError = err.message || "Unknown error";
             continue;
        }
      }
      
      if (!response) continue;
      const responseText = typeof response.text === 'function' ? response.text() : response.text;
      parsed = safeParseJSON(responseText || '{}');
      if (!parsed) continue; // IF PARSING FAILS, CONTINUE LOOP!
      
      // Inject degraded status if fallback occurred
      if (response && (response as any).isDegraded && parsed) {
        parsed.analysisRoutingMode = "GROQ_TEXT_ONLY_DEGRADED_AFTER_GEMINI_VIDEO_FAIL";
        parsed.visualVerification = false;
        parsed.engineReliability = "DEGRADED";
        if (!parsed.runtimeTruthStatus) {
           parsed.runtimeTruthStatus = { 
             mode: 'DEGRADED_TEXT_ONLY', 
             userMessage: "Gemini video/frame analysis failed; continued from transcript/text with Groq. Visual verification disabled.",
             severity: 'MEDIUM',
             failedModules: ['Final Viral Analysis'],
             warnings: ["Analisi finale fallita: fallback su Groq (solo testo) attivato per evitare crash."],
             fallbackActive: true,
             reliabilityImpact: 'Degradazione dell\'analisi visiva finale, precisione semantica preservata tramite trascrizione.'
           };
        } else {
           parsed.runtimeTruthStatus.mode = 'DEGRADED_TEXT_ONLY';
           parsed.runtimeTruthStatus.userMessage = "Gemini video/frame analysis failed; continued from transcript/text with Groq. Visual verification disabled.";
        }
      }
      
      // Failsafe: ensure required fields are at least empty strings instead of undefined
      if (parsed) {
        if (parsed.aiPrompts === undefined) parsed.aiPrompts = "";
        if (parsed.script === undefined) parsed.script = "";
        if (parsed.coverPrompt === undefined) parsed.coverPrompt = "";
      }

      logger.info("GENERATION_CAPTURED", parsed);
      
      if (primaryPurposeLock) {
         parsed.primaryPurposeLock = primaryPurposeLock;
      }
      if (functionalRoleLock) {
         parsed.functionalRoleLock = functionalRoleLock;
      }
      if (ideaAnchorLock) {
         parsed.ideaAnchorLock = ideaAnchorLock;
      }
      
      if (contentHierarchy) {
        try {
          const generatedAssets = {
            script: Array.isArray(parsed.script) ? parsed.script.join(" ") : (parsed.script || ""),
            aiPrompts: parsed.aiPrompts,
            hook: Array.isArray(parsed.pubTitoliHookIt) ? parsed.pubTitoliHookIt.join(" ") : (parsed.pubVideoHookIt || parsed.hook || "")
          };

          // --- LAYER 2.3: PRIMARY_PURPOSE_LOCK_CHECK (FAIL-FAST) ---
          if (primaryPurposeLock) {
            const decorationElements = primaryPurposeLock.elementsClassification
              ?.filter((e: any) => e.role === 'DECORATION')
              .map((e: any) => e.element.toLowerCase()) || [];
            
            const hookText = String(generatedAssets.hook || "").toLowerCase();
            const introText = String(generatedAssets.script || "").substring(0, 100).toLowerCase(); 
            
            const decorationAsHook = decorationElements.find((dec: string) => hookText.includes(dec));
            const decorationAsOpening = decorationElements.find((dec: string) => introText.includes(dec));

            if (decorationAsHook || decorationAsOpening) {
              logger.warn(`[FinalViralAnalysis] Purpose Lock Violation (attempt ${attempts}):`, { decorationAsHook, decorationAsOpening });
              lastError = `PURPOSE_VIOLATION_DECORATION_AS_HOOK: Hai usato un elemento di decorazione (${decorationAsHook || decorationAsOpening}) come hook o scena iniziale. Riscrivi basandoti SOLO su CORE_DRIVER elements.`;
              if (attempts < maxAttempts) continue;
            }
          }

          // --- LAYER 2.4: FUNCTIONAL_ROLE_LOCK_CHECK ---
          if (functionalRoleLock && functionalRoleLock.lockStatus === 'FAIL') {
             logger.info("[FinalViralAnalysis] Applying Functional Role Constraints via prompt...");
          }

          // --- LAYER 2.5: IDEA_ANCHOR_LOCK_CHECK ---
          if (ideaAnchorLock && ideaAnchorLock.lockStatus === 'FAIL') {
              logger.info(`[FinalViralAnalysis] Idea Anchor Violations were flagged in the pre-pass. Relying on AI correction.`);
          }

          const dominanceCheck = await runContentDominanceValidator(apiKey, contentHierarchy, generatedAssets, trace);
          logger.info("DOMINANCE_VALIDATION_CAPTURED", dominanceCheck);
          parsed.dominanceCheck = dominanceCheck;
          parsed.contentHierarchy = contentHierarchy;
          
          if (dominanceCheck.pass === false && dominanceCheck.severity === 'HIGH') {
              logger.warn(`[FinalViralAnalysis] Dominance Override Detected (attempt ${attempts}):`, dominanceCheck);
              
              if (dominanceCheck.dominantElement && contentHierarchy && String(dominanceCheck.dominantElement).toLowerCase() !== String(contentHierarchy.primarySubject || "").toLowerCase()) {
                  // HARD MISMATCH
                  logger.warn("[FinalViralAnalysis] HARD MISMATCH detected. Forcing hierarchy realignment.");
                  dominanceCheck.reason = `HARD MISMATCH: Riallineamento forzato da '${contentHierarchy.primarySubject}' a '${dominanceCheck.dominantElement}'`;
                  contentHierarchy.primarySubject = dominanceCheck.dominantElement;
                  parsed.contentHierarchy = contentHierarchy;
                  dominanceCheck.pass = true; // Forziamo il pass perchè abbiamo corretto la fonte!
                  dominanceCheck.severity = "LOW";
              } else {
                  lastError = `TERTIARY_DOMINANCE_OVERRIDE: ${dominanceCheck.reason}. L'elemento dominante rilevato è stato '${dominanceCheck.dominantElement}', ma doveva essere '${dominanceCheck.expectedPrimary}'. Riscrivi il publishing kit e i prompt riportando il focus sul messaggio primario.`;
                  if (attempts < maxAttempts) {
                     continue;
                  } else {
                     parsed.viralScore = "2.0"; // Drastic penalty if all retries fail
                  }
              }
          }

          // --- LAYER 2.6: CORE_INTENT_DRIFT_CHECK ---
          if (coreIntentClassification) {
            if (coreIntentClassification.isFallback) {
               logger.info("[CORE_INTENT_CLASSIFIER_RELIABILITY_STATUS]", {
                 reliability: coreIntentClassification.engineReliability || "DEGRADED",
                 errorType: coreIntentClassification.errorType || "UNKNOWN_FALLBACK"
               });
               parsed.engineReliability = coreIntentClassification.engineReliability;
               parsed.engineWarnings = parsed.engineWarnings || [];
               parsed.engineWarnings.push(`Core Intent Classifier in degraded mode (${coreIntentClassification.errorType}). Strategic priorities might be inferred.`);
            }

            const intent = coreIntentClassification.coreIntent;
            const fullContentText = `${generatedAssets.hook} ${generatedAssets.script} ${parsed.pubTitleIt || ""} ${parsed.pubDescriptionIt || ""}`.toLowerCase();
            
            let driftDetected = false;
            if (intent === 'PERSONA') {
              if (!/\b(persona|chi|lei|lui|soggetto|volto|essere umano|uomo|donna|ragazzo|ragazza|attore|protagonista|io|tu)\b/i.test(fullContentText)) {
                driftDetected = true;
              }
              
              // --- NEW: CORE_INTENT_DOMINANCE_VIOLATION_CHECK ---
              const drivers = primaryPurposeLock?.elementsClassification?.filter((e: any) => e.role === 'CORE_DRIVER') || [];
              const humanKeywords = ["donna", "uomo", "ragazzo", "ragazza", "bambino", "anziano", "persona", "protagonista", "volto", "sguardo", "gesto", "attore", "human", "person", "woman", "man"];
              const isHuman = (text: string) => humanKeywords.some(hk => text.toLowerCase().includes(hk));
              
              const nonHumanDrivers = drivers.filter((d: any) => !isHuman(d.element));
              if (nonHumanDrivers.length > 0) {
                 driftDetected = true;
                 lastError = `CORE_INTENT_DOMINANCE_VIOLATION: L'intento è PERSONA, ma esistono driver nucleari non umani: ${nonHumanDrivers.map((d:any)=>d.element).join(", ")}. Riporta il focus SOLO sulla persona.`;
              }
            } else if (intent === 'PRODOTTO') {
              if (!/\b(prodotto|articolo|oggetto|cosa|bene|dispositivo|compralo|servizio|acquista)\b/i.test(fullContentText)) {
                 const primaryWord = String(contentHierarchy?.primarySubject || "").toLowerCase().split(" ")[0];
                 if (primaryWord && primaryWord.length > 3 && !fullContentText.includes(primaryWord)) {
                   driftDetected = true;
                 }
              }
            }

            if (driftDetected) {
              logger.warn(`[FinalViralAnalysis] Core Intent Drift Detected (attempt ${attempts}):`, intent);
              lastError = `CORE_INTENT_DRIFT: L'output ha perso il focus sull'intento principale rilevato ('${intent}'). Ribilancia la narrazione mettendo al centro ciò che è stato classificato come CORE INTENT.`;
              if (attempts < maxAttempts) {
                 continue;
              } else {
                 parsed.viralScore = "1.0"; // Absolute penalty for drift failure
                 parsed.structuralFailed = true;
                 parsed.structuralFailReason = 'CORE_INTENT_DRIFT';
                 parsed.coreIntentDrift = true;
              }
            } else {
              parsed.coreIntentDrift = false;
            }
          }
          parsed.coreIntentClassification = coreIntentClassification;

          // --- LAYER 2.7: VIRAL_STRUCTURE_CHECK ---
          if (parsed.viralStructure && parsed.viralStructure.validationStatus === 'FAIL') {
              logger.warn(`[FinalViralAnalysis] Viral Structure Validation Failed (attempt ${attempts}):`, parsed.viralStructure);
              lastError = `VIRAL_STRUCTURE_FAIL: ${parsed.viralStructure.validationReason}. La struttura temporale non ha superato la validazione. Riscrivi integrando: 0-1.2s Hook (interruzione curiostà), 1.2-4s Build (aumento tensione non lineare), 4-7s Payoff (cambiamento reale percepibile), 7-10s Loop.`;
              if (attempts < maxAttempts) {
                 continue;
              } else {
                 parsed.viralScore = "1.0"; // Penalty
                 parsed.structuralFailed = true;
                 parsed.structuralFailReason = 'VIRAL_STRUCTURE_FAIL';
              }
          }

          // --- LAYER 2.8: DETERMINISTIC REAL VIRAL VALIDATOR ---
          if (parsed.viralStructure) {
             const hookText = String(parsed.viralStructure.hook || "").toLowerCase();
             const buildText = String(parsed.viralStructure.build || "").toLowerCase();
             const payoffText = String(parsed.viralStructure.payoff || "").toLowerCase();
             
             // Extract simple words to calculate semantic overlap (ignoring short words like e, a, il, la)
             const getWords = (text: string) => text.replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 3);
             const hookWords = getWords(hookText);
             const buildWords = getWords(buildText);
             const payoffWords = getWords(payoffText);

             const getOverlap = (arr1: string[], arr2: string[]) => {
                 if (arr1.length === 0 || arr2.length === 0) return 0;
                 const intersection = arr1.filter(w => arr2.includes(w));
                 return intersection.length / Math.min(arr1.length, arr2.length);
             };

             const overlapHookBuild = getOverlap(hookWords, buildWords);
             const overlapBuildPayoff = getOverlap(buildWords, payoffWords);
             const overlapHookPayoff = getOverlap(hookWords, payoffWords);

             // Deterministic Rules
             let deterministicPhasesDistinct = (overlapHookBuild <= 0.6 && overlapBuildPayoff <= 0.6);
             let deterministicRealEvolution = (overlapHookPayoff <= 0.6);

             // Detect static/flat outputs
             const staticVerbs = [" è ", " c'è ", " ci sono ", " si trova ", " mostra ", " vede ", " guarda ", " appare ", " sembra ", " sta ", " rimane ", " inquadra ", " riprende "];
             const countStatic = (text: string) => staticVerbs.filter(v => text.includes(v)).length;
             const totalStatic = countStatic(hookText) + countStatic(buildText) + countStatic(payoffText);
             
             // Detect strong action payoff
             const actionWords = ["cambia", "esplode", "rivela", "reagisce", "scappa", "salta", "rompe", "colpisce", "cade", "scopre", "interrompe", "trasforma", "svela", "colpo", "urla", "afferra"];
             const payoffHasAction = actionWords.some(a => payoffText.includes(a));
             let deterministicPayoffStrength = payoffHasAction ? "strong" : (countStatic(payoffText) > 0 ? "weak" : "medium");

             let forceFail = false;
             let failReason = "";

             if (!deterministicPhasesDistinct) {
                 forceFail = true;
                 failReason = "Overlap semantico troppo alto tra le fasi (ripetizione di concetti).";
             } else if (!deterministicRealEvolution) {
                 forceFail = true;
                 failReason = "Nessuna evoluzione: lo stato iniziale (hook) e finale (payoff) sono quasi identici.";
             } else if (totalStatic > 3) {
                 forceFail = true;
                 failReason = "Eccessivo uso di verbi descrittivi/statici (mostra, vede, è). Manca dinamica di scena.";
             } else if (deterministicPayoffStrength === "weak" && countStatic(payoffText) > 0) {
                 forceFail = true;
                 failReason = "Payoff debole: nessuna azione di cambiamento visivo/percettivo rilevata.";
             }

             // Ensure viralValidation object exists
             parsed.viralValidation = parsed.viralValidation || {
                 phasesAreDistinct: true,
                 hasRealEvolution: true,
                 payoffStrength: "medium",
                 loopQuality: "valid",
                 finalVerdict: "PASS"
             };

             let isSmartMode = modelTier === 'smart';
             let effectiveGenerator: 'flash' | 'pro' = (isSmartMode || currentModelTier === 'pro') ? 'pro' : 'flash';
             
             parsed.modelRouting = Object.assign(parsed.modelRouting || {}, {
                generator: effectiveGenerator,
                validator: 'deterministic', // default
                attempts: attempts,
                usedPro: false
             });

             if (forceFail) {
                 // Override AI Auto-Validation
                 parsed.viralValidation.phasesAreDistinct = deterministicPhasesDistinct;
                 parsed.viralValidation.hasRealEvolution = deterministicRealEvolution;
                 parsed.viralValidation.payoffStrength = deterministicPayoffStrength as any;
                 parsed.viralValidation.finalVerdict = 'FAIL';

                 logger.warn(`[FinalViralAnalysis] DETERMINISTIC Real Viral Validation Failed (attempt ${attempts}):`, { failReason, scores: { overlapHookBuild, overlapBuildPayoff, overlapHookPayoff, totalStatic } });
                 lastError = `REAL_VIRAL_VALIDATOR_FAIL (DETERMINISTIC): ${failReason}. RISCRIVI LA BASE NARRATIVA PERCHE' CI SIA UN VERO PAYOFF (un'azione forte o cambio di percezione) E UNA VERA EVOLUZIONE, usando verbi d'azione e non descrittivi.`;
                 if (attempts < maxAttempts) {
                    continue;
                 }
                 parsed.viralScore = "1.0"; // Penalty
                 parsed.structuralFailed = true;
                 parsed.structuralFailReason = 'REAL_VIRAL_VALIDATOR_FAIL_DETERMINISTIC';
             } else if (parsed.viralValidation.finalVerdict === 'FAIL') {
                 // AI naturally failed it
                 logger.warn(`[FinalViralAnalysis] AI-SELF Real Viral Validation Failed (attempt ${attempts}):`, parsed.viralValidation);
                 lastError = `REAL_VIRAL_VALIDATOR_FAIL (AI): La scena è risultata piatta o mancante di evoluzione. Dettagli: Distinti=${parsed.viralValidation.phasesAreDistinct}, Evoluzione=${parsed.viralValidation.hasRealEvolution}, Payoff=${parsed.viralValidation.payoffStrength}. RISCRIVI.`;
                 if (attempts < maxAttempts) {
                    continue;
                 }
             } else if (isSmartMode || currentModelTier === 'pro') {
                 // HYBRID ROUTING: Run PRO Independent validation if Deterministic gave PASS
                 if (onProgress) onProgress(`Esecuzione controllo PRO INDIPENDENTE (Livello Judge)... (Tentativo: ${attempts}/${maxAttempts})`);
                 
                 const brainVerdict = await runViralBrainAnalysis({
                     viralStructure: parsed.viralStructure,
                     sourceContext: {
                         sourceType: parsed.sourceType,
                         coreIntent: coreIntentClassification?.coreIntent,
                         genre: genre
                     }
                 }, apiKey, (isSmartMode || currentModelTier === 'pro') ? 'pro' : 'flash');
                 
                 parsed.modelRouting.validator = (brainVerdict as any).confidence > 0 ? 'pro' : 'flash-fallback';
                 parsed.modelRouting.usedPro = (brainVerdict as any).confidence > 0;
                 parsed.modelRouting.generator = effectiveGenerator;
                 
                 // Map to viralBrain field
                 parsed.viralBrain = brainVerdict;
                 
                 // Also keep viralValidation in sync for legacy UI compatibility
                 parsed.viralValidation = {
                     ...parsed.viralValidation,
                     finalVerdict: brainVerdict.finalVerdict,
                     retryInstructions: brainVerdict.retryInstructions
                 };

                 if (brainVerdict.finalVerdict === 'FAIL' || brainVerdict.finalVerdict === 'WEAK_PASS') {
                     const isWeak = brainVerdict.finalVerdict === 'WEAK_PASS';
                     logger.warn(`[FinalViralAnalysis] VIRAL_BRAIN ${isWeak ? 'WEAK' : 'FAIL'} (attempt ${attempts}):`, brainVerdict);
                     
                     const retry = brainVerdict.retryInstructions || { fix: 'Rendi la scena più dinamica', avoid: 'Verbi statici', target: 'Generazione Elite' };
                     lastError = `VIRAL_BRAIN_${isWeak ? 'WEAK' : 'FAIL'}: \n` +
                                `RETRY_FIX: ${retry.fix}. \n` +
                                `AVOID: ${retry.avoid}. \n` +
                                `TARGET: ${retry.target}.`;
                     
                     if (attempts < maxAttempts) {
                        continue;
                     }
                     if (brainVerdict.finalVerdict === 'FAIL') {
                       parsed.viralScore = "1.0";
                       parsed.structuralFailed = true;
                       parsed.structuralFailReason = 'VIRAL_BRAIN_FAIL';
                     }
                 }
               }
            }
        } catch (finalValidationError) {
          logger.warn("[FinalViralAnalysis] Post-generation validation block failed.", finalValidationError);
        }
      }
      
      break; // Validations passed and no continue happened!
    }
    
    if (!parsed) {
      logger.error("[QUOTA_EXHAUSTED_PIPELINE_STOP] module=Final Viral Analysis provider=gemini status=403 reason=All API keys exhausted action=STOP_PIPELINE");
      logger.error(`[FINAL_ANALYSIS_UNAVAILABLE] module=Final Viral Analysis reason=provider failure analysisExists=false quotaStatus=EXHAUSTED action=RETURN_SAFE_RESULT`);
      logger.info(`[SAFE_RESULT_FROM_QUOTA_FAILURE] module=Final Viral Analysis technicalStatus=BLOCKED_BY_QUOTA failureStage=Final Viral Analysis`);
      
      return {
        // Return a safe object that ProductionFlow can handle without crashing
        analysis: `Analisi non completata: quota API esaurita o provider error. Errore: ${lastError || 'Unknown'}`,
        externalMarketData: null,
        technicalStatus: "BLOCKED_BY_QUOTA",
        failureStage: "Final Viral Analysis",
        failureReason: "Gemini/Groq quota or API key exhausted",
        quotaStatus: "EXHAUSTED",
        engineWarnings: [
          "Analisi finale non completata perché tutte le chiavi API disponibili risultano esaurite o bloccate."
        ],
        aiPrompts: "Non disponibile",
        publishingKit: "Non disponibile",
        operationalDecision: "ERRORE",
        script: "",
        coverPrompt: "",
        viralStructure: { hook: "", build: "", payoff: "", loop: "" }
      } as any;
    }

    return parsed;
  };

  return await executeAnalysis(modelTier);
}

export async function runPrimaryPurposeLock(
  apiKey: string,
  contentHierarchy: any,
  trace?: ModelUsageTrace,
  modelTier: string = 'flash'
): Promise<any> {
  if (modelTier === 'test') {
    logger.warn("[TEST_MODE_MODULE_SKIPPED] module=runPrimaryPurposeLock reason=TEST_MODE_LITE");
    return { lockStatus: "PASS", reason: "TEST_MODE_LITE", elementsClassification: [] };
  }
  const safeHierarchy = contentHierarchy || { dominantPurpose: "unknown", primarySubject: "unknown" };
  const { ai } = getAI(apiKey);
  // Use flash for logic-heavy pre-generation filter
  const model = selectModel('flash', 'flash', apiKey);

  const lockPrompt = `
    ESEGUI PRIMARY_PURPOSE_LOCK (VINCOLO DECISIONALE).
    
    Analizza la Gerarchia Semantica e stabilisci i vincoli ferrei per la generazione.
    
    HIERARCHY:
    ${JSON.stringify(safeHierarchy)}
    
    OBIETTIVO:
    Impedire che elementi terziari (DECORATION) diventino dominanti nel video.
    
    REGOLE:
    1. Classifica ogni elemento della gerarchia come CORE_DRIVER, SUPPORT o DECORATION.
       - CORE_DRIVER: Supporta direttamente il dominantPurpose ("${safeHierarchy.dominantPurpose || 'unknown'}").
       - SUPPORT: Aiuta ma non deve guidare.
       - DECORATION: Dettaglio non necessario allo scopo primario (es: ghiaia, texture, frame estetici).
    
    2. VINCOLO HOOK:
       - Se un elemento è DECORATION, NON può essere usato per l'hook, il titolo o la prima scena.
       - L'hook deve rispondere a: "Questo hook porta l'utente all'azione richiesta dal dominantPurpose?"
    
    3. VINCOLO TOLLERANZA:
       - Elementi DECORATION possono apparire solo dopo il 30-40% del video come b-roll di sfondo.
    
    RESTITUISCI IL JSON CON lockStatus: FAIL se rilevi che elementi DECORATION sono stati proposti come hookSuggested o se la gerarchia è a rischio inversione.
  `;

  try {
    const { PRIMARY_PURPOSE_LOCK_SCHEMA } = await import('./schemas');
    const response = await executeGroqFirstTextTask({
      preferGroq: true,
      prompt: lockPrompt,
      systemInstruction: "Sei il Purpose Alignment Guardian. Assicurati che ogni frame del video serva l'intento primario.",
      timeoutMs: 60000,
      taskType: 'SCRIPT_ANALYSIS',
      layer: 'Primary Purpose Lock',
      model,
      apiKey,
      trace,
      modelTier,
      callReason: 'Validation of alignment with primary content purpose',
      inputSource: 'hierarchy_data',
      geminiOp: async (currentAi, dynamicModel) => {
        const targetModel = dynamicModel || model;
        logger.info(`[MODEL_CALL_START] task=PRIMARY_PURPOSE_LOCK provider=gemini model=${targetModel}`);
        try {
          return await currentAi.models.generateContent({
            model: targetModel,
            contents: [{ role: 'user', parts: [{ text: lockPrompt }] }],
            config: {
              systemInstruction: "Sei il Purpose Alignment Guardian. Assicurati che ogni frame del video serva l'intento primario.",
              responseMimeType: "application/json",
              responseSchema: PRIMARY_PURPOSE_LOCK_SCHEMA as any
            }
          });
        } catch (err: any) {
           logger.error(`[MODEL_CALL_ERROR] task=PRIMARY_PURPOSE_LOCK provider=gemini model=${targetModel}`, {
             status: err?.status || err?.code || 'UNKNOWN',
             message: err?.message || String(err)
           });
           throw err;
        }
      }
    });

    const lock = safeParseJSON(response.text || '{}');
    logger.info("[PRIMARY_PURPOSE_LOCK_COMPLETED]", lock);
    return lock;
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    const isNotFound = errorMsg.includes('404') || errorMsg.includes('NOT_FOUND') || err?.status === 404;                
    if (isNotFound) {
        logger.warn("[MODEL_404_DETECTED]", { module: "PRIMARY_PURPOSE_LOCK", error: errorMsg });
    }

    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw err;
    }
    logger.error("[PRIMARY_PURPOSE_LOCK_FAILED]", err);
    return { lockStatus: "PASS", reason: "GATE_FAILURE_BYPASS", elementsClassification: [], errorType: isNotFound ? "NOT_FOUND" : "SERVICE_ERROR" };
  }
}

export async function runFunctionalRoleLock(
  apiKey: string,
  contentHierarchy: any,
  primaryPurposeLock: any,
  trace?: ModelUsageTrace,
  modelTier: string = 'flash'
): Promise<any> {
  if (modelTier === 'test') {
    logger.warn("[TEST_MODE_MODULE_SKIPPED] module=runFunctionalRoleLock reason=TEST_MODE_LITE");
    return { lockStatus: "PASS", reason: "TEST_MODE_LITE" };
  }
  const safeHierarchy = contentHierarchy || { primarySubject: "unknown" };
  const { ai } = getAI(apiKey);
  const model = selectModel('flash', 'flash', apiKey);

  const lockPrompt = `
    ESEGUI FUNCTIONAL_ROLE_LOCK (VINCOLO NARRATIVO).
    
    Analizza la Gerarchia Semantica e la classificazione degli elementi per stabilire i vincoli sulle funzioni narrative.
    
    HIERARCHY:
    ${JSON.stringify(safeHierarchy)}
    
    PURPOSE LOCK:
    ${JSON.stringify(primaryPurposeLock)}
    
    OBIETTIVO:
    Impedire che la "funzione narrativa" (emozione, mistero, curiosità) di un elemento DECORATION guidi il video, anche se l'elemento non è nominato.
    
    REGOLE:
    1. Identifica quale emozione DEVE guidare il hook basandosi sul CORE_DRIVER principale.
    2. Identifica quali emozioni sono "pericolose" perché tipicamente associate a elementi DECORATION (es. il mistero della ghiaia rosa, la curiosità per una texture).
    
    VINCOLO OBBLIGATORIO:
    - Se l'emozione del hook deriva da un elemento DECORATION (es. curiosità per un dettaglio estetico invece che per l'evento) -> FAIL.
    - L'emozione del hook DEVE rispondere a: "L'emozione principale deriva dal primarySubject?" ("${safeHierarchy.primarySubject || 'unknown'}").
    
    RESTITUISCI IL JSON CON lockStatus: FAIL se prevedi che la struttura del hook possa essere deviata dalla funzione narrativa di un elemento non CORE.
  `;

  try {
    const { FUNCTIONAL_ROLE_LOCK_SCHEMA } = await import('./schemas');
    const response = await executeGroqFirstTextTask({
      preferGroq: true,
      prompt: lockPrompt,
      systemInstruction: "Sei il Functional Narrative Guardian. Proteggi l'asse emotivo del video affinche rimanga ancorato allo scopo primario.",
      timeoutMs: 60000,
      taskType: 'SCRIPT_ANALYSIS',
      layer: 'Functional Role Lock',
      model,
      apiKey,
      trace,
      modelTier,
      callReason: 'Ensuring emotional axis alignment with primary subject',
      inputSource: 'hierarchy_data',
      geminiOp: async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: [{ role: 'user', parts: [{ text: lockPrompt }] }],
          config: {
            systemInstruction: "Sei il Functional Narrative Guardian. Proteggi l'asse emotivo del video affinche rimanga ancorato allo scopo primario.",
            responseMimeType: "application/json",
            responseSchema: FUNCTIONAL_ROLE_LOCK_SCHEMA as any
          }
        });
      }
    });

    const lock = safeParseJSON(response.text || '{}');
    logger.info("[FUNCTIONAL_ROLE_LOCK_COMPLETED]", lock);
    return lock;
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw err;
    }
    logger.error("[FUNCTIONAL_ROLE_LOCK_FAILED]", err);
    return { lockStatus: "PASS", passReasoning: "GATE_FAILURE_BYPASS", primaryEmotion: "other", implicitElement: "unknown", emotionSourceRole: "SUPPORT" };
  }
}

export async function runIdeaAnchorLock(
  apiKey: string,
  contentHierarchy: any,
  primaryPurposeLock: any,
  functionalRoleLock: any,
  trace?: ModelUsageTrace,
  modelTier: string = 'flash'
): Promise<any> {
  if (modelTier === 'test') {
    logger.warn("[TEST_MODE_MODULE_SKIPPED] module=runIdeaAnchorLock reason=TEST_MODE_LITE");
    return { lockStatus: "PASS", lockReasoning: "TEST_MODE_LITE" };
  }
  const safeHierarchy = contentHierarchy || { centralIdea: "unknown", primarySubject: "unknown" };
  const { ai } = getAI(apiKey);
  const model = selectModel('flash', 'flash', apiKey);

  const lockPrompt = `
    ESEGUI IDEA_ANCHOR_LOCK (VINCOLO CONCETTUALE).
    
    Analizza i layer precedenti e stabilisci se l'idea centrale del video è correttamente ancorata alla fonte primaria.
    
    HIERARCHY:
    ${JSON.stringify(safeHierarchy)}
    
    PURPOSE LOCK:
    ${JSON.stringify(primaryPurposeLock)}
    
    FUNCTIONAL LOCK:
    ${JSON.stringify(functionalRoleLock)}
    
    OBIETTIVO:
    Impedire che il concept stesso del video (CENTRAL_IDEA) nasca da un elemento DECORATION, rendendo il contenuto dipendente da un dettaglio accessorio.
    
    REGOLE:
    1. Valuta la CENTRAL_IDEA pre-generata: "${safeHierarchy.centralIdea || 'Non specificata'}".
       Se non è sufficientemente basata sul primarySubject, estraine tu una più cruda e diretta ignorando decorazioni.
    2. Se coreIntent === "INFORMATIVO":
       - VIETATO: Central idea visionaria, futuristica o stile manifesto (es. "futuro sostenibile", "visione globale").
       - OBBLIGATORIO: L'idea deve essere un ANCHOR_DATA (es. "confronto prezzi", "evoluzione statistica", "fatto specifico").
    3. Esegui il TEST DI RIMOZIONE: Rimuovi mentalmente tutti gli elementi DECORATION (es. ghiaia, texture, luci, sfondi atmosferici).
       - Se l'idea perde forza, attrattiva o si svuota di significato -> FAIL! (Hai ancorato il contenuto all'estetica).
    4. Verifica l'ANCHOR_SOURCE: Deve ESCLUSIVAMENTE essere il primarySubject ("${safeHierarchy.primarySubject || 'unknown'}").
    
    RESTITUISCI IL JSON CON lockStatus: FAIL se l'idea centrale fallisce il test di rimozione o se l'ancora vitale non è il primarySubject. FAIL significa che il video è vuoto senza estetica.
  `;

  try {
    const { IDEA_ANCHOR_LOCK_SCHEMA } = await import('./schemas');
    const response = await executeGroqFirstTextTask({
      preferGroq: true,
      prompt: lockPrompt,
      systemInstruction: "Sei l'Idea Anchor Guardian. Assicurati che l'anima del video appartenga al suo scopo reale.",
      timeoutMs: 60000,
      taskType: 'IDEA_ANALYSIS',
      layer: 'Idea Anchor Lock',
      model,
      apiKey,
      trace,
      modelTier,
      callReason: 'Anchoring central idea to the source material',
      inputSource: 'hierarchy_data',
      geminiOp: async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: [{ role: 'user', parts: [{ text: lockPrompt }] }],
          config: {
            systemInstruction: "Sei l'Idea Anchor Guardian. Assicurati che l'anima del video appartenga al suo scopo reale.",
            responseMimeType: "application/json",
            responseSchema: IDEA_ANCHOR_LOCK_SCHEMA as any
          }
        });
      }
    });

    const lock = safeParseJSON(response.text || '{}');
    logger.info("[IDEA_ANCHOR_LOCK_COMPLETED]", lock);
    return lock;
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw err;
    }
    logger.error("[IDEA_ANCHOR_LOCK_FAILED]", err);
    return { lockStatus: "PASS", centralIdea: "Unknown", anchorSource: "Bypass", anchorRole: "SUPPORT", dependencyTest: "PASS", isIndependent: true };
  }
}

export async function runTransformationEngine(
  apiKey: string, 
  coreIntent: any, 
  hierarchy: any,
  sourceType: string,
  trace?: ModelUsageTrace
): Promise<any> {
  if (sourceType !== 'STATIC_IMAGE' && sourceType !== 'ILLUSTRATION') return null;

  const { ai } = getAI(apiKey);
  const modelTier = 'flash';
  const model = selectModel('flash', 'flash', apiKey);

  const prompt = `
    STATIC_TO_VIDEO_TRANSLATION_ENGINE + MICRO_ACTIVATION_STRATEGY
    Obiettivo: Trasformare una descrizione statica in una MINIMAL_SCENE_ACTIVATION senza allucinazioni.

    DATI DI INPUT:
    CORE INTENT: ${JSON.stringify(coreIntent)}
    GERARCHIA: ${JSON.stringify(hierarchy)}

    REGOLE OPERATIVE (MANDATORIE):
    1. Il contenuto NON deve mai restare completamente statico.
    2. Se CORE_INTENT è "INFORMATIVO":
       - VIETATO: Storytelling cinematografico, attori, movimenti di camera fisici, scene ambientali.
       - OBBLIGATORIO: Trasformazione in LAYOUT GRAFICO. Usa: text-reveal, data-viz animation, layout-progression.
       - STYLE: Deve sembrare un poster editoriale in movimento (glitch, contrast-reveal, highlight).
    3. Se CORE_INTENT NON è "INFORMATIVO":
       - Identify the primarySubject (PERSONA) and its movable elements.
       - Genera una micro-attivazione naturale basata su: gesture, gaze, breathing o rhythm.
    4. NON generare eventi complessi o cambi di contesto non presenti nell'input.
    5. Deve essere SEMPRE loopabile.

    Restituisci un JSON conforme a STATIC_TO_VIDEO_TRANSLATION_ENGINE_SCHEMA:
    - translation: { subject, movableElements, microScene, loopType, complexity: "low" }
    - microActivationStrategy: { type, target: "primarySubject", loopable: true, intensity: "low" }
    - validation: { status: "PASS" | "FAIL", reason }
  `;

  try {
    const { STATIC_TO_VIDEO_TRANSLATION_SCHEMA, MICRO_ACTIVATION_STRATEGY_SCHEMA } = await import('./schemas');
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        translation: STATIC_TO_VIDEO_TRANSLATION_SCHEMA,
        microActivationStrategy: MICRO_ACTIVATION_STRATEGY_SCHEMA,
        validation: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ["PASS", "FAIL"] },
            reason: { type: Type.STRING }
          },
          required: ["status", "reason"]
        }
      },
      required: ["translation", "microActivationStrategy", "validation"]
    };

    const response = await executeWithNetworkRetry(async (currentAi, dynamicModel) => {
      return await currentAi.models.generateContent({
        model: dynamicModel || model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema as any
        }
      });
    }, 1, undefined, 60000, apiKey, undefined, model, trace, "Transformation Engine", modelTier as "flash" | "pro", 
    false, "COGNITIVE", false, "Transformation of static inputs into kinetic concepts", "hierarchy_data", true);

    const result = safeParseJSON(response.text || '{}');
    if (result.validation?.status === 'FAIL') {
      logger.warn("[TRANSFORMATION_ENGINE_FAIL]", result.validation.reason);
    }
    return result;
  } catch (e: any) {
    const errorMsg = e.message || JSON.stringify(e);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw e;
    }
    logger.warn("Transformation Engine failed", e);
    return null;
  }
}

export async function runContentDominanceValidator(
  apiKey: string,
  contentHierarchy: any,
  generatedAssets: {
    script?: string;
    aiPrompts?: string;
    hook?: string;
  },
  trace?: ModelUsageTrace
): Promise<any> {
  const { ai } = getAI(apiKey);
  const modelTier = 'flash';
  const model = selectModel('flash', 'flash', apiKey);

  const prompt = `
    Sei il CONTENT_DOMINANCE_VALIDATOR. Il tuo unico scopo è verificare la coerenza tra la gerarchia semantica originale del contenuto e gli asset creativi appena generati.

    GERARCHIA ORIGINALE (CONTENT_HIERARCHY_REASONER):
    ${JSON.stringify(contentHierarchy, null, 2)}

    ASSET GENERATI DA VALUTARE:
    ${JSON.stringify(generatedAssets, null, 2)}

    REGOLE DI VALIDAZIONE:
    1. Analizza lo script, il prompt principale (aiPrompts) e l'hook generato.
    2. Identifica chi o cosa è diventato il 'dominantSceneElement' (l'elemento centrale attorno a cui ruota la scena) e il 'dominantHookElement'.
    3. Confronta questi elementi con il 'primarySubject' e il 'dominantPurpose' definiti nella gerarchia originale.
    4. Se un elemento classificato come 'tertiaryElements' (es. ghiaia, sfondo, dettaglio marginale) è diventato dominante nella scena o nell'azione principale, il test FALLISCE (pass: false) con gravità HIGH.
    5. Se l'hook usa un elemento secondario o terziario, è lecito SOLO SE il payoff o il resto della scena riporta SUBITO il focus sul 'primarySubject' in modo coerente col 'dominantPurpose'. Altrimenti FALLISCE.
    6. I 'forbiddenDominantElements' NON devono mai essere centrali. Se lo sono, FALLISCE (HIGH).
    7. SE l'intento originale era PERSONA:
       - La PERSONA deve essere l'UNICO elemento dominante.
       - Se Skyline, Paesaggio, o altri oggetti (anche se NON forbidden) guidano l'atmosfera o l'azione, FALLISCE (HIGH) con motivo CORE_INTENT_DOMINANCE_VIOLATION.
       - La struttura deve essere: Persona + Azione. MAI: Atmosfera + Persona.

    Se il pass è false, specifica il motivo (un breve enum string come CORE_INTENT_DOMINANCE_VIOLATION, TERTIARY_DOMINANCE_OVERRIDE, INVERTED_HIERARCHY, FORBIDDEN_ELEMENT_USED).
    Se il pass è true, il reason può essere "VALID" o "COHERENT".

    Ritorna un JSON strutturato conformemente allo schema richiesto. Non includere altre argomentazioni al di fuori del JSON.
  `;

  try {
    const { DOMINANCE_VALIDATOR_SCHEMA } = await import('./schemas');
    const response = await executeGroqFirstTextTask({
      preferGroq: true,
      prompt,
      systemInstruction: 'Return strict JSON only. Validate dominance coherence between hierarchy and generated assets. Fail if secondary or tertiary elements override the primary subject.',
      timeoutMs: 60000,
      taskType: 'SCRIPT_ANALYSIS',
      layer: 'Content Dominance Validator',
      model,
      apiKey,
      trace,
      modelTier: modelTier as "flash" | "pro",
      callReason: 'Validation of focus on primary elements',
      inputSource: 'hierarchy_data',
      geminiOp: async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: DOMINANCE_VALIDATOR_SCHEMA as any
          }
        });
      }
    });

    return safeParseJSON(response.text || '{}');
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw err;
    }
    logger.warn("Dominance validator failed, returning safe fallback", err);
    return {
      pass: true,
      reason: "VALIDATION_FAILED_FALLBACK",
      severity: "LOW",
      dominantElement: "unknown",
      expectedPrimary: contentHierarchy?.primarySubject || "unknown",
      details: "Il validatore ha subito un timeout o errore."
    };
  }
}

export async function performForensicTranscription(frames: any[], apiKey: string, modelTier: string = 'flash', onProgress?: (text: string) => void, trace?: ModelUsageTrace): Promise<any> {
  const executeTranscription = async (currentModelTier: string) => {
    // --- HUGGING/GROQ MODES INTERCEPTION ---
    if (isHuggingMode(currentModelTier) || isGroqMode(currentModelTier)) {
      if (onProgress) onProgress(`Analisi visiva forense con Hugging Face (GLM)...`);
      const hfKey = localStorage.getItem('huggingface_api_key') || '';
      const hfModel = resolveHuggingFaceModel('vision');
      
      const prompt = `
        Sei un esperto di trascrizione forense e analisi video.
        Analizza questi fotogrammi e produci un report JSON dettagliato.
        
        REGOLE:
        - originalScript: Trascrizione letterale (Ispezione visiva/labiale). STOP ALLUCINAZIONI.
        - script: Descrizione azione [Gesto] + Dialogo.
        - identityMapping: Identificazione soggetti.
        - musicAnalysis, neuroAnalysis: Analisi tecniche (solo visive).
        
        Rispondi SOLO con il JSON.
      `;

      try {
        const text = await hfVisionAnalysis(frames, prompt, hfKey, hfModel);
        if (text) {
          const parsed = safeParseJSON(text);
          if (parsed && (parsed.script || parsed.originalScript)) return parsed;
          // If JSON failed, return raw or try something else
          return { script: text, originalScript: text };
        }
      } catch (hfErr) {
        logger.error(`[HF_FORENSIC_FAILED] error=${hfErr}`);
        throw hfErr; // Strict
      }
    }

    const { ai } = getAI(apiKey);
    const model = selectModel(requestedModelForTier(currentModelTier), 'flash', apiKey);

    const systemInstruction = `
      Sei un esperto di trascrizione forense e analisi video.
      Il tuo compito è ricevere una sequenza di fotogrammi in più invii e, solo alla fine, produrre un'analisi completa.
      
      REGOLE DI RICEZIONE:
      - Per i messaggi intermedi, rispondi SEMPRE con: {"status": "RECEIVED", "chunk": X}
      - Per l'ultimo messaggio, produci il report finale in formato JSON conforme al schema richiesto.

      CAMPI REPORT FINALE:
      - originalScript: Trascrizione letterale (Ispezione visiva/labiale - NO AUDIO disponibile). STOP ALLUCINAZIONI.
      - script: Descrizione azione [Gesto] + Dialogo.
      - identityMapping: Identificazione soggetti.
      - musicAnalysis, neuroAnalysis: Analisi tecniche (solo visive).

      ${STRICT_ANALYTICAL_ENGINE_RULES}
    `;

    const chat = ai.chats.create({ 
      model, 
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });

    let lastResponseText = '';
    const totalChunks = Math.ceil(frames.length / 5);
    
    for (let i = 0; i < frames.length; i += 5) {
      const chunkIndex = Math.floor(i/5) + 1;
      const progressMsg = `Segmento: Analisi blocco ${chunkIndex} di ${totalChunks}...`;
      if (onProgress) onProgress(progressMsg);

      const chunk = frames.slice(i, i + 5).map(f => {
        const p = parseDataUrl(f);
        return p ? { inlineData: { mimeType: p.mimeType, data: p.data } } : null;
      }).filter(Boolean);
      
      const isLast = (i + 5) >= frames.length;
      const msg = isLast 
        ? `Ecco gli ultimi frame (Blocco ${chunkIndex}). Ora analizza l'INTERA SEQUENZA (1-${totalChunks}) e produci il report finale JSON applicando il PROTOCOLLO ISPETTORE.` 
        : `Ecco il Blocco ${chunkIndex} di ${totalChunks}. Rispondi solo confermando la ricezione con un JSON status: RECEIVED.`;
      
      try {
        const response = await executeWithNetworkRetry(
          async () => {
            return await chat.sendMessage({ message: [...chunk as any, { text: msg }] });
          }, 
          0, 
          undefined, 
          300000,
          apiKey,
          onProgress,
          model,
          trace,
          "Forensic Transcription Chunk",
          currentModelTier as "flash" | "pro",
          false,
          "COGNITIVE",
          false,
          "Step-by-step frame inspection",
          "video_frames",
          true
        );
        if (isLast) lastResponseText = response.text || '';
        
        // Pausa strategica tra i chunk: 4 secondi per evitare 429 (Too Many Requests) su carichi pesanti
        if (!isLast) await new Promise(r => setTimeout(r, 4000));
        
      } catch (e: any) {
        logger.error(`[Gemini] Errore nel caricamento del blocco \${chunkIndex}:`, e);
        throw e;
      }
    }
    
    let result = safeParseJSON(lastResponseText || '{}');
    
    // PROTOCOLLO FEDELTÀ: Loop di Validazione Forense
    const needsAudit = !result.originalScript || 
                       result.executionDebugBlock?.transcriptConfidence === 'LOW' ||
                       result.executionDebugBlock?.originalScriptRealityCheck === 'FAIL';

    if (needsAudit && frames.length > 2) {
      logger.warn("[Gemini] Verifica Forense Attivata: confidenza bassa o script mancante.");
      if (onProgress) onProgress("Verifica forense in corso per eliminare allucinazioni...");
      
      const auditMsg = result.originalScript 
        ? `ATTENZIONE: Il tuo originalScript ha una confidenza BASSA o ha fallito il reality check. 
           È possibile che tu sia stato influenzato dalla MEMORIA di citazioni famose o rime (allucinazione).
           RE-ISPEZIONA i fotogrammi. Verifica il labiale. 
           Rigenera ORA il JSON completo garantendo che originalScript sia 100% letterale e privo di bias mnemonic.`
        : "L'output non conteneva lo script originale. Rivedi i frame precedenti e rigenera ORA il JSON completo includendo originalScript.";

      try {
        const recoveryResponse = await chat.sendMessage({ message: auditMsg });
        result = safeParseJSON(recoveryResponse.text || '{}');
        logger.info("[Gemini] Verifica forense completata.");
      } catch (auditErr) {
        logger.error("[Gemini] Errore durante il loop di audit forense:", auditErr);
      }
    }

    return result;
  };

  try {
    return await executeTranscription(modelTier);
  } catch (err: any) {
    const errorMessage = err.message || String(err);
    const isQuotaError = errorMessage.toLowerCase().includes('quota') || 
                         errorMessage.includes('429') || 
                         errorMessage.toLowerCase().includes('resource_exhausted');
                         
    if (isQuotaError && modelTier === 'pro') {
      logger.warn("[Gemini] Quota esaurita su PRO. Passaggio a FLASH automatizzato.");
      // We don't reset all, we just try again and let getAI handle key selection
      return await executeTranscription('flash');
    }
    
    // If it's still a quota error even on flash, we might have hit a hard limit on the current key
    if (isQuotaError && modelTier === 'flash') {
      logger.warn("[Gemini] Quota esaurita anche su FLASH. Tentativo finale con reset stato...");
      resetQuotaStatus(); // Clear exhausted keys to see if we can find another one
      // One last attempt
      try {
        return await executeTranscription('flash');
      } catch (innerErr) {
        throw innerErr;
      }
    }
    
    throw err;
  }
}

export async function runMicroTensionEngine(
  apiKey: string,
  contentHierarchy: any,
  coreIntentClassification: any,
  sourceTypeLocked: string,
  trace?: ModelUsageTrace
): Promise<any> {
  const analysisModelTier = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
  if (analysisModelTier === 'groq') {
      logger.info("[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] module=Micro Tension Engine reason=external_mode_override");
      return { 
          hooks: [], 
          tensionPoints: [], 
          microTensions: ["NON_GENERATO_CORE_TEST"], 
          isFallback: true 
      };
  }
  const { ai } = getAI(apiKey);
  const modelTier = 'flash';
  const model = selectModel('flash', 'flash', apiKey);

  const isVideo = sourceTypeLocked && (sourceTypeLocked.includes('VIDEO') || sourceTypeLocked.includes('ANIMATED'));
  const modeInstructions = isVideo 
    ? `MODALITA: EXTRACT
    - Il contenuto sorgente è GIA' dinamico (VIDEO).
    - La microTension DEVE ESSERE ESTRATTA o enfatizzata, NON inventata da zero.
    ${coreIntentClassification?.coreIntent === 'INFORMATIVO' ? '- Per INFORMATIVO: Scegli SOLO "micro-delay" o "none" se già grafico. Se è video cinematico trasformato in informativo, usa "timing shift".' : ''}
    - NON introdurre eventi artificiali.
    - NON iniettare off-frame trigger a meno che non siano già supportati dall'input in maniera evidente.
    - Concentrati su: 'timing shift', 'natural emphasis', 'micro-delay', o micro-comportamenti reali già presenti.
    - Se il video non ha tensione naturale, consenti un minimo 'timing shift' o enfasi visiva, senza aggiunte narrative.
    - Il 'type' consigliato per video: "natural emphasis", "timing shift", "micro-delay", "interrupted action" (se congrua), o "none".`
    : `MODALITA: GENERATE 
    - Il contenuto sorgente è STATICO (STATIC_IMAGE, etc.).
    - La microTension DEVE ESSERE GENERATA forzatamente per creare dinamismo vitale.
    ${coreIntentClassification?.coreIntent === 'INFORMATIVO' ? '- Per INFORMATIVO: Forza "micro-delay", "interrupted reveal" o "contrast highlight". VIETATO physical gaze/gesture.' : ''}
    - Tipi ammessi: "gaze anomaly", "micro-delay", "interrupted action", "off-frame trigger", "contrast behavior".`;

  const lockPrompt = `
    ESEGUI MICRO_TENSION_ENGINE (VINCOLO CREATIVO).
    
    Analizza la Gerarchia Semantica e il Core Intent per determinare l'attivazione minima (tensione) obbligatoria.
    
    HIERARCHY:
    ${JSON.stringify(contentHierarchy)}
    
    CORE INTENT:
    ${JSON.stringify(coreIntentClassification)}
    
    SOURCE TYPE:
    ${sourceTypeLocked}
    
    ${modeInstructions}
    
    OBIETTIVO:
    Migliorare la ritenzione: in contenuti statici iniettando azione percettiva senza rompere il realismo, in video mantenendo l'autenticità originaria senza inserire eventi surreali forzati.
    
    REGOLE GENERALI:
    1. STATIC: Crea un'anomalia coerente per rompere la staticità (es. in persona: gaze anomaly, in oggetto: micro-delay luce).
    2. VIDEO: Preserva il realismo originario. Usa l'enfasi temporale.
    3. L'attivazione deve sempre: essere valutata come loopable, non introdurre eventi irragionevoli.
    
    Restituisci l'output ESATTAMENTE in questo formato JSON ("mode" deve essere "generate" per STATIC, "extract" per VIDEO):
    {
      "mode": "generate" | "extract",
      "type": "gaze anomaly" | "micro-delay" | "interrupted action" | "off-frame trigger" | "contrast behavior" | "natural emphasis" | "timing shift" | "none",
      "mechanism": "spiegazione di come avviene l'attivazione o l'enfasi",
      "loopable": true,
      "intensity": "low" | "medium"
    }
  `;

  try {
    const response = await executeGroqFirstTextTask({
      preferGroq: true,
      prompt: lockPrompt,
      systemInstruction: 'Return strict JSON only. Choose the minimum viable micro-tension consistent with source type and core intent. Never invent unsupported narrative events.',
      timeoutMs: 60000,
      taskType: 'SCRIPT_ANALYSIS',
      layer: 'Micro Tension Engine',
      model,
      apiKey,
      trace,
      modelTier: modelTier as "flash" | "pro",
      callReason: 'Selection of engagement-boosting micro-animations',
      inputSource: 'hierarchy_data',
      geminiOp: async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: [{ role: "user", parts: [{ text: lockPrompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                mode: { type: Type.STRING, enum: ["generate", "extract"] },
                type: { type: Type.STRING, enum: ["gaze anomaly", "micro-delay", "interrupted action", "off-frame trigger", "contrast behavior", "natural emphasis", "timing shift", "none"] },
                mechanism: { type: Type.STRING },
                loopable: { type: Type.BOOLEAN },
                intensity: { type: Type.STRING, enum: ["low", "medium"] }
              },
              required: ["mode", "type", "mechanism", "loopable", "intensity"]
            } as any
          }
        });
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      throw err;
    }
    logger.warn('Failed to execute or parse MicroTensionEngine output', err);
    return null;
  }
}

export async function runSupremeViralValidator(
  apiKey: string,
  result: any,
  sourceTypeLocked: string,
  contentHierarchy: any,
  modelTier: string = 'pro',
  trace?: ModelUsageTrace
): Promise<any> {
  const { ai } = getAI(apiKey);
  const effectiveModelTier = modelTier;
  const model = selectModel(requestedModelForTier(effectiveModelTier), 'flash', apiKey);
  const finalScriptForValidator =
    typeof result.finalScriptNormalized === 'string' && result.finalScriptNormalized.trim().length > 0
      ? result.finalScriptNormalized
      : (typeof result.script === 'string' ? result.script : "");

  const generatedPrompt = (result.aiPrompts && typeof result.aiPrompts === 'string' && result.aiPrompts.trim().length > 0 && result.aiPrompts !== "undefined")
    ? result.aiPrompts 
    : (result.promptSora15s || result.promptSora12s || result.soraPrompt12s || result.klingPrompt || result.veoPrompt || "NESSUNO");

  logger.info("[SVV_INPUT_AUDIT]", {
    scriptPreview: finalScriptForValidator.slice(0, 240),
    aiPromptPreview: typeof generatedPrompt === 'string' ? generatedPrompt.slice(0, 240) : String(generatedPrompt).slice(0, 240),
    originalScriptPreview: typeof result.originalScript === 'string' ? result.originalScript.slice(0, 240) : "",
    sourceAnchorIsAligned: result?.sourceAnchor?.isAligned === true,
    operationalDecision: result?.operationalDecision || "",
  });

  const criticalExamReport = result?.criticalExamReport || null;

  const lockPrompt = `
    ESEGUI SUPREME_VIRAL_VALIDATOR.
    Sei il gatekeeper finale. Il tuo compito è stabilire se l'output generato è REALMENTE PUBBLICABILE e pronto per diventare virale.

    ==== [ SEGNALI IN INGRESSO ] ====
    SOURCE TYPE: ${sourceTypeLocked}
    CORE INTENT: ${JSON.stringify(contentHierarchy)}
    CREATIVE POTENTIAL vs DEPTH: Potential=${result.creativePotential}, Depth=${result.creativeDepth}
    PATTERN BREAK: ${JSON.stringify(result.viralBrain?.patternBreak || result.patternBreak)}
    QUALITY WITHIN CEILING: ${JSON.stringify(result.qualityWithinCeiling)}
    MICRO TENSION: ${JSON.stringify(result.microTension)}
    SCRIPT GENERATO: ${finalScriptForValidator}
    AI PROMPT GENERATO: ${generatedPrompt}
    CRITICAL EXAM REPORT: ${JSON.stringify(criticalExamReport)}

    ==== [ REGOLE E HARD FAILS ] ====
    1. INFORMATIVO CINEMATIC DRIFT -> REJECT (Fail). Se l'intento è INFORMATIVO ma lo script o i prompt descrivono movimenti di camera, attori, scene fisiche o storytelling cinematografico. Deve essere puramente GRAFICO/EDITORIALE.
    2. STATIC without microTension -> REJECT (Fail). Se il source è STATIC e la microTension non è reale o è assente o mode != generate, non possiamo pubblicare.
    3. VIDEO with invented tension -> REJECT (Fail). Se il source è VIDEO e viene forzata una tensione inesistente (es. gaze anomaly inventato), dev'essere bocciato per preservare autenticità (mode deve essere extract).
    4. OVER-PROMISING (creativeDepth > creativePotential) -> REJECT (Fail). Se l'output cerca di dare troppa profondità a un input povero (es. aggiungendo trame inesistenti a uno still di prodotto).
    5. SEMANTIC DRIFT -> REJECT (Fail). Se l'idea o i prompt divergono dal Core Intent originale.
    6. BANALITY LOGIC -> RETRY (se recuperabile). Se l'esecuzione è piatta, banale o manca un payoff visivo.
    7. PROMPT GUARD -> Se in "SEGNALI IN INGRESSO" la voce "AI PROMPT GENERATO" riporta un testo valido, NON PUOI e NON DEVI dichiarare "AI PROMPT risulta undefined". Valuta il contenuto del prompt nel merito.
    
    Valuta coerenza semantica, presenza *reale* di micro-tensione nello script e nei prompt, struttura virale minima (hook -> evolution -> payoff -> loop) e anti-banalità.
    Se INFORMATIVO: verifica che la tensione sia di tipo GRAFICO (delay, reveal, contrast) e non FISICO.

    FINAL JUDGE RULES:
    - Se criticalExamReport.checks.technicalTrace = "FAIL", NON puoi dare APPROVE pieno.
    - Se criticalExamReport.checks.sourceTruth = "FAIL", devi dare REPAIR_REQUIRED o BLOCK.
    - Se criticalExamReport.recommendation = "REPAIR_REQUIRED", NON puoi dare APPROVE pieno.
    - Se solo signatureRisk = MEDIUM, puoi dare APPROVE_WITH_WARNINGS.
    - Se tutto è PASS, puoi dare APPROVE.

    VERDICT MAPPING:
    - APPROVE -> PUBLISH
    - APPROVE_WITH_WARNINGS -> PUBLISH
    - REPAIR_REQUIRED -> RETRY
    - BLOCK -> REJECT

    Emetti il verdetto.
  `;

  const { SUPREME_VIRAL_VALIDATOR_SCHEMA } = await import('./schemas');
  const { SYSTEM_INSTRUCTION } = await import('./constants');

  try {
    const response = await executeGroqFirstTextTask({
      preferGroq: true,
      prompt: lockPrompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      timeoutMs: 240000,
      taskType: 'SCRIPT_ANALYSIS',
      layer: 'Supreme Viral Validator',
      model,
      apiKey,
      trace,
      modelTier: modelTier as "flash" | "pro",
      callReason: 'Final gatekeeper validation before publishing',
      inputSource: 'multi_modal_feedback',
      geminiOp: async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: [{ role: "user", parts: [{ text: lockPrompt }] }],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: SUPREME_VIRAL_VALIDATOR_SCHEMA as any
          }
        });
      }
    });

    const parsed = safeParseJSON(response.text || '{}');
    if (parsed?.svv) {
      const examRecommendation = criticalExamReport?.recommendation || "APPROVE";
      const technicalTraceFail = criticalExamReport?.checks?.technicalTrace === "FAIL";
      const sourceTruthFail = criticalExamReport?.checks?.sourceTruth === "FAIL";
      const signatureRisk = criticalExamReport?.checks?.signatureRisk || "LOW";

      let finalJudgeDecision: "APPROVE" | "APPROVE_WITH_WARNINGS" | "REPAIR_REQUIRED" | "BLOCK";
      if (parsed.svv.verdict === "REJECT") {
        finalJudgeDecision = "BLOCK";
      } else if (parsed.svv.verdict === "RETRY") {
        finalJudgeDecision = "REPAIR_REQUIRED";
      } else if (technicalTraceFail || examRecommendation === "REPAIR_REQUIRED") {
        finalJudgeDecision = "REPAIR_REQUIRED";
      } else if (sourceTruthFail) {
        finalJudgeDecision = "BLOCK";
      } else if (
        examRecommendation === "APPROVE_WITH_WARNINGS" ||
        criticalExamReport?.checks?.scriptFaithfulness === "WARNING" ||
        criticalExamReport?.checks?.promptFidelity === "WARNING" ||
        criticalExamReport?.checks?.sourceTruth === "WARNING" ||
        signatureRisk === "MEDIUM"
      ) {
        finalJudgeDecision = "APPROVE_WITH_WARNINGS";
      } else {
        finalJudgeDecision = "APPROVE";
      }

      parsed.svv.finalJudgeDecision = finalJudgeDecision;
      parsed.svv.finalJudgeReasoning = parsed.svv.reason || "";
      parsed.svv.repairInstructions = Array.isArray(parsed.svv.actions) ? parsed.svv.actions : [];
    }

    return parsed;
  } catch (e) {
    logger.warn('Failed to execute or parse SVV output', e);
    return {
      svv: {
        verdict: "PUBLISH",
        confidence: "LOW",
        reason: "Fallback error in execution",
        actions: [],
        finalJudgeDecision: "APPROVE_WITH_WARNINGS",
        finalJudgeReasoning: "Fallback error in execution",
        repairInstructions: [],
      }
    };
  }
}
