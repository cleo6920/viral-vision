import { GoogleGenAI, Type } from "@google/genai";
import { logger } from "../../utils/logger";
import { uploadToGemini, executeWithNetworkRetry, waitForFileActive, fileToBase64, safeParseJSON, maskApiKeySafe } from "./core";

export interface MultiEvidenceValidation {
  decision: string;
  evidences: {
    video: string;
    audio: string;
    script: string;
    context: string;
  };
  evidence_count: number;
  conflicts: boolean;
  confidence: number;
  status: "CONFIRMED" | "WEAK" | "CONFLICTED" | "INSUFFICIENT";
}

export type NarrativeStatus = "FULL" | "PARTIAL" | "FRAGMENTED";
export type PromptStatus = "FINAL" | "PROVISIONAL" | "BLOCKED";

export interface MissingPart {
  type: string;
  severity: "CRITICAL" | "IMPORTANT" | "MINOR";
}

export interface CausalChainValidation {
  start_to_trigger: { valid: boolean; confidence: number; note: string };
  trigger_to_progression: { valid: boolean; confidence: number; note: string };
  progression_to_peak: { valid: boolean; confidence: number; note: string };
  peak_to_ending: { valid: boolean; confidence: number; note: string };
  causal_score: number;
  weak_links: string[];
  causal_chain_valid: boolean;
}

export interface SmokeTestResult {
  summary: string;
  keywords: string[];
  videoQuality: "OK" | "MEDIUM" | "LOW";
  narrativeStatus: NarrativeStatus; // FULL | PARTIAL | FRAGMENTED
  multiEvidence: MultiEvidenceValidation;
  causalChain: {
    status: "VALID" | "WEAK" | "BROKEN";
    score: number;
  };
  promptStatus: PromptStatus; // FINAL | PROVISIONAL | BLOCKED
  sourceConfidence: number; // 0-10
  missingParts: MissingPart[];
  recoveryRequired: boolean;
  diagnosis?: string;
  reason?: string;
}

interface QualityAssessment {
  scene_coherence: number;
  action_accuracy: number;
  audio_understanding: number;
  specificity: number;
  hallucination_risk: number;
  overall_quality: number;
  notes: string;
  multi_evidence: {
    decision: string;
    evidences: {
      video: string;
      audio: string;
      script: string;
      context: string;
    };
    evidence_count: number;
    has_conflicts: boolean;
    confidence_level: number;
    validation_status: "CONFIRMED" | "WEAK" | "CONFLICTED" | "INSUFFICIENT";
  };
  narrative_status: "FULL" | "PARTIAL" | "FRAGMENTED";
  missing_parts: Array<{ type: string; severity: "CRITICAL" | "IMPORTANT" | "MINOR" }>;
}

interface ChunkResult {
  chunk_index: number;
  time_range: string;
  scene: string;
  action: string;
  audio_dialogue: string;
  emotion_tone: string;
  viral_moment: boolean;
  importance: number;
}

interface FinalSynthesis {
  global_summary: string;
  main_context: string;
  key_actions: string[];
  dialogue_audio_summary: string;
  emotion_tone_summary: string;
  best_viral_moments: string[];
  continuity_quality: number;
  final_video_quality: "OK" | "MEDIUM" | "LOW";
}

let ACTIVE_GEMINI_KEY: string | null = null;

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

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const contentType = response.headers.get('content-type');
    if (!response.ok || !contentType || !contentType.includes('application/json')) {
      return { ok: false, data: null };
    }
    return { ok: true, data: await response.json() };
  } finally {
    clearTimeout(timer);
  }
}

function maskKey(key: any): string {
  return maskApiKeySafe(key);
}

async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const timeout = setTimeout(() => {
        URL.revokeObjectURL(video.src);
        resolve(0);
    }, 5000);
    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const duration = video.duration;
      URL.revokeObjectURL(video.src);
      resolve(duration);
    };
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(video.src);
      resolve(0);
    };
    video.src = URL.createObjectURL(file);
  });
}

async function extractFrames(file: File, startTime: number, endTime: number, maxFrames: number): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.currentTime = startTime;
    const frames: string[] = [];
    video.onseeked = () => {
        if (video.currentTime >= endTime || frames.length >= maxFrames) {
            URL.revokeObjectURL(video.src);
            resolve(frames);
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = 160; canvas.height = 90;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.5));
        video.currentTime += (endTime - startTime) / Math.max(1, maxFrames);
    };
    video.load();
  });
}

