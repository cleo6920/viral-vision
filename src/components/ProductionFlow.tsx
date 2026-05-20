import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VideoTrimmer } from './VideoTrimmer';
import { trimVideo, trimAudio, setSkipFFmpeg, isFFmpegSupported } from '../services/ffmpeg';
import { extractFrames, getVideoDuration } from '../utils/videoProcessor';
import { findBlueOceanNiches, generateSora2Prompt, optimizeSora2Prompt, generateAIVideoPrompts, boostViralImpact, runFinalViralAnalysis, runDecisionGate, performForensicTranscription, generateGuidedShort, mergeScripts, sanitizePrompt, resetQuotaStatus, resetRuntimeProviderState, runContentHierarchyReasoner, runContentDominanceValidator, runPrimaryPurposeLock, runFunctionalRoleLock, runIdeaAnchorLock } from '../services/gemini';
import { getExternalMarketSignals } from '../services/youtubeService';
import { NicheIdea, FinalViralAnalysis, ProductionStep, ExternalMarketData } from '../types';
import { logger } from '../utils/logger';
import { logApiBudgetReport, resetApiBudget } from '../services/ai/apiBudget';
import { safeParseJSON } from '../utils/json';
import { normalizeFinalResultContract } from '../utils/finalResultContract';
import { CopyButton } from './CopyButton';
import { SmartGuideWizard } from './SmartGuideWizard';
import { ConfirmModal } from './ConfirmModal';
import { DecisionEngineReport } from './DecisionEngineReport';
import { Loader2, Sparkles, Target, Zap, TrendingUp, Check, Play, Scissors, Film, ArrowRight, BrainCircuit, ShieldAlert, ShieldCheck, Rocket, Copy, RotateCcw, Music, Activity, Search, AlertTriangle, CheckCircle2, Unlock, XCircle } from 'lucide-react';

interface ProductionFlowProps {
  apiKey: string;
  genre: string;
  modelTier?: 'pro' | 'flash' | 'test' | 'smart' | 'groq' | 'hugging';
  setModelTier?: (tier: 'pro' | 'flash' | 'test' | 'smart' | 'groq' | 'hugging') => void;
  isDeepAnalysis: boolean;
}

const STORAGE_KEY = 'productionFlowState';

const loadState = (key: string, defaultValue: any) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = safeParseJSON(saved);
      return parsed[key] !== undefined ? parsed[key] : defaultValue;
    }
  } catch (e) {
    return defaultValue;
  }
  return defaultValue;
};

const shouldRetryWithSameTier = (errorMessage: string) => {
  return typeof errorMessage === 'string' && (
    errorMessage.includes('QUOTA_EXHAUSTED') ||
    errorMessage.includes('QUOTA_EXHAUSTED_ALL_KEYS') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('429')
  );
};

const getPromptText = (value: any): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    // Check best optimized prompt first
    if (value.bestOptimizedPrompt?.prompt?.trim()) return value.bestOptimizedPrompt.prompt;
    
    // Check all fields
    const fields = [
      'aiPrompts', 'sceneMasterPrompt', 'promptSora12s', 'soraPrompt12s', 
      'promptSora15s', 'soraPrompt15s', 'klingPrompt10s', 'klingPrompt15s', 
      'klingPrompt', 'veo3Prompt8s', 'veoPrompt', 'seedancePrompt15s', 
      'sendancePrompt15s', 'optimizedPrompt12s', 'optimizedPrompt15s', 'prompt'
    ];

    for (const field of fields) {
        if (typeof value[field] === 'string' && value[field].trim()) return value[field];
    }
  }
  return '';
};

const flattenUniqueStrings = (value: any): string[] => {
  const raw = Array.isArray(value) ? value.flat(10) : [value];
  return Array.from(new Set(raw
    .map((item: any) => String(item || '').trim())
    .filter((item: string) => item.length > 0)));
};

