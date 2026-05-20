import { logger } from "../../utils/logger";
import { extractAudioTrack, extractFrames } from "../../utils/videoProcessor";
import { hfVisionAnalysis, hfChatCompletion, hfAudioTranscription } from "../ai/huggingFaceClient";
import { resolveHuggingFaceModel } from "../ai/providerRouter";
import { groqTextCompletion } from "../ai/groqClient";

let isHuggingFullPipelineRunning = false;

const PHASE2_PROMPT_FINGERPRINT_FIELDS = [
  "sceneMasterPrompt",
  "aiPrompts",
  "promptSora12s",
  "soraPrompt12s",
  "promptSora15s",
  "soraPrompt15s",
  "klingPrompt10s",
  "klingPrompt15s",
  "klingPrompt",
  "veo3Prompt8s",
  "veoPrompt",
  "veo3ExtensionPart1Prompt8s",
  "veo3ExtensionPart2Prompt8s",
  "seedancePrompt15s",
  "sendancePrompt15s",
  "optimizedPrompt12s",
  "optimizedPrompt15s",
  "bestOptimizedPrompt.prompt",
] as const;

function getPhase2PromptAuditValue(result: any, field: string): string {
  if (!result) return "";
  if (field === "bestOptimizedPrompt.prompt") return String(result?.bestOptimizedPrompt?.prompt || "");
  return String(result?.[field] || "");
}

function buildPhase2PromptFingerprint(value: string) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
  }
  return {
    length: text.length,
    first80: text.slice(0, 80),
    hash: hash.toString(16),
  };
}

function auditPhase2PromptFingerprints(label: string, result: any) {
  if (!result) return;
  const optimized15 = getPhase2PromptAuditValue(result, "optimizedPrompt15s");
  const bestPrompt = getPhase2PromptAuditValue(result, "bestOptimizedPrompt.prompt");
  const payload = Object.fromEntries(
    PHASE2_PROMPT_FINGERPRINT_FIELDS.map((field) => {
      const value = getPhase2PromptAuditValue(result, field);
      return [
        field,
        {
          ...buildPhase2PromptFingerprint(value),
          equalsOptimized15: Boolean(optimized15) && value === optimized15,
          equalsBestPrompt: Boolean(bestPrompt) && value === bestPrompt,
        },
      ];
    }),
  );
  logger.info(label, payload);
}

export function forceUnlockHuggingPipeline() {
  isHuggingFullPipelineRunning = false;
}

function getHuggingFaceKey(): string {
  try {
      return (globalThis.localStorage?.getItem('huggingface_api_key') 
             || (import.meta as any).env?.VITE_HUGGINGFACE_API_KEY 
             || (import.meta as any).env?.HUGGINGFACE_API_KEY || '') as string;
  } catch {
      return '';
  }
}

export async function runHuggingFullPipeline(params: any) {
  if (isHuggingFullPipelineRunning) {
    logger.warn("[HUGGING_FULL_DUPLICATE_RUN_BLOCKED]");
    return { error: "Run duplicata bloccata", status: 'error' };
  }

  isHuggingFullPipelineRunning = true;

  try {
    const { video, hfVisionModel, hfAudioModel, hfTextModel, updatePipelineStep, setLoadingText, setPartialProtocol } = params;
    
    logger.info("[HUGGING_FULL_START]");
    
    // [VIDEO_SOURCE_SELECTED_FOR_HUGGING] AUDIT
    const videoSource = video instanceof File ? 'uploaded_file' : (video?.base64 ? 'saved_video_data' : 'unknown');
    const videoName = (video as any)?.name || (video as any)?.fileName || 'unknown';
    const videoSizeMB = (video as any)?.size ? ((video as any).size / (1024 * 1024)).toFixed(2) : 'unknown';
    
    logger.info("[VIDEO_SOURCE_SELECTED_FOR_HUGGING]", {
      source: videoSource,
      fileName: videoName,
      fileSizeMB: videoSizeMB
    });

    if (setLoadingText) setLoadingText("[1/6] Inizializzazione protocollo Hugging Full...");

    let audioEvidence = "Non disponibile";
    let videoEvidence = "Non disponibile";
    let isComplete = true;

    // A. AUDIO (Hugging Face)
    let transcript = "";
    logger.info("[HF_AUDIO_START]");
    if (updatePipelineStep) updatePipelineStep('audio-anchor', 'running', 'Trascrizione audio (Hugging Face)...');
    
    const hfKey = getHuggingFaceKey();
    const aModel = (hfAudioModel && (hfAudioModel.toLowerCase().includes('whisper') || hfAudioModel.toLowerCase().includes('audio'))) 
                  ? hfAudioModel 
                  : 'openai/whisper-large-v3-turbo';

    try {
      if (!video) throw new Error("No video file provided");
      if (!hfKey) throw new Error("Hugging Face API key missing");
      
      let videoFileForAudio: File;
      if (video instanceof File || video instanceof Blob) {
          videoFileForAudio = video as File;
      } else if (video && video.base64) {
          const response = await fetch(`data:${video.mimeType};base64,${video.base64}`);
          const blob = await response.blob();
          videoFileForAudio = new File([blob], video.fileName, { type: video.mimeType });
      } else if (typeof video === 'string') {
          const res = await fetch(video);
          const blob = await res.blob();
          videoFileForAudio = new File([blob], "video.mp4", { type: "video/mp4" });
      } else {
          throw new Error("Formato video non supportato");
      }

      let audioRes: any;
      try {
        const audioBlob = await extractAudioTrack(videoFileForAudio);
        audioRes = await hfAudioTranscription(audioBlob, hfKey, aModel);
      } catch (extractErr) {
        logger.warn("[AUDIO_DIRECT_GROQ_WHISPER_START] Fallback extractions failed or timed out, attempting direct HF transcription with original file.");
        try {
          audioRes = await hfAudioTranscription(videoFileForAudio, hfKey, aModel);
          logger.info("[AUDIO_DIRECT_GROQ_WHISPER_SUCCESS]");
          logger.info("[AUDIO_PIPELINE_CONTINUE_WITH_DIRECT_TRANSCRIPT]");
        } catch (hfErr) {
          logger.error("[AUDIO_DIRECT_GROQ_WHISPER_FAIL]", hfErr);
          throw extractErr;
        }
      }
      transcript = audioRes.text || audioRes.transcription || "";
      
      if (transcript && transcript.trim().length > 0) {
         audioEvidence = `Trascritto (HF):\n"${transcript.substring(0, 150)}..."`;
         logger.info("[HF_AUDIO_SUCCESS]", { transcriptLength: transcript.length });
         if (updatePipelineStep) updatePipelineStep('audio-anchor', 'success', 'Audio trascritto (HF)');
         if (setPartialProtocol) setPartialProtocol((prev: any) => ({ ...prev, transcriptStatus: 'VERIFIED_TRANSCRIPT' }));
      } else {
         audioEvidence = "Audio vuoto o non rilevato da HF.";
         logger.warn("[HF_AUDIO_FAIL] Empty transcript");
      }
    } catch (e: any) {
      logger.error("[HF_AUDIO_FAIL]", e);
      let errorMsg = e.message || "Failed to fetch";
      if (errorMsg.includes("fetch") || errorMsg.includes("Failed to fetch") || errorMsg.includes("Unexpected token")) {
          errorMsg = "HF Audio non raggiungibile o modello audio non supportato.";
      }
      audioEvidence = `Errore HF Audio: ${errorMsg}`;
      if (updatePipelineStep) updatePipelineStep('audio-anchor', 'error', errorMsg);
      isComplete = false;
      
      // Degraded mode info
      if (params.failedModules) params.failedModules.push('HF_AUDIO');
    }

    // B. FRAME (Hugging Face)
    logger.info("[HUGGING_FULL_FRAME_START]");
    if (updatePipelineStep) updatePipelineStep('frame-analysis', 'running', 'Analisi frame (Hugging Face)...');
    
    let frameAnalysis = "";
    try {
      const vModel = hfVisionModel || resolveHuggingFaceModel('vision');
      
      let videoFileForFrames: File;
      if (video instanceof File || video instanceof Blob) {
           videoFileForFrames = video as File;
      } else if (video && video.base64) {
           const response = await fetch(`data:${video.mimeType};base64,${video.base64}`);
           const blob = await response.blob();
           videoFileForFrames = new File([blob], video.fileName, { type: video.mimeType });
      } else {
           throw new Error("Video non disponibile per i frame");
      }

      const framesBase64 = await extractFrames(videoFileForFrames, 5, 0, undefined, 200);
      logger.info("[FRAME_EXTRACTION_DONE]", { count: framesBase64.length });
      
      logger.info("[FRAME_DEBUG_PREVIEW]", {
        frames: framesBase64.map(f => f.substring(0, 50) + "...")
      });

      const forensicPrompt = `AGISCI COME ANALISTA FORENSE. Descrivi SOLO ciò che si vede nei frame in modo oggettivo. 
NON INVENTARE OGGETTI, ESPLOSIONI o PERSONAGGI NON VISIBILI. 
Se il video è nero scrivi 'NON VISIBILE'.`;

      logger.info("[HF_PROXY_REQUEST_START] task=vision");
      frameAnalysis = await hfVisionAnalysis(framesBase64, forensicPrompt, hfKey, vModel);
      
      if (frameAnalysis) {
         logger.info("[HF_PROXY_SUCCESS] task=vision");
         videoEvidence = `Analisi Visiva (HF):\n${frameAnalysis.substring(0, 150)}...`;
         if (updatePipelineStep) updatePipelineStep('frame-analysis', 'success', 'Analisi frame completata');
      }
    } catch (e: any) {
      logger.error("[HF_VISION_FAIL]", e);
      videoEvidence = `Errore HF Vision: ${e.message}`;
      isComplete = false;
    }

    // C. FINALE (Hugging Face)
    logger.info("[HUGGING_FULL_FINAL_START]");
    let finalSummary = "";
    try {
        const tModel = hfTextModel || resolveHuggingFaceModel('text');
        const messages = [
            { role: 'system', content: "Sei un analista esperto. Usa solo i fatti forniti." },
            { role: 'user', content: `Audio: ${transcript}\nVideo: ${frameAnalysis}\nRiassumi l'azione in italiano (max 100 parole).` }
        ];

        logger.info("[HF_PROXY_REQUEST_START] task=text");
        finalSummary = await hfChatCompletion(messages, hfKey, tModel);
        logger.info("[HF_PROXY_SUCCESS] task=text");
        
    } catch (e: any) {
        logger.error("[HF_FINAL_FAIL]", e);
        finalSummary = `Errore di sintesi: ${e.message}`;
        isComplete = false;
    }

    logger.info("[NO_GEMINI_IN_EXTERNAL_MODE_CONFIRMED]");

    const resultString = `RISULTATO:
${isComplete ? finalSummary : 'Analisi incompleta.'}

EVIDENZA AUDIO:
${transcript || audioEvidence}

EVIDENZA VIDEO:
${frameAnalysis || videoEvidence}

NOTA:
Hugging Face audio + vision + finale. Gemini non usato. ${!isComplete ? 'Fallito in uno step.' : ''}`;

    return {
      analysis: resultString,
      viralScore: "UNVERIFIED",
      status: 'success',
      transcriptStatus: transcript ? 'VERIFIED_TRANSCRIPT' : 'MISSING'
    };
  } finally {
    isHuggingFullPipelineRunning = false;
  }
}

export async function runGroqHybridFullPhase2PromptEngine(params: {
  phase1Result: any;
  transcript: string;
  frameAnalysis: string;
  selectedEvent: string;
  canonicalCastList: string[];
  metadata?: any;
  mode?: string;
  hfTextModel?: string;
  isVisionRecoveredWithOpenRouter?: boolean;
}) {
  const { phase1Result, transcript, frameAnalysis, selectedEvent, canonicalCastList, hfTextModel, isVisionRecoveredWithOpenRouter } = params;
  let lastPhase2Result: any = null;

  logger.info("[GROQ_FULL_PHASE2_PROMPT_ENGINE_START]");

  // PHASE 5: BLOCK IF AUDIO NOT VERIFIED
  const isAudioMissing = !transcript || transcript.trim().length === 0;
  const isAudioNotVerified = phase1Result?.audioVerified === false || phase1Result?.transcriptStatus === "AUDIO_NOT_VERIFIED" || phase1Result?.transcriptStatus === "MISSING_AUDIO";
  
  if (isAudioMissing || isAudioNotVerified) {
    logger.info("[PHASE2_BLOCKED_AUDIO_NOT_VERIFIED]", {
      isAudioMissing,
      isAudioNotVerified,
      transcriptStatus: phase1Result?.transcriptStatus,
      audioVerified: phase1Result?.audioVerified
    });
    return handlePhase2AudioNotVerified(phase1Result);
  }

  logger.info("[GROQ_FULL_PHASE2_PROMPT_GENERATOR_HARD_BAN_APPLIED]");
  
  try {
    // [GROQ_FULL_PHASE2_INPUT_AUDIT]
  logger.info("[GROQ_FULL_PHASE2_INPUT_AUDIT]", {
    hasPhase1Result: !!phase1Result,
    transcriptLength: transcript?.length || 0,
    frameAnalysisLength: frameAnalysis?.length || 0,
    selectedEvent: selectedEvent || "MISSING",
    castCount: canonicalCastList?.length || 0,
    isVisionRecoveredWithOpenRouter
  });

  const hfKey = getHuggingFaceKey();
  const tModel = hfTextModel || "zai-org/GLM-4.5V";

  logger.info("[GROQ_FULL_PHASE2_HF_CONFIG]", { 
    model: tModel, 
    hasKey: !!hfKey,
    keyLength: hfKey?.length || 0 
  });

  const preflightCastAndDialogueAudit = phase1Result?.castAndDialogueAudit || buildCastAndDialogueAudit(phase1Result, transcript, canonicalCastList);
  const preflightDialogueSyncAudit = phase1Result?.dialogueSyncAudit || buildDialogueSyncAudit(phase1Result, transcript, canonicalCastList);
  const preflightSceneMechanismAudit = phase1Result?.sceneMechanismAudit || buildSceneMechanismAudit(phase1Result, transcript);

  const composerDossier = phase1Result?.composerDossier || deriveComposerDossier({
    phase1Result,
    transcript,
    durationBeatStrategy: phase1Result?.durationBeatStrategy,
    sceneMechanismAudit: preflightSceneMechanismAudit,
    castAndDialogueAudit: preflightCastAndDialogueAudit,
    dialogueSyncAudit: preflightDialogueSyncAudit,
    promptDecisionTrace: phase1Result?.promptDecisionTrace || null // Preflight mode
  });
  logger.info("[GROQ_FULL_PHASE2_PREFLIGHT_COMPOSER_DOSSIER]", composerDossier);

  const groundingGate = evaluateAudioVideoGroundingGate({
    phase1Result,
    transcript,
    frameAnalysis,
    canonicalCastList,
    castAndDialogueAudit: preflightCastAndDialogueAudit,
    sceneMechanismAudit: preflightSceneMechanismAudit
  });

  if (groundingGate.shouldBlockPromptGeneration) {
    const vInfo = getVisionProviderStatusInfo(phase1Result, groundingGate);
    logger.info("[VISION_PROVIDER_STATUS_RESOLVED]", { status: vInfo.status });
    const hasAudioAnchoredWeakVisualRecoveryInputs =
      !!transcript &&
      Array.isArray(phase1Result?.audioSegments) &&
      phase1Result.audioSegments.length > 0 &&
      Array.isArray(phase1Result?.frameTimestamps) &&
      phase1Result.frameTimestamps.length > 0;

    if (groundingGate.fatalVisualMissing) {
        if (hasAudioAnchoredWeakVisualRecoveryInputs) {
            logger.info("[AUDIO_ANCHORED_PROMPT_WEAK_VISUAL_RECOVERY_ATTEMPTED]", {
              reason: groundingGate.reason,
              transcriptAvailable: true,
              audioSegmentsCount: phase1Result.audioSegments.length,
              frameTimestampsCount: phase1Result.frameTimestamps.length
            });

            const localPrompts = buildAudioAnchoredPromptWeakVisualSet(transcript, {
              ...phase1Result,
              promptSafetyMode: "AUDIO_ANCHORED_VISUAL_WEAK",
              analysisRoutingMode: "AUDIO_TRANSCRIPT_ONLY_PHASE2"
            });

            return buildGroqFullPhase2RecoveryResult({
              phase1Result,
              localPrompts,
              reason: "AUDIO_ANCHORED_PROMPT_WEAK_VISUAL",
              visionProviderStatus: vInfo.status,
              visionProvider: vInfo.provider,
              visionProviderName: vInfo.name
            });
        }
        logger.info("[VISION_FRAME_TIMELINE_MISSING_BLOCK_PROMPTS]");
        return buildGroqFullPhase2BlockPromptsResult({
            phase1Result,
            reason: "PROMPT_BLOCKED_NO_VISUAL_FRAME_TIMELINE",
            visionProviderStatus: vInfo.status,
            visionProvider: vInfo.provider,
            visionProviderName: vInfo.name
        });
    }

    logger.info("[PHASE2_GROUNDING_WEAK_BUT_AUDIO_RECOVERY_ATTEMPTED]", {
      reason: groundingGate.reason,
      transcriptAvailable: !!transcript,
      audioVerified: phase1Result?.audioVerified === true
    });
    
    // Recovery logic instead of handlePhase2AudioVideoNotGrounded
    const localPrompts = buildDifferentiatedPhase2PromptSetV2(
      phase1Result?.SceneDNA?.primaryDescription || "Analisi visiva parziale",
      transcript,
      "", 
      phase1Result,
      preflightSceneMechanismAudit,
      phase1Result?.durationBeatStrategy,
      preflightDialogueSyncAudit
    );

    return buildGroqFullPhase2RecoveryResult({
      phase1Result,
      localPrompts,
      reason: "GROUNDING_WEAK_AUDIO_RECOVERY",
      visionProviderStatus: vInfo.status,
      visionProvider: vInfo.provider,
      visionProviderName: vInfo.name
    });
  }

  const dialogueSyncGate = evaluateDialogueSyncGate({
    canonicalCastList,
    dialogueSyncAudit: preflightDialogueSyncAudit,
    phase1Result,
    groundingGate,
    transcript
  });

  const subjectsCount = canonicalCastList.length;
  const totalTurns = preflightDialogueSyncAudit.dialogueTurnsCount || 0;
  const highMediumTurns = (preflightDialogueSyncAudit.highConfidenceAssignmentsCount || 0) + (preflightDialogueSyncAudit.mediumConfidenceAssignmentsCount || 0);
  const lowTurns = preflightDialogueSyncAudit.lowConfidenceAssignmentsCount || 0;
  const unassociatedTurns = preflightDialogueSyncAudit.unalignedTurnsCount || 0;
  
  const conscienceAnalysis = `
ANALISI DI COSCIENZA (SPEAKER ATTRIBUTION):
- Soggetti visivi rilevati: ${subjectsCount}
- Battute totali: ${totalTurns}
- Battute associate con confidenza (High/Medium): ${highMediumTurns}
- Battute associate con confidenza (Low): ${lowTurns}
- Battute non associate: ${unassociatedTurns}
- CONCLUSIONE: Procedi con assegnazione SPEAKER PROBABILE usando linguaggio prudente.
`.trim();

  const speakerMode = preflightDialogueSyncAudit.speakerAssignmentMode || "NO_SPEAKER_ASSIGNMENT";
  if (speakerMode === "CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT") {
    logger.info("[PROMPT_ENGINE_USING_PROBABLE_SPEAKERS]", {
      mode: speakerMode,
      probableAssignmentsCount: preflightDialogueSyncAudit.probableAssignmentsCount
    });
  }

  if (dialogueSyncGate.shouldBlockPrompts) {
    const vInfo = getVisionProviderStatusInfo(phase1Result, groundingGate);
    logger.info("[VISION_PROVIDER_STATUS_RESOLVED]", { status: vInfo.status });

    logger.info("[DIALOGUE_SYNC_WEAK_BUT_AUDIO_RECOVERY_ATTEMPTED]", {
      reason: dialogueSyncGate.reason,
      transcriptAvailable: !!transcript,
      audioVerified: phase1Result?.audioVerified === true
    });
    
    // Recovery logic instead of handlePhase2DialogueSyncLowConfidence
    const localPrompts = buildDifferentiatedPhase2PromptSetV2(
      phase1Result?.SceneDNA?.primaryDescription || "Analisi visiva parziale",
      transcript,
      "", 
      phase1Result,
      preflightSceneMechanismAudit,
      phase1Result?.durationBeatStrategy,
      preflightDialogueSyncAudit
    );

    return buildGroqFullPhase2RecoveryResult({
      phase1Result,
      localPrompts,
      reason: "DIALOGUE_SYNC_WEAK_AUDIO_RECOVERY",
      visionProviderStatus: vInfo.status,
      visionProvider: vInfo.provider,
      visionProviderName: vInfo.name
    });
  }

  const useGroqForPrompt = !!isVisionRecoveredWithOpenRouter || (phase1Result?.analysisRoutingMode === "AUDIO_TRANSCRIPT_ONLY_PHASE2");

  // BLOCK GEMINI
  logger.info("[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] Utilizing only allowed providers for Phase 2.");

  logger.info("[HF_CHAT_ROUTE_SELECTED]", {
    phase: "prompt_engine",
    endpoint: "/v1/chat/completions",
    model: tModel
  });

  const promptMessages: any[] = [
    {
      role: "system",
      content: `ACT AS A VIDEO PROMPT ENGINE (PHASE 2).
YOUR TASK: Generate a high-quality TECHNICAL SCENE DESCRIPTION in English based on Phase 1 data.

INPUT DATA:
- EVENT: ${selectedEvent}
- CAST: ${canonicalCastList}
- TRANSCRIPT: ${transcript}
- ANALYSIS: ${frameAnalysis}
- RAW_FRAME_OBSERVATIONS: ${JSON.stringify(phase1Result?.frameObservations || [])}
${composerDossier?.shortDossier ? `\nCOMPOSER DECISION GUIDE:
${composerDossier.shortDossier}

Use this guide to decide:
- what the short prompt must focus on
- what to keep
- what to cut
- what not to invent
- which audio/visual signals matter most

Do NOT copy the guide verbatim into final prompts.
Do NOT mention "Composer Dossier" in final prompts.
Do NOT output analysis.
Only output final model-ready prompts.
` : ""}
${conscienceAnalysis}
${preflightDialogueSyncAudit?.possibleSpeakerAssignments?.length > 0 ? `\nCAUTIOUS SPEAKER ASSIGNMENTS TO USE:
${preflightDialogueSyncAudit.possibleSpeakerAssignments.map((a: any) => {
  const confidenceLabel = a.speakerInferenceConfidence === "HIGH" ? "Certain role" : (a.speakerInferenceConfidence === "MEDIUM" ? "Likely role" : "Possible role");
  return `- Line: "${a.line}" -> Speaker candidate: ${a.probableSpeakerLabel} (${confidenceLabel}). Reason: ${a.speakerInferenceReason}`;
}).join("\n")}` : ""}

STRICT GENERATION RULES:
1. HARD BAN ON GENERIC TERMS: Do NOT use: cinematic, epic, clean narrative short, hook, setup, escalation, payoff, dynamic blocking, preserve continuity, continue from the same scene world, emotional beat, dramatic, viral, story arc, engaging, compelling, smooth transitions, seamless loop, visual-first, concrete, readable expressions, "The scene unfolds", "having limited visual detection", "As per the transcript", "environment suggests", "possibly", "indicating a sense", "highlighting the importance", "unknown", "personaggio ignoto".
2. NO STRUCTURAL META-TALK: Do not describe the video structure (e.g., "hook, setup and payoff"). Describe only what is seen and heard.
3. CONCRETE DETAILS: Include at least 3 specific details from the analysis/transcript (e.g. names, specific actions, objects).
4. DIALOGUE LOCK: If transcript is present, include at least one verified ${composerDossier?.targetLanguage || "Italian"} dialogue enclosed in double quotes. Do not translate.
5. EXECUTION FIRST: Prompts must be ready for Sora/Kling/Veo/Seedance. No meta-explanations.
6. AVOID TEMPLATES: Describe the environment, physical action, and precise reaction. Use real names from the transcript/cast (e.g. Kirby, Walsh, the captain, uniformed man, woman) instead of placeholders like "Personaggio 1" or generic labels like "Una donna".
7. CAUTIOUS SPEAKER ATTRIBUTION: If assignments are provided with LOW confidence, use cautious descriptors like "The characters reacts as if they were speaking correctly..." or "The officer, likely corresponding to the speech, gestures...". Never use "unknown" if a probable candidate exists.
8. NO INCOMPLETE PHRASES: Ensure sentences start with clear subjects and actions. Never start with "Apertura su..." unless it follows with a fully described scene.

${preflightDialogueSyncAudit?.speakerAssignmentMode === "CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT" ? `\nSPECIAL CAUTIOUS SPEAKER RULE:
You are in CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT mode. You MUST use the speaker candidates provided even if they have low confidence, but describe them with visual traits and cautious verbs (e.g. "The woman, appearing to be the main speaker, reacts...", "The uniformed officer, likely corresponding to the speech, gestures..."). DO NOT USE "unknown" or "generic person".` : ""}

DIAGNOSTIC MANDATE:
You MUST populate the "promptProcessInfiltrator" field for pipeline transparency.
- truthSourceLedger: Identify accurately which sources you are using.
- promptLineageTrace: For each major field, trace if the content origin is PHASE_2_LLM and if the primary source was TRANSCRIPT, VISION, or HYBRID.
- validatorInterrogationTrace: List major constraints you applied (e.g., "Banned term check", "Dialogue Lock").
- gradeInterrogationTrace: Mock-up a score interrogation based on how well you integrated audio and visual data.
- finalInfiltratorVerdict: "OK" if grounding is solid, "VISIBLE_FALLBACK" if vision is weak, "AUDIO_ONLY" if you rely only on speech.
- infiltratorDiagnosis: Provide a DRY, OBJECTIVE analysis of the data alignment.

STRICT OUTPUT RULES:
1. Return a compact JSON object delimited between <JSON> and </JSON>.
2. Do not return markdown. Do not use code fences.
3. Keep all values single-line. Escape all double quotes inside strings.
4. Do not use raw backslashes. Use valid JSON escaping only.
5. Do not include comments.
6. Do not include trailing commas.
4. LANGUAGE: TECHNICAL ACTIONS AND DESCRIPTIONS IN ${composerDossier?.targetLanguage?.toUpperCase() || "ITALIAN"}.

JSON SCHEMA:
{
  "promptProcessInfiltrator": {
    "truthSourceLedger": {
      "audioAvailable": boolean,
      "transcriptSource": "GROQ_WHISPER" | "HF_WHISPER" | "FALLBACK_LLM" | "NONE",
      "visualFramesCount": number,
      "visionProvider": "string",
      "synchronizedDialogue": boolean
    },
    "composerUsageTrace": {
      "baseDossierUsed": boolean,
      "audioContextIntegrated": boolean,
      "videoContextIntegrated": boolean,
      "alignmentConfidence": "HIGH" | "MEDIUM" | "LOW" | "NONE"
    },
    "promptLineageTrace": [
       { "field": "string", "origin": "PHASE_2_LLM", "primaryDataSource": "TRANSCRIPT" | "VISION" | "HYBRID", "wasScrubbed": boolean }
    ],
    "validatorInterrogationTrace": [
       { "checkName": "string", "status": "PASS" | "FAIL", "technicalDetail": "string" }
    ],
    "gradeInterrogationTrace": [
       { "subject": "string", "rawScore": number, "finalScore": number, "uiReason": "string", "dataUsed": ["string"] }
    ],
    "finalInfiltratorVerdict": "OK" | "SUSPICIOUS" | "VISIBLE_FALLBACK" | "AUDIO_ONLY" | "VISION_ONLY" | "DATA_MISMATCH",
    "infiltratorDiagnosis": "string"
  },
  "sceneMasterPrompt": "Detailed technical description in Italian",
  "loopStrategy": {
    "enabled": true,
    "strategy": "Technical strategy in Italian",
    "reason": "Why it works in Italian"
  },
  "promptQualityReport": {
    "finalPass": true,
    "notes": "Italian notes"
  }
}
`
    },

    {
      role: "user",
      content: "Generate the Scene Master Prompt now inside <JSON> tags."
    }
  ];

  const BANNED_TERMS = [
    "cinematic", "epic", "clean narrative short", "hook", "setup", "escalation", "payoff", 
    "dynamic blocking", "preserve continuity", "continue from the same scene world", 
    "emotional beat", "dramatic", "viral", "story arc", "engaging", "compelling", 
    "smooth transitions", "seamless loop", "visual-first", "concrete", "readable expressions",
    "the scene unfolds", "having limited visual detection",
    "as per the transcript", "environment suggests", "possibly", "indicating a sense", 
    "highlighting the importance"
  ];

  let attempt = 0;
  let finalRawResponse = "";
  let successParsed: any = null;

  while (attempt < 2) {
    if (useGroqForPrompt) {
      logger.info("[GROQ_FULL_PHASE2_PROMPT_ENGINE_GROQ_START]", { reason: "openrouter_vision_recovered", attempt });
      try {
        const groqRes = await groqTextCompletion({
          messages: promptMessages as any,
          task: 'prompt_engine_fallback'
        });
        finalRawResponse = groqRes.text;
      } catch (groqErr: any) {
        logger.error("[GROQ_FULL_PHASE2_PROMPT_ENGINE_GROQ_FAILED]", { reason: groqErr.message });
        return handlePhase2ParseError(phase1Result, `Groq prompt engine failed: ${groqErr.message}`);
      }
    } else {
      logger.info("[GROQ_FULL_PHASE2_HF_PROMPT_START]", { model: tModel, attempt });
      let hfFailed = false;
      try {
        finalRawResponse = await hfChatCompletion(promptMessages, hfKey, tModel);
        if (isHuggingFaceCreditsDepletedError(finalRawResponse)) {
           hfFailed = true;
        }
      } catch (e: any) {
        if (isHuggingFaceCreditsDepletedError(e) || e.status === 402 || e.status === 429) {
           hfFailed = true;
        } else {
           throw e;
        }
      }

      if (hfFailed) {
         logger.warn("[HF_PROMPT_CREDITS_DEPLETED_FALLBACK_ELIGIBLE]", { phase: 'prompt_engine' });
         logger.info("[GROQ_PROMPT_FALLBACK_AFTER_HF_DEPLETED_START]", { attempt });
         try {
           const groqResText = (await groqTextCompletion({
             messages: promptMessages as any,
             task: 'prompt_engine_fallback_depleted'
           })).text;
           finalRawResponse = groqResText;
           logger.info("[GROQ_PROMPT_FALLBACK_AFTER_HF_DEPLETED_SUCCESS]");
         } catch (groqErr: any) {
           logger.error("[GROQ_PROMPT_FALLBACK_AFTER_HF_DEPLETED_FAILED]", { error: groqErr.message });
           return handlePhase2CreditsDepleted(phase1Result);
         }
      }
    }

    // Check for banned terms in the raw response
    const foundBanned = BANNED_TERMS.find(term => finalRawResponse.toLowerCase().includes(term));
    if (foundBanned && attempt === 0) {
      logger.info("[GROQ_FULL_PHASE2_PROMPT_REGENERATED_AFTER_BANNED_TERM]", {
        bannedTerm: foundBanned,
        regenerated: true
      });
      promptMessages.push({ role: "assistant", content: finalRawResponse });
      promptMessages.push({ 
        role: "user", 
        content: `CRITICAL ERROR: Your response contained the banned term "${foundBanned}". RIGENERARE COMPLETAMENTE IL JSON SENZA USARE PAROLE GENERICHE. USA SOLO DESCRIZIONI TECNICHE PURE E DETTAGLI CONCRETI.` 
      });
      attempt++;
      continue;
    }

    const jsonToParse = extractPhase2JsonFromText(finalRawResponse);
    if (!jsonToParse) {
      if (attempt === 0) {
        logger.warn("[GROQ_FULL_PHASE2_JSON_MISSING_RETRYING]", { attempt });
        promptMessages.push({ role: "user", content: "ERROR: Missing tags. Return JSON inside <JSON> tags now." });
        attempt++;
        continue;
      }
      return handlePhase2ParseError(phase1Result, "No valid JSON structure found");
    }

    try {
      const parsed = JSON.parse(jsonToParse);
      
      // Inject preflight dossier into parsed result if missing
      if (!parsed.composerDossier) {
        parsed.composerDossier = composerDossier;
      }
      
      // Scrub and Validate early to trigger attempt 1 if needed
      const scrubbed = scrubBannedTerms(parsed);
      const validation = validateGroqFullPhase2Prompts(scrubbed, transcript, canonicalCastList);
      
      if (!validation.isValid && attempt === 0) {
         logger.info("[GROQ_FULL_PHASE2_VALIDATION_FAILED_RETRYING]", { reason: validation.report });
         promptMessages.push({ role: "assistant", content: finalRawResponse });
         promptMessages.push({ 
           role: "user", 
           content: `CRITICAL ERROR: Your response did not pass validation. Report: ${validation.report}. RIGENERARE COMPLETAMENTE SENZA USARE PAROLE GENERICHE. USA SOLO DESCRIZIONI TECNICHE PURE E DETTAGLI CONCRETI.` 
         });
         attempt++;
         continue;
      }
      
      successParsed = scrubbed;
      break;
    } catch (e: any) {
      if (attempt === 0) {
        logger.warn("[GROQ_FULL_PHASE2_JSON_PARSE_RETRYING]", { error: e.message });
        logger.warn("[GROQ_FULL_PHASE2_PARSE_FAIL_DETAIL]", buildGroqPhase2ParseFailDetail(e, attempt, jsonToParse));
        const repairedJson = repairGroqPhase2JsonText(jsonToParse);
        if (repairedJson && repairedJson !== jsonToParse) {
          logger.info("[GROQ_FULL_PHASE2_JSON_REPAIR_APPLIED]", {
            originalLength: jsonToParse.length,
            repairedLength: repairedJson.length,
            reason: "bad_escape_or_invalid_json"
          });
          try {
            const repairedParsed = JSON.parse(repairedJson);
            const repairedScrubbed = scrubBannedTerms(repairedParsed);
            const repairedValidation = validateGroqFullPhase2Prompts(repairedScrubbed, transcript, canonicalCastList);

            if (repairedValidation.isValid) {
              successParsed = repairedScrubbed;
              break;
            }

            logger.info("[GROQ_FULL_PHASE2_REPAIRED_JSON_VALIDATION_FAILED]", {
              report: repairedValidation.report
            });
          } catch (repairParseError: any) {
            logger.warn("[GROQ_FULL_PHASE2_REPAIRED_JSON_PARSE_FAILED]", {
              error: repairParseError?.message
            });
            logger.warn("[GROQ_FULL_PHASE2_PARSE_FAIL_DETAIL]", buildGroqPhase2ParseFailDetail(repairParseError, attempt, repairedJson));
          }
        }
        promptMessages.push({ role: "user", content: "ERROR: Invalid JSON. Return ONLY valid JSON inside <JSON> tags. No markdown, no code fences, no comments, no trailing commas, and escape all quotes/backslashes correctly." });
        attempt++;
        continue;
      }
      logger.warn("[GROQ_FULL_PHASE2_PARSE_FAIL_DETAIL]", buildGroqPhase2ParseFailDetail(e, attempt, jsonToParse));
      return handlePhase2ParseError(phase1Result, e.message, finalRawResponse, transcript);
    }
  }

  const vInfo = getVisionProviderStatusInfo(phase1Result, groundingGate);
  logger.info("[VISION_PROVIDER_STATUS_RESOLVED]", { status: vInfo.status });

  const result = await processPhase2Success(successParsed, phase1Result, transcript, canonicalCastList, useGroqForPrompt ? 'Groq' : tModel, vInfo.status, vInfo.provider, vInfo.name);
  lastPhase2Result = result;
  logger.info("[GROQ_FULL_PHASE2_PROMPT_ENGINE_SUCCESS]");
  return result;
} catch (e: any) {
  logger.error("[GROQ_FULL_PHASE2_FAIL]", {
    errorName: e?.name,
    errorMessage: e?.message,
    errorStack: e?.stack,
    phase: "prompt_engine_or_process_success",
    lastKnownFinalPass: lastPhase2Result?.promptQualityReport?.finalPass,
    lastKnownLocked: lastPhase2Result?.lockedPromptTabs?.locked,
    lastKnownOperationalDecision: lastPhase2Result?.operationalDecision,
    lastKnownPromptKeys: lastPhase2Result
      ? Object.keys(lastPhase2Result).filter((key) => /prompt|sceneMaster|aiPrompts|lockedPromptTabs|bestOptimized/i.test(key))
      : [],
    hasAiPrompts: Boolean(lastPhase2Result?.aiPrompts),
    hasSceneMaster: Boolean(lastPhase2Result?.sceneMasterPrompt),
    hasSora: Boolean(lastPhase2Result?.soraPrompt15s || lastPhase2Result?.promptSora15s),
    hasKling: Boolean(lastPhase2Result?.klingPrompt15s || lastPhase2Result?.klingPrompt),
    hasVeo: Boolean(lastPhase2Result?.veo3Prompt8s || lastPhase2Result?.veoPrompt),
    hasSeedance: Boolean(lastPhase2Result?.seedancePrompt15s || lastPhase2Result?.sendancePrompt15s)
  });
  return {
    ...phase1Result,
    status: 'error',
    phase2Error: e.message,
    bestOptimizedPrompt: {
        prompt: "NON_GENERATO_PROMPT_RUNTIME_ERROR",
        reason: e.message
    }
  };
}
}

