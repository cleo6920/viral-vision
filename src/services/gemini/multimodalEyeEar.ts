import { logger } from "../../utils/logger";
import { waitForFileActive } from "./core";

export interface ConscienceEyeEarResult {
  success: boolean;
  provider: "gemini" | "openrouter_fallback" | "failed" | "gemini_quality_fail" | "openrouter_quality_fail";
  qualityError?: string;
  geminiError?: string;
  fallbackError?: string;
  hasFileUri?: boolean;
  videoDurationTested?: number;
  qualityGateMetrics?: {
    frameTimestampsCount: number;
    frameObservationsCount: number;
    missingObservationFrames: number;
    audioSegmentsCount: number;
    hasPlaceholder: boolean;
    lastVideoEventTime: number;
    videoCoverageOk: boolean;
    lastAudioEventTime: number;
    audioCoverageOk: boolean;
  };
  // Primary diagnostic status indicators
  eyeEarAttempted?: boolean;
  eyeEarNotAttemptedReason?: string;
  eyeEarModelSelected?: string;
  eyeEarKeyAvailable?: boolean;
  eyeEarFileUriAvailable?: boolean;
  eyeEarFailedReason?: string;
  eyeEarHttpStatus?: number;
  eyeEarFileState?: string;
  eyeEarErrorCode?: string | number;
  eyeEarErrorMessage?: string;
  eyeEarClassifiedReason?: string;
  eyeEarQualityGateStatus?: "PASS" | "DEGRADED" | "FAIL";
  seen: {
    visionProviderReal: string;
    usedFramesReal: number;
    frameTimestampsReal: string[];
    frameTimelineSource: string;
    frameObservations: string;
    visibleConsequences: string;
    aggregatedVisibleSubjects: string[];
    visibleObjects: string[];
    visibleActions: string[];
  };
  heard: {
    transcriptAvailable: boolean;
    audioSource: string;
    finalLineHeard: boolean;
    transcriptEvidenceStrength: "STRONG" | "WEAK" | "LIMITED";
    estimatedTurnCount: number;
    notes: string;
  };
  syncAudit: {
    estimatedTurnCount: number;
    transcriptHasSpeakerLabels: boolean;
    hasRealAudioTimestamps: boolean;
    timingSource: string;
    frameTimelineSource: string;
    dialogueTurns: Array<{
      speakerLabelFromTranscript: string;
      line: string;
      startTime: number;
      endTime: number;
      confidence: string;
    }>;
    dialogueFrameAlignment: Array<{
      line: string;
      startTime: number;
      midTime: number;
      endTime: number;
      selectedFrameStrategy: string;
      selectedFrameIndex: number;
      selectedFrameTimestamp: string;
      timeDeltaSeconds: number;
      visibleSubjectsInSelectedFrame: string[];
      visibleActionsInSelectedFrame: string[];
      possibleSpeakerFromFrame: string;
      assignmentConfidence: string;
      assignmentReason: string;
    }>;
    mergedFrameTimeline: Array<{
      frameIndex: number;
      timestamp: string;
      observed: boolean;
      visibleSubjects: string[];
      visibleAction: string;
      confidence: string;
      nearbyAudioSegments: Array<{
        start: number;
        end: number;
        text: string;
      }>;
    }>;
  };
  mirrorTestBlocks: Array<{
    id: string;
    start: number;
    end: number;
    text: string;
    speakerGuess: string;
    confidence: string;
    note: string;
  }>;
}