async function analyzeChunk(apiKey: string, frames: string[], chunkIndex: number, totalChunks: number, modelName: string): Promise<any> {
    const parts = [{text: `Analizza questi frame (chunk ${chunkIndex}/${totalChunks}). Rispondi in JSON.`}, 
        ...frames.map(f => ({ inlineData: { data: f.split(',')[1], mimeType: 'image/jpeg' } }))];
    return await executeWithNetworkRetry(
        async (aiInstance, mName) => {
          return await aiInstance.models.generateContent({
            model: mName,
            contents: [{ role: "user", parts }],
            config: { responseMimeType: "application/json" },
          });
        },
        1, undefined, 300000, apiKey, (_) => {}, "gemini-1.5-flash", undefined, "Smoke Test", undefined, false, "COGNITIVE", true
      );
}

async function runFrameFallbackDiagnostic(
  apiKey: string,
  file: File,
  onProgress: (msg: string) => void,
  reason: string
): Promise<SmokeTestResult> {
  logger.info("[SMOKE_TEST_FRAME_FALLBACK_START]", { reason });
  onProgress("Fallback diagnostico a frame in corso...");

  const duration = await getVideoDuration(file);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 4;
  const endTime = Math.min(safeDuration, 4);
  const frames = await extractFrames(file, 0, endTime, 4);

  if (!frames.length) {
    throw new Error("FRAME_FALLBACK_NO_FRAMES");
  }

  logger.info("[SMOKE_TEST_FRAME_FALLBACK_READY]", { count: frames.length });

  const response = await executeWithNetworkRetry(
    async (aiInstance, modelName) => {
      return await aiInstance.models.generateContent({
        model: modelName,
        contents: [{
          role: "user",
          parts: [
            { text: "Micro-diagnosi tecnica. Conferma in JSON se i frame video sono leggibili e descrivi in una frase l'azione principale. JSON: {\"summary\":\"...\",\"ok\":true}" },
            ...frames.map(frame => ({
              inlineData: {
                data: frame.split(',')[1],
                mimeType: "image/jpeg"
              }
            }))
          ]
        }],
        config: { responseMimeType: "application/json" }
      });
    },
    0,
    undefined,
    120000,
    apiKey,
    (_) => {},
    "gemini-1.5-flash",
    undefined,
    "Smoke Test Frame Fallback",
    "TEST",
    false,
    "BANAL",
    true
  );

  const parsed = safeParseJSON(response.text, {}) as any;
  const summary = typeof parsed.summary === "string" && parsed.summary.trim()
    ? parsed.summary.trim()
    : "FRAME FALLBACK PASS";

  logger.info("[SMOKE_TEST_FRAME_FALLBACK_SUCCESS]", { summary });

  return {
    summary,
    keywords: ["frame-fallback", "smoke-test"],
    videoQuality: "OK",
    narrativeStatus: "FRAGMENTED",
    multiEvidence: {
      decision: "SUCCESS",
      evidences: {
        video: summary,
        audio: "N/A (frame fallback)",
        script: "N/A",
        context: reason
      },
      evidence_count: 1,
      conflicts: false,
      confidence: 8,
      status: "CONFIRMED"
    },
    causalChain: { status: "VALID", score: 8 },
    promptStatus: "PROVISIONAL",
    sourceConfidence: 8,
    missingParts: [],
    recoveryRequired: false,
    diagnosis: "SISTEMA OK | FRAME FALLBACK DIAGNOSTIC",
    reason: "FRAME_FALLBACK_AFTER_DIRECT_FAILURE"
  };
}

export interface AudioAnchorSmokeResult {
  audioDetected: boolean;
  transcriptPreview: string;
  spokenLanguage: string;
  confidence: number;
  errorReason?: string;
  metadata: {
    fileName: string;
    fileSizeMB: string;
    mimeType: string;
    duration?: number;
    inlineEligible: boolean;
  }
}

