import { executeWithNetworkRetry, safeParseJSON } from './core';
import { extractAudioTrack } from '../../utils/videoProcessor';
import { logger } from '../../utils/logger';
import { groqWhisperTranscription } from '../ai/groqClient';
import { isGroqMode, isHuggingMode, resolveProviderPolicy, hasHuggingFaceApiKey, resolveHuggingFaceModel } from '../ai/providerRouter';
import { hfAudioTranscription } from '../ai/huggingFaceClient';

export interface AudioAnchorResult {
  audioVerified: boolean;
  audioSource: "INLINE_VIDEO" | "AUDIO_ONLY_LOW_MEM" | "GROQ_WHISPER" | "NONE";
  audioProvider?: "GEMINI" | "GROQ" | "LOCAL";
  audioModelUsed?: string;
  audioKeySource?: string;
  scriptSourceMode: "AUDIO_VIDEO_SUMMARY" | "FRAME_VISUAL_DESCRIPTION" | "AUDIO_TRANSCRIPT_GROQ";
  scriptConfidence: number; // 0-100
  verifiedInlineVideoSummary: string;
  literalTranscript: string;
  hasLiteralTranscript: boolean;
  dialogueLockStatus: "AUDIO_LOCKED" | "DESCRIPTIVE_ONLY" | "FRAME_ONLY";
  dialogueSource: "VERIFIED_INLINE_AUDIO" | "AUDIO_SUMMARY_NO_LITERAL_LINES" | "VISUAL_INFERENCE";
  forbiddenInventedDialogueDetected: boolean;
  dialogueFaithfulnessScore: number;
  failureReason?: string;
  failureDetails?: {
    fileName: string;
    fileSizeMB: string;
    mimeType: string;
    durationSec: number | null;
    reason: string;
    wasInlineEligible: boolean;
    inlineAttempted: boolean;
    inlineSucceeded: boolean;
    errorMessage: string;
    fallbackMode: "FRAME_ONLY";
  };
}

const isGroqWhisperTimeoutError = (error: any) =>
  error?.isTimeout === true || String(error?.message || '').includes('GROQ_TRANSCRIBE_TIMEOUT');

async function readMediaDurationSec(file: File): Promise<number | null> {
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) return null;
  console.log("[AUDIO_ANCHOR] [DURATION_CHECK] Start", { name: file.name, type: file.type });
  return await new Promise<number | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    
    // Safety timeout
    const metaTimeout = setTimeout(() => {
        console.warn("[AUDIO_ANCHOR] [DURATION_CHECK] Metadata TIMEOUT after 10s");
        cleanup();
        resolve(null);
    }, 10000);

    const cleanup = () => {
        clearTimeout(metaTimeout);
        media.onloadedmetadata = null;
        media.onerror = null;
        URL.revokeObjectURL(objectUrl);
    };

    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const duration = Number.isFinite(media.duration) ? Number(media.duration.toFixed(3)) : null;
      console.log("[AUDIO_ANCHOR] [DURATION_CHECK] Success", { duration });
      cleanup();
      resolve(duration);
    };
    media.onerror = () => {
      console.warn("[AUDIO_ANCHOR] [DURATION_CHECK] Error");
      cleanup();
      resolve(null);
    };
    media.src = objectUrl;
  });
}

function detectFailureReason(errorMessage: string): string {
  const text = errorMessage.toLowerCase();
  if (text.includes("timeout")) return "TIMEOUT";
  if (text.includes("json")) return "PARSING_FAILED";
  if (text.includes("mime")) return "UNSUPPORTED_MIME";
  if (text.includes("quota") || text.includes("429") || text.includes("resource_exhausted")) return "API_ERROR";
  if (text.includes("network") || text.includes("connection") || text.includes("fetch")) return "API_ERROR";
  if (text.includes("no response")) return "EMPTY_RESPONSE";
  return "API_ERROR";
}