export function ProductionFlow({ apiKey, genre, modelTier = 'flash', setModelTier, isDeepAnalysis }: ProductionFlowProps) {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [analysisRunId, setAnalysisRunId] = useState(() => Math.random().toString(36).substring(7));
  const activeRunIdRef = useRef(analysisRunId);

  useEffect(() => {
    activeRunIdRef.current = analysisRunId;
  }, [analysisRunId]);

  const [step, setStep] = useState<ProductionStep>(() => loadState('step', 'INPUT'));
  
  // INPUT State
  const [file, setFile] = useState<File | null>(null); // Cannot persist File objects
  const [videoRange, setVideoRange] = useState<{start: number, end: number} | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isLowMemoryMode, setIsLowMemoryMode] = useState(() => {
    const saved = localStorage.getItem('low_memory_mode');
    return saved === 'true';
  });
  const [isVirtualTrimmed, setIsVirtualTrimmed] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [goal, setGoal] = useState(() => loadState('goal', ''));
  const [cast, setCast] = useState(() => loadState('cast', ''));
  const [frames, setFrames] = useState<string[]>(() => loadState('frames', []));
  
  const [videoSrc, setVideoSrc] = useState<string>('');

  useEffect(() => {
    if (!file) {
      setVideoSrc('');
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);
  
  // ANALYSIS State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [niches, setNiches] = useState<NicheIdea[]>(() => loadState('niches', []));
  const [ideaAnalysis, setIdeaAnalysis] = useState<any>(() => loadState('ideaAnalysis', null));
  const [detectedGenre, setDetectedGenre] = useState<string | null>(() => loadState('detectedGenre', null));
  
  // IDEA SELECTION State
  const [selectedIdea, setSelectedIdea] = useState<NicheIdea | null>(() => loadState('selectedIdea', null));
  const [hookStyle, setHookStyle] = useState<string>(() => loadState('hookStyle', 'random'));
  
  // PROMPT GENERATION State
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [prompt, setPrompt] = useState<any>(() => loadState('prompt', null));
  const [promptAnalysis, setPromptAnalysis] = useState<string | null>(() => loadState('promptAnalysis', null));
  const [originalScript, setOriginalScript] = useState<string | null>(() => loadState('originalScript', null));
  const [generatedScript, setGeneratedScript] = useState<string | null>(() => loadState('generatedScript', null));
  const [coreIntentClassification, setCoreIntentClassification] = useState<any>(() => loadState('coreIntentClassification', null));
  const [coreIntentDrift, setCoreIntentDrift] = useState<boolean>(() => loadState('coreIntentDrift', false));
  
  // VIRAL BOOST State
  const [isBoosting, setIsBoosting] = useState(false);
  
  // FINAL ANALYSIS State
  const [isFinalAnalyzing, setIsFinalAnalyzing] = useState(false);

  // PRODUCTION PROGRESS State
  const [productionProgress, setProductionProgress] = useState<{
    phase: string;
    module: string;
    provider?: string;
    status: string;
    step?: number;
    totalSteps?: number;
    elapsedSec?: number;
    fallbackActive?: boolean;
    lastUpdateAt?: number;
  } | null>(null);

  // Timer for elapsed seconds
  const [elapsedTimer, setElapsedTimer] = useState<number>(0);
  useEffect(() => {
    let interval: any;
    if (isAnalyzing || isGeneratingPrompt || isBoosting || isFinalAnalyzing) {
      interval = setInterval(() => {
        setElapsedTimer(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTimer(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, isGeneratingPrompt, isBoosting, isFinalAnalyzing]);
  const [finalAnalysis, setFinalAnalysis] = useState<FinalViralAnalysis | null>(() => loadState('finalAnalysis', null));
  const [externalMarketData, setExternalMarketData] = useState<ExternalMarketData | null>(() => loadState('externalMarketData', null));
  const [currentCall, setCurrentCall] = useState<{current: number, total: number} | null>(null);

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAnalyzingRef = useRef(false);

  // Keep-alive ping to prevent session timeout during long analyses
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (isAnalyzingRef.current) {
        console.log('[Ping] ProductionFlow: Sessione attiva - Analisi in corso...');
      }
    }, 10000); // Check every 10s
    return () => clearInterval(pingInterval);
  }, []);

  useEffect(() => {
    localStorage.setItem('low_memory_mode', String(isLowMemoryMode));
  }, [isLowMemoryMode]);

  // Debounced Save state to localStorage to prevent UI lag on mobile
  useEffect(() => {
    const timer = setTimeout(() => {
      const stateToSave = {
        step,
        goal,
        cast,
        frames: frames.length > 20 ? [] : frames, // Don't persist too many frames
        niches,
        detectedGenre,
        selectedIdea,
        ideaAnalysis,
        hookStyle,
        prompt,
        promptAnalysis,
        originalScript,
        generatedScript,
        finalAnalysis,
        externalMarketData
      };
      try {
        const serialized = JSON.stringify(stateToSave);
        // localStorage is limited (usually 5MB). If we exceed 2MB, we prune further.
        if (serialized.length > 2000000) {
           localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stateToSave, frames: [] }));
        } else {
           localStorage.setItem(STORAGE_KEY, serialized);
        }
      } catch (e) {
        console.warn("Failed to save state to localStorage (might be too large)", e);
        try {
          const stateWithoutFrames = { ...stateToSave, frames: [] };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithoutFrames));
        } catch (e2) {
          console.error("Still failed to save state", e2);
        }
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [step, goal, cast, frames, niches, detectedGenre, selectedIdea, ideaAnalysis, hookStyle, prompt, promptAnalysis, originalScript, generatedScript, finalAnalysis, externalMarketData, isAnalyzing]);

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    logger.info("[PRODUCTION_FLOW_HARD_RESET_START]");
    const previousId = activeRunIdRef.current;
    const newId = Math.random().toString(36).substring(7);
    activeRunIdRef.current = newId;
    setAnalysisRunId(newId);
    logger.info("[PRODUCTION_FLOW_HARD_RESET_RUN_ID_ROTATED]", { previousId, newId, refUpdatedImmediately: true });

    localStorage.removeItem(STORAGE_KEY);
    setStep('INPUT');
    setFile(null);
    setVideoRange(null);
    setGoal('');
    setCast('');
    setFrames([]);
    setNiches([]);
    setDetectedGenre(null);
    setSelectedIdea(null);
    setPrompt('');
    setPromptAnalysis(null);
    setOriginalScript(null);
    setGeneratedScript(null);
    setFinalAnalysis(null);
    setExternalMarketData(null);
    setError(null);
    resetRuntimeProviderState();
  };

  const handleStartAnalysis = async () => {
    if (isAnalyzingRef.current) {
      logger.info("[ProductionFlow] Analysis already in progress (ref), skipping handleStartAnalysis");
      return;
    }
    const currentRunId = activeRunIdRef.current;
    isAnalyzingRef.current = true;
    resetApiBudget(`ProductionFlow.handleStartAnalysis:${modelTier}`);
    console.log('--- SINGOLA CHIAMATA PARTITA (Start Analysis) ---');

    // Safety Timeout: force unlock after 300s (5m)
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        console.warn("[ProductionFlow] Safety timeout reached in handleStartAnalysis, forcing unlock.");
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        resetQuotaStatus();
        setError("L'analisi iniziale ha impiegato troppo tempo (5 minuti) ed è stata interrotta.");
      }
    }, 300000);

    const cleanupStartAnalysis = () => {
      clearTimeout(safetyTimeout);
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setIsTakingLong(false);
      setIsTrimming(false);
      setCurrentCall(null);
    };

    if (!goal.trim() || !cast.trim()) {
      setError("Inserisci un obiettivo e il cast.");
      cleanupStartAnalysis();
      return;
    }

    if (!apiKey) {
      setError("Inserisci la tua API Key nelle impostazioni.");
      cleanupStartAnalysis();
      return;
    }
    let takingLongTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      setIsAnalyzing(true);
    setIsTakingLong(false);
    setStep('ANALYSIS');
    setExternalMarketData(undefined);
    setFinalAnalysis(null);
    setOriginalScript(null);
    setGeneratedScript(null);
    setPromptAnalysis(null);
    setNiches([]);
    setIdeaAnalysis(null);
    setDetectedGenre(null);
    
    takingLongTimeout = setTimeout(() => setIsTakingLong(true), 90000);
    
    // Inizio analisi...
    let extractedFrames: string[] = [];
    
    if (file) {
        console.log("[ProductionFlow] File video rilevato:", file.name, file.size);
        let videoToProcess = file;
        let effectiveRange = videoRange;
        
        if (videoRange) {
          // Se l'utente ha già fatto il "Virtual Trim", saltiamo il tentativo fisico per velocità
          if (isVirtualTrimmed) {
            console.log("[ProductionFlow] Virtual Trim attivo, salto taglio fisico.");
            effectiveRange = videoRange;
          } else {
            // Se siamo in un iframe (non isolato), FFmpeg è lentissimo o fallisce.
            // Alziamo la soglia a 35MB per evitare di usarlo se non strettamente necessario.
            const skipThreshold = window.crossOriginIsolated ? 25 * 1024 * 1024 : 35 * 1024 * 1024;
            
            if (file.size < skipThreshold) {
              console.log(`[ProductionFlow] Video size ${file.size} < ${skipThreshold}, skipping physical trim.`);
            } else {
              console.log("[ProductionFlow] Video grande, avvio taglio fisico:", videoRange);
              setIsTrimming(true);
              try {
                videoToProcess = await trimVideo(file, videoRange.start, videoRange.end, setTrimProgress);
                console.log("[ProductionFlow] Taglio completato.");
                effectiveRange = null;
              } catch (trimError) {
                console.error("[ProductionFlow] Errore taglio video, procedo con Virtual Trim:", trimError);
                // Procediamo con il file originale, extractFrames userà startTime/endTime
                videoToProcess = file;
                // effectiveRange rimane quello originale
                setError("Nota: Il taglio fisico del video è fallito, ma l'analisi procederà comunque sul segmento selezionato (Virtual Trim).");
                // Piccola attesa per far leggere il messaggio
                await new Promise(r => setTimeout(r, 2000));
              }
              setIsTrimming(false);
            }
          }
        }
        
        try {
          console.log("[AUDIO_PREP_START]", {
            fileSizeMB: (videoToProcess.size / (1024 * 1024)).toFixed(2),
            method: "FileReaderBase64"
          });
          setAnalysisStatus("Preparazione audio in corso...");

          console.log("[ProductionFlow] Estrazione frame...");
          const framesToExtract = modelTier === 'test' ? 10 : (isDeepAnalysis ? 80 : 40);
          extractedFrames = await extractFrames(
            videoToProcess, 
            framesToExtract,
            effectiveRange?.start || 0, 
            effectiveRange?.end || 0,
            800,
            undefined,
            isLowMemoryMode
          );
          console.log("[ProductionFlow] Frame estratti:", extractedFrames.length);

          if (effectiveRange && isFFmpegSupported()) {
            setAnalysisStatus("Isolamento sorgente audio in corso...");
            try {
              const audioSlice = await trimAudio(videoToProcess, effectiveRange.start, effectiveRange.end, (p) => {
                setAnalysisStatus(`Isolamento audio: ${Math.round(p * 100)}%`);
              });
              const base64Audio = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(audioSlice);
              });
              extractedFrames.push(base64Audio);
              console.log("[AUDIO_PREP_SUCCESS]", { payloadType: "audioSlice", payloadSizeApproxMB: (audioSlice.size / (1024 * 1024)).toFixed(2) });
            } catch (audioErr) {
              console.error("[AUDIO_PREP_FAILED]", { reason: "FILE_READ_FAILED", error: audioErr });
              setAnalysisStatus("Preparazione audio fallita.");
              console.warn("[ProductionFlow] Fallimento isolamento audio, Gemini dovrà basarsi sui frames:", audioErr);
            }
          } else {
             console.log("[AUDIO_PREP_SUCCESS]", { payloadType: "no_explicit_audio_slice" });
          }
        } catch (extractError: any) {
          console.error("[AUDIO_PREP_FAILED]", { reason: "FILE_READ_FAILED", error: extractError });
          // Fallback logic...
          
          // Se è un errore di decodifica o timeout, proviamo il fallback
          const isDecodeError = extractError?.message?.includes('DECODE_ERROR');
          const isTimeout = extractError?.message?.includes('Timeout');
          
          if (isDecodeError || isTimeout || file.size < 35 * 1024 * 1024) {
            try {
              console.log(`Tentativo fallback (${isDecodeError ? 'Errore Decodifica' : 'Timeout/Errore generico'}): lettura file come base64...`);
              const base64Video = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(videoToProcess);
              });
              console.log("Fallback riuscito in ProductionFlow.");
              extractedFrames = [base64Video];
              console.log("Fallback: Video inviato direttamente come base64 per l'analisi (Protocollo Diamante Fallback).");
            } catch (fallbackError) {
              console.error("Errore nel fallback video in ProductionFlow:", fallbackError);
              throw extractError; // Rilancia l'errore originale se anche il fallback fallisce
            }
          } else {
            throw extractError;
          }
        }
    } else {
      console.log("[ProductionFlow] Modalità idea-only: nessun file video, procedo con analisi testuale.");
      setAnalysisStatus("Ricerca nicchie Blue Ocean in corso...");
    }
      
      setFrames(extractedFrames);
      
      setCurrentCall({ current: 1, total: 1 });
      setAnalysisStatus("Ricerca nicchie Blue Ocean in corso...");
      console.log("[BLUE_OCEAN_START] Chiamata a findBlueOceanNiches...");
      
      const onProgressUpdate = (data: any) => {
        setProductionProgress(prev => ({
          ...prev,
          ...data,
          lastUpdateAt: Date.now()
        }));
        if (data.status) setAnalysisStatus(data.status);
        logger.info(`[PRODUCTION_PROGRESS_UPDATE] phase=${data.phase} module=${data.module} provider=${data.provider || 'N/A'} status=${data.status}`);
      };

      let response;
      try {
        response = await findBlueOceanNiches(extractedFrames, goal, cast, apiKey, genre, modelTier, onProgressUpdate);
      } catch (err: any) {
        const errorMessage = err.message || String(err);
        const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('GEMINI_QUOTA_EXHAUSTED');
        const isBlockedError = errorMessage.includes('GEMINI_FALLBACK_BLOCKED_BY_POLICY') || errorMessage.includes('TEXT_TASK_FAILED_NO_PROVIDER_AVAILABLE');
        const is404Error = errorMessage.includes("FILE_NOT_FOUND_REUPLOAD_REQUIRED") || err.is404;

        if (is404Error) {
          logger.warn("[ProductionFlow] 404 Error detected. Retrying analysis...");
          await new Promise(r => setTimeout(r, 2000));
          response = await findBlueOceanNiches(extractedFrames, goal, cast, apiKey, genre, modelTier);
        } else if (isQuotaError || isBlockedError) {
          logger.warn(`[BLUE_OCEAN_FALLBACK_USED] ${isQuotaError ? 'Quota exceeded' : 'Policy blocked'}, applying degraded mode`);
          setError(`Analisi avanzata non disponibile (${isQuotaError ? 'Limite quota' : 'Strategia risparmio'}). Procedo in modalità base.`);
          response = {
              analysisMode: "GROQ_ONLY_DEGRADED",
              engineReliability: "DEGRADED",
              step1_ideaAnalysis: { nicheViability: "UNVERIFIED", nicheViabilityReason: "DEGRADED_MODE_SKIPPED" },
              step2_ideaEngine: { 
                  safeIdea: { id: "safe", title: "Idea (Generata in Groq-only)", description: "Script basato su input", marketGap: "Bypass", psychologicalTrigger: "Bypass", risk: "Low", scores: { finalScore: 7 }, isHighRiskHighReward: false },
                  unexpectedIdea: { id: "unexpected", title: "Idea (Generata in Groq-only)", description: "Script basato su input", marketGap: "Bypass", psychologicalTrigger: "Bypass", risk: "Low", scores: { finalScore: 7 }, isHighRiskHighReward: false },
                  extremeIdea: { id: "extreme", title: "Idea (Generata in Groq-only)", description: "Script basato su input", marketGap: "Bypass", psychologicalTrigger: "Bypass", risk: "Low", scores: { finalScore: 7 }, isHighRiskHighReward: false },
                  improvedOriginalIdea: { id: "improved", title: "Idea originale migliorata", description: "Script basato su input", marketGap: "Bypass", psychologicalTrigger: "Bypass", risk: "Low", scores: { finalScore: 7 }, isHighRiskHighReward: false },
                  aiRecommendedIdeaId: "safe",
                  aiRecommendedReason: "DEGRADED_MODE"
              }
          };
        } else if (shouldRetryWithSameTier(errorMessage)) {
          logger.warn("[ProductionFlow] Detected quota exhaustion, retrying once on the same tier to allow centralized key/model fallback...");
          await new Promise(r => setTimeout(r, 1500));
          response = await findBlueOceanNiches(extractedFrames, goal, cast, apiKey, genre, modelTier);
        } else {
          throw err;
        }
      }
      console.log("[BLUE_OCEAN_PROVIDER_RESPONSE] Risposta findBlueOceanNiches ricevuta.", response);
      
      if (!response || Object.keys(response).length === 0) {
        console.warn("[BLUE_OCEAN_EMPTY_RESULT] API returned empty object");
        throw new Error("Provider non ha restituito dati JSON validi.");
      }

      if (!response.step2_ideaEngine) {
        console.warn(`[BLUE_OCEAN_SCHEMA_INVALID] Expected step2_ideaEngine, got: ${Object.keys(response).join(", ")}`);
        throw new Error(`Schema JSON non conforme: atteso step2_ideaEngine, ricevuto: ${Object.keys(response).join(", ")}`);
      }

      console.log(`[BLUE_OCEAN_PARSED_COUNT] engine generated correctly`);

      const engine = response.step2_ideaEngine;
      const mappedNiches: NicheIdea[] = [
        { ...engine.safeIdea, niche: 'Safe Idea', id: engine.safeIdea.id || 'safe' },
        { ...engine.unexpectedIdea, niche: 'Unexpected Idea', id: engine.unexpectedIdea.id || 'unexpected' },
        { ...engine.extremeIdea, niche: 'Extreme Idea', id: engine.extremeIdea.id || 'extreme' },
        { ...engine.improvedOriginalIdea, niche: 'Improved Original', id: engine.improvedOriginalIdea.id || 'improved' }
      ].map(idea => ({
        ...idea,
        isRecommended: idea.id === engine.aiRecommendedIdeaId,
        recommendedReason: idea.id === engine.aiRecommendedIdeaId ? engine.aiRecommendedReason : undefined,
        nicheViability: response.step1_ideaAnalysis?.nicheViability,
        nicheViabilityReason: response.step1_ideaAnalysis?.nicheViabilityReason
      }));

      if (currentRunId !== activeRunIdRef.current) {
        logger.warn("[PRODUCTION_FLOW_STALE_ANALYSIS_RESULT_IGNORED]", { runId: currentRunId, activeId: activeRunIdRef.current });
        return;
      }

      setNiches(mappedNiches);
      setIdeaAnalysis(response.step1_ideaAnalysis);
      setDetectedGenre(genre); // Or extract from response if available
      setStep('IDEA_SELECTION');
      setCurrentCall(null);
      if (takingLongTimeout) clearTimeout(takingLongTimeout);
    } catch (err: any) {
      console.error("[ProductionFlow] Errore in handleStartAnalysis:", err);
      setError(err?.message || "L'analisi da idea non è riuscita. Riprova.");
      setStep('INPUT');
      setCurrentCall(null);
    } finally {
      if (takingLongTimeout) clearTimeout(takingLongTimeout);
      clearTimeout(safetyTimeout);
      logApiBudgetReport('ProductionFlow.handleStartAnalysis');
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setIsTakingLong(false);
      setIsTrimming(false);
    }
  };

  const handleForensicAnalysis = async (apiKey: string) => {
    if (isAnalyzingRef.current) {
      logger.info("[ProductionFlow] Forensic analysis already in progress (ref), skipping handleForensicAnalysis");
      return;
    }
    const currentRunId = activeRunIdRef.current;
    isAnalyzingRef.current = true;
    resetApiBudget(`ProductionFlow.handleForensicAnalysis:${modelTier}`);
    console.log('--- SINGOLA CHIAMATA PARTITA (Forensic) ---');

    // Safety Timeout: force unlock after 300s (Forensic can be long)
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        console.warn("[ProductionFlow] Safety timeout reached in handleForensicAnalysis, forcing unlock.");
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        setError("L'analisi forense ha superato i 300 secondi. Riprova con un video più breve o controlla la connessione.");
      }
    }, 300000);

    if (!file) return;
    logger.info('Inizio analisi forense', { fileName: file.name });
    setIsAnalyzing(true);
    setStep('ANALYSIS');
    setAnalysisStatus("Inizializzazione Analisi Forense...");
    setAnalysisProgress(0);
    setError(null);
    setOriginalScript(null);
    setGeneratedScript(null);
    setExternalMarketData(undefined);
    setFinalAnalysis(null);
    setPromptAnalysis(null);
    setNiches([]);
    setIdeaAnalysis(null);
    try {
      const duration = await getVideoDuration(file);
      logger.info('Durata video ottenuta', { duration });
      
      let chunkDuration = 30; 
      if (duration > 300) chunkDuration = 60;
      if (duration > 600) chunkDuration = 120;
      
      const numChunks = Math.min(Math.ceil(duration / chunkDuration), 15);
      const results = [];

      setCurrentCall({ current: 0, total: numChunks });

      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration;
        const endTime = Math.min((i + 1) * chunkDuration, duration);
        
        logger.info(`Analisi segmento ${i + 1}/${numChunks}`, { startTime, endTime });
        const progress = Math.round(((i + 1) / numChunks) * 100);
        logger.info(`Setting progress to ${progress}%`);
        setAnalysisProgress(progress);
        setCurrentCall({ current: i + 1, total: numChunks });
        setAnalysisStatus(`Chiamata ${i + 1} di ${numChunks} in corso...`);
        
        // AUMENTO FRAME PER ANALISI FORENSE (15 frame invece di 8) per catturare ogni dettaglio
        const chunkFrames = await extractFrames(file, 15, startTime, endTime, 800, undefined, isLowMemoryMode);
        
        let result;
        try {
          result = await performForensicTranscription(chunkFrames, apiKey, modelTier, (text) => {
            // text is "Chiamata X di Y in corso..." from gemini.ts
            // We want to show it clearly
            setAnalysisStatus(`Segmento ${i + 1}/${numChunks} - ${text}`);
            logger.info(`[ProductionFlow] Segmento ${i + 1}/${numChunks} - ${text}`);
          });
        } catch (err: any) {
          const errorMessage = err.message || String(err);
          const is404Error = errorMessage.includes("FILE_NOT_FOUND_REUPLOAD_REQUIRED") || err.is404;
          if (is404Error) {
            logger.warn(`[ProductionFlow] 404 Error in chunk ${i + 1}. Retrying...`);
            await new Promise(r => setTimeout(r, 2000));
            result = await performForensicTranscription(chunkFrames, apiKey, modelTier, (text) => {
              logger.info(`[ProductionFlow] ${text}`);
            });
          } else {
            throw err;
          }
        }
        results.push(result);
      }

      setAnalysisProgress(95);
      logger.info('Unione risultati');
      const finalResult = await mergeScripts(results, apiKey, modelTier);
      logger.info('Analisi forense completata');
      if (currentRunId !== activeRunIdRef.current) {
        logger.warn("[PRODUCTION_FLOW_STALE_FORENSIC_RESULT_IGNORED]", { runId: currentRunId, activeId: activeRunIdRef.current });
        return;
      }

      setAnalysisProgress(100);
      setOriginalScript(finalResult.originalScript);
      setGeneratedScript(finalResult.script);
      setStep('PROMPT_GENERATION');
      setCurrentCall(null);
    } catch (err: any) {
      setCurrentCall(null);
      clearTimeout(safetyTimeout);
      logger.error('Errore analisi forense', { error: err.message });
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Connessione interrotta durante l'analisi forense. Riprova.");
      } else {
        setError("Errore durante l'analisi forense.");
      }
      setStep('INPUT');
    } finally {
      clearTimeout(safetyTimeout);
      logApiBudgetReport('ProductionFlow.handleForensicAnalysis');
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const handleSelectIdea = async (idea: NicheIdea) => {
    if (isAnalyzingRef.current) {
      logger.info("[ProductionFlow] Selection already in progress (ref), skipping handleSelectIdea");
      return;
    }
    const currentRunId = activeRunIdRef.current;
    isAnalyzingRef.current = true;
    resetApiBudget(`ProductionFlow.handleGeneratePrompt:${modelTier}`);
    console.log('--- SINGOLA CHIAMATA PARTITA (Select Idea) ---');

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        console.warn("[ProductionFlow] Safety timeout reached in handleSelectIdea, forcing unlock.");
        isAnalyzingRef.current = false;
        setIsGeneratingPrompt(false);
        setError("La generazione del prompt ha superato i 300 secondi. Riprova.");
      }
    }, 300000);

    setSelectedIdea(idea);
    setStep('PROMPT_GENERATION');
    setIsGeneratingPrompt(true);
    setError(null);
    setPromptAnalysis(null);
    setExternalMarketData(undefined);
    setFinalAnalysis(null);
    
    try {
      let externalMarketData: ExternalMarketData | undefined;
      try {
        const youtubeApiKey = localStorage.getItem('youtube_api_key') || undefined;
        const researchContext = `
          ANALYZED VIDEO SCRIPT: ${originalScript || 'N/A'}
          ANALYZED VIDEO STRUCTURE: ${generatedScript || 'N/A'}
          IDEA TITLE: ${idea.title}
          IDEA DESCRIPTION: ${idea.description}
          UI GOAL: ${goal}
          UI GENRE/NICHE: ${genre}
        `.trim();
        
        logger.info("[ProductionFlow] Fetching external market signals for prompt generation...");
        logger.info("[ProductionFlow] RAW INPUT OBJECT PASSED TO YOUTUBE SERVICE:", researchContext);
        
        if (!idea.description && (!genre || genre.toLowerCase() === 'sport' || genre.toLowerCase() === 'general')) {
          logger.warn("[ProductionFlow] Missing description and generic niche detected. Checking if script exists...");
          if (!originalScript && !generatedScript) {
             logger.error("[ProductionFlow] Cannot proceed with query generation: empty description and generic niche with no script.");
             throw new Error("INPUT_MAPPING_FAILURE: WRONG_UPSTREAM_SEARCH_INPUT");
          }
        }

        externalMarketData = await getExternalMarketSignals(researchContext, apiKey, youtubeApiKey, modelTier);
      } catch (e) {
        logger.warn("[ProductionFlow] Failed to fetch external market data for prompt generation", e);
      }


      let result;
      try {
        const onProgressUpdate = (data: any) => {
          setProductionProgress(prev => ({
            ...prev,
            ...data,
            lastUpdateAt: Date.now()
          }));
          if (data.status) setAnalysisStatus(data.status);
          logger.info(`[PROMPT_GENERATION_PROGRESS] phase=${data.phase} module=${data.module} provider=${data.provider || 'N/A'} status=${data.status}`);
        };

        result = await generateAIVideoPrompts(idea, goal, cast, genre, originalScript || "");
      } catch (err: any) {
        logger.error("[PROMPT_GENERATION_FINAL_FAILURE] All paths failed.", err);
        throw err;
      }
      
      // Extract scripts from XML tags
      const generatedPromptText = getPromptText(result);
      if (result && generatedPromptText) {
        const originalScriptMatch = generatedPromptText.match(/<original_script>([\s\S]*?)<\/original_script>/i);
        const directorScriptMatch = generatedPromptText.match(/<optimized_script>([\s\S]*?)<\/optimized_script>/i) || generatedPromptText.match(/<director_script>([\s\S]*?)<\/director_script>/i);
        
        if (currentRunId !== activeRunIdRef.current) {
          logger.warn("[PRODUCTION_FLOW_STALE_SELECT_IDEA_RESULT_IGNORED]", { runId: currentRunId, activeId: activeRunIdRef.current });
          return;
        }

        if (originalScriptMatch) setOriginalScript(originalScriptMatch[1].trim());
        if (directorScriptMatch) setGeneratedScript(directorScriptMatch[1].trim());
        
        setPromptAnalysis(result.analysis);
        setExternalMarketData(externalMarketData || null);
        setCoreIntentClassification(result.coreIntentClassification || null);
        setCoreIntentDrift(!!result.coreIntentDrift);
        
        setPrompt(result);
      } else {
        console.error("[ProductionFlow] Invalid result from generateSora2Prompt:", result);
        throw new Error("Invalid result from prompt generation");
      }
      
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error(err);
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Connessione interrotta durante la generazione del prompt. Riprova.");
      } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        setError("Hai esaurito i token gratuiti o raggiunto il limite di richieste. Attendi qualche minuto e riprova, oppure inserisci una chiave API a pagamento nelle impostazioni.");
      } else {
        setError(errorMessage || "Errore durante la generazione del prompt.");
      }
      setStep('IDEA_SELECTION');
    } finally {
      clearTimeout(safetyTimeout);
      logApiBudgetReport('ProductionFlow.handleGeneratePrompt');
      isAnalyzingRef.current = false;
      setIsGeneratingPrompt(false);
    }
  };

  const handleViralBoost = async () => {
    if (isAnalyzingRef.current) {
      logger.info("[ProductionFlow] Viral boost already in progress (ref), skipping handleViralBoost");
      return;
    }
    isAnalyzingRef.current = true;
    resetApiBudget(`ProductionFlow.handleBoost:${modelTier}`);
    console.log('--- SINGOLA CHIAMATA PARTITA ---');

    setIsBoosting(true);
    setError(null);

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        console.warn("[ProductionFlow] Safety timeout reached in handleViralBoost, forcing unlock.");
        isAnalyzingRef.current = false;
        setIsBoosting(false);
        setError("Il viral boost ha superato i 300 secondi. Riprova.");
      }
    }, 300000);
    
    try {
      let boostedPrompt;
      try {
        boostedPrompt = await boostViralImpact(getPromptText(prompt), apiKey, genre, modelTier);
      } catch (err: any) {
        const errorMessage = err.message || String(err);
        const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
        if (shouldRetryWithSameTier(errorMessage)) {
          logger.warn("[ProductionFlow] Detected quota exhaustion, retrying once on the same tier to allow centralized key/model fallback...");
          await new Promise(r => setTimeout(r, 1500));
          boostedPrompt = await boostViralImpact(getPromptText(prompt), apiKey, genre, modelTier);
        } else {
          throw err;
        }
      }
      setPrompt((prev: any) => {
        if (prev && typeof prev === 'object') {
          return { ...prev, prompt: boostedPrompt, aiPrompts: boostedPrompt };
        }
        return boostedPrompt;
      });
      setStep('VIRAL_BOOST');
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error(err);
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Connessione interrotta durante il viral boost. Riprova.");
      } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        setError("Hai esaurito i token gratuiti o raggiunto il limite di richieste. Attendi qualche minuto e riprova, oppure inserisci una chiave API a pagamento nelle impostazioni.");
      } else {
        setError(errorMessage || "Errore durante il viral boost.");
      }
    } finally {
      clearTimeout(safetyTimeout);
      logApiBudgetReport('ProductionFlow.handleBoost');
      isAnalyzingRef.current = false;
      setIsBoosting(false);
    }
  };

  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleSora2Optimize = async () => {
    if (isAnalyzingRef.current) {
      logger.info("[ProductionFlow] Sora 2 optimization already in progress (ref), skipping handleSora2Optimize");
      return;
    }
    isAnalyzingRef.current = true;
    resetApiBudget(`ProductionFlow.handleOptimizePrompt:${modelTier}`);
    console.log('--- SINGOLA CHIAMATA PARTITA ---');

    setIsOptimizing(true);
    setError(null);

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        console.warn("[ProductionFlow] Safety timeout reached in handleSora2Optimize, forcing unlock.");
        isAnalyzingRef.current = false;
        setIsOptimizing(false);
        setError("L'ottimizzazione Sora 2 ha superato i 300 secondi. Riprova.");
      }
    }, 300000);
    
    try {
      let result;
      try {
        result = await optimizeSora2Prompt(getPromptText(prompt), apiKey, genre, modelTier);
      } catch (err: any) {
        const errorMessage = err.message || String(err);
        const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
        if (shouldRetryWithSameTier(errorMessage)) {
          logger.warn("[ProductionFlow] Detected quota exhaustion, retrying once on the same tier to allow centralized key/model fallback...");
          await new Promise(r => setTimeout(r, 1500));
          result = await optimizeSora2Prompt(getPromptText(prompt), apiKey, genre, modelTier);
        } else {
          throw err;
        }
      }
      
      setPrompt((prev: any) => {
        if (prev && typeof prev === 'object') {
          return { ...prev, ...result, prompt: result.prompt || getPromptText(prev) };
        }
        return result;
      });
      setPromptAnalysis(result.analysis);
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error(err);
      const errorMessage = err.message || String(err);
      if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
        setError("Connessione interrotta durante l'ottimizzazione Sora 2. Riprova.");
      } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        setError("Hai esaurito i token gratuiti o raggiunto il limite di richieste. Attendi qualche minuto e riprova, oppure inserisci una chiave API a pagamento nelle impostazioni.");
      } else {
        setError(errorMessage || "Errore durante l'ottimizzazione Sora 2.");
      }
    } finally {
      clearTimeout(safetyTimeout);
      logApiBudgetReport('ProductionFlow.handleOptimizePrompt');
      isAnalyzingRef.current = false;
      setIsOptimizing(false);
    }
  };

  const normalizeResultForUI = (result: any): any => {
    return normalizeFinalResultContract(result, { genre, platform: 'TikTok', analysisMode: 'production-flow' });
  };

  const handleFinalAnalysis = async () => {
    if (isAnalyzingRef.current) {
      logger.info("[ProductionFlow] Final analysis already in progress (ref), skipping handleFinalAnalysis");
      return;
    }
    isAnalyzingRef.current = true;
    resetApiBudget(`ProductionFlow.handleFinalAnalysis:${modelTier}`);
    console.log('--- SINGOLA CHIAMATA PARTITA ---');

    setIsFinalAnalyzing(true);
    setError(null);
    logger.info("LOG_CAPTURE_START", { goal, genre, modelTier, isDeepAnalysis });

    // Safety Timeout: force unlock after 300s
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzingRef.current) {
        console.warn("[ProductionFlow] Safety timeout reached in handleFinalAnalysis, forcing unlock.");
        isAnalyzingRef.current = false;
        setIsFinalAnalyzing(false);
        setError("L'analisi finale ha superato i 300 secondi. Riprova.");
      }
    }, 300000);
    
    try {
      let analysis;
      let externalMarketData: ExternalMarketData | undefined;
      
      // 1. Collect External Market Signals
      setCurrentCall({ current: 1, total: 2 });
      setAnalysisStatus("Raccolta segnali di mercato esterni (YouTube)...");
      
      try {
        const youtubeApiKey = localStorage.getItem('youtube_api_key') || undefined;
        
        // Use more context than just the prompt for better search results
        const researchContext = `
          IDEA: ${selectedIdea?.title || ''}
          DESCRIPTION: ${selectedIdea?.description || ''}
          VISUAL PROMPT: ${getPromptText(prompt)}
          ORIGINAL SCRIPT: ${originalScript || ''}
        `.trim();

        logger.info("[ProductionFlow] Fetching external market signals for context:", researchContext.substring(0, 100) + "...");
        externalMarketData = await getExternalMarketSignals(researchContext, apiKey, youtubeApiKey, modelTier);
        logger.info("[ProductionFlow] External market data status:", externalMarketData.status);
        
        // 2. Run Decision Gate (Intel-Gate) First
        setCurrentCall({ current: 2, total: 3 });
        setAnalysisStatus("Valutazione strategica dell'idea...");
        let gateResult;
        try {
          gateResult = await runDecisionGate(getPromptText(prompt), apiKey, modelTier, externalMarketData);
          logger.info("[ProductionFlow] Decision Gate returned:", gateResult);
        } catch (gateErr: any) {
          logger.error("[ProductionFlow] Error in Decision Gate:", gateErr);
          // Fallback to KEEP if gate completely fails to not break the app
          gateResult = { decision: "KEEP", confidence: 0 };
        }

        // 🧠 INTEL-GATE: Reject & Replace Mechanism (Step 3 Emergency Trigger)
        const shouldTriggerStep3 = gateResult.decision === 'REPLACE' && (gateResult.confidence || 0) >= 0.7;
        let step3Results;

        if (shouldTriggerStep3) {
          logger.info("[ProductionFlow] Intel-Gate Triggered: REJECT & REPLACE initiated.", gateResult);
          setAnalysisStatus("⚠️ REJECT & REPLACE: Generazione alternative strategiche (Step 3)...");
          
          try {
            step3Results = await findBlueOceanNiches(frames, goal, cast, apiKey, genre, modelTier);
          } catch (step3Err: any) {
            logger.error("[ProductionFlow] Step 3 fallback failed", step3Err);
            if (step3Err.message?.toLowerCase().includes('quota') && modelTier === 'pro') {
              if (setModelTier) setModelTier('flash');
              step3Results = await findBlueOceanNiches(frames, goal, cast, apiKey, genre, 'flash');
            }
          }
        }

        // 3. Run Restricted Production Factory
        setCurrentCall({ current: 3, total: 4 });
        setAnalysisStatus("Analisi Gerarchia Semantica...");

        let sensorCategory: string | null = null;
        if (file) {
          try {
            const { calculateVideoVariance } = await import('../utils/videoVarianceSensor');
            const sensorData = await calculateVideoVariance(file);
            sensorCategory = sensorData.category;
            logger.info(`[ProductionFlow] Visual variance category: ${sensorCategory}`);
          } catch (e) {
            logger.warn("Sensor failed in ProductionFlow", e);
          }
        }

        let contentHierarchy: any = null;
        let primaryPurposeLock: any = null;
        let functionalRoleLock: any = null;
        let ideaAnchorLock: any = null;
        let transformationOutput: any = null;
        try {
          const preflightParts = [...frames, { text: getPromptText(prompt) }];
          contentHierarchy = await runContentHierarchyReasoner(preflightParts, apiKey);
          logger.info("CONTENT_HIERARCHY_CAPTURED", contentHierarchy);
          
          if (contentHierarchy) {
            setAnalysisStatus("Applicazione Primary Purpose Lock...");
            primaryPurposeLock = await runPrimaryPurposeLock(apiKey, contentHierarchy);
            
            setAnalysisStatus("Validazione Ruolo Funzionale...");
            functionalRoleLock = await runFunctionalRoleLock(apiKey, contentHierarchy, primaryPurposeLock);

            setAnalysisStatus("Validazione Idea Anchor...");
            ideaAnchorLock = await runIdeaAnchorLock(apiKey, contentHierarchy, primaryPurposeLock, functionalRoleLock);

            // --- TRANSFORMATION_ENGINE (NEW LAYER) ---
            if (ideaAnchorLock && sensorCategory === 'A') {
               setAnalysisStatus("Esecuzione Transformation Engine (Attivazione Scena)...");
               const { runTransformationEngine } = await import('../services/gemini/analysis');
               transformationOutput = await runTransformationEngine(apiKey, coreIntentClassification, contentHierarchy, 'STATIC_IMAGE');
            }
          }
        } catch (hierarchyErr) {
          logger.warn("Content Hierarchy Reasoner or Purpose Lock Failed. Fallback to normal pipeline.", hierarchyErr);
        }

        setCurrentCall({ current: 4, total: 4 });
        setAnalysisStatus("Esecuzione Fabbrica di Produzione...");
        
        try {
          analysis = await runFinalViralAnalysis({
            promptText: getPromptText(prompt),
            promptPayload: prompt,
            selectedIdea,
            promptAnalysis,
            originalScript,
            generatedScript,
          }, apiKey, genre, modelTier, externalMarketData, undefined, step3Results, contentHierarchy, primaryPurposeLock, functionalRoleLock, ideaAnchorLock, coreIntentClassification, transformationOutput);
          if (externalMarketData && (!analysis || !analysis.externalMarketData)) {
            if (analysis) analysis.externalMarketData = externalMarketData;
            logger.info("[ProductionFlow] externalMarketData restored onto final analysis payload.");
          }
          
          // --- STATIC CONTENT ENFORCEMENT (ARC V2.2 - TRANSFORMATION AWARE) ---
          if (sensorCategory === 'A') {
            console.warn("[ARC] Static Content Detected (Category A) in ProductionFlow - Checking Transformation Engine Output");
            
            if (transformationOutput && transformationOutput.activationType === 'MICRO_REALISTIC') {
               logger.info("[ARC] STATIC ACTIVATED via Transformation Engine. Bypassing SCARTA decision.");
            } else {
               // Fallback a SCARTA se il Transformation Engine non ha saputo attivare la scena
               const staticDisclaimer = "No visual motion, no facial animation, no lip-sync, no performance inference.";
               const staticAnalysis = `[STATIC CONTENT ARC] ${staticDisclaimer} Contenuto culturalmente forte o nostalgico, ma visivamente statico. Non ci sono prove di performance video reale nei frame analizzati. Il formato statico impone un limite strutturale alla viralità video e alla ritenzione dello spettatore. Decisione: SCARTA (punto di interesse archivistico/estetico, non video dinamico).`;
               
               const titleHint = analysis.pubTitleIt || "Subject";
               const staticPrompt = `Still archival portrait frame of ${titleHint}. Focus on lighting, texture, and composition. No motion, no facial animation, no lip-sync. A pure cinematic freeze-frame.`;

               analysis.operationalDecision = "SCARTA";
               analysis.engineVerdict = "REPLACE";
               analysis.engineProductionWorthiness = "NO";
               analysis.viralScore = "3.0";
               analysis.neuroScore = "3.0";
               analysis.neuroHookRate = "2.0";
               analysis.neuroRetention = "limited by static format";
               analysis.neuroViralPotential = "capped by static format";

               // Sanitize Kit Hallucinations
               const cleanTitle = titleHint.replace(/singing|performing|playback|lip-sync|lipsync|moving|talking|parla|canta|muove/gi, "still");
               analysis.pubTitleIt = cleanTitle;
               analysis.pubTitleEn = cleanTitle;
               analysis.pubVideoHookIt = "Riconoscibilità iconica immediata, limite di formato: statico.";
               analysis.pubVideoHookEn = "Immediate iconic recognition, format limit: static.";
               analysis.pubDescriptionIt = "Asset statico ad uso editoriale/archivistico. Non è un video di performance.";
               analysis.pubDescriptionEn = "Static asset for editorial/archival use. Not a performance video.";
               
               analysis.analysis = staticAnalysis;
               analysis.neuroSpiegazioneIt = "Analisi limitata dal formato statico. Non è possibile validare performance dinamica. Selezionato per salvataggio formale come still image.";
               analysis.neuroSpiegazioneEn = "Analysis limited by static format. Dynamic performance cannot be validated. Selected for formal archival as still image.";
               
               analysis.aiPrompts = staticPrompt;
               analysis.promptSora15s = staticPrompt;
               analysis.promptSora12s = staticPrompt;
               analysis.promptKling = staticPrompt;
               analysis.promptVeo = staticPrompt;
               analysis.promptCover = staticPrompt;
               analysis.coverPrompt = staticPrompt;
            }
          }
          
          // Re-inject the gate result into the final payload so the UI doesn't crash if it expects them
          analysis.engineVerdict = sensorCategory === 'A' ? 'REPLACE' : gateResult.decision;
          analysis.engineConfidence = gateResult.confidence;
          analysis.engineProductionWorthiness = gateResult.productionWorthiness;
          
        } catch (err: any) {
          const errorMessage = err.message || String(err);
          const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
          if (shouldRetryWithSameTier(errorMessage)) {
            logger.warn("[ProductionFlow] Detected quota exhaustion, retrying once on the same tier to allow centralized key/model fallback...");
            await new Promise(r => setTimeout(r, 1500));
            analysis = await runFinalViralAnalysis({
              promptText: getPromptText(prompt),
              promptPayload: prompt,
              selectedIdea,
              promptAnalysis,
              originalScript,
              generatedScript,
            }, apiKey, genre, modelTier, externalMarketData, undefined, step3Results, contentHierarchy);
            if (externalMarketData && (!analysis || !analysis.externalMarketData)) {
              if (analysis) analysis.externalMarketData = externalMarketData;
              logger.info("[ProductionFlow] externalMarketData restored onto retry final analysis payload.");
            }
          } else {
            throw err;
          }
        }

        // Se l'analisi fallisce comunque nonostante i retry, almeno la object map sarà presente
        // perchè l'abbiamo aggiunta da runFinalViralAnalysis
        setFinalAnalysis(normalizeResultForUI(analysis));
        setExternalMarketData(externalMarketData || null);
        setStep('FINAL_ANALYSIS');
      } catch (err: any) {
        clearTimeout(safetyTimeout);
        console.error(err);
        const errorMessage = err.message || String(err);
        if (errorMessage.includes("WebSocket") || errorMessage.includes("closed")) {
          setError("Connessione interrotta durante l'analisi finale. Riprova.");
        } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
          setError("Hai esaurito i token gratuiti o raggiunto il limite di richieste. Attendi qualche minuto e riprova, oppure inserisci una chiave API a pagamento nelle impostazioni.");
        } else {
          setError(errorMessage || "Errore durante l'analisi finale.");
        }
      }
    } finally {
      clearTimeout(safetyTimeout);
      logApiBudgetReport('ProductionFlow.handleFinalAnalysis');
      isAnalyzingRef.current = false;
      setIsFinalAnalyzing(false);
    }
  };

  const parsePromptTags = (text: string) => {
    if (typeof text !== 'string') return [];
    
    const tags = [
      'viral_boost_analysis',
      'visual_prompt_15s',
      'visual_prompt_12s',
      'visual_prompt_10s',
      'visual_prompt_8s',
      'visual_prompt_6s',
      'prompt_kling'
    ];
    
    const results: { tag: string; label: string; content: string; color: string }[] = [];
    
    const getLabel = (tag: string) => {
      switch(tag) {
        case 'viral_boost_analysis': return 'Analisi Viral Boost';
        case 'visual_prompt_15s': return 'Prompt Visivo (15s)';
        case 'visual_prompt_12s': return 'Prompt Visivo (12s)';
        case 'visual_prompt_10s': return 'Prompt Visivo (10s)';
        case 'visual_prompt_8s': return 'Prompt Visivo (8s)';
        case 'visual_prompt_6s': return 'Prompt Visivo (6s)';
        case 'prompt_kling': return 'Prompt Kling (Specifico)';
        default: return tag;
      }
    };

    const getColor = (tag: string) => {
      if (tag.includes('analysis')) return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
      if (tag.includes('kling')) return 'text-purple-400 border-purple-500/30 bg-purple-500/5';
      return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
    };
    
    tags.forEach(tag => {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
      const match = regex.exec(text);
      if (match && match[1]) {
        results.push({ tag, label: getLabel(tag), content: match[1].trim(), color: getColor(tag) });
      }
    });
    
    return results;
  };

  const activePromptData = (step === 'FINAL_ANALYSIS' && finalAnalysis) ? finalAnalysis : prompt;

  useEffect(() => {
    if (activePromptData?.promptDecisionTrace) {
      logger.info("[PROMPT_DECISION_TRACE_UI_RENDERED]", {
        hasPromptDecisionTrace: true,
        promptQualityFinalPass: activePromptData?.promptQualityReport?.finalPass,
        lockedPromptTabsLocked: activePromptData?.lockedPromptTabs?.locked,
        reason: "Rendered independently of prompt final pass"
      });
    } else if (activePromptData) {
      logger.info("[PROMPT_DECISION_TRACE_UI_NOT_RENDERED]", { reason: "promptDecisionTrace is null or undefined" });
    }
  }, [activePromptData?.promptDecisionTrace]);

  useEffect(() => {
     if (step === 'FINAL_ANALYSIS') {
       logger.info("[PHASE2_PROMPT_UI_RENDER_AUDIT]", {
          finalPass: activePromptData?.promptQualityReport?.finalPass,
          locked: activePromptData?.lockedPromptTabs?.locked,
          hasAiPrompts: Boolean(activePromptData?.aiPrompts),
          hasSceneMasterPrompt: Boolean(activePromptData?.sceneMasterPrompt),
          hasBestOptimizedPrompt: Boolean(activePromptData?.bestOptimizedPrompt?.prompt),
          hasSora: Boolean(activePromptData?.soraPrompt12s || activePromptData?.promptSora12s),
          hasKling: Boolean(activePromptData?.klingPrompt10s || activePromptData?.klingPrompt),
          hasVeo: Boolean(activePromptData?.veo3Prompt8s || activePromptData?.veoPrompt),
          hasSeedance: Boolean(activePromptData?.seedancePrompt15s || activePromptData?.sendancePrompt15s),
          renderDecision: (activePromptData?.promptQualityReport?.finalPass && activePromptData?.lockedPromptTabs?.locked) ? "SHOW_PHASE2_PROMPTS" : "DO_NOT_FORCE_PHASE2_PROMPTS"
        });
     }
  }, [step, activePromptData]);

  const renderPromptTab = (label: string, content: string | undefined) => (
    content ? (
       <div key={label} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
         <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{label}</h4>
         <p className="text-sm text-zinc-300 font-mono italic">{content}</p>
         <CopyButton text={content} className="mt-2" />
       </div>
    ) : null
  );

  const promptSections = parsePromptTags(getPromptText(activePromptData));

  const PromptBlock = ({ title, value }: { title: string; value?: string }) => {
    if (!value || String(value).startsWith("NON_GENERATO")) return null;

    return (
      <div className="bg-black/30 border border-zinc-700 rounded-lg p-3">
        <div className="text-sm font-semibold text-zinc-200 mb-2">{title}</div>
        <textarea
          readOnly
          className="w-full min-h-[120px] bg-zinc-900 text-zinc-100 text-sm rounded-md p-3 border border-zinc-700"
          value={String(value)}
        />
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Production Flow</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => logger.downloadLogs()}
            className="px-4 py-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-sm transition-colors"
          >
            Scarica Log
          </button>
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Flow
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-800 rounded-full z-0"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 rounded-full z-0 transition-all duration-500"
          style={{ width: `${(['INPUT', 'ANALYSIS', 'IDEA_SELECTION', 'PROMPT_GENERATION', 'VIRAL_BOOST', 'FINAL_ANALYSIS'].indexOf(step) / 5) * 100}%` }}
        ></div>
        
        {['INPUT', 'IDEA_SELECTION', 'PROMPT_GENERATION', 'VIRAL_BOOST', 'FINAL_ANALYSIS'].map((s, i) => {
          const currentIndex = ['INPUT', 'ANALYSIS', 'IDEA_SELECTION', 'PROMPT_GENERATION', 'VIRAL_BOOST', 'FINAL_ANALYSIS'].indexOf(step);
          const itemIndex = ['INPUT', 'IDEA_SELECTION', 'PROMPT_GENERATION', 'VIRAL_BOOST', 'FINAL_ANALYSIS'].indexOf(s);
          // Map itemIndex to actual step index for comparison
          const actualItemIndex = s === 'INPUT' ? 0 : s === 'IDEA_SELECTION' ? 2 : s === 'PROMPT_GENERATION' ? 3 : s === 'VIRAL_BOOST' ? 4 : 5;
          
          const isActive = currentIndex >= actualItemIndex;
          const isCurrent = step === s || (step === 'ANALYSIS' && s === 'INPUT');
          
          return (
            <div key={s} className={`relative z-10 flex flex-col items-center gap-2 ${isActive ? 'text-emerald-400' : 'text-zinc-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isActive ? 'bg-zinc-900 border-emerald-500' : 'bg-zinc-900 border-zinc-700'} ${isCurrent ? 'shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}`}>
                {i + 1}
              </div>
              <span className="text-xs font-medium uppercase tracking-wider hidden sm:block">
                {s.replace('_', ' ')}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
          {error.includes("FFmpeg") && (
            <div className="flex gap-2 ml-8">
              <button
                onClick={() => {
                  setSkipFFmpeg(true);
                  setError(null);
                }}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg text-xs font-medium transition-colors border border-amber-500/30"
              >
                Disattiva FFmpeg (Usa Virtual Trim)
              </button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'INPUT' && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Film className="w-5 h-5 text-emerald-400" />
                    1. Input Video & Cut Selettivo
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsLowMemoryMode(!isLowMemoryMode)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        isLowMemoryMode 
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' 
                          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <Activity className={`w-3.5 h-3.5 ${isLowMemoryMode ? 'animate-pulse' : ''}`} />
                      {isLowMemoryMode ? 'MODALITÀ LOW MEMORY ATTIVA' : 'MODALITÀ STANDARD (PREDEFINITA)'}
                    </button>
                    {isLowMemoryMode && (
                      <div className="group relative">
                        <ShieldAlert className="w-4 h-4 text-amber-400 cursor-help" />
                        <div className="absolute right-0 top-6 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl text-[10px] text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                          Consigliata per Tablet o dispositivi con poca RAM. 
                          Riduce l'uso della memoria durante l'estrazione audio e frame, 
                          evitando crash dell'app. Trascrizione audio garantita.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              
              {!file ? (
                <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors bg-zinc-900/50">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => e.target.files && setFile(e.target.files[0])}
                    className="hidden"
                    id="video-upload-flow"
                  />
                  <label htmlFor="video-upload-flow" className="cursor-pointer flex flex-col items-center">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                      <Film className="w-8 h-8 text-emerald-400" />
                    </div>
                    <span className="text-lg font-medium text-white mb-2">Carica un video (Opzionale)</span>
                    <span className="text-sm text-zinc-400">MP4, MOV, WebM (Max 15MB)</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50">
                    <span className="text-sm text-zinc-300 truncate max-w-[200px] sm:max-w-md">{file.name}</span>
                    <button onClick={() => { setFile(null); setVideoRange(null); }} className="text-xs text-red-400 hover:text-red-300 px-3 py-1 bg-red-500/10 rounded-md">Rimuovi</button>
                  </div>
                  
                  <div className="bg-black/40 rounded-xl p-4 border border-zinc-800">
                    <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-emerald-400" />
                      Cut Selettivo (Opzionale)
                    </h3>
                    <VideoTrimmer 
                      src={videoSrc} 
                      onRangeChange={(start, end) => {
                        setVideoRange({start, end});
                        setIsVirtualTrimmed(false); // Reset if range changes
                      }} 
                    />

                    {videoRange && (
                      <div className="mt-4 space-y-3">
                        {!isVirtualTrimmed && !isTrimming && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                // Physical trim is handled inside handleGenerate/ProductionFlow logic
                                // But we can trigger it here if we want immediate feedback
                                // For now, we'll just let the user know that physical trim happens on start
                                // OR we can implement a handlePhysicalTrim here.
                                // Let's just offer the choice.
                              }}
                              className="hidden" // We'll keep it simple for now as physical trim is auto
                            />
                            <button
                              onClick={() => setIsVirtualTrimmed(true)}
                              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-zinc-700"
                            >
                              <Scissors className="w-4 h-4" />
                              Taglio Virtuale (Veloce)
                            </button>
                            <button
                              onClick={async () => {
                                setIsTrimming(true);
                                try {
                                  const trimmed = await trimVideo(file!, videoRange.start, videoRange.end, setTrimProgress);
                                  setFile(trimmed);
                                  setVideoRange(null);
                                  setIsVirtualTrimmed(false);
                                } catch (e) {
                                  console.error(e);
                                  setIsVirtualTrimmed(true);
                                } finally {
                                  setIsTrimming(false);
                                }
                              }}
                              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-zinc-700"
                            >
                              <Film className="w-4 h-4" />
                              Taglio Fisico (Lento)
                            </button>
                          </div>
                        )}

                        {(isVirtualTrimmed || isTrimming) && (
                          <div className={`w-full py-3 ${isTrimming ? 'bg-zinc-800/50' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'} rounded-xl font-bold flex items-center justify-center gap-2 transition-all border ${isVirtualTrimmed ? 'border-emerald-500/50' : 'border-zinc-700'}`}>
                            {isTrimming ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Taglio Fisico... {Math.round(trimProgress * 100)}%</span>
                              </div>
                            ) : (
                              <>
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="uppercase tracking-widest">TAGLIO VIRTUALE PRONTO</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {isVirtualTrimmed && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center"
                          >
                            <p className="text-[11px] text-emerald-400/80 leading-tight">
                              <b>OK!</b> Segmento bloccato.<br/>
                              L'analisi userà solo questa parte per risparmiare token.
                            </p>
                            <button 
                              onClick={() => setIsVirtualTrimmed(false)}
                              className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                            >
                              Annulla e riprova
                            </button>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  2. Obiettivo e Cast
                </h2>
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors text-sm font-medium border border-purple-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Smart Guide Wizard
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Qual è l'obiettivo del video?</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Es: Voglio mostrare come si prepara un caffè perfetto in modo ironico..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-h-[100px]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Chi è il cast / protagonista?</label>
                <input
                  type="text"
                  value={cast}
                  onChange={(e) => setCast(e.target.value)}
                  placeholder="Es: Un barista stressato, un gatto curioso..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            <button
              onClick={handleStartAnalysis}
              disabled={!goal.trim() || !cast.trim()}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Inizia Analisi Blue Ocean <ArrowRight className="w-5 h-5" />
            </button>
            
            {file && (
              <button
                onClick={() => handleForensicAnalysis(apiKey)}
                disabled={isAnalyzing}
                className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
                Analisi Forense
              </button>
            )}
          </motion.div>
        )}

        {step === 'ANALYSIS' && (
          <motion.div 
            key="analysis"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center space-y-6"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin"></div>
              <BrainCircuit className="w-10 h-10 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {isTrimming ? "Taglio del video in corso..." : (analysisStatus || "Analisi in corso...")}
              </h2>
              
              {currentCall && !isTrimming && (
                <div className="mb-6 flex flex-col items-center gap-3">
                  <div className="px-6 py-2 bg-emerald-500/20 border-2 border-emerald-500/50 rounded-2xl text-emerald-400 text-lg font-black tracking-widest animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    ANALISI {currentCall.current} di {currentCall.total}
                  </div>
                  <div className="flex gap-2">
                    {Array.from({ length: currentCall.total }).map((_, idx) => (
                      <div 
                        key={`call-progress-${idx}`} 
                        className={`h-1.5 rounded-full transition-all duration-700 ${
                          idx < currentCall.current 
                            ? 'w-8 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' 
                            : 'w-4 bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="text-zinc-400">
                {isTrimming 
                  ? (
                    <div className="flex flex-col items-center gap-4">
                      <p>
                        {trimProgress <= 0.01 
                          ? "Inizializzazione motore video (potrebbe richiedere qualche secondo)..." 
                          : `Elaborazione video: ${Math.round(trimProgress * 100)}%`}
                      </p>
                      <button
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse"
                      >
                        <Unlock className="w-5 h-5" />
                        Sblocca: Apri in nuova scheda
                      </button>

                      <button
                        onClick={() => {
                          setIsTrimming(false);
                          setIsAnalyzing(false);
                          isAnalyzingRef.current = false;
                          setError(null);
                        }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-tighter rounded-xl border border-red-500/20 transition-all flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Interrompi e Resetta
                      </button>
                      <p className="text-[10px] text-zinc-500 max-w-xs">
                        Se l'inizializzazione non avanza, clicca il pulsante sopra per aprire l'app fuori dall'iframe di sicurezza.
                      </p>
                    </div>
                  )
                  : (analysisProgress > 0 || isAnalyzing)
                    ? (
                      <div className="space-y-2">
                        <p>{analysisStatus || `Analisi forense in corso: ${analysisProgress}%`}</p>
                        {analysisProgress > 0 && <p className="text-xs text-zinc-500">Progressione totale: {analysisProgress}%</p>}
                      </div>
                    )
                    : "Sto cercando nicchie ad alta domanda e bassa offerta per il tuo contenuto..."}
              </div>
              
              {(analysisProgress > 0 || isAnalyzing) && (
                <div className="mt-8 space-y-4">
                  <div className="w-full max-w-xs mx-auto h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(analysisProgress, 5)}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                  <button
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-bold uppercase tracking-widest rounded-xl border border-emerald-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-5 h-5" />
                    Sblocca: Apri in nuova scheda
                  </button>
                  <p className="text-[10px] text-zinc-600 max-w-xs mx-auto italic">
                    Se l'analisi sembra bloccata (es. a 1/4), aprila in una nuova scheda per sbloccare i permessi del browser necessari al motore video.
                  </p>
                </div>
              )}
              
              {isTakingLong && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl max-w-sm mx-auto"
                >
                  <p className="text-sm text-orange-400 font-medium">L'analisi sta richiedendo più tempo del previsto.</p>
                  <p className="text-xs text-orange-500/80 mt-1">Il video potrebbe essere molto complesso o i server sono carichi. Attendi, non chiudere la pagina.</p>
                  
                  <button
                    onClick={() => {
                      setIsAnalyzing(false);
                      setIsTakingLong(false);
                      setError("Analisi interrotta manualmente dall'utente.");
                      isAnalyzingRef.current = false;
                      resetQuotaStatus();
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-orange-500/20"
                  >
                    <Unlock className="w-3 h-3" />
                    SBLOCCA ANALISI
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {step === 'IDEA_SELECTION' && (
          <motion.div 
            key="ideas"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex justify-start mb-4">
              <button
                onClick={() => setStep('INPUT')}
                className="w-full sm:w-auto px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Torna a Input
              </button>
            </div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Scegli la tua Nicchia</h2>
              <p className="text-zinc-400">Ho trovato queste opportunità "Blue Ocean" per il tuo video.</p>
              {detectedGenre && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Genere Rilevato: {detectedGenre}
                </div>
              )}
            </div>

            {ideaAnalysis && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
                <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5" />
                  Analisi Strategica (Step 1)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Core Viral Mechanic</h4>
                      <p className="text-sm text-zinc-300">{ideaAnalysis.coreViralMechanic}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Tipo di Curiosità</h4>
                      <p className="text-sm text-zinc-300">{ideaAnalysis.curiosityType}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Retention Point</h4>
                      <p className="text-sm text-zinc-300">{ideaAnalysis.expectedRetentionPoint}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Debolezze</h4>
                      <p className="text-sm text-zinc-300">{ideaAnalysis.ideaWeaknesses}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Rischio Banalità</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ideaAnalysis.banalityRisk === 'HIGH' ? 'bg-red-500/20 text-red-400' : 
                          ideaAnalysis.banalityRisk === 'MEDIUM' ? 'bg-orange-500/20 text-orange-400' : 
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {ideaAnalysis.banalityRisk}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Niche Viability</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ideaAnalysis.nicheViability === 'DEAD' ? 'bg-red-500/20 text-red-400' : 
                          ideaAnalysis.nicheViability === 'WEAK' ? 'bg-orange-500/20 text-orange-400' : 
                          ideaAnalysis.nicheViability === 'SATURATED' ? 'bg-amber-500/20 text-amber-400' : 
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {ideaAnalysis.nicheViability}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Perché questa viabilità?</h4>
                      <p className="text-xs text-zinc-400 italic">{ideaAnalysis.nicheViabilityReason}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Scegli lo Stile dell'Hook (Primi 2 Secondi)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { id: 'random', label: 'Sorprendimi (Random)', icon: '🎲' },
                  { id: 'macro-eye', label: 'Occhio del Ciclone', icon: '👁️' },
                  { id: 'action-crash', label: 'Impatto Improvviso', icon: '💥' },
                  { id: 'bizarre-object', label: 'Oggetto Assurdo', icon: '🛸' },
                  { id: 'pov-rush', label: 'POV Corsa Frenetica', icon: '🏃' },
                  { id: 'glitch-reveal', label: 'Glitch / Rivelazione', icon: '📺' },
                ].map(style => (
                  <button
                    key={style.id}
                    onClick={() => setHookStyle(style.id)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
                      hookStyle === style.id
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <span>{style.icon}</span>
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {niches.map((idea, idx) => (
                <div 
                  key={idea.id || `niche-${idx}`}
                  onClick={() => handleSelectIdea(idea)}
                  className={`bg-zinc-900/50 border ${idea.isRecommended ? 'border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]' : 'border-zinc-800 hover:border-emerald-500/50'} rounded-2xl p-6 cursor-pointer transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] group flex flex-col h-full relative overflow-hidden`}
                >
                  {idea.isRecommended && (
                    <div className="absolute top-0 left-0 right-0 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest py-1 text-center flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Recommended
                    </div>
                  )}
                  <div className={`mb-4 ${idea.isRecommended ? 'mt-4' : ''}`}>
                    <span className={`inline-block px-3 py-1 ${idea.isRecommended ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'} text-xs font-bold rounded-full uppercase tracking-wider mb-3`}>
                      {idea.niche}
                    </span>
                    {idea.isHighRiskHighReward && (
                      <span className="ml-2 inline-block px-3 py-1 bg-red-500/20 text-red-400 text-[10px] font-black rounded-full uppercase tracking-widest animate-pulse">
                        HIGH RISK / HIGH REWARD
                      </span>
                    )}
                    <h3 className={`text-xl font-bold text-white ${idea.isRecommended ? 'group-hover:text-amber-400' : 'group-hover:text-emerald-400'} transition-colors leading-tight`}>
                      {idea.title}
                    </h3>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Market Gap
                      </h4>
                      <p className="text-sm text-zinc-300">{idea.marketGap}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <BrainCircuit className="w-3 h-3" /> Trigger Psicologico
                      </h4>
                      <p className="text-sm text-zinc-300">{idea.psychologicalTrigger}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Rischio
                      </h4>
                      <p className="text-sm text-zinc-400">{idea.risk}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Film className="w-3 h-3" /> Sviluppo
                      </h4>
                      <p className="text-sm text-zinc-400">{idea.description}</p>
                    </div>
                    {idea.isRecommended && idea.recommendedReason && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mt-2">
                        <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Perché questa?</h4>
                        <p className="text-xs text-amber-400/80">{idea.recommendedReason}</p>
                      </div>
                    )}

                    {idea.scores && (
                      <div className="mt-4 pt-4 border-t border-zinc-800/50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Idea Scores</h4>
                          <span className={`text-sm font-black ${idea.isRecommended ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {idea.scores.finalScore.toFixed(1)}/10
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {[
                            { label: 'Clarity', value: idea.scores.immediateClarity },
                            { label: 'Scroll Stop', value: idea.scores.scrollStopPower },
                            { label: 'Escalation', value: idea.scores.escalationStrength },
                            { label: 'Human Moment', value: idea.scores.humanMoment },
                            { label: 'Loop', value: idea.scores.loopPotential },
                            { label: 'Shock', value: idea.scores.shockNovelty },
                          ].map(score => (
                            <div key={score.label} className="flex items-center justify-between">
                              <span className="text-[10px] text-zinc-500">{score.label}</span>
                              <span className="text-[10px] font-bold text-zinc-300">{score.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className={`mt-6 pt-4 border-t border-zinc-800/50 flex items-center justify-between ${idea.isRecommended ? 'text-amber-500' : 'text-emerald-500'} font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Seleziona Idea <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {(step === 'PROMPT_GENERATION' || step === 'VIRAL_BOOST' || step === 'FINAL_ANALYSIS') && (
          <motion.div 
            key="prompt"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {!isGeneratingPrompt && (
              <div className="flex justify-start mb-4">
                <button
                  onClick={() => {
                    if (step === 'PROMPT_GENERATION') setStep('IDEA_SELECTION');
                    else if (step === 'VIRAL_BOOST') setStep('PROMPT_GENERATION');
                    else if (step === 'FINAL_ANALYSIS') {
                      setStep('VIRAL_BOOST');
                      setFinalAnalysis(null);
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Torna Indietro
                </button>
              </div>
            )}
            {isGeneratingPrompt ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Generazione prompt video ottimizzato...</h2>
                  <p className="text-zinc-400">Sto analizzando l'idea e scrivendo un prompt iper-dettagliato ottimizzato per i modelli video AI di ultima generazione.</p>
                </div>
              </div>
            ) : (
              <>
                {promptAnalysis && (
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
                      <BrainCircuit className="w-5 h-5" />
                      Riflessione dell'IA (Self-Analysis)
                    </h3>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap italic leading-relaxed">
                      {promptAnalysis}
                    </p>
                  </div>
                )}

                {/* External Market Data Section */}
                {externalMarketData && externalMarketData.status !== 'ERROR' && (
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 mb-6 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50 group-hover:bg-blue-500 transition-colors" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <Search className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-blue-100 uppercase tracking-tight">Segnali di Mercato YouTube</h3>
                      </div>
                      <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                        externalMarketData.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {externalMarketData.status === 'SUCCESS' ? 'REAL DATA' : 'NO DATA MODE'}
                      </div>
                    </div>

                    {externalMarketData.status === 'SUCCESS' ? (
                      <div className="space-y-4">
                        <p className="text-sm text-zinc-400 leading-relaxed italic">
                          {externalMarketData.marketSummary}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {externalMarketData.comparableVideos.slice(0, 4).map((video, idx) => (
                            <a 
                              key={video.id || `market-video-${idx}`}
                              href={video.videoLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-xl hover:bg-zinc-800/50 transition-all group/item"
                            >
                              <div className="flex items-start gap-3">
                                {video.thumbnail ? (
                                  <img 
                                    src={video.thumbnail} 
                                    alt="" 
                                    className="w-16 h-10 object-cover rounded border border-zinc-700"
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      const svgPlaceholder = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="100%" height="100%" fill="#18181b"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#3f3f46" text-anchor="middle" dominant-baseline="middle">VIDEO</text></svg>')}`;
                                      if (target.src !== svgPlaceholder) {
                                        target.src = svgPlaceholder;
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-16 h-10 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center">
                                    <Film className="w-4 h-4 text-zinc-600" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-zinc-200 truncate group-hover/item:text-blue-400 transition-colors">
                                    {video.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                                    <span className="flex items-center gap-1">
                                      <Activity className="w-3 h-3" />
                                      {typeof video.views === 'number' ? video.views.toLocaleString() : video.views}
                                    </span>
                                    {video.publishDate && (
                                      <span className="flex items-center gap-1">
                                        • {(() => {
                                          const d = new Date(video.publishDate);
                                          if (isNaN(d.getTime())) return video.publishDate;
                                          return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-3">
                        <p className="text-xs text-amber-500/80 leading-relaxed italic">
                          <span className="font-bold uppercase mr-1">Attenzione:</span>
                          Nessun video comparabile trovato su YouTube per questa ricerca. L'analisi procederà in modalità strutturale senza validazione di mercato esterna.
                        </p>
                        {externalMarketData.searchQueries && externalMarketData.searchQueries.length > 0 && (
                          <div className="pt-2 border-t border-amber-500/10">
                            <p className="text-[10px] text-zinc-500 uppercase font-black mb-2 tracking-widest">Query di ricerca utilizzate:</p>
                            <div className="flex flex-wrap gap-2">
                              {externalMarketData.searchQueries.map((q, i) => (
                                <span key={`market-query-${i}`} className="px-2 py-1 bg-zinc-800 rounded text-[10px] text-zinc-400 border border-zinc-700">
                                  {q}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Analisi di Coscienza AI */}
                {activePromptData?.promptDecisionTrace && (
                    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 mb-6">
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Search className="w-5 h-5 text-blue-400" />
                        Esame di Coscienza AI
                      </h3>

                      {/* DIAGNOSTICA OCCHIO/ORECCHIO CARD */}
                      {(() => {
                        const trace = activePromptData.promptDecisionTrace;
                        const diag = (trace as any)?.eyeEarDiagnostics;
                        if (!diag) return null;

                        const isSuccess = diag.success;
                        const provider = diag.provider;
                        const qualityError = diag.qualityError;
                        const geminiError = diag.geminiError;
                        const fallbackError = diag.fallbackError;
                        const hasFileUri = diag.hasFileUri;
                        const videoDurationTested = diag.videoDurationTested;
                        const metrics = diag.qualityGateMetrics;

                        // Determina colore e stato finale:
                        // VERDE = OK pieno (provider gemini e successo reale)
                        // BLU/AZZURRO = OK ma fallback o modalità alternativa (provider openrouter_fallback con successo reale)
                        // ARANCIONE = Degradato / Attenzione / report parziale (successo false con qualità degradata)
                        // ROSSO = Errore / report non valido / quality gate fallito
                        let badgeBg = "bg-red-500/10 border-red-500/20 text-red-400";
                        let statusText = "NON VALIDO";
                        if (isSuccess) {
                          if (provider === "gemini") {
                            badgeBg = "bg-green-500/10 border-green-500/20 text-green-400";
                            statusText = "VALIDO (Pieno OK)";
                          } else if (provider === "openrouter_fallback") {
                            badgeBg = "bg-cyan-500/10 border-cyan-500/20 text-cyan-400";
                            statusText = "VALIDO (Fallback Alternativo)";
                          }
                        } else {
                          if (provider === "gemini_quality_fail" || provider === "openrouter_quality_fail") {
                            badgeBg = "bg-amber-500/10 border-amber-500/20 text-amber-500";
                            statusText = "DEGRADATO / ATTENZIONE (Report Parziale)";
                          } else {
                            badgeBg = "bg-red-500/10 border-red-500/20 text-red-500";
                            statusText = "NON VALIDO / QUALITY GATE FALLITO";
                          }
                        }

                        return (
                          <div className="border border-zinc-800 bg-zinc-950/70 rounded-xl p-5 mb-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                              <div>
                                <h4 className="font-extrabold text-[#00E5FF] tracking-wider uppercase text-xs mb-1">
                                  DIAGNOSTICA OCCHIO/ORECCHIO
                                </h4>
                                <p className="text-[10px] text-zinc-500 font-mono text-zinc-400">
                                  Verifica pipeline multimodale e quality gate obbligatorio
                                </p>
                              </div>
                              <span className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-full border ${badgeBg}`}>
                                STATO FINALE: {statusText}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-zinc-400">
                              <div className="space-y-2 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/80">
                                <h5 className="font-bold text-zinc-300 text-[10px] uppercase border-b border-zinc-800 pb-1.5 mb-2">
                                  PROVIDER & FLOW TELEMETRY
                                </h5>
                                <div>
                                  <span className="text-zinc-500">Provider Principale:</span>{" "}
                                  <span className="text-white font-bold">Gemini Multimodale</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500">Modello Tentato:</span>{" "}
                                  <span className="text-white">gemini-2.0-flash / gemini-1.5-pro</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500">UploadedFileUri Disponibile:</span>{" "}
                                  <span className={hasFileUri ? "text-green-400" : "text-amber-500"}>
                                    {hasFileUri ? "Sì (Direct MP4 Pass)" : "No (Dynamic Upload Fallback)"}
                                  </span>
                                </div>
                                <div className="pt-2 border-t border-zinc-800">
                                  <span className="text-zinc-500">Esito Gemini:</span>{" "}
                                  <span className={provider === "gemini" ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                                    {provider === "gemini" ? "OK (Passed Quality Gate)" : "FALLITO / DEGRADATO"}
                                  </span>
                                  {geminiError && (
                                    <div className="bg-red-950/30 text-red-400 p-1.5 rounded text-[10px] leading-relaxed mt-1 font-sans border border-red-900/30">
                                      Motivo Errore Gemini: {geminiError}
                                    </div>
                                  )}
                                </div>
                                <div className="pt-2 border-t border-zinc-800">
                                  <span className="text-zinc-500">Fallback Usato:</span>{" "}
                                  <span className={provider.startsWith("openrouter") ? "text-cyan-400 font-bold" : "text-zinc-500"}>
                                    {provider.startsWith("openrouter") ? "Sì (OpenRouter Vision - Google Gemini 2.0)" : "No (Gemini completato con successo)"}
                                  </span>
                                  {fallbackError && (
                                    <div className="bg-red-950/30 text-red-400 p-1.5 rounded text-[10px] leading-relaxed mt-1 font-sans border border-red-900/30">
                                      Motivo Fallimento Fallback: {fallbackError}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/80">
                                <h5 className="font-bold text-zinc-300 text-[10px] uppercase border-b border-zinc-800 pb-1.5 mb-2">
                                  RISCONTRO QUALITY GATE
                                </h5>
                                {metrics ? (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Copertura Video:</span>
                                      <span className={metrics.videoCoverageOk ? "text-green-400" : "text-red-400"}>
                                        {metrics.videoCoverageOk ? "OK" : "INSUFFICIENTE"} ({metrics.lastVideoEventTime}s / {videoDurationTested || "N/A"}s)
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Fotogrammi Analizzati:</span>
                                      <span className={metrics.frameTimestampsCount >= 10 ? "text-green-400" : "text-red-400"}>
                                        {metrics.frameTimestampsCount} ({metrics.frameTimestampsCount >= 10 ? "Minimo 10 OK" : "Richiesti almeno 10"})
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Osservati realmente:</span>
                                      <span className="text-white">
                                        {metrics.frameObservationsCount}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Fotogrammi non visti:</span>
                                      <span className={metrics.missingObservationFrames > 3 ? "text-red-400" : "text-zinc-400"}>
                                        {metrics.missingObservationFrames}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Copertura Audio:</span>
                                      <span className={metrics.audioCoverageOk ? "text-green-400" : "text-red-400"}>
                                        {metrics.audioCoverageOk ? "OK" : "INSUFFICIENTE"} ({metrics.lastAudioEventTime}s / {videoDurationTested || "N/A"}s)
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Segmenti Audio Rilevati:</span>
                                      <span className={metrics.audioSegmentsCount > 1 ? "text-green-400" : "text-red-400"}>
                                        {metrics.audioSegmentsCount} ({metrics.audioSegmentsCount > 1 ? "OK" : "Invalido <= 1"})
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Placeholder Generico:</span>
                                      <span className={metrics.hasPlaceholder ? "text-red-400" : "text-green-400"}>
                                        {metrics.hasPlaceholder ? "RILEVATO (Rifiutato)" : "NESSUNO (OK)"}
                                      </span>
                                    </div>

                                    {qualityError && (
                                      <div className="mt-2 bg-amber-950/30 text-amber-500 p-2 rounded text-[10px] leading-relaxed border border-amber-900/30 font-sans">
                                        Dettaglio Qualità Invalida: {qualityError}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-zinc-500 italic text-[10px]">Metrice del quality gate non disponibili per questa esecuzione.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const trace = activePromptData.promptDecisionTrace;
                        const castAudit = trace.castGroundingAudit || activePromptData.castGroundingAudit || {};
                        const syncAudit = trace.dialogueSyncAudit || activePromptData.dialogueSyncAudit || {};
                        const mechanismAudit = trace.sceneMechanismAudit || activePromptData.sceneMechanismAudit || {};
                        const seen = trace.seen || {};
                        const heard = trace.heard || {};
                        const inferred = trace.inferred || {};
                        const decision = trace.decision || {};
                        const risk = trace.risk || {};
                        const visibleSubjects = flattenUniqueStrings(seen.aggregatedVisibleSubjects || castAudit.canonicalCastList || activePromptData.canonicalCastList || []);
                        const visibleObjects = flattenUniqueStrings(seen.visibleObjects);
                        const visibleActions = flattenUniqueStrings(seen.visibleActions);
                        const dialogueTurns = Array.isArray(syncAudit.dialogueTurns) ? syncAudit.dialogueTurns : [];
                        const dialogueFrameAlignment = Array.isArray(syncAudit.dialogueFrameAlignment) ? syncAudit.dialogueFrameAlignment : [];
                        const mergedFrameTimeline = Array.isArray(syncAudit.mergedFrameTimeline) ? syncAudit.mergedFrameTimeline : [];
                        const audioSegmentsFallback = Array.isArray(activePromptData?.audioSegments) ? activePromptData.audioSegments : [];
                        const timedScriptRows = dialogueTurns.length > 0
                          ? dialogueTurns
                          : audioSegmentsFallback.map((segment: any, index: number) => ({
                              turnIndex: index,
                              line: segment?.text || "",
                              speakerLabelFromTranscript: null,
                              startTime: segment?.start,
                              endTime: segment?.end,
                              timingSource: "groq_whisper_segments_verbose_json",
                              confidence: "MEDIUM"
                            }));
                        logger.info("[CONSCIENCE_UI_RENDER_CHECK]", {
                          renderComponent: "ProductionFlow",
                          hasPromptDecisionTrace: !!activePromptData?.promptDecisionTrace,
                          hasDialogueSyncAudit: !!syncAudit && Object.keys(syncAudit).length > 0,
                          hasAudioSegments: Array.isArray(activePromptData?.audioSegments),
                          audioSegmentsCount: Array.isArray(activePromptData?.audioSegments) ? activePromptData.audioSegments.length : 0,
                          hasMergedFrameTimeline: mergedFrameTimeline.length > 0,
                          hasCastGroundingAudit: !!castAudit && Object.keys(castAudit).length > 0,
                          hasSceneMechanismAudit: !!mechanismAudit && Object.keys(mechanismAudit).length > 0
                        });

                        return (
                          <div className="space-y-4 text-xs text-zinc-300 mb-4">
                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                              <h4 className="font-bold text-white mb-3 border-b border-zinc-700 pb-2 uppercase tracking-wider">Cast Rilevato</h4>
                              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4">
                                <div>
                                  <ul className="space-y-1">
                                    {visibleSubjects.length > 0 ? visibleSubjects.map((subject) => (
                                      <li key={subject}>- {subject}</li>
                                    )) : <li className="text-zinc-500">Nessun soggetto rilevato</li>}
                                  </ul>
                                </div>
                                <div className="space-y-1">
                                  <p><span className="font-bold text-zinc-400">Confidence:</span> {activePromptData.castConfidence || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Fonte:</span> {castAudit.castSource || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Visual Cast Count:</span> {typeof castAudit.visualCastCount === 'number' ? castAudit.visualCastCount : (activePromptData.visualCastCount ?? "N/A")}</p>
                                  <p><span className="font-bold text-zinc-400">Detected Characters:</span> {castAudit.detectedCharactersCount ?? flattenUniqueStrings(activePromptData.detectedCharacters).length}</p>
                                  <p><span className="font-bold text-zinc-400">Subject Count dai Frame:</span> {castAudit.frameObservationSubjectsCount ?? visibleSubjects.length}</p>
                                  {castAudit.warning && <p className="text-amber-300 italic">{castAudit.warning}</p>}
                                </div>
                              </div>
                            </div>

                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                              <h4 className="font-bold text-white mb-3 border-b border-zinc-700 pb-2 uppercase tracking-wider">Esame di Coscienza — Base del Video</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p><span className="font-bold text-zinc-400">Transcript:</span> {heard.transcriptAvailable ? "Disponibile" : "Non disponibile"}</p>
                                  <p><span className="font-bold text-zinc-400">Audio Source:</span> {heard.audioSource || activePromptData.audioSource || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Final Line Heard:</span> {heard.finalLineHeard ? "Sì" : "No"}</p>
                                  <p><span className="font-bold text-zinc-400">Evidence Strength:</span> {heard.transcriptEvidenceStrength || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Turni Stimati:</span> {syncAudit.estimatedTurnCount ?? heard.estimatedTurnCount ?? 0}</p>
                                  <p><span className="font-bold text-zinc-400">Speaker labels presenti:</span> {syncAudit.transcriptHasSpeakerLabels ? "Sì" : "No"}</p>
                                </div>
                                <div className="space-y-1">
                                  <p><span className="font-bold text-zinc-400">Timestamp audio reali:</span> {syncAudit.hasRealAudioTimestamps ? "Sì" : "No"}</p>
                                  <p><span className="font-bold text-zinc-400">Timing Source:</span> {syncAudit.timingSource || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Vision Provider:</span> {seen.visionProviderReal || activePromptData.visionProvider || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Used Frames:</span> {seen.usedFramesReal ?? "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Timestamps:</span> {Array.isArray(seen.frameTimestampsReal) ? seen.frameTimestampsReal.join(", ") : (seen.frameTimestampsReal || "N/A")}</p>
                                  <p><span className="font-bold text-zinc-400">Timeline Source:</span> {syncAudit.frameTimelineSource || seen.frameTimelineSource || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Frame Observations:</span> {Array.isArray(seen.frameObservations) ? seen.frameObservations.length : (typeof seen.frameObservations === 'string' ? seen.frameObservations : 0)}</p>
                                  <p><span className="font-bold text-zinc-400">Final Frames Coverage:</span> {trace.finalFramesCoverage?.framesAfter46s ?? "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Visible Consequences:</span> {seen.visibleConsequences || "N/A"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Visible Subjects</p>
                                  <ul className="space-y-1">
                                    {visibleSubjects.length > 0 ? visibleSubjects.map((item) => <li key={`subject-${item}`}>- {item}</li>) : <li className="text-zinc-500">N/A</li>}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Visible Objects</p>
                                  <ul className="space-y-1">
                                    {visibleObjects.length > 0 ? visibleObjects.map((item) => <li key={`object-${item}`}>- {item}</li>) : <li className="text-zinc-500">N/A</li>}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Visible Actions</p>
                                  <ul className="space-y-1">
                                    {visibleActions.length > 0 ? visibleActions.map((item) => <li key={`action-${item}`}>- {item}</li>) : <li className="text-zinc-500">N/A</li>}
                                  </ul>
                                </div>
                              </div>
                              <div className="mt-4">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Script / Battute</p>
                                <div className="space-y-2 max-h-56 overflow-y-auto">
                                  {timedScriptRows.length > 0 ? timedScriptRows.map((turn: any, index: number) => (
                                    <div key={`dialogue-turn-${index}`} className="border border-zinc-700/50 rounded p-2 bg-zinc-900/40">
                                      <p><span className="font-bold text-zinc-400">Speaker transcript:</span> {turn?.speakerLabelFromTranscript || "assente"}</p>
                                      <p><span className="font-bold text-zinc-400">Linea:</span> "{turn?.line || ""}"</p>
                                      <p><span className="font-bold text-zinc-400">Tempo:</span> {turn?.startTime ?? "N/A"}s {turn?.endTime !== null && turn?.endTime !== undefined ? `→ ${turn.endTime}s` : ""}</p>
                                      <p><span className="font-bold text-zinc-400">Timing Source:</span> {turn?.timingSource || "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Confidence:</span> {turn?.confidence || "LOW"}</p>
                                    </div>
                                  )) : <p className="text-zinc-500">Nessuna suddivisione battute disponibile.</p>}
                                </div>
                              </div>
                              <div className="mt-4">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Timeline Frame Video</p>
                                <div className="space-y-2 max-h-56 overflow-y-auto">
                                  {mergedFrameTimeline.length > 0 ? mergedFrameTimeline.map((frame: any) => (
                                    <div key={`merged-frame-${frame.frameIndex}`} className="border border-zinc-700/50 rounded p-2 bg-zinc-900/40">
                                      <p><span className="font-bold text-zinc-400">Frame {frame.frameIndex}</span> — {frame.timestamp}</p>
                                      <p><span className="font-bold text-zinc-400">Observed:</span> {frame.observed ? "sì" : "no"}</p>
                                      <p><span className="font-bold text-zinc-400">Soggetti:</span> {frame.visibleSubjects?.length ? frame.visibleSubjects.join(", ") : "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Azione:</span> {frame.visibleAction || "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Confidence:</span> {frame.confidence || "NONE"}</p>
                                      <p><span className="font-bold text-zinc-400">Battute vicine:</span> {Array.isArray(frame?.nearbyAudioSegments) && frame.nearbyAudioSegments.length > 0 ? frame.nearbyAudioSegments.map((segment: any) => `[${segment.start ?? "N/A"}-${segment.end ?? "N/A"}] ${segment.text || ""}`).join(" | ") : "N/A"}</p>
                                      {frame.warning && <p className="text-amber-300 italic">{frame.warning}</p>}
                                    </div>
                                  )) : <p className="text-zinc-500">Timeline frame non disponibile.</p>}
                                </div>
                              </div>
                              <div className="mt-4">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Sincronizzazione Battute-Frame</p>
                                <div className="space-y-2 max-h-56 overflow-y-auto">
                                  {dialogueFrameAlignment.length > 0 ? dialogueFrameAlignment.map((entry: any, index: number) => (
                                    <div key={`dialogue-frame-${index}`} className="border border-zinc-700/50 rounded p-2 bg-zinc-900/40">
                                      <p><span className="font-bold text-zinc-400">Linea:</span> "{entry?.line || ""}"</p>
                                      <p><span className="font-bold text-zinc-400">Audio start/mid/end:</span> {entry?.startTime ?? "N/A"}s / {entry?.midTime ?? "N/A"}s / {entry?.endTime ?? "N/A"}s</p>
                                      <p><span className="font-bold text-zinc-400">Strategia frame:</span> {entry?.selectedFrameStrategy || "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Frame selezionato:</span> {entry?.selectedFrameTimestamp || "N/A"} {entry?.selectedFrameIndex !== null && entry?.selectedFrameIndex !== undefined ? `(index ${entry.selectedFrameIndex})` : ""}</p>
                                      <p><span className="font-bold text-zinc-400">Vicino per start:</span> {entry?.nearestFrameByStart?.timestamp || "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Vicino per mid:</span> {entry?.nearestFrameByMid?.timestamp || "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Vicino per end:</span> {entry?.nearestFrameByEnd?.timestamp || "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Delta:</span> {entry?.timeDeltaSeconds ?? "N/A"}s</p>
                                      <p><span className="font-bold text-zinc-400">Soggetti visibili:</span> {Array.isArray(entry?.visibleSubjectsInSelectedFrame) && entry.visibleSubjectsInSelectedFrame.length > 0 ? entry.visibleSubjectsInSelectedFrame.join(", ") : "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Azioni visibili:</span> {Array.isArray(entry?.visibleActionsInSelectedFrame) && entry.visibleActionsInSelectedFrame.length > 0 ? entry.visibleActionsInSelectedFrame.join(", ") : "N/A"}</p>
                                      <p><span className="font-bold text-zinc-400">Possible Speaker:</span> {entry?.possibleSpeakerFromFrame || "unknown"}</p>
                                      <p><span className="font-bold text-zinc-400">Confidence:</span> {entry?.assignmentConfidence || "LOW"}</p>
                                      <p><span className="font-bold text-zinc-400">Reason:</span> {entry?.assignmentReason || "N/A"}</p>
                                      {entry?.warning && <p className="text-amber-300 italic">{entry.warning}</p>}
                                    </div>
                                  )) : <p className="text-zinc-500">Nessun allineamento battute-frame disponibile.</p>}
                                </div>
                              </div>
                            </div>

                            <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                              <h4 className="font-bold text-white mb-3 border-b border-zinc-700 pb-2 uppercase tracking-wider">Esame di Coscienza — Ragionamento Fatto</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p><span className="font-bold text-zinc-400">A/V Relation:</span> {inferred.audioVideoRelation || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Scene Rule:</span> {inferred.inferredSceneRule || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Trigger:</span> {String(inferred.inferredTrigger || "N/A")}</p>
                                  <p><span className="font-bold text-zinc-400">Consequence:</span> {String(inferred.inferredConsequence || "N/A")}</p>
                                  <p><span className="font-bold text-zinc-400">Confidence:</span> {inferred.inferenceConfidence || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                  <p>- Speaker delle battute non confermato: {syncAudit.canAssignSpeakers ? "No" : "Sì"}</p>
                                  <p>- Payoff finale non confermato: {mechanismAudit.payoffConfirmed === true ? "No" : "Sì"}</p>
                                  <p>- Conseguenza visiva non confermata: {mechanismAudit.visualConsequenceConfirmed === true ? "No" : "Sì"}</p>
                                  <p>- Battute allineate a frame specifici: {syncAudit.hasFrameTimeAlignment ? "Sì" : "No"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div className="space-y-1">
                                  <p><span className="font-bold text-zinc-400">Selected Beat:</span> {decision.selectedBeat || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Selected Character:</span> {decision.selectedCharacter || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Why Selected:</span> {decision.whySelected || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Why Final Payoff Not Selected:</span> {decision.whyFinalPayoffNotSelected || "N/A"}</p>
                                </div>
                                <div className={`p-3 rounded border ${risk.riskLevel === 'LOW' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                  <p className="font-bold uppercase tracking-wider text-[10px] mb-1">Rischio ({risk.riskLevel || "UNKNOWN"})</p>
                                  <p>{risk.possibleError || "Nessuno"}</p>
                                  <p className="mt-1"><span className="font-bold text-zinc-400">Can Assign Speakers:</span> {syncAudit.canAssignSpeakers ? "sì" : "no"}</p>
                                  <p><span className="font-bold text-zinc-400">Dialogue Sync Confidence:</span> {syncAudit.confidence || risk.dialogueSyncConfidence || "NONE"}</p>
                                  <p className="mt-2 text-zinc-400 italic">Raccomandazione: {risk.recommendation || "N/A"}</p>
                                </div>
                              </div>
                              <div className="mt-4 border border-zinc-700/50 rounded p-3 bg-zinc-900/40">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Meccanismo scena</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <p><span className="font-bold text-zinc-400">Rule Detected:</span> {mechanismAudit.ruleDetectedFromTranscript ? "Sì" : "No"}</p>
                                  <p><span className="font-bold text-zinc-400">Rule Line:</span> {mechanismAudit.ruleLine || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Trigger Condition:</span> {mechanismAudit.triggerCondition || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Expected Consequence:</span> {mechanismAudit.expectedConsequence || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Visual Consequence Confirmed:</span> {String(mechanismAudit.visualConsequenceConfirmed ?? "unknown")}</p>
                                  <p><span className="font-bold text-zinc-400">Payoff Candidate:</span> {mechanismAudit.payoffCandidate || "N/A"}</p>
                                  <p><span className="font-bold text-zinc-400">Payoff Confirmed:</span> {String(mechanismAudit.payoffConfirmed ?? "unknown")}</p>
                                  <p><span className="font-bold text-zinc-400">Confidence:</span> {mechanismAudit.confidence || "N/A"}</p>
                                </div>
                                {Array.isArray(mechanismAudit.missingLinks) && mechanismAudit.missingLinks.length > 0 && (
                                  <div className="mt-3">
                                    <ul className="space-y-1">
                                      {mechanismAudit.missingLinks.map((item: string) => <li key={item}>- {item}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-300">
                        {/* HO SENTITO */}
                        <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                          <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">1. Ho Sentito (Heard)</h4>
                          <ul className="space-y-1">
                             <li><span className="font-bold text-zinc-400">Transcript:</span> {activePromptData.promptDecisionTrace.heard?.transcriptAvailable ? "Disponibile" : "Non disponibile"}</li>
                             <li><span className="font-bold text-zinc-400">Audio Source:</span> {activePromptData.promptDecisionTrace.heard?.audioSource || "N/A"}</li>
                             <li><span className="font-bold text-zinc-400">Rule Line:</span> {activePromptData.promptDecisionTrace.heard?.ruleLineHeard || "Unknown"}</li>
                             <li><span className="font-bold text-zinc-400">Final Line:</span> {activePromptData.promptDecisionTrace.heard?.finalLineHeard ? "Sì" : "No"}</li>
                             <li><span className="font-bold text-zinc-400">Evidence Strength:</span> {activePromptData.promptDecisionTrace.heard?.transcriptEvidenceStrength || "N/A"}</li>
                          </ul>
                        </div>

                        {/* HO VISTO */}
                        <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                          <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">2. Ho Visto (Seen)</h4>
                          <ul className="space-y-1">
                             <li><span className="font-bold text-zinc-400">Frame Observations:</span> {typeof activePromptData.promptDecisionTrace.seen?.frameObservations === 'string' ? activePromptData.promptDecisionTrace.seen.frameObservations : "Disponibili per frame"}</li>
                             <li><span className="font-bold text-zinc-400">Used Frames:</span> {activePromptData.promptDecisionTrace.seen?.usedFramesReal ?? "N/A"}</li>
                             <li><span className="font-bold text-zinc-400">Visible Consequences:</span> {activePromptData.promptDecisionTrace.seen?.visibleConsequences || "Unconfirmed"}</li>
                             <li><span className="font-bold text-zinc-400">Payoff Confirmed:</span> {activePromptData.promptDecisionTrace.seen?.visualPayoffConfirmed ? "Sì" : "No"}</li>
                             <li><span className="font-bold text-zinc-400">Evidence Strength:</span> <span className={activePromptData.promptDecisionTrace.seen?.visionEvidenceStrength === 'STRONG' ? 'text-emerald-400' : 'text-red-400'}>{activePromptData.promptDecisionTrace.seen?.visionEvidenceStrength || "N/A"}</span></li>
                          </ul>
                        </div>

                        {/* HO DEDOTTO */}
                        <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                          <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">3. Ho Dedotto (Inferred)</h4>
                          <ul className="space-y-1">
                            <li><span className="font-bold text-zinc-400">A/V Relation:</span> {activePromptData.promptDecisionTrace.inferred?.audioVideoRelation || "N/A"}</li>
                            <li><span className="font-bold text-zinc-400">Consequence:</span> {activePromptData.promptDecisionTrace.inferred?.inferredConsequence ? "Trovata" : "Non trovata"}</li>
                            <li><span className="font-bold text-zinc-400">Strongest Beat:</span> {activePromptData.promptDecisionTrace.inferred?.inferredStrongestBeat || "N/A"}</li>
                            <li><span className="font-bold text-zinc-400">Confidence:</span> <span className={activePromptData.promptDecisionTrace.inferred?.inferenceConfidence === 'HIGH' ? 'text-emerald-400' : 'text-amber-400'}>{activePromptData.promptDecisionTrace.inferred?.inferenceConfidence || "N/A"}</span></li>
                            {activePromptData.promptDecisionTrace.inferred?.notes && <li className="italic text-zinc-500 mt-2">{activePromptData.promptDecisionTrace.inferred.notes}</li>}
                          </ul>
                        </div>

                        {/* SCELTA E RISCHIO */}
                        <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                          <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">4. Scelta & Rischio</h4>
                          <ul className="space-y-1 mb-2">
                             <li><span className="font-bold text-zinc-400">Selected Beat:</span> {activePromptData.promptDecisionTrace.decision?.selectedBeat || "N/A"}</li>
                             <li><span className="font-bold text-zinc-400">Why Selected:</span> {activePromptData.promptDecisionTrace.decision?.whySelected || "N/A"}</li>
                             <li><span className="font-bold text-zinc-400">Why Payoff Not Selected:</span> {activePromptData.promptDecisionTrace.decision?.whyFinalPayoffNotSelected || "N/A"}</li>
                          </ul>
                          <div className={`p-2 rounded mt-2 border ${activePromptData.promptDecisionTrace.risk?.riskLevel === 'LOW' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                             <span className="font-bold block mb-1 uppercase tracking-wider text-[10px]">Rischio Identificato ({activePromptData.promptDecisionTrace.risk?.riskLevel || "UNKNOWN"}):</span> 
                             {activePromptData.promptDecisionTrace.risk?.possibleError || "Nessuno"}
                             <p className="mt-1 text-[10px] text-zinc-400 italic">Raccomandazione: {activePromptData.promptDecisionTrace.risk?.recommendation || "N/A"}</p>
                          </div>
                        </div>

                      </div>
                    </div>
                )}

                {/* Prompts Fase 2 Falliti */}
                {(!activePromptData?.promptQualityReport?.finalPass && activePromptData?.operationalDecision === "PROMPT_ENGINE_FAILED") && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 mb-6">
                    <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Validazione Prompt Fallita
                    </h3>
                    <p className="text-sm text-red-200 mb-2">I prompt non hanno superato i controlli di qualità tecnici e non sono stati generati.</p>
                    <div className="bg-red-950/50 p-4 rounded text-xs text-red-300 font-mono border border-red-900/50">
                       Log di validazione: {activePromptData?.promptQualityReport?.report || "Generic template found"}
                    </div>
                  </div>
                )}

                {activePromptData?.operationalDecision === "BLOCKED_DIALOGUE_SYNC_LOW_CONFIDENCE" && (
                  <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-6 mb-6">
                    <h3 className="text-xl font-bold text-amber-300 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      PROMPT NON GENERATI — SYNC DIALOGHI DEBOLE
                    </h3>
                    <p className="text-sm text-amber-100 mb-2">Il sistema ha rilevato audio e video, ma non può attribuire le battute ai personaggi con sufficiente affidabilità.</p>
                    <p className="text-xs text-amber-200">Motivo blocco: {activePromptData?.lockedPromptTabs?.reason || "DIALOGUE_SYNC_LOW_CONFIDENCE"}</p>
                    <p className="text-xs text-amber-200">Confidence: {activePromptData?.dialogueSyncAudit?.confidence || activePromptData?.promptDecisionTrace?.risk?.dialogueSyncConfidence || "NONE"}</p>
                    <p className="text-xs text-amber-200">Recommendation: {activePromptData?.promptDecisionTrace?.risk?.recommendation || "Controlla il riquadro Esame di Coscienza."}</p>
                  </div>
                )}

                {/* Visualizzazione Prompts Fase 2 */}
                {(activePromptData?.promptQualityReport?.finalPass && activePromptData?.lockedPromptTabs?.locked) && (
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 mb-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                       <Zap className="w-5 h-5 text-emerald-400" />
                       Prompts Ottimizzati (Fase 2)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {renderPromptTab("Miglior Prompt", activePromptData.bestOptimizedPrompt?.prompt || activePromptData.optimizedPrompt15s || activePromptData.aiPrompts)}
                       {renderPromptTab("Scene Master", activePromptData.sceneMasterPrompt)}
                       {renderPromptTab("Sora", activePromptData.soraPrompt12s || activePromptData.promptSora12s)}
                       {renderPromptTab("Kling", activePromptData.klingPrompt10s || activePromptData.klingPrompt)}
                       {renderPromptTab("Veo", activePromptData.veo3Prompt8s || activePromptData.veoPrompt)}
                       {renderPromptTab("Seedance", activePromptData.seedancePrompt15s || activePromptData.sendancePrompt15s)}
                    </div>
                  </div>
                )}

                {/* Sezione Script (Originale e Generato) */}
                {(originalScript || generatedScript) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {originalScript && (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                            <Film className="w-4 h-4" /> Script Completo (Originale)
                          </h3>
                          <CopyButton text={originalScript} />
                        </div>
                        <div className="p-6 bg-zinc-950/50 max-h-96 overflow-y-auto">
                          <p className="text-zinc-300 text-sm font-mono whitespace-pre-wrap leading-relaxed">
                            {originalScript}
                          </p>
                        </div>
                      </div>
                    )}
                    {generatedScript && (
                      <div className="bg-zinc-900/50 border border-emerald-500/10 rounded-2xl overflow-hidden">
                        <div className="bg-emerald-500/5 px-6 py-4 border-b border-emerald-500/10 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <Zap className="w-4 h-4" /> Script Generato (Ottimizzato)
                          </h3>
                          <CopyButton text={generatedScript} />
                        </div>
                        <div className="p-6 bg-zinc-950/50 max-h-96 overflow-y-auto">
                          {(() => {
                            try {
                              const parsed = safeParseJSON(generatedScript);
                              if (Array.isArray(parsed)) {
                                return (
                                  <div className="space-y-4">
                                    {parsed.map((item: any, i: number) => (
                                      <div key={`script-fase-${i}`} className="border-l-2 border-emerald-500/30 pl-4 py-1">
                                        <span className="text-emerald-400 font-bold text-xs block mb-1">{item.fase}</span>
                                        <p className="text-zinc-300 text-sm">{item.azione}</p>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                            } catch (e) {}
                            return <p className="text-zinc-300 text-sm font-mono whitespace-pre-wrap">{generatedScript}</p>;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="bg-zinc-800/50 px-4 sm:px-6 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        Prompt video ottimizzato
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <CopyButton text={getPromptText(prompt) || JSON.stringify(prompt, null, 2)} />
                        {step === 'PROMPT_GENERATION' && (
                          <>
                            <button
                              onClick={handleSora2Optimize}
                              disabled={isOptimizing || isBoosting}
                              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 whitespace-nowrap"
                            >
                              {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              Ottimizza prompt
                            </button>
                            <button
                              onClick={handleViralBoost}
                              disabled={isBoosting || isOptimizing}
                              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)] active:scale-95 whitespace-nowrap"
                            >
                              {isBoosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                              Viral Boost
                            </button>
                          </>
                        )}
                      </div>
                  </div>
                  <div className="p-4 sm:p-6 space-y-6">
                    {promptSections.length > 0 ? (
                      <div className="space-y-6">
                        {promptSections.map((section, idx) => (
                          <motion.div 
                            key={section.tag}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`rounded-xl border ${section.color} overflow-hidden shadow-lg`}
                          >
                            <div className="px-4 py-2 border-b border-inherit flex items-center justify-between bg-black/40">
                              <span className="text-xs font-black uppercase tracking-[0.2em]">{section.label}</span>
                              <CopyButton text={section.content} />
                            </div>
                            <div className="p-4 bg-zinc-950/80">
                              <p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                                {section.content}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                        
                        <div className="pt-4 border-t border-zinc-800">
                          <details className="group">
                            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors flex items-center gap-2 select-none">
                              <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center group-open:rotate-180 transition-transform">
                                <ArrowRight className="w-2 h-2 rotate-90" />
                              </div>
                              Visualizza Prompt Grezzo (Editabile)
                            </summary>
                            <div className="mt-4">
                              <textarea
                                value={typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2)}
                                onChange={(e) => {
                                  try {
                                    setPrompt(JSON.parse(e.target.value));
                                  } catch {
                                    setPrompt(e.target.value);
                                  }
                                }}
                                className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                              />
                            </div>
                          </details>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        value={typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2)}
                        onChange={(e) => {
                          try {
                            setPrompt(JSON.parse(e.target.value));
                          } catch {
                            setPrompt(e.target.value);
                          }
                        }}
                        className="w-full h-96 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    )}
                  </div>
                </div>

                {step === 'VIRAL_BOOST' && !isFinalAnalyzing && !finalAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center"
                  >
                    <button
                      onClick={handleFinalAnalysis}
                      className="w-full sm:w-auto px-8 py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] flex items-center justify-center gap-2 text-lg"
                    >
                      <BrainCircuit className="w-6 h-6" />
                      Analisi Virale Definitiva
                    </button>
                  </motion.div>
                )}

                {isFinalAnalyzing && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-zinc-400">Esecuzione analisi virale definitiva...</p>
                  </div>
                )}

                {finalAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Inserimento Sezione Prompt Fase 2 */}
                  </motion.div>
                )}
                
                {/* Debug box removed to fix TS errors and as requested by user */}

                {finalAnalysis && (
                  <motion.div>
                    {/* ... (rest of the code) ... */}
                    {coreIntentClassification && (
                      <div className={`p-6 border-2 rounded-2xl relative overflow-hidden transition-all duration-700 ${
                        coreIntentDrift ? 'bg-red-500/10 border-red-500/40 shadow-lg shadow-red-500/20 animate-in fade-in slide-in-from-top-4' : 'bg-amber-500/5 border-amber-500/20'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${coreIntentDrift ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                              <BrainCircuit className={`w-6 h-6 ${coreIntentDrift ? 'text-red-400' : 'text-amber-400'}`} />
                            </div>
                            <div>
                              <h3 className={`text-xl font-black uppercase tracking-tighter ${coreIntentDrift ? 'text-red-100' : 'text-amber-100'}`}>
                                Core Intent Classifier
                              </h3>
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Pre-Hierarchy Layer 1.1</p>
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest border ${
                            coreIntentDrift ? 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                            {coreIntentDrift ? 'DRIFT DETECTED' : 'INTENT LOCKED'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div className="space-y-4">
                            <div>
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Intent Class</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-2xl font-black italic tracking-tighter ${coreIntentDrift ? 'text-red-400' : 'text-amber-400'}`}>
                                  {coreIntentClassification.coreIntent}
                                </span>
                                <div className="h-4 w-px bg-zinc-800" />
                                <span className="text-xs font-bold text-zinc-400">Priorità: {coreIntentClassification.priorityRules}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Razionale Decisionale</span>
                              <p className="text-sm text-zinc-300 leading-relaxed italic">"{coreIntentClassification.reasoning}"</p>
                            </div>
                          </div>
                          
                          {coreIntentDrift && (
                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-4 animate-pulse">
                              <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
                              <div>
                                <h4 className="text-sm font-black text-red-400 uppercase tracking-tight mb-1">CORE_INTENT_DRIFT VIOLATION</h4>
                                <p className="text-xs text-red-200/70 leading-relaxed">
                                  Il sistema ha rilevato che l'output generato ha perso il focus sull'intento primario ({coreIntentClassification.coreIntent}). La struttura è stata deviata verso elementi secondari o decorativi.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <Rocket className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Analisi Virale Definitiva</h2>
                        <p className="text-indigo-200/60 text-sm">Valutazione spietata del potenziale virale</p>
                      </div>
                      <div className="ml-auto">
                        <CopyButton 
                          className="!bg-indigo-500/20 !border-indigo-500/30 !text-indigo-300"
                          text={`
ANALISI VIRALE DEFINITIVA
-------------------------
VIRAL SCORE: ${finalAnalysis.viralScore}
RETENTION PROBABILITY: ${finalAnalysis.retentionProbability}
PREDICTED VIEWS: ${finalAnalysis.predictedViews}

CORE IDEA: ${finalAnalysis.ideaCore}
DNA STATUS: ${finalAnalysis.dnaStatus}

HOOK (0-1.2s): ${finalAnalysis.analysisHook}
RETENTION: ${finalAnalysis.analysisRetention}
ESCALATION: ${finalAnalysis.analysisEscalation}
PAYOFF: ${finalAnalysis.analysisPayoff}
LOOP: ${finalAnalysis.analysisLoop}

RETENTION DROPS: ${finalAnalysis.retentionDrops}
                          `.trim()} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-zinc-900/50 border border-emerald-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center emerald-glow">
                        <span className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Viral Score</span>
                        <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                          {finalAnalysis.viralScore}
                        </div>
                      </div>
                      <div className="bg-zinc-900/50 border border-orange-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                        <span className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Retention Prob.</span>
                        <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                          {finalAnalysis.retentionProbability}
                        </div>
                      </div>
                      <div className="bg-zinc-900/50 border border-purple-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center purple-glow">
                        <span className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Predicted Views</span>
                        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                          {finalAnalysis.predictedViews}
                        </div>
                      </div>
                    </div>

                    {finalAnalysis.ideaCore && (
                      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Zap className="w-4 h-4" /> Idea Core (Replicabile)
                        </h3>
                        <p className="text-white text-lg font-medium leading-relaxed italic">
                          "{finalAnalysis.ideaCore}"
                        </p>
                      </div>
                    )}

                    {finalAnalysis.retentionDrops && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Retention Drops & Boredom Points
                        </h3>
                        <p className="text-zinc-300 text-sm leading-relaxed">
                          {finalAnalysis.retentionDrops}
                        </p>
                      </div>
                    )}

                    {finalAnalysis.dnaStatus && (
                      <div className={`border rounded-xl p-6 ${
                        finalAnalysis.dnaStatus === 'DNA PRESERVED' ? 'bg-emerald-500/10 border-emerald-500/30' :
                        finalAnalysis.dnaStatus === 'DNA MODIFIED' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        'bg-red-500/10 border-red-500/30'
                      }`}>
                        <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${
                          finalAnalysis.dnaStatus === 'DNA PRESERVED' ? 'text-emerald-400' :
                          finalAnalysis.dnaStatus === 'DNA MODIFIED' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          <Zap className="w-4 h-4" /> DNA Validation: {finalAnalysis.dnaStatus}
                        </h3>
                        {finalAnalysis.dnaReasoning && (
                          <p className={`text-sm leading-relaxed ${
                            finalAnalysis.dnaStatus === 'DNA PRESERVED' ? 'text-emerald-200' :
                            finalAnalysis.dnaStatus === 'DNA MODIFIED' ? 'text-yellow-200' :
                            'text-red-200'
                          }`}>
                            {finalAnalysis.dnaReasoning}
                          </p>
                        )}
                      </div>
                    )}

                    {(finalAnalysis.analysisHook || finalAnalysis.analysisRetention || finalAnalysis.analysisEscalation || finalAnalysis.analysisPayoff || finalAnalysis.analysisLoop) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                          { label: 'Hook (0-1.2s)', value: finalAnalysis.analysisHook, color: 'emerald' },
                          { label: 'Retention', value: finalAnalysis.analysisRetention, color: 'blue' },
                          { label: 'Escalation', value: finalAnalysis.analysisEscalation, color: 'orange' },
                          { label: 'Payoff', value: finalAnalysis.analysisPayoff, color: 'purple' },
                          { label: 'Loop', value: finalAnalysis.analysisLoop, color: 'pink' }
                        ].map((item, idx) => item.value ? (
                          <div key={idx} className={`bg-zinc-900/50 border border-${item.color}-500/20 rounded-xl p-4`}>
                            <span className={`text-[10px] font-bold text-${item.color}-400 uppercase tracking-widest mb-2 block`}>
                              {item.label}
                            </span>
                            <p className="text-zinc-300 text-xs leading-relaxed line-clamp-4">
                              {item.value}
                            </p>
                          </div>
                        ) : null)}
                      </div>
                    )}

                    {finalAnalysis.dopamineMap && finalAnalysis.dopamineMap.length > 0 && (
                      <div className="bg-zinc-900/50 border border-fuchsia-500/20 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-fuchsia-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4" /> Dopamine Map (0-15s)
                        </h3>
                        <div className="space-y-3">
                          {finalAnalysis.dopamineMap.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 p-3 bg-zinc-800/50 rounded-lg">
                              <div className="sm:w-1/4">
                                <span className="text-xs font-bold text-fuchsia-300">{item.phase}</span>
                              </div>
                              <div className="sm:w-3/4 space-y-1">
                                <p className="text-sm text-zinc-200 font-medium">{item.event}</p>
                                <p className="text-xs text-zinc-400 italic">{item.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {finalAnalysis.dopamineHits && finalAnalysis.dopamineHits.length > 0 && (
                      <div className="bg-zinc-900/50 border border-rose-500/20 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Zap className="w-4 h-4" /> Dopamine Hits (Min. 3)
                        </h3>
                        <ul className="space-y-2">
                          {finalAnalysis.dopamineHits.map((hit, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-sm">
                              <span className="text-rose-400 font-mono mt-0.5">{hit.time}</span>
                              <span className="text-zinc-300">{hit.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {finalAnalysis.dopamineValidation && (
                      <div className="bg-zinc-900/50 border border-indigo-500/20 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Validation
                        </h3>
                        <p className="text-zinc-300 text-sm leading-relaxed">
                          {finalAnalysis.dopamineValidation}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {finalAnalysis.checkViral && (
                        <div className="bg-zinc-900/50 border border-emerald-500/20 rounded-xl p-6">
                          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Check className="w-4 h-4" /> Check Viralità
                          </h3>
                          <ul className="space-y-3">
                            <li className="flex items-center justify-between text-sm">
                              <span className="text-zinc-400">Hook &lt; 1.2s</span>
                              {finalAnalysis.checkViral.hookUnder1_2s ? <Check className="w-4 h-4 text-emerald-400" /> : <span className="text-red-400">No</span>}
                            </li>
                            <li className="flex items-center justify-between text-sm">
                              <span className="text-zinc-400">Problema Chiaro</span>
                              {finalAnalysis.checkViral.clearProblem ? <Check className="w-4 h-4 text-emerald-400" /> : <span className="text-red-400">No</span>}
                            </li>
                            <li className="flex items-center justify-between text-sm">
                              <span className="text-zinc-400">Senza Audio</span>
                              {finalAnalysis.checkViral.understandableWithoutAudio ? <Check className="w-4 h-4 text-emerald-400" /> : <span className="text-red-400">No</span>}
                            </li>
                            <li className="flex items-center justify-between text-sm">
                              <span className="text-zinc-400">Momento Umano</span>
                              {finalAnalysis.checkViral.humanMoment ? <Check className="w-4 h-4 text-emerald-400" /> : <span className="text-red-400">No</span>}
                            </li>
                            <li className="flex items-center justify-between text-sm">
                              <span className="text-zinc-400">Loop Naturale</span>
                              {finalAnalysis.checkViral.naturalLoop ? <Check className="w-4 h-4 text-emerald-400" /> : <span className="text-red-400">No</span>}
                            </li>
                          </ul>
                        </div>
                      )}
                      
                      {finalAnalysis.risks && (
                        <div className="bg-zinc-900/50 border border-orange-500/20 rounded-xl p-6">
                          <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" /> Rischi
                          </h3>
                          <ul className="space-y-3">
                            <li className="flex items-center justify-between text-sm">
                              <span className="text-zinc-400">AI Floatiness</span>
                              <span className={`font-bold ${finalAnalysis.risks.aiFloatiness === 'HIGH' ? 'text-red-400' : finalAnalysis.risks.aiFloatiness === 'MEDIUM' ? 'text-orange-400' : 'text-emerald-400'}`}>{finalAnalysis.risks.aiFloatiness}</span>
                            </li>
                            <li className="flex items-center justify-between text-sm">
                              <span className="text-zinc-400">Uncanny Face</span>
                              <span className={`font-bold ${finalAnalysis.risks.uncannyFace === 'HIGH' ? 'text-red-400' : finalAnalysis.risks.uncannyFace === 'MEDIUM' ? 'text-orange-400' : 'text-emerald-400'}`}>{finalAnalysis.risks.uncannyFace}</span>
                            </li>
                            <li className="flex items-center justify-between text-sm">
                              <span className="text-zinc-400">Banalità</span>
                              <span className={`font-bold ${finalAnalysis.risks.banality === 'HIGH' ? 'text-red-400' : finalAnalysis.risks.banality === 'MEDIUM' ? 'text-orange-400' : 'text-emerald-400'}`}>{finalAnalysis.risks.banality}</span>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {finalAnalysis.ideaFinalForm && (
                      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Film className="w-4 h-4" /> Idea Final Form
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-1">Original Idea</h4>
                            <p className="text-sm text-zinc-300">{finalAnalysis.ideaFinalForm.originalIdea}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-1">Improved Idea</h4>
                            <p className="text-sm text-zinc-300">{finalAnalysis.ideaFinalForm.improvedIdea}</p>
                          </div>
                          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase mb-1">Final Viral Version</h4>
                            <p className="text-sm text-emerald-100">{finalAnalysis.ideaFinalForm.finalViralVersion}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {finalAnalysis && (
                      <div style={{ padding: 20, border: "2px solid yellow" }}>
                        <h3>DEBUG: finalAnalysis.engineVerdict is {String(!!finalAnalysis.engineVerdict)}</h3>
                      </div>
                    )}
                    {finalAnalysis.engineVerdict && (
                      <DecisionEngineReport data={finalAnalysis} />
                    )}

                    {finalAnalysis.suggestedAudio && (
                      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 glass-panel relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                          <Music className="w-4 h-4 text-amber-400" /> Audio Suggerito
                        </h3>
                        <p className="text-lg font-bold text-white leading-tight">
                          {finalAnalysis.suggestedAudio}
                        </p>
                      </div>
                    )}

                    {/* External Market Data Section */}
                    {finalAnalysis.externalMarketData && finalAnalysis.externalMarketData.comparableVideos.length > 0 && (
                      <div className="bg-zinc-900/50 border border-blue-500/20 rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" /> Analisi di Mercato Esterna (YouTube)
                        </h3>
                        <p className="text-xs text-zinc-500 italic mb-4">
                          {finalAnalysis.externalMarketData.marketSummary}
                        </p>
                        {finalAnalysis.externalMarketData.searchQueries && finalAnalysis.externalMarketData.searchQueries.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {finalAnalysis.externalMarketData.searchQueries.map((q, i) => (
                              <span key={`final-query-${i}`} className="px-2 py-1 bg-zinc-950 rounded text-[10px] text-zinc-500 border border-zinc-800">
                                {q}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {finalAnalysis.externalMarketData.comparableVideos.map((video, idx) => (
                            <a 
                              key={video.id || `final-video-${idx}`} 
                              href={video.videoLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 hover:border-blue-500/50 transition-all group"
                            >
                              <div className="aspect-video bg-zinc-900 rounded-lg mb-2 overflow-hidden relative">
                                {video.thumbnail ? (
                                  <img 
                                    src={video.thumbnail} 
                                    alt={video.title} 
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      const svgPlaceholder = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="100%" height="100%" fill="#18181b"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#3f3f46" text-anchor="middle" dominant-baseline="middle">VIDEO</text></svg>')}`;
                                      if (target.src !== svgPlaceholder) {
                                        target.src = svgPlaceholder;
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                    <Film className="w-8 h-8 text-zinc-800" />
                                  </div>
                                )}
                                <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-zinc-400">
                                  {new Date(video.publishDate).toLocaleDateString()}
                                </div>
                              </div>
                              <h4 className="text-xs font-bold text-white line-clamp-2 mb-1 group-hover:text-blue-400 transition-colors">
                                {video.title}
                              </h4>
                              <p className="text-[10px] text-zinc-500 mb-2">{video.channelName}</p>
                              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                <span className="flex items-center gap-1">
                                  <Play className="w-3 h-3" /> 
                                  {typeof video.views === 'number' ? video.views.toLocaleString() : video.views}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> 
                                  {video.likes === 'N/A' ? 'N/A' : (typeof video.likes === 'number' ? video.likes.toLocaleString() : video.likes)}
                                </span>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Sections: Metadata, Musical, Neuro */}
                    {finalAnalysis.pubTitleIt && (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider flex items-center gap-2">
                          <Rocket className="w-4 h-4" /> Pacchetto di Pubblicazione
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Titolo (IT/EN)</span>
                            <div className="p-3 bg-zinc-950 rounded-lg text-sm text-zinc-300">
                              <p className="font-bold text-white mb-1">{finalAnalysis.pubTitleIt}</p>
                              <p className="text-zinc-500 italic">{finalAnalysis.pubTitleEn}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Orario Consigliato</span>
                            <div className="p-3 bg-zinc-950 rounded-lg text-sm text-zinc-300">
                              {finalAnalysis.pubRecommendedTime}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Descrizione (IT)</span>
                          <div className="p-3 bg-zinc-950 rounded-lg text-sm text-zinc-300">
                            {finalAnalysis.pubDescriptionIt}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Hashtags</span>
                          <div className="p-3 bg-zinc-950 rounded-lg text-sm text-emerald-400 font-mono">
                            {finalAnalysis.pubHashtagsIt?.join(' ')}
                          </div>
                        </div>
                      </div>
                    )}

                    {finalAnalysis.musicAnalysisIt && (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                          <Activity className="w-4 h-4" /> Analisi Musicale
                        </h3>
                        <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">Umore Audio</span>
                          <span className="text-sm font-bold text-blue-400">{finalAnalysis.musicMoodIt}</span>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Analisi Dettagliata</span>
                          <div className="p-3 bg-zinc-950 rounded-lg text-sm text-zinc-300 italic">
                            {finalAnalysis.musicAnalysisIt}
                          </div>
                        </div>
                      </div>
                    )}

                    {finalAnalysis.neuroScore !== undefined && (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4" /> Neuro Analisi
                        </h3>
                        <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">Neuro Score</span>
                          <span className="text-xl font-black text-amber-400">{finalAnalysis.neuroScore}/100</span>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Spiegazione Psicologica</span>
                          <div className="p-3 bg-zinc-950 rounded-lg text-sm text-zinc-300 italic">
                            {finalAnalysis.neuroSpiegazioneIt}
                          </div>
                        </div>
                        {finalAnalysis.neuroDopamineHits && finalAnalysis.neuroDopamineHits.length > 0 && (
                          <div className="space-y-3">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Dopamine Hits</span>
                            <div className="space-y-2">
                              {finalAnalysis.neuroDopamineHits.map((hit, i) => (
                                <div key={`dopamine-${i}`} className="flex gap-3 text-sm p-2 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                                  <span className="text-amber-400 font-mono font-bold shrink-0">[{hit.time}]</span>
                                  <span className="text-zinc-300">{hit.descIt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Technical Verification */}
                    {finalAnalysis.technicalVerification && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                        <h3 className="text-amber-400 font-bold mb-2 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" /> Verifica Tecnica di Ricezione (Milano)
                        </h3>
                        <div className="text-sm text-amber-100/80 prose prose-invert prose-amber max-w-none">
                          {finalAnalysis.technicalVerification}
                        </div>
                      </div>
                    )}

                    {/* Istruzioni Luma AI */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                      <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4" /> Istruzioni per Luma AI
                      </h3>
                      <p className="text-sm text-blue-100/80 mb-3">
                        Copia e incolla questo messaggio nella chat di Luma AI prima di inserire il prompt:
                      </p>
                      <div className="p-3 bg-black/30 rounded-lg text-sm text-zinc-300 font-mono flex items-start justify-between gap-4">
                        <p className="flex-1">
                          Ho un prompt ottimizzato universale per fare un video di 15 secondi con audio sincronizzato, mi serve solo il video non fare immagini fai il video in una unica soluzione. I tempi algoritmici sono già stati ottimizzati nel prompt.
                        </p>
                        <CopyButton 
                          text="Ho un prompt ottimizzato universale per fare un video di 15 secondi con audio sincronizzato, mi serve solo il video non fare immagini fai il video in una unica soluzione. I tempi algoritmici sono già stati ottimizzati nel prompt."
                          className="shrink-0"
                        />
                      </div>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl overflow-hidden">
                      <div className="bg-emerald-500/20 px-5 py-3 border-b border-emerald-500/20 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                          <Sparkles className="w-4 h-4" /> Prompt Finale Ottimizzato
                        </h3>
                        <CopyButton text={finalAnalysis.refinedPrompt} className="bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/30" />
                      </div>
                      <div className="p-5">
                        <p className="text-zinc-200 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                          {finalAnalysis.refinedPrompt}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isWizardOpen && (
          <SmartGuideWizard
            apiKey={apiKey}
            onClose={() => setIsWizardOpen(false)}
            onComplete={(wizardGenre, wizardIdea, wizardHook) => {
              setGoal(`Idea: ${wizardIdea}\nHook: ${wizardHook}`);
              setCast("Protagonista"); // Default or leave empty
              setIsWizardOpen(false);
            }}
          />
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Reset Flusso"
        message="Sei sicuro di voler resettare tutto e iniziare un nuovo flusso? Questa azione non può essere annullata."
        onConfirm={confirmReset}
        onCancel={() => setIsResetModalOpen(false)}
      />

      {/* PRODUCTION PROGRESS DIAGNOSTIC UI - Moved to bottom for global visibility during processing */}
      <AnimatePresence>
        {(productionProgress || elapsedTimer > 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 p-4 bg-zinc-900/80 border border-zinc-700/50 rounded-2xl text-left w-[90%] max-w-lg shadow-2xl backdrop-blur-md z-50 pointer-events-none"
          >
            <div className="space-y-3 text-[11px] font-mono">
              <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2 mb-2">
                <span className="text-zinc-500 uppercase tracking-tighter">Diagnostic Monitor</span>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-500/80">LIVE</span>
                </div>
              </div>

              {productionProgress?.phase && (
                <div className="flex justify-between items-center bg-zinc-800/30 p-2 rounded-lg">
                  <span className="text-zinc-500" id="phase-label">PHASE</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-widest">{productionProgress.phase}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-800/30 p-2 rounded-lg" id="module-container">
                  <div className="text-zinc-500 mb-0.5">MODULE</div>
                  <div className="text-zinc-300 font-medium truncate">{productionProgress?.module || "Dispatcher"}</div>
                </div>
                <div className="bg-zinc-800/30 p-2 rounded-lg" id="provider-container">
                  <div className="text-zinc-500 mb-0.5">PROVIDER</div>
                  <div className="text-blue-400 font-bold tracking-tight">
                    {productionProgress?.provider || (productionProgress?.module?.includes('YouTube') ? 'YouTube API' : 'GOOGLE GEMINI')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-800/30 p-2 rounded-lg" id="elapsed-container">
                  <div className="text-zinc-500 mb-0.5">ELAPSED</div>
                  <div className="text-zinc-300">00:{elapsedTimer < 10 ? `0${elapsedTimer}` : elapsedTimer}</div>
                </div>
                <div className="bg-zinc-800/30 p-2 rounded-lg relative overflow-hidden" id="step-container">
                  <div className="text-zinc-500 mb-0.5">PIPELINE STEP</div>
                  <div className="text-zinc-300">{productionProgress?.step || 0}/{productionProgress?.totalSteps || 5}</div>
                  {productionProgress?.step && productionProgress?.totalSteps && (
                    <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500/50 transition-all duration-1000" 
                         style={{ width: `${(productionProgress.step / productionProgress.totalSteps) * 100}%` }} />
                  )}
                </div>
              </div>

              {productionProgress?.status && (
                <div className="p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10 text-emerald-400/80 italic text-center text-[10px]" id="status-display">
                  {productionProgress.status}
                </div>
              )}

              {productionProgress?.fallbackActive && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-center font-bold text-[10px] animate-pulse flex items-center justify-center gap-2" id="fallback-warning">
                  <ShieldAlert className="w-3 h-3" />
                  RESTARTING WITH GEMINI FALLBACK
                </div>
              )}

              {elapsedTimer > 15 && (Date.now() - (productionProgress?.lastUpdateAt || 0) > 10000) && (
                <div className="text-center text-[10px] text-amber-500/70 animate-pulse py-1" id="wait-message">
                  Waiting for server response... {productionProgress?.provider || 'Gemini'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