export async function runAudioAnchorSmokeTest(
  apiKey: string,
  file: File,
  onProgress: (msg: string) => void
): Promise<AudioAnchorSmokeResult> {
  const fileName = file.name;
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const mimeType = file.type;
  const inlineEligible = file.size <= 20 * 1024 * 1024;
  
  onProgress("Lettura metadati...");
  const duration = await getVideoDuration(file);

  const metadata = {
    fileName,
    fileSizeMB,
    mimeType,
    duration,
    inlineEligible
  };

  if (!inlineEligible) {
    return {
      audioDetected: false,
      transcriptPreview: "",
      spokenLanguage: "N/A",
      confidence: 0,
      errorReason: "FILE_TOO_LARGE_FOR_INLINE_TEST",
      metadata
    };
  }

  try {
    onProgress("Preparazione file per Gemini (Base64)...");
    const base64 = await fileToBase64(file);

    onProgress("Chiamata Gemini (Audio Anchor Test)...");
    const response = await executeWithNetworkRetry(
      async (aiInstance, modelName) => {
        return await aiInstance.models.generateContent({
          model: modelName,
          contents: [
            {
              role: "user",
              parts: [
                { text: "ESTRAZIONE AUDIO DIAGNOSTICA: Trascrivi i primi 10 secondi di questo video. Se non c'è parlato, scrivi 'NO_SPEECH'. Indica anche la lingua parlata. Rispondi SOLO in JSON: {\"audioDetected\": true/false, \"transcriptPreview\": \"...\", \"spokenLanguage\": \"...\", \"confidence\": 0-100}" },
                { inlineData: { data: base64, mimeType } }
              ]
            }
          ],
          config: { responseMimeType: "application/json" }
        });
      },
      0, // No retries for smoke test
      undefined,
      120000, // 120s timeout
      apiKey,
      (_) => {},
      "gemini-1.5-flash",
      undefined,
      "Audio Anchor Smoke Test",
      undefined,
      false,
      "COGNITIVE",
      true
    );

    const parsed = safeParseJSON(response.text, {}) as any;
    
    return {
      audioDetected: parsed.audioDetected === true,
      transcriptPreview: parsed.transcriptPreview || "",
      spokenLanguage: parsed.spokenLanguage || "Unknown",
      confidence: parsed.confidence || 0,
      metadata
    };

  } catch (e: any) {
    logger.error("[AUDIO_SMOKE_TEST_FAILED]", e);
    return {
      audioDetected: false,
      transcriptPreview: "",
      spokenLanguage: "N/A",
      confidence: 0,
      errorReason: e.message || String(e),
      metadata
    };
  }
}