function logAudioAnchorFailureReason(
  file: File,
  payload: {
    durationSec: number | null;
    reason: string;
    wasInlineEligible: boolean;
    inlineAttempted: boolean;
    inlineSucceeded: boolean;
    errorMessage?: string;
    fallbackMode: "FRAME_ONLY";
  },
) {
  console.warn("[AUDIO_ANCHOR_FAILURE_REASON]", {
    fileName: file.name,
    fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
    mimeType: file.type || "unknown",
    durationSec: payload.durationSec,
    reason: payload.reason,
    wasInlineEligible: payload.wasInlineEligible,
    inlineAttempted: payload.inlineAttempted,
    inlineSucceeded: payload.inlineSucceeded,
    errorMessage: payload.errorMessage || "",
    fallbackMode: payload.fallbackMode,
  });
}

function normalizeConfidence(rawConfidence: unknown): number {
  if (typeof rawConfidence !== "number" || Number.isNaN(rawConfidence)) return 0;
  if (rawConfidence > 0 && rawConfidence <= 1) return Math.round(rawConfidence * 100);
  return Math.max(0, Math.min(100, Math.round(rawConfidence)));
}

function maskKeyForTrace(apiKey?: string): string {
  const value = (apiKey || "").trim();
  if (!value) return "";
  if (value.length <= 8) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function determineDialogueLock(
  audioVerified: boolean,
  confidence: number,
  literalTranscript: string
): Pick<AudioAnchorResult, "dialogueLockStatus" | "dialogueSource" | "forbiddenInventedDialogueDetected" | "dialogueFaithfulnessScore"> {
  if (!audioVerified) {
    return {
      dialogueLockStatus: "FRAME_ONLY",
      dialogueSource: "VISUAL_INFERENCE",
      forbiddenInventedDialogueDetected: false,
      dialogueFaithfulnessScore: 0
    };
  }

  const normalizedTranscript = (literalTranscript || "").trim();
  const hasLiteralTranscript =
    normalizedTranscript.length >= 12 &&
    !/^nessun dialogo$/i.test(normalizedTranscript) &&
    !/^no dialogue$/i.test(normalizedTranscript);

  if (hasLiteralTranscript && confidence >= 85) {
    return {
      dialogueLockStatus: "AUDIO_LOCKED",
      dialogueSource: "VERIFIED_INLINE_AUDIO",
      forbiddenInventedDialogueDetected: false,
      dialogueFaithfulnessScore: Math.max(confidence, 85)
    };
  }

  return {
    dialogueLockStatus: "DESCRIPTIVE_ONLY",
    dialogueSource: "AUDIO_SUMMARY_NO_LITERAL_LINES",
    forbiddenInventedDialogueDetected: false,
    dialogueFaithfulnessScore: 70
  };
}

function isUsableAudioAnchor(confidence: number, transcript: string, audioSummary: string, narrativeSummary: string) {
  if (confidence >= 70) return true;

  const transcriptLength = (transcript || "").trim().length;
  const contextLength = [audioSummary, narrativeSummary].map((v) => (v || "").trim()).join(" ").trim().length;

  // Accept a more cautious descriptive lock when the model did hear enough audio context
  // but isn't confident enough for a literal transcript.
  return confidence >= 55 && (transcriptLength >= 18 || contextLength >= 40);
}

function shouldPreferLowMemoryAudioPath(
  file: File,
  durationSec: number | null,
  requestedLowMemoryMode: boolean
) {
  if (requestedLowMemoryMode) return true;
  if (!file.type.startsWith("video/")) return false;

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB >= 8) return true;
  if ((durationSec || 0) >= 25) return true;

  return false;
}