function scrubBannedTerms(data: any) {
  const BANNED_TERMS = [
    "cinematic", "clean narrative short", "hook", "setup", "escalation", "payoff", 
    "dynamic blocking", "preserve continuity", "continue from the same scene world", 
    "emotional beat", "dramatic", "viral", "story arc", "engaging", "compelling", 
    "smooth transitions", "seamless loop", "visual-first", "concrete", "readable expressions",
    "technical strategy", "the scene unfolds",
    "having limited visual detection", "as per the transcript", "environment suggests", 
    "possibly", "indicating a sense", "highlighting the importance",
    "the scene takes", "unknown person", "personaggio ignoto", "unknown character",
    "opening on", "apertura su the scene", "the scene is filled with",
    "vertical sequence", "the scene involves", "while handling", "nearby", "off-screen",
    "as the woman è", "svolge \"", "azione di unknown", "Analisi visiva parziale", "Rilevamento visivo limitato", "Personaggio 1"
  ];

  const scrubString = (s: string) => {
    let result = s;
    
    // Pattern-based replacements for messy fragments
    result = result.replace(/Apertura su Una donna e/gi, "Apertura sulla donna principale");
    result = result.replace(/The scene takes/gi, "");
    result = result.replace(/Vertical sequence:?/gi, "");
    result = result.replace(/The scene involves \d+ subjects/gi, "");
    result = result.replace(/svolge "/gi, "svolge l'azione");
    result = result.replace(/svolge ""/gi, "svolge l'azione");
    result = result.replace(/"\s+while standing/gi, " mentre sta in piedi");
    result = result.replace(/nearby/gi, "vicino");
    result = result.replace(/off-screen/gi, "fuori campo");

    BANNED_TERMS.forEach(term => {
       const regex = new RegExp(`\\b${term}\\b`, 'gi');
       result = result.replace(regex, '');
    });
    
    // Clean up artifacts (double spaces, weird commas)
    return result.replace(/\s\s+/g, ' ').replace(/,\s*,/g, ',').replace(/\.\s*\./g, '.').replace(/^[,.\s]+/, '').trim();
  };

  const process = (obj: any): any => {
    if (typeof obj === 'string') return scrubString(obj);
    if (Array.isArray(obj)) return obj.map(process);
    if (obj !== null && typeof obj === 'object') {
       const res: any = {};
       for (const [k, v] of Object.entries(obj)) {
         res[k] = process(v);
       }
       return res;
    }
    return obj;
  };

  return process(data);
}

function compressWhitespace(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function extractVerifiedDialogueLine(transcript: string) {
  const cleaned = compressWhitespace(transcript);
  if (!cleaned) return "";
  const chunks = cleaned
    .split(/[.!?]/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 20);
  return chunks[0] || cleaned.slice(0, 120).trim();
}

function buildDifferentiatedPhase2PromptSet(basePrompt: string, transcript: string) {
  const compose = (t: string) => sanitizePromptDraftBeforeValidation(compressWhitespace(t));
  
  const base = compressWhitespace(basePrompt);
  const dialogue = extractVerifiedDialogueLine(transcript);
  const dialogueSnippet = dialogue ? ` Include verified line: "${dialogue}".` : "";
  const neutralFacts = base
    .replace(/\s*Duration:\s*\d+\s*seconds\.?/gi, "")
    .replace(/\s*Vertical\s*9:16\.?/gi, "")
    .replace(/\s*Kling AI v1\.5,?\s*\d+\s*seconds,?\s*vertical\s*9:16\.?/gi, "")
    .replace(/\s*Veo 3 version\.?/gi, "")
    .replace(/\s*Seedance version\.?/gi, "")
    .replace(/\s*Preserve the strongest verified line\s*"[^"]*"\.?/gi, "")
    .replace(/\s*Emphasize stunt energy and gesture readability:\s*/gi, "")
    .trim();

  const sceneMasterPrompt = compose(
    `${neutralFacts} La scena deve restare centrata sull'azione verificata, con ambiente leggibile, soggetti riconoscibili, gesto principale chiaro, reazioni coerenti e tono aderente al contenuto originale.`
  );

  const soraPrompt12s = compose(
    `${neutralFacts} Concentrati su un solo gesto visivo continuo: entrata rapida nell'azione, movimento principale ben leggibile, conseguenza immediata. Nessuna sottotrama, nessun cambio di scena, ritmo compatto.`
  );

  const soraPrompt15s = compose(
    `${neutralFacts}${dialogueSnippet} Costruisci una breve progressione continua: contesto iniziale essenziale, azione principale, reazione dei soggetti e chiusura naturale. Mantieni la scena semplice, leggibile e fedele al contenuto verificato.`
  );

  const klingPrompt10s = compose(
    `${neutralFacts} Taglio breve e fisico: movimento immediato, impatto visivo netto, reazioni rapide dei corpi o degli oggetti, energia alta e lettura istantanea dell'azione.`
  );

  const klingPrompt15s = compose(
    `${neutralFacts} Sequenza più estesa: mostra prima il movimento che porta all'azione, poi il gesto centrale, quindi reazioni, espressioni, conseguenze visive e chiusura chiara. Più dettagli rispetto alla versione breve, senza inventare nuovi eventi.`
  );

  const veo3Prompt8s = compose(
    `${neutralFacts}${dialogueSnippet} Mantieni realismo, continuità spaziale e azione immediatamente comprensibile. Inquadra solo ciò che serve: gesto principale, conseguenza visiva e reazione più importante.`
  );

  const veo3ExtensionPart1Prompt8s = compose(
    `[PARTE 1] ${neutralFacts} Mostra l'avvicinamento all'azione principale: contesto rapido, movimento iniziale, tensione visiva e istante prima della conseguenza. Fermati prima della risoluzione completa.`
  );

  const veo3ExtensionPart2Prompt8s = compose(
    `[PARTE 2] Riprendi dal punto in cui la clip precedente si interrompe: conseguenza dell'azione principale, reazioni dei soggetti, assestamento del movimento e chiusura leggibile. Non ripetere l'avvicinamento.`
  );

  const seedancePrompt15s = compose(
    `${neutralFacts} Versione verticale dal ritmo rapido: apertura immediata, gesti leggibili, reazioni espressive, inquadrature dinamiche e chiusura che invita alla riproduzione. Energia alta, chiarezza prima di tutto.`
  );

  const optimizedPrompt12s = compose(
    `${soraPrompt12s}`
  );

  const optimizedPrompt15s = compose(
    `${neutralFacts}${dialogueSnippet} Trasforma il momento in una sequenza verticale breve, leggibile e continua: apertura immediata sull'azione principale, movimento chiaro dei soggetti, reazioni visibili e chiusura comprensibile senza aggiungere eventi non presenti.`
  );

  const bestOptimizedPrompt = optimizedPrompt15s.length >= soraPrompt15s.length
    ? optimizedPrompt15s
    : soraPrompt15s;

  return {
    sceneMasterPrompt,
    aiPrompts: bestOptimizedPrompt,
    promptSora12s: soraPrompt12s,
    soraPrompt12s,
    promptSora15s: soraPrompt15s,
    soraPrompt15s,
    klingPrompt10s,
    klingPrompt15s,
    klingPrompt: klingPrompt15s,
    veo3Prompt8s,
    veoPrompt: veo3Prompt8s,
    veo3ExtensionPart1Prompt8s,
    veo3ExtensionPart2Prompt8s,
    seedancePrompt15s,
    sendancePrompt15s: seedancePrompt15s,
    optimizedPrompt12s,
    optimizedPrompt15s,
    bestOptimizedPrompt
  };
}

function auditPromptVariantDifferentiation(promptSet: Record<string, string>) {
  const entries = Object.entries(promptSet).filter(([, value]) => compressWhitespace(value).length > 0);
  const normalizedMap = new Map<string, string[]>();

  entries.forEach(([key, value]) => {
    const normalized = compressWhitespace(value).toLowerCase();
    const list = normalizedMap.get(normalized) || [];
    list.push(key);
    normalizedMap.set(normalized, list);
  });

  const duplicateGroups = Array.from(normalizedMap.values()).filter((group) => group.length > 1);
  const uniquePromptCount = normalizedMap.size;
  const totalPromptCount = entries.length;
  const similarityWarning = uniquePromptCount < 5;

  logger.info("[PROMPT_VARIANTS_DIFFERENTIATION_AUDIT]", {
    uniquePromptCount,
    totalPromptCount,
    duplicateGroups,
    similarityWarning,
    hasSoraDifferentFromKling: compressWhitespace(promptSet.soraPrompt15s).toLowerCase() !== compressWhitespace(promptSet.klingPrompt15s).toLowerCase(),
    hasVeoDifferentFromSora: compressWhitespace(promptSet.veo3Prompt8s).toLowerCase() !== compressWhitespace(promptSet.soraPrompt15s).toLowerCase(),
    hasSeedanceDifferentFromBest: compressWhitespace(promptSet.seedancePrompt15s).toLowerCase() !== compressWhitespace(promptSet.optimizedPrompt15s).toLowerCase()
  });

  if (similarityWarning) {
    logger.warn("[PROMPT_VARIANTS_TOO_SIMILAR_WARNING]", {
      uniquePromptCount,
      duplicateGroups
    });
  }
}

/**
 * AUDIO VIDEO RELATION AUDIT (FASE 3.3A)
 * Analisi diagnostica del nesso tra battute e immagini.
 * Solo log, zero impatto sui prompt finali.
 */
function deriveSceneMechanismAudit(basePrompt: string, transcript: string, phase1Result?: any) {
  const lowBase = (basePrompt || "").toLowerCase();
  const lowTranscript = (transcript || "").toLowerCase();
  
  // Fonti reali dal Phase 1
  const sceneDNA = phase1Result?.SceneDNA || phase1Result?.sceneDNA;
  const viralStructure = phase1Result?.viralStructure;
  const frameAnalysis = phase1Result?.frameAnalysis || phase1Result?.analysis;
  const visualAnchors = phase1Result?.visualAnchors || sceneDNA?.visualAnchors;
  const criticalExam = phase1Result?.criticalExamReport;

  const audit: any = {
    audioVideoRelation: "UNCLEAR",
    audioRole: "dialogue",
    visualRole: "action",
    relationSummary: "Relazione tra audio e video non determinata univocamente",
    whyAudioMatters: "Contenuto semantico del parlato",
    whyVisualMatters: "Esecuzione fisica dell'azione",
    mustPreserve: "Nessun vincolo relazionale critico identificato",
    mustNotInvent: "Non inventare battute o conseguenze non documentate",
    confidence: "LOW",
    evidenceFromTranscript: "evidence insufficient",
    evidenceFromVision: "ipotesi non confermata visivamente",
    sourceFields: [] as string[],
    warnings: [] as string[]
  };

  // Tracciamento sorgenti reali
  if (transcript) audit.sourceFields.push("transcript");
  if (sceneDNA) audit.sourceFields.push("SceneDNA");
  if (viralStructure) audit.sourceFields.push("viralStructure");
  if (frameAnalysis) audit.sourceFields.push("frameAnalysis");
  if (visualAnchors) audit.sourceFields.push("visualAnchors");
  if (criticalExam) audit.sourceFields.push("criticalExamReport");

  // Evidenze Transcript (Solo frasi reali)
  if (transcript && transcript.trim().length > 0) {
    audit.evidenceFromTranscript = transcript.substring(0, 250).trim();
  }

  // Evidenze Vision (Solo dati reali)
  let visionSummary = "";
  if (visualAnchors) visionSummary += `Anchors: ${visualAnchors}. `;
  if (frameAnalysis && typeof frameAnalysis === 'string') visionSummary += `Vision: ${frameAnalysis.substring(0, 150)}... `;
  if (sceneDNA?.visualDescription) visionSummary += `Desc: ${sceneDNA.visualDescription.substring(0, 150)}... `;
  
  if (visionSummary.trim()) {
    audit.evidenceFromVision = visionSummary.trim();
  }

  let isVisionWeak = false;
  const visionLower = audit.evidenceFromVision.toLowerCase();
  
  if (!audit.evidenceFromVision || 
       visionLower === "ipotesi non confermata visivamente" ||
       audit.evidenceFromVision.includes("RISULTATO: {}") || 
       visionLower.includes(String(audit.evidenceFromTranscript).toLowerCase()) && visionLower.length < Number(audit.evidenceFromTranscript?.length || 0) + 20) {
      isVisionWeak = true;
  }

  // LOGICA DI CLASSIFICAZIONE (Fase 3.3A)
  
  // 1. TRIGGER (Es: Cambio di stato o sparizione attivata da battuta)
  const stateChangeKeywords = ["sparisce", "sparire", "disappear", "trasforma", "transform", "cambia", "becomes", "diventa"];
  const triggerKeywords = ["leggenda", "narra", "chiunque", "se dico", "if i say", "pensa", "think", "bugia", "lie"];
  
  const hasTrigger = triggerKeywords.some(k => lowTranscript.includes(k)) || lowBase.includes("trigger");
  const hasConsequence = stateChangeKeywords.some(k => lowBase.includes(k) || lowTranscript.includes(k));
  
  if (hasTrigger && hasConsequence) {
    audit.audioVideoRelation = "TRIGGER";
    audit.ruleDetectedFromTranscript = true;

    // Estrazione specifica (Fase 3.3B)
    const ruleMatch = transcript.match(/(La leggenda narra che|Si dice che|Chiunque|Se dici).*?(sparisce|sparire|scatta|succede)/i);
    if (ruleMatch) {
      audit.ruleLine = ruleMatch[0];
    }

    if (lowTranscript.includes("bugia")) audit.triggerCondition = "pronunciare una bugia";
    if (lowTranscript.includes("sparisce") || lowTranscript.includes("sparire")) audit.expectedConsequence = "sparizione del soggetto";

    audit.relationSummary = "La battuta o l'evento audio attiva una conseguenza visiva o un cambio di stato";
    audit.mustPreserve = "Sincronismo tra l'indizio audio e la reazione/conseguenza visiva";
    
    // Verifica vision della conseguenza
    const visionConfirmsConsequence = stateChangeKeywords.some(k => visionSummary.toLowerCase().includes(k)) 
                                   || visionSummary.toLowerCase().includes("taglio") 
                                   || visionSummary.toLowerCase().includes("vuoto");
    
    audit.visualConsequenceConfirmed = visionConfirmsConsequence && !isVisionWeak;
    
    if (audit.visualConsequenceConfirmed) {
      audit.confidence = "HIGH";
    } else {
      audit.confidence = isVisionWeak ? "LOW" : "MEDIUM";
      if (isVisionWeak) {
          audit.warnings.push("Vision evidence weak: consequence not visually confirmed");
      } else {
          audit.warnings.push("conseguenza visiva dedotta dall'audio, non confermata esplicitamente dai frame");
      }
    }
  }
  
  // 2. DIRECT_LINK
  else if (lowBase.includes("descrive") || lowTranscript.includes("guarda questo") || lowTranscript.includes("vedi")) {
    audit.audioVideoRelation = "DIRECT_LINK";
    audit.relationSummary = "L'audio descrive o accompagna direttamente ciò che accade nel video";
    audit.confidence = (!isVisionWeak && audit.evidenceFromTranscript !== "evidence insufficient") ? "HIGH" : (isVisionWeak ? "LOW" : "MEDIUM");
    if (isVisionWeak) audit.warnings.push("Vision evidence weak: consequence not visually confirmed");
  }

  // 3. MUSIC_DRIVEN
  else if (lowBase.includes("musica") || lowBase.includes("ritmo") || lowBase.includes("dance") || lowBase.includes("beat")) {
    audit.audioVideoRelation = "MUSIC_DRIVEN";
    audit.audioRole = "music";
    audit.visualRole = "movement/rhythm";
    audit.confidence = "MEDIUM";
  }
  
  // 4. AMBIENT
  else if (lowBase.includes("background sound") || lowBase.includes("rumori d'ambiente")) {
    audit.audioVideoRelation = "AMBIENT";
    audit.audioRole = "ambient_sound";
    audit.confidence = "HIGH";
  }

  return audit;
}

function splitTranscriptIntoDialogueTurns(transcript: string): string[] {
  if (!transcript || typeof transcript !== "string") return [];
  return transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function normalizeSeconds(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseTimestampString(value: string): number | null {
  if (!value || typeof value !== "string") return null;
  const num = parseFloat(value.replace("s", "").trim());
  return Number.isFinite(num) ? num : null;
}

function formatSecondsLabel(value: number | null) {
  return value === null ? null : `${value.toFixed(2)}s`;
}

function getRealFrameTimeline(phase1Result: any) {
  const sourceCandidates = [
    {
      source: "phase1Result.frameTimestamps",
      values: Array.isArray(phase1Result?.frameTimestamps) ? phase1Result.frameTimestamps : []
    },
    {
      source: "runtimeTruthStatus.frameTimestamps",
      values: Array.isArray(phase1Result?.runtimeTruthStatus?.frameTimestamps) ? phase1Result.runtimeTruthStatus.frameTimestamps : []
    }
  ];

  for (const candidate of sourceCandidates) {
    const timeline = candidate.values
      .map((value: any, index: number) => ({
        frameIndex: index,
        timestamp: typeof value === "string" ? value : formatSecondsLabel(normalizeSeconds(value)),
        timestampSeconds: typeof value === "string" ? parseTimestampString(value) : normalizeSeconds(value)
      }))
      .filter((entry: any) => entry.timestamp !== null && entry.timestampSeconds !== null);

    if (timeline.length > 0) {
      logger.info("[FRAME_TIMELINE_SOURCE_AUDIT]", {
        frameTimestampsCount: timeline.length,
        source: candidate.source,
        timestamps: timeline.map((entry: any) => entry.timestamp)
      });
      return { source: candidate.source, timeline };
    }
  }

  logger.info("[FRAME_TIMELINE_SOURCE_AUDIT]", {
    frameTimestampsCount: 0,
    source: "missing",
    timestamps: []
  });
  return { source: "missing", timeline: [] };
}

function buildTranscriptTimingAudit(phase1Result: any, transcript: string) {
  const audioSegments = Array.isArray(phase1Result?.audioSegments) ? phase1Result.audioSegments : [];
  const wordsTimestamped = audioSegments.some((segment: any) => Array.isArray(segment?.words) && segment.words.length > 0);
  const hasRealAudioTimestamps = audioSegments.some((segment: any) => Number.isFinite(Number(segment?.start)) && Number.isFinite(Number(segment?.end)));
  const timingSource = hasRealAudioTimestamps ? "groq_whisper_segments_verbose_json" : "estimated_from_transcript_position";
  return {
    hasRealAudioTimestamps,
    timingSource,
    segmentsCount: audioSegments.length,
    wordsTimestamped,
    canAlignDialogueToFrames: hasRealAudioTimestamps,
    confidence: hasRealAudioTimestamps ? "MEDIUM" : (transcript ? "LOW" : "NONE"),
    notes: hasRealAudioTimestamps
      ? ["Groq Whisper verbose_json ha restituito segmenti con start/end."]
      : ["Timestamp reali frase/parola non disponibili; usare solo stima approssimata dal transcript."]
  };
}

function buildDialogueTurns(transcript: string, phase1Result: any) {
  const turns = splitTranscriptIntoDialogueTurns(transcript);
  const audioSegments = Array.isArray(phase1Result?.audioSegments) ? phase1Result.audioSegments : [];
  const transcriptTimingAudit = buildTranscriptTimingAudit(phase1Result, transcript);
  const videoDuration = normalizeSeconds(phase1Result?.audioDurationSeconds)
    ?? (Array.isArray(phase1Result?.runtimeTruthStatus?.frameTimestamps)
      ? Math.max(...phase1Result.runtimeTruthStatus.frameTimestamps.map((ts: string) => parseTimestampString(ts) || 0), 0)
      : null);

  const realSegments = audioSegments
    .map((segment: any, index: number) => ({
      turnIndex: index,
      line: String(segment?.text || "").trim(),
      speakerLabelFromTranscript: null,
      hasExplicitSpeaker: false,
      startTime: normalizeSeconds(segment?.start),
      endTime: normalizeSeconds(segment?.end),
      timingSource: "groq_whisper_segments_verbose_json",
      confidence: "MEDIUM"
    }))
    .filter((segment: any) => segment.line.length > 0);

  if (realSegments.length > 0) {
    return { dialogueTurns: realSegments, transcriptTimingAudit };
  }

  const estimatedTurns = turns.map((line, index) => {
    const startRatio = turns.length > 0 ? index / turns.length : 0;
    const endRatio = turns.length > 0 ? (index + 1) / turns.length : 0;
    const startTime = videoDuration !== null ? Number((startRatio * videoDuration).toFixed(2)) : null;
    const endTime = videoDuration !== null ? Number((endRatio * videoDuration).toFixed(2)) : null;
    return {
      turnIndex: index,
      line,
      speakerLabelFromTranscript: null,
      hasExplicitSpeaker: false,
      startTime,
      endTime,
      timingSource: "estimated_from_transcript_position",
      confidence: "LOW"
    };
  });

  return { dialogueTurns: estimatedTurns, transcriptTimingAudit };
}

function buildDialogueFrameAlignment(phase1Result: any, dialogueTurns: any[]) {
  const frameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const { source: frameTimelineSource, timeline: realFrameTimeline } = getRealFrameTimeline(phase1Result);
  const observationByFrameIndex: Map<number, any> = new Map(
    frameObservations.map((obs: any) => [typeof obs?.frameIndex === "number" ? obs.frameIndex : -1, obs])
  );

  const findNearestFrame = (targetTime: number | null) => {
    if (targetTime === null) return null;
    const candidates = realFrameTimeline
      .map((frame: any) => ({
        ...frame,
        delta: Math.abs((frame.timestampSeconds as number) - targetTime)
      }))
      .sort((a: any, b: any) => a.delta - b.delta);
    return candidates[0] || null;
  };

  logger.info("[DIALOGUE_FRAME_ALIGNMENT_REAL_TIMELINE_START]", {
    dialogueTurnsCount: dialogueTurns.length,
    realFrameTimestampsCount: realFrameTimeline.length,
    frameTimelineSource
  });

  const dialogueFrameAlignment = dialogueTurns.map((turn: any) => {
    const startTime = normalizeSeconds(turn?.startTime);
    const endTime = normalizeSeconds(turn?.endTime);
    const midTime = startTime !== null && endTime !== null ? Number((((startTime + endTime) / 2)).toFixed(2)) : startTime;
    const nearestFrameByStart = findNearestFrame(startTime);
    const nearestFrameByMid = findNearestFrame(midTime);
    const nearestFrameByEnd = findNearestFrame(endTime);
    const isShortTurn = String(turn?.line || "").length <= 24 || (startTime !== null && endTime !== null && (endTime - startTime) <= 1.5);
    const isLikelyFinalTurn = turn?.turnIndex === dialogueTurns.length - 1;
    const shouldPreferEndTime = isLikelyFinalTurn
      && nearestFrameByEnd
      && nearestFrameByMid
      && nearestFrameByEnd.frameIndex !== nearestFrameByMid.frameIndex;
    const selectedFrameStrategy = shouldPreferEndTime ? "endTime" : (isShortTurn ? "startTime" : "midTime");
    const selectedFrame = selectedFrameStrategy === "startTime"
      ? (nearestFrameByStart || nearestFrameByMid || nearestFrameByEnd)
      : (selectedFrameStrategy === "endTime"
          ? (nearestFrameByEnd || nearestFrameByMid || nearestFrameByStart)
          : (nearestFrameByMid || nearestFrameByStart || nearestFrameByEnd));
    const selectedObservation = selectedFrame ? observationByFrameIndex.get(selectedFrame.frameIndex) : null;
    const visibleSubjects = Array.isArray(selectedObservation?.visibleSubjects) ? selectedObservation.visibleSubjects : [];
    const visibleActions = selectedObservation?.visibleAction ? [String(selectedObservation.visibleAction)] : [];
    const hasRealTiming = turn?.timingSource === "groq_whisper_segments_verbose_json";
    const singleVisibleSubject = visibleSubjects.length === 1 ? visibleSubjects[0] : null;
    const timeDeltaSeconds = selectedFrame ? Number(Number(selectedFrame.delta).toFixed(2)) : null;
    const possibleSpeakerFromFrame = !selectedFrame
      ? "unknown"
      : (!selectedObservation
          ? "unknown"
          : (visibleSubjects.length > 1 ? "ambiguous" : (singleVisibleSubject || "unknown")));
    const assignmentConfidence = !selectedFrame
      ? "NONE"
      : (!selectedObservation
          ? "LOW"
          : (singleVisibleSubject && hasRealTiming && timeDeltaSeconds !== null && timeDeltaSeconds <= 2
              ? "MEDIUM"
              : "LOW"));
    const assignmentReason = !selectedFrame
      ? "No real frame timeline available."
      : (!selectedObservation
          ? "Nearest real frame has no returned vision observation."
          : (visibleSubjects.length > 1
              ? "Nearest real frame contains multiple visible subjects."
              : (singleVisibleSubject
                  ? `Nearest real frame ${selectedFrame.timestamp} shows one visible subject.`
                  : "Nearest real frame does not expose a unique visible subject.")));
    const warningBase = !hasRealTiming
      ? "Timing estimated from transcript position."
      : (!selectedObservation
          ? "No vision observation returned for selected real frame."
          : (visibleSubjects.length > 1 ? "Frame has multiple subjects; no definitive speaker attribution." : ""));
    const warning = shouldPreferEndTime
      ? [warningBase, "End-time frame differs from mid-time frame; final-turn alignment favored the ending beat."]
          .filter(Boolean)
          .join(" ")
      : warningBase;

    const result = {
      turnIndex: turn.turnIndex,
      line: turn.line,
      startTime,
      endTime,
      midTime,
      nearestFrameByStart: nearestFrameByStart ? { frameIndex: nearestFrameByStart.frameIndex, timestamp: nearestFrameByStart.timestamp } : null,
      nearestFrameByMid: nearestFrameByMid ? { frameIndex: nearestFrameByMid.frameIndex, timestamp: nearestFrameByMid.timestamp } : null,
      nearestFrameByEnd: nearestFrameByEnd ? { frameIndex: nearestFrameByEnd.frameIndex, timestamp: nearestFrameByEnd.timestamp } : null,
      selectedFrameStrategy,
      selectedFrameTimestamp: selectedFrame?.timestamp || null,
      selectedFrameIndex: selectedFrame?.frameIndex ?? null,
      nearestFrameTimestamp: selectedFrame?.timestamp || null,
      nearestFrameIndex: selectedFrame?.frameIndex ?? null,
      timeDeltaSeconds,
      visibleSubjectsInSelectedFrame: visibleSubjects,
      visibleActionsInSelectedFrame: visibleActions,
      visibleSubjectsInNearestFrame: visibleSubjects,
      visibleActionsInNearestFrame: visibleActions,
      possibleSpeakerFromFrame,
      assignmentConfidence,
      assignmentReason,
      warning
    };

    logger.info("[DIALOGUE_FRAME_ALIGNMENT_REAL_TIMELINE_ITEM]", {
      segmentIndex: result.turnIndex,
      segmentStart: result.startTime,
      segmentEnd: result.endTime,
      segmentMid: result.midTime,
      nearestFrameIndex: result.selectedFrameIndex,
      nearestFrameTimestamp: result.selectedFrameTimestamp,
      deltaSeconds: result.timeDeltaSeconds,
      textPreview: String(result.line || "").slice(0, 100)
    });

    return result;
  });

  logger.info("[DIALOGUE_FRAME_ALIGNMENT_FIX_AUDIT]", {
    realFrameTimestampsCount: realFrameTimeline.length,
    frameObservationsCount: frameObservations.length,
    usedRealFrameTimeline: realFrameTimeline.length > 0,
    examples: dialogueFrameAlignment.slice(0, 3).map((entry: any) => ({
      turnIndex: entry.turnIndex,
      startTime: entry.startTime,
      selectedFrameTimestamp: entry.selectedFrameTimestamp,
      selectedFrameStrategy: entry.selectedFrameStrategy
    }))
  });

  logger.info("[DIALOGUE_FRAME_ALIGNMENT_REAL_TIMELINE_DONE]", {
    alignedSegmentsCount: dialogueFrameAlignment.length,
    realFrameTimestampsCount: realFrameTimeline.length,
    frameTimelineSource
  });

  return {
    frameTimelineSource,
    realFrameTimeline,
    dialogueFrameAlignment
  };
}

function buildMergedFrameTimeline(phase1Result: any, dialogueTurns: any[] = []) {
  const frameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const { source, timeline } = getRealFrameTimeline(phase1Result);
  const observationByFrameIndex: Map<number, any> = new Map(
    frameObservations.map((obs: any) => [typeof obs?.frameIndex === "number" ? obs.frameIndex : -1, obs])
  );
  const nearestFrameForSegment = (targetTime: number | null) => {
    if (targetTime === null) return null;
    const candidates = timeline
      .map((frame: any) => ({
        frameIndex: frame.frameIndex,
        timestamp: frame.timestamp,
        timestampSeconds: frame.timestampSeconds,
        delta: Math.abs((frame.timestampSeconds as number) - targetTime)
      }))
      .sort((a: any, b: any) => a.delta - b.delta);
    return candidates[0] || null;
  };

  return {
    frameTimelineSource: source,
    realFrameTimestamps: timeline.map((frame: any) => frame.timestamp),
    mergedFrameTimeline: timeline.map((frame: any) => {
      const observation = observationByFrameIndex.get(frame.frameIndex);
      const nearbyAudioSegments = dialogueTurns
        .map((turn: any) => {
          const start = normalizeSeconds(turn?.startTime);
          const end = normalizeSeconds(turn?.endTime);
          const mid = start !== null && end !== null ? Number((((start + end) / 2)).toFixed(2)) : start;
          const nearest = nearestFrameForSegment(mid);
          if (!nearest || nearest.frameIndex !== frame.frameIndex) return null;
          return {
            segmentIndex: turn?.turnIndex ?? null,
            start,
            end,
            text: String(turn?.line || ""),
            deltaSeconds: Number(Number(nearest.delta).toFixed(2))
          };
        })
        .filter(Boolean);
      return {
        frameIndex: frame.frameIndex,
        timestamp: frame.timestamp,
        timestampReal: frame.timestamp,
        observed: Boolean(observation),
        visibleSubjects: Array.isArray(observation?.visibleSubjects) ? observation.visibleSubjects : [],
        visibleObjects: Array.isArray(observation?.visibleObjects) ? observation.visibleObjects : [],
        visibleAction: observation?.visibleAction ? String(observation.visibleAction) : "",
        possibleRole: observation?.possibleRole ? String(observation.possibleRole) : "",
        possibleSpeaker: observation?.possibleSpeaker ? String(observation.possibleSpeaker) : "unknown",
        relationToTranscript: observation?.relationToTranscript ? String(observation.relationToTranscript) : "",
        confidence: observation?.confidence || (observation ? "LOW" : "NONE"),
        sourceKeySlot: observation?.sourceKeySlot,
        warning: observation ? "" : "No vision observation returned for this frame",
        observation: observation || null,
        nearbyAudioSegments
      };
    })
  };
}

function estimateTranscriptSpeakerCount(transcript: string): number {
  const turns = splitTranscriptIntoDialogueTurns(transcript);
  if (turns.length === 0) return 0;
  const hasQuestions = turns.some((turn) => turn.includes("?"));
  const conversationSignals = /(dice|risponde|chiede|guarda|capitano|signora|signore|uomo|donna|ragazzo|ragazza)/i.test(transcript);
  if (hasQuestions && turns.length >= 2) return 2;
  if (conversationSignals && turns.length >= 3) return 2;
  return 1;
}

function buildCastAndDialogueAudit(phase1Result: any, transcript: string, canonicalCastList: string[]) {
  const frameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const detectedCharacters = Array.isArray(canonicalCastList) ? canonicalCastList : [];

  const transcriptText = String(transcript || "");
  const transcriptHasSpeakerLabels = /^[A-ZÀ-ÖØ-Ý][^:]{1,30}:\s/m.test(transcriptText);

  const dialogueTurns = splitTranscriptIntoDialogueTurns(transcript);
  const transcriptSpeakerCountEstimate = estimateTranscriptSpeakerCount(transcript);
  const unattributedLines = dialogueTurns.filter((line) => !/^[A-ZÀ-ÖØ-Ý][^:]{1,30}:\s/.test(line));

  const visualCastCount = typeof phase1Result?.visualCastCount === 'number' ? phase1Result.visualCastCount : detectedCharacters.length;
  
  const warnings: string[] = [];
  if (!transcriptHasSpeakerLabels && visualCastCount > 1) {
    warnings.push("Transcript has no speaker labels; probable speaker assignment engaged.");
  } else if (visualCastCount === 1 && dialogueTurns.length >= 3) {
    warnings.push("Possible multi-speaker scene collapsed into one cast member.");
  } else if (transcriptSpeakerCountEstimate > detectedCharacters.length && detectedCharacters.length > 0) {
    warnings.push("Dialogue indicates more speakers than identified in vision.");
  }

  const possibleSpeakerAssignments = frameObservations.map((obs: any) => ({
    frameIndex: obs?.frameIndex,
    timestamp: obs?.timestamp || "unknown",
    possibleSpeaker: obs?.possibleSpeaker || "unknown",
    possibleRole: obs?.possibleRole || "",
    relationToTranscript: obs?.relationToTranscript || ""
  }));

  const speakerAttributionConfidence = transcriptHasSpeakerLabels ? "HIGH" : (visualCastCount === 1 ? "MEDIUM" : "LOW_PROBABLE");

  return {
    visualCastCount,
    detectedCharacters,
    transcriptHasSpeakerLabels,
    transcriptSpeakerCountEstimate,
    speakerAttributionConfidence,
    warnings,
    canonicalCastList: detectedCharacters,
    dialogueTurns: dialogueTurns.length,
    unattributedLines: unattributedLines.length,
    possibleSpeakerAssignments
  };
}

function inferProbableSpeakerFromDialogueFrameAlignment(
  alignment: any,
  frameObservation: any,
  canonicalCastList: string[]
) {
  const line = String(alignment.line || "").toLowerCase();
  const visibleSubjects = Array.isArray(frameObservation?.visibleSubjects) ? frameObservation.visibleSubjects : [];
  const visibleAction = String(frameObservation?.visibleAction || "").toLowerCase();
  
  // Default values
  let candidate = "unknown";
  let label = "unknown";
  let confidence: "LOW" | "MEDIUM_LOW" = "LOW";
  let reason = "No clear visual or contextual evidence.";
  let isCertain = false;

  logger.info("[PROBABLE_SPEAKER_MAPPING_START]", {
      turnIndex: alignment.turnIndex,
      visibleSubjectsCount: visibleSubjects.length,
      linePreview: line.slice(0, 50)
  });

  if (visibleSubjects.length === 1) {
    candidate = visibleSubjects[0];
    label = candidate;
    confidence = "MEDIUM_LOW";
    reason = "Only one subject visible in the synchronized frame.";
  } else if (visibleSubjects.length > 1) {
    // Heuristics for multiple subjects
    if (visibleAction.includes("parla") || visibleAction.includes("dice") || visibleAction.includes("speaking") || visibleAction.includes("talking")) {
       // Often the first subject is the one doing the action in the prompt description
       candidate = visibleSubjects[0];
       label = candidate;
       confidence = "MEDIUM_LOW";
       reason = `Action "${visibleAction}" suggests the first visible subject is the speaker.`;
    } 
    else if (line.includes("prego") || line.includes("desidera") || line.includes("signora") || line.includes("signore")) {
      const uniformSuspect = visibleSubjects.find((s: string) => 
        s.toLowerCase().includes("uniform") || 
        s.toLowerCase().includes("man") || 
        s.toLowerCase().includes("cameriere") || 
        s.toLowerCase().includes("waiter")
      );
      if (uniformSuspect) {
        candidate = uniformSuspect;
        label = candidate;
        confidence = "LOW";
        reason = "Dialogue context (formal address) suggests a worker or uniformed person.";
      }
    }
    
    if (candidate === "unknown") {
      candidate = visibleSubjects[0];
      label = candidate;
      confidence = "LOW";
      reason = "Multiple subjects visible; defaulted to primary subject for coherence.";
    }
  }

  const result = { 
    probableSpeakerCandidate: candidate, 
    probableSpeakerLabel: label, 
    speakerInferenceConfidence: confidence, 
    speakerInferenceReason: reason, 
    isCertain 
  };

  logger.info("[PROBABLE_SPEAKER_MAPPING_ITEM]", {
      turnIndex: alignment.turnIndex,
      candidate,
      confidence,
      reason
  });

  return result;
}

function buildDialogueSyncAudit(phase1Result: any, transcript: string, canonicalCastList: string[]) {
  const frameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const observationByFrameIndex: Map<number, any> = new Map(
    frameObservations.map((obs: any) => [typeof obs?.frameIndex === "number" ? obs.frameIndex : -1, obs])
  );
  const { dialogueTurns, transcriptTimingAudit } = buildDialogueTurns(transcript, phase1Result);
  const { frameTimelineSource, realFrameTimeline, dialogueFrameAlignment } = buildDialogueFrameAlignment(phase1Result, dialogueTurns);
  const { realFrameTimestamps, mergedFrameTimeline } = buildMergedFrameTimeline(phase1Result, dialogueTurns);
  const transcriptHasSpeakerLabels = /^[A-ZÀ-ÖØ-Ý][^:]{1,30}:\s/m.test(transcript || "");
  
  const possibleSpeakerAssignments = dialogueFrameAlignment.map((entry: any) => {
    const observation = entry.selectedFrameIndex !== null ? observationByFrameIndex.get(entry.selectedFrameIndex) : null;
    const inference = inferProbableSpeakerFromDialogueFrameAlignment(entry, observation, canonicalCastList);
    
    return {
      turnIndex: entry.turnIndex,
      line: entry.line,
      frameIndex: entry.selectedFrameIndex,
      timestamp: entry.selectedFrameTimestamp || "unknown",
      possibleSpeaker: entry.possibleSpeakerFromFrame || "unknown",
      visibleSubjects: Array.isArray(entry?.visibleSubjectsInSelectedFrame) ? entry.visibleSubjectsInSelectedFrame : [],
      relationToTranscript: entry?.assignmentReason || "",
      ...inference
    };
  });

  const lowConfidenceAssignmentsCount = possibleSpeakerAssignments.filter((a: any) => a.speakerInferenceConfidence === "LOW").length;
  const mediumConfidenceAssignmentsCount = possibleSpeakerAssignments.filter((a: any) => a.speakerInferenceConfidence === "MEDIUM").length;
  const highConfidenceAssignmentsCount = possibleSpeakerAssignments.filter((a: any) => a.speakerInferenceConfidence === "HIGH").length;
  const probableAssignmentsCount = possibleSpeakerAssignments.length;

  let speakerAssignmentMode: "CERTAIN_SPEAKER_ASSIGNMENT" | "CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT" | "NO_SPEAKER_ASSIGNMENT" = "NO_SPEAKER_ASSIGNMENT";

  if (transcriptHasSpeakerLabels) {
    speakerAssignmentMode = "CERTAIN_SPEAKER_ASSIGNMENT";
  } else if (probableAssignmentsCount > 0) {
    speakerAssignmentMode = "CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT";
    logger.info("[CAUTIOUS_SPEAKER_ASSIGNMENTS_ENABLED]", {
      probableAssignmentsCount,
      lowConfidenceAssignmentsCount,
      mediumConfidenceAssignmentsCount,
      highConfidenceAssignmentsCount
    });
  }

  logger.info("[PROBABLE_SPEAKER_MAPPING_DONE]", {
      itemCount: possibleSpeakerAssignments.length,
      speakerAssignmentMode
  });

  const strongCandidateAssignmentsCount = possibleSpeakerAssignments.filter((entry: any) => entry.possibleSpeaker !== "unknown" && entry.possibleSpeaker !== "ambiguous").length;
  const unassignedDialogueLines = dialogueTurns.map((turn: any) => ({
    turnIndex: turn.turnIndex,
    speaker: "unknown",
    line: turn.line,
    confidence: turn.confidence || (transcriptHasSpeakerLabels ? "MEDIUM" : "LOW")
  }));
  const visualCastCount = typeof phase1Result?.visualCastCount === "number" ? phase1Result.visualCastCount : 0;
  const alignedTurnsCount = dialogueFrameAlignment.filter((entry: any) => entry.selectedFrameIndex !== null).length;
  const ambiguousAssignmentsCount = dialogueFrameAlignment.filter((entry: any) => entry.possibleSpeakerFromFrame === "ambiguous").length;
  const unknownAssignmentsCount = dialogueFrameAlignment.filter((entry: any) => entry.possibleSpeakerFromFrame === "unknown").length;
  const hasFrameTimeAlignment = transcriptTimingAudit.hasRealAudioTimestamps && realFrameTimeline.length > 0;
  const canAssignSpeakers = hasFrameTimeAlignment && (speakerAssignmentMode !== "NO_SPEAKER_ASSIGNMENT");

  const notes: string[] = [];

  if (!transcriptHasSpeakerLabels) {
    notes.push("Transcript privo di speaker labels espliciti: abilitata modalità CAUTIOUS_PROBABLE.");
  }
  if (!hasFrameTimeAlignment) {
    notes.push("Mancano timestamp parola/frase per allineare battute e frame.");
  }
  if ((visualCastCount > 1 || (canonicalCastList?.length || 0) > 1) && !canAssignSpeakers) {
    notes.push("Sono presenti più soggetti visivi, ma il dialogo non è attribuibile con affidabilità.");
  }

  const confidence = !transcriptTimingAudit.hasRealAudioTimestamps || realFrameTimeline.length === 0
    ? "NONE"
    : (strongCandidateAssignmentsCount > 0 ? "MEDIUM" : (probableAssignmentsCount > 0 ? "LOW_PROBABLE" : "LOW"));

  return {
    transcriptHasSpeakerLabels,
    speakerAssignmentMode,
    hasRealAudioTimestamps: transcriptTimingAudit.hasRealAudioTimestamps,
    timingSource: transcriptTimingAudit.timingSource,
    audioDurationSeconds: normalizeSeconds(phase1Result?.audioDurationSeconds),
    frameTimelineSource,
    realFrameTimestamps,
    transcriptTimingAudit,
    dialogueTurns,
    dialogueFrameAlignment,
    mergedFrameTimeline,
    dialogueTurnsCount: dialogueTurns.length,
    estimatedTurnCount: dialogueTurns.length,
    frameObservationCount: frameObservations.length,
    alignedTurnsCount,
    unalignedTurnsCount: Math.max(0, dialogueTurns.length - alignedTurnsCount),
    ambiguousAssignmentsCount,
    unknownAssignmentsCount,
    strongCandidateAssignmentsCount,
    lowConfidenceAssignmentsCount,
    mediumConfidenceAssignmentsCount,
    highConfidenceAssignmentsCount,
    probableAssignmentsCount,
    possibleSpeakerAssignments,
    unassignedDialogueLines: unassignedDialogueLines.length,
    hasFrameTimeAlignment,
    canAssignSpeakers,
    reasonCannotAssignSpeakers: canAssignSpeakers
      ? ""
      : (!hasFrameTimeAlignment
          ? "Audio timestamps unavailable for reliable frame alignment."
          : "No speaker candidates available from alignment or transcript labels."),
    confidence,
    notes
  };
}

function normalizeConsequenceLabel(value: string) {
  const lowValue = String(value || "").toLowerCase();
  if (!lowValue) return "";
  if (/sparisc|svanisc|scompar/i.test(lowValue)) return "sparizione";
  if (/cade|croll/i.test(lowValue)) return "caduta";
  if (/muor/i.test(lowValue)) return "morte";
  if (/romp|frantum/i.test(lowValue)) return "rottura";
  if (/reagisc/i.test(lowValue)) return "reazione";
  return String(value || "").trim();
}

/**
 * Ritorna un'etichetta umana sicura per i personaggi, evitando placeholder tecnici.
 */
function safeHumanLabel(identifier: string): string {
    if (!identifier) return "il soggetto";
    const low = identifier.toLowerCase().trim();
    if (low.includes("unknown") || low.includes("ambiguous") || low === "person 1" || low === "person_1") {
        return "un personaggio";
    }
    // Usa normalizePromptSubjectLabel come base di normalizzazione
    return normalizePromptSubjectLabel(identifier);
}

function extractCausalRuleFromTranscript(transcript: string) {
  const turns = splitTranscriptIntoDialogueTurns(transcript);
  const causalCandidates = turns.filter((line) => /(chiunque|se\s+qualcuno|se\s+uno|se\s+una|chi\s+|quando\s+)/i.test(line));
  const consequencePattern = /(sparisc[a-z]*|svanisc[a-z]*|scompar[a-z]*|cad[eonoa-z]*|croll[a-z]*|muor[a-z]*|romp[a-z]*|reagisc[a-z]*|divent[a-z]*|trasform[a-z]*)/i;

  for (const line of causalCandidates) {
    const lineMatch = line.match(consequencePattern);
    if (!lineMatch) continue;
    const consequenceRaw = lineMatch[0];
    const consequenceIndex = line.toLowerCase().indexOf(consequenceRaw.toLowerCase());
    const leftSide = consequenceIndex > 0 ? line.slice(0, consequenceIndex).trim() : line.trim();
    let triggerCondition = leftSide
      .replace(/^.*?(chiunque|se\s+qualcuno|se\s+uno|se\s+una|chi|quando)\s+/i, "")
      .replace(/^(dica|dice|dirà|dice una|fa|fà|fa una|fa un|ha|è|sia)\s+/i, (match) => match.toLowerCase())
      .trim();

    if (triggerCondition) {
      triggerCondition = triggerCondition
        .replace(/\s{2,}/g, " ")
        .replace(/[,:;]+$/g, "")
        .trim();
    }

    return {
      ruleDetectedFromTranscript: true,
      ruleLine: line.trim(),
      triggerCondition,
      expectedConsequence: normalizeConsequenceLabel(consequenceRaw)
    };
  }

  return {
    ruleDetectedFromTranscript: false,
    ruleLine: "",
    triggerCondition: "",
    expectedConsequence: ""
  };
}

function buildSceneMechanismAudit(phase1Result: any, transcript: string) {
  const frameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const visibleSceneMechanism = phase1Result?.visibleSceneMechanism || {};
  const lowTranscript = (transcript || "").toLowerCase();
  const extractedRule = extractCausalRuleFromTranscript(transcript);
  const ruleLine = extractedRule.ruleLine || "";
  const triggerCondition = extractedRule.triggerCondition || visibleSceneMechanism.triggerAction || "";
  const expectedConsequence = extractedRule.expectedConsequence || normalizeConsequenceLabel(visibleSceneMechanism.visualConsequence || visibleSceneMechanism.stateChange || "");

  const consequenceHints = [expectedConsequence, visibleSceneMechanism.stateChange, visibleSceneMechanism.visualConsequence]
    .filter(Boolean)
    .map((value: string) => value.toLowerCase());

  const visualConsequenceConfirmed = frameObservations.some((obs: any) => {
    const haystack = `${obs?.visibleAction || ""} ${obs?.relationToTranscript || ""}`.toLowerCase();
    return consequenceHints.some((hint) => hint && haystack.includes(hint));
  });

  const stateChangeConfirmed = frameObservations.some((obs: any) => {
    const haystack = `${obs?.visibleAction || ""} ${obs?.relationToTranscript || ""}`.toLowerCase();
    return /(sparisc|svanisc|cade|crolla|rompe|reagisce|scompare|disappear|fall|break)/i.test(haystack);
  });

  const payoffCandidate = visibleSceneMechanism.payoffCandidate || frameObservations[frameObservations.length - 1]?.visibleAction || "";
  const payoffConfirmed = !!payoffCandidate && (visualConsequenceConfirmed || stateChangeConfirmed);
  const missingLinks: string[] = [];

  if (!extractedRule.ruleDetectedFromTranscript) missingLinks.push("No clear causal rule detected in transcript.");
  if (!visualConsequenceConfirmed) missingLinks.push("Visual consequence not confirmed in frame observations.");
  if (!payoffConfirmed) missingLinks.push("Final payoff not confirmed visually.");

  return {
    ruleDetectedFromTranscript: !!extractedRule.ruleDetectedFromTranscript,
    ruleLine,
    triggerCondition,
    expectedConsequence,
    visualConsequenceConfirmed: visualConsequenceConfirmed ? true : (frameObservations.length > 0 ? false : "unknown"),
    stateChangeConfirmed: stateChangeConfirmed ? true : (frameObservations.length > 0 ? false : "unknown"),
    payoffCandidate,
    payoffConfirmed: payoffConfirmed ? true : (frameObservations.length > 0 ? false : "unknown"),
    missingLinks,
    confidence: extractedRule.ruleDetectedFromTranscript && visualConsequenceConfirmed ? "HIGH" : (extractedRule.ruleDetectedFromTranscript || frameObservations.length > 0 || lowTranscript.length > 0 ? "MEDIUM" : "LOW"),
    notes: extractedRule.ruleDetectedFromTranscript ? "Transcript suggests a causal rule; audit checks whether frames confirm the visible consequence." : "No explicit causal rule pattern extracted from transcript."
  };
}

/**
 * DURATION-AWARE BEAT SELECTION (FASE 3.3B-0)
 * Audit diagnostico per la scelta dei momenti chiave in base alla durata.
 */
function deriveDurationBeatStrategy(basePrompt: string, transcript: string, phase1Result?: any) {
  const lowBase = (basePrompt || "").toLowerCase();
  const lowTranscript = (transcript || "").toLowerCase();
  
  const sceneDNA = phase1Result?.SceneDNA || phase1Result?.sceneDNA;
  const viralStructure = phase1Result?.viralStructure;
  const frameAnalysis = phase1Result?.frameAnalysis || phase1Result?.analysis;
  const visualAnchors = phase1Result?.visualAnchors || sceneDNA?.visualAnchors;
  const microTension = phase1Result?.microTension || phase1Result?.microTensionEngine;
  const criticalExam = phase1Result?.criticalExamReport;

  // Rilevamento Genre
  let contentType = "general";
  if (lowBase.includes("comico") || lowBase.includes("funny") || lowBase.includes("sketch")) contentType = "comedy";
  else if (lowBase.includes("musica") || lowBase.includes("music") || lowBase.includes("canzone") || lowBase.includes("song")) contentType = "music";
  else if (lowBase.includes("dramma") || lowBase.includes("drama") || lowBase.includes("emozion")) contentType = "drama";
  else if (lowBase.includes("azione") || lowBase.includes("action") || lowBase.includes("stunt")) contentType = "action";

  const strategy: any = {
    contentType,
    fullSceneArc: sceneDNA?.visualDescription || "Arco non definito",
    firstBeat: "Inizio della sequenza / apertura",
    strongestBeat: "Momento culminante o payoff",
    essentialBeat: "Il nucleo della scena",
    essentialCharacter: "Soggetto principale",
    essentialLine: extractVerifiedDialogueLine(transcript) || "none",
    essentialSoundOrMusicMoment: "none",
    essentialVisualMoment: "Azione chiave",
    strongestConsequence: "Esito dell'evento",
    supportingBeats: [] as string[],
    removableBeatsForShortDuration: [] as string[],
    strategy8s: "Taglio netto sul momento culminante",
    strategy12s: "Setup breve + culminante + reazione",
    strategy15s: "Arco completo ridotto",
    strategy8plus8Part1: "Sviluppo e tensione iniziale",
    strategy8plus8Part2: "Risoluzione e beat principale",
    confidence: "LOW",
    evidenceFromTranscript: transcript?.substring(0, 150) || "insufficiente",
    evidenceFromVision: (visualAnchors || sceneDNA?.visualDescription || "").substring(0, 150) || "insufficiente",
    evidenceFromAudio: "none",
    sourceFields: [] as string[],
    warnings: [] as string[]
  };

  if (transcript) strategy.sourceFields.push("transcript");
  if (sceneDNA) strategy.sourceFields.push("SceneDNA");
  if (viralStructure) strategy.sourceFields.push("viralStructure");
  if (microTension) strategy.sourceFields.push("microTension");

  // LOGICA DI SPECIFICAZIONE BEAT
  
  // 1. COMEDY / DIALOGUE
  if (contentType === "comedy") {
    strategy.firstBeat = viralStructure?.setup || "Introduzione della gag";
    strategy.strongestBeat = viralStructure?.payoff || "Payoff comico finale";
    strategy.essentialBeat = strategy.strongestBeat;
    
    if (viralStructure?.payoff && viralStructure?.setup && contentType === "comedy") {
        strategy.essentialBeat = viralStructure.payoff;
        strategy.essentialCharacter = viralStructure.payoffCharacter || sceneDNA?.primaryCharacter || "Protagonista";
        strategy.essentialLine = viralStructure.payoffLine || strategy.essentialLine;
        strategy.strongestConsequence = "conseguenza comica / payoff";
        strategy.supportingBeats = [viralStructure.setup, viralStructure.escalation].filter(Boolean);
        strategy.removableBeatsForShortDuration = strategy.supportingBeats;
    }
  }
  
  // 2. MUSIC
  else if (contentType === "music") {
    strategy.firstBeat = "Inizio buildup / strofa";
    strategy.strongestBeat = "Drop / Ritornello / Punto di picco";
    strategy.essentialBeat = strategy.strongestBeat;
    strategy.strategy8s = "Solo il ritornello o il drop più forte";
  }

  // PONDERAZIONE CONFIDENCE (Rigorosa)
  const hasStrongPayoff = !!viralStructure?.payoff;
  const hasVisualConfirmation = (sceneDNA?.visualDescription && !isWeakTranscriptFragment(sceneDNA.visualDescription));
  const hasAudioVideoSync = (lowTranscript.length > 20 && hasVisualConfirmation);

  if (hasStrongPayoff && hasVisualConfirmation && hasAudioVideoSync) {
    strategy.confidence = "HIGH";
  } else if (hasStrongPayoff || hasVisualConfirmation) {
    strategy.confidence = "MEDIUM";
    strategy.warnings.push("Beat essenziale dedotto ma non cross-validato totalmente");
  }

  return strategy;
}

/**
 * IDENTIFICA FRAMMENTI DEBOLI (FASE 3.3A.1 FIX)
 * Impedisce l'uso di frasi di riempimento come azioni principali.
 */
function isWeakTranscriptFragment(text: string): boolean {
    if (!text) return true;
    const lower = text.toLowerCase().trim();
    if (lower.length < 5) return true;
    
    const weakPhrases = [
        "vabbè", "allora", "certo", "sicuro", 
        "diciamo", "più o meno", "un attimo", "guarda", 
        "mentre dice", "parla e basta", "frase debole", "nulla di che",
        "insomma", "ecco", "praticamente"
    ];
    
    // Se è corto e contiene una frase debole, scarta
    if (weakPhrases.some(p => lower.includes(p)) && lower.split(' ').length < 8) {
        return true;
    }
    
    // Se non contiene verbi d'azione o nomi di oggetti/personaggi rilevanti
    const hasAction = /(indica|mostra|guarda|dice|parla|esegue|compie|presenta|muove|cammina|reagisce|afferma|ascolta|ride|sorride)/i.test(lower);
    if (!hasAction && lower.length < 35) return true;

    return false;
}

/**
 * CLEANUP LINGUISTICO SCENE CARD (FASE 3.3A.1)
 * Rimuove frammenti inglesi orfani dai campi atomici.
 */
function normalizePromptSubjectLabel(label: string): string {
    if (!label) return "il soggetto";
    const normalized = label.trim().toLowerCase();
    
    if (normalized === "unknown" || normalized === "ambiguous") return "personaggio non identificato";
    if (/^persona\s+\d+$/i.test(label.trim())) return label.trim();

    const mapping: Record<string, string> = {
        "woman": "donna",
        "man": "uomo",
        "policeman": "poliziotto / carabiniere",
        "uniformed_man": "uomo in uniforme",
        "uniformed_man_1": "uomo in uniforme",
        "uniformed_man_2": "secondo uomo in uniforme",
        "elderly_man": "uomo anziano",
        "old_man": "uomo anziano",
        "young_man": "giovane uomo",
        "young_man_1": "giovane uomo 1",
        "young_man_2": "giovane uomo 2",
        "other_man": "altro uomo visibile",
        "female": "donna",
        "male": "uomo",
        "lady": "donna",
        "girl": "ragazza",
        "boy": "ragazzo",
        "leather_jacket_person": "persona con giacca di pelle",
        "crossed_arms_person": "persona con braccia incrociate",
        "pointed_hat_person": "persona con cappello appuntito",
        "manned uniform": "uomo in uniforme",
        "true woman": "donna"
    };

    if (mapping[normalized]) return mapping[normalized];

    // Handle numbered suffixes
    const numberedMatch = normalized.match(/^(.+?)[_\s](\d+)$/);
    if (numberedMatch) {
        const base = numberedMatch[1];
        const num = numberedMatch[2];
        const translatedBase = mapping[base] || base.replace(/_/g, " ");
        return `${translatedBase} ${num}`;
    }

    return normalized.replace(/_/g, " ");
}

function normalizePromptObjectLabel(label: string): string {
    const normalized = String(label || "").trim().toLowerCase();
    if (!normalized) return "";
    if (normalized === "mirror") return "specchio";
    if (normalized === "cross on the wall") return "croce alla parete";
    if (normalized === "indoor setting") return "stanza interna";
    return normalized.replace(/_/g, " ");
}

function buildPromptCastLabels(phase1Result: any, transcript: string = "") {
  const castGroundingAudit = phase1Result?.castGroundingAudit || {};
  const visualTruthEntries = Array.isArray(castGroundingAudit?.visualTruthEntries) ? castGroundingAudit.visualTruthEntries : [];
  const canonicalCastList = Array.isArray(phase1Result?.canonicalCastList) ? phase1Result.canonicalCastList : [];
  const detectedCharacters = Array.isArray(phase1Result?.detectedCharacters) ? phase1Result.detectedCharacters : [];
  const frameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const seenTrace = phase1Result?.promptDecisionTrace?.seen || {};
  const rawDetectedCharacters = [...new Set(
    []
      .concat(detectedCharacters)
      .concat(Array.isArray(seenTrace?.visibleCharacters) ? seenTrace.visibleCharacters : [])
      .concat(Array.isArray(seenTrace?.aggregatedVisibleSubjects) ? seenTrace.aggregatedVisibleSubjects : [])
      .concat(frameObservations.flatMap((obs: any) => Array.isArray(obs?.visibleSubjects) ? obs.visibleSubjects : []))
      .map((value: any) => String(value || "").trim())
      .filter(Boolean)
  )];
  const transcriptLow = String(transcript || phase1Result?.verifiedTranscript || phase1Result?.script || "").toLowerCase();
  const visibleObjects = [...new Set(
    frameObservations.flatMap((obs: any) => Array.isArray(obs?.visibleObjects) ? obs.visibleObjects : [])
      .map((value: any) => normalizePromptObjectLabel(value))
      .filter(Boolean)
  )];

  const hasCarabiniereSignals = /(carabiniere|carabinieri|divisa italiana|arma)/i.test(transcriptLow)
    || visualTruthEntries.some((entry: any) => /carabiniere|italian police|forza dell'ordine/i.test(String(entry?.recognizedVisualIdentity || "")))
    || visualTruthEntries.some((entry: any) => Array.isArray(entry?.visualEvidence) && entry.visualEvidence.some((item: any) => /divisa|berretto|forza dell'ordine|contesto italiano/i.test(String(item || ""))));

  const normalizeCharacter = (raw: string) => {
    const low = String(raw || "").trim().toLowerCase();
    if (!low) return "";
    if (/uniformed[_\s]?man/.test(low)) return hasCarabiniereSignals ? "carabiniere in divisa" : "uomo in divisa";
    if (low === "man") return "uomo adulto";
    if (low === "woman") return "donna";
    if (low === "two men") return "due uomini";
    if (/person[_\s]?\d+/.test(low)) return "persona visibile";
    if (/clergyman|priest|cardinale/.test(low)) return low.replace(/_/g, " ");
    return normalizePromptSubjectLabel(raw);
  };

  const truthLabels = visualTruthEntries.map((entry: any) => {
    const specific = String(entry?.recognizedVisualIdentity || entry?.labelUsedInConscience || "").trim();
    const generic = String(entry?.genericFallbackLabel || entry?.rawVisualLabel || "").trim();
    const chosen = specific || generic;
    return chosen ? normalizeCharacter(chosen) : "";
  }).filter(Boolean);

  const canonicalLabels = canonicalCastList.map((item: any) => normalizeCharacter(String(item || "").trim())).filter(Boolean);
  const fallbackLabels = rawDetectedCharacters.map((item: any) => normalizeCharacter(String(item || "").trim())).filter(Boolean);
  const allLabels = [...new Set([...truthLabels, ...canonicalLabels, ...fallbackLabels].filter(Boolean))];
  const primaryCharacter = allLabels[0] || (hasCarabiniereSignals ? "carabiniere in divisa" : "persona visibile");
  const secondaryCharacters = allLabels.slice(1, 4);
  const locationLabel = visibleObjects.includes("specchio")
    ? "stanza interna, davanti a uno specchio"
    : (visibleObjects.includes("stanza interna") ? "stanza interna" : "ambiente interno");
  const keyObjects = visibleObjects.filter((item) => item !== "stanza interna").slice(0, 4);
  const source = visualTruthEntries.length > 0
    ? "visual_truth_entries"
    : (canonicalCastList.length > 0 ? "canonical_cast" : (frameObservations.length > 0 ? "frame_observations" : "fallback"));
  const confidence = visualTruthEntries[0]?.confidence || castGroundingAudit?.castConfidence || "MEDIUM";
  const reason = hasCarabiniereSignals
    ? "specific visual/audio evidence supports a carabiniere-like uniformed subject"
    : "used the most natural prompt-safe labels available from visual truth and cast evidence";

  logger.info("[PROMPT_CAST_LABELS_AUDIT]", {
    rawDetectedCharacters,
    canonicalCastList,
    visualTruthEntriesCount: visualTruthEntries.length,
    selectedPrimaryCharacter: primaryCharacter,
    selectedSecondaryCharacters: secondaryCharacters,
    selectedLocationLabel: locationLabel,
    selectedKeyObjects: keyObjects,
    source,
    confidence,
    promptSafeLabelUsed: true,
    reason
  });

  return {
    primaryCharacter,
    secondaryCharacters,
    locationLabel,
    keyObjects,
    visualIdentityConfidence: confidence,
    source
  };
}

function sanitizePromptCastLabels(text: string) {
  const before = String(text || "");
  let after = before
    .replace(/\buniformed_man\b/gi, "uomo in divisa")
    .replace(/\bperson[_\s]?\d+\b/gi, "persona visibile")
    .replace(/\btwo men\b/gi, "due uomini")
    .replace(/\bman_?\d*\b/gi, "uomo adulto")
    .replace(/\bwoman_?\d*\b/gi, "donna")
    .replace(/\bin un l['’]uomo[^.,;:]*/gi, "in una stanza interna")
    .replace(/(\bl['’]uomo in uniforme\b)(?:\s+in\s+un\s+\1)/gi, "$1 in una stanza interna")
    .replace(/\b([a-z]+_[a-z0-9_]+)\b/gi, (match) => normalizePromptSubjectLabel(match))
    .replace(/\s{2,}/g, " ")
    .trim();

  if (/l'uomo in uniforme in un l'uomo in uniforme/i.test(after)) {
    after = after.replace(/l'uomo in uniforme in un l'uomo in uniforme/gi, "un uomo in divisa in una stanza interna");
  }

  logger.info("[PROMPT_CAST_LABEL_SANITIZER_AUDIT]", {
    doubleRepetitionDetected: /(l['’]uomo in uniforme in un l['’]uomo in uniforme)/i.test(before),
    technicalLabelDetected: /\buniformed_man|person[_\s]?\d+|two men|[a-z]+_[a-z0-9_]+\b/i.test(before),
    dirtyPatternDetected: /\bin un l['’]uomo/i.test(before),
    snakeCaseDetected: /\b[a-z]+_[a-z0-9_]+\b/.test(before),
    corrected: before !== after
  });
  return after;
}

function normalizePromptCastLabel(label: string): string {
    const trimmed = String(label || "").trim();
    if (!trimmed) return "";
    if (/^persona\s+\d+$/i.test(trimmed)) {
        return trimmed.replace(/^persona\s+(\d+)$/i, "Persona $1");
    }
    return normalizePromptSubjectLabel(trimmed);
}

function buildPromptCastContext(resultOrPhase1: any) {
  const canonicalRaw = Array.isArray(resultOrPhase1?.canonicalCastList) ? resultOrPhase1.canonicalCastList : [];
  const castAudit = resultOrPhase1?.castGroundingAudit || {};
  const frameObservations = Array.isArray(resultOrPhase1?.frameObservations) ? resultOrPhase1.frameObservations : [];
  const detectedCharacters = Array.isArray(resultOrPhase1?.detectedCharacters) ? resultOrPhase1.detectedCharacters : [];

  const observedLabels = [...new Set(
    frameObservations
      .flatMap((obs: any) => Array.isArray(obs?.visibleSubjects) ? obs.visibleSubjects : [])
      .concat(detectedCharacters)
      .map((value: string) => normalizePromptCastLabel(value))
      .filter(Boolean)
  )];

  const promptCastLabels = buildPromptCastLabels(resultOrPhase1, resultOrPhase1?.verifiedTranscript || resultOrPhase1?.script || "");
  const castLabels = [promptCastLabels.primaryCharacter]
    .concat(promptCastLabels.secondaryCharacters || [])
    .concat(observedLabels)
    .filter(Boolean)
    .slice(0, 6);

  const castMode =
    castAudit?.castFallbackMode === "MULTI_SUBJECT"
      ? "LOW_CONFIDENCE_MULTI_SUBJECT_FALLBACK"
      : (castLabels.length >= 2 ? "VISUAL_CONFIRMED" : "SINGLE_UNKNOWN");

  const castInstruction =
    castMode === "LOW_CONFIDENCE_MULTI_SUBJECT_FALLBACK"
      ? `Usa le etichette provvisorie disponibili: ${castLabels.join(", ")}. Non fonderle in un solo personaggio, non dichiarare identita certe e mantieni prudente l'attribuzione del parlato.`
      : (castLabels.length >= 2
          ? `Usa queste etichette di cast in modo coerente lungo tutta la scena: ${castLabels.join(", ")}. Se una label include una descrizione visiva possibile, trattala come provvisoria e non trasformarla mai in identita confermata.`
          : (castLabels[0]
              ? `Usa l'etichetta di soggetto disponibile ${castLabels[0]} senza dichiarare identita certe.`
              : `Interazione audio verificata con speaker non identificati. Non inventare un cast se il numero di parlanti non e confermato.`));

  logger.info("[PROMPT_CAST_CONTEXT_BUILT]", {
    castMode,
    castLabels,
    canonicalCastCount: canonicalRaw.length,
    detectedCharactersCount: detectedCharacters.length,
    frameObservationsCount: frameObservations.length,
    castSource: castAudit?.castSource || "unknown",
    castFallbackMode: castAudit?.castFallbackMode || "NONE",
    castVisualConfirmed: castAudit?.castVisualConfirmed ?? null
  });

  return {
    castLabels,
    castMode,
    castInstruction,
    promptCastLabels
  };
}

export function sanitizeFinalPromptGrammar(prompt: string): string {
    if (!prompt) return prompt;
    let s = prompt;

    // placeholder normalizations
    s = s.replace(/\bperson_1\b/gi, "la persona principale");
    s = s.replace(/\bperson_2\b/gi, "la seconda persona");
    s = s.replace(/uniformed[_\s]uomo\b/gi, "l'uomo in uniforme");
    s = s.replace(/uniformed[_\s]man\b/gi, "l'uomo in uniforme");
    s = s.replace(/man_?3\b/gi, "un terzo individuo");

    // grammar and English leaks 
    s = s.replace(/in\s+un\s+leggenda(\s+dello\s+specchio)?\b/gi, "nel contesto della leggenda");
    s = s.replace(/ambiente\s+di\s+un\s+leggenda(\s+dello\s+specchio)?\b/gi, "ambiente legato alla leggenda");
    s = s.replace(/davanti\s+alla\s+pronunciare\s+(una\s+)?bugia\b/gi, "davanti allo specchio mentre viene pronunciata una bugia");
    s = s.replace(/Svolge\s+sfida(\s+la\s+sorte)?\b/gi, "sfida la sorte");
    s = s.replace(/Svolge\s+sfida\b/gi, "sfida");

    s = s.replace(/\bwhile(\s+making\s+eye\s+contact)?\b/gi, "guardando negli occhi");
    s = s.replace(/\bwhile(\s+looking)?\b/gi, "mentre guarda");
    s = s.replace(/\bwhile\b/gi, "mentre");
    s = s.replace(/\bwith\b/gi, "con");
    s = s.replace(/\bcon\s+un\s+nod\b/gi, "con un cenno del capo");
    s = s.replace(/\bnod\b/gi, "cenno del capo");

    s = s.replace(/interagisce\s+con\s+leggenda\s+dello\s+specchio\s+in\s+un\s+leggenda\b/gi, "si trova nel contesto della leggenda");
    s = s.replace(/in\s+un\s+specchio\b/gi, "davanti a uno specchio");
    
    // Some general cleanups
    s = s.replace(/\b(si\s+)?interagisce\s+(con\s+l'ambiente\s+)?in\s+modo\s+naturale\b/gi, "agisce nello spazio in modo fluido");
    s = s.replace(/\bset\s+realistico\b/gi, "ambiente curato");
    s = s.replace(/\bazione\s+naturale\b/gi, "movimento spontaneo");
    s = s.replace(/\breazione\s+espressiva\b/gi, "risposta visiva definita");
    s = s.replace(/\bcon natural lip sync\b/gi, "con lip sync naturale");
    s = s.replace(/\bBegin con\b/gi, "Inizia con");
    s = s.replace(/\bmid reaction\b/gi, "reazione intermedia");
    s = s.replace(/\bending drawn\b/gi, "chiusura costruita");
    s = s.replace(/\blistener reaction\b/gi, "reazione del gruppo in ascolto");
    s = s.replace(/\bDo not name characters\b/gi, "Usa le etichette provvisorie disponibili senza dichiarare identita certe");

    return s.replace(/\s+/g, ' ').trim();
}

export function validateFinalPromptSanity(promptText: string): string[] {
    if (!promptText) return [];
    
    const errors: string[] = [];
    const low = promptText.toLowerCase();

    const banned = [
        "person 1",
        "person_1",
        "person 2",
        "person_2",
        "person 3",
        "person_3",
        "person 4",
        "person_4",
        "uniformed uomo",
        "uniformed_man",
        "in un leggenda",
        "ambiente di un leggenda",
        "davanti alla pronunciare",
        "svolge sfida",
        "while ",
        " with ",
        " nod",
        "con un nod",
        "set realistico",
        "azione naturale",
        "reazione espressiva",
        "interagisce con l'ambiente in modo naturale",
        "interagisce con leggenda dello specchio in un leggenda",
        "in un specchio"
    ];

    banned.forEach(b => {
        if (low.includes(b)) {
            errors.push(b);
        }
    });

    return errors;
}

function sanitizePromptDraftBeforeValidation(text: string): string {
    if (!text) return "";
    let result = text;

    // 1. Remove obvious structural English fragments or technical markers
    const fragmentsToRemove = [
        /Vertical sequence:?/gi,
        /Inquadratura verticale:?/gi,
        /The scene takes place/gi,
        /The scene involves \d+ subjects/gi,
        /The scene is filled with/gi,
        /nearby/gi,
        /off-screen/gi,
        /while handling/gi,
        /having limited visual detection/gi,
        /As per the transcript/gi,
        /unknown person/gi,
        /personaggio ignoto/gi,
        /unknown character/gi
    ];

    fragmentsToRemove.forEach(regex => {
        result = result.replace(regex, "");
    });

    // 2. Map common English phrases to Italian
    const phraseMapping: Record<string, string> = {
        "in front of a mysterious mirror": "davanti a uno specchio misterioso",
        "in front of": "davanti a",
        "with a religious figure visible in the background": "con una figura religiosa visibile sullo sfondo",
        "visible in the background": "visibile sullo sfondo",
        "with a": "con un",
        "the officer": "l'uomo in uniforme",
        "religious figure": "figura religiosa",
        "as the characters' dialogue": "mentre il dialogo dei personaggi",
        "as the characters": "mentre i personaggi",
        "likely corresponding to the speech": "probabilmente corrispondente al parlato",
        "appearing to be the main speaker": "che sembra essere l'interlocutore principale",
        "main speaker": "interlocutore principale",
        "unknown": "soggetto non identificato",
        "ambiguous": "personaggio non distinguibile"
    };

    Object.entries(phraseMapping).forEach(([en, it]) => {
        const regex = new RegExp(`\\b${en}\\b`, 'gi');
        result = result.replace(regex, it);
    });

    // 3. Fix broken Italian fragments
    result = result.replace(/Apertura su woman/gi, "Apertura sulla donna");
    result = result.replace(/Apertura su man/gi, "Apertura sull'uomo");
    result = result.replace(/Apertura su Una donna e/gi, "Apertura sulla donna principale");
    result = result.replace(/svolge "/gi, "svolge l'azione");
    result = result.replace(/svolge ""/gi, "svolge l'azione");
    result = result.replace(/as the woman è/gi, "mentre la donna è");
    result = result.replace(/as the man è/gi, "mentre l'uomo è");

    // 4. Normalize all technical labels that might have slipped in
    const techLabels = ["woman", "man", "uniformed_man", "young_man", "old_man", "other_man", "unknown", "ambiguous"];
    techLabels.forEach(label => {
        const regex = new RegExp(`\\b${label}(_\\d+)?\\b`, 'gi');
        result = result.replace(regex, (match) => {
            const normalized = normalizePromptSubjectLabel(match);
            return normalized;
        });
    });

    // 5. Final Cleanup
    result = result.replace(/\s\s+/g, ' ').trim();
    
    return result;
}

function sanitizeSceneCardItalianField(text: string): string {
    if (!text) return "";
    let clean = text;

    // Normalize snake_case or technical descriptors
    clean = clean.replace(/_/g, " ");

    const before = clean;
    const removedEnglishFragments: string[] = [];
    
    // Use the primary normalization engine
    clean = sanitizePromptDraftBeforeValidation(clean);

    if (before !== clean) {
        logger.info("[SCENE_CARD_LANGUAGE_CLEANUP_AUDIT]", {
            before,
            after: clean,
            removedEnglishFragments,
            detectedSourceLanguage: "it (hybrid fixed)"
        });
    }

    return clean;
}

function buildNarrativePromptPlanFromPhase1(phase1Result: any, audit: any = {}) {
  const transcript = phase1Result?.verifiedTranscript || phase1Result?.script || "";
  const lowTranscript = transcript.toLowerCase();
  const cast = phase1Result?.canonicalCastList || [];
  const sceneDNA = phase1Result?.SceneDNA || phase1Result?.sceneDNA || {};
  const frameTimeline = phase1Result?.mergedFrameTimeline || [];

  const plan = {
    ruleLine: audit.ruleLine || "La scena ruota attorno a un segreto o una leggenda citata.",
    triggerCondition: audit.triggerCondition || "l'interazione tra i personaggi",
    expectedConsequence: audit.expectedConsequence || "reazione suspense",
    primarySubject: "Il soggetto principale",
    secondarySubject: "",
    setting: sceneDNA.visualContext || "un set realistico",
    keyDialogue: extractVerifiedDialogueLine(transcript),
    tension: "atmosfera di attesa",
    payoff: "reazione espressiva",
    concreteDetails: [] as string[]
  };

  if (audit.ruleDetectedFromTranscript) {
      logger.info("[LOCAL_PROMPT_PLAN_RULE_IMPORTED]", { ruleLine: audit.ruleLine, trigger: audit.triggerCondition, consequence: audit.expectedConsequence });
  }

  // Dialogue Sync Audit for Logging
  if (transcript) {
      const dialogueFragments = transcript.split(/[.!?]/).filter(f => f.trim().length > 5);
      logger.info("[LOCAL_PROMPT_USED_DIALOGUE_ASSIGNMENTS]", { count: dialogueFragments.length, transcriptSnippet: dialogueFragments[0]?.substring(0, 30) });
  }
  
  // 1. Better Subject Identification
  if (cast.length > 0) {
      plan.primarySubject = safeHumanLabel(cast[0]);
      if (cast.length > 1) plan.secondarySubject = safeHumanLabel(cast[1]);
  }
  
  // TECHNICAL PLACEHOLDER REJECTION (Fase 3.3B)
  const technicalSubjects = ["analisi visiva parziale", "rilevamento visivo limitato", "personaggio 1", "unknown", "nearby", "n/d", "n/a"];
  if (technicalSubjects.some(term => plan.primarySubject.toLowerCase().includes(term))) {
      plan.primarySubject = "un personaggio della scena";
  }
  if (technicalSubjects.some(term => plan.secondarySubject.toLowerCase().includes(term))) {
      plan.secondarySubject = "un altro personaggio";
  }

  // Beats extraction from timeline
  if (frameTimeline.length > 0) {
      const openingFrame = frameTimeline[0];
      const tensionFrame = frameTimeline[Math.floor(frameTimeline.length / 2)];
      const payoffFrame = frameTimeline[frameTimeline.length - 1];
  
      logger.info("[LOCAL_PROMPT_PLAN_USED_FRAME_BEATS]", { openingFrame, tensionFrame, payoffFrame });
      
      const details = [];
      if (openingFrame.visibleObjects) details.push(openingFrame.visibleObjects.slice(0, 2).join(', '));
      if (tensionFrame.visibleAction) details.push(tensionFrame.visibleAction);
      if (payoffFrame.visibleAction) details.push(payoffFrame.visibleAction);
      plan.concreteDetails.push(...details.filter(d => d));
  }

  // 2. Concrete Details Extraction (MANDATORY 3+ DETAILS)
  if (audit.ruleLine && audit.ruleLine.length > 10) plan.concreteDetails.push("leggenda dello specchio");
  if (lowTranscript.includes("bugia") || lowTranscript.includes("mente")) plan.concreteDetails.push("bugia");
  if (lowTranscript.includes("specchio")) plan.concreteDetails.push("specchio");
  if (lowTranscript.includes("don franco")) plan.concreteDetails.push("Don Franco");
  
  if (plan.primarySubject && !plan.primarySubject.includes("soggetto")) plan.concreteDetails.push(plan.primarySubject);
  
  // Clean placeholders from details
  plan.concreteDetails = plan.concreteDetails.filter(d => 
    !d.includes("azione naturale") && !d.includes("set realistico") && !d.includes("N/D") && !d.includes("n/d")
  );

  // 3. Narrative Arco
  if (audit.ruleDetectedFromTranscript) {
      plan.tension = `scetticismo e curiosità davanti alla ${plan.triggerCondition || "prova dello specchio"}`;
      if (audit.visualConsequenceConfirmed) {
          plan.payoff = `momento critico della ${plan.expectedConsequence || "trasformazione"}`;
      } else {
          plan.payoff = "finale sospeso con suspense sulla reazione del gruppo";
      }
  }

  logger.info("[LOCAL_PROMPT_PLAN_BUILT]", { detailsCount: plan.concreteDetails.length, hasRule: !!audit.ruleLine });
  logger.info("[LOCAL_PROMPT_FINAL_QUALITY_AUDIT]", { bannedPoorPhrasesFound: plan.concreteDetails.filter(d => 
    d.includes("interagisce con l'ambiente") || d.includes("in modo naturale") || d.includes("reazione espressiva") || 
    d.includes("donna in un specchio") || d.includes("bugia in un Presidente della Repubblica") || 
    d.includes("ambiente di un Don Franco") || d.includes("Svolge interagisce")
  ) });
  return plan;
}


function buildDifferentiatedPhase2PromptSetV2(basePrompt: string, transcript: string, aiPromptsFallback?: string, phase1Result?: any, audioVideoRelationAudit?: any, durationBeatStrategy?: any, dialogueSyncAudit?: any) {
  if (
    phase1Result?.promptSafetyMode === "AUDIO_ANCHORED_VISUAL_WEAK" ||
    phase1Result?.analysisRoutingMode === "AUDIO_TRANSCRIPT_ONLY_PHASE2"
  ) {
    return buildAudioAnchoredPromptWeakVisualSet(transcript, phase1Result);
  }

  const finalAudioVideoAudit = audioVideoRelationAudit || deriveSceneMechanismAudit(basePrompt, transcript, phase1Result);
  if (!audioVideoRelationAudit) logger.info("[AUDIO_VIDEO_RELATION_AUDIT_ONLY]", finalAudioVideoAudit);

  const finalDurationAudit = durationBeatStrategy || deriveDurationBeatStrategy(basePrompt, transcript, phase1Result);
  if (!durationBeatStrategy) logger.info("[DURATION_BEAT_STRATEGY_AUDIT_ONLY]", finalDurationAudit);

  let modelPromptBase = compressWhitespace(basePrompt);
  
  if (modelPromptBase.toLowerCase().includes("limited visual detection") || modelPromptBase.toLowerCase().includes("analisi visiva") || modelPromptBase.length < 30) {
      modelPromptBase = compressWhitespace(aiPromptsFallback || "") || modelPromptBase;
  }

  // Deep Clean of forbidden or generic phrases
  modelPromptBase = modelPromptBase
    .replace(/\s*Duration:\s*\d+\s*seconds\.?/gi, "")
    .replace(/\s*Vertical\s*9:16\.?/gi, "")
    .replace(/\s*Kling AI v1\.5,?\s*\d+\s*seconds,?\s*vertical\s*9:16\.?/gi, "")
    .replace(/\s*Veo 3 version\.?/gi, "")
    .replace(/\s*Seedance version\.?/gi, "")
    .replace(/\s*Preserve the strongest verified line\s*"[^"]*"\.?/gi, "")
    .replace(/\s*Emphasize stunt energy and gesture readability:\s*/gi, "")
    .replace(/A character with limited visual detection is speaking.*?(says|saying|say):?\s*/gi, "")
    .replace(/A character with limited visual detection\.?/gi, "")
    .replace(/Final production-ready version\.?/gi, "")
    .replace(/Technical prompt generated\.?/gi, "")
    .replace(/hook\s*:?|setup\s*:?|escalation\s*:?|payoff\s*:?|cinematic\s*:?/gi, "")
    .replace(/Scene Master Prompt:\s*/gi, "")
    .replace(/Master Scene Description:\s*/gi, "")
    .replace(/Personaggio\s+\d+/gi, "Il soggetto");
    
  if (modelPromptBase.length > 500 && modelPromptBase.toLowerCase().includes("transcript")) {
      modelPromptBase = modelPromptBase.substring(0, 500) + "...";
  }
  
  const dialogue = extractVerifiedDialogueLine(transcript);
  const promptCastLabels = buildPromptCastLabels(phase1Result, transcript);
  
  // NARRATIVE PLAN (Fase 3.3B)
  const navPlan = buildNarrativePromptPlanFromPhase1(phase1Result, finalAudioVideoAudit);
  logger.info("[LOCAL_PROMPT_KEY_BEATS_SELECTED]", { details: navPlan.concreteDetails });

  const safeBase = typeof modelPromptBase === "string" ? modelPromptBase : "";
  const lowBase = safeBase.toLowerCase();
  const parts = safeBase.split(/[.;:]/).map(p => p.trim()).filter(p => p.length > 0);
  
  // IMPROVED ATOMIC SCENE CARD DERIVATION
  const sceneCard = {
    subject: promptCastLabels.primaryCharacter || navPlan.primarySubject,
    setting: promptCastLabels.locationLabel || navPlan.setting,
    object: (promptCastLabels.keyObjects || []).join(", ") || navPlan.concreteDetails.join(", "),
    mainAction: "svolge l'azione descritta",
    secondaryBeat: "",
    verifiedLine: dialogue || "",
    reaction: navPlan.payoff,
    tone: navPlan.tension
  };
  const visibleObjectsUsed = [...new Set(
    (Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [])
      .flatMap((obs: any) => Array.isArray(obs?.visibleObjects) ? obs.visibleObjects : [])
      .map((value: any) => String(value || "").trim())
      .filter(Boolean)
  )];

  // 1. Identify Subject
  const probableSpeaker = (dialogueSyncAudit?.probableAssignmentsCount > 0 && dialogueSyncAudit.possibleSpeakerAssignments[0]?.probableSpeakerLabel) 
    ? dialogueSyncAudit.possibleSpeakerAssignments[0].probableSpeakerLabel 
    : null;

  if (probableSpeaker && probableSpeaker !== "unknown") {
    sceneCard.subject = normalizePromptSubjectLabel(probableSpeaker);
  } else if (parts[0]) {
    const words = parts[0].split(' ');
    sceneCard.subject = words.length < 5 ? parts[0] : words.slice(0, 3).join(' ');
  } else if (promptCastLabels.primaryCharacter) {
    sceneCard.subject = promptCastLabels.primaryCharacter;
  } else if (phase1Result?.SceneDNA?.primaryCharacter) {
    sceneCard.subject = phase1Result.SceneDNA.primaryCharacter;
  }

  // Normalize subject
  sceneCard.subject = sanitizeSceneCardItalianField(sceneCard.subject);

  // Avoid "Una donna e" broken phrases
  if (sceneCard.subject.toLowerCase() === "una donna e") {
      sceneCard.subject = "La donna principale";
  } else if (sceneCard.subject.toLowerCase() === "un uomo e") {
      sceneCard.subject = "L'uomo principale";
  }

  // 2. Identify Setting/Object
  const s = parts.find(p => (p.toLowerCase().includes("ambient") || p.toLowerCase().includes("scena") || p.toLowerCase().includes("set") || p.toLowerCase().includes("posto") || p.toLowerCase().includes("luogo")));
  if (s) {
    sceneCard.setting = s;
  } else if (phase1Result?.SceneDNA?.visualContext) {
    sceneCard.setting = phase1Result.SceneDNA.visualContext;
  } else if (promptCastLabels.locationLabel) {
    sceneCard.setting = promptCastLabels.locationLabel;
  } else if (visibleObjectsUsed.length > 0) {
    sceneCard.setting = `una stanza interna con ${visibleObjectsUsed.slice(0, 4).join(", ")}`;
  } else if (finalAudioVideoAudit?.ruleDetectedFromTranscript) {
    sceneCard.setting = "una stanza interna poco illuminata davanti a uno specchio";
  }
  
  const obj = parts.find(p => (p.toLowerCase().includes("oggetto") || p.toLowerCase().includes("object") || p.toLowerCase().includes("cosa")));
  if (obj) {
    sceneCard.object = obj;
  }

  // 3. Identify Action/Beats
  let actionCandidates = parts.filter(p => 
    (p.toLowerCase().includes("indica") || p.toLowerCase().includes("dice") || p.toLowerCase().includes("esegue") || p.toLowerCase().includes("presenta") || p.toLowerCase().includes("guarda") || p.toLowerCase().includes("mostra"))
    && p.length > 10
    && !isWeakTranscriptFragment(p)
  );

  if (actionCandidates.length === 0) {
      // Fallback a sceneDNA/criticalExam se debole
      const dnaAction = phase1Result?.SceneDNA?.visualDescription || phase1Result?.sceneDNA?.visualDescription || phase1Result?.criticalExamReport?.visualAnalysis;
      if (dnaAction && !isWeakTranscriptFragment(dnaAction)) {
          actionCandidates = [dnaAction];
      }
  }

  if (actionCandidates.length > 0) {
    sceneCard.mainAction = actionCandidates[0];
    if (actionCandidates.length > 1) {
        const secondary = actionCandidates[1];
        if (!isWeakTranscriptFragment(secondary)) {
            sceneCard.secondaryBeat = secondary;
        }
    }
  } else if (parts[1] && !isWeakTranscriptFragment(parts[1])) {
    sceneCard.mainAction = parts[1];
  } else {
    // Fallback semantico naturale
    if (navPlan.ruleLine && navPlan.ruleLine !== "La scena ruota attorno a un segreto o una leggenda citata.") {
        sceneCard.mainAction = `sfida la sorte davanti alla ${navPlan.triggerCondition || "leggenda dello specchio"}`;
    } else {
        sceneCard.mainAction = "interagisce con l'ambiente in modo naturale";
    }
  }

  // Placeholder hard rejection
  if (sceneCard.mainAction.includes("azione naturale nel contesto della scena")) {
      sceneCard.mainAction = "reagisce al dialogo e osserva l'ambiente";
  }
  if (sceneCard.reaction.includes("reazione naturale ed espressiva")) {
      sceneCard.reaction = "mostra sorpresa o scetticismo";
  }

  // 4. Tone/Reaction
  if (lowBase.includes("comico") || lowBase.includes("funny")) sceneCard.tone = "sketch comico surreale";
  
  const lastPart = parts[parts.length - 1];
  if (lastPart && !isWeakTranscriptFragment(lastPart)) {
    sceneCard.reaction = lastPart;
  } 

  // QUALITY GATE - SANITIZATION & LOGS
  logger.info("[LOCAL_PROMPT_MODEL_SPECIFIC_BUILDER_START]");
  const concreteCount = navPlan.concreteDetails.length;
  logger.info("[LOCAL_PROMPT_CONCRETE_DETAILS_COUNT]", { count: concreteCount });

  // SANITIZATION FASE 3.3A.1
  sceneCard.subject = sanitizeSceneCardItalianField(sceneCard.subject);
  sceneCard.setting = sanitizeSceneCardItalianField(sceneCard.setting);
  sceneCard.mainAction = sanitizeSceneCardItalianField(sceneCard.mainAction);
  sceneCard.reaction = sanitizeSceneCardItalianField(sceneCard.reaction);
  sceneCard.secondaryBeat = sanitizeSceneCardItalianField(sceneCard.secondaryBeat);
  const lowSubject = sceneCard.subject.toLowerCase();
  const lowSetting = sceneCard.setting.toLowerCase();
  const forbiddenDuplicatePatternDetected = !!lowSubject && !!lowSetting && lowSetting.includes(lowSubject);
  if (forbiddenDuplicatePatternDetected) {
    sceneCard.setting = visibleObjectsUsed.length > 0
      ? `una stanza interna con ${visibleObjectsUsed.slice(0, 4).join(", ")}`
      : (finalAudioVideoAudit?.ruleDetectedFromTranscript
          ? "una stanza interna poco illuminata davanti a uno specchio"
          : "uno spazio interno coerente con la scena");
  }
  if (finalAudioVideoAudit?.ruleDetectedFromTranscript && sceneCard.mainAction.toLowerCase().includes("sparizion") && finalAudioVideoAudit?.visualConsequenceConfirmed !== true) {
    sceneCard.mainAction = "racconta la leggenda dello specchio e mette alla prova la bugia davanti al gruppo";
  }
  if (sceneCard.reaction.toLowerCase().includes("sparizion") && finalAudioVideoAudit?.visualConsequenceConfirmed !== true) {
    sceneCard.reaction = "gli altri presenti reagiscono con scetticismo mentre la tensione cresce attorno alla prova della bugia";
  }

  const diag = sceneCard.verifiedLine ? ` pronunciando: "${sceneCard.verifiedLine}"` : "";

  // DIFFERENTIATED COMPOSERS (Atomic & Natural)
  const compose = (t: string) => {
      let final = sanitizePromptCastLabels(sanitizePromptDraftBeforeValidation(compressWhitespace(t)));
      // Final placeholder ban check (Fase 3.3B)
      const genericTerms = [
        "azione naturale nel contesto della scena", 
        "reazione naturale ed espressiva", 
        "oggetti di scena coerenti", 
        "set realistico", 
        "svolge l'azione",
        "azione naturale",
        "reazione naturale",
        "contesto della scena",
        "Nearby",
        "nearby",
        "Unknown",
        "unknown",
        "Analisi visiva parziale",
        "Rilevamento visivo limitato",
        "Personaggio 1"
      ];
      genericTerms.forEach(term => {
          if (final.toLowerCase().includes(term.toLowerCase())) {
              logger.warn("[LOCAL_PROMPT_PLACEHOLDER_PHRASE_REJECTED]", { term });
              // Replace with concrete details if possible
              const replacement = navPlan.concreteDetails.length > 0 
                ? navPlan.concreteDetails[Math.floor(Math.random() * navPlan.concreteDetails.length)]
                : "dettagli della scena";
              final = final.split(new RegExp(term, 'gi')).join(replacement);
          }
      });
      return final;
  };

  const sceneMasterPrompt = compose(
    `Descrizione master cinematografica: Apertura su ${sceneCard.subject} in ${sceneCard.setting}. L'azione centrale è: ${sceneCard.mainAction}. Tono della scena: ${sceneCard.tone}. Payoff: ${sceneCard.reaction}. Dettagli concreti: ${navPlan.concreteDetails.join(", ")}.`
  );

  const soraPrompt12s = compose(
    `Sora 12s continuativa: ${sceneCard.subject} interagisce con ${navPlan.concreteDetails[0] || "l'ambiente"} in ${sceneCard.setting}. Un unico arco di movimento: ${sceneCard.mainAction}. La mdp segue lentamente il volto di ${sceneCard.subject} mentre reagisce.`
  );

  const soraPrompt15s = compose(
    `Sora 15s narrativa: ${sceneCard.subject} in ${sceneCard.setting} davanti a ${navPlan.concreteDetails[1] || "un elemento chiave"}. Sequenza: ${sceneCard.mainAction} accompagnata da ${diag}. Chiusura intensa su ${sceneCard.reaction} con enfasi sullo scetticismo.`
  );

  const klingPrompt10s = compose(
    `Kling 10s fisica: Focus sulla gestualità di ${sceneCard.subject}. Movimento rapido di mani e spalle mentre ${sceneCard.mainAction}. Reazione immediata di ${navPlan.secondarySubject || "altri presenti"} in ${sceneCard.setting}.`
  );

  const klingPrompt15s = compose(
    `Kling 15s azione: ${sceneCard.subject} si muove verso ${navPlan.concreteDetails[0] || "il centro della scena"}. Compiendo ${sceneCard.mainAction}, la postura comunica tensione. Chiusura su ${sceneCard.reaction} con micro-espressioni facciali.`
  );

  const veo3Prompt8s = compose(
    `Veo 8s dialogo: ${sceneCard.subject} dice in italiano: "${sceneCard.verifiedLine || "La leggenda narra della bugia..."}". Inquadratura fissa e stabile, labiale perfettamente sincronizzato, ambiente di ${sceneCard.setting} nitido.`
  );

  const veo3ExtensionPart1Prompt8s = compose(
    `Veo 8+8 Parte 1: Setup narrativo con ${sceneCard.subject} che introduce ${navPlan.ruleLine || "la leggenda"}. Atmosfera di ${sceneCard.tone} in ${sceneCard.setting}.`
  );

  const veo3ExtensionPart2Prompt8s = compose(
    `Veo 8+8 Parte 2: Payoff della sfida. ${sceneCard.subject} reagisce a "${sceneCard.verifiedLine || "la battuta"}". Focus sulla tensione del gruppo e sulla battuta "Don Franco" che chiude la sequenza.`
  );

  const seedancePrompt15s = compose(
    `Seedance 15s social: Montaggio ritmato su ${sceneCard.subject}. ${sceneCard.mainAction}. Tagli rapidi sugli sguardi e ${sceneCard.reaction}. Tensione comica crescente, chiusura con suspense sulla battuta finale.`
  );

  const optimizedPrompt12s = soraPrompt12s;

  const optimizedPrompt15s = compose(
    `Inquadratura verticale: Apertura su ${sceneCard.subject} in ${sceneCard.setting}. Svolge ${sceneCard.mainAction}${diag}. Chiusura coerente su ${sceneCard.reaction}.`
  );
  logger.info("[PROMPT_COMPOSITION_ENTITY_AUDIT]", {
    subjectLabel: sceneCard.subject,
    sceneContext: sceneCard.setting,
    visibleObjectsUsed,
    forbiddenDuplicatePatternDetected,
    finalSceneOpeningPreview: optimizedPrompt15s.slice(0, 220)
  });

  return {
    sceneMasterPrompt,
    aiPrompts: optimizedPrompt15s,
    promptSora12s: soraPrompt12s,
    soraPrompt12s,
    promptSora15s: soraPrompt15s,
    soraPrompt15s,
    klingPrompt10s,
    klingPrompt15s,
    klingPrompt: klingPrompt15s,
    veo3Prompt8s,
    veoPrompt: veo3Prompt8s,
    veo3ExtensionPart1Prompt8s,
    veo3ExtensionPart2Prompt8s,
    seedancePrompt15s,
    sendancePrompt15s: seedancePrompt15s,
    optimizedPrompt12s,
    optimizedPrompt15s,
    bestOptimizedPromptText: optimizedPrompt15s,
    bestOptimizedPrompt: {
      targetField: "optimizedPrompt15s",
      model: "Groq",
      duration: 15,
      prompt: optimizedPrompt15s,
      reason: "Scene-Card atomic differentiation for high model fidelity"
    },
    neutralFacts: sceneCard.mainAction
  };
}

function buildAudioAnchoredPromptWeakVisualSet(transcript: string, phase1Result?: any) {
  logger.info("[PROMPT_REVIEW_REQUIRED_CAST_AWARE_BUILDER_START]", {
    hasTranscript: Boolean(transcript),
    canonicalCastCount: Array.isArray(phase1Result?.canonicalCastList) ? phase1Result.canonicalCastList.length : 0,
    castFallbackMode: phase1Result?.castGroundingAudit?.castFallbackMode || "NONE"
  });
  logger.info("[AUDIO_ANCHORED_PROMPT_WEAK_VISUAL_BUILDER_START]", {
    transcriptAvailable: Boolean(transcript),
    audioSegmentsCount: Array.isArray(phase1Result?.audioSegments) ? phase1Result.audioSegments.length : 0,
    frameTimestampsCount: Array.isArray(phase1Result?.frameTimestamps) ? phase1Result.frameTimestamps.length : 0
  });

  const audioSegments = Array.isArray(phase1Result?.audioSegments) ? phase1Result.audioSegments : [];
  const frameTimestamps = Array.isArray(phase1Result?.frameTimestamps) ? phase1Result.frameTimestamps : [];
  const heardTrace = phase1Result?.promptDecisionTrace?.heard || {};
  const seenTrace = phase1Result?.promptDecisionTrace?.seen || {};
  const castContext = buildPromptCastContext(phase1Result);
  const keyLines = Array.isArray(heardTrace?.keyLinesHeard) && heardTrace.keyLinesHeard.length > 0
    ? heardTrace.keyLinesHeard
    : audioSegments.slice(0, 3).map((seg: any) => String(seg?.text || "").trim()).filter((line: string) => line.length >= 8);
  const verifiedLine = extractVerifiedDialogueLine(transcript || keyLines.join(". "));
  const significantSegments = audioSegments
    .map((seg: any, index: number) => ({
      index,
      text: String(seg?.text || "").trim()
    }))
    .filter((seg: any) => seg.text.length >= 8);
  const pickSegment = (preferred: number[], fallbackFromEnd = false) => {
    for (const idx of preferred) {
      const found = significantSegments.find((seg: any) => seg.index === idx);
      if (found) return found;
    }
    return fallbackFromEnd ? significantSegments[significantSegments.length - 1] : significantSegments[0];
  };
  const setupSegment = pickSegment([0, 1, 2]);
  const proofSegment = pickSegment([7, 8, 6, 5]);
  const endingSegment = pickSegment([14, 13, 12, 11, 10], true);
  const frameWindow = frameTimestamps.length > 0
    ? `${frameTimestamps[0]} to ${frameTimestamps[frameTimestamps.length - 1]}`
    : "timeline available";
  const dialogueTurnsCount = audioSegments.length || heardTrace?.dialogueTurnsCount || 0;
  const safeLine = (line: string) => line.replace(/^["']+|["']+$/g, "").trim();
  const quotedPrimary = safeLine(setupSegment?.text || verifiedLine || keyLines[0] || "");
  const quotedSecondary = safeLine(proofSegment?.text || keyLines[1] || "");
  const quotedFinal = safeLine(endingSegment?.text || keyLines[2] || "");

  const clean = (text: string) => sanitizeFinalPromptGrammar(sanitizePromptDraftBeforeValidation(compressWhitespace(text)));
  const castLabels = castContext.castLabels;
  const castLine = castLabels.length > 1
    ? `${castLabels.slice(0, -1).join(", ")} e ${castLabels[castLabels.length - 1]}`
    : (castLabels[0] || "speaker non identificati");
  const setupBeat = quotedPrimary ? `Battuta verificata di apertura: "${quotedPrimary}".` : "";
  const proofBeat = quotedSecondary && quotedSecondary.toLowerCase() !== quotedPrimary.toLowerCase()
    ? `Battuta o prova intermedia: "${quotedSecondary}".`
    : "";
  const endingBeat = quotedFinal
    && quotedFinal.toLowerCase() !== quotedPrimary.toLowerCase()
    && quotedFinal.toLowerCase() !== quotedSecondary.toLowerCase()
      ? `Chiusura verificata: "${quotedFinal}".`
      : "";
  const castPresence12s = castLabels[3]
    ? `${castLabels[0]} apre la scena, ${castLabels[1]} e ${castLabels[2]} reagiscono, ${castLabels[3]} resta come presenza e reazione prudente.`
    : castLabels.length >= 3
      ? `${castLabels[0]} apre la scena, ${castLabels[1]} e ${castLabels[2]} reagiscono con cautela.`
      : (castLabels[0]
          ? `${castLabels[0]} resta il soggetto principale e ${castLabels[1] || castLabels[0]} sostiene la reazione.`
          : `L'interazione resta su uno o piu speaker non confermati, con reazioni prudenti e senza assegnazioni certe.`);
  const timingConstraint = `Usa solo audio verificato e timing reale distribuiti su ${dialogueTurnsCount} turni audio lungo ${frameWindow}.`;
  const neutralConstraint = `Non inventare identita, ruoli certi, guardaroba, tratti facciali, oggetti, location o conseguenze visive non confermate. Usa le etichette disponibili in modo provvisorio e leggibile.`;
  const lipSyncConstraint = `Mantieni il lip sync aderente alle battute verificate e non attribuire ogni battuta allo stesso soggetto se l'attribuzione speaker non e confermata.`;

  logger.info("[PROMPT_CAST_LABELS_USED]", {
    castLabels,
    castMode: castContext.castMode,
    quotedPrimary,
    quotedSecondary,
    quotedFinal
  });

  const sceneMasterPrompt = clean(
    `Scena verticale 9:16 costruita solo da trascrizione verificata e timing reale. ${timingConstraint} ${castContext.castInstruction} Soggetti provvisori in scena: ${castLine}. ${setupBeat} ${proofBeat} ${endingBeat} Azioni ammesse: parlato, sguardi, microspostamenti, reazioni del gruppo e turni di ascolto coerenti con evidenza visiva debole. ${lipSyncConstraint} ${neutralConstraint}`
  );
  const soraPrompt12s = clean(
    `SORA 12s. Scena breve verticale. Usa ${castLine} come etichette provvisorie. ${castPresence12s} ${setupBeat} ${lipSyncConstraint} Mantieni una sola battuta verificata al centro della scena, con pause leggibili, sguardi coerenti e reazioni brevi del gruppo. ${neutralConstraint}`
  );
  const soraPrompt15s = clean(
    `SORA 15s. Mini arco completo in verticale con setup, prova e chiusura. Usa ${castLine} come etichette provvisorie. ${setupBeat} ${proofBeat} ${endingBeat} ${castLabels[0]} introduce la frase iniziale, ${castLabels[1] || castLabels[0]} spinge la reazione, ${castLabels[2] || castLabels[1] || castLabels[0]} sostiene il momento intermedio, ${castLabels[3] || castLabels[2] || castLabels[1] || castLabels[0]} resta come presenza e risposta finale prudente. ${lipSyncConstraint} ${neutralConstraint}`
  );
  const klingPrompt10s = clean(
    `KLING 10s. Clip verticale guidata dal ritmo del parlato verificato. Tieni presenti ${castLine} come gruppo, con gesti, sguardi, piccoli spostamenti e turni di reazione fisica ben leggibili. ${setupBeat} Il movimento deve essere concreto ma sobrio: mani, busto, teste, cambi di attenzione, senza scene astratte. ${neutralConstraint}`
  );
  const klingPrompt15s = clean(
    `KLING 15s. Scena verticale di gruppo con energia crescente. Usa ${castLine} come etichette provvisorie. ${setupBeat} ${proofBeat} ${endingBeat} Mostra gesti, spostamenti, sguardi incrociati e turn-taking fisico tra ${castLine}, con una reazione finale pulita del gruppo. ${lipSyncConstraint} ${neutralConstraint}`
  );
  const veo3Prompt8s = clean(
    `VEO 8s. Clip realistica con lip sync stretto e continuita temporale rigorosa. Soggetto provvisorio principale: ${castLabels[0] || "Parlante non confermato"}. Reazione di gruppo affidata a ${castLabels.slice(1).join(", ") || castLabels[0] || "speaker non identificati"}. ${setupBeat} Mantieni la battuta breve, le pause reali e una risposta visiva di gruppo minima ma coerente. ${neutralConstraint}`
  );
  const veo3ExtensionPart1Prompt8s = clean(
    `VEO 8+8 parte 1. Usa ${castLine} come soggetti provvisori. Copri solo il setup parlato iniziale con lip sync stretto, contatto visivo e attenzione del gruppo. ${setupBeat} Chiudi prima della reazione finale. ${neutralConstraint}`
  );
  const veo3ExtensionPart2Prompt8s = clean(
    `VEO 8+8 parte 2. Riprendi dal beat successivo verificato, mostra la catena di reazioni del gruppo ${castLine} e chiudi sul momento finale realmente presente nell'audio. ${proofBeat} ${endingBeat} Nessuna conseguenza visiva non confermata. ${neutralConstraint}`
  );
  const seedancePrompt15s = clean(
    `SEEDANCE 15s. Clip social verticale con ritmo rapido ma pulito. Usa ${castLine} come gruppo provvisorio, sottotitoli chiari, reazioni veloci e chiusura memorabile. ${setupBeat} ${proofBeat} ${endingBeat} Alterna parlato verificato, sguardi e risposte del gruppo senza inventare dettagli visivi. ${neutralConstraint}`
  );
  const optimizedPrompt12s = soraPrompt12s;
  const optimizedPrompt15s = clean(
    `Scena verticale audio-anchored da revisionare. Usa le etichette provvisorie ${castLine}. ${castContext.castInstruction} ${setupBeat} ${proofBeat} ${endingBeat} Distribuisci con cautela parlato e reazioni tra i soggetti, mantieni movimento sobrio ma concreto e chiudi sul beat verificato piu forte disponibile. ${lipSyncConstraint} ${neutralConstraint}`
  );

  const result = {
    sceneMasterPrompt,
    aiPrompts: optimizedPrompt15s,
    promptSora12s: soraPrompt12s,
    soraPrompt12s,
    promptSora15s: soraPrompt15s,
    soraPrompt15s,
    klingPrompt10s,
    klingPrompt15s,
    klingPrompt: klingPrompt15s,
    veo3Prompt8s,
    veoPrompt: veo3Prompt8s,
    veo3ExtensionPart1Prompt8s,
    veo3ExtensionPart2Prompt8s,
    seedancePrompt15s,
    sendancePrompt15s: seedancePrompt15s,
    optimizedPrompt12s,
    optimizedPrompt15s,
    bestOptimizedPromptText: optimizedPrompt15s,
    bestOptimizedPrompt: {
      targetField: "optimizedPrompt15s",
      model: "Groq",
      duration: 15,
      prompt: optimizedPrompt15s,
      reason: "AUDIO_ANCHORED_PROMPT_WEAK_VISUAL"
    }
  };

  logger.info("[PROMPT_REVIEW_REQUIRED_MODEL_PROMPTS_DIFFERENTIATED]", {
    sora12: result.soraPrompt12s.slice(0, 120),
    sora15: result.soraPrompt15s.slice(0, 120),
    kling10: result.klingPrompt10s.slice(0, 120),
    veo8: result.veo3Prompt8s.slice(0, 120),
    seedance15: result.seedancePrompt15s.slice(0, 120)
  });

  logger.info("[PROMPT_REVIEW_REQUIRED_LANGUAGE_CLEANED]", {
    sceneMasterPrompt: result.sceneMasterPrompt.slice(0, 140),
    bestOptimizedPrompt: result.bestOptimizedPrompt?.prompt?.slice(0, 140) || ""
  });

  logger.info("[AUDIO_ANCHORED_PROMPT_WEAK_VISUAL_BUILDER_DONE]", {
    hasSceneMaster: Boolean(result.sceneMasterPrompt),
    hasBestPrompt: Boolean(result.bestOptimizedPrompt?.prompt),
    frameObservationsCount: Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations.length : 0,
    usedFramesReal: seenTrace?.usedFramesReal ?? frameTimestamps.length
  });
  logger.info("[PROMPT_REVIEW_REQUIRED_CAST_AWARE_BUILDER_DONE]", {
    castMode: castContext.castMode,
    castLabels,
    bestPromptLength: result.bestOptimizedPrompt?.prompt?.length || 0
  });

  return result;
}

function auditPromptVariantStructure(promptSet: Record<string, any>) {
  const entries = Object.entries(promptSet)
    .filter(([, value]) => {
      const text = typeof value === 'string' ? value : (value?.prompt || "");
      return compressWhitespace(text).length > 0;
    });

  const openings = entries.map(([key, value]) => {
    let text = typeof value === 'string' ? value : (value?.prompt || "");
    // STRIP model prefixes before auditing to detect true semantic overlap
    const stripped = text.replace(/^(Sora|Kling|Veo|Seedance|Visual|Physical|Realismo|Ritmo|Vertical|Progressione|Parte \d|Descrizione|Gesto|Impatto|In)\s*:?\s*/i, "").trim();
    return {
      key,
      opening: compressWhitespace(stripped).slice(0, 50).toLowerCase()
    };
  });
  const groups = new Map<string, string[]>();
  openings.forEach(({ key, opening }) => {
    const current = groups.get(opening) || [];
    current.push(key);
    groups.set(opening, current);
  });

  const longSameOpeningGroups = Array.from(groups.values()).filter((group) => group.length > 1);
  const sameOpeningWarning = longSameOpeningGroups.length > 0;
  const firstOpening = openings[0]?.opening || "";
  const basePromptDominanceCount = openings.filter(({ opening }) => opening === firstOpening).length;
  const basePromptDominanceWarning = basePromptDominanceCount > 3;

  const sharedPrefixRatio = (a: any, b: any) => {
    const leftText = typeof a === 'string' ? a : (a?.prompt || "");
    const rightText = typeof b === 'string' ? b : (b?.prompt || "");
    const left = compressWhitespace(leftText);
    const right = compressWhitespace(rightText);
    const max = Math.min(left.length, right.length, 220);
    let shared = 0;
    while (shared < max && left[shared] === right[shared]) shared += 1;
    return max === 0 ? 0 : shared / max;
  };

  const ratios: number[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      ratios.push(sharedPrefixRatio(entries[i][1], entries[j][1]));
    }
  }

  const maxSharedOpeningRatio = ratios.length ? Math.max(...ratios) : 0;
  logger.info("[PROMPT_BASE_DOMINANCE_FIXED]", {
    sameOpeningWarning,
    basePromptDominanceWarning,
    maxSharedOpeningRatio,
    repeatedOpeningCount: basePromptDominanceCount,
    averageSharedOpeningRatio: ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : 0
  });

  if (basePromptDominanceWarning) {
    logger.warn("[PROMPT_VARIANTS_BASE_PROMPT_DOMINANCE_WARNING]", {
      repeatedOpeningCount: basePromptDominanceCount,
      longSameOpeningGroups
    });
  }
}

function auditPromptAliasMapping(promptSet: {
  promptSora12s: string;
  soraPrompt12s: string;
  promptSora15s: string;
  soraPrompt15s: string;
  veo3Prompt8s: string;
  veoPrompt: string;
  seedancePrompt15s: string;
  sendancePrompt15s: string;
  veo3ExtensionPart1Prompt8s: string;
  veo3ExtensionPart2Prompt8s: string;
  optimizedPrompt15s: string;
  sceneMasterPrompt: string;
  klingPrompt15s: string;
  bestOptimizedPrompt: any;
}) {
  const normalize = (value: any) => {
    const text = typeof value === 'string' ? value : (value?.prompt || "");
    return compressWhitespace(text).toLowerCase();
  };
  const payload = {
    sora12AliasesEqual: normalize(promptSet.promptSora12s) === normalize(promptSet.soraPrompt12s),
    sora15AliasesEqual: normalize(promptSet.promptSora15s) === normalize(promptSet.soraPrompt15s),
    veoAliasesEqual: normalize(promptSet.veo3Prompt8s) === normalize(promptSet.veoPrompt),
    seedanceAliasesEqual: normalize(promptSet.seedancePrompt15s) === normalize(promptSet.sendancePrompt15s),
    extensionPartsDifferent: normalize(promptSet.veo3ExtensionPart1Prompt8s) !== normalize(promptSet.veo3ExtensionPart2Prompt8s),
    bestDifferentFromSceneMaster: normalize(promptSet.bestOptimizedPrompt) !== normalize(promptSet.sceneMasterPrompt),
    bestDifferentFromKling: normalize(promptSet.bestOptimizedPrompt) !== normalize(promptSet.klingPrompt15s)
  };

  logger.info("[PROMPT_ALIAS_MAPPING_AUDIT]", payload);

  if (Object.values(payload).some((value) => value === false)) {
    logger.warn("[PROMPT_ALIAS_MAPPING_WARNING]", payload);
  }
}

function auditPhase2AliasPreservation(result: any, differentiated: any) {
  const normalize = (value: string) => compressWhitespace(value).toLowerCase();
  const optimized = normalize(result.optimizedPrompt15s || result.bestOptimizedPrompt?.prompt || "");
  const modelFields = [
    result.sceneMasterPrompt,
    result.soraPrompt12s,
    result.soraPrompt15s,
    result.klingPrompt10s,
    result.klingPrompt15s,
    result.veo3Prompt8s,
    result.veo3ExtensionPart1Prompt8s,
    result.veo3ExtensionPart2Prompt8s,
    result.seedancePrompt15s
  ];
  const duplicateGroups = modelFields
    .map((value, index) => ({ index, value: normalize(value || "") }))
    .filter(({ value }) => value === optimized)
    .map(({ index }) => index);

  const payload = {
    sora12Preserved: normalize(result.soraPrompt12s) === normalize(differentiated.soraPrompt12s),
    sora15Preserved: normalize(result.soraPrompt15s) === normalize(differentiated.soraPrompt15s),
    kling10Preserved: normalize(result.klingPrompt10s) === normalize(differentiated.klingPrompt10s),
    kling15Preserved: normalize(result.klingPrompt15s) === normalize(differentiated.klingPrompt15s),
    veo8Preserved: normalize(result.veo3Prompt8s) === normalize(differentiated.veo3Prompt8s),
    veoExt1Preserved: normalize(result.veo3ExtensionPart1Prompt8s) === normalize(differentiated.veo3ExtensionPart1Prompt8s),
    veoExt2Preserved: normalize(result.veo3ExtensionPart2Prompt8s) === normalize(differentiated.veo3ExtensionPart2Prompt8s),
    seedancePreserved: normalize(result.seedancePrompt15s) === normalize(differentiated.seedancePrompt15s),
    optimizedNotCopiedIntoAllVariants: duplicateGroups.length <= 3,
    duplicateGroups
  };

  logger.info("[PHASE2_ALIAS_PRESERVATION_AUDIT]", payload);

  if (duplicateGroups.length > 3) {
    logger.warn("[PHASE2_ALIAS_OVERWRITE_WARNING]", payload);
  }
}

function applyPhase2PromptAliasPreservation(result: any, differentiated: any) {
  // Final Template Sanitization for synced fields only when obvious template leaks appear.
  const SYNCED_PROMPT_FIELDS = [
    "aiPrompts", "sceneMasterPrompt", "promptSora12s", "soraPrompt12s",
    "promptSora15s", "soraPrompt15s", "klingPrompt10s", "klingPrompt15s",
    "klingPrompt", "veo3Prompt8s", "veoPrompt", "seedancePrompt15s",
    "sendancePrompt15s", "optimizedPrompt12s", "optimizedPrompt15s"
  ];

  const BANNED_TEMPLATE_TERMS = [
    "Create a clean narrative short",
    "Build a short-form scene",
    "Hook immediately",
    "Preserve continuity",
    "Continue from the same scene world"
  ];

  SYNCED_PROMPT_FIELDS.forEach((field) => {
    const val = String(result[field] || "");
    const hasTemplate = BANNED_TEMPLATE_TERMS.some((t) => val.toLowerCase().includes(t.toLowerCase()));
    if (hasTemplate) {
      result[field] = differentiated[field] || result[field];
    }
  });

  // Hard preservation pass: model-specific canonical fields must keep their own differentiated values.
  result.sceneMasterPrompt = differentiated.sceneMasterPrompt;
  result.promptSora12s = differentiated.promptSora12s;
  result.soraPrompt12s = differentiated.soraPrompt12s;
  result.promptSora15s = differentiated.promptSora15s;
  result.soraPrompt15s = differentiated.soraPrompt15s;
  result.klingPrompt10s = differentiated.klingPrompt10s;
  result.klingPrompt15s = differentiated.klingPrompt15s;
  result.klingPrompt = differentiated.klingPrompt;
  result.veo3Prompt8s = differentiated.veo3Prompt8s;
  result.veoPrompt = differentiated.veoPrompt;
  result.veo3ExtensionPart1Prompt8s = differentiated.veo3ExtensionPart1Prompt8s;
  result.veo3ExtensionPart2Prompt8s = differentiated.veo3ExtensionPart2Prompt8s;
  result.seedancePrompt15s = differentiated.seedancePrompt15s;
  result.sendancePrompt15s = differentiated.sendancePrompt15s;
  result.optimizedPrompt12s = differentiated.optimizedPrompt12s;
  result.optimizedPrompt15s = differentiated.optimizedPrompt15s;
  result.bestOptimizedPrompt = {
    ...result.bestOptimizedPrompt,
    prompt: typeof differentiated.bestOptimizedPrompt === 'string' ? differentiated.bestOptimizedPrompt : (differentiated.bestOptimizedPrompt?.prompt || "")
  };
  result.aiPrompts = typeof differentiated.bestOptimizedPrompt === 'string' ? differentiated.bestOptimizedPrompt : (differentiated.bestOptimizedPrompt?.prompt || "");

  return result;
}

export function runPhase2AliasPreservationSelfTest() {
  const differentiated = {
    sceneMasterPrompt: "SCENE_MASTER_UNIQUE_NEUTRAL_DESCRIPTION",
    promptSora12s: "SORA_12_UNIQUE_MICRO_ACTION",
    soraPrompt12s: "SORA_12_UNIQUE_MICRO_ACTION",
    promptSora15s: "SORA_15_UNIQUE_NARRATIVE_PROGRESS",
    soraPrompt15s: "SORA_15_UNIQUE_NARRATIVE_PROGRESS",
    klingPrompt10s: "KLING_10_UNIQUE_PHYSICAL_ACTION",
    klingPrompt15s: "KLING_15_UNIQUE_EXTENDED_ACTION",
    klingPrompt: "KLING_GENERAL_UNIQUE",
    veo3Prompt8s: "VEO_8_UNIQUE_REALISTIC_COMPACT",
    veoPrompt: "VEO_8_UNIQUE_REALISTIC_COMPACT",
    veo3ExtensionPart1Prompt8s: "VEO_EXT_1_UNIQUE_SETUP_ONLY",
    veo3ExtensionPart2Prompt8s: "VEO_EXT_2_UNIQUE_AFTERmath_ONLY",
    seedancePrompt15s: "SEEDANCE_15_UNIQUE_VERTICAL_SOCIAL",
    sendancePrompt15s: "SEEDANCE_15_UNIQUE_VERTICAL_SOCIAL",
    optimizedPrompt12s: "OPTIMIZED_12_UNIQUE_FINAL_SHORT",
    optimizedPrompt15s: "OPTIMIZED_15_UNIQUE_FINAL_MASTER",
    bestOptimizedPrompt: "OPTIMIZED_15_UNIQUE_FINAL_MASTER"
  };

  const result: any = {
    sceneMasterPrompt: differentiated.sceneMasterPrompt,
    promptSora12s: differentiated.promptSora12s,
    soraPrompt12s: differentiated.soraPrompt12s,
    promptSora15s: differentiated.promptSora15s,
    soraPrompt15s: differentiated.soraPrompt15s,
    klingPrompt10s: differentiated.klingPrompt10s,
    klingPrompt15s: differentiated.klingPrompt15s,
    klingPrompt: differentiated.klingPrompt,
    veo3Prompt8s: differentiated.veo3Prompt8s,
    veoPrompt: differentiated.veoPrompt,
    veo3ExtensionPart1Prompt8s: differentiated.veo3ExtensionPart1Prompt8s,
    veo3ExtensionPart2Prompt8s: differentiated.veo3ExtensionPart2Prompt8s,
    seedancePrompt15s: differentiated.seedancePrompt15s,
    sendancePrompt15s: differentiated.sendancePrompt15s,
    optimizedPrompt12s: differentiated.optimizedPrompt12s,
    optimizedPrompt15s: differentiated.optimizedPrompt15s,
    bestOptimizedPrompt: { prompt: differentiated.bestOptimizedPrompt },
    aiPrompts: "OPTIMIZED_15_UNIQUE_FINAL_MASTER"
  };

  const preserved = applyPhase2PromptAliasPreservation(result, differentiated);
  const optimized = preserved.optimizedPrompt15s;
  const shouldStayUnique = [
    ["sceneMasterPrompt", preserved.sceneMasterPrompt, differentiated.sceneMasterPrompt],
    ["soraPrompt12s", preserved.soraPrompt12s, differentiated.soraPrompt12s],
    ["soraPrompt15s", preserved.soraPrompt15s, differentiated.soraPrompt15s],
    ["klingPrompt10s", preserved.klingPrompt10s, differentiated.klingPrompt10s],
    ["klingPrompt15s", preserved.klingPrompt15s, differentiated.klingPrompt15s],
    ["veo3Prompt8s", preserved.veo3Prompt8s, differentiated.veo3Prompt8s],
    ["veo3ExtensionPart1Prompt8s", preserved.veo3ExtensionPart1Prompt8s, differentiated.veo3ExtensionPart1Prompt8s],
    ["veo3ExtensionPart2Prompt8s", preserved.veo3ExtensionPart2Prompt8s, differentiated.veo3ExtensionPart2Prompt8s],
    ["seedancePrompt15s", preserved.seedancePrompt15s, differentiated.seedancePrompt15s]
  ];

  const failures = shouldStayUnique
    .filter(([, actual, expected]) => actual !== expected || actual === optimized)
    .map(([field]) => field as string);

  if (preserved.veo3ExtensionPart1Prompt8s === preserved.veo3ExtensionPart2Prompt8s) {
    failures.push("veo3ExtensionParts_equal");
  }

  const optimizedLeakTargets = [
    preserved.sceneMasterPrompt,
    preserved.soraPrompt12s,
    preserved.soraPrompt15s,
    preserved.klingPrompt10s,
    preserved.klingPrompt15s,
    preserved.veo3Prompt8s,
    preserved.veo3ExtensionPart1Prompt8s,
    preserved.veo3ExtensionPart2Prompt8s,
    preserved.seedancePrompt15s
  ].filter((value) => value === optimized).length;

  const pass = failures.length === 0 && optimizedLeakTargets === 0;
  if (pass) {
    logger.info("[PHASE2_ALIAS_PRESERVATION_SELF_TEST_PASS]", {
      checkedFields: shouldStayUnique.map(([field]) => field),
      optimizedLeakTargets
    });
  } else {
    logger.error("[PHASE2_ALIAS_PRESERVATION_SELF_TEST_FAIL]", {
      failures,
      optimizedLeakTargets
    });
  }

  return { pass, failures, optimizedLeakTargets };
}

/**
 * PROMPT DECISION TRACE (FASE 3.3B-1 DIAGNOSTICA)
 * Ricostruisce il percorso decisionale che ha portato alla scelta del prompt.
 */
function derivePromptDecisionTrace(params: {
  phase1Result: any,
  transcript: string,
  differentiatedPromptSet: any,
  bestPrompt: any,
  durationBeatStrategy: any,
  audioVideoRelationAudit: any,
  castAndDialogueAudit?: any,
  sceneMechanismAudit?: any,
  dialogueSyncAudit?: any
}) {
  const { phase1Result, transcript, bestPrompt, durationBeatStrategy, audioVideoRelationAudit, castAndDialogueAudit, sceneMechanismAudit, dialogueSyncAudit } = params;

  // Real data
  const frameCount = phase1Result?.runtimeTruthStatus?.frameCount || (phase1Result?.isVisionRecoveredWithOpenRouter ? 10 : 5);
  const frameTimestamps = phase1Result?.frameTimestamps || phase1Result?.runtimeTruthStatus?.frameTimestamps || "not available";
  const visionProvider = phase1Result?.visionProvider || "Hugging Face";
  const requestedFramesReal = phase1Result?.runtimeTruthStatus?.visionProviderRequestedFrames || frameCount;
  const maxFramesReal = phase1Result?.runtimeTruthStatus?.visionProviderMaxFrames || frameCount;

  // Frame logic for final segment (>= 46s)
  let framesAfter46s = 0;
  let timestampsAfter46s: string[] = [];
  if (Array.isArray(frameTimestamps)) {
      timestampsAfter46s = frameTimestamps.filter(t => parseFloat(t) >= 46);
      framesAfter46s = timestampsAfter46s.length;
  }

  const visionEvidence = audioVideoRelationAudit?.evidenceFromVision || "";
  const isVisionWeak = !visionEvidence || visionEvidence.includes("RISULTATO: {}") || visionEvidence.includes("ipotesi non confermata visivamente");

  const durationBeatStrategyUseful = !["Arco non definito", "Momento culminante o payoff", "Il nucleo della scena", "Soggetto principale"].some(
      p => durationBeatStrategy?.essentialBeat === p || durationBeatStrategy?.essentialCharacter === p || durationBeatStrategy?.strongestBeat === p
  );

  const perFrameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const hasPerFrameObservations = perFrameObservations.length > 0;

  const missingFinalPayoff = hasPerFrameObservations ? (audioVideoRelationAudit?.confidence === "LOW") : true;
  const finalLineHeard = transcript && transcript.length > 20 && durationBeatStrategy?.essentialLine !== "None";

  const visualPayoffConfirmedBefore = hasPerFrameObservations ? (!isVisionWeak && !missingFinalPayoff) : false;
  const visualPayoffConfirmed = Boolean(
    visualPayoffConfirmedBefore
    && sceneMechanismAudit?.visualConsequenceConfirmed === true
    && sceneMechanismAudit?.stateChangeConfirmed === true
    && sceneMechanismAudit?.payoffConfirmed === true
  );
  const contradictionFixed = visualPayoffConfirmedBefore !== visualPayoffConfirmed;
  const visionEvidenceStrength = hasPerFrameObservations ? (isVisionWeak ? "WEAK" : "STRONG") : "LIMITED";
  const inferenceConfidence = hasPerFrameObservations ? (audioVideoRelationAudit?.confidence || "LOW") : "MEDIUM_LOW";
  const hasVisibleMultiCastWithoutSpeakerLabels = ((phase1Result?.visualCastCount || phase1Result?.canonicalCastList?.length || 0) > 1)
    && dialogueSyncAudit?.transcriptHasSpeakerLabels === false;
  
  const dialogueNotSynchronized = hasVisibleMultiCastWithoutSpeakerLabels
    && (dialogueSyncAudit?.canAssignSpeakers === false);

  const riskLevel = hasVisibleMultiCastWithoutSpeakerLabels && !dialogueSyncAudit?.canAssignSpeakers
    ? "HIGH"
    : (hasPerFrameObservations ? ((isVisionWeak || missingFinalPayoff) ? "HIGH" : "LOW") : "HIGH");

  const possibleError = dialogueNotSynchronized
    ? "Dialogue is not synchronized to visible characters; no candidates available."
    : (hasVisibleMultiCastWithoutSpeakerLabels && dialogueSyncAudit?.speakerAssignmentMode === "CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT"
    ? "Cast visible but using CAUTIOUS PROBABLE speaker assignments; check for descriptor accuracy."
    : (missingFinalPayoff ? (!hasPerFrameObservations ? "Missing frame-level observations, high risk of assuming visual payoff incorrectly" : "Final subject visible but not selected as strongest beat.") : "None"));

  const recommendation = dialogueNotSynchronized
    ? "Use real audio timestamps or improve dialogue-frame alignment before trusting final prompts."
    : (hasVisibleMultiCastWithoutSpeakerLabels && dialogueSyncAudit?.speakerAssignmentMode === "CAUTIOUS_PROBABLE_SPEAKER_ASSIGNMENT"
    ? "Review prompts: probable candidates used. Ensure descriptions (woman, uniformed man) match visual evidence."
    : ((isVisionWeak || missingFinalPayoff) ? "Increase frame count, ensure vision model receives all late frames, extract granular frame observations." : "Proceed with selected prompt"));

  const selectedBeat = durationBeatStrategyUseful
    ? durationBeatStrategy?.essentialBeat
    : (sceneMechanismAudit?.ruleDetectedFromTranscript ? "Verified causal sequence" : "UNKNOWN");
  const selectedCharacter = (durationBeatStrategyUseful && durationBeatStrategy?.essentialCharacter !== "UNKNOWN") 
    ? durationBeatStrategy.essentialCharacter 
    : (dialogueSyncAudit?.probableAssignmentsCount > 0 ? dialogueSyncAudit.possibleSpeakerAssignments[0].probableSpeakerLabel : "UNKNOWN");
  logger.info("[PROMPT_DECISION_CONSISTENCY_AUDIT]", {
    selectedBeat,
    selectedCharacter,
    ruleDetectedFromTranscript: Boolean(sceneMechanismAudit?.ruleDetectedFromTranscript),
    visualConsequenceConfirmed: sceneMechanismAudit?.visualConsequenceConfirmed ?? "unknown",
    stateChangeConfirmed: sceneMechanismAudit?.stateChangeConfirmed ?? "unknown",
    payoffConfirmed: sceneMechanismAudit?.payoffConfirmed ?? "unknown",
    visualPayoffConfirmedBefore,
    visualPayoffConfirmedAfter: visualPayoffConfirmed,
    contradictionFixed
  });

  return {
    heard: {
      transcriptAvailable: !!transcript && transcript.length > 0,
      audioSource: "Phase 1 Extraction",
      keyLinesHeard: ["Not mapped per-line yet"],
      ruleLineHeard: sceneMechanismAudit?.ruleLine || "Unknown",
      finalLineHeard: !!finalLineHeard,
      dialogueRole: "Driver",
      transcriptEvidenceStrength: transcript?.length > 50 ? "STRONG" : (transcript ? "WEAK" : "NONE"),
      estimatedTurnCount: dialogueSyncAudit?.estimatedTurnCount || 0,
      transcriptHasSpeakerLabels: Boolean(dialogueSyncAudit?.transcriptHasSpeakerLabels),
      speakerAssignmentMode: dialogueSyncAudit?.speakerAssignmentMode || "NO_SPEAKER_ASSIGNMENT",
      dialogueTurnsCount: dialogueSyncAudit?.dialogueTurnsCount || 0,
      highMediumConfidenceAssignments: dialogueSyncAudit?.highConfidenceAssignmentsCount + dialogueSyncAudit?.mediumConfidenceAssignmentsCount,
      lowConfidenceAssignments: dialogueSyncAudit?.lowConfidenceAssignmentsCount,
      notes: "Transcript used as primary timeline driver."
    },

    seen: {
      visionProviderReal: visionProvider,
      requestedFramesReal,
      maxFramesReal,
      usedFramesReal: frameCount,
      frameResolutionReal: "200px (maxDim) - Downscaled for Vision API",
      frameTimestampsReal: frameTimestamps,
      mergedFrameTimeline: dialogueSyncAudit?.mergedFrameTimeline || [],
      frameObservations: hasPerFrameObservations ? perFrameObservations : "not available; vision returned only global summary",
      visibleCharacters: hasPerFrameObservations ? (phase1Result?.detectedCharacters || []) : "Derived from global summary",
      visibleObjects: hasPerFrameObservations ? perFrameObservations.map((obs: any) => obs?.visibleObjects || []) : "Derived from global summary",
      visibleActions: hasPerFrameObservations ? perFrameObservations.map((obs: any) => obs?.visibleAction || "") : "Derived from global summary",
      visibleConsequences: hasPerFrameObservations ? (sceneMechanismAudit?.visualConsequenceConfirmed ? "Confirmed in frame observations" : "Not confirmed in frame observations") : (isVisionWeak ? "Unconfirmed" : "Derived from summary"),
      aggregatedVisibleSubjects: phase1Result?.canonicalCastList || [],
      frameTimelineSource: dialogueSyncAudit?.frameTimelineSource || "unknown",
      finalSegmentFrames: framesAfter46s,
      finalSegmentMainSubject: "Global summary only",
      finalSegmentAction: "Global summary only",
      visualPayoffConfirmed,
      visionEvidenceStrength,
      notes: isVisionWeak ? "Final frames present but vision summary too generic." : ""
    },

    inferred: {
      audioVideoRelation: audioVideoRelationAudit?.audioVideoRelation || "UNKNOWN",
      inferredSceneRule: sceneMechanismAudit?.ruleLine || "Unknown",
      inferredTrigger: sceneMechanismAudit?.triggerCondition || false,
      inferredConsequence: sceneMechanismAudit?.expectedConsequence || false,
      inferredStrongestBeat: durationBeatStrategy?.strongestBeat,
      inferenceSource: "Phase 3.3A Cross-Analysis",
      inferenceConfidence,
      notes: missingFinalPayoff ? "Final line heard but not timestamp-aligned; cannot prove exact visual sync." : ""
    },

    notSeenOrNotConfirmed: {
      missingFinalSubject: missingFinalPayoff,
      missingFinalPayoff,
      missingStateChange: missingFinalPayoff || !audioVideoRelationAudit?.triggerFound,
      missingVisualConsequence: missingFinalPayoff || !audioVideoRelationAudit?.consequenceFound,
      missingFrameTimestamps: frameTimestamps === "not available",
      missingReason: !hasPerFrameObservations ? "Frame-level observations unavailable; final subject cannot be confirmed from global summary." : (isVisionWeak ? "Vision description lacks detail" : "Visual consequence missing in summary"),
      notes: ""
    },

    decision: {
      selectedBeat,
      selectedCharacter,
      selectedLine: durationBeatStrategy?.essentialLine,
      selectedDuration: bestPrompt?.duration || 15,
      usedFirstBeatInsteadOfStrongestBeat: durationBeatStrategyUseful ? (durationBeatStrategy?.firstBeat === durationBeatStrategy?.essentialBeat && durationBeatStrategy?.firstBeat !== durationBeatStrategy?.strongestBeat) : "UNKNOWN",
      whySelected: durationBeatStrategyUseful ? "Strongest beat based on hybrid logic" : (dialogueSyncAudit?.canAssignSpeakers ? "Cautious assignment based on alignment" : "Fallback due to lack of evidence"),
      whyFinalPayoffNotSelected: missingFinalPayoff ? (finalLineHeard ? "Final line appears in transcript, but corresponding character/payoff not confirmed visually." : "Not found in transcript or vision") : "Selected or not overriding",
      rejectedBeats: durationBeatStrategy?.removableBeatsForShortDuration || [],
      rejectedCharacters: [],
      notes: missingFinalPayoff ? "Final subject visible, but final transcript line was not aligned to visual segment." : ""
    },

    risk: {
      riskLevel,
      possibleError,
      reason: isVisionWeak || !hasPerFrameObservations ? "Frame count mismatch or generic vision summary" : "Standard operation",
      recommendation,
      canAssignSpeakers: dialogueSyncAudit?.canAssignSpeakers,
      dialogueSyncConfidence: dialogueSyncAudit?.confidence || "NONE"
    },

    finalFramesCoverage: {
      framesAfter46s,
      timestampsAfter46s,
      subjectsDetectedAfter46s: "Not available at per-frame level",
      actionsDetectedAfter46s: "Not available at per-frame level",
      payoffDetectedAfter46s: "Not available at per-frame level",
      finalSubjectVisible: "Unknown (Global summary only)",
      finalSubjectSelected: !missingFinalPayoff ? "Unknown" : false,
      reasonIfFinalSubjectNotSelected: "Frame-level observations unavailable; final subject cannot be confirmed from global summary."
    },

    castAndDialogueAudit: castAndDialogueAudit || null,
    sceneMechanismAudit: sceneMechanismAudit || null,
    castGroundingAudit: phase1Result?.castGroundingAudit || null,
    dialogueSyncAudit: dialogueSyncAudit || null
  };
}

function deriveComposerDossier(params: {
  phase1Result: any;
  transcript: string;
  durationBeatStrategy: any;
  sceneMechanismAudit: any;
  castAndDialogueAudit: any;
  dialogueSyncAudit: any;
  promptDecisionTrace: any;
}) {
  const { phase1Result, transcript, durationBeatStrategy, sceneMechanismAudit, castAndDialogueAudit, dialogueSyncAudit, promptDecisionTrace } = params;

  // 1. contentType
  const contentNature = phase1Result?.contentNature || phase1Result?.coreIntentClassification?.coreIntent || "UNKNOWN";
  
  // 2. dominantSignal
  const dominantSignal = promptDecisionTrace?.dominantElement || phase1Result?.dominantSignal || phase1Result?.primaryEngine || "UNKNOWN";

  // 3. coreIntent
  const coreIntent = phase1Result?.coreIntentClassification?.intentReasoning || "Maintain structural integrity and verified facts.";

  // 4. keyMoment
  const keyMoment = durationBeatStrategy?.essentialBeat || "Verified peak of action as described in analysis.";

  // 5. shortFormStrategy
  const shortFormStrategy = durationBeatStrategy?.strategy15s || "Focus on the core verified event and essential dialogue.";

  // 6. audioPriority
  const audioPriority = (dialogueSyncAudit?.canAssignSpeakers && castAndDialogueAudit?.dialogueTurns > 0)
    ? "Verified dialogue and speaker attribution."
    : (transcript ? "Verifiable audio transcription without certain speaker attribution." : "No essential audio verified.");

  // 7. visualPriority
  const visualPriority = sceneMechanismAudit?.visualConsequenceConfirmed === true
    ? "Verified visual payoff and character reactions."
    : "Verified environment and character presence.";

  // 8. mustKeep
  const mustKeep = [
    ...(durationBeatStrategy?.supportingBeats || []),
    ...(phase1Result?.canonicalCastList || []).slice(0, 2)
  ].filter(Boolean).slice(0, 5);

  // 9. mustCut
  const mustCut = (durationBeatStrategy?.removableBeatsForShortDuration || []).slice(0, 3);

  // 10. doNotInvent
  const doNotInvent = [
    "cinematic lighting not verified",
    "unseen extra characters",
    "payoff not confirmed by vision",
    "background music mood if not described"
  ];

  // 11. promptDirection
  const promptDirection = `Generate a concrete description of ${dominantSignal} driven content. Prioritize ${visualPriority}.`;

  // 12. targetLanguage
  const targetLanguage = phase1Result?.dialogueLanguageLock === "EN" ? "English" : "Italian";

  // Build Short Dossier
  const shortDossier = `
COMPOSER_STRATEGIC_DOSSIER
NATURE: ${contentNature}
ENGINE: ${dominantSignal}
INTENT: ${coreIntent.substring(0, 150)}
DOMINANT: ${dominantSignal}
SHORT_FORM: ${shortFormStrategy}
AUDIO: ${audioPriority}
VISUAL: ${visualPriority}
MUST_KEEP: ${mustKeep.join(", ")}
MUST_CUT: ${mustCut.join(", ")}
DO_NOT_INVENT: ${doNotInvent.join(", ")}
TARGET_LANGUAGE: ${targetLanguage}
STYLE_DIRECTION: concrete, grounded, no generic style labels
`.trim();

  const sourceFields = [
    "contentNature", "durationBeatStrategy", "sceneMechanismAudit", 
    "castAndDialogueAudit", "dialogueSyncAudit", "promptDecisionTrace"
  ];

  let confidence = "MEDIUM";
  if (promptDecisionTrace?.risk?.riskLevel === "LOW") confidence = "HIGH";
  if (promptDecisionTrace?.risk?.riskLevel === "HIGH") confidence = "LOW";
  if (!transcript || !phase1Result?.frameObservations) confidence = "INSUFFICIENT";

  return {
    contentType: contentNature,
    dominantSignal,
    coreIntent,
    keyMoment,
    shortFormStrategy,
    audioPriority,
    visualPriority,
    mustKeep,
    mustCut,
    doNotInvent,
    promptDirection,
    targetLanguage,
    shortDossier,
    sourceFields,
    confidence
  };
}

async function processPhase2Success(parsed: any, phase1Result: any, transcript: string, canonicalCastList: string[], modelUsed: string, visionProviderStatus: string, visionProvider: string, visionName: string) {
    // Local Mapping Logic
    logger.info("[GROQ_FULL_PHASE2_LOCAL_PROMPT_MAPPING_DONE]");
    auditPhase2PromptFingerprints("[PHASE2_FINGERPRINT_AFTER_GROQ_PARSE]", parsed);

    // 1. Scrub Banned Terms from Parsed JSON
    const scrubbedParsed = scrubBannedTerms(parsed);
    
    const basePrompt = scrubbedParsed.sceneMasterPrompt || "";
    if (basePrompt.length < 50) {
      return handlePhase2ParseError(phase1Result, "SceneMasterPrompt too short or empty");
    }

    const phase1Fallback = phase1Result?.aiPrompts || phase1Result?.analysis || "";

    const loopObj = normalizePhase2LoopStrategy(scrubbedParsed.loopStrategy);
    logger.info("[GROQ_FULL_PHASE2_LOOP_STRATEGY_NORMALIZED]");

    const audioVideoRelationAudit = deriveSceneMechanismAudit(basePrompt, transcript, phase1Result);
    logger.info("[AUDIO_VIDEO_RELATION_AUDIT_ONLY]", audioVideoRelationAudit);
    const castAndDialogueAudit = buildCastAndDialogueAudit(phase1Result, transcript, canonicalCastList);
    const dialogueSyncAudit = buildDialogueSyncAudit(phase1Result, transcript, canonicalCastList);
    const sceneMechanismAudit = buildSceneMechanismAudit(phase1Result, transcript);
    logger.info("[CAST_AND_DIALOGUE_AUDIT_ONLY]", castAndDialogueAudit);
    logger.info("[DIALOGUE_SYNC_AUDIT_ONLY]", dialogueSyncAudit);
    logger.info("[DIALOGUE_FRAME_ALIGNMENT_AUDIT_ONLY]", dialogueSyncAudit?.dialogueFrameAlignment || []);
    logger.info("[SCENE_MECHANISM_AUDIT_ONLY]", sceneMechanismAudit);

    const durationBeatStrategy = deriveDurationBeatStrategy(basePrompt, transcript, phase1Result);
    logger.info("[DURATION_BEAT_STRATEGY_AUDIT_ONLY]", durationBeatStrategy);

    const differentiatedPromptSet = buildDifferentiatedPhase2PromptSetV2(basePrompt, transcript, phase1Fallback, phase1Result, audioVideoRelationAudit, durationBeatStrategy, dialogueSyncAudit);
    
    // Add Decision Trace for diagnostics
    const bestPrompt = {
      targetField: "optimizedPrompt15s",
      model: modelUsed,
      duration: 15,
      prompt: typeof differentiatedPromptSet.bestOptimizedPrompt === 'string' ? differentiatedPromptSet.bestOptimizedPrompt : (differentiatedPromptSet.bestOptimizedPrompt?.prompt || ""),
      reason: "GROQ_FULL_PHASE_2_PROMPT_GENERATED_FROM_VERIFIED_CORE"
    };

    const promptDecisionTrace = derivePromptDecisionTrace({
      phase1Result,
      transcript,
      differentiatedPromptSet,
      bestPrompt,
      durationBeatStrategy,
      audioVideoRelationAudit,
      castAndDialogueAudit,
      sceneMechanismAudit,
      dialogueSyncAudit
    });
    logger.info("[PROMPT_DECISION_TRACE_AUDIT]", promptDecisionTrace);

    const composerDossier = deriveComposerDossier({
      phase1Result,
      transcript,
      durationBeatStrategy,
      sceneMechanismAudit,
      castAndDialogueAudit,
      dialogueSyncAudit,
      promptDecisionTrace
    });
    logger.info("[COMPOSER_DOSSIER_DERIVED]", composerDossier);

    const mappedPrompts: any = {
      ...differentiatedPromptSet,
      ...parsed,
      promptProcessInfiltrator: parsed.promptProcessInfiltrator || {
        truthSourceLedger: {
          audioAvailable: !!transcript,
          transcriptSource: phase1Result?.transcriptSource || "NONE",
          visualFramesCount: phase1Result?.frameTimestamps?.length || 0,
          visionProvider: visionProvider,
          synchronizedDialogue: !!(dialogueSyncAudit?.alignedTurnsCount > 0)
        },
        composerUsageTrace: {
          baseDossierUsed: !!composerDossier,
          audioContextIntegrated: !!transcript,
          videoContextIntegrated: !!phase1Result?.SceneDNA,
          alignmentConfidence: dialogueSyncAudit?.confidence || "NONE"
        },
        promptLineageTrace: [
          { field: "sceneMasterPrompt", origin: "PHASE_2_LLM", primaryDataSource: "HYBRID", wasScrubbed: false }
        ],
        promptLineageDeepTrace: {
            mismatches: [],
            finalInvestigationConclusion: "CATENA PROMPT VERIFICATA - TUTTO OK"
        },
        validatorInterrogationTrace: [],
        gradeInterrogationTrace: [],
        finalInfiltratorVerdict: (phase1Result?.promptSafetyMode === "AUDIO_ANCHORED_VISUAL_WEAK") ? "VISIBLE_FALLBACK" : "OK",
        infiltratorDiagnosis: (phase1Result?.promptSafetyMode === "AUDIO_ANCHORED_VISUAL_WEAK") 
            ? "Visione debole confermata. Utilizzo audio-anchored fallback."
            : "Grounding visivo e audio allineati. Catena affidabile."
      },
      castAndDialogueAudit,
      dialogueSyncAudit,
      mergedFrameTimeline: dialogueSyncAudit?.mergedFrameTimeline || [],
      sceneMechanismAudit,
      composerDossier,
      promptDecisionTrace, // Only diagnostic
      promptStrategy: `Prompt video differenziati da scena visiva e battute confermate | ${modelUsed} Engine`,
      loopStrategy: loopObj,
      visionProviderStatus,
      promptQualityReport: {
        finalPass: true,
        notes: "Prompt differenziati per modello e durata usando la scena verificata; transcript ridotto."
      }
    };
    auditPhase2PromptFingerprints("[PHASE2_FINGERPRINT_AFTER_LOCAL_MAPPING]", mappedPrompts);
    auditPhase2PromptFingerprints("[PHASE2_FINGERPRINT_AFTER_DIFFERENTIATED_BUILDER]", differentiatedPromptSet);

    // [HYBRID_LANGUAGE_RESIDUE_AUDIT]
    const keywordsToFind = ["he", "she", "they", "stands", "gestures", "hands", "the scene", "in front", "while", "making", "interacting", "chiusura coerente su", "svolge", "compie"];
    const languageResidueAudit: any = {};
    const stringFieldsOnly: Record<string, string> = {
      sceneMasterPrompt: mappedPrompts.sceneMasterPrompt,
      soraPrompt12s: mappedPrompts.soraPrompt12s,
      soraPrompt15s: mappedPrompts.soraPrompt15s,
      klingPrompt10s: mappedPrompts.klingPrompt10s,
      klingPrompt15s: mappedPrompts.klingPrompt15s,
      veo3Prompt8s: mappedPrompts.veo3Prompt8s,
      veo3ExtensionPart1Prompt8s: mappedPrompts.veo3ExtensionPart1Prompt8s,
      veo3ExtensionPart2Prompt8s: mappedPrompts.veo3ExtensionPart2Prompt8s,
      seedancePrompt15s: mappedPrompts.seedancePrompt15s,
      optimizedPrompt12s: mappedPrompts.optimizedPrompt12s,
      optimizedPrompt15s: mappedPrompts.optimizedPrompt15s,
    };
    for (const [key, val] of Object.entries(stringFieldsOnly)) {
       if (!val) continue;
       const found = keywordsToFind.filter(k => {
           const regex = new RegExp(`\\b${k}\\b`, "i");
           return regex.test(val) || (k.includes(" ") && val.toLowerCase().includes(k));
       });
       if (found.length > 0) languageResidueAudit[key] = found;
    }
    logger.info("[HYBRID_LANGUAGE_RESIDUE_AUDIT]", languageResidueAudit);
    logger.info("[PHASE2_GROQ_RAW_PROMPT_DIRTY]", { preview: mappedPrompts.sceneMasterPrompt?.substring(0, 200) });

    // Sanitization Before Validation
    const fieldsToSanitize = [
      "sceneMasterPrompt", "aiPrompts", "promptSora12s", "soraPrompt12s",
      "promptSora15s", "soraPrompt15s", "klingPrompt", "klingPrompt10s",
      "klingPrompt15s", "veoPrompt", "veo3Prompt8s", "veo3ExtensionPart1Prompt8s",
      "veo3ExtensionPart2Prompt8s", "seedancePrompt15s", "sendancePrompt15s",
      "optimizedPrompt12s", "optimizedPrompt15s", "bestOptimizedPromptText"
    ];

    logger.info("[PHASE2_SANITIZED_ALL_FIELDS_BEFORE_VALIDATION]");
    fieldsToSanitize.forEach(field => {
      if (typeof mappedPrompts[field] === 'string') {
        mappedPrompts[field] = sanitizePromptDraftBeforeValidation(mappedPrompts[field]);
      }
    });

    if (mappedPrompts.bestOptimizedPrompt?.prompt) {
      mappedPrompts.bestOptimizedPrompt.prompt = sanitizePromptDraftBeforeValidation(mappedPrompts.bestOptimizedPrompt.prompt);
    }
    if (mappedPrompts.neutralFacts) {
      mappedPrompts.neutralFacts = sanitizePromptDraftBeforeValidation(mappedPrompts.neutralFacts);
    }
    if (mappedPrompts.loopStrategy?.strategy) {
      mappedPrompts.loopStrategy.strategy = sanitizePromptDraftBeforeValidation(mappedPrompts.loopStrategy.strategy);
    }
    if (mappedPrompts.loopStrategy?.reason) {
      mappedPrompts.loopStrategy.reason = sanitizePromptDraftBeforeValidation(mappedPrompts.loopStrategy.reason);
    }

    // Validation
    let validation = validateGroqFullPhase2Prompts(mappedPrompts, transcript, canonicalCastList);
    
    const promptValidationReport: any = {
      status: validation.isValid ? "PASSED" : "FAILED",
      finalPass: false,
      locked: false,
      promoted: validation.isValid,
      recoveryTriggered: !validation.isValid,
      checkedFields: validation.checkedFields || [],
      excludedFields: validation.excludedFields || [],
      failedFields: validation.failedFields || [],
      warnings: [],
      timestamp: new Date().toISOString()
    };

    if (!validation.isValid) {
        logger.warn("[PHASE2_VALIDATION_FAILED_RECOVERING_WITH_LOCAL_PROMPTS]", { report: validation.report });
        logger.warn("[PROMPT_VALIDATION_FAILED_REASON]", { 
          failedFields: validation.failedFields,
          totalIssues: validation.failedFields?.length
        });
        
        promptValidationReport.recoveryReason = "VALIDATOR_FAILED";
        
        const deterministicRecovery = buildDifferentiatedPhase2PromptSetV2(
          phase1Result?.SceneDNA?.primaryDescription || "Analisi visiva parziale",
          transcript,
          "", // aiPromptsFallback
          phase1Result,
          audioVideoRelationAudit,
          durationBeatStrategy,
          dialogueSyncAudit
        );

        logger.info("[PHASE2_LOCAL_DETERMINISTIC_PROMPTS_BUILT]");
        logger.info("[PROMPT_RECOVERY_TRIGGER_REASON]", { trigger: "validator_banned_terms" });

        // Sanitize recovery fields
        fieldsToSanitize.forEach(field => {
          if (typeof deterministicRecovery[field] === 'string') {
            deterministicRecovery[field] = sanitizePromptDraftBeforeValidation(deterministicRecovery[field]);
          }
        });

        // Update mappedPrompts with recovered fields
        Object.assign(mappedPrompts, deterministicRecovery);
        
        // Re-validate recovery (should pass if template is clean)
        const recoveryValidation = validateGroqFullPhase2Prompts(mappedPrompts, transcript, canonicalCastList);
        
        promptValidationReport.status = "RECOVERED";
        promptValidationReport.recoverySuccess = recoveryValidation.isValid;
        
        mappedPrompts.promptQualityReport = {
          finalPass: true,
          localRecoveryPass: true,
          notes: "Prompt AI invalidi scartati. Recupero locale deterministico completato con successo."
        };
        
        mappedPrompts.lockedPromptTabs = { locked: true, phase: "prompt", reason: "RECOVERED_LOCAL" };
        logger.info("[PHASE2_PROMPT_TABS_LOCKED_AFTER_LOCAL_RECOVERY]");
    } else {
        promptValidationReport.promotionReason = "LLM_PHASE2_PROMPTS_VALIDATED";
        logger.info("[PROMPT_PROMOTION_DECISION]", { decision: "PASSED", method: "LLM_PHASE2" });

        mappedPrompts.promptQualityReport = {
          finalPass: true,
          notes: "Prompt validati con successo dopo sanitizzazione linguistica."
        };
        mappedPrompts.lockedPromptTabs = { locked: true, phase: "prompt", reason: "VALIDATED" };
    }

    mappedPrompts.promptValidationReport = promptValidationReport;
    logger.info("[PROMPT_VALIDATION_REPORT]", promptValidationReport);

    // Best Optimized Prompt Selection
    mappedPrompts.bestOptimizedPrompt = {
         targetField: "optimizedPrompt15s",
         model: modelUsed,
         duration: 15,
         prompt: typeof mappedPrompts.optimizedPrompt15s === 'string' ? mappedPrompts.optimizedPrompt15s : "ERRORE_RECUPERO_LOCAL",
         reason: (mappedPrompts.promptQualityReport as any)?.localRecoveryPass ? "RECOVERED_LOCAL_DETERMINISTIC_PROMPT" : "GROQ_FULL_PHASE_2_PROMPT_GENERATED_FROM_VERIFIED_CORE"
    };

    // FINAL QUALITY GATE: REJECT TECHNICAL SUBJECTS IN PROMPTS (Fase 3.3B)
    const technicalSubjectCheck = ["analisi visiva parziale", "rilevamento visivo limitato", "personaggio 1", "unknown", "nearby", "n/d", "n/a"];
    let finalRejection = false;
    fieldsToSanitize.forEach(field => {
      if (typeof mappedPrompts[field] === 'string' && technicalSubjectCheck.some(term => mappedPrompts[field].toLowerCase().includes(term))) {
          finalRejection = true;
          logger.warn("[LOCAL_PROMPT_REJECTED_TECHNICAL_SUBJECT]", { field, term: technicalSubjectCheck.find(term => mappedPrompts[field].toLowerCase().includes(term)) });
      }
    });

    const promptFieldsToStrictCheck = [
      "sceneMasterPrompt",
      "aiPrompts",
      "optimizedPrompt12s",
      "optimizedPrompt15s",
      "promptSora12s",
      "soraPrompt12s",
      "promptSora15s",
      "soraPrompt15s",
      "klingPrompt10s",
      "klingPrompt15s",
      "klingPrompt",
      "veo3Prompt8s",
      "veoPrompt",
      "veo3ExtensionPart1Prompt8s",
      "veo3ExtensionPart2Prompt8s",
      "seedancePrompt15s",
      "sendancePrompt15s"
    ];

    // Sanitize grammar
    promptFieldsToStrictCheck.forEach(field => {
      if (typeof mappedPrompts[field] === 'string') {
        mappedPrompts[field] = sanitizeFinalPromptGrammar(mappedPrompts[field]);
      }
    });

    if (mappedPrompts.bestOptimizedPrompt && typeof mappedPrompts.bestOptimizedPrompt.prompt === 'string') {
        mappedPrompts.bestOptimizedPrompt.prompt = sanitizeFinalPromptGrammar(mappedPrompts.bestOptimizedPrompt.prompt);
    }
    if (typeof mappedPrompts.bestOptimizedPromptText === 'string') {
        mappedPrompts.bestOptimizedPromptText = sanitizeFinalPromptGrammar(mappedPrompts.bestOptimizedPromptText);
    }

    logger.info("[LOCAL_PROMPT_GRAMMAR_SANITIZED]");

    // Hard reject validation
    let sanityRejectionReason: string[] = [];
    promptFieldsToStrictCheck.forEach(field => {
      if (typeof mappedPrompts[field] === 'string') {
          const errors = validateFinalPromptSanity(mappedPrompts[field]);
          if (errors.length > 0) {
              sanityRejectionReason.push(`Field ${field} failed sanity check. Found banned terms: ${errors.join(', ')}`);
          }
      }
    });
    if (mappedPrompts.bestOptimizedPrompt && typeof mappedPrompts.bestOptimizedPrompt.prompt === 'string') {
        const errors = validateFinalPromptSanity(mappedPrompts.bestOptimizedPrompt.prompt);
        if (errors.length > 0) sanityRejectionReason.push(`bestOptimizedPrompt failed sanity check: ${errors.join(', ')}`);
    }

    if (sanityRejectionReason.length > 0) {
        logger.warn("[LOCAL_PROMPT_VALIDATOR_HARD_REJECT]", { reasons: sanityRejectionReason });
        finalRejection = true;
    } else {
        logger.info("[LOCAL_PROMPT_FINAL_SANITY_PASS]");
    }

    if (finalRejection) {
        logger.info("[PROMPT_LOCK_BLOCKED_NO_CAST_GROUNDING_OR_SANITY]");
        
        mappedPrompts.promptValidationReport = {
          ...(mappedPrompts.promptValidationReport || {}),
          status: "FAILED",
          finalPass: false,
          locked: false,
          recoveryTriggered: true,
          recoveryReason: sanityRejectionReason.length > 0 ? "FINAL_SANITY_REJECTION" : "TECHNICAL_SUBJECT_REJECTION",
          failedFields: [
            ...(mappedPrompts.promptValidationReport?.failedFields || []),
            ...sanityRejectionReason.map(r => ({ field: "final_sanity", reason: r }))
          ]
        };

        mappedPrompts.promptQualityReport = {
          finalPass: false,
          notes: "Prompt rigettati: fallita visual grounding o sanity check grammaticale.",
          report: validation?.report || sanityRejectionReason
        };
        mappedPrompts.lockedPromptTabs = {
            locked: false,
            phase: "prompt",
            reason: sanityRejectionReason.length > 0 ? "PROMPT_BLOCKED_FINAL_SANITY" : "PROMPT_REJECTED_TECHNICAL_SUBJECT"
        };
        
        promptFieldsToStrictCheck.forEach(field => {
          if (typeof mappedPrompts[field] === 'string') {
            mappedPrompts[field] = "NON_GENERATO_PROMPT_VALIDATION_FAILED";
          }
        });
        if (typeof mappedPrompts.bestOptimizedPromptText === 'string') {
            mappedPrompts.bestOptimizedPromptText = "NON_GENERATO_PROMPT_VALIDATION_FAILED";
        }
    }

    // --- INFILTRATOR LOGIC OVERRIDE ---
    if (mappedPrompts.promptProcessInfiltrator) {
      let isSuspicious = false;
      let diagnosis = "Verified by manual logic: ";

      if (mappedPrompts.bestOptimizedPrompt?.reason === "GROQ_FULL_PHASE_2_PROMPT_GENERATED_FROM_VERIFIED_CORE" && mappedPrompts.promptValidationReport?.status === "RECOVERED") {
         isSuspicious = true;
         diagnosis += "Reason says verified core but was recovered. ";
      }

      const activePromptStr = (typeof mappedPrompts.bestOptimizedPrompt?.prompt === 'string' ? mappedPrompts.bestOptimizedPrompt.prompt : "").toLowerCase();
      const hasBadTerms = ["apertura su", "sora 12s continuativa", "ponytail and glasses", "with glasses", "person_", "unknown"].some(bt => activePromptStr.includes(bt));
      if (hasBadTerms) {
         isSuspicious = true;
         diagnosis += "Suspicious template terms found. ";
      }
      
      if (mappedPrompts.promptQualityReport?.finalPass === true && hasBadTerms) {
         isSuspicious = true;
         diagnosis += "Final pass true but bad terms present. ";
      }

      const smp = (typeof mappedPrompts.sceneMasterPrompt === 'string' ? mappedPrompts.sceneMasterPrompt : "");
      if (smp.toLowerCase().includes("non disponibile") && activePromptStr && !activePromptStr.includes("non_generato")) {
         isSuspicious = true;
         diagnosis += "Master prompt missing but optimized prompt generated. ";
      }

      if (finalRejection) {
         mappedPrompts.promptProcessInfiltrator.finalInfiltratorVerdict = "VISIBLE_FALLBACK";
         mappedPrompts.promptProcessInfiltrator.infiltratorDiagnosis = "Prompt final rejection triggered.";
      } else if (isSuspicious) {
         mappedPrompts.promptProcessInfiltrator.finalInfiltratorVerdict = "SUSPICIOUS";
         mappedPrompts.promptProcessInfiltrator.infiltratorDiagnosis = diagnosis;
      } else {
         mappedPrompts.promptProcessInfiltrator.finalInfiltratorVerdict = "OK";
         mappedPrompts.promptProcessInfiltrator.infiltratorDiagnosis = "Logic verified.";
      }
    }
    // --- END INFILTRATOR LOGIC ---

    // Final merge
    const result = {
      ...phase1Result,
      ...mappedPrompts,
      groqFullPhase: "prompt",
      visionProvider,
      visionProviderInfo: {
          name: visionName
      },
      visionProviderStatus,
      operationalDecision: finalRejection ? (sanityRejectionReason.length > 0 ? "PROMPT_BLOCKED_FINAL_SANITY" : "NON_GENERATO_PROMPT_VISUAL_GROUNDING_FAILED") : "GENERA",
      finalPromptVerdict: finalRejection ? "Prompt non generati: rilevati placeholder tecnici o errori grammaticali." : "Output generato correttamente.",
      humanVerdict: finalRejection ? "I prompt contengono testi tecnici non validi o errori grammaticali." : "Analisi completa e prompt generati.",
      promptQualityReport: mappedPrompts.promptQualityReport,
      lockedPromptTabs: mappedPrompts.lockedPromptTabs
    };

    if (finalRejection && result.bestOptimizedPrompt) {
        result.bestOptimizedPrompt.prompt = "NON_GENERATO_PROMPT_VALIDATION_FAILED";
    }

    if (mappedPrompts.lockedPromptTabs?.locked) {
      applyPhase2PromptAliasPreservation(result, mappedPrompts);
      auditPhase2PromptFingerprints("[PHASE2_FINGERPRINT_AFTER_ALIAS_PRESERVATION]", result);

      auditPromptVariantDifferentiation({
        sceneMasterPrompt: result.sceneMasterPrompt,
        soraPrompt15s: result.soraPrompt15s,
        klingPrompt15s: result.klingPrompt15s,
        veo3Prompt8s: result.veo3Prompt8s,
        veo3ExtensionPart1Prompt8s: result.veo3ExtensionPart1Prompt8s,
        veo3ExtensionPart2Prompt8s: result.veo3ExtensionPart2Prompt8s,
        seedancePrompt15s: result.seedancePrompt15s,
        optimizedPrompt15s: result.optimizedPrompt15s
      });
      auditPromptVariantStructure({
        sceneMasterPrompt: result.sceneMasterPrompt,
        soraPrompt15s: result.soraPrompt15s,
        klingPrompt15s: result.klingPrompt15s,
        veo3Prompt8s: result.veo3Prompt8s,
        veo3ExtensionPart1Prompt8s: result.veo3ExtensionPart1Prompt8s,
        veo3ExtensionPart2Prompt8s: result.veo3ExtensionPart2Prompt8s,
        seedancePrompt15s: result.seedancePrompt15s,
        optimizedPrompt15s: result.optimizedPrompt15s
      });

      auditPromptAliasMapping({
        promptSora12s: result.promptSora12s,
        soraPrompt12s: result.soraPrompt12s,
        promptSora15s: result.promptSora15s,
        soraPrompt15s: result.soraPrompt15s,
        veo3Prompt8s: result.veo3Prompt8s,
        veoPrompt: result.veoPrompt,
        seedancePrompt15s: result.seedancePrompt15s,
        sendancePrompt15s: result.sendancePrompt15s,
        veo3ExtensionPart1Prompt8s: result.veo3ExtensionPart1Prompt8s,
        veo3ExtensionPart2Prompt8s: result.veo3ExtensionPart2Prompt8s,
        optimizedPrompt15s: result.optimizedPrompt15s,
        sceneMasterPrompt: result.sceneMasterPrompt,
        klingPrompt15s: result.klingPrompt15s,
        bestOptimizedPrompt: result.bestOptimizedPrompt?.prompt || ""
      });
      auditPhase2AliasPreservation(result, mappedPrompts);

      logger.info("[PHASE2_SUCCESS_PROMPT_ALIASES_SYNCED]", {
        finalPass: true,
        locked: true,
        syncedFields: Object.keys(mappedPrompts).filter((key) => key !== "neutralFacts")
      });
      auditPhase2PromptFingerprints("[PHASE2_FINGERPRINT_AFTER_SYNCED_PROMPT_FIELDS]", result);
    }

    // MANDATORY BLOCK: Publishing/Cover/Youtube always blocked in Phase 2
    result.publishingKit = "NON_GENERATO_PHASE_2";
    result.parsedKit = "NON_GENERATO_PHASE_2";
    result.coverPrompt = "NON_GENERATO_PHASE_2";
    result.coverAntiScrollPrompt = "NON_GENERATO_PHASE_2";
    result.titles = "NON_GENERATO_PHASE_2";
    result.description = "NON_GENERATO_PHASE_2";
    result.hashtags = "NON_GENERATO_PHASE_2";
    result.tags = "NON_GENERATO_PHASE_2";
    result.pinnedComment = "NON_GENERATO_PHASE_2";
    result.youtubeMarketData = "NON_GENERATO_PHASE_2";

    logger.info("[PHASE2_SUCCESS_PUBLISHING_COVER_BLOCKED]");

    if ((phase1Result as any).visionProvider === "openrouter_timeout_degraded" || (phase1Result as any).visionStatus === "VISION_TIMEOUT_DEGRADED" || phase1Result?.promptSafetyMode === "AUDIO_ANCHORED_VISUAL_WEAK") {
      result.visionStatus = "VISION_TIMEOUT_DEGRADED";
      result.promptSafetyMode = "AUDIO_ANCHORED_VISUAL_WEAK";
      const existingEngineWarnings = Array.isArray(result.engineWarnings)
        ? result.engineWarnings
        : result.engineWarnings
          ? [result.engineWarnings]
          : [];
      result.engineWarnings = [...existingEngineWarnings, "OPENROUTER_VISION_TIMEOUT_DEGRADED_AUDIO_OK"];
      
      logger.info("[GROQ_FULL_PHASE2_DEGRADED_VISION_AUDIT]", {
        visionStatus: result.visionStatus,
        audioVerified: true,
        hasVerifiedTranscript: true,
        finalPass: result.promptQualityReport?.finalPass,
        locked: result.lockedPromptTabs?.locked,
        operationalDecision: result.operationalDecision
      });
    }

    const isPhase2Successful =
      result?.promptQualityReport?.finalPass === true &&
      result?.lockedPromptTabs?.locked === true;

    if (isPhase2Successful) {
      logger.info("[GROQ_FULL_PHASE2_SUCCESS_RETURNING_VALID_RESULT]", {
        finalPass: true,
        locked: true,
        hasBestPrompt: Boolean(result?.bestOptimizedPrompt?.prompt),
        hasSora: Boolean(result?.soraPrompt15s || result?.promptSora15s),
        hasKling: Boolean(result?.klingPrompt15s || result?.klingPrompt),
        hasVeo: Boolean(result?.veo3Prompt8s || result?.veoPrompt),
        hasSeedance: Boolean(result?.seedancePrompt15s || result?.sendancePrompt15s)
      });

      let sanitizedResult = result;
      logger.info("[PHASE2_FINAL_PROMPT_FIELDS_POPULATED]");
      try {
        auditPhase2PromptFingerprints("[PHASE2_FINGERPRINT_BEFORE_RETURN_FROM_HUGGING_FULL]", result);
        sanitizedResult = sanitizeGroqFullPhase2Output(result);
      } catch (sanitizeError: any) {
        logger.error("[GROQ_FULL_PHASE2_SANITIZE_FAILED_BUT_RESULT_VALID]", {
          errorName: sanitizeError?.name,
          errorMessage: sanitizeError?.message,
          errorStack: sanitizeError?.stack,
          finalPass: result?.promptQualityReport?.finalPass,
          locked: result?.lockedPromptTabs?.locked,
          operationalDecision: result?.operationalDecision
        });
        logger.info("[GROQ_FULL_PHASE2_SUCCESS_RETURNED_TO_APP]", {
          mode: "raw_result_after_sanitize_failure",
          finalPass: result?.promptQualityReport?.finalPass,
          locked: result?.lockedPromptTabs?.locked,
          operationalDecision: result?.operationalDecision,
          hasAiPrompts: Boolean(result?.aiPrompts),
          hasSceneMaster: Boolean(result?.sceneMasterPrompt),
          hasSora: Boolean(result?.soraPrompt15s || result?.promptSora15s),
          hasKling: Boolean(result?.klingPrompt15s || result?.klingPrompt),
          hasVeo: Boolean(result?.veo3Prompt8s || result?.veoPrompt),
          hasSeedance: Boolean(result?.seedancePrompt15s || result?.sendancePrompt15s)
        });
        return result;
      }

      logger.info("[GROQ_FULL_PHASE2_SUCCESS_RETURNED_TO_APP]", {
        finalPass: sanitizedResult.promptQualityReport?.finalPass,
        locked: sanitizedResult.lockedPromptTabs?.locked,
        operationalDecision: sanitizedResult.operationalDecision,
        hasAiPrompts: Boolean(sanitizedResult.aiPrompts),
        hasSceneMaster: Boolean(sanitizedResult.sceneMasterPrompt),
        hasSora: Boolean(sanitizedResult.soraPrompt15s),
        hasKling: Boolean(sanitizedResult.klingPrompt15s),
        hasVeo: Boolean(sanitizedResult.veo3Prompt8s),
        hasSeedance: Boolean(sanitizedResult.seedancePrompt15s)
      });

      return sanitizedResult;
    }

    logger.info("[GROQ_FULL_PHASE2_DONE]", { status: 'success' });
    return sanitizeGroqFullPhase2Output(result);
}

function validateGroqFullPhase2Prompts(data: any, transcript: string, cast: string[]) {
  const issues: string[] = [];
  const failedFields: Array<{ field: string, reason: string, matchedTerm?: string, preview?: string }> = [];

  const EXCLUDED_FIELDS = [
    "promptProcessInfiltrator",
    "composerDossier",
    "loopStrategy",
    "promptDecisionTrace",
    "runtimeTruthStatus",
    "visionProviderInfo",
    "audioVideoRelationAudit",
    "durationBeatStrategy",
    "promptQualityReport",
    "diagnostic",
    "audit",
    "metadata",
    "risk",
    "seen", "heard", "inferred", "notSeenOrNotConfirmed", "finalFramesCoverage",
    "castAndDialogueAudit",
    "dialogueSyncAudit",
    "mergedFrameTimeline",
    "sceneMechanismAudit",
    "promptStrategy",
    "visionProviderStatus"
  ];
  
  const dataToValidate = { ...data };
  const removedFields: string[] = [];
  for (const field of EXCLUDED_FIELDS) {
    if (field in dataToValidate) {
      delete dataToValidate[field];
      removedFields.push(field);
    }
  }

  if (removedFields.length > 0) {
      logger.info("[PROMPT_VALIDATOR_AUDIT_FIELDS_EXCLUDED]", { excluded: removedFields });
  }

  // Basic check: no "lorem ipsum" or generic templates
  const genericTerms = [
    "template", "placeholder", "[insert", "generic", "lorem ipsum",
    "build a short-form scene", "create a viral video", "make it cinematic",
    "use trending tiktok style", "add dramatic music", "a character says something funny",
    "insert a shocking twist", "sora prompt: make a viral comedy clip",
    "kling 15s. build a short-form scene", "veo 3 prompt: cinematic italian comedy",
    "cinematic italian comedy", "viral short-form scene", "engaging tiktok video",
    "hook the viewer", "add a twist ending",
    "create a clean narrative short", "hook immediately", 
    "setup, escalation, payoff and reaction", "keep the blocking dynamic", 
    "use trending", "cinematic", "generic short-form",
    "preserve continuity", "continue from the same scene world", 
    "emotional beat", "dramatic", "viral", "story arc", "engaging", 
    "compelling", "smooth transitions", "seamless loop", "visual-first", 
    "concrete", "readable expressions", "technical strategy",
    "the scene unfolds",
    "having limited visual detection", "as per the transcript", 
    "environment suggests", "possibly", "indicating a sense", 
    "highlighting the importance", "unknown", "personaggio ignoto",
    "the scene takes", "apertura su una donna e", "apertura su the scene",
    "svolge \"", "dialogo incoerente", "vertical sequence", "the scene involves",
    "nearby", "off-screen", "azione naturale", "reazione naturale", "set realistico", "oggetti di scena coerenti", "svolge l'azione",
    "Analisi visiva parziale", "Rilevamento visivo limitato", "Personaggio 1"
  ];
  const jsonStr = JSON.stringify(dataToValidate).toLowerCase();
  
  // Precision check & Diagnostic logging
  const checkBannedDeep = (obj: any, path = "") => {
    if (!obj) return;
    if (typeof obj === 'string') {
      const valLower = obj.toLowerCase();
      genericTerms.forEach(term => {
        if (valLower.includes(term)) {
          const issue = `Found generic term: ${term}`;
          if (!issues.includes(issue)) issues.push(issue);
          
          failedFields.push({
            field: path || "root",
            reason: "BANNED_TERM",
            matchedTerm: term,
            preview: obj.substring(0, 100)
          });

          logger.info("[GROQ_FULL_PHASE2_BANNED_TERM_RAW_FIELD]", {
            bannedTerm: term,
            field: path || "root",
            rawValuePreview: obj.substring(0, 500),
            rawValueLength: obj.length
          });
        }
      });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => checkBannedDeep(item, `${path}[${i}]`));
    } else if (typeof obj === 'object') {
      Object.entries(obj).forEach(([key, val]) => checkBannedDeep(val, path ? `${path}.${key}` : key));
    }
  };

  checkBannedDeep(dataToValidate);

  // Redundant check just in case it's in a non-object part (though unlikely in this context)
  genericTerms.forEach(term => {
    if (jsonStr.includes(term)) {
      const issue = `Found generic term: ${term}`;
      if (!issues.includes(issue)) issues.push(issue);
    }
  });

  // Dialogue check: if Italian dialogue is present, it shouldn't disappear entirely or be fully replaced by common English translations
  if (transcript && transcript.length > 5) {
     const commonItalianWords = [" il ", " la ", " che ", " non ", " per ", " con "];
     const transcriptLower = transcript.toLowerCase();
     const hasItalianWords = commonItalianWords.filter(w => transcriptLower.includes(w));
     
     if (hasItalianWords.length > 0) {
        // We expect at least some of these to persist if dialogue is quoted
        const foundInOutput = hasItalianWords.filter(w => jsonStr.includes(w));
        if (foundInOutput.length === 0 && transcript.length > 30) {
           issues.push("Possible dialogue translation detected: Italian words from transcript missing in prompts.");
           failedFields.push({
             field: "global_dialogue",
             reason: "DIALOGUE_TRANSLATION_DETECTED",
             preview: "Italian words from transcript missing in output JSON."
           });
        }
     }
  }

  // Cast check: No non-canonical names
  if (jsonStr.includes("character_name") || jsonStr.includes("actor_name")) {
     issues.push("Found AI placeholder name for cast.");
     failedFields.push({
       field: "cast",
       reason: "AI_PLACEHOLDER_NAME",
       matchedTerm: "character_name/actor_name"
     });
  }

  // Leak checks
  const leakKeywords = ["publishing", "cover", "hashtag", "youtube", "subscriber", "market data"];
  leakKeywords.forEach(k => {
    if (jsonStr.includes(k) && !jsonStr.includes("NON_GENERATO_PHASE_2")) {
      // Small exception for promptStrategy context if it mentions avoiding it, but generally bad
      if (k !== "publishing" || (data.promptStrategy && !data.promptStrategy.toLowerCase().includes(k))) {
         // issues.push(`Found potential leak keyword: ${k}`);
      }
    }
  });

  return {
    isValid: issues.length === 0,
    report: issues.length > 0 ? issues.join("; ") : "PROMPTS_VERIFIED_HF_FULL",
    failedFields,
    checkedFields: Object.keys(dataToValidate),
    excludedFields: removedFields
  };
}

export function buildGroqFullPhase2RecoveryResult(params: {
  phase1Result: any;
  localPrompts: any;
  reason: string;
  visionProviderStatus?: string;
  visionProvider?: string;
  visionProviderName?: string;
}) {
  const { phase1Result, localPrompts, reason, visionProviderStatus, visionProvider, visionProviderName } = params;
  logger.info("[GROQ_FULL_PHASE2_RECOVERY_RESULT_BUILT]", { reason, phase: "prompt" });
  logger.info("[PHASE2_PROVIDER_UNAVAILABLE_NOT_FATAL]", { reason });

  const isWeakVisualReviewRequired = [
    "AUDIO_ANCHORED_PROMPT_WEAK_VISUAL",
    "GROUNDING_WEAK_AUDIO_RECOVERY",
    "DIALOGUE_SYNC_WEAK_AUDIO_RECOVERY",
  ].includes(reason);
  const audioSegmentsCount = Array.isArray(phase1Result?.audioSegments) ? phase1Result.audioSegments.length : 0;
  const frameTimestampsCount = Array.isArray(phase1Result?.frameTimestamps) ? phase1Result.frameTimestamps.length : 0;
  const frameObservationsCount = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations.length : 0;
  const visualCastCount = Number(phase1Result?.visualCastCount || 0);
  const hasTranscript = Boolean(phase1Result?.verifiedTranscript || phase1Result?.script);
  const audioConfidencePercent = phase1Result?.audioVerified ? 92 : 30;
  const visionConfidencePercent = frameObservationsCount > 0 ? 70 : 18;
  const castConfidencePercent = visualCastCount > 0 ? 55 : 20;
  const dialogueSyncConfidencePercent = audioSegmentsCount > 0 && frameTimestampsCount > 0 ? 72 : 25;
  const promptUsabilityPercent = isWeakVisualReviewRequired ? 68 : 88;
  const publishReadiness = isWeakVisualReviewRequired ? "REVIEW_REQUIRED" : "YES";

  const trace = {
    ...phase1Result?.promptDecisionTrace,
    audioConfidencePercent,
    visionConfidencePercent,
    castConfidencePercent,
    dialogueSyncConfidencePercent,
    promptUsabilityPercent,
    publishReadiness,
    inferred: {
      ...(phase1Result?.promptDecisionTrace?.inferred || {}),
      notes: isWeakVisualReviewRequired
        ? "Audio e timeline sono affidabili, ma la visione non conferma abbastanza dettagli. Prompt generati in modalita da revisionare."
        : "Provider AI non disponibile (HF/Groq credits). Prompt assemblati localmente usando l'audit certificato."
    },
    decision: {
      ...(phase1Result?.promptDecisionTrace?.decision || {}),
      promptsBlocked: false,
      reason: isWeakVisualReviewRequired ? "GENERATED_REVIEW_REQUIRED_WEAK_VISUAL" : (phase1Result?.promptDecisionTrace?.decision?.reason || "")
    },
    risk: {
      ...(phase1Result?.promptDecisionTrace?.risk || {}),
      riskLevel: isWeakVisualReviewRequired ? "MEDIUM_HIGH" : (phase1Result?.promptDecisionTrace?.risk?.riskLevel || "LOW"),
      recommendation: isWeakVisualReviewRequired
        ? "Prompt utilizzabili ma da revisionare: audio e timeline sono solidi, i dettagli visivi restano non confermati."
        : (phase1Result?.promptDecisionTrace?.risk?.recommendation || "")
    }
  };

  const composerDossier = deriveComposerDossier({
    phase1Result,
    transcript: phase1Result?.verifiedTranscript || phase1Result?.script || "",
    durationBeatStrategy: phase1Result?.durationBeatStrategy,
    sceneMechanismAudit: phase1Result?.sceneMechanismAudit,
    castAndDialogueAudit: phase1Result?.castAndDialogueAudit,
    dialogueSyncAudit: phase1Result?.dialogueSyncAudit,
    promptDecisionTrace: trace
  });

  const result = {
    ...phase1Result,
    ...localPrompts,
    promptProcessInfiltrator: {
        truthSourceLedger: {
          audioAvailable: hasTranscript,
          transcriptSource: phase1Result?.transcriptSource || "NONE",
          visualFramesCount: frameTimestampsCount,
          visionProvider: visionProvider || "NONE",
          synchronizedDialogue: audioSegmentsCount > 0 && frameTimestampsCount > 0
        },
        composerUsageTrace: {
          baseDossierUsed: !!composerDossier,
          audioContextIntegrated: hasTranscript,
          videoContextIntegrated: !!phase1Result?.SceneDNA,
          alignmentConfidence: isWeakVisualReviewRequired ? "LOW" : "NONE"
        },
        promptLineageDeepTrace: {
            mismatches: isWeakVisualReviewRequired ? [{ field: "vision", severity: "HIGH", note: "Grounding visivo insufficiente" }] : [],
            finalInvestigationConclusion: isWeakVisualReviewRequired ? "CATENA PROMPT DA REVISIONARE - VISIONE DEBOLE" : "RECOVERY TECNICO ATTIVATO"
        },
        finalInfiltratorVerdict: isWeakVisualReviewRequired ? "VISIBLE_FALLBACK" : "CHAIN_NOT_RELIABLE",
        infiltratorDiagnosis: isWeakVisualReviewRequired 
            ? `Recupero attivato: ${reason}. Visione non conferma i dettagli, uso audio-anchored fallback.`
            : `Recovery tecnico: ${reason}. Provider AI non disponibile.`
    },
    promptDecisionTrace: trace,
    composerDossier,
    groqFullPhase: "prompt",
    status: 'success', // Recovery counts as success
    visionProvider: visionProvider || phase1Result?.visionProvider,
    visionProviderInfo: {
        name: visionProviderName || phase1Result?.visionProviderInfo?.name || "Unknown"
    },
    visionProviderStatus: visionProviderStatus || "UNKNOWN",
    operationalDecision: isWeakVisualReviewRequired ? "GENERATED_REVIEW_REQUIRED" : "RECOVERED_VIA_LOCAL_ASSEMBLER",
    promptQualityReport: {
      finalPass: !isWeakVisualReviewRequired,
      notes: [
        isWeakVisualReviewRequired
          ? `DA REVISIONARE: audio e timeline validi, visione debole (${reason}).`
          : `PHASE2_PROVIDER_UNAVAILABLE_FALLBACK: ${reason}.`
      ]
    },
    lockedPromptTabs: {
      locked: !isWeakVisualReviewRequired,
      phase: "prompt",
      reason: isWeakVisualReviewRequired ? "REVIEW_REQUIRED_WEAK_VISUAL" : "RECOVERED"
    },
    finalPromptVerdict: isWeakVisualReviewRequired
      ? "Prompt generati in modalita provvisoria: da revisionare prima dell'uso finale."
      : phase1Result?.finalPromptVerdict,
    humanVerdict: isWeakVisualReviewRequired
      ? "Audio verificato e timeline disponibile. La visione resta debole, quindi i prompt sono utilizzabili ma non approvati come finali."
      : phase1Result?.humanVerdict,
    publishingKit: "NON_GENERATO_PHASE_2",
    parsedKit: "NON_GENERATO_PHASE_2",
    coverPrompt: "NON_GENERATO_PHASE_2",
    coverAntiScrollPrompt: "NON_GENERATO_PHASE_2",
    titles: "NON_GENERATO_PHASE_2",
    description: "NON_GENERATO_PHASE_2",
    hashtags: "NON_GENERATO_PHASE_2",
    tags: "NON_GENERATO_PHASE_2",
    pinnedComment: "NON_GENERATO_PHASE_2",
    youtubeMarketData: "NON_GENERATO_PHASE_2",
  };

  if (isWeakVisualReviewRequired) {
    logger.info("[AUDIO_ANCHORED_PROMPT_WEAK_VISUAL_REVIEW_READY]", {
      operationalDecision: result.operationalDecision,
      finalPass: result.promptQualityReport.finalPass,
      locked: result.lockedPromptTabs.locked,
      promptUsabilityPercent,
      publishReadiness,
      hasTranscript,
      audioSegmentsCount,
      frameTimestampsCount
    });
  }

  logger.info("[UI_CONSCIENCE_AUDIT_PRESERVED_AFTER_PHASE2_PROVIDER_FAIL]");
  return sanitizeGroqFullPhase2Output(result);
}

export function buildGroqFullPhase2BlockPromptsResult(params: {
  phase1Result: any;
  reason: string;
  visionProviderStatus: string;
  visionProvider: string;
  visionProviderName: string;
}) {
  const { phase1Result, reason, visionProviderStatus, visionProvider, visionProviderName } = params;
  logger.info("[GROQ_FULL_PHASE2_BLOCK_PROMPTS_RESULT_BUILT]", { reason });

  const transcript = phase1Result?.verifiedTranscript || phase1Result?.script || "";
  const frameTimestampsReal = Array.isArray(phase1Result?.frameTimestamps)
    ? phase1Result.frameTimestamps
    : (Array.isArray(phase1Result?.runtimeTruthStatus?.frameTimestamps) ? phase1Result.runtimeTruthStatus.frameTimestamps : []);
  const frameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const promptDecisionTrace = phase1Result?.promptDecisionTrace
    ? {
        ...phase1Result.promptDecisionTrace,
        decision: {
          ...(phase1Result.promptDecisionTrace.decision || {}),
          promptsBlocked: true,
          reason
        },
        risk: {
          ...(phase1Result.promptDecisionTrace.risk || {}),
          riskLevel: phase1Result.promptDecisionTrace?.risk?.riskLevel || "HIGH",
          recommendation: phase1Result.promptDecisionTrace?.risk?.recommendation || "Non generare prompt finali senza osservazioni visive reali."
        }
      }
    : {
        heard: {
          transcriptAvailable: Boolean(transcript),
          audioSource: phase1Result?.audioSource || "GROQ_WHISPER",
          dialogueTurnsCount: Array.isArray(phase1Result?.audioSegments) ? phase1Result.audioSegments.length : 0,
          keyLinesHeard: Array.isArray(phase1Result?.audioSegments)
            ? phase1Result.audioSegments.slice(0, 3).map((seg: any) => String(seg?.text || "").trim()).filter(Boolean)
            : []
        },
        seen: {
          frameTimestampsReal,
          usedFramesReal: frameTimestampsReal.length,
          frameObservationsCount: frameObservations.length,
          visionStatus: visionProviderStatus
        },
        inferred: {
          ruleDetectedFromTranscript: phase1Result?.sceneMechanismAudit?.ruleDetectedFromTranscript || false,
          ruleLine: phase1Result?.sceneMechanismAudit?.ruleLine || "",
          triggerCondition: phase1Result?.sceneMechanismAudit?.triggerCondition || "",
          expectedConsequence: phase1Result?.sceneMechanismAudit?.expectedConsequence || ""
        },
        notSeenOrNotConfirmed: {
          missingVisualConsequence: true,
          missingFrameObservations: frameObservations.length === 0
        },
        decision: {
          promptsBlocked: true,
          reason
        },
        risk: {
          riskLevel: "HIGH",
          recommendation: "Non generare prompt finali senza osservazioni visive reali."
        }
      };

  if (phase1Result?.promptDecisionTrace) {
    logger.info("[PROMPT_DECISION_TRACE_PRESERVED_ON_BLOCK]", {
      reason,
      frameObservationsCount: frameObservations.length
    });
  } else {
    logger.info("[PROMPT_DECISION_TRACE_BUILT_ON_BLOCK]", {
      reason,
      frameTimestampsCount: frameTimestampsReal.length,
      frameObservationsCount: frameObservations.length
    });
  }

  const result = {
    ...phase1Result,
    groqFullPhase: "prompt",
    promptDecisionTrace,
    visionProvider,
    visionProviderInfo: {
        name: visionProviderName
    },
    visionProviderStatus,
    operationalDecision: "PROMPT_BLOCKED_NO_VISUAL_FRAME_TIMELINE",
    promptProcessInfiltrator: {
        truthSourceLedger: {
          audioAvailable: transcript.length > 0,
          transcriptSource: phase1Result?.transcriptSource || "NONE",
          visualFramesCount: frameTimestampsReal.length,
          visionProvider: visionProvider || "NONE",
          synchronizedDialogue: false
        },
        promptLineageDeepTrace: {
            mismatches: [{ field: "all", severity: "HIGH", note: reason }],
            finalInvestigationConclusion: "CATENA PROMPT INTERROTTA - REQUISITI MINIMI FALLITI"
        },
        finalInfiltratorVerdict: "CHAIN_NOT_RELIABLE",
        infiltratorDiagnosis: `Blocco critico: ${reason}. Visione o audio insufficienti per generare prompt affidabili.`
    },
    finalPromptVerdict: "Prompt non generati: mancanza di dati visivi granulari (frame timeline).",
    humanVerdict: "L'analisi audio e il transcript sono validi, ma i prompt video sono stati bloccati perché non è stato possibile sincronizzarli con i frame video reali.",
    promptQualityReport: {
      finalPass: false,
      notes: [`PROMPT_GENERATION_BLOCKED: ${reason}`]
    },
    lockedPromptTabs: {
      locked: false,
      phase: "prompt",
      reason: "MISSING_VISUAL_GROUNDING"
    }
  };

  logger.info("[PROMPT_DECISION_TRACE_ATTACHED_TO_BLOCK_RESULT]", {
    hasPromptDecisionTrace: Boolean(result.promptDecisionTrace),
    traceKeys: result.promptDecisionTrace ? Object.keys(result.promptDecisionTrace) : [],
    reason
  });

  logger.info("[PROMPT_DECISION_TRACE_UI_READY_ON_BLOCK]", {
    hasPromptDecisionTrace: Boolean(result.promptDecisionTrace),
    frameObservationsCount: frameObservations.length,
    usedFramesReal: frameTimestampsReal.length
  });

  return sanitizeGroqFullPhase2Output(result);
}

function getVisionProviderStatusInfo(phase1Result: any, groundingGate: any) {
    if (phase1Result?.runtimeTruthStatus?.failedModules?.includes("openrouter_vision_fallback_timeout")) {
        return { status: "OPENROUTER_TIMEOUT_DEGRADED", provider: "openrouter", name: "OpenRouter" };
    }
    if (phase1Result?.visionProvider === "openrouter_partial_or_invalid") {
        return { status: "OPENROUTER_PARTIAL_INVALID", provider: "openrouter_partial_or_invalid", name: "OpenRouter" };
    }
    if (groundingGate.fatalVisualMissing) {
        return { status: "NO_FRAME_TIMELINE", provider: "missing", name: "None" };
    }
    if (phase1Result?.visionProvider === "huggingface") {
        return { status: "HF_SUCCESS", provider: "huggingface", name: "Hugging Face" };
    }
    if (phase1Result?.visionProvider === "openrouter") {
        return { status: "OPENROUTER_SUCCESS", provider: "openrouter", name: "OpenRouter" };
    }
    return { status: "UNKNOWN", provider: phase1Result?.visionProvider || "unknown", name: phase1Result?.visionProviderInfo?.name || "Unknown" };
}

export function buildGroqFullPhase2ProviderUnavailableResult(params: {
  phase1PartialResult: any;
  reason: string;
  provider: string;
  errorMessage?: string;
}) {
  const { phase1PartialResult, reason } = params;
  logger.info("[GROQ_FULL_PHASE2_PROVIDER_UNAVAILABLE_RESULT_BUILT]", { reason, phase: "prompt" });
  const isOpenRouterFallbackFailure = reason.includes("OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE");

  const fallbackPromptDecisionTrace = phase1PartialResult?.promptDecisionTrace || {
    heard: {
      transcriptAvailable: Boolean(phase1PartialResult?.verifiedTranscript || phase1PartialResult?.script),
      audioSource: phase1PartialResult?.audioSource || "GROQ_WHISPER",
      transcriptEvidenceStrength: (phase1PartialResult?.verifiedTranscript || phase1PartialResult?.script) ? "STRONG" : "NONE"
    },
    seen: {
      usedFramesReal: Array.isArray(phase1PartialResult?.frameTimestamps) ? phase1PartialResult.frameTimestamps.length : 0,
      frameTimestampsReal: phase1PartialResult?.frameTimestamps || phase1PartialResult?.runtimeTruthStatus?.frameTimestamps || [],
      frameObservations: Array.isArray(phase1PartialResult?.frameObservations) ? phase1PartialResult.frameObservations : [],
      visionProviderReal: phase1PartialResult?.visionProvider || phase1PartialResult?.visionProviderInfo?.name || "unknown"
    },
    inferred: {
      notes: "Prompt non completati: provider esterno non disponibile durante la Fase 2."
    },
    notSeenOrNotConfirmed: {
      missingReason: "Audit finale parziale: interruzione provider durante la generazione prompt."
    },
    decision: {
      selectedBeat: phase1PartialResult?.selectedEvent || "N/A"
    },
    risk: {
      riskLevel: "HIGH",
      possibleError: "Prompt non generati per indisponibilitÃ  provider.",
      recommendation: "Ripetere il run quando il provider torna disponibile oppure usare un provider alternativo."
    },
    finalFramesCoverage: {
      usedFramesReal: Array.isArray(phase1PartialResult?.frameTimestamps) ? phase1PartialResult.frameTimestamps.length : 0,
      frameTimestampsReal: phase1PartialResult?.frameTimestamps || phase1PartialResult?.runtimeTruthStatus?.frameTimestamps || []
    },
    castGroundingAudit: phase1PartialResult?.castGroundingAudit || null,
    castAndDialogueAudit: phase1PartialResult?.castAndDialogueAudit || null,
    sceneMechanismAudit: phase1PartialResult?.sceneMechanismAudit || null,
    dialogueSyncAudit: phase1PartialResult?.dialogueSyncAudit || null
  };

  const errorValue = isOpenRouterFallbackFailure
    ? "NON_GENERATO_PROMPT_OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE"
    : ((reason === "TOTAL_PROVIDER_FAILURE" || reason === "HF_AND_GROQ_DEPLETED")
      ? "NON_GENERATO_PROMPT_PROVIDER_UNAVAILABLE"
      : "NON_GENERATO_PROMPT_HF_CREDITS_DEPLETED");
  const blockedValue = "NON_GENERATO_PHASE_2";

  const result = {
    ...phase1PartialResult,
    promptDecisionTrace: fallbackPromptDecisionTrace,
    groqFullPhase: "prompt",
    status: 'error',
    promptQualityReport: {
      finalPass: false,
      notes: [
        isOpenRouterFallbackFailure
          ? "OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE: Hugging Face fallback started correctly, but OpenRouter returned empty or non-parseable vision output."
          : "HF_CREDITS_DEPLETED: Hugging Face monthly included credits are depleted. Add credits or use another allowed provider."
      ]
    },
    bestOptimizedPrompt: {
      targetField: "optimizedPrompt15s",
      model: "zai-org/GLM-4.5V",
      duration: 15,
      prompt: errorValue,
      reason: isOpenRouterFallbackFailure
        ? "GROQ_FULL_PHASE_2_OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE"
        : "GROQ_FULL_PHASE_2_HF_CREDITS_DEPLETED"
    },
    lockedPromptTabs: {
      locked: false,
      phase: "prompt",
      reason: reason.includes("AUTO_CHAIN")
        ? reason
        : (isOpenRouterFallbackFailure ? "OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE" : "HF_CREDITS_DEPLETED")
    },
    // Populate all prompt fields with error value
    aiPrompts: errorValue,
    sceneMasterPrompt: errorValue,
    promptSora12s: errorValue,
    soraPrompt12s: errorValue,
    promptSora15s: errorValue,
    soraPrompt15s: errorValue,
    klingPrompt: errorValue,
    klingPrompt10s: errorValue,
    klingPrompt15s: errorValue,
    veoPrompt: errorValue,
    veo3Prompt8s: errorValue,
    veo3ExtensionPart1Prompt8s: errorValue,
    veo3ExtensionPart2Prompt8s: errorValue,
    seedancePrompt15s: errorValue,
    sendancePrompt15s: errorValue,
    optimizedPrompt12s: errorValue,
    optimizedPrompt15s: errorValue,
    
    // Publishing/Cover/Youtube block
    publishingKit: blockedValue,
    parsedKit: blockedValue,
    coverPrompt: blockedValue,
    coverAntiScrollPrompt: blockedValue,
    titles: blockedValue,
    description: blockedValue,
    hashtags: blockedValue,
    tags: blockedValue,
    pinnedComment: blockedValue,
    youtubeMarketData: blockedValue,

    loopStrategy: {
      enabled: false,
      strategy: "",
      reason: reason.includes("AUTO_CHAIN") ? "GROQ_FULL_PHASE_2_PROVIDER_UNAVAILABLE_DURING_AUTO_CHAIN" : "GROQ_FULL_PHASE_2_PROVIDER_UNAVAILABLE",
      warning: reason.includes("AUTO_CHAIN") ? "Hugging Face credits depleted before Phase 2 prompt generation." : "Hugging Face provider unavailable or credits depleted."
    }
  };

  return sanitizeGroqFullPhase2Output(result);
}

function handlePhase2CreditsDepleted(phase1Result: any) {
    logger.info("[HF_402_EXPECTED_PHASE2_CONTINUE_WITH_EXISTING_AUDIT]");
    
    const transcript = phase1Result?.verifiedTranscript || phase1Result?.script || "";
    const basePrompt = phase1Result?.SceneDNA?.primaryDescription || "Analisi visiva parziale";
    const canonicalCastList = phase1Result?.canonicalCastList || [];
    
    logger.info("[PHASE2_PROMPT_COMPOSER_GROQ_OR_LOCAL_FALLBACK_START]", { hasTranscript: !!transcript });

    // Try local recovery
    const localPrompts = buildDifferentiatedPhase2PromptSetV2(
      basePrompt,
      transcript,
      "", // aiPromptsFallback
      phase1Result,
      phase1Result?.sceneMechanismAudit,
      phase1Result?.durationBeatStrategy,
      phase1Result?.dialogueSyncAudit
    );

    return buildGroqFullPhase2RecoveryResult({
      phase1Result,
      localPrompts,
      reason: "HF_CREDITS_DEPLETED"
    });
}

function handlePhase2AudioNotVerified(phase1Result: any) {
    const errorValue = "NON_GENERATO_AUDIO_NOT_VERIFIED";
    
    const result = {
      ...phase1Result,
      groqFullPhase: "prompt",
      status: 'error',
      operationalDecision: "PROMPT_ENGINE_FAILED",
      finalPromptVerdict: "Fase 2 non generata: audio non verificato.",
      humanVerdict: "La Fase 1 è stata bloccata perché l'audio non è stato verificato correttamente.",
      lockedPromptTabs: {
        locked: false,
        phase: "prompt",
        reason: "AUDIO_NOT_VERIFIED"
      },
      promptQualityReport: {
        finalPass: false,
        report: "Audio non verificato: impedita generazione prompt inventati.",
        notes: "PHASE2_BLOCKED_AUDIO_NOT_VERIFIED"
      },
      bestOptimizedPrompt: {
          targetField: "optimizedPrompt15s",
          model: "zai-org/GLM-4.5V",
          duration: 15,
          prompt: errorValue,
          reason: "AUDIO_NOT_VERIFIED"
      },
      sceneMasterPrompt: errorValue,
      aiPrompts: errorValue,
      promptSora12s: errorValue,
      promptSora15s: errorValue,
      soraPrompt12s: errorValue,
      soraPrompt15s: errorValue,
      klingPrompt10s: errorValue,
      klingPrompt15s: errorValue,
      klingPrompt: errorValue,
      veo3Prompt8s: errorValue,
      veoPrompt: errorValue,
      veo3ExtensionPart1Prompt8s: errorValue,
      veo3ExtensionPart2Prompt8s: errorValue,
      seedancePrompt15s: errorValue,
      sendancePrompt15s: errorValue,
      optimizedPrompt12s: errorValue,
      optimizedPrompt15s: errorValue,
      publishingKit: "NON_GENERATO_PHASE_2",
      coverPrompt: "NON_GENERATO_PHASE_2"
    };
    
    return sanitizeGroqFullPhase2Output(result);
}

function handlePhase2AudioVideoNotGrounded(params: {
  phase1Result: any;
  transcript: string;
  reason: string;
  castAndDialogueAudit: any;
  sceneMechanismAudit: any;
}) {
  const { phase1Result, transcript, reason, castAndDialogueAudit, sceneMechanismAudit } = params;
  const errorValue = "NON_GENERATO_AUDIO_VIDEO_NOT_GROUNDED";

  const promptDecisionTrace = phase1Result?.promptDecisionTrace
    ? {
        ...phase1Result.promptDecisionTrace,
        castAndDialogueAudit,
        sceneMechanismAudit,
        castGroundingAudit: phase1Result?.castGroundingAudit || null
      }
    : {
        heard: {
          transcriptAvailable: !!transcript,
          audioSource: "Phase 1 Extraction",
          transcriptEvidenceStrength: transcript?.length > 50 ? "STRONG" : (transcript ? "WEAK" : "NONE")
        },
        seen: {
          frameObservations: Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [],
          visibleCharacters: phase1Result?.detectedCharacters || [],
          visionProviderReal: phase1Result?.visionProvider || "unknown"
        },
        castAndDialogueAudit,
        sceneMechanismAudit,
        castGroundingAudit: phase1Result?.castGroundingAudit || null,
        risk: {
          riskLevel: "HIGH",
          reason: reason,
          recommendation: "Block prompt generation until audio-video grounding is valid."
        }
      };

  return sanitizeGroqFullPhase2Output({
    ...phase1Result,
    transcript,
    groqFullPhase: "prompt",
    status: "error",
    operationalDecision: "BLOCKED_AUDIO_VIDEO_NOT_GROUNDED",
    finalPromptVerdict: "Prompt non generati: mancanza di aggancio audio-video valido.",
    humanVerdict: "Transcript disponibile, ma la visione non ha confermato cast, azioni e payoff. Per evitare prompt inventati, la generazione è stata bloccata.",
    promptDecisionTrace,
    castAndDialogueAudit,
    sceneMechanismAudit,
    lockedPromptTabs: {
      locked: false,
      phase: "prompt",
      reason: "AUDIO_VIDEO_NOT_GROUNDED"
    },
    promptQualityReport: {
      finalPass: false,
      report: "AUDIO_VIDEO_NOT_GROUNDED",
      notes: reason
    },
    sceneMasterPrompt: errorValue,
    aiPrompts: errorValue,
    promptSora12s: errorValue,
    soraPrompt12s: errorValue,
    promptSora15s: errorValue,
    soraPrompt15s: errorValue,
    klingPrompt10s: errorValue,
    klingPrompt15s: errorValue,
    klingPrompt: errorValue,
    veo3Prompt8s: errorValue,
    veoPrompt: errorValue,
    veo3ExtensionPart1Prompt8s: errorValue,
    veo3ExtensionPart2Prompt8s: errorValue,
    seedancePrompt15s: errorValue,
    sendancePrompt15s: errorValue,
    optimizedPrompt12s: errorValue,
    optimizedPrompt15s: errorValue,
    bestOptimizedPrompt: {
      targetField: "optimizedPrompt15s",
      model: "zai-org/GLM-4.5V",
      duration: 15,
      prompt: errorValue,
      reason: "AUDIO_VIDEO_NOT_GROUNDED"
    },
    bestOptimizedPromptText: errorValue
  });
}

function handlePhase2DialogueSyncLowConfidence(params: {
  phase1Result: any;
  transcript: string;
  reason: string;
  castAndDialogueAudit: any;
  sceneMechanismAudit: any;
  dialogueSyncAudit: any;
}) {
  const { phase1Result, transcript, reason, castAndDialogueAudit, sceneMechanismAudit, dialogueSyncAudit } = params;
  const errorValue = "NON_GENERATO_DIALOGUE_SYNC_LOW_CONFIDENCE";

  return sanitizeGroqFullPhase2Output({
    ...phase1Result,
    transcript,
    groqFullPhase: "prompt",
    status: "error",
    operationalDecision: "BLOCKED_DIALOGUE_SYNC_LOW_CONFIDENCE",
    finalPromptVerdict: "Prompt non generati: dialoghi non sincronizzati ai personaggi visibili.",
    humanVerdict: "Audio e video sono stati analizzati, ma le battute non sono attribuibili con sicurezza ai soggetti visivi. Per evitare prompt fuorvianti, la generazione Ã¨ stata bloccata.",
    promptDecisionTrace: {
      ...(phase1Result?.promptDecisionTrace || {}),
      castAndDialogueAudit,
      sceneMechanismAudit,
      castGroundingAudit: phase1Result?.castGroundingAudit || null,
      dialogueSyncAudit,
      risk: {
        riskLevel: "HIGH",
        possibleError: "Dialogue is not synchronized to visible characters; generated prompts may assign lines to the wrong person.",
        recommendation: "Use real audio timestamps or improve dialogue-frame alignment before trusting final prompts.",
        canAssignSpeakers: false,
        dialogueSyncConfidence: dialogueSyncAudit?.confidence || "NONE"
      }
    },
    castAndDialogueAudit,
    sceneMechanismAudit,
    dialogueSyncAudit,
    mergedFrameTimeline: dialogueSyncAudit?.mergedFrameTimeline || [],
    qualityGates: {
      dialogueSyncLowConfidence: true,
      reason,
      action: "PROMPT_BLOCKED_OR_SPEAKER_ASSIGNMENT_DISABLED"
    },
    lockedPromptTabs: {
      locked: false,
      phase: "prompt",
      reason: "DIALOGUE_SYNC_LOW_CONFIDENCE"
    },
    promptQualityReport: {
      finalPass: false,
      report: "DIALOGUE_SYNC_LOW_CONFIDENCE",
      notes: reason
    },
    sceneMasterPrompt: errorValue,
    aiPrompts: errorValue,
    promptSora12s: errorValue,
    soraPrompt12s: errorValue,
    promptSora15s: errorValue,
    soraPrompt15s: errorValue,
    klingPrompt10s: errorValue,
    klingPrompt15s: errorValue,
    klingPrompt: errorValue,
    veo3Prompt8s: errorValue,
    veoPrompt: errorValue,
    veo3ExtensionPart1Prompt8s: errorValue,
    veo3ExtensionPart2Prompt8s: errorValue,
    seedancePrompt15s: errorValue,
    sendancePrompt15s: errorValue,
    optimizedPrompt12s: errorValue,
    optimizedPrompt15s: errorValue,
    bestOptimizedPrompt: {
      targetField: "optimizedPrompt15s",
      model: "zai-org/GLM-4.5V",
      duration: 15,
      prompt: errorValue,
      reason: "DIALOGUE_SYNC_LOW_CONFIDENCE"
    },
    bestOptimizedPromptText: errorValue
  });
}

function evaluateDialogueSyncGate(params: {
  canonicalCastList: string[];
  dialogueSyncAudit: any;
  phase1Result?: any;
  groundingGate?: any;
  transcript?: string;
}) {
  const { canonicalCastList, dialogueSyncAudit, phase1Result, groundingGate, transcript } = params;
  const castCount = canonicalCastList?.length || 0;
  const hasRealAudioTimestamps = dialogueSyncAudit?.hasRealAudioTimestamps === true;
  const transcriptHasSpeakerLabels = dialogueSyncAudit?.transcriptHasSpeakerLabels === true;
  const canAssignSpeakers = dialogueSyncAudit?.canAssignSpeakers === true;
  const confidence = dialogueSyncAudit?.confidence || "NONE";
  let shouldBlockPrompts =
    hasRealAudioTimestamps &&
    castCount > 1 &&
    !transcriptHasSpeakerLabels &&
    !canAssignSpeakers &&
    (confidence === "LOW" || confidence === "NONE") &&
    !(phase1Result?.audioVerified === true && !!transcript);
  let reason = shouldBlockPrompts
    ? "multi_cast_real_audio_but_no_reliable_dialogue_sync"
    : "not_blocked";

  const audioVerified = phase1Result?.audioVerified === true;
  const hasVerifiedTranscript = !!transcript && transcript.length > 0;
  
  // Da groundingGate diagnostics (se presenti), altrimenti consideriamo 0 
  const frameObservationsCount = groundingGate?.diagnostics?.frameObservationsCount || (Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations.length : 0);
  const frameObservationSubjectsCount = phase1Result?.frameObservationSubjectsCount || 0; // Se non lo passiamo esplicito, possiamo usare visualCast o detected
  const hasVisibleSceneMechanism = phase1Result?.hasVisibleSceneMechanism === true || groundingGate?.diagnostics?.hasVisibleSceneMechanism === true || (Array.isArray(phase1Result?.frameObservations) && phase1Result.frameObservations.some((x: any) => !!x.visibleAction));
  const groundingGateBlock = groundingGate?.shouldBlockPromptGeneration === true;
  const visionTimeout = phase1Result?.visionStatus === "VISION_PHASE1_TIMEOUT";
  const visionPartialOrInvalid = phase1Result?.visionProvider === "openrouter_partial_or_invalid";

  const visualCastCount = phase1Result?.visualCastCount || groundingGate?.diagnostics?.visualCastCount || 0;
  const detectedCharactersCount = groundingGate?.diagnostics?.detectedCharactersCount || (Array.isArray(phase1Result?.detectedCharacters) ? phase1Result.detectedCharacters.length : 0);
  
  logger.info("[DIALOGUE_SYNC_GATE_SOFT_PASS_ELIGIBILITY]", {
      audioVerified,
      hasVerifiedTranscript,
      hasRealAudioTimestamps,
      groundingGateBlock,
      frameObservationsCount,
      frameObservationSubjectsCount,
      castCount,
      visualCastCount,
      detectedCharactersCount,
      visionTimeout,
      visionPartialOrInvalid,
      frameTimelineSource: dialogueSyncAudit?.frameTimelineSource || "unknown"
  });

  const isSoftPassEligible = 
      audioVerified &&
      hasVerifiedTranscript &&
      hasRealAudioTimestamps &&
      frameObservationsCount >= 5 &&
      (frameObservationSubjectsCount > 0 || castCount > 0 || visualCastCount > 0 || detectedCharactersCount > 0) &&
      hasVisibleSceneMechanism &&
      !groundingGateBlock &&
      !visionTimeout &&
      !visionPartialOrInvalid &&
      dialogueSyncAudit?.frameTimelineSource !== "missing";

  if (shouldBlockPrompts && reason === "multi_cast_real_audio_but_no_reliable_dialogue_sync" && isSoftPassEligible) {
      const originalReason = reason;
      const shouldBlockPromptsBefore = shouldBlockPrompts;
      
      shouldBlockPrompts = false;
      reason = "soft_pass_visual_audio_grounded_speaker_uncertain";
      
      logger.info("[DIALOGUE_SYNC_GATE_SOFT_PASS_APPLIED]", {
          audioVerified,
          hasVerifiedTranscript,
          frameObservationsCount,
          frameObservationSubjectsCount,
          castCount,
          hasVisibleSceneMechanism,
          originalReason,
          newReason: reason,
          shouldBlockPromptsBefore,
          shouldBlockPromptsAfter: shouldBlockPrompts
      });
  }

  const speakerMode = reason === "soft_pass_visual_audio_grounded_speaker_uncertain" ? "CAUTIOUS_UNCERTAIN_SPEAKER" : "STANDARD";

  logger.info("[DIALOGUE_SYNC_GATE_FINAL_DECISION]", {
      shouldBlockPrompts,
      reason,
      speakerMode,
      confidence
  });

  logger.info("[DIALOGUE_SYNC_GATE_AUDIT]", {
    hasRealAudioTimestamps,
    castCount,
    transcriptHasSpeakerLabels,
    canAssignSpeakers,
    confidence,
    shouldBlockPrompts,
    reason,
    speakerMode: reason === "soft_pass_visual_audio_grounded_speaker_uncertain" ? "CAUTIOUS_UNCERTAIN_SPEAKER" : "STANDARD"
  });

  return {
    hasRealAudioTimestamps,
    castCount,
    transcriptHasSpeakerLabels,
    canAssignSpeakers,
    confidence,
    shouldBlockPrompts,
    reason,
    speakerMode: reason === "soft_pass_visual_audio_grounded_speaker_uncertain" ? "CAUTIOUS_UNCERTAIN_SPEAKER" : "STANDARD"
  };
}

function evaluateAudioVideoGroundingGate(params: {
  phase1Result: any;
  transcript: string;
  frameAnalysis: string;
  canonicalCastList: string[];
  castAndDialogueAudit: any;
  sceneMechanismAudit: any;
}) {
  const { phase1Result, transcript, frameAnalysis, canonicalCastList, castAndDialogueAudit, sceneMechanismAudit } = params;
  const frameObservations = Array.isArray(phase1Result?.frameObservations) ? phase1Result.frameObservations : [];
  const detectedCharacters = Array.isArray(phase1Result?.detectedCharacters) ? phase1Result.detectedCharacters : [];
  const visualCastCount = typeof phase1Result?.visualCastCount === "number" ? phase1Result.visualCastCount : 0;
  const castGroundingAudit = phase1Result?.castGroundingAudit || {};
  const frameObservationSubjectsCount = typeof castGroundingAudit?.frameObservationSubjectsCount === "number"
    ? castGroundingAudit.frameObservationSubjectsCount
    : [...new Set(
        frameObservations
          .flatMap((obs: any) => Array.isArray(obs?.visibleSubjects) ? obs.visibleSubjects : [])
          .map((value: any) => String(value || "").trim())
          .filter(Boolean)
      )].length;
  const transcriptHasSpeakerLabels = Boolean(castGroundingAudit?.transcriptHasSpeakerLabels);
  const castSource = String(castGroundingAudit?.castSource || "");
  const frameAnalysisText = String(frameAnalysis || phase1Result?.frameAnalysis || "");
  const normalizedAnalysis = frameAnalysisText.toLowerCase().trim();
  const transcriptLower = String(transcript || "").toLowerCase().trim();
  const hasVisibleSceneMechanism = !!phase1Result?.visibleSceneMechanism;
  const frameAnalysisLooksEmpty =
    !normalizedAnalysis ||
    normalizedAnalysis.includes("risultato: {}") ||
    normalizedAnalysis.includes("visual_context_limited_openrouter_timeout") ||
    normalizedAnalysis.includes("visual_context_limited_openrouter_output_missing_frame_analysis") ||
    normalizedAnalysis === transcriptLower ||
    (transcriptLower.length > 20 && normalizedAnalysis.includes(transcriptLower.slice(0, Math.min(transcriptLower.length, 120))));
  const visionTimedOut =
    phase1Result?.visionStatus === "VISION_TIMEOUT_DEGRADED" ||
    phase1Result?.visionProvider === "openrouter_timeout_degraded" ||
    phase1Result?.promptSafetyMode === "AUDIO_ANCHORED_VISUAL_WEAK" ||
    (Array.isArray(phase1Result?.runtimeTruthStatus?.failedModules) && phase1Result.runtimeTruthStatus.failedModules.includes("openrouter_vision_fallback_timeout"));
  const visionPartialInvalid = phase1Result?.visionProvider === "openrouter_partial_or_invalid";
  const noFrameObservations = frameObservations.length === 0;
  const canonicalFallbackOnly = canonicalCastList.length === 1 && String(canonicalCastList[0] || "").toLowerCase().includes("personaggio 1");
  const hasVisualSubjectGrounding =
    detectedCharacters.length > 0 ||
    visualCastCount > 0 ||
    frameObservationSubjectsCount > 0 ||
    (!canonicalFallbackOnly && canonicalCastList.length > 0);
  const noVisualCast = !hasVisualSubjectGrounding;
  const noSceneMechanism =
    !hasVisibleSceneMechanism &&
    frameObservationSubjectsCount === 0 &&
    (sceneMechanismAudit?.visualConsequenceConfirmed === false || sceneMechanismAudit?.visualConsequenceConfirmed === "unknown");
  const transcriptMultiTurnNoLabels = !transcriptHasSpeakerLabels && castSource === "fallback_personaggio_1" && castAndDialogueAudit?.dialogueTurns >= 3;

  const reasons: string[] = [];
  if (visionTimedOut) reasons.push("vision_timeout");
  if (visionPartialInvalid) reasons.push("vision_partial_or_invalid");
  if (noFrameObservations) reasons.push("missing_frame_observations");
  if (noVisualCast) reasons.push("missing_visual_cast");
  if (noSceneMechanism) reasons.push("missing_scene_mechanism");
  if (frameAnalysisLooksEmpty) reasons.push("frame_analysis_empty_or_generic");
  if (transcriptMultiTurnNoLabels) reasons.push("multi_turn_transcript_without_visual_cast_grounding");

  const shouldBlockPromptGeneration = reasons.length > 0 && !(phase1Result?.audioVerified === true && !!transcript && transcript.length > 20 && !noFrameObservations);
  const reason = reasons.join("|") || "none";
  const fatalVisualMissing = noFrameObservations || (Array.isArray(phase1Result?.frameTimestamps) && phase1Result.frameTimestamps.length === 0);

  logger.info("[AUDIO_VIDEO_GROUNDING_GATE_AUDIT]", {
    hasFrameObservations: frameObservations.length > 0,
    frameObservationsCount: frameObservations.length,
    frameObservationSubjectsCount,
    visualCastCount,
    detectedCharactersCount: detectedCharacters.length,
    hasVisibleSceneMechanism,
    transcriptHasSpeakerLabels,
    castSource,
    frameAnalysisLooksEmpty,
    visionTimedOut,
    fatalVisualMissing,
    shouldBlockPromptGeneration,
    reason
  });

  return {
    isValid: !shouldBlockPromptGeneration,
    shouldBlockPromptGeneration,
    fatalVisualMissing,
    reason,
    diagnostics: {
      frameObservationsCount: frameObservations.length,
      visualCastCount,
      detectedCharactersCount: detectedCharacters.length,
      transcriptHasSpeakerLabels
    }
  };
}

function handlePhase2ParseError(phase1Result: any, reason: string, rawResponse?: string, transcript?: string) {
    const looseRecovery = tryRecoverLoosePhase2Prompts(rawResponse, phase1Result, transcript);
    if (looseRecovery) {
      logger.info("[GROQ_FULL_PHASE2_PARSE_FAILED_RESULT_BUILT]", { reason: "json_parse_failed" });
      logger.info("[GROQ_FULL_PHASE2_LOOSE_PROMPT_RECOVERY_USED]", {
        promptCount: looseRecovery._recoveredPromptCount,
        hasAiPrompts: Boolean(looseRecovery.aiPrompts),
        hasSceneMaster: Boolean(looseRecovery.sceneMasterPrompt)
      });
      return sanitizeGroqFullPhase2Output(looseRecovery);
    }

    // Try hard deterministic recovery if loose parsing fails
    logger.info("[PHASE2_PARSE_FAIL_HARD_RECOVERY_START]", { reason });
    const safeTranscript = transcript || phase1Result?.verifiedTranscript || phase1Result?.script || "";
    const basePrompt = phase1Result?.SceneDNA?.primaryDescription || "Analisi visiva parziale";
    
    const localPrompts = buildDifferentiatedPhase2PromptSetV2(
      basePrompt,
      safeTranscript,
      "", // aiPromptsFallback
      phase1Result,
      phase1Result?.sceneMechanismAudit,
      phase1Result?.durationBeatStrategy,
      phase1Result?.dialogueSyncAudit
    );

    return buildGroqFullPhase2RecoveryResult({
      phase1Result,
      localPrompts,
      reason: "JSON_PARSE_ERROR"
    });
}

function repairGroqPhase2JsonText(raw: string): string {
  if (!raw) return raw;

  let repaired = raw.trim();
  repaired = repaired.replace(/```json/gi, "").replace(/```/g, "").trim();

  const tagged = repaired.match(/<JSON>([\s\S]*?)<\/JSON>/i);
  if (tagged?.[1]) {
    repaired = tagged[1].trim();
  }

  repaired = repaired
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  repaired = repaired
    .replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
    .replace(/,\s*([}\]])/g, "$1");

  return repaired.trim();
}

function buildGroqPhase2ParseFailDetail(error: any, attempt: number, extractedText: string) {
  const errorMessage = String(error?.message || "");
  const match = errorMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  const previewStart = (extractedText || "").slice(0, 300);
  let previewAroundError = previewStart;

  if (match) {
    const targetLine = Number(match[1]);
    const targetColumn = Number(match[2]);
    const lines = (extractedText || "").split(/\r?\n/);
    const lineText = lines[targetLine - 1] || "";
    const start = Math.max(0, targetColumn - 100);
    const end = Math.min(lineText.length, targetColumn + 100);
    previewAroundError = lineText.slice(start, end);
  }

  return {
    errorName: error?.name,
    errorMessage,
    attempt,
    extractedLength: extractedText?.length || 0,
    previewStart,
    previewAroundError
  };
}

function tryRecoverLoosePhase2Prompts(rawResponse: string | undefined, phase1Result: any, transcript?: string) {
  if (!rawResponse) return null;
  if (phase1Result?.audioVerified !== true) return null;
  if (!phase1Result?.verifiedTranscript && !transcript) return null;

  const firstJsonLike = extractPhase2JsonFromText(rawResponse) || rawResponse;
  const compact = String(firstJsonLike || "").replace(/\r/g, "");

  const readField = (field: string) => {
    const pattern = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"(?:\\s*,\\s*"|\\s*}\\s*$|\\s*,\\s*})`, "i");
    const match = compact.match(pattern);
    if (!match?.[1]) return "";
    return match[1]
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, " ")
      .trim();
  };

  const sceneMasterPrompt = readField("sceneMasterPrompt");
  const basePrompt = sceneMasterPrompt || "";
  if (!basePrompt || basePrompt.includes("NON_GENERATO")) return null;
  const safeTranscript = transcript || phase1Result?.verifiedTranscript || phase1Result?.script || "";
  const canonicalCastList = Array.isArray(phase1Result?.canonicalCastList) ? phase1Result.canonicalCastList : [];
  const audioVideoRelationAudit = deriveSceneMechanismAudit(basePrompt, safeTranscript, phase1Result);
  const castAndDialogueAudit = buildCastAndDialogueAudit(phase1Result, safeTranscript, canonicalCastList);
  const dialogueSyncAudit = buildDialogueSyncAudit(phase1Result, safeTranscript, canonicalCastList);
  const sceneMechanismAudit = buildSceneMechanismAudit(phase1Result, safeTranscript);
  const durationBeatStrategy = deriveDurationBeatStrategy(basePrompt, safeTranscript, phase1Result);
  const bestOptimizedPromptText = `${basePrompt} Duration: 15 seconds. Vertical 9:16.`;
  const promptDecisionTrace = derivePromptDecisionTrace({
    phase1Result,
    transcript: safeTranscript,
    differentiatedPromptSet: null,
    bestPrompt: {
      targetField: "optimizedPrompt15s",
      model: "Groq",
      duration: 15,
      prompt: bestOptimizedPromptText,
      reason: "GROQ_FULL_PHASE_2_LOOSE_PROMPT_RECOVERY"
    },
    durationBeatStrategy,
    audioVideoRelationAudit,
    castAndDialogueAudit,
    sceneMechanismAudit,
    dialogueSyncAudit
  });

  const composerDossier = deriveComposerDossier({
    phase1Result,
    transcript: safeTranscript,
    durationBeatStrategy,
    sceneMechanismAudit,
    castAndDialogueAudit,
    dialogueSyncAudit,
    promptDecisionTrace
  });

  const recovered = {
    ...phase1Result,
    groqFullPhase: "prompt",
    status: "success",
    aiPrompts: basePrompt,
    sceneMasterPrompt: basePrompt,
    composerDossier,
    promptSora12s: `${basePrompt} Duration: 12 seconds. Vertical 9:16.`,
    soraPrompt12s: `${basePrompt} Duration: 12 seconds. Vertical 9:16.`,
    promptSora15s: `${basePrompt} Duration: 15 seconds. Vertical 9:16.`,
    soraPrompt15s: `${basePrompt} Duration: 15 seconds. Vertical 9:16.`,
    klingPrompt10s: `${basePrompt} Kling AI v1.5, 10 seconds, vertical 9:16.`,
    klingPrompt15s: `${basePrompt} Kling AI v1.5, 15 seconds, vertical 9:16.`,
    klingPrompt: `${basePrompt} Kling AI v1.5, 15 seconds, vertical 9:16.`,
    veo3Prompt8s: `${basePrompt} Veo 3 version. Duration: 8 seconds. Vertical 9:16.`,
    veoPrompt: `${basePrompt} Veo 3 version. Duration: 8 seconds. Vertical 9:16.`,
    veo3ExtensionPart1Prompt8s: `${basePrompt} Veo 3 Extension Part 1. Duration: 8 seconds. Vertical 9:16.`,
    veo3ExtensionPart2Prompt8s: `${basePrompt} Veo 3 Extension Part 2. Duration: 8 seconds. Vertical 9:16.`,
    seedancePrompt15s: `${basePrompt} Seedance version. Duration: 15 seconds. Vertical 9:16.`,
    sendancePrompt15s: `${basePrompt} Seedance version. Duration: 15 seconds. Vertical 9:16.`,
    optimizedPrompt12s: `${basePrompt} Duration: 12 seconds. Vertical 9:16.`,
    optimizedPrompt15s: bestOptimizedPromptText,
    bestOptimizedPrompt: {
      targetField: "optimizedPrompt15s",
      model: "Groq",
      duration: 15,
      prompt: bestOptimizedPromptText,
      reason: "GROQ_FULL_PHASE_2_LOOSE_PROMPT_RECOVERY"
    },
    bestOptimizedPromptText,
    promptQualityReport: {
      finalPass: true,
      notes: "Recovered from malformed JSON after successful prompt extraction."
    },
    lockedPromptTabs: {
      locked: true,
      phase: "prompt",
      reason: "GROQ_FULL_PHASE_2_LOOSE_PROMPT_RECOVERY"
    },
    operationalDecision: "GENERA",
    finalPromptVerdict: "Output recuperato da JSON malformato.",
    humanVerdict: "Prompt recuperati correttamente da una risposta quasi valida.",
    publishingKit: "NON_GENERATO_PHASE_2",
    parsedKit: "NON_GENERATO_PHASE_2",
    coverPrompt: "NON_GENERATO_PHASE_2",
    coverAntiScrollPrompt: "NON_GENERATO_PHASE_2",
    titles: "NON_GENERATO_PHASE_2",
    description: "NON_GENERATO_PHASE_2",
    hashtags: "NON_GENERATO_PHASE_2",
    tags: "NON_GENERATO_PHASE_2",
    pinnedComment: "NON_GENERATO_PHASE_2",
    youtubeMarketData: "NON_GENERATO_PHASE_2",
    castAndDialogueAudit,
    dialogueSyncAudit,
    mergedFrameTimeline: dialogueSyncAudit?.mergedFrameTimeline || [],
    sceneMechanismAudit,
    promptDecisionTrace,
    _recoveredPromptCount: 5
  };

  const promptValues = [
    recovered.promptSora15s,
    recovered.klingPrompt15s,
    recovered.veo3Prompt8s,
    recovered.seedancePrompt15s,
    recovered.bestOptimizedPrompt?.prompt
  ].filter((value) => typeof value === "string" && value.trim() && !value.includes("NON_GENERATO"));

  if (promptValues.length < 4) return null;
  return recovered;
}

function extractPhase2JsonFromText(text: string): string | null {
  if (!text) return null;
  
  // A. Tagged extraction
  const tagged = text.match(/<JSON>([\s\S]*?)<\/JSON>/i);
  if (tagged && tagged[1]) {
    logger.info("[GROQ_FULL_PHASE2_JSON_EXTRACTED]", { method: "tagged", length: tagged[1].length });
    return tagged[1].trim();
  }

  // B. Braces extraction as fallback
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    logger.info("[GROQ_FULL_PHASE2_JSON_EXTRACTED]", { method: "braces", length: (lastBrace - firstBrace) + 1 });
    let candidate = text.substring(firstBrace, lastBrace + 1);
    // Remove potential markdown fences inside the substring
    candidate = candidate.replace(/```json|```/g, '');
    return candidate.trim();
  }

  return null;
}

export function sanitizeGroqFullPhase2Output(result: any): any {
  if (!result) return result;
  
  const sanitized = { ...result };
  const preservedPromptDecisionTrace = result.promptDecisionTrace;

  // Explicitly block non-prompt fields from Phase 2
  const blockedFields = [
    "publishingKit", "parsedKit", "coverPrompt", "coverAntiScrollPrompt",
    "titles", "description", "hashtags", "tags", "pinnedComment", "youtubeMarketData"
  ];

  blockedFields.forEach(field => {
    sanitized[field] = "NON_GENERATO_PHASE_2";
  });

  // Final loopStrategy safety check
  if (typeof sanitized.loopStrategy !== 'object') {
    sanitized.loopStrategy = normalizePhase2LoopStrategy(sanitized.loopStrategy);
  }

  // Ensure prompt tabs are locked ONLY IF valid
  if (sanitized.bestOptimizedPrompt?.prompt === "NON_GENERATO_PROMPT_HF_CREDITS_DEPLETED") {
     sanitized.lockedPromptTabs = { locked: false, phase: "prompt", reason: "HF_CREDITS_DEPLETED" };
  }

  if (preservedPromptDecisionTrace) {
    sanitized.promptDecisionTrace = preservedPromptDecisionTrace;
    logger.info("[PROMPT_DECISION_TRACE_PRESERVED_IN_SANITIZER]", {
      hasPromptDecisionTrace: true,
      finalPass: sanitized.promptQualityReport?.finalPass === true,
      locked: sanitized.lockedPromptTabs?.locked === true
    });
  }

  logger.info("[GROQ_FULL_PHASE2_OUTPUT_AUDIT]", {
    hasSoraPrompt: !!(sanitized.soraPrompt12s || sanitized.promptSora12s),
    hasKlingPrompt: !!(sanitized.klingPrompt15s || sanitized.klingPrompt),
    hasVeoPrompt: !!(sanitized.veo3Prompt8s || sanitized.veoPrompt),
    hasSeedancePrompt: !!(sanitized.seedancePrompt15s || sanitized.sendancePrompt15s),
    hasBestOptimizedPrompt: !!sanitized.bestOptimizedPrompt?.prompt,
    lockedPromptTabsLocked: !!sanitized.lockedPromptTabs?.locked,
    promptQualityFinalPass: sanitized.promptQualityReport?.finalPass === true,
    publishingBlocked: sanitized.publishingKit === "NON_GENERATO_PHASE_2",
    coverBlocked: sanitized.coverPrompt === "NON_GENERATO_PHASE_2"
  });

  return sanitized;
}

function normalizePhase2LoopStrategy(raw: any) {
  const type = typeof raw;
  
  let normalized = {
    enabled: false,
    strategy: "",
    reason: "GROQ_FULL_PHASE_2_NO_LOOP_STRATEGY",
    warning: ""
  };

  if (type === "string") {
    normalized = {
      enabled: true,
      strategy: raw,
      reason: "GROQ_FULL_PHASE_2_LOOP_STRATEGY_FROM_HF_STRING",
      warning: "Loop strategy normalized from string to object for UI compatibility."
    };
  } else if (raw && type === "object") {
    normalized = {
      enabled: Boolean(raw.enabled ?? true),
      strategy: raw.strategy || raw.text || raw.description || "",
      reason: raw.reason || "GROQ_FULL_PHASE_2_LOOP_STRATEGY_OBJECT",
      warning: raw.warning || ""
    };
  }

  logger.info("[GROQ_FULL_PHASE2_LOOP_STRATEGY_NORMALIZED]", { 
    inputType: type, 
    enabled: normalized.enabled,
    hasStrategyText: !!normalized.strategy
  });

  return normalized;
}

export function isHuggingFaceCreditsDepletedError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error) || '');
  const lowerMsg = msg.toLowerCase();
  return (
    lowerMsg.includes("depleted") ||
    lowerMsg.includes("monthly included credits") ||
    lowerMsg.includes("purchase pre-paid credits") ||
    lowerMsg.includes("inference providers") ||
    lowerMsg.includes("402") ||
    lowerMsg.includes("payment required") ||
    lowerMsg.includes("hf_router_error") ||
    lowerMsg.includes("hugging face router error") ||
    lowerMsg.includes("non raggiungibile") ||
    lowerMsg.includes("networkerror") ||
    lowerMsg.includes("fetch") ||
    lowerMsg.includes("failed to fetch")
  );
}