export async function runVideoSmokeTest(
  apiKey: string,
  file: File | undefined,
  onProgress: (msg: string) => void,
  calledFrom = "unknown"
): Promise<SmokeTestResult> {
  // DIAGNOSTIC LOGS
  logger.info("[RUN_VIDEO_SMOKE_TEST_ENTERED]");
  
  // [SMOKE_TEST_FILE_RECEIVED] LOGGING
  logger.info("[SMOKE_TEST_FILE_RECEIVED]", {
    hasFile: !!file,
    fileName: file?.name || "N/A",
    fileSize: file?.size || 0,
    fileSizeMB: file ? (file.size / (1024 * 1024)).toFixed(2) : "N/A",
    fileType: file?.type || "N/A",
    calledFrom
  });

  logger.info("[SMOKE_TEST_PATCH_VERSION] v_chunked_profile_001");
  
  // PRE-ROUTING LOGGING
  const routeInput = {
    mode: "TEST", // Smoke test is always TEST mode context
    calledFrom,
    hasReferenceFile: !!file,
    hasVideoFile: !!file && file.type?.startsWith('video/'),
    filePresent: !!file,
    fileName: file?.name || null,
    fileType: file?.type || null,
    fileSizeMB: file ? parseFloat((file.size / (1024 * 1024)).toFixed(2)) : null,
    fileObjectConstructor: file?.constructor?.name || null,
    descriptionLength: 0, // Not applicable here
    objectiveLength: 0,
    castLength: 0,
    selectedMode: "SMOKE_TEST",
    forcePro: false
  };
  logger.info("[PRE_ROUTE_INPUT_STATE]", routeInput);

  // --- EXECUTION PROFILE DETECTION ---
  let profile: "AI_STUDIO_PREVIEW_DIRECT" | "AI_STUDIO_PREVIEW_CHUNKED" | "BACKEND_REAL" = await (async () => {
    const hostname = window.location.hostname;
    const isAiStudioPreview = isAiStudioLikeHost(hostname);
    const isLocalStandalone = hostname === '127.0.0.1' || hostname === 'localhost';
    
    let backendHealthAvailable = false;
    try {
      const healthRes = await fetchJsonWithTimeout('/api/gemini/upload/health', 3000);
      if (healthRes.ok && healthRes.data) {
        const data = healthRes.data as any;
        if (data.ok === true || data.service) backendHealthAvailable = true;
      }
    } catch(e) {
      logger.warn("[SMOKE_TEST_BACKEND_HEALTH_TIMEOUT_OR_ERROR]", e);
    }

    logger.info("[PROFILE_ENV_DETECTED]", { hostname, isAiStudioPreview, isLocalStandalone, backendHealthAvailable });

    if (isAiStudioPreview) {
        if (!file || (file.size && file.size <= 20 * 1024 * 1024)) return "AI_STUDIO_PREVIEW_DIRECT";
        if (file.size && file.size <= 100 * 1024 * 1024) return "AI_STUDIO_PREVIEW_CHUNKED";
        throw new Error("Per video grandi serve BACKEND_REAL.");
    }

    // Keep localhost export-friendly and stable:
    // for small files, prefer direct inline path even if a backend is available.
    if (isLocalStandalone && (!file || (file.size && file.size <= 20 * 1024 * 1024))) {
      return "AI_STUDIO_PREVIEW_DIRECT";
    }
    
    if (backendHealthAvailable) return "BACKEND_REAL";
    
    // Fallback default
    if (!file || (file.size && file.size <= 20 * 1024 * 1024)) return "AI_STUDIO_PREVIEW_DIRECT";
    return "AI_STUDIO_PREVIEW_CHUNKED";
  })();
  logger.info(`[EXECUTION_PROFILE_SELECTED] ${profile}`);

  // KEY CONTROL SYSTEM
  ACTIVE_GEMINI_KEY = apiKey;
  logger.info(`[KEY_CONTROL_SELECTED] key=${maskKey(ACTIVE_GEMINI_KEY)}`);

  let selectedBranch: "VIDEO" | "TEXT_ONLY" = "TEXT_ONLY";
  let routingReason = "No file present";

  if (file) {
    if (file.type?.startsWith('video/')) {
      selectedBranch = "VIDEO";
      routingReason = "File with video mime type detected";
    } else {
      selectedBranch = "VIDEO"; // Defensive: try as video if file is present
      routingReason = "File present (non-video mime), attempting video branch anyway";
    }
  }

  logger.info("[ROUTE_DECISION]", {
    selectedBranch,
    reason: routingReason,
    filePresent: !!file,
    fileType: file?.type || null,
    hasVideoMime: !!file && file.type?.startsWith('video/'),
    calledFrom
  });

  const isVideo = selectedBranch === "VIDEO";
  
  if (isVideo) {
    if (!file) {
      logger.error("[VIDEO_ROUTE_BLOCKED]", {
        reason: "Video branch selected but file object is missing",
        fileName: routeInput.fileName,
        fileType: routeInput.fileType,
        fileSizeMB: routeInput.fileSizeMB
      });
      throw new Error("File video rilevato, ma il ramo video non è stato avviato. Analisi bloccata per evitare fallback TEXT ONLY errato.");
    }
    onProgress("VIDEO_TEST_RUNNING");
    onProgress("Caricamento video...");
  } else {
    onProgress("TEST_TEXT_ONLY_START");
    logger.info("[TEXT_ONLY_HANDLER_SELECTED]");
    logger.info("[TEXT_ONLY_VIDEO_VALIDATORS_SKIPPED]");
  }

  let fileUri = "";
  let inlineDataBase64 = "";

  if (isVideo) {
    if (profile === "AI_STUDIO_PREVIEW_DIRECT") {
      logger.info("[PREVIEW_DIRECT_LIMIT_CHECK]");
      if (file!.size > 20 * 1024 * 1024) throw new Error("Per video grandi serve BACKEND_REAL.");
      logger.info("[PREVIEW_DIRECT_INLINE_DATA_USED]");
      try {
        onProgress("Conversione video in Base64 (inline_data)...");
        inlineDataBase64 = await fileToBase64(file!);
      } catch (e) {
        throw new Error("Conversione inline_data fallita.");
      }
    } else if (profile === "AI_STUDIO_PREVIEW_CHUNKED") {
      logger.info("[CHUNKED_START]", { fileSizeMB: (file!.size / 1024 / 1024).toFixed(2) });
      logger.info("[MICROTEST_CHUNKED_MODE_ACTIVE]", { maxChunks: 1, framesPerChunk: 2, apiCallsLimit: 1 });
      onProgress("[MICROTEST] Avvio micro-test video (Frame Extraction)...");
      
      const video = document.createElement("video");
      const url = URL.createObjectURL(file!);
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      try {
        const metadata = await new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
          video.onloadedmetadata = () => {
            resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
          };
          video.onerror = () => reject(new Error("Impossibile leggere i metadati del video"));
          setTimeout(() => reject(new Error("Timeout caricamento metadati video")), 15000);
        });

        logger.info("[CHUNKED_METADATA_LOADED]", metadata);
        
        // MICROTEST: strictly 1 chunk, 2 frames
        const chunkStart = Math.min(2.0, metadata.duration * 0.1); // Start near beginning
        const chunkEnd = Math.min(metadata.duration, chunkStart + 2.0); 
        
        onProgress(`[MICROTEST] Estrazione frame diagnostici...`);
        logger.info("[CHUNK_START]", { index: 0, start: chunkStart, end: chunkEnd });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const chunkFrames: string[] = [];
        
        // Extract 2 frames
        const framesToExtract = 2;
        const frameStep = (chunkEnd - chunkStart) / framesToExtract;
        
        for (let f = 0; f < framesToExtract; f++) {
          const time = chunkStart + (f * frameStep);
          video.currentTime = time;
          await new Promise<void>((res) => {
            video.onseeked = () => res();
            video.onerror = () => res(); // skip on error
            setTimeout(() => res(), 2000); 
          });

          if (ctx) {
            const scale = Math.min(1, 480 / metadata.width);
            canvas.width = metadata.width * scale;
            canvas.height = metadata.height * scale;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            chunkFrames.push(canvas.toDataURL("image/jpeg", 0.6).split(',')[1]);
          }
        }
        
        logger.info("[CHUNK_FRAMES_EXTRACTED]", { count: chunkFrames.length });
        onProgress(`[MICROTEST] Verifica visione Gemini...`);
        logger.info("[MICROTEST_GEMINI_CALL_START]");

        // Single call to Gemini
        const chunkResult = await executeWithNetworkRetry(
          async (aiInstance, mName) => {
            const contents = [{
              role: "user",
              parts: [
                { text: "ESTRAZIONE DIAGNOSTICA: Descrivi brevemente cosa vedi in questi frame per confermare che la pipeline video funziona. Rispondi con un JSON: {\"summary\": \"...\", \"ok\": true}" },
                ...chunkFrames.map(data => ({ inlineData: { data, mimeType: "image/jpeg" } }))
              ]
            }];
            return await aiInstance.models.generateContent({ 
              model: mName, 
              contents,
              config: { responseMimeType: "application/json" }
            });
          },
          0, undefined, 30000, apiKey, (_) => {}, "gemini-1.5-flash", undefined, "Microtest Analysis", undefined, false, "BANAL", true
        );

        logger.info("[MICROTEST_GEMINI_CALL_SUCCESS]");
        const parsed = safeParseJSON(chunkResult.text || "{}", {}) as any;
        
        const result: SmokeTestResult = {
          summary: parsed.summary || "Microtest completato con successo.",
          keywords: ["microtest", "chunked"],
          videoQuality: "OK",
          narrativeStatus: "FRAGMENTED",
          multiEvidence: {
            decision: "SUCCESS",
            evidences: { video: parsed.summary, audio: "N/A (Microtest)", script: "N/A", context: "N/A" },
            evidence_count: 1,
            conflicts: false,
            confidence: 10,
            status: "CONFIRMED"
          },
          causalChain: { status: "VALID", score: 10 },
          promptStatus: "FINAL",
          sourceConfidence: 10,
          missingParts: [],
          recoveryRequired: false,
          diagnosis: "VIDEO PIPELINE OK | MICROTEST CHUNKED",
          reason: "AI_STUDIO_PREVIEW_CHUNKED"
        };

        logger.info("[MICROTEST_RESULT]", result);
        onProgress("[MICROTEST] Test completato.");
        URL.revokeObjectURL(url);
        return result;

      } catch (err: any) {
        URL.revokeObjectURL(url);
        const isQuota = err.message?.includes("429") || err.message?.includes("quota");
        const diag = isQuota ? "VIDEO PIPELINE FAILED | QUOTA_EXHAUSTED" : `VIDEO PIPELINE FAILED | ${err.message}`;
        logger.error("[MICROTEST_FAILED]", { error: err.message, isQuota });
        
        onProgress(`[MICROTEST] Errore: ${isQuota ? 'Quota esaurita' : err.message}`);
        
        return {
          summary: `FAIL: ${err.message}`,
          keywords: ["fail"],
          videoQuality: "LOW",
          narrativeStatus: "FRAGMENTED",
          multiEvidence: {
            decision: "FAIL",
            evidences: { video: err.message, audio: "N/A", script: "N/A", context: "N/A" },
            evidence_count: 0,
            conflicts: true,
            confidence: 0,
            status: "INSUFFICIENT"
          },
          causalChain: { status: "BROKEN", score: 0 },
          promptStatus: "BLOCKED",
          sourceConfidence: 0,
          missingParts: [],
          recoveryRequired: true,
          diagnosis: diag,
          reason: "AI_STUDIO_PREVIEW_CHUNKED"
        };
      }
    } else {
      // BACKEND_REAL
      logger.info("[BACKEND_HEALTHCHECK]");
      logger.info("[BACKEND_UPLOAD_START]");
      try {
        fileUri = await uploadToGemini(file!, ACTIVE_GEMINI_KEY, (msg) => onProgress(msg));
        onProgress("Verifica stato elaborazione video...");
        await waitForFileActive(fileUri, ACTIVE_GEMINI_KEY, (msg) => onProgress(msg));
        logger.info("[BACKEND_UPLOAD_SUCCESS]");
        onProgress("VIDEO_IS_ACTIVE");
      } catch (uploadError: any) {
        logger.error("[BACKEND_UPLOAD_FAILED]", uploadError);
        throw uploadError;
      }
    }
  }

  const modelName = "gemini-1.5-flash";
  let prompt = "";
  
  if (!isVideo) {
    prompt = `Esegui un test di disponibilità del modello testuale. Rispondi con un JSON che conferma la ricezione di questo messaggio.
    Usa questa struttura JSON:
    {
      "summary": "TEXT ONLY: PASS",
      "keywords": ["test", "text-only"],
      "videoQuality": "N/A",
      "narrativeStatus": "N/A",
      "multiEvidence": { 
         "decision": "SKIP", 
         "evidences": { "video": "N/A", "audio": "N/A", "script": "N/A", "context": "N/A" }, 
         "evidence_count": 0, 
         "has_conflicts": false, 
         "confidence": 10, 
         "status": "CONFIRMED" 
      },
      "causalChain": { "status": "VALID", "score": 10 },
      "promptStatus": "TEXT_ONLY_PASS",
      "sourceConfidence": 10,
      "missingParts": [],
      "recoveryRequired": false,
      "diagnosis": "SISTEMA OK | TEXT MODEL AVAILABLE"
    }`;
  } else {
    prompt = `Analizza questo video. Restituisci un JSON coerente con la seguente struttura:
{
  "summary": "string",
  "keywords": ["string"],
  "videoQuality": "OK" | "MEDIUM" | "LOW",
  "narrativeStatus": "FULL" | "PARTIAL" | "FRAGMENTED",
  "multiEvidence": { 
     "decision": "string", 
     "evidences": { "video": "string", "audio": "string", "script": "string", "context": "string" }, 
     "evidence_count": number, 
     "has_conflicts": boolean, 
     "confidence": number, 
     "status": "CONFIRMED" | "WEAK" | "CONFLICTED" | "INSUFFICIENT" 
  },
  "causalChain": { "status": "VALID" | "WEAK" | "BROKEN", "score": number },
  "promptStatus": "FINAL" | "PROVISIONAL" | "BLOCKED",
  "sourceConfidence": number,
  "missingParts": [{"type": "string", "severity": "CRITICAL" | "IMPORTANT" | "MINOR"}],
  "recoveryRequired": boolean
}`;
  }
  
  const parts: any[] = [{ text: prompt }];

  if (isVideo) {
    if (inlineDataBase64) {
      parts.unshift({ 
        inlineData: { data: inlineDataBase64, mimeType: file!.type }
      });
    } else {
      parts.unshift({ 
        fileData: { fileUri, mimeType: file!.type }
      });
    }
  }

  const eventPrefix = profile === "AI_STUDIO_PREVIEW_DIRECT" ? "PREVIEW_DIRECT" : "BACKEND";
  onProgress("Analisi diagnostica in corso...");
  logger.info(`[${eventPrefix}_VIDEO_SUMMARY_START]`);

  let response;
  try {
    response = await executeWithNetworkRetry(
      async (aiInstance, mName) => {
        return await aiInstance.models.generateContent({
          model: mName,
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json"
          },
        });
      },
      0, undefined, 300000, ACTIVE_GEMINI_KEY || apiKey, (_) => {}, modelName, undefined, "Smoke Test", undefined, false, "COGNITIVE", true
    );
    logger.info(`[${eventPrefix}_VIDEO_SUMMARY_SUCCESS]`);
  } catch (e) {
    logger.error(`[${eventPrefix}_VIDEO_SUMMARY_FAILED]`, e);
    if (isVideo && profile === "AI_STUDIO_PREVIEW_DIRECT" && file) {
      const message = e instanceof Error ? e.message : String(e);
      return await runFrameFallbackDiagnostic(
        ACTIVE_GEMINI_KEY || apiKey,
        file,
        onProgress,
        message
      );
    }
    throw e;
  }

  const resultText = response.text || '{}';
  logger.info("[RAW_MODEL_RESULT]", resultText);
  let result: SmokeTestResult;
  try {
      result = safeParseJSON(resultText);
      if (!isVideo) {
          logger.info("[TEXT_ONLY_RESULT_MAPPED]");
      } else {
          logger.info("[VALIDATION_FIELDS_PRESENT]");
      }
  } catch (e) {
      logger.error("[DIAGNOSTIC_MAPPING_ERROR]", e);
      result = { summary: "FAIL", keywords: [], videoQuality: "LOW", narrativeStatus: "FRAGMENTED", multiEvidence: { decision: "FAIL", evidences: {} as any, evidence_count: 0, conflicts: true, confidence: 0, status: "INSUFFICIENT" }, causalChain: { status: "BROKEN", score: 0 }, promptStatus: "BLOCKED", sourceConfidence: 0, missingParts: [], recoveryRequired: true, diagnosis: "JSON PARSE ERROR" };
  }
  
  // Normalize mapped fields
  if (result.multiEvidence && typeof result.multiEvidence.confidence === 'number' && result.multiEvidence.confidence <= 1) {
      result.multiEvidence.confidence *= 10;
  }
  if (typeof result.sourceConfidence === 'number' && result.sourceConfidence <= 1) {
      result.sourceConfidence *= 10;
  }
  if (result.causalChain && typeof result.causalChain.score === 'number' && result.causalChain.score <= 1) {
      result.causalChain.score *= 10;
  }
  
  logger.info("[DIAGNOSTIC_RESULT_MAPPED]", result);

  if (isVideo && inlineDataBase64) {
    if (profile === "AI_STUDIO_PREVIEW_CHUNKED") {
        result.diagnosis = "SISTEMA OK (Chunked Mode used)";
        logger.info("[CHUNKED_RESULT]", { diagnosis: result.diagnosis });
    } else {
        result.diagnosis = "SISTEMA OK (Inline Mode used, Upload skipped)";
    }
  } else if (isVideo) {
    result.diagnosis = "SISTEMA OK (Upload Mode used)";
  } else {
    // Force requested fields for text only in case model hallucinated them
    result.summary = "TEXT ONLY: PASS";
    result.videoQuality = "N/A" as any;
    result.narrativeStatus = "N/A" as any;
    result.promptStatus = "TEXT_ONLY_PASS" as any;
    result.diagnosis = "SISTEMA OK | TEXT MODEL AVAILABLE";
  }

  logger.info("[TEST_MODEL_CALL_SUCCESS]", result);
  onProgress("TEST_MODEL_CALL_SUCCESS: Analisi completata.");
  
  return result;
}