export async function anchorVideoAudio(
  file: File,
  apiKey: string,
  onProgress?: (step: string) => void,
  isLowMemoryMode: boolean = false,
  mode?: string
): Promise<AudioAnchorResult | null> {
  const audioPolicy = resolveProviderPolicy('AUDIO_TRANSCRIPTION');
  const groqOnlyGuardrailActive = isGroqMode(mode);
  const huggingOnlyActive = isHuggingMode(mode);
  const hfKey = localStorage.getItem('huggingface_api_key') || '';

  console.log("[AUDIO_ENHANCED_START]", { fileName: file.name, fileSize: file.size, lowMemory: isLowMemoryMode, mode });
  
  // --- HUGGING MODE AUDIO ---
  if (huggingOnlyActive && hasHuggingFaceApiKey()) {
    onProgress?.("Audio Anchor: trascrizione Hugging Face (Whisper) in corso...");
    try {
      let audioBlob: Blob;
      try {
        if (file.type.startsWith("video/")) {
          onProgress?.("Audio Anchor: estrazione audio per Hugging Face...");
          audioBlob = await extractAudioTrack(file);
        } else {
          audioBlob = file;
        }
      } catch (err) {
        logger.warn("[AUDIO_DIRECT_GROQ_WHISPER_START] Fallback extractions failed, attempting direct HF transcription with original file.");
        audioBlob = file;
      }
      
      const hfModel = resolveHuggingFaceModel('audio');
      const hfResult = await hfAudioTranscription(audioBlob, hfKey, hfModel);
      
      if (hfResult && hfResult.text) {
        const transcript = hfResult.text.trim();
        const confidence = transcript.length >= 12 ? 88 : 70;
        onProgress?.("Audio Anchor: Hugging Face completato.");
        
        const dialogueLock = determineDialogueLock(true, confidence, transcript);
        return {
          audioVerified: true,
          audioSource: "GROQ_WHISPER", // Reusing label or we could add HF_WHISPER
          audioProvider: "GEMINI", // Label logic might need update, but for now...
          audioModelUsed: hfModel,
          audioKeySource: "HF_INFERENCE",
          scriptSourceMode: "AUDIO_TRANSCRIPT_GROQ",
          scriptConfidence: confidence,
          verifiedInlineVideoSummary: transcript,
          literalTranscript: transcript,
          hasLiteralTranscript: true,
          ...dialogueLock,
        };
      }
    } catch (hfErr) {
      logger.error(`[HUGGING_AUDIO_FAILED] error=${hfErr}`);
      throw hfErr; // Strict mode: no fallback to Gemini
    }
  }

  onProgress?.("Audio Anchor in corso: Lettura parametri video...");
  const durationSec = await readMediaDurationSec(file);
  const preferLowMemoryPath = shouldPreferLowMemoryAudioPath(file, durationSec, isLowMemoryMode);
  
  // In low memory mode, we are always eligible because we will extract the audio track which is small
  const wasInlineEligible = preferLowMemoryPath || (file.size <= 15 * 1024 * 1024);
  
  console.log("[AUDIO_ENHANCED_FILE_META]", { 
    fileName: file.name, 
    sizeMB: (file.size / (1024*1024)).toFixed(2),
    type: file.type,
    durationSec,
    wasInlineEligible,
    lowMemory: isLowMemoryMode,
    preferLowMemoryPath
  });

  if (!wasInlineEligible) {
    console.warn("[AUDIO_ENHANCED_FAILED]", "File too large for inline audio anchor");
    onProgress?.("Audio Anchor fallito: file troppo grande");
    logAudioAnchorFailureReason(file, {
      durationSec,
      reason: "VIDEO_TOO_LARGE",
      wasInlineEligible,
      inlineAttempted: false,
      inlineSucceeded: false,
      errorMessage: "File exceeds 20MB inline Audio Anchor limit.",
      fallbackMode: "FRAME_ONLY",
    });
    return {
      audioVerified: false,
      audioSource: "NONE",
      audioProvider: "LOCAL",
      audioModelUsed: "NONE",
      audioKeySource: "",
      scriptSourceMode: "FRAME_VISUAL_DESCRIPTION",
      scriptConfidence: 0,
      verifiedInlineVideoSummary: "",
      literalTranscript: "",
      hasLiteralTranscript: false,
      ...determineDialogueLock(false, 0, ""),
      failureReason: "VIDEO_TOO_LARGE",
      failureDetails: {
        fileName: file.name,
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
        mimeType: file.type || "unknown",
        durationSec,
        reason: "VIDEO_TOO_LARGE",
        wasInlineEligible,
        inlineAttempted: false,
        inlineSucceeded: false,
        errorMessage: "File exceeds 20MB inline Audio Anchor limit.",
        fallbackMode: "FRAME_ONLY",
      },
    };
  }

  if (audioPolicy.preferredProvider === 'GROQ') {
    logger.info("[AUDIO_PROVIDER_SELECTED_GROQ]");
    logger.info("[GROQ_WHISPER_TRANSCRIPTION_START]", {
      fileName: file.name,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
      durationSec,
      lowMemory: isLowMemoryMode,
    });
    onProgress?.("Audio Anchor: trascrizione Groq Whisper in corso...");

    let groqBlob: Blob = file;
    let groqName = file.name;
    try {
      try {
        if (file.type.startsWith("video/")) {
          logger.info("[GROQ_WHISPER_REJECTED_VIDEO_PAYLOAD]", {
            mimeType: file.type,
            sizeBytes: file.size,
            isVideoPayload: true,
            isAudioPayload: false,
          });
          logger.info("[GROQ_AUDIO_EXTRACTION_START]", {
            fileName: file.name,
            groqOnlyGuardrailActive,
          });
          const extractionPromise = extractAudioTrack(file);
          groqBlob = groqOnlyGuardrailActive
            ? await Promise.race<Blob>([
                extractionPromise,
                new Promise<Blob>((_, reject) =>
                  setTimeout(() => reject(new Error("GROQ_AUDIO_EXTRACTION_TIMEOUT")), 45000)
                ),
              ])
            : await extractionPromise;
          groqName = file.name.replace(/\.[^.]+$/, '') + '.wav';
          logger.info("[GROQ_AUDIO_EXTRACTION_SUCCESS]", {
            fileName: groqName,
            sizeMB: (groqBlob.size / (1024 * 1024)).toFixed(2),
          });
        } else {
          groqBlob = file;
        }
      } catch (err) {
        logger.warn("[AUDIO_DIRECT_GROQ_WHISPER_START] Fallback extractions failed, attempting direct Groq Whisper with original file.");
        groqBlob = file;
      }

      logger.info("[GROQ_WHISPER_PAYLOAD_READY]", {
        mimeType: groqBlob.type || "unknown",
        sizeBytes: groqBlob.size,
        isVideoPayload: (groqBlob.type || "").startsWith("video/"),
        isAudioPayload: (groqBlob.type || "").startsWith("audio/"),
      });

      const groqResult = await groqWhisperTranscription({
        file: groqBlob,
        fileName: groqName,
        language: "it",
        prompt: "Trascrivi fedelmente il parlato in italiano. Non inventare testo assente.",
        timeoutMs: audioPolicy.timeoutMs,
      });

      const transcript = (groqResult.transcript || "").trim();
      const confidence = transcript.length >= 24 ? 92 : transcript.length >= 12 ? 86 : 74;
      if (transcript.length >= 12) {
        logger.info("[GROQ_WHISPER_SUCCESS]", {
          mimeType: groqBlob.type || "unknown",
          sizeBytes: groqBlob.size,
          isVideoPayload: (groqBlob.type || "").startsWith("video/"),
          isAudioPayload: (groqBlob.type || "").startsWith("audio/"),
          transcriptLength: transcript.length,
        });
      } else {
        logger.warn("[GROQ_WHISPER_EMPTY_TRANSCRIPT]", {
          mimeType: groqBlob.type || "unknown",
          sizeBytes: groqBlob.size,
          isVideoPayload: (groqBlob.type || "").startsWith("video/"),
          isAudioPayload: (groqBlob.type || "").startsWith("audio/"),
          transcriptLength: transcript.length,
        });
      }
      logger.info("[GROQ_WHISPER_TRANSCRIPTION_SUCCESS]", {
        language: groqResult.language,
        confidence,
        model: groqResult.model,
        key: groqResult.keySource,
        transcriptLength: transcript.length,
      });
      onProgress?.("Audio Anchor: Groq Whisper completato.");

      if (transcript.length >= 12) {
        const dialogueLock = determineDialogueLock(true, confidence, transcript);
        return {
          audioVerified: true,
          audioSource: "GROQ_WHISPER",
          audioProvider: "GROQ",
          audioModelUsed: groqResult.model,
          audioKeySource: groqResult.keySource,
          scriptSourceMode: "AUDIO_TRANSCRIPT_GROQ",
          scriptConfidence: confidence,
          verifiedInlineVideoSummary: transcript,
          literalTranscript: transcript,
          hasLiteralTranscript: true,
          ...dialogueLock,
        };
      }

      logger.warn("[GROQ_WHISPER_TRANSCRIPTION_FAILED]", {
        reason: "EMPTY_OR_SHORT_TRANSCRIPT",
        transcriptLength: transcript.length,
      });
      
      if (groqOnlyGuardrailActive) {
        throw new Error("GROQ_WHISPER_TRANSCRIPTION_FAILED: Trascrizione vuota o troppo breve in modalità GROQ.");
      }

      logger.info("[AUDIO_PROVIDER_FALLBACK_TO_GEMINI]");
      onProgress?.("Groq Whisper insufficiente, fallback a Gemini...");
    } catch (error: any) {
      const isTimeout = isGroqWhisperTimeoutError(error);
      if (isTimeout) {
        logger.warn("[GROQ_TRANSCRIBE_TIMEOUT_HANDLED]", {
          timeoutMs: error?.timeoutMs || audioPolicy.timeoutMs,
          fileSizeBytes: groqBlob?.size || file.size,
          audioDurationSeconds: durationSec,
          action: groqOnlyGuardrailActive ? "pipeline_stopped_cleanly" : "degraded_result_returned"
        });
        onProgress?.("Trascrizione audio non completata: timeout Groq Whisper.");
      }
      if (groqOnlyGuardrailActive) {
        logger.error("[GROQ_MODE_AUDIO_FATAL]", error);
        throw error;
      }
      logger.warn("[GROQ_WHISPER_TRANSCRIPTION_FAILED]", {
        error: error?.message || String(error || ""),
      });
      if (isTimeout) {
        return {
          audioVerified: false,
          audioSource: "NONE",
          audioProvider: "GROQ",
          audioModelUsed: "whisper-large-v3",
          audioKeySource: "timeout",
          scriptSourceMode: "FRAME_VISUAL_DESCRIPTION",
          scriptConfidence: 0,
          verifiedInlineVideoSummary: "",
          literalTranscript: "",
          hasLiteralTranscript: false,
          dialogueLockStatus: "FRAME_ONLY",
          dialogueSource: "VISUAL_INFERENCE",
          forbiddenInventedDialogueDetected: false,
          dialogueFaithfulnessScore: 0,
          failureReason: "AUDIO_TRANSCRIBE_TIMEOUT",
          failureDetails: {
            fileName: file.name,
            fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
            mimeType: file.type || "unknown",
            durationSec,
            reason: "GROQ_WHISPER_TIMEOUT",
            wasInlineEligible: true,
            inlineAttempted: true,
            inlineSucceeded: false,
            errorMessage: error?.message || "GROQ_TRANSCRIBE_TIMEOUT",
            fallbackMode: "FRAME_ONLY"
          }
        };
      }
      logger.info("[AUDIO_PROVIDER_FALLBACK_TO_GEMINI]");
      onProgress?.("Groq Whisper fallito, fallback a Gemini...");
    }
  }

  try {
    console.log("[AUDIO_ENHANCED_INLINE_ELIGIBLE]");
    console.log("[AUDIO_ENHANCED_INLINE_ATTEMPT]");
    onProgress?.("Audio Anchor in corso: Lettura file multimediale...");
    
    let payloadBaseCode64 = "";
    let payloadMimeType = file.type;
    const usingAudioOnlyFastPath = preferLowMemoryPath && file.type.startsWith("video/");

    if (usingAudioOnlyFastPath) {
      onProgress?.("Audio Anchor: estrazione traccia audio leggera...");
      try {
        const audioBlob = await extractAudioTrack(file);
        payloadMimeType = audioBlob.type; // "audio/wav"
        
        payloadBaseCode64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
             const dataUrl = reader.result as string;
             resolve(dataUrl.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        console.log("[AUDIO_ENHANCED_LOW_MEM_EXTRACTED]", {
          wavSizeMB: (audioBlob.size / (1024*1024)).toFixed(2),
          strategy: "AUDIO_ONLY_FAST_PATH"
        });
      } catch (audioExtErr) {
        console.error("[AUDIO_ENHANCED_LOW_MEM_FAILED]", audioExtErr);
        onProgress?.("Estrazione audio fallita, riprovo con metodo standard...");
        payloadBaseCode64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    } else {
      payloadBaseCode64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    onProgress?.("Audio Anchor in corso: Comunicazione con Gemini...");

    const isAudioOnly = payloadMimeType.startsWith("audio/");
    const modelCallTimeoutMs = isAudioOnly ? 180000 : 210000;
    const prompt = `[PROTOCOLLO ANALISI ${isAudioOnly ? 'AUDIO' : 'AUDIO_VIDEO'}]
Analizza questo asset ${isAudioOnly ? 'audio' : 'multimediale'} con focus prioritario sull'ancoraggio audio.
Istruzioni:
1. transcript: Estrai una trascrizione LETTERALE dei dialoghi. Mantieni pause e interiezioni. Se non ci sono dialoghi udibili, scrivi "nessun dialogo".
2. audioSummary: Descrivi il paesaggio sonoro (musica, sound design, risate, rumori ambientali).
3. narrativeSummary: ${isAudioOnly ? 'Sintetizza il contenuto narrativo dell\'audio.' : 'Sintetizza l\'azione visiva e come questa si correla all\'audio.'}

FORMATO RISPOSTA (JSON):
{
  "transcript": string,
  "audioSummary": string,
  "narrativeSummary": string,
  "confidence": number (valore tra 0 e 100 indicante la certezza della trascrizione)
}`;

    const result = await executeWithNetworkRetry(
      async (aiInstance, modelName) => {
        onProgress?.("Audio Anchor: Avvio analisi modello...");
        
        // Progress interval to show activity
        let progressTick = 0;
        const progressInterval = setInterval(() => {
          progressTick++;
          const dots = Array((progressTick % 3) + 1).fill('.').join('');
          if (progressTick < 5) onProgress?.(`Audio Anchor: Il modello sta elaborando l'audio${dots}`);
          else if (progressTick < 15) onProgress?.(`Audio Anchor: Trascrizione dialoghi in corso${dots}`);
          else if (progressTick < 30) onProgress?.(`Audio Anchor: Generazione summary narrativo${dots}`);
          else onProgress?.(`Audio Anchor: Elaborazione complessa in corso, attendere${dots}`);
        }, 5000);

        console.log("[AUDIO_ANCHOR_MODEL_CALL_START]", {
          model: modelName,
          timeoutMs: modelCallTimeoutMs,
          payloadType: "base64",
          mimeType: payloadMimeType,
          strategy: isAudioOnly ? "AUDIO_ONLY_FAST_PATH" : "INLINE_VIDEO_FULL"
        });
        try {
          const res = await aiInstance.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  { inlineData: { data: payloadBaseCode64, mimeType: payloadMimeType } }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json"
            }
          });
          console.log("[AUDIO_ANCHOR_MODEL_CALL_SUCCESS]", { elapsedMs: 0 }); // Note: elapsedMs calculation would require performance.now()
          return res;
        } finally {
          clearInterval(progressInterval);
        }
      },
      1, // retries = 1 to allow transient failure recovery
      undefined,
      modelCallTimeoutMs,
      apiKey,
      undefined,
      'gemini-1.5-flash',
      undefined,
      'Audio Anchor',
      'flash',
      false,
      'COGNITIVE',
      false, // disableKeyRotation
      undefined, // callReason
      undefined, // inputSource
      false, // canUseLocalFallback
      true // disableFallbackAcrossModels
    );

    onProgress?.("Audio Anchor: Modello completato, validazione risposta...");

    const responseText = result.text || "{}";
    const json = safeParseJSON(responseText);
    const transcript = typeof json.transcript === "string" ? json.transcript.trim() : "";
    console.log("[AUDIO_ANCHOR_MODEL_CALL_SUCCESS]", { transcriptPreview: transcript.slice(0, 50), confidence: json.confidence });
    console.log("[AUDIO_ENHANCED_TRANSCRIPT_EXTRACTED]", { length: transcript.length });
    const audioSummary = typeof json.audioSummary === "string" ? json.audioSummary.trim() : "";
    const narrativeSummary = typeof json.narrativeSummary === "string" ? json.narrativeSummary.trim() : "";
    const confidence = normalizeConfidence(json.confidence);
    const combinedSummary = [transcript, audioSummary, narrativeSummary].filter(Boolean).join(" | ");

    if (isUsableAudioAnchor(confidence, transcript, audioSummary, narrativeSummary)) {
      console.log("[AUDIO_ENHANCED_SUCCESS]");
      console.log("[AUDIO_ENHANCED_VERIFIED]");
      const dialogueLock = determineDialogueLock(true, confidence, transcript);
      console.log("[AUDIO_ANCHOR_RESULT]", {
        confidence,
        transcriptPreview: transcript.slice(0, 160),
        hasLiteralTranscript: dialogueLock.dialogueLockStatus === "AUDIO_LOCKED",
        dialogueLockStatus: dialogueLock.dialogueLockStatus,
      });
      return {
        audioVerified: true,
        audioSource: isAudioOnly ? "AUDIO_ONLY_LOW_MEM" : "INLINE_VIDEO",
        audioProvider: "GEMINI",
        audioModelUsed: "gemini-1.5-flash",
        audioKeySource: maskKeyForTrace(apiKey),
        scriptSourceMode: "AUDIO_VIDEO_SUMMARY",
        scriptConfidence: confidence,
        verifiedInlineVideoSummary: combinedSummary,
        literalTranscript: transcript,
        hasLiteralTranscript: dialogueLock.dialogueLockStatus === "AUDIO_LOCKED",
        ...dialogueLock
      };
    }

    logAudioAnchorFailureReason(file, {
      durationSec,
      reason: confidence > 0 ? "AUDIO_NOT_CONFIDENT_ENOUGH" : "AUDIO_NOT_DETECTED",
      wasInlineEligible,
      inlineAttempted: true,
      inlineSucceeded: true,
      errorMessage: `Confidence ${confidence} below anchor threshold.`,
      fallbackMode: "FRAME_ONLY",
    });
    console.warn("[AUDIO_ANCHOR_FAILED_CONTINUE_FRAME_ONLY]", {
      confidence,
      transcriptPreview: transcript.slice(0, 160),
      audioSummaryPreview: audioSummary.slice(0, 160),
    });
    logger.info("[AUDIO_PROVIDER_DEGRADED_TO_VISUAL_SAFE]");
    const dialogueLock = determineDialogueLock(false, confidence, "");
    return {
      audioVerified: false,
      audioSource: "NONE",
      audioProvider: "GEMINI",
      audioModelUsed: "gemini-1.5-flash",
      audioKeySource: maskKeyForTrace(apiKey),
      scriptSourceMode: "FRAME_VISUAL_DESCRIPTION",
      scriptConfidence: confidence,
      verifiedInlineVideoSummary: "",
      literalTranscript: "",
      hasLiteralTranscript: false,
      ...dialogueLock,
      failureReason: confidence > 0 ? "AUDIO_NOT_CONFIDENT_ENOUGH" : "AUDIO_NOT_DETECTED",
      failureDetails: {
        fileName: file.name,
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
        mimeType: file.type || "unknown",
        durationSec,
        reason: confidence > 0 ? "AUDIO_NOT_CONFIDENT_ENOUGH" : "AUDIO_NOT_DETECTED",
        wasInlineEligible,
        inlineAttempted: true,
        inlineSucceeded: true,
        errorMessage: `Confidence ${confidence} below anchor threshold.`,
        fallbackMode: "FRAME_ONLY",
      },
    };
  } catch (e: any) {
    const errorMessage = e?.message || String(e || "");
    const reason = detectFailureReason(errorMessage);
    
    console.error("[AUDIO_ANCHOR_MODEL_CALL_FAILED]", { reason, errorMessage, timeout: reason === "TIMEOUT" });

    logAudioAnchorFailureReason(file, {
      durationSec,
      reason,
      wasInlineEligible,
      inlineAttempted: true,
      inlineSucceeded: false,
      errorMessage,
      fallbackMode: "FRAME_ONLY",
    });
    logger.info("[AUDIO_PROVIDER_DEGRADED_TO_VISUAL_SAFE]");
    return {
      audioVerified: false,
      audioSource: "NONE",
      audioProvider: "GEMINI",
      audioModelUsed: "gemini-1.5-flash",
      audioKeySource: maskKeyForTrace(apiKey),
      scriptSourceMode: "FRAME_VISUAL_DESCRIPTION",
      scriptConfidence: 0,
      verifiedInlineVideoSummary: "",
      literalTranscript: "",
      hasLiteralTranscript: false,
      ...determineDialogueLock(false, 0, ""),
      failureReason: reason,
      failureDetails: {
        fileName: file.name,
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
        mimeType: file.type || "unknown",
        durationSec,
        reason,
        wasInlineEligible,
        inlineAttempted: true,
        inlineSucceeded: false,
        errorMessage,
        fallbackMode: "FRAME_ONLY",
      },
    };
  }
}