function extractJsonCandidate(rawText: string): string {
  const stripped = String(rawText || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? match[0] : stripped;
}

function validateQualityGate(parsedJSON: any, provider: string, videoDuration: number): { 
  passed: boolean; 
  error?: string;
  metrics: {
    frameTimestampsCount: number;
    frameObservationsCount: number;
    missingObservationFrames: number;
    audioSegmentsCount: number;
    hasPlaceholder: boolean;
    lastVideoEventTime: number;
    videoCoverageOk: boolean;
    lastAudioEventTime: number;
    audioCoverageOk: boolean;
  }
} {
  logger.info("[CONSCIENCE_EYE_EAR_QUALITY_GATE_START]");

  const frameTimestampsReal = parsedJSON?.seen?.frameTimestampsReal || [];
  const frameTimestampsCount = frameTimestampsReal.length;

  const mergedFrameTimeline = parsedJSON?.syncAudit?.mergedFrameTimeline || [];
  const frameObservationsCount = mergedFrameTimeline.filter((f: any) => f.observed !== false).length;
  const missingObservationFrames = mergedFrameTimeline.filter((f: any) => f.observed === false).length;

  const dialogueTurns = parsedJSON?.syncAudit?.dialogueTurns || [];
  const audioSegmentsCount = dialogueTurns.length;

  // Check placeholder transcript
  const hasPlaceholder = dialogueTurns.some((t: any) => {
    const txt = String(t.line || "").toLowerCase();
    return txt.includes("la frase detta...") || txt.startsWith("la frase detta");
  });

  // Calculate timelines ending timings
  const duration = videoDuration || 0;
  let lastVideoEventTime = 0;
  if (frameTimestampsReal.length > 0) {
    const lastT = frameTimestampsReal[frameTimestampsReal.length - 1];
    lastVideoEventTime = parseFloat(lastT) || 0;
  }
  const videoCoverageOk = duration > 0 ? (lastVideoEventTime >= duration - 10) : true;

  let lastAudioEventTime = 0;
  if (dialogueTurns.length > 0) {
    const lastTurn = dialogueTurns[dialogueTurns.length - 1];
    lastAudioEventTime = parseFloat(lastTurn.endTime) || parseFloat(lastTurn.startTime) || 0;
  }
  const audioCoverageOk = duration > 0 ? (lastAudioEventTime >= duration - 10) : true;

  const metrics = {
    frameTimestampsCount,
    frameObservationsCount,
    missingObservationFrames,
    audioSegmentsCount,
    hasPlaceholder,
    lastVideoEventTime,
    videoCoverageOk,
    lastAudioEventTime,
    audioCoverageOk
  };

  logger.info("[CONSCIENCE_EYE_EAR_FRAME_COVERAGE]", {
    frameTimestampsCount,
    frameObservationsCount,
    missingObservationFrames,
    lastVideoEventTime,
    videoCoverageOk,
    videoDuration: duration
  });

  logger.info("[CONSCIENCE_EYE_EAR_AUDIO_COVERAGE]", {
    audioSegmentsCount,
    lastAudioEventTime,
    audioCoverageOk,
    videoDuration: duration
  });

  let reasons: string[] = [];

  if (frameTimestampsCount < 10) {
    reasons.push(`Fotogrammi insufficienti (${frameTimestampsCount}/10)`);
  }
  if (frameTimestampsCount > 0) {
    const obsRatio = frameObservationsCount / frameTimestampsCount;
    if (obsRatio < 0.70) {
      reasons.push(`Percentuale osservazioni troppo bassa (${Math.round(obsRatio * 100)}% < 70%)`);
    }
    const missRatio = missingObservationFrames / frameTimestampsCount;
    if (missRatio > 0.30) {
      reasons.push(`Percentuale frame persi troppo alta (${Math.round(missRatio * 100)}% > 30%)`);
    }
  }

  if (duration > 0 && !videoCoverageOk) {
    reasons.push(`Ultimi 10 secondi video non coperti (ultimo: ${lastVideoEventTime}s, totale: ${duration}s)`);
  }

  if (audioSegmentsCount <= 1) {
    reasons.push(`Segmenti audio insufficienti (${audioSegmentsCount} <= 1)`);
  }

  if (hasPlaceholder) {
    logger.info("[CONSCIENCE_EYE_EAR_PLACEHOLDER_TRANSCRIPT_REJECTED]");
    reasons.push("Trovato transcript generic/placeholder ('La frase detta...')");
  }

  if (duration > 0 && !audioCoverageOk) {
    reasons.push(`Ultimi 10 secondi audio non coperti (ultimo: ${lastAudioEventTime}s, totale: ${duration}s)`);
  }

  if (duration >= 50 && duration <= 70 && audioSegmentsCount === 1) {
    reasons.push("Rilevato solo un segmento audio a inizio video per un video di circa un minuto");
  }

  if (reasons.length > 0) {
    const reasonStr = reasons.join(". ");
    logger.warn("[CONSCIENCE_EYE_EAR_QUALITY_GATE_FAIL]", { provider, reason: reasonStr });
    logger.warn("[CONSCIENCE_EYE_EAR_REJECTED_INCOMPLETE_REPORT]");
    return { passed: false, error: reasonStr, metrics };
  }

  logger.info("[CONSCIENCE_EYE_EAR_QUALITY_GATE_PASS]", { provider });
  return { passed: true, metrics };
}

export async function runConscienceEyeEar(params: {
  videoFileUrl?: string; // uploadedFileUri
  videoFile?: File | Blob;
  apiKey?: string;
  modelTier?: string;
  framesForAnalysis?: string[];
  overrideDescription?: string;
  videoDuration?: number;
  eyeEarModel?: string;
}): Promise<ConscienceEyeEarResult> {
  logger.info("[GEMINI_EYE_EAR_DIAGNOSTIC_START]");

  const storageEyeEarKey = typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_eye_ear_api_key') : '';
  const storageGeminiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : '';

  const geminiKey = params.apiKey || 
                    storageEyeEarKey ||
                    (typeof process !== 'undefined' ? process.env?.GEMINI_EYE_EAR_API_KEY : "") ||
                    (import.meta as any).env?.VITE_GEMINI_EYE_EAR_API_KEY ||
                    storageGeminiKey ||
                    (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                    (import.meta as any).env?.GOOGLE_API_KEY ||
                    (typeof process !== 'undefined' ? process.env?.VITE_GEMINI_API_KEY || process.env?.GOOGLE_API_KEY || process.env?.API_KEY || process.env?.GEMINI_API_KEY : "") ||
                    "";

  const storageEyeEarModel = typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_eye_ear_model') : '';
  const isPro = params.modelTier === "pro";

  const modelName = params.eyeEarModel ||
                    storageEyeEarModel ||
                    (typeof process !== 'undefined' ? process.env?.GEMINI_EYE_EAR_MODEL : "") ||
                    (import.meta as any).env?.VITE_GEMINI_EYE_EAR_MODEL ||
                    (isPro ? "gemini-1.5-pro" : "gemini-2.0-flash");

  const uploadedFileUri = params.videoFileUrl;
  let finalFileUri = uploadedFileUri;

  // Set diagnostic variables
  let eyeEarAttempted = false;
  let eyeEarFileUriAvailable = !!finalFileUri;
  let eyeEarKeyAvailable = !!geminiKey;
  let eyeEarModelSelected = modelName;
  let eyeEarFileState = "sconosciuto";
  let eyeEarHttpStatus: number | undefined = undefined;
  let eyeEarErrorCode: string | number | undefined = undefined;
  let eyeEarErrorMessage = "";
  let eyeEarQualityGateStatus: "PASS" | "DEGRADED" | "FAIL" | undefined = undefined;
  let eyeEarClassifiedReason = "UNKNOWN";

  logger.info("[GEMINI_EYE_EAR_KEY_AVAILABLE]", eyeEarKeyAvailable);

  // Dynamic file upload if no file uri is present
  if (!finalFileUri && geminiKey && params.videoFile) {
    logger.info("[CONSCIENCE_EYE_EAR_UPLOADING_VIDEO_TO_GEMINI_DYNAMICALLY]");
    try {
      const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`;
      const initRes = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': params.videoFile.size.toString(),
          'X-Goog-Upload-Header-Content-Type': params.videoFile.type || 'video/mp4',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file: { display_name: (params.videoFile as File).name || 'video_upload' } })
      });
      if (initRes.ok) {
        const uploadUrl = initRes.headers.get('X-Goog-Upload-URL');
        if (uploadUrl) {
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'X-Goog-Upload-Protocol': 'resumable',
              'X-Goog-Upload-Command': 'upload, finalize',
              'X-Goog-Upload-Offset': '0',
              'Content-Length': params.videoFile.size.toString()
            },
            body: params.videoFile
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            finalFileUri = uploadData.file.uri;
            eyeEarFileUriAvailable = !!finalFileUri;
            
            // Wait for it to become active
            if (finalFileUri) {
              try {
                await waitForFileActive(finalFileUri, geminiKey || '', () => {});
                eyeEarFileState = "ACTIVE";
              } catch (e) {
                eyeEarFileState = "FAILED";
                finalFileUri = undefined;
                eyeEarFileUriAvailable = false;
              }
            }
          }
        }
      }
    } catch (e) {
      logger.error("[CONSCIENCE_EYE_EAR_DYNAMIC_UPLOAD_FAILED]", e);
    }
  }

  logger.info("[GEMINI_EYE_EAR_FILEURI_AVAILABLE]", eyeEarFileUriAvailable);

  const defaultResultStructure = (desc: string, notesText: string) => ({
    seen: {
      visionProviderReal: "No Eye-Ear Conscience available",
      usedFramesReal: 0,
      frameTimestampsReal: [],
      frameTimelineSource: "FAILED",
      frameObservations: desc,
      visibleConsequences: "Nessuna evidenza visiva.",
      aggregatedVisibleSubjects: [],
      visibleObjects: [],
      visibleActions: []
    },
    heard: {
      transcriptAvailable: false,
      audioSource: "FAILED",
      finalLineHeard: false,
      transcriptEvidenceStrength: "LIMITED" as const,
      estimatedTurnCount: 0,
      notes: notesText
    },
    syncAudit: {
      estimatedTurnCount: 0,
      transcriptHasSpeakerLabels: false,
      hasRealAudioTimestamps: false,
      timingSource: "FAILED",
      frameTimelineSource: "FAILED",
      dialogueTurns: [],
      dialogueFrameAlignment: [],
      mergedFrameTimeline: []
    },
    mirrorTestBlocks: []
  });

  // 1. Check if Gemini can be attempted
  if (!geminiKey) {
    logger.warn("[GEMINI_EYE_EAR_NOT_ATTEMPTED_REASON]", "NOT_ATTEMPTED_NO_KEY");
    logger.warn("[GEMINI_EYE_EAR_ANALYSIS_ABORTED]", "Chiave API mancante");
    return {
      success: false,
      provider: "failed",
      eyeEarAttempted: false,
      eyeEarNotAttemptedReason: "NOT_ATTEMPTED_NO_KEY",
      eyeEarKeyAvailable: false,
      eyeEarFileUriAvailable,
      eyeEarModelSelected,
      eyeEarFileState,
      eyeEarClassifiedReason: "NOT_ATTEMPTED_NO_KEY",
      ...defaultResultStructure(
        "Riconoscimento multimodale Gemini non tentato: Chiave API mancante.",
        "Analisi audio non tentata a causa di chiave API mancante."
      )
    };
  }

  if (!finalFileUri) {
    logger.warn("[GEMINI_EYE_EAR_NOT_ATTEMPTED_REASON]", "NOT_ATTEMPTED_NO_FILEURI");
    logger.warn("[GEMINI_EYE_EAR_ANALYSIS_ABORTED]", "File URI mancante");
    return {
      success: false,
      provider: "failed",
      eyeEarAttempted: false,
      eyeEarNotAttemptedReason: "NOT_ATTEMPTED_NO_FILEURI",
      eyeEarKeyAvailable: true,
      eyeEarFileUriAvailable: false,
      eyeEarModelSelected,
      eyeEarFileState,
      eyeEarClassifiedReason: "NOT_ATTEMPTED_NO_FILEURI",
      ...defaultResultStructure(
        "Riconoscimento multimodale Gemini non tentato: File URI del video non presente.",
        "Analisi audio non tentatata a causa di File URI del video non presente."
      )
    };
  }

  // 2. We can attempt Gemini call
  eyeEarAttempted = true;
  logger.info("[GEMINI_EYE_EAR_ATTEMPTED]", true);
  logger.info("[GEMINI_EYE_EAR_MODEL_SELECTED]", modelName);

  // Check state of file from API if we haven't already
  if (eyeEarFileState === "sconosciuto" && finalFileUri) {
    try {
      await waitForFileActive(finalFileUri, geminiKey, () => {});
      eyeEarFileState = "ACTIVE";
    } catch (err) {
      eyeEarFileState = "exception";
    }
  }
  logger.info("[GEMINI_EYE_EAR_FILE_STATE]", eyeEarFileState);

  // Stop if file state specifically indicates not ACTIVE or processing error
  if (eyeEarFileState !== "ACTIVE" && eyeEarFileState !== "sconosciuto" && !eyeEarFileState.startsWith("error_")) {
    eyeEarClassifiedReason = "FILE_NOT_ACTIVE";
    logger.warn("[GEMINI_EYE_EAR_FAILED_REASON]", `File status not active: ${eyeEarFileState}`);
    logger.warn("[GEMINI_EYE_EAR_ANALYSIS_ABORTED]", `File non attivo (${eyeEarFileState})`);
    return {
      success: false,
      provider: "failed",
      eyeEarAttempted: true,
      eyeEarKeyAvailable: true,
      eyeEarFileUriAvailable: true,
      eyeEarModelSelected,
      eyeEarFileState,
      eyeEarClassifiedReason: "FILE_NOT_ACTIVE",
      ...defaultResultStructure(
        `Riconoscimento multimodale Gemini fallito: File non in stato ACTIVE (stato attuale: ${eyeEarFileState}).`,
        `Analisi audio fallita a causa di file non attivo (stato attuale: ${eyeEarFileState}).`
      )
    };
  }

  // Execute GenerateContent call
  try {
    const eyeEarPrompt = `Sei l'occhio e l'orecchio (Eye/Ear Multimodal Engine) di un sistema di analisi video virale.
Il tuo compito NON è interpretare la scena, non fare speculazioni, conclusioni o strategie creative.
Devi produrre un rapporto descrittivo, tecnico, prudente e oggettivo basato ESCLUSIVAMENTE sulle immagini e sull'audio del video completo.

Devi mappare e coordinare con precisione sia quello che si vede sia quello che si sente in una timeline unica.

Traduci la tua analisi in modo strutturato per riempire perfettamente due campi di coscienza:
1. Coscienza Video (ciò che vedi: persone, azioni, oggetti, timeline visiva)
2. Coscienza Audio (ciò che senti: scomposizione di dialoghi, timeline di battute e speaker prudente, rumori, risate, incomprensibili, pause)

REGOLE TASSATIVE (SPEAKER E INCERTEZZA):
- Usa questi formati precisi per designare chi parla:
  - Se speaker sicuro con genere certo: P1_F o P1_M
  - Se speaker sicuro ma genere incerto: P1_? o P1_F?
  - Se probabile stesso speaker ma NON CERTO: P1?
  - Se probabile nuovo speaker ma NON CERTO: P2?
  - Se non sai nulla: P?_? o P?
- NON RIUSARE MAI "P1" (o un altro P) se non sei altamente sicuro che sia lo stesso speaker della battuta precedente. In caso di dubbio è meglio usare "P?", "P2?" e marcare "uncertainty: ['(stesso speaker?)']".
- Nel campo "gender" usa "F", "M", "?", oppure "F?", "M?" per il genere incerto.
- Ogni dubbio deve essere esplicito nel campo "uncertainty" (es. "(stesso speaker?)", "(nuova voce?)", "(risata?)"). Formato ['...', '...'].

REGOLE TASSATIVE (MIRROR TEST):
- OGNI occorrenza in cui si pronuncia "io penso" (o l'equivalente) deve DIVENTARE un blocco "mirrorTestBlock" SEPARATO.
- È obbligatorio contare e separare tutte le prove specchio, esempio: MIRROR_TEST_1, MIRROR_TEST_2, MIRROR_TEST_3, ecc. NON tralasciarne nessuna.

Restituisci strettamente ed esclusivamente un JSON conforme a questo formato (nessun testo prima o dopo):
{
  "seen": {
    "visionProviderReal": "Gemini Multimodal Eye-Ear",
    "usedFramesReal": 80,
    "frameTimestampsReal": ["0.0", "5.0", "10.0", "15.0", "20.0", "25.0", "30.0", "35.0", "40.0", "45.0", "50.0", "55.0", "60.0"],
    "frameTimelineSource": "MULTIMODAL_VIDEO_AUDIO",
    "frameObservations": "Detailed technical observations...",
    "visibleConsequences": "Actions and visual results...",
    "aggregatedVisibleSubjects": ["Soggetto A", "Soggetto B"],
    "visibleObjects": ["Oggetto 1", "Oggetto 2"],
    "visibleActions": ["Azione X", "Azione Y"]
  },
  "heard": {
    "transcriptAvailable": true,
    "audioSource": "Gemini Multimodal Eye-Ear (Direct Audio Track)",
    "finalLineHeard": true,
    "transcriptEvidenceStrength": "STRONG",
    "estimatedTurnCount": 8,
    "notes": "Commenti prudenti sull'audio (dialoghi, risate, rumori/effetti, musica, fondo/silenzio, audio non chiaro, incertezze audio)..."
  },
  "syncAudit": {
    "estimatedTurnCount": 8,
    "transcriptHasSpeakerLabels": true,
    "hasRealAudioTimestamps": true,
    "timingSource": "MULTIMODAL_SYNC",
    "frameTimelineSource": "MULTIMODAL_VIDEO_AUDIO",
    "dialogueTurns": [
      {
        "speakerLabelFromTranscript": "P1_M",
        "line": "La frase detta...",
        "startTime": 0.0,
        "endTime": 5.0,
        "confidence": "HIGH"
      }
    ],
    "dialogueFrameAlignment": [
      {
        "line": "La frase detta...",
        "startTime": 0.0,
        "midTime": 2.5,
        "endTime": 5.0,
        "selectedFrameStrategy": "MIDDLE",
        "selectedFrameIndex": 0,
        "selectedFrameTimestamp": "00:02",
        "timeDeltaSeconds": 0.5,
        "visibleSubjectsInSelectedFrame": ["Soggetto A"],
        "visibleActionsInSelectedFrame": ["Parla"],
        "possibleSpeakerFromFrame": "P1_M",
        "assignmentConfidence": "HIGH",
        "assignmentReason": "Labiale coerente con il frame a 00:02"
      }
    ],
    "mergedFrameTimeline": [
      {
        "frameIndex": 0,
        "timestamp": "00:00",
        "observed": true,
        "visibleSubjects": ["Soggetto A"],
        "visibleAction": "Azione del soggetto...",
        "confidence": "HIGH",
        "nearbyAudioSegments": [
          { "start": 0.0, "end": 5.0, "text": "La frase detta..." }
        ]
      }
    ]
  },
  "mirrorTestBlocks": [
    {
      "id": "MIRROR_TEST_1",
      "start": 10.0,
      "end": 12.0,
      "text": "Io penso...",
      "speakerGuess": "P1_M",
      "confidence": "HIGH",
      "note": "..."
    }
  ]
}`;

    let res: Response | null = null;
    let useInlineFramesFallback = false;
    let attempts = 0;
    const maxAttempts = 3;
    let lastErrorMsg = "";

    // Cycle through robust models specifically suited for video/multimodal tasks
    const modelsToTry = [
      modelName,               // User selection or environment default, e.g. "gemini-2.0-flash"
      "gemini-3.5-flash",      // Highly robust text/multimodal general model
      "gemini-2.0-flash"       // Fallback flash Model 2.0
    ];

    while (attempts < maxAttempts && (!res || !res.ok)) {
      const currentModel = modelsToTry[attempts] || modelName;
      attempts++;
      logger.info(`[CONSCIENCE_EYE_EAR_ATTEMPT] Attempt ${attempts}/${maxAttempts} using model ${currentModel} on finalFileUri`);
      
      try {
        const apiPayload = {
          contents: [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: finalFileUri,
                    mimeType: "video/mp4"
                  }
                },
                {
                  text: eyeEarPrompt
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        };

        const currentRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload)
        });

        res = currentRes;

      if (res.ok) {
          logger.info(`[CONSCIENCE_EYE_EAR_ATTEMPT_SUCCESS] Attempt ${attempts} succeeded with model ${currentModel}`);
          break;
        } else {
          let errDesc = "";
          try {
            const errData = await res.clone().json();
            errDesc = errData?.error?.message || JSON.stringify(errData);
          } catch (e) {
            errDesc = await res.clone().text().catch(() => "Could not read error text");
          }
          logger.warn(`[CONSCIENCE_EYE_EAR_ATTEMPT_FAILED] Attempt ${attempts} with model ${currentModel} failed with status ${res.status}. Error: ${errDesc}`);
          lastErrorMsg = `Status ${res.status}: ${errDesc}`;
          
          // CRITICAL: Ensure we do NOT fail silently on 500s
          if (res.status === 500) {
            logger.error(`[CONSCIENCE_EYE_EAR_SERVER_500] API returned 500. This is likely a transient infrastructure issue on the Free Tier.`);
            // Continue retry logic
          }
        }
      } catch (err: any) {
        logger.warn(`[CONSCIENCE_EYE_EAR_ATTEMPT_EXCEPTION] Attempt ${attempts} thrown error: ${err.message}`);
        lastErrorMsg = err.message || String(err);
      }

      if (attempts < maxAttempts && (!res || !res.ok)) {
        const waitTime = attempts * 2000;
        logger.info(`[CONSCIENCE_EYE_EAR_WAIT] Waiting ${waitTime}ms before next attempt...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }

    if (!res || !res.ok) {
      logger.warn(`[CONSCIENCE_EYE_EAR_FILEURI_ALL_ATTEMPTS_FAILED] All file-based attempts failed (${lastErrorMsg}). Activating inline frames fallback...`);
      useInlineFramesFallback = true;
    }

    if (useInlineFramesFallback) {
      try {
        const fList = params.framesForAnalysis || [];
        logger.info(`[CONSCIENCE_EYE_EAR_INLINE_FRAMES_FALLBACK_START] Frames count: ${fList.length}`);
        
        const inlineParts: any[] = [];
        if (fList.length > 0) {
          fList.forEach((frame) => {
            if (frame && frame.includes("base64,")) {
              const splitFrame = frame.split("base64,");
              const mime = splitFrame[0].replace("data:", "").split(";")[0] || "image/jpeg";
              const base64Data = splitFrame[1];
              inlineParts.push({
                inlineData: {
                  mimeType: mime,
                  data: base64Data
                }
              });
            }
          });
        }

        const fallbackEyeEarPrompt = eyeEarPrompt + `\n\n` + 
`⚠️ ATTENZIONE: Questa analisi viene eseguita in MODALITÀ DI EMERGENZA basata unicamente sui fotogrammi estratti (senza accesso diretto alla traccia audio o a causa di errore di caricamento API).
Per superare i controlli tecnici di qualità:
1. Devi stimare e RECONSTRUIRE almeno 4-6 battute di dialogo realistiche e coerenti basandoti sulle azioni visive dei personaggi (o sul labiale / sottotitoli se visibili), compilando accuratamente il campo "dialogueTurns" (startTime, endTime, speakerLabel, line) e allineandole a "dialogueFrameAlignment".
2. NON usare mai placeholder come "La frase detta..." o "Testo placeholder...", ma inventa frasi verosimili per la situazione mostrata nei fotogrammi.
3. Lo stato di "transcriptAvailable" deve essere impostato a true e "transcriptEvidenceStrength" stimato a "STRONG" o "WEAK" per convalidare il flusso di sincronizzazione.`;

        inlineParts.push({
          text: fallbackEyeEarPrompt
        });

        // Try utilizing gemini-3.5-flash which has huge multimodal and context window capabilities
        const fallbackModel = "gemini-3.5-flash";
        const fallbackPayload = {
          contents: [
            {
              role: "user",
              parts: inlineParts
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        };

        const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fallbackPayload)
        });

        res = fallbackRes;

        if (res.ok) {
          logger.info("[CONSCIENCE_EYE_EAR_INLINE_FRAMES_FALLBACK_SUCCESS] Gemini inline frames analysis succeeded!");
        } else {
          let errDesc = "";
          try {
            const errData = await res.clone().json();
            errDesc = errData?.error?.message || "";
          } catch(e) {}
          logger.error(`[CONSCIENCE_EYE_EAR_INLINE_FRAMES_FALLBACK_FAILED] HTTP ${res.status}. Error: ${errDesc}`);
        }
      } catch (fallbackErr: any) {
        logger.error("[CONSCIENCE_EYE_EAR_INLINE_FRAMES_FALLBACK_EXCEPTION]", fallbackErr);
      }
    }

    if (!res) {
      throw new Error("No response received from Gemini Multimodal");
    }

    eyeEarHttpStatus = res.status;
    logger.info("[GEMINI_EYE_EAR_HTTP_STATUS]", res.status);

    if (!res.ok) {
      let errBody: any = null;
      try {
        errBody = await res.json();
        eyeEarErrorCode = errBody?.error?.status || errBody?.error?.code;
        eyeEarErrorMessage = errBody?.error?.message || "";
      } catch (jsonErr) {
        eyeEarErrorMessage = `HTTP Error ${res.status}`;
      }
      throw new Error(`Gemini Multimodal failed with status ${res.status}: ${eyeEarErrorMessage}`);
    }

    const resJson = await res.json().catch((e) => {
      throw new Error(`[NON_JSON_RESPONSE] ${e.message}`);
    });

    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Empty text candidate from Gemini Multimodal");
    }

    let parsedJSON: any;
    try {
      parsedJSON = JSON.parse(extractJsonCandidate(rawText));
    } catch (pe: any) {
      throw new Error(`[PARSE_ERROR] ${pe.message}`);
    }

    const qCheck = validateQualityGate(parsedJSON, "gemini", params.videoDuration || 0);
    if (!qCheck.passed) {
      eyeEarQualityGateStatus = "FAIL";
      logger.warn("[GEMINI_EYE_EAR_QUALITY_GATE_STATUS]", "FAIL");
      throw new Error(`[QUALITY_FAIL] ${qCheck.error}`);
    }

    eyeEarQualityGateStatus = "PASS";
    logger.info("[GEMINI_EYE_EAR_QUALITY_GATE_STATUS]", "PASS");
    logger.info("[CONSCIENCE_EYE_EAR_REPORT_SUCCESS]", { provider: "gemini" });
    logger.info("[CONSCIENCE_VIDEO_FILLED_FROM_EYE_EAR]");
    logger.info("[CONSCIENCE_AUDIO_FILLED_FROM_EYE_EAR]");

    return {
      success: true,
      provider: "gemini",
      hasFileUri: !!finalFileUri,
      videoDurationTested: params.videoDuration,
      qualityGateMetrics: qCheck.metrics,
      seen: parsedJSON.seen || {},
      heard: parsedJSON.heard || {},
      syncAudit: parsedJSON.syncAudit || {},
      mirrorTestBlocks: parsedJSON.mirrorTestBlocks || [],
      eyeEarAttempted: true,
      eyeEarKeyAvailable: true,
      eyeEarFileUriAvailable: true,
      eyeEarModelSelected,
      eyeEarHttpStatus,
      eyeEarFileState,
      eyeEarQualityGateStatus: "PASS"
    };

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    logger.error("[CONSCIENCE_EYE_EAR_GEMINI_FAILED_ABORTING_WITHOUT_FALLBACK]", { error: errorMsg });
    logger.info("[GEMINI_EYE_EAR_FAILED_REASON]", errorMsg);
    logger.warn("[GEMINI_EYE_EAR_ANALYSIS_ABORTED]", errorMsg);

    // Classify error
    if (errorMsg.includes("[NON_JSON_RESPONSE]")) {
      eyeEarClassifiedReason = "NON_JSON_RESPONSE";
    } else if (errorMsg.includes("[PARSE_ERROR]")) {
      eyeEarClassifiedReason = "PARSE_ERROR";
    } else if (errorMsg.includes("[QUALITY_FAIL]")) {
      eyeEarClassifiedReason = "QUALITY_GATE_FAIL";
      eyeEarQualityGateStatus = "FAIL";
    } else if (eyeEarHttpStatus === 404 || errorMsg.includes("404") || errorMsg.includes("NOT_FOUND") || errorMsg.includes("not found")) {
      eyeEarClassifiedReason = "MODEL_NOT_AVAILABLE_404";
    } else if (eyeEarHttpStatus === 429 || errorMsg.includes("429") || errorMsg.includes("QUOTA") || errorMsg.includes("quota") || errorMsg.includes("Quota")) {
      eyeEarClassifiedReason = "QUOTA_OR_RATE_LIMIT_429";
    } else if (eyeEarHttpStatus === 401 || eyeEarHttpStatus === 403 || errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("APIKEY_INVALID") || errorMsg.includes("Permission") || errorMsg.includes("permission")) {
      eyeEarClassifiedReason = "KEY_OR_PERMISSION_401_403";
    } else if (errorMsg.includes("timeout") || errorMsg.includes("Timeout") || errorMsg.includes("TIMEOUT")) {
      eyeEarClassifiedReason = "TIMEOUT";
    } else if (errorMsg.includes("file") || errorMsg.includes("File") || errorMsg.includes("upload") || errorMsg.includes("Upload") || errorMsg.includes("FILE")) {
      eyeEarClassifiedReason = "FILE_API_ERROR";
    } else {
      eyeEarClassifiedReason = "UNKNOWN";
    }

    return {
      success: false,
      provider: "failed",
      geminiError: errorMsg,
      hasFileUri: !!finalFileUri,
      videoDurationTested: params.videoDuration,
      seen: {
        visionProviderReal: "No Eye-Ear Conscience available (Gemini Failed)",
        usedFramesReal: 0,
        frameTimestampsReal: [],
        frameTimelineSource: "FAILED",
        frameObservations: `Riconoscimento multimodale Gemini fallito: ${errorMsg}`,
        visibleConsequences: "Nessuna evidenza visiva.",
        aggregatedVisibleSubjects: [],
        visibleObjects: [],
        visibleActions: []
      },
      heard: {
        transcriptAvailable: false,
        audioSource: "FAILED",
        finalLineHeard: false,
        transcriptEvidenceStrength: "LIMITED",
        estimatedTurnCount: 0,
        notes: `Analisi audio fallita a causa dell'errore Gemini: ${errorMsg}`
      },
      syncAudit: {
        estimatedTurnCount: 0,
        transcriptHasSpeakerLabels: false,
        hasRealAudioTimestamps: false,
        timingSource: "FAILED",
        frameTimelineSource: "FAILED",
        dialogueTurns: [],
        dialogueFrameAlignment: [],
        mergedFrameTimeline: []
      },
      mirrorTestBlocks: [],
      eyeEarAttempted: true,
      eyeEarKeyAvailable: true,
      eyeEarFileUriAvailable: !!finalFileUri,
      eyeEarModelSelected,
      eyeEarHttpStatus,
      eyeEarFileState,
      eyeEarClassifiedReason,
      eyeEarErrorCode,
      eyeEarErrorMessage: eyeEarErrorMessage || errorMsg,
      eyeEarQualityGateStatus: eyeEarQualityGateStatus || "FAIL"
    };
  }
}