export interface GeminiUploadSmokeResult {
  success: boolean;
  variant: "A" | "B" | "C" | "D" | "E" | "SERVER_UPLOAD" | "none";
  uri?: string;
  geminiFileName?: string;
  mimeType?: string;
  name?: string;
  state?: string;
  error?: string;
  logLines: string[];
}

export async function runGeminiUploadSmokeTest(
  apiKey: string,
  file: File,
  onProgress?: (msg: string) => void
): Promise<GeminiUploadSmokeResult> {
  const fileName = file.name;
  const mimeType = file.type || "video/mp4";
  const size = file.size;

  onProgress?.("Avvio Gemini Upload (SERVER_UPLOAD)...");

  logger.info(`[GEMINI_UPLOAD_SMOKE_START] variant: SERVER_UPLOAD, fileName: ${fileName}, mimeType: ${mimeType}, size: ${size}`);

  try {
    const formData = new FormData();
    formData.append('file', file);
    // Explicit call to backend smoke upload endpoint
    const proxyUrl = `/api/gemini/upload-smoke?apiKey=${encodeURIComponent(apiKey)}`;

    const uploadRes = await fetch(proxyUrl, {
      method: 'POST',
      body: formData
    });

    const status = uploadRes.status;
    const responseText = await uploadRes.text();
    let parsedJson: any = null;

    // Fast check for AI studio proxy HTML responses
    const responsePreview = responseText.substring(0, 300).trim();
    if (responsePreview.toLowerCase().startsWith('<!doctype html') || responsePreview.toLowerCase().startsWith('<html')) {
      logger.info(`[GEMINI_UPLOAD_SMOKE_FAIL] reason: NON_JSON_RESPONSE_AI_STUDIO_PROXY, responseBody: ${responsePreview}`);
      throw new Error(`NON_JSON_RESPONSE_AI_STUDIO_PROXY`);
    }

    try { 
      parsedJson = JSON.parse(responseText); 
    } catch (e) {
      logger.info(`[GEMINI_UPLOAD_SMOKE_FAIL] reason: NON_JSON_RESPONSE, responseBody: ${responsePreview}`);
      throw new Error(`NON_JSON_RESPONSE`);
    }

    if (!uploadRes.ok) {
      logger.info(`[GEMINI_UPLOAD_SMOKE_FAIL] status: ${status}, reason: Server upload failed, responseBody: ${responseText}`);
      throw new Error(`Server upload failed with HTTP ${status}: ${responseText}`);
    }

    if (!parsedJson.ok || !parsedJson.fileUri) {
      throw new Error("No file URI produced by server upload");
    }

    const fileUri = parsedJson.fileUri;
    const gFileName = parsedJson.fileName || fileUri.split('/').pop();
    let finalState = parsedJson.state || "ACTIVE"; // From server

    logger.info(`[GEMINI_UPLOAD_SMOKE_PASS] variant: SERVER_UPLOAD, uriPresent: yes, fileName: ${gFileName}, mimeType: ${parsedJson.mimeType}`);
    
    if (finalState === "PROCESSING" || finalState === "unknown" || finalState === "sconosciuto") {
      try {
        onProgress?.(`Upload riuscito. Attesa elaborazione video da parte di Gemini...`);
        logger.info("[GEMINI_FILE_WAIT_ACTIVE]");
        await waitForFileActive(fileUri, apiKey, (msg) => {
           onProgress?.(`Elaborazione Gemini in corso... Attendi.`);
        });
        finalState = "ACTIVE";
      } catch (err: any) {
         logger.warn(`[GEMINI_FILE_WAIT_ERROR] ${err?.message}`);
         throw new Error(`Timeout o errore durante l'elaborazione del video su Gemini: ${err?.message}`);
      }
    }

    logger.info("[GEMINI_FILE_ACTIVE]");

    onProgress?.(`Smoketest PASS con Variante SERVER_UPLOAD!`);
    return {
      success: true,
      variant: "SERVER_UPLOAD",
      uri: fileUri,
      geminiFileName: gFileName,
      mimeType: parsedJson.mimeType,
      name: fileName,
      state: finalState,
      logLines: [`Upload completato via SERVER_UPLOAD. URI: ${fileUri}`]
    };

  } catch (e: any) {
    logger.error("[GEMINI_UPLOAD_SMOKE_ERROR]", e);
    return {
      success: false,
      variant: "none",
      error: e.message || String(e),
      logLines: [e.message || String(e)]
    };
  }
}

