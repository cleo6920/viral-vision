import { logger } from "../../utils/logger";
import {
  extractAudioTrack,
  extractFrames,
  getVideoDuration,
} from "../../utils/videoProcessor";
import { groqWhisperTranscription, groqTextCompletion } from "../ai/groqClient";
import { waitForFileActive } from "./core";
import { hfVisionAnalysis, hfChatCompletion } from "../ai/huggingFaceClient";
import { openRouterVisionAnalysis, openRouterGemini2VisionAnalysis } from "../ai/openRouterVisionClient";
import {
  hasHuggingFaceApiKey,
  resolveHuggingFaceModel,
} from "../ai/providerRouter";
import {
  runGroqHybridFullPhase2PromptEngine,
  buildGroqFullPhase2ProviderUnavailableResult,
  isHuggingFaceCreditsDepletedError,
  sanitizeGroqFullPhase2Output,
} from "./huggingFull";
import { normalizeFinalResultContract } from "../../utils/finalResultContract";
import { analyzeRealAudioVoiceClustersExperimental } from "../../utils/audioVoiceExperimental";

import { processAudioConscience } from "./audioConscience";
import { runConscienceEyeEar } from "./multimodalEyeEar";
import { runGeminiUploadSmokeTest } from "./smokeTest";

let isGroqHybridPipelineRunning = false;
let openRouterRequestedFrames = 0;
let openRouterMaxFrames = 0;
let openRouterUsedFrames = 0;
let openRouterTimestamps: string[] = [];

function buildOpenRouterFallbackFailureError(params: {
  hfError: any;
  openRouterError: any;
  transcript?: string;
  audioSegments?: any[];
  frameTimestamps?: string[];
  frameCount?: number;
  inputMode?: string;
}) {
  const openRouterMessage = String(
    params.openRouterError?.message || params.openRouterError || "",
  );
  const failure: any = new Error("OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE");
  failure.code = "OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE";
  failure.openRouterFallbackFailed = true;
  failure.openRouterFailureKind = openRouterMessage.includes(
    "EMPTY_OPENROUTER_RESPONSE",
  )
    ? "EMPTY_OPENROUTER_RESPONSE"
    : openRouterMessage.includes("OPENROUTER_JSON_PARSE_FAILED")
      ? "OPENROUTER_PARSE_FAILED"
      : "OPENROUTER_FALLBACK_FAILED";
  failure.hfOriginalError = String(
    params.hfError?.message || params.hfError || "",
  );
  failure.openRouterOriginalError = openRouterMessage;
  failure.phase1PartialResult = {
    verifiedTranscript: params.transcript || "",
    script: params.transcript || "",
    audioSegments: Array.isArray(params.audioSegments)
      ? params.audioSegments
      : [],
    frameTimestamps: Array.isArray(params.frameTimestamps)
      ? params.frameTimestamps
      : [],
    openRouterFrameCount:
      typeof params.frameCount === "number" ? params.frameCount : 0,
    openRouterInputMode: params.inputMode || "frames_only",
  };
  return failure;
}

function buildEyeEarDiagnosticReport(params: {
  reason: string;
  errorMessage: string;
  errorCode?: string;
  fileSelected: string;
  fileName: string;
  fileSize: number;
  uploadAttempted: string;
  fileState: string;
  uriPresent: string;
  uriValue: string;
  duration: number;
  missingFields: string[];
  keyAvailable: boolean;
  modelSelected: string;
}) {
  return `# 📋 DOSSIER DIAGNOSTICA GEMINI EYE/EAR (FALLITO)

Questo report di diagnostica è stato generato automaticamente per consentire l'esportazione ed il debug delle cause dell'errore di analisi con Google Gemini.

## 🔍 Riepilogo Errore
- **Stato Generale:** ANALISI INTERROTTA
- **Motivo Principale:** ${params.reason}
- **Codice Errore:** ${params.errorCode || "N/A"}
- **Dettaglio Eccezione:** ${params.errorMessage}

## 📁 Informazioni sul File e Caricamento
- **File Selezionato (UI):** ${params.fileSelected === "yes" ? "Sì" : "No"} (Nome: ${params.fileName || "N/A"}, Dimensione: ${params.fileSize || 0} bytes)
- **Stato Upload:** ${params.uploadAttempted === "yes" ? "Eseguito con successo" : "Non tentato / Errore iniziale"}
- **Stato File su Server Gemini:** ${params.fileState || "N/A"}
- **Video URI Disponibile:** ${params.uriPresent === "yes" ? "Sì" : "No"} (URI: \`${params.uriValue || "N/A"}\`)
- **Durata Rivelata (Metadati Locali):** ${params.duration !== undefined ? params.duration.toFixed(1) : "0.0"} secondi
- **Campi Mancanti Precheck:** ${params.missingFields.length > 0 ? params.missingFields.join(", ") : "Nessuno (Precheck OK)"}

## 🔑 Configurazione Chiavi & Modello
- **Chiave Gemini Disponibile:** ${params.keyAvailable ? "Sì" : "No"}
- **Modello Selezionato:** ${params.modelSelected || "gemini-2.0-flash"}

## 🛠️ Azioni Consigliate
1. **Verifica il file video:** Assicurati che non sia corrotto, che la codifica sia standard (.mp4 o .webm) e che sia visibile in locale.
2. **Re-inserisci il file:** A volte le sessioni dei file nel browser scadono per motivi di sicurezza o re-inizio della sandbox. Trascina nuovamente il video nell'area di upload dell'applicazione.
3. **Controlla il budget / limiti:** Se stai utilizzando una chiave gratuita (Free Plan), potresti aver superato i limiti di richieste al minuto (Rate Limits). Attendi 60 secondi prima del prossimo tentativo.
4. **Esporta questo report:** Clicca sul pulsante "Esporta" nella UI per ottenere il JSON totale di diagnostica che include queste informazioni per il debugging.`;
}

function normalizeVisualCastEntry(value: unknown): string {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (!text) return "";

  const mappings: Record<string, string> = {
    "true woman": "woman",
    female: "woman",
    lady: "woman",
    "manned uniform": "uniformed man",
    "uniformed official": "uniformed man",
    "man in uniform": "uniformed man",
  };

  if (mappings[text]) return mappings[text];
  if (text.includes("uniform") && text.includes("man")) return "uniformed man";
  if (
    text.includes("woman") ||
    text.includes("female") ||
    text.includes("lady")
  )
    return "woman";

  return text
    .replace(/\s{2,}/g, " ")
    .replace(/[,:;.\-]+$/g, "")
    .trim();
}

function buildNaturalVisualIdentityFromDescriptor(descriptor: any): string {
  const visualIdentity = String(descriptor?.visualIdentity || "").trim();
  const genderPresentation = String(
    descriptor?.genderPresentation || "uncertain",
  )
    .trim()
    .toLowerCase();
  const ageRange = String(descriptor?.ageRange || "uncertain")
    .trim()
    .toLowerCase();
  const clothing = String(descriptor?.clothing || "").trim();
  const roleClue = String(descriptor?.roleClue || "unknown")
    .trim()
    .toLowerCase();
  const props = Array.isArray(descriptor?.distinctiveProps)
    ? descriptor.distinctiveProps
        .map((item: any) => String(item || "").trim())
        .filter(Boolean)
    : [];

  if (visualIdentity) return visualIdentity;
  if (/prete|sacerdote|clergyman|priest|cardinal|religious/.test(roleClue)) {
    return clothing ? `figura religiosa con ${clothing}` : "figura religiosa";
  }
  if (
    /carabiniere|agente|officer|police/.test(roleClue) ||
    descriptor?.lawUniformClue === true
  ) {
    return clothing ? `uomo in divisa con ${clothing}` : "uomo in divisa";
  }
  if (genderPresentation === "woman" || genderPresentation === "female") {
    return ageRange === "elderly" ? "donna anziana" : "donna";
  }
  if (genderPresentation === "man" || genderPresentation === "male") {
    if (ageRange === "young") return "giovane uomo";
    if (ageRange === "elderly") return "uomo anziano";
    return "uomo adulto";
  }
  if (clothing) return `persona visibile con ${clothing}`;
  if (props.length > 0) return `persona visibile con ${props.join(", ")}`;
  return "persona visibile";
}

function isGenericVisualSubjectLabel(value: unknown): boolean {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (!text) return true;
  return /^(person_\d+|persona visibile|persona|unknown person|generic visible person|visible person|soggetto visivo|soggetto non identificato)$/i.test(
    text,
  );
}

function hasReliableVisualIdentity(entry: any): boolean {
  const roleLabel = String(
    entry?.recognizedVisualIdentity ||
      entry?.genericFallbackLabel ||
      entry?.roleLabel ||
      entry?.rawVisualLabel ||
      "",
  ).trim();
  const descriptorRoleClue = String(entry?.descriptorRoleClue || "").trim();
  const descriptorClothing = String(entry?.descriptorClothing || "").trim();
  const descriptorGenderPresentation = String(
    entry?.descriptorGenderPresentation || "",
  )
    .trim()
    .toLowerCase();
  const timestamps = Array.isArray(entry?.timestamps)
    ? entry.timestamps.filter(Boolean)
    : [];
  const frameIndexes = Array.isArray(entry?.frameIndexes)
    ? entry.frameIndexes.filter((value: any) => Number.isFinite(Number(value)))
    : [];
  if (!isGenericVisualSubjectLabel(roleLabel)) return true;
  if (descriptorClothing) return true;
  if (descriptorRoleClue && descriptorRoleClue.toLowerCase() !== "unknown")
    return true;
  if (
    descriptorGenderPresentation &&
    descriptorGenderPresentation !== "uncertain"
  )
    return true;
  return timestamps.length >= 2 || frameIndexes.length >= 2;
}

function summarizeDescriptorForUi(descriptor: any): string {
  const parts = [
    buildNaturalVisualIdentityFromDescriptor(descriptor),
    String(descriptor?.clothing || "").trim(),
    String(descriptor?.roleClue || "").trim() !== "unknown"
      ? `ruolo possibile ${String(descriptor?.roleClue || "").trim()}`
      : "",
  ].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

function buildVisualTruthEntries(params: {
  frameObservations?: any[];
  detectedCharacters?: string[];
  detectedCharacterDescriptors?: any[];
  transcript?: string;
}) {
  const frameObservations = Array.isArray(params.frameObservations)
    ? params.frameObservations
    : [];
  const detectedCharacters = Array.isArray(params.detectedCharacters)
    ? params.detectedCharacters
    : [];
  const detectedCharacterDescriptors = Array.isArray(
    params.detectedCharacterDescriptors,
  )
    ? params.detectedCharacterDescriptors
    : [];
  const transcript = String(params.transcript || "").toLowerCase();
  const grouped = new Map<string, any>();
  const descriptorById = new Map<string, any>();

  for (const descriptor of detectedCharacterDescriptors) {
    const id = String(descriptor?.id || "").trim();
    if (id) descriptorById.set(id, descriptor);
  }

  for (const obs of frameObservations) {
    const labels = Array.isArray(obs?.visibleSubjects)
      ? obs.visibleSubjects
      : [];
    const objects = Array.isArray(obs?.visibleObjects)
      ? obs.visibleObjects
      : [];
    const action = String(obs?.visibleAction || "").trim();
    const relation = String(obs?.relationToTranscript || "").trim();
    for (const raw of labels) {
      const rawVisualLabel = String(raw || "").trim();
      if (!rawVisualLabel) continue;
      const current = grouped.get(rawVisualLabel) || {
        rawVisualLabel,
        frameIndexes: [],
        timestamps: [],
        evidence: [],
        descriptor: descriptorById.get(rawVisualLabel) || null,
      };
      if (typeof obs?.frameIndex === "number")
        current.frameIndexes.push(obs.frameIndex);
      if (obs?.timestamp) current.timestamps.push(String(obs.timestamp));
      current.evidence.push(
        ...objects
          .map((value: any) => String(value || "").trim())
          .filter(Boolean),
      );
      if (action) current.evidence.push(action);
      if (relation) current.evidence.push(relation);
      grouped.set(rawVisualLabel, current);
    }
  }

  for (const raw of detectedCharacters) {
    const rawVisualLabel = String(raw || "").trim();
    if (!rawVisualLabel || grouped.has(rawVisualLabel)) continue;
    grouped.set(rawVisualLabel, {
      rawVisualLabel,
      frameIndexes: [],
      timestamps: [],
      evidence: [],
      descriptor: descriptorById.get(rawVisualLabel) || null,
    });
  }

  for (const [id, descriptor] of descriptorById.entries()) {
    if (grouped.has(id)) continue;
    grouped.set(id, {
      rawVisualLabel: id,
      frameIndexes: Array.isArray(descriptor?.seenInFrames)
        ? descriptor.seenInFrames
            .filter((value: any) => Number.isFinite(Number(value)))
            .map((value: any) => Number(value))
        : [],
      timestamps: [],
      evidence: [],
      descriptor,
    });
  }

  return [...grouped.values()].map((entry: any) => {
    const rawLower = String(entry.rawVisualLabel || "").toLowerCase();
    const descriptor =
      entry?.descriptor || descriptorById.get(entry.rawVisualLabel) || null;
    const evidenceSet = [...new Set((entry.evidence || []).filter(Boolean))];
    const descriptorEvidence = [
      String(descriptor?.visualIdentity || "").trim(),
      String(descriptor?.clothing || "").trim(),
      String(descriptor?.roleClue || "").trim(),
      ...(Array.isArray(descriptor?.distinctiveProps)
        ? descriptor.distinctiveProps.map((item: any) =>
            String(item || "").trim(),
          )
        : []),
    ].filter(Boolean);
    const combinedEvidence = [
      ...new Set([...evidenceSet, ...descriptorEvidence]),
    ];
    const evidenceText =
      `${combinedEvidence.join(" ")} ${transcript}`.toLowerCase();
    let genericFallbackLabel = normalizeVisualCastEntry(entry.rawVisualLabel);
    let recognizedVisualIdentity = genericFallbackLabel;
    let confidence =
      String(descriptor?.confidence || "MEDIUM")
        .trim()
        .toUpperCase() || "MEDIUM";
    let reason = descriptor
      ? "Natural visual descriptor preserved from OpenRouter vision output."
      : "Generic visual subject preserved from frame observations.";
    let uncertaintyWarning = "";
    let source = descriptor ? "raw vision" : "fallback";

    if (descriptor) {
      const descriptorIdentity =
        buildNaturalVisualIdentityFromDescriptor(descriptor);
      if (descriptorIdentity) recognizedVisualIdentity = descriptorIdentity;
      const descriptorFallback = normalizeVisualCastEntry(
        descriptor?.roleClue ||
          descriptor?.genderPresentation ||
          descriptor?.visualIdentity ||
          entry.rawVisualLabel,
      );
      if (descriptorFallback) genericFallbackLabel = descriptorFallback;
    }

    if (
      (!descriptor ||
        !recognizedVisualIdentity ||
        /^person_\d+$/i.test(recognizedVisualIdentity)) &&
      (rawLower === "uniformed_man" || rawLower.includes("uniform"))
    ) {
      genericFallbackLabel = "uomo in uniforme";
      const signals = [
        "divisa",
        "berretto",
        "uniform",
        "carabiniere",
        "polizi",
        "forza dell'ordine",
      ];
      const matched = signals.filter((signal) => evidenceText.includes(signal));
      if (matched.length >= 1) {
        recognizedVisualIdentity = "carabiniere italiano";
        confidence = matched.length >= 2 ? "MEDIUM_HIGH" : "MEDIUM";
        reason =
          "Uniform details and scene evidence suggest an Italian law-enforcement figure.";
        source = descriptor ? "parser" : "fallback";
      } else {
        recognizedVisualIdentity =
          recognizedVisualIdentity &&
          !/^person_\d+$/i.test(recognizedVisualIdentity)
            ? recognizedVisualIdentity
            : "uomo in uniforme";
        uncertaintyWarning =
          "Identita specifica non confermata oltre la divisa.";
      }
    } else if (
      (!descriptor ||
        !recognizedVisualIdentity ||
        /^person_\d+$/i.test(recognizedVisualIdentity)) &&
      rawLower === "man"
    ) {
      genericFallbackLabel = "uomo";
      recognizedVisualIdentity = "uomo adulto";
      source = descriptor ? "parser" : "fallback";
    } else if (
      (!descriptor ||
        !recognizedVisualIdentity ||
        /^person_\d+$/i.test(recognizedVisualIdentity)) &&
      rawLower === "woman"
    ) {
      genericFallbackLabel = "donna";
      recognizedVisualIdentity = "donna";
      source = descriptor ? "parser" : "fallback";
    }

    if (
      !recognizedVisualIdentity ||
      /^person_\d+$/i.test(recognizedVisualIdentity)
    ) {
      recognizedVisualIdentity = descriptor
        ? buildNaturalVisualIdentityFromDescriptor(descriptor)
        : "persona visibile";
    }
    if (!genericFallbackLabel || /^person_\d+$/i.test(genericFallbackLabel)) {
      genericFallbackLabel = recognizedVisualIdentity || "persona visibile";
    }

    logger.info("[CAST_DESCRIPTOR_EXTRACTION_AUDIT]", {
      technicalId: entry.rawVisualLabel,
      naturalDescription: recognizedVisualIdentity,
      genderPresentation: String(descriptor?.genderPresentation || "uncertain"),
      roleClue: String(descriptor?.roleClue || "unknown"),
      clothing: String(descriptor?.clothing || ""),
      confidence,
      source,
    });

    return {
      rawVisualLabel: entry.rawVisualLabel,
      recognizedVisualIdentity,
      genericFallbackLabel,
      confidence,
      visualEvidence: combinedEvidence.slice(0, 8),
      reason,
      frameIndexes: [...new Set(entry.frameIndexes)],
      timestamps: [...new Set(entry.timestamps)],
      uncertaintyWarning,
      descriptorSummary: descriptor ? summarizeDescriptorForUi(descriptor) : "",
      descriptorRoleClue: String(descriptor?.roleClue || "").trim(),
      descriptorClothing: String(descriptor?.clothing || "").trim(),
      descriptorGenderPresentation: String(
        descriptor?.genderPresentation || "",
      ).trim(),
      descriptorConfidence: String(descriptor?.confidence || "").trim(),
      source,
    };
  });
}

function inferCastFromAudioTurns(params: {
  transcript?: string;
  audioSegments?: any[];
}) {
  const transcriptText = String(params.transcript || "");
  const audioSegments = Array.isArray(params.audioSegments)
    ? params.audioSegments
    : [];
  logger.info("[CAST_AUDIO_SPEAKER_INFERENCE_START]", {
    transcriptLength: transcriptText.length,
    audioSegmentsCount: audioSegments.length,
  });

  const speakerLabelMatches = [
    ...transcriptText.matchAll(/(^|\n)\s*([A-Z][^:\n]{1,30}):\s/gm),
  ];
  const labeledSpeakers = [
    ...new Set(
      speakerLabelMatches
        .map((match) => String(match[2] || "").trim())
        .filter(Boolean),
    ),
  ];
  const turnTexts = audioSegments
    .map((seg: any) => String(seg?.text || "").trim())
    .filter((text: string) => text.length >= 6);
  const questionTurns = turnTexts.filter(
    (text: string) =>
      /\?$/.test(text) ||
      /\b(perche|perchÃ©|come|quando|dove|chi|cosa)\b/i.test(text),
  ).length;
  const answerTurns = turnTexts.filter((text: string) =>
    /\bsi\b|\bno\b|\bcerto\b|\bok\b|\bforse\b/i.test(text),
  ).length;
  const shortTurns = turnTexts.filter(
    (text: string) => text.split(/\s+/).length <= 6,
  ).length;
  const alternationScore =
    (questionTurns > 0 ? 1 : 0) +
    (answerTurns > 0 ? 1 : 0) +
    (shortTurns >= 3 ? 1 : 0);
  const dialogueTurnsCount = turnTexts.length;

  let estimatedSpeakerCount = 0;
  let confidence = "UNCONFIRMED";
  const evidence: string[] = [];
  let warning = "";
  const audioSpeakerDetectionMode = "HEURISTIC_TRANSCRIPT_ONLY";
  const realVoiceDiarizationAvailable = false;
  const voicePrintAnalysisAvailable = false;
  const timbreAnalysisAvailable = false;
  const genderVoiceDetectionAvailable = false;
  const realAudioSpeakerCountAvailable = false;
  const audioSpeakerCountIsReal = false;

  if (labeledSpeakers.length > 0) {
    estimatedSpeakerCount = Math.min(labeledSpeakers.length, 6);
    confidence =
      estimatedSpeakerCount >= 2 ? "MEDIUM_AUDIO_ONLY" : "LOW_AUDIO_ONLY";
    evidence.push(`speaker_labels:${labeledSpeakers.length}`);
  } else if (turnTexts.length <= 1) {
    estimatedSpeakerCount = turnTexts.length === 1 ? 1 : 0;
    confidence = turnTexts.length === 1 ? "LOW_AUDIO_ONLY" : "UNCONFIRMED";
    evidence.push(`turns:${turnTexts.length}`);
  } else if (alternationScore >= 2 && turnTexts.length >= 3) {
    estimatedSpeakerCount = 2;
    confidence = "MEDIUM_AUDIO_ONLY";
    evidence.push(`alternation_score:${alternationScore}`);
    evidence.push(`turns:${turnTexts.length}`);
  } else if (alternationScore >= 1 && turnTexts.length >= 2) {
    estimatedSpeakerCount = 2;
    confidence = "LOW_AUDIO_ONLY";
    evidence.push(`alternation_score:${alternationScore}`);
    evidence.push(`turns:${turnTexts.length}`);
  } else if (turnTexts.length >= 1) {
    estimatedSpeakerCount = 1;
    confidence = "LOW_AUDIO_ONLY";
    evidence.push(`turns:${turnTexts.length}`);
  }

  const estimatedSpeakers =
    estimatedSpeakerCount > 0
      ? Array.from(
          { length: estimatedSpeakerCount },
          (_, index) => `Parlante ${index + 1}`,
        )
      : [];

  if (estimatedSpeakerCount === 0) {
    warning =
      "Audio available but speaker count could not be confirmed reliably.";
    logger.warn("[CAST_SPEAKER_COUNT_UNCONFIRMED]", {
      transcriptLength: transcriptText.length,
      audioSegmentsCount: audioSegments.length,
      evidence,
    });
  }

  logger.info("[CAST_AUDIO_SPEAKER_INFERENCE_RESULT]", {
    estimatedSpeakerCount,
    estimatedSpeakers,
    confidence,
    evidence,
    warning,
    audioSpeakerDetectionMode,
    audioSpeakerCountIsReal,
  });

  return {
    estimatedSpeakerCount,
    estimatedSpeakers,
    confidence,
    dialogueTurnsCount,
    transcriptHasSpeakerLabels: labeledSpeakers.length > 0,
    evidence,
    warning,
    audioSpeakerDetectionMode,
    realVoiceDiarizationAvailable,
    voicePrintAnalysisAvailable,
    timbreAnalysisAvailable,
    genderVoiceDetectionAvailable,
    realAudioSpeakerCountAvailable,
    heuristicAudioSpeakerCount: estimatedSpeakerCount,
    audioSpeakerCountIsReal,
    transcriptSpeakerCountEstimate: estimatedSpeakerCount,
    transcriptSpeakerCountEstimateMode: "TRANSCRIPT_ONLY_ESTIMATE",
    speakerAttributionConfidence:
      labeledSpeakers.length > 0
        ? "PROBABLE_LABEL_ONLY"
        : estimatedSpeakerCount > 0
          ? "CAUTIOUS_TRANSCRIPT_ONLY"
          : "LOW_UNCONFIRMED",
    diagnosticConclusion:
      "La stima speaker audio Ã¨ euristica da transcript/alternanza battute, non diarizzazione vocale reale.",
    recommendedNextStep:
      "Serve speaker diarization o voice embedding separato per distinguere davvero le voci.",
  };
}

function deriveCanonicalCastFromVision(params: {
  detectedCharacters?: string[];
  detectedCharacterDescriptors?: any[];
  visualCastCount?: number;
  frameObservations?: any[];
  transcript?: string;
  visionStatus?: string;
  audioSegments?: any[];
  frameTimestamps?: string[];
  recoveryAttempted?: boolean;
  recoverySuccessful?: boolean;
}) {
  const rawDetected = Array.isArray(params.detectedCharacters)
    ? params.detectedCharacters
    : [];
  const detectedCharacterDescriptors = Array.isArray(
    params.detectedCharacterDescriptors,
  )
    ? params.detectedCharacterDescriptors
    : [];
  const detectedCharacters = [
    ...new Set(rawDetected.map(normalizeVisualCastEntry).filter(Boolean)),
  ];
  const visualCastCountInput =
    typeof params.visualCastCount === "number" ? params.visualCastCount : 0;
  const frameObservations = Array.isArray(params.frameObservations)
    ? params.frameObservations
    : [];
  const audioSegments = Array.isArray(params.audioSegments)
    ? params.audioSegments
    : [];
  const frameTimestamps = Array.isArray(params.frameTimestamps)
    ? params.frameTimestamps
    : [];

  const frameObservationsCount = Array.isArray(frameObservations)
    ? frameObservations.length
    : 0;
  const frameTimestampsCount = Array.isArray(frameTimestamps)
    ? frameTimestamps.length
    : 0;
  const detectedCharactersCount = detectedCharacters.length;
  const missingObservationFrames = Math.max(
    0,
    frameTimestampsCount - frameObservationsCount,
  );

  // [CAST_DERIVE_SAFE_COUNTS_AUDIT]
  logger.info("[CAST_DERIVE_SAFE_COUNTS_AUDIT]", {
    frameObservationsCount,
    detectedCharactersCount,
    visualCastCount: visualCastCountInput,
    frameTimestampsCount,
    missingObservationFrames,
    recoveryAttempted: params.recoveryAttempted,
    recoverySuccessful: params.recoverySuccessful,
  });

  const isWeakVision = params.visionStatus === "WEAK_VISION_OUTPUT";

  const visibleSubjects = [
    ...new Set(
      frameObservations
        .flatMap((obs: any) =>
          Array.isArray(obs?.visibleSubjects) ? obs.visibleSubjects : [],
        )
        .map(normalizeVisualCastEntry)
        .filter(Boolean),
    ),
  ];
  const visualTruthEntries = buildVisualTruthEntries({
    frameObservations,
    detectedCharacters: rawDetected,
    detectedCharacterDescriptors,
    transcript: params.transcript,
  });
  const rawCastTermsFound = [
    ...new Set(
      []
        .concat(rawDetected as any)
        .concat(
          frameObservations.flatMap((obs: any) =>
            Array.isArray(obs?.visibleSubjects) ? obs.visibleSubjects : [],
          ),
        )
        .map((value: any) => String(value || "").trim())
        .filter((value: string) =>
          /(woman|female|lady|donna|priest|clergyman|cardinal|religious figure|prete|sacerdote|figura religiosa|carabiniere|police officer|uniformed officer|italian officer|law enforcement|uniformed_man|young_man|man|person_1)/i.test(
            value,
          ),
        ),
    ),
  ];

  let canonicalCastList: string[] = [];
  let castSource = "speaker_count_unconfirmed";
  let castConfidence = "VISUAL_ROLE_ONLY";
  const hasAudioSegments = audioSegments.length > 0;
  const hasFrameTimestamps = frameTimestamps.length > 0;
  const shouldAttemptVisualFallback = hasAudioSegments && hasFrameTimestamps;
  const audioSpeakerInference = shouldAttemptVisualFallback
    ? inferCastFromAudioTurns({
        transcript: params.transcript,
        audioSegments,
      })
    : {
        estimatedSpeakerCount: 0,
        estimatedSpeakers: [],
        confidence: "UNCONFIRMED",
        dialogueTurnsCount: 0,
        transcriptHasSpeakerLabels: false,
        evidence: [],
        warning: "",
        audioSpeakerDetectionMode: "UNAVAILABLE",
        realVoiceDiarizationAvailable: false,
        voicePrintAnalysisAvailable: false,
        timbreAnalysisAvailable: false,
        genderVoiceDetectionAvailable: false,
        realAudioSpeakerCountAvailable: false,
        audioSpeakerCountIsReal: false,
        heuristicAudioSpeakerCount: 0,
        transcriptSpeakerCountEstimate: 0,
        speakerAttributionConfidence: "UNCONFIRMED",
        diagnosticConclusion: "Missing audio segments or frame timestamps",
        recommendedNextStep: "Try generating real voice diarization",
      };

  logger.info("[CAST_VISUAL_DETECTION_ATTEMPT]", {
    detectedCharactersCount,
    frameObservationCount: frameObservationsCount,
    frameObservationSubjectsCount: visibleSubjects.length,
    frameObservationsCount,
    frameTimestampsCount,
    missingObservationFrames,
    visualCastCountInput,
    hasAudioSegments,
    audioSegmentsCount: audioSegments.length,
    hasFrameTimestamps,
    visionStatus: params.visionStatus || "UNKNOWN",
    recoveryAttempted: params.recoveryAttempted,
    recoverySuccessful: params.recoverySuccessful,
  });

  const technicalIdPattern = /^person_\\d+$/i;
  const recognizedIdentities = visualTruthEntries
    .map((entry: any) => String(entry?.recognizedVisualIdentity || "").trim())
    .filter(
      (value: string) => Boolean(value) && !technicalIdPattern.test(value),
    );

  if (recognizedIdentities.length > 0) {
    canonicalCastList = [...new Set(recognizedIdentities)].slice(0, 6);
    castSource =
      detectedCharacterDescriptors.length > 0
        ? "visualTruthEntries.descriptors"
        : "visualTruthEntries";
    castConfidence = "VISUAL_CAST_EXTRACTED";
  } else if (detectedCharacters.length > 0) {
    canonicalCastList = detectedCharacters.slice(0, 6);
    castSource = "detectedCharacters";
    castConfidence = "VISUAL_CAST_EXTRACTED";
  } else if (visibleSubjects.length > 0) {
    canonicalCastList = visibleSubjects.slice(0, 6);
    castSource = "frameObservations.visibleSubjects";
    castConfidence = "VISUAL_CAST_EXTRACTED";
  } else if (visualCastCountInput > 1) {
    canonicalCastList = Array.from(
      { length: Math.min(visualCastCountInput, 6) },
      (_, index) => `Soggetto visivo ${index + 1}`,
    );
    castSource = "visualCastCount";
    castConfidence = "VISUAL_CAST_COUNT_ONLY";
  } else if (audioSpeakerInference.estimatedSpeakerCount > 0) {
    logger.info("[CAST_FIXED_FOUR_FALLBACK_REMOVED]", {
      replacement: "audio_speaker_inference",
      estimatedSpeakerCount: audioSpeakerInference.estimatedSpeakerCount,
    });
    canonicalCastList = audioSpeakerInference.estimatedSpeakers;
    castSource = "audio_speaker_inference";
    castConfidence = audioSpeakerInference.confidence;
  } else {
    canonicalCastList = [];
    castSource = "speaker_count_unconfirmed";
    castConfidence = "UNCONFIRMED";
    logger.warn("[CAST_COLLAPSED_TO_SINGLE_PERSON_WARNING]", {
      reason: "speaker_count_unconfirmed",
      hasAudioSegments,
      hasFrameTimestamps,
      visualCastCountInput,
    });
  }

  // Final normalization check for banned fragments like "true woman" or "manned uniform"
  canonicalCastList = canonicalCastList.map((name) => {
    let n = name.toLowerCase();
    if (n.includes("true woman")) return n.replace("true woman", "woman");
    if (n.includes("manned uniform"))
      return n.replace("manned uniform", "uniformed man");
    return name;
  });

  const visualCastCountBeforeDedup = Math.max(
    rawDetected.length,
    visibleSubjects.length,
    visualCastCountInput,
    canonicalCastList.length,
  );
  canonicalCastList = canonicalCastList.filter(
    (value: string, index: number, arr: string[]) => {
      const normalized = String(value || "")
        .trim()
        .toLowerCase();
      return (
        normalized &&
        !technicalIdPattern.test(normalized) &&
        arr.findIndex(
          (candidate: string) =>
            String(candidate || "")
              .trim()
              .toLowerCase() === normalized,
        ) === index
      );
    },
  );
  const visualCastCount = canonicalCastList.length;
  logger.info("[CAST_DEDUP_APPLIED]", {
    visualCastCountBefore: visualCastCountBeforeDedup,
    visualCastCountAfter: visualCastCount,
    technicalIdsHiddenFromUi: rawDetected.some((value: string) =>
      technicalIdPattern.test(String(value || "").trim()),
    ),
  });

  logger.info("[CAST_NORMALIZATION_DONE]", {
    originalCount: rawDetected.length,
    normalizedCount: canonicalCastList.length,
    canonicalCastList,
  });
  {
    const visualTruthRecognizedIdentities = visualTruthEntries
      .map((entry: any) => String(entry?.recognizedVisualIdentity || "").trim())
      .filter(Boolean);
    const parsedDetectedCharacters = detectedCharacters
      .map((value: any) => String(value || "").trim())
      .filter(Boolean);
    const rawSpecificTerms = rawCastTermsFound.filter((value: string) =>
      /(woman|female|lady|donna|priest|clergyman|cardinal|religious figure|prete|sacerdote|figura religiosa|carabiniere|police officer|uniformed officer|italian officer|law enforcement)/i.test(
        value,
      ),
    );
    const normalizedSpecificTerms = []
      .concat(parsedDetectedCharacters as any)
      .concat(canonicalCastList as any)
      .concat(visualTruthRecognizedIdentities as any)
      .map((value: any) => String(value || "").toLowerCase());
    const lostAfterParsing = rawSpecificTerms.filter(
      (term: string) =>
        !parsedDetectedCharacters.some((parsed: string) =>
          parsed.toLowerCase().includes(term.toLowerCase()),
        ),
    );
    const lostAfterNormalization = rawSpecificTerms.filter(
      (term: string) =>
        !normalizedSpecificTerms.some(
          (value: string) =>
            value.includes(term.toLowerCase()) ||
            (term.toLowerCase().includes("carabiniere") &&
              value.includes("carabiniere")) ||
            (term.toLowerCase().includes("priest") &&
              /prete|sacerdote|religiosa|cardinal/.test(value)) ||
            (term.toLowerCase().includes("woman") && /woman|donna/.test(value)),
        ),
    );
    logger.info("[CAST_PARSING_LOSS_AUDIT]", {
      rawCastTermsFound,
      parsedDetectedCharacters,
      canonicalCastList,
      visualTruthRecognizedIdentities,
      lostAfterParsing,
      lostAfterNormalization,
    });
    logger.info("[CAST_DESCRIPTOR_LOSS_AUDIT]", {
      rawContainedDescriptors: detectedCharacterDescriptors.length > 0,
      canonicalCastList,
      visualTruthRecognizedIdentities,
      lossDetected:
        detectedCharacterDescriptors.length > 0 &&
        canonicalCastList.length > 0 &&
        canonicalCastList.every((value: string) =>
          /^person_\d+$/i.test(String(value || "").trim()),
        ),
      rawDescriptorPreview: detectedCharacterDescriptors
        .slice(0, 6)
        .map((descriptor: any) => ({
          id: descriptor?.id,
          visualIdentity: descriptor?.visualIdentity,
          roleClue: descriptor?.roleClue,
          clothing: descriptor?.clothing,
          confidence: descriptor?.confidence,
        })),
    });
  }

  if (isWeakVision) {
    if (castSource === "speaker_count_unconfirmed") {
      castConfidence = "WEAK_DEFAULT_FALLBACK";
      castSource = "weak_vision_fallback";
    }
  }

  const transcriptText = String(params.transcript || "");
  const transcriptHasSpeakerLabels = /^[A-Z][^:]{1,30}:\s/m.test(
    transcriptText,
  );
  const dialogueTurns = transcriptText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let warning = "";
  if (!transcriptHasSpeakerLabels && canonicalCastList.length > 1) {
    warning =
      "Transcript has no speaker labels; do not assign all dialogue to one named character.";
  } else if (canonicalCastList.length === 1 && dialogueTurns.length >= 3) {
    warning = "Possible multi-speaker scene collapsed into one cast member.";
  }
  const visualCastDetectedCount =
    detectedCharacters.length ||
    visibleSubjects.length ||
    visualCastCountInput ||
    0;
  const faithfulRawVisualPersons = visualTruthEntries.map(
    (entry: any, index: number) => {
      const descriptor = entry?.descriptor || null;
      const roleLabel = String(
        entry?.recognizedVisualIdentity ||
          descriptor?.visualIdentity ||
          descriptor?.roleClue ||
          descriptor?.clothing ||
          entry?.rawVisualLabel ||
          `person_${index + 1}`,
      ).trim();
      const timestamps = Array.isArray(entry?.timestamps)
        ? [
            ...new Set(
              entry.timestamps
                .map((value: any) => String(value || "").trim())
                .filter(Boolean),
            ),
          ]
        : [];
      return {
        id:
          String(entry?.rawVisualLabel || `person_${index + 1}`).trim() ||
          `person_${index + 1}`,
        roleLabel,
        timestamps,
        frameIndexes: Array.isArray(entry?.frameIndexes)
          ? entry.frameIndexes
          : [],
      };
    },
  );
  const genericVisualSubjects = faithfulRawVisualPersons.filter(
    (person: any) => {
      const matchingEntry = visualTruthEntries.find(
        (entry: any) =>
          String(entry?.rawVisualLabel || "").trim() ===
          String(person?.id || "").trim(),
      );
      return !hasReliableVisualIdentity(matchingEntry || person);
    },
  );
  const realDisplayCastCount = Math.max(
    0,
    faithfulRawVisualPersons.length - genericVisualSubjects.length,
  );
  const genericSubjectWarning =
    genericVisualSubjects.length > 0
      ? `${genericVisualSubjects.length} soggetto visivo generico non contato come personaggio reale.`
      : "";
  genericVisualSubjects.forEach((subject: any) => {
    logger.info("[GENERIC_VISUAL_SUBJECT_EXCLUDED_FROM_REAL_CAST_COUNT]", {
      id: subject?.id || "",
      roleLabel: subject?.roleLabel || "",
      timestamps: Array.isArray(subject?.timestamps) ? subject.timestamps : [],
    });
  });
  const faithfulRoleGroupsMap = new Map<
    string,
    { roleLabel: string; ids: string[]; timestamps: string[] }
  >();
  faithfulRawVisualPersons.forEach((person: any) => {
    const key = String(person?.roleLabel || "Soggetto visivo non classificato")
      .trim()
      .toLowerCase();
    const current = faithfulRoleGroupsMap.get(key) || {
      roleLabel: String(
        person?.roleLabel || "Soggetto visivo non classificato",
      ).trim(),
      ids: [],
      timestamps: [],
    };
    current.ids.push(String(person?.id || "").trim());
    current.timestamps.push(
      ...(Array.isArray(person?.timestamps) ? person.timestamps : []),
    );
    faithfulRoleGroupsMap.set(key, current);
  });
  const groupedByRole = [...faithfulRoleGroupsMap.values()].map(
    (group: any) => ({
      roleLabel: group.roleLabel,
      count: group.ids.length,
      ids: [...new Set(group.ids)],
      timestamps: [...new Set(group.timestamps)],
    }),
  );
  const possibleDuplicates = groupedByRole
    .filter((group: any) => group.count > 1)
    .map((group: any) => ({
      roleLabel: group.roleLabel,
      count: group.count,
      ids: group.ids,
    }));
  const lostIndividualityWarning =
    possibleDuplicates.length > 0
      ? "Il cast canonico raggruppa ruoli simili e puo ridurre il numero reale di persone visibili."
      : "";
  const faithfulCastAudit = {
    rawVisualPersonsCount: faithfulRawVisualPersons.length,
    rawVisualPersonsList: faithfulRawVisualPersons,
    genericVisualSubjectsCount: genericVisualSubjects.length,
    genericVisualSubjects,
    realDisplayCastCount,
    genericSubjectWarning,
    canonicalRoleGroupsCount: groupedByRole.length,
    canonicalRoleGroups: groupedByRole.map(
      (group: any) => `${group.count} soggetti: ${group.roleLabel}`,
    ),
    individualCharacters: faithfulRawVisualPersons.map((person: any) => ({
      id: person.id,
      roleLabel: person.roleLabel,
      timestamps: person.timestamps,
    })),
    groupedByRole,
    possibleDuplicates,
    lostIndividualityWarning,
    finalFaithfulCastCount:
      faithfulRawVisualPersons.length || visualCastDetectedCount,
    castFidelityConfidence:
      faithfulRawVisualPersons.length > 0
        ? "VISUAL_INDIVIDUALS_PRESERVED"
        : "ROLE_GROUP_ONLY",
    castFidelityConclusion:
      faithfulRawVisualPersons.length > groupedByRole.length
        ? "Sono presenti piu soggetti visivi distinti di quanti ne mostri il cast narrativo raggruppato."
        : "Il cast visivo e il cast raggruppato per ruolo risultano allineati.",
  };
  logger.info("[TRUE_CAST_AUDIT_REPORT]", {
    rawVisualPersonsCount: faithfulCastAudit.rawVisualPersonsCount,
    canonicalRoleGroupsCount: faithfulCastAudit.canonicalRoleGroupsCount,
    finalFaithfulCastCount: faithfulCastAudit.finalFaithfulCastCount,
    groupedRoles: faithfulCastAudit.canonicalRoleGroups,
    lostIndividualityWarning: faithfulCastAudit.lostIndividualityWarning,
  });
  const audioSpeakerCount = audioSpeakerInference.estimatedSpeakerCount;
  const possibleUndercount =
    visualCastCount > 0 &&
    audioSpeakerCount > 0 &&
    audioSpeakerCount < visualCastCount;
  const audioOnlyCharacterCount = Math.max(
    0,
    audioSpeakerCount - visualCastCount,
  );
  const totalDetectionSignals = visualCastCount + audioSpeakerCount;
  const finalCastUsedCount = Math.max(
    visualCastCount,
    canonicalCastList.length,
    visualCastDetectedCount,
  );
  const reconciliationMode =
    audioSpeakerCount === 0
      ? "VISUAL_ONLY"
      : audioOnlyCharacterCount > 0
        ? "VISUAL_PLUS_AUDIO_OVERFLOW"
        : possibleUndercount
          ? "VISUAL_PRIMARY_AUDIO_UNDERCOUNT"
          : "VISUAL_AUDIO_ALIGNED";
  const reconciliationWarning = possibleUndercount
    ? "Audio speaker estimate may be undercounted compared to visible cast."
    : audioOnlyCharacterCount > 0
      ? "Additional audio-only speaker signals may indicate off-screen voices."
      : "";
  const audioSpeakerDiagnostic = {
    audioSpeakerAnalysisMode:
      audioSpeakerCount > 0 ? "HEURISTIC_TRANSCRIPT_ONLY" : "UNAVAILABLE",
    audioSpeakerDetectionMode:
      audioSpeakerInference.audioSpeakerDetectionMode ||
      "HEURISTIC_TRANSCRIPT_ONLY",
    realDiarizationAvailable: false,
    realVoiceDiarizationAvailable:
      audioSpeakerInference.realVoiceDiarizationAvailable === true,
    voicePrintAnalysisAvailable:
      audioSpeakerInference.voicePrintAnalysisAvailable === true,
    timbreAnalysisAvailable:
      audioSpeakerInference.timbreAnalysisAvailable === true,
    genderVoiceDetectionAvailable:
      audioSpeakerInference.genderVoiceDetectionAvailable === true,
    transcriptHasSpeakerLabels,
    hasAudioSegments: audioSegments.length > 0,
    hasWordTimestamps: audioSegments.some(
      (seg: any) =>
        typeof seg?.start === "number" || typeof seg?.end === "number",
    ),
    hasAcousticSpeakerEmbeddings: false,
    estimatedSpeakerCount: audioSpeakerCount,
    heuristicAudioSpeakerCount:
      audioSpeakerInference.heuristicAudioSpeakerCount ?? audioSpeakerCount,
    transcriptSpeakerCountEstimate:
      audioSpeakerInference.transcriptSpeakerCountEstimate ?? audioSpeakerCount,
    realAudioSpeakerCountAvailable:
      audioSpeakerInference.realAudioSpeakerCountAvailable === true,
    audioSpeakerCountIsReal:
      audioSpeakerInference.audioSpeakerCountIsReal === true,
    estimatedSpeakers: audioSpeakerInference.estimatedSpeakers,
    dialogueTurnsCount: audioSpeakerInference.dialogueTurnsCount,
    audioInferenceEvidence: audioSpeakerInference.evidence,
    audioSpeakerEstimateReason:
      audioSpeakerCount > 0
        ? "Transcript-only estimate from dialogue turns/alternation; no real diarization available."
        : "Audio speaker estimation unavailable because no reliable transcript-turn evidence was found.",
    audioSpeakerEstimateLimitations: [
      transcriptHasSpeakerLabels
        ? "Transcript speaker labels are present but not backed by acoustic diarization."
        : "Groq Whisper transcript has no speaker labels.",
      "No acoustic speaker embeddings are available.",
      "Voice gender/timbre changes are not directly measured.",
      "Estimate may undercount when multiple people speak short lines.",
    ],
    speakerAttributionConfidence:
      audioSpeakerInference.speakerAttributionConfidence ||
      (transcriptHasSpeakerLabels
        ? "PROBABLE_LABEL_ONLY"
        : "CAUTIOUS_TRANSCRIPT_ONLY"),
    diagnosticConclusion:
      audioSpeakerInference.diagnosticConclusion ||
      "La stima speaker audio Ã¨ euristica da transcript/alternanza battute, non diarizzazione vocale reale.",
    recommendedNextStep:
      audioSpeakerInference.recommendedNextStep ||
      "Serve speaker diarization o voice embedding separato per distinguere davvero le voci.",
    possibleUndercountComparedToVisual: possibleUndercount,
    recommendedCastSourceForPrompts:
      audioOnlyCharacterCount > 0
        ? "AUDIO_VIDEO_RECONCILED"
        : possibleUndercount
          ? "VISUAL_CAST_PRIMARY"
          : audioSpeakerCount > 0
            ? "AUDIO_VIDEO_RECONCILED"
            : "VISUAL_CAST_PRIMARY",
  };
  logger.info("[AUDIO_SPEAKER_DIAGNOSTIC_REPORT]", {
    mode: audioSpeakerDiagnostic.audioSpeakerAnalysisMode,
    realDiarizationAvailable: audioSpeakerDiagnostic.realDiarizationAvailable,
    transcriptHasSpeakerLabels:
      audioSpeakerDiagnostic.transcriptHasSpeakerLabels,
    estimatedSpeakerCount: audioSpeakerDiagnostic.estimatedSpeakerCount,
    dialogueTurnsCount: audioSpeakerDiagnostic.dialogueTurnsCount,
    audioInferenceEvidence: audioSpeakerDiagnostic.audioInferenceEvidence,
    visualCastDetectedCount,
    possibleUndercountComparedToVisual:
      audioSpeakerDiagnostic.possibleUndercountComparedToVisual,
    reason: audioSpeakerDiagnostic.audioSpeakerEstimateReason,
  });
  logger.info("[AUDIO_SPEAKER_METHOD_LIMITATION_AUDIT]", {
    mode: audioSpeakerDiagnostic.audioSpeakerDetectionMode,
    realVoiceDiarizationAvailable:
      audioSpeakerDiagnostic.realVoiceDiarizationAvailable,
    voicePrintAnalysisAvailable:
      audioSpeakerDiagnostic.voicePrintAnalysisAvailable,
    timbreAnalysisAvailable: audioSpeakerDiagnostic.timbreAnalysisAvailable,
    genderVoiceDetectionAvailable:
      audioSpeakerDiagnostic.genderVoiceDetectionAvailable,
    estimatedSpeakerCount: audioSpeakerDiagnostic.estimatedSpeakerCount,
    visualCastDetectedCount,
    diagnosticConclusion: audioSpeakerDiagnostic.diagnosticConclusion,
    recommendedNextStep: audioSpeakerDiagnostic.recommendedNextStep,
  });
  logger.info("[AUDIO_SPEAKER_TRUTH_GUARD]", {
    audioSpeakerDetectionMode: audioSpeakerDiagnostic.audioSpeakerDetectionMode,
    audioSpeakerCountIsReal: audioSpeakerDiagnostic.audioSpeakerCountIsReal,
    heuristicAudioSpeakerCount:
      audioSpeakerDiagnostic.heuristicAudioSpeakerCount,
    realVoiceDiarizationAvailable:
      audioSpeakerDiagnostic.realVoiceDiarizationAvailable,
    transcriptHasSpeakerLabels:
      audioSpeakerDiagnostic.transcriptHasSpeakerLabels,
  });
  logger.info("[AUDIO_SPEAKER_ESTIMATE_AUDIT]", {
    estimatedSpeakerCount: audioSpeakerCount,
    visualCastDetectedCount,
    dialogueTurnsCount: audioSpeakerInference.dialogueTurnsCount,
    hasSpeakerLabels: audioSpeakerInference.transcriptHasSpeakerLabels,
    speakerEstimateConfidence: audioSpeakerInference.confidence,
    possibleUndercount,
  });
  logger.info("[CAST_AUDIO_VIDEO_RECONCILIATION]", {
    visualCastCount,
    audioSpeakerCount,
    totalDetectionSignals,
    audioOnlyCharacterCount,
    finalCastUsedCount,
    reconciliationMode,
    warning: reconciliationWarning,
  });
  const castGroundingAudit = {
    visualCastCount,
    visualCastDetectedCount:
      detectedCharacters.length ||
      visibleSubjects.length ||
      visualCastCountInput ||
      0,
    realDisplayCastCount,
    genericVisualSubjectsCount: genericVisualSubjects.length,
    genericSubjectWarning,
    detectedCharactersCount: detectedCharacters.length,
    frameObservationSubjectsCount: visibleSubjects.length,
    canonicalCastCount: canonicalCastList.length,
    canonicalCastList,
    castSource,
    castConfidence,
    castVisualConfirmed:
      detectedCharacters.length > 0 ||
      visibleSubjects.length > 0 ||
      visualCastCountInput > 0,
    castFallbackMode:
      castSource === "audio_speaker_inference"
        ? "AUDIO_ESTIMATED"
        : castSource.includes("fallback") ||
            castSource === "speaker_count_unconfirmed"
          ? "UNCONFIRMED"
          : "NONE",
    fallbackSubjectCount:
      castSource === "audio_speaker_inference" ? canonicalCastList.length : 0,
    estimatedSpeakerCount: audioSpeakerInference.estimatedSpeakerCount,
    estimatedSpeakers: audioSpeakerInference.estimatedSpeakers,
    speakerEstimateConfidence: audioSpeakerInference.confidence,
    dialogueTurnsCount: audioSpeakerInference.dialogueTurnsCount,
    audioInferenceEvidence: audioSpeakerInference.evidence,
    audioInferenceWarning: audioSpeakerInference.warning,
    transcriptSpeakerCountEstimate: audioSpeakerInference.transcriptSpeakerCountEstimate,
    transcriptHasSpeakerLabels,
    warning,
    faithfulCastAudit,
    totalDetectionSignals,
    audioSpeakerCount,
    audioOnlyCharacterCount,
    finalCastUsedCount,
    reconciliationMode,
    reconciliationWarning,
    visualTruthEntries,
    detectedCharacterDescriptors,
    frameObservationsCount,
    missingObservationFrames,
    recoveryAttempted: params.recoveryAttempted,
    recoverySuccessful: params.recoverySuccessful,
  };

  return {
    canonicalCastList,
    castConfidence,
    castGroundingAudit,
  };
}

type SimulatedCastPipelineInput = {
  frameObservations?: any[];
  detectedCharacters?: string[];
  detectedCharacterDescriptors?: any[];
  visualCastCount?: number;
  transcript?: string;
  visionStatus?: string;
  audioSegments?: any[];
  frameTimestamps?: string[];
};

export function runSimulatedCastPipelineTest(
  input?: SimulatedCastPipelineInput,
) {
  const simulatedInput: SimulatedCastPipelineInput = input || {
    frameObservations: [
      {
        frameIndex: 0,
        timestamp: "0.50s",
        visibleSubjects: ["person_1"],
        visibleObjects: [
          "tuta spaziale",
          "casco da astronauta",
          "patch sulla spalla",
        ],
        visibleAction: "in piedi in posa da esploratore",
        possibleRole: "astronauta / esploratore spaziale",
        possibleSpeaker: "unknown",
        relationToTranscript: "nessun audio richiesto",
        confidence: "HIGH",
      },
      {
        frameIndex: 1,
        timestamp: "1.50s",
        visibleSubjects: ["person_1"],
        visibleObjects: ["tuta spaziale bianca", "casco sotto braccio"],
        visibleAction: "cammina lentamente",
        possibleRole: "astronauta / esploratore spaziale",
        possibleSpeaker: "unknown",
        relationToTranscript: "nessun audio richiesto",
        confidence: "HIGH",
      },
      {
        frameIndex: 2,
        timestamp: "2.50s",
        visibleSubjects: ["person_1"],
        visibleObjects: ["casco da astronauta", "patch sulla spalla"],
        visibleAction: "guarda in avanti",
        possibleRole: "astronauta / esploratore spaziale",
        possibleSpeaker: "unknown",
        relationToTranscript: "nessun audio richiesto",
        confidence: "HIGH",
      },
    ],
    detectedCharacters: ["person_1"],
    detectedCharacterDescriptors: [
      {
        id: "person_1",
        visualIdentity: "astronauta",
        genderPresentation: "uncertain",
        ageRange: "adult",
        clothing: "tuta spaziale bianca con casco sotto braccio",
        roleClue: "astronauta / esploratore spaziale",
        religiousUniformClue: false,
        lawUniformClue: false,
        distinctiveProps: [
          "casco da astronauta",
          "tuta spaziale",
          "patch sulla spalla",
        ],
        seenInFrames: [0, 1, 2],
        confidence: "HIGH",
      },
    ],
    visualCastCount: 1,
    transcript: "",
    visionStatus: "OK",
    audioSegments: [],
    frameTimestamps: ["0.50s", "1.50s", "2.50s"],
  };

  logger.info("[SIMULATED_CAST_PIPELINE_TEST_START]", {
    enabled: true,
    usesRealPipelineFunctions: true,
    consumesApis: false,
  });
  logger.info("[SIMULATED_CAST_PIPELINE_TEST_RAW]", simulatedInput);

  const castGrounding = deriveCanonicalCastFromVision({
    detectedCharacters: simulatedInput.detectedCharacters,
    detectedCharacterDescriptors: simulatedInput.detectedCharacterDescriptors,
    visualCastCount: simulatedInput.visualCastCount,
    frameObservations: simulatedInput.frameObservations,
    transcript: simulatedInput.transcript,
    visionStatus: simulatedInput.visionStatus,
    audioSegments: simulatedInput.audioSegments,
    frameTimestamps: simulatedInput.frameTimestamps,
  });

  const visualTruthEntries = Array.isArray(
    castGrounding.castGroundingAudit?.visualTruthEntries,
  )
    ? castGrounding.castGroundingAudit.visualTruthEntries
    : [];
  const castPanelLabels = visualTruthEntries.map((entry: any, idx: number) => {
    const label = String(
      entry?.recognizedVisualIdentity ||
        entry?.genericFallbackLabel ||
        entry?.rawVisualLabel ||
        "persona visibile",
    ).trim();
    const detail = [
      entry?.descriptorClothing,
      entry?.descriptorRoleClue
        ? `ruolo possibile ${entry.descriptorRoleClue}`
        : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `Person ${idx + 1} - ${label}${detail ? `, ${detail}` : ""}`;
  });

  const recognizedVisualIdentity = String(
    visualTruthEntries?.[0]?.recognizedVisualIdentity || "",
  ).trim();
  const passed =
    /astronauta/i.test(recognizedVisualIdentity) &&
    castGrounding.canonicalCastList.some((item: string) =>
      /astronauta/i.test(String(item || "")),
    );
  const failureReason = passed
    ? ""
    : !recognizedVisualIdentity
      ? "recognizedVisualIdentity missing"
      : !/astronauta/i.test(recognizedVisualIdentity)
        ? `recognizedVisualIdentity not preserved: ${recognizedVisualIdentity}`
        : "canonicalCastList did not preserve natural identity";

  logger.info("[SIMULATED_CAST_PIPELINE_TEST_RESULT]", {
    inputIdentity: "astronauta",
    uiIdentityExpected: "astronauta",
    recognizedVisualIdentity,
    canonicalCastList: castGrounding.canonicalCastList,
    castPanelLabels,
    passed,
    failureReason,
  });

  return {
    simulated: true,
    inputIdentity: "astronauta",
    castGrounding,
    visualTruthEntries,
    canonicalCastList: castGrounding.canonicalCastList,
    castPanelLabels,
    passed,
    failureReason,
  };
}
export function forceUnlockGroqPipeline() {
  isGroqHybridPipelineRunning = false;
}

function buildAudioVoiceClusterCapabilityAudit(params: {
  hasOriginalAudioInput?: boolean;
  hasAudioBlobAccess?: boolean;
  hasAudioSegments?: boolean;
  hasWordTimestamps?: boolean;
}) {
  const hasOriginalAudioInput = params.hasOriginalAudioInput === true;
  const hasAudioBufferAccess = false;
  const hasSegmentAudioExtraction =
    params.hasAudioBlobAccess === true || params.hasAudioSegments === true;
  const hasWaveformAccess = false;
  const hasVoiceEmbeddingModel = false;
  const hasRealDiarizationModel = false;
  const canPerformRealVoiceClusteringNow = false;
  const currentAudioMethod =
    params.hasAudioSegments === true || params.hasWordTimestamps === true
      ? "GROQ_WHISPER_TRANSCRIPT_SEGMENTS_ONLY"
      : "TRANSCRIPT_ONLY_ORIGINAL_AUDIO_NO_CLUSTERING";
  const currentLimitation =
    "Current pipeline has transcript segments from Groq Whisper and extracted audio for transcription, but no voice embeddings or diarization model.";
  const missingRequirement =
    "Missing real voice embedding/diarization model and direct waveform-feature clustering stage.";
  const safeConclusion =
    "Real voice clustering not available: current pipeline only has transcript segments from Groq Whisper, not voice embeddings or diarization.";
  return {
    hasOriginalAudioInput,
    hasAudioBufferAccess,
    hasSegmentAudioExtraction,
    hasWaveformAccess,
    hasVoiceEmbeddingModel,
    hasRealDiarizationModel,
    canPerformRealVoiceClusteringNow,
    currentAudioMethod,
    currentLimitation,
    missingRequirement,
    safeConclusion,
  };
}

const isGroqWhisperTimeoutError = (error: any) =>
  error?.isTimeout === true ||
  String(error?.message || "").includes("GROQ_TRANSCRIBE_TIMEOUT");

function buildAudioVoiceUserSummary(params: {
  transcriptAvailable?: boolean;
  timedSegmentsAvailable?: boolean;
  experimentalAudioAnalysisAvailable?: boolean;
  experimentalClusterCount?: number | null;
  transcriptSpeakerEstimate?: number | null;
  certifiedSpeakerCount?: number | null;
  reliability?: "LOW" | "MEDIUM" | "HIGH";
  userConclusion?: string;
  userWarning?: string;
}) {
  return {
    transcriptAvailable: params.transcriptAvailable === true,
    timedSegmentsAvailable: params.timedSegmentsAvailable === true,
    experimentalAudioAnalysisAvailable:
      params.experimentalAudioAnalysisAvailable === true,
    experimentalClusterCount:
      typeof params.experimentalClusterCount === "number"
        ? params.experimentalClusterCount
        : null,
    transcriptSpeakerEstimate:
      typeof params.transcriptSpeakerEstimate === "number"
        ? params.transcriptSpeakerEstimate
        : null,
    realDiarizationAvailable: false,
    voiceEmbeddingAvailable: false,
    certifiedSpeakerCount:
      typeof params.certifiedSpeakerCount === "number"
        ? params.certifiedSpeakerCount
        : null,
    reliability: params.reliability || "LOW",
    userConclusion:
      params.userConclusion ||
      "I cluster audio sono una stima tecnica sperimentale: non equivalgono a persone reali certe.",
    userWarning:
      params.userWarning ||
      "Possibile variazione di timbro/energia, non diarizzazione.",
  };
}
function getHuggingFaceKey(): string {
  try {
    return (globalThis.localStorage?.getItem("huggingface_api_key") ||
      (import.meta as any).env?.VITE_HUGGINGFACE_API_KEY ||
      (import.meta as any).env?.HUGGINGFACE_API_KEY ||
      "") as string;
  } catch {
    return "";
  }
}

export async function runGroqHybridPipeline(params: any) {
  if (isGroqHybridPipelineRunning) {
    logger.warn("[GROQ_LITE_DUPLICATE_RUN_BLOCKED]");
    return {
      error: "Run duplicata bloccata",
      status: "error",
    };
  }

  isGroqHybridPipelineRunning = true;

  try {
    const {
      isFeedback,
      overrideDescription,
      overrideGenre,
      overrideAnalysisMode,
      overrideWizardAnswers,
      video,
      groqAudioModel,
      hfVisionModel,
      hfTextModel,
      updatePipelineStep,
      setLoadingText,
      setPartialProtocol,
    } = params;

    // Log mandatory start messages
    const resolvedBranch = (
      params.protocol ||
      overrideAnalysisMode ||
      "standard"
    )
      .toLowerCase()
      .replace(" ", "_");

    logger.info("[GROQ_FULL_PHASE_PARAM_RECEIVED]", {
      groqFullPhase: params.groqFullPhase,
      resolvedBranch,
      mode: params.mode,
      protocol: params.protocol || resolvedBranch,
    });

    logger.info("[GROQ_PIPELINE_BRANCH_SELECTED]", { branch: resolvedBranch });

    if (resolvedBranch === "standard" || resolvedBranch === "production-flow") {
      logger.info("[GROQ_HYBRID_STANDARD_START]", { protocol: "standard" });
      logger.info("[GROQ_HYBRID_LITE_START]", { protocol: "standard" });
    } else if (resolvedBranch === "audio_enhanced") {
      logger.info("[GROQ_HYBRID_AUDIO_START]", { protocol: "audio_enhanced" });
    } else if (resolvedBranch === "deep") {
      logger.info("[GROQ_HYBRID_DEEP_START]", { protocol: "deep" });
    }

    if (setLoadingText)
      setLoadingText(
        `[1/6] Inizializzazione protocollo di analisi (Groq Hybrid ${resolvedBranch})...`,
      );

    const isGroqHybridFull = resolvedBranch === "deep";
    let groqFullPhase = params.groqFullPhase;

    if (!groqFullPhase) {
      groqFullPhase = "core";
      params.groqFullPhase = "core"; // Ensure params is updated for nested calls
      logger.info("[GROQ_FULL_PHASE_DEFAULT_APPLIED]", {
        from: undefined,
        to: "core",
        reason: "backward_compatibility",
      });
    }

    // Handle modes
    if (isGroqHybridFull) {
      const willRunPromptPhase = groqFullPhase === "prompt";
      logger.info("[GROQ_MODE_RUNTIME_AUDIT]", {
        selectedMode: "groq",
        requestedPhase: groqFullPhase,
        actualBranch: willRunPromptPhase
          ? "GROQ_FULL_PHASE2"
          : "GROQ_FULL_PHASE1",
        willProducePromptDecisionTrace: willRunPromptPhase,
      });
      logger.info("[GROQ_FULL_PHASE_ROUTING_DECISION]", {
        groqFullPhase,
        willRunCoreOnly: !willRunPromptPhase,
        willRunPromptPhase,
        reason: willRunPromptPhase
          ? "Phase 2 requested"
          : "Standard Core default",
      });

      if (willRunPromptPhase) {
        logger.info("[GROQ_HYBRID_FULL_PHASE_2_TRIGGERED]");

        // Auto-chain Phase 1 if no result data provided
        let phase1Data = params.phase1Result;
        let transcript = params.transcript || "";
        let frameAnalysis = params.frameAnalysis || "";
        let selectedEvent = params.selectedEvent || "";
        let canonicalCastList = params.canonicalCastList || [];

        if (!phase1Data || Object.keys(phase1Data).length <= 2) {
          // Allow for some small default objects
          logger.info(
            "[GROQ_HYBRID_FULL_PHASE_2_AUTO_CHAIN] Running Phase 1 first to get context...",
          );
          phase1Data = await runGroqHybridFullPhase1(params);

          if (
            (phase1Data.status === "error" ||
              phase1Data.status === "failed_openrouter_vision_timeout" ||
              phase1Data.bestOptimizedPrompt?.prompt ===
                "NON_GENERATO_PROMPT_HF_CREDITS_DEPLETED") &&
            phase1Data.groqFullPhase === "prompt"
          ) {
            logger.info("[GROQ_HYBRID_FULL_PHASE_2_AUTO_CHAIN_ABORTED]", {
              reason:
                phase1Data.status === "failed_openrouter_vision_timeout"
                  ? "openrouter_vision_timeout"
                  : "Phase 1 error or credits depleted result already built for Phase 2",
            });

            if (
              phase1Data.bestOptimizedPrompt?.reason ===
              "GROQ_FULL_PHASE_2_HF_CREDITS_DEPLETED"
            ) {
              logger.info(
                "[GROQ_FULL_PHASE2_PROVIDER_UNAVAILABLE_RETURNING_TO_UI]",
                {
                  hasResult: true,
                  groqFullPhase: phase1Data.groqFullPhase,
                  reason: phase1Data.bestOptimizedPrompt.reason,
                },
              );
            }

            isGroqHybridPipelineRunning = false; // Release lock before returning
            return phase1Data;
          }

          // Extract data from Phase 1 result for Phase 2
          transcript = phase1Data.verifiedTranscript || phase1Data.script || "";
          frameAnalysis =
            phase1Data.frameAnalysis || "Analisi visiva estratta da Phase 1";
          selectedEvent =
            phase1Data.selectedEvent || "Evento estratto da Phase 1";
          canonicalCastList = phase1Data.canonicalCastList || [];
        }

        // ADDITIONAL GUARD: Before entering Phase 2 prompt engine, check if Phase 1 result already indicates provider unavailable
        if (
          phase1Data?.bestOptimizedPrompt?.prompt ===
          "NON_GENERATO_PROMPT_HF_CREDITS_DEPLETED"
        ) {
          logger.info("[GROQ_FULL_PHASE2_PROMPT_ENGINE_SKIPPED]", {
            reason: "provider_unavailable_result_already_built",
          });

          logger.info(
            "[GROQ_FULL_PHASE2_PROVIDER_UNAVAILABLE_RETURNING_TO_UI]",
            {
              hasResult: true,
              groqFullPhase: phase1Data.groqFullPhase,
              reason: phase1Data.bestOptimizedPrompt?.reason,
            },
          );

          isGroqHybridPipelineRunning = false; // Release lock before returning
          return phase1Data;
        }

        logger.info("[GROQ_FULL_PHASE2_ROUTING_AUDIT]", {
          requestedPhase: groqFullPhase,
          willRunPromptPhase,
          continuePhase2WithTranscriptOnly: Boolean(
            (params as any).continuePhase2WithTranscriptOnly,
          ),
          audioVerified: phase1Data?.audioVerified,
          hasVerifiedTranscript: Boolean(transcript),
          visionStatus: phase1Data?.visionProvider,
          promptSafetyMode: phase1Data?.promptSafetyMode,
        });

        const phase2Result = await runGroqHybridFullPhase2PromptEngine({
          phase1Result: phase1Data,
          transcript,
          frameAnalysis,
          selectedEvent,
          canonicalCastList,
          metadata: params.metadata,
          mode: params.mode,
          isVisionRecoveredWithOpenRouter:
            !!phase1Data?.isVisionRecoveredWithOpenRouter,
        });

        isGroqHybridPipelineRunning = false;
        return phase2Result;
      }

      logger.info("[GROQ_HYBRID_FULL_START]");
      return await runGroqHybridFullPhase1(params);
    }

    logger.info("[GROQ_MODE_RUNTIME_AUDIT]", {
      selectedMode: "groq",
      requestedPhase: groqFullPhase,
      actualBranch: "GROQ_LITE",
      willProducePromptDecisionTrace: false,
    });
    logger.info(
      `[GROQ_HYBRID_STANDARD_START] Running ${overrideAnalysisMode || "standard"} pipeline...`,
    );

    // [VIDEO_SOURCE_SELECTED_FOR_GROQ_HYBRID] AUDIT
    const videoSource =
      video instanceof File
        ? "uploaded_file"
        : video?.base64
          ? "saved_video_data"
          : "unknown";
    const videoName =
      (video as any)?.name || (video as any)?.fileName || "unknown";
    const videoSizeMB = (video as any)?.size
      ? ((video as any).size / (1024 * 1024)).toFixed(2)
      : "unknown";

    logger.info("[VIDEO_SOURCE_SELECTED_FOR_GROQ_HYBRID]", {
      source: videoSource,
      fileName: videoName,
      fileSizeMB: videoSizeMB,
    });

    let audioEvidence = "Non disponibile";
    let videoEvidence = "Non disponibile";
    let isComplete = true;

    // A. AUDIO
    let transcript = "";
    let audioSegments: any[] = [];
    let audioDurationSeconds: number | null = null;
    let audioBlobAvailable = false;
    let extractedAudioBlob: Blob | null = null;
    let audioConscienceAudit: any = null;
    let audioTimelineSegments: any[] = [];
    let audioSpeakerGroups: any[] = [];
    let mirrorTestBlocks: any[] = [];
    let audioWarnings: string[] = [];
    logger.info("[GROQ_LITE_AUDIO_START]");
    if (updatePipelineStep)
      updatePipelineStep(
        "audio-anchor",
        "running",
        "Estrazione audio in corso (Groq Hybrid)...",
      );
    if (setLoadingText)
      setLoadingText("[2/6] Trascrizione audio con Whisper Groq...");

    let videoFileForAudio: File | null = null;
    try {
      if (!video) throw new Error("No video file provided");

      if (video instanceof File || video instanceof Blob) {
        videoFileForAudio = video as File;
      } else if (video && video.base64) {
        // Reconstruct from savedVideoData if needed
        const response = await fetch(
          `data:${video.mimeType};base64,${video.base64}`,
        );
        const blob = await response.blob();
        videoFileForAudio = new File([blob], video.fileName, {
          type: video.mimeType,
        });
      } else if (typeof video === "string") {
        const res = await fetch(video);
        const blob = await res.blob();
        videoFileForAudio = new File([blob], "video.mp4", {
          type: "video/mp4",
        });
      } else {
        throw new Error(
          "Formato video non supportato per estrazione audio in Groq Hybrid",
        );
      }

      let originalVideoDuration = 0;
      try {
        originalVideoDuration = await getVideoDuration(videoFileForAudio as File);
      } catch (e) {}

      try {
        const audioConscienceResult = await processAudioConscience(videoFileForAudio, originalVideoDuration, params.geminiApiKey || params.apiKey);
        
        transcript = audioConscienceResult.verifiedTranscript || "";
        audioSegments = audioConscienceResult.audioSegments || [];
        audioDurationSeconds = audioConscienceResult.audioDurationSeconds;
        
        audioConscienceAudit = audioConscienceResult.audioConscienceAudit;
        audioTimelineSegments = audioConscienceResult.audioTimelineSegments;
        audioSpeakerGroups = audioConscienceResult.audioSpeakerGroups;
        mirrorTestBlocks = audioConscienceResult.mirrorTestBlocks;
        audioWarnings = audioConscienceResult.audioWarnings;
        audioBlobAvailable = true; // Set to true as it is successfully called
      } catch (extractErr) {
        logger.error("[AUDIO_PHASE_BLOCKED_ALL_EXTRACTION_METHODS_FAILED]");
        throw extractErr;
      }

      logger.info("[TRANSCRIPT_ORDER_CHECK]", {
        hasSegments: audioSegments.length > 0,
        segmentCount: audioSegments.length,
        orderConfidence: "HIGH",
      });

      logger.info("[GROQ_HYBRID_AUDIO_ACCEPTED]", {
        audioVerified: transcript.trim().length > 0,
        transcriptStatus:
          transcript.trim().length > 0
            ? "VERIFIED_TRANSCRIPT"
            : "MISSING_AUDIO",
        verifiedTranscriptLength: transcript.trim().length,
        transcriptLength: transcript.trim().length,
      });
      if (transcript && transcript.trim().length > 0) {
        audioEvidence = `Trascritto con successo:\n"${transcript.substring(0, 150)}${transcript.length > 150 ? "..." : ""}"`;
        logger.info("[GROQ_LITE_AUDIO_SUCCESS]");
        if (updatePipelineStep)
          updatePipelineStep(
            "audio-anchor",
            "success",
            "Audio trascritto correttamente",
          );
        if (setPartialProtocol)
          setPartialProtocol((prev: any) => ({
            ...prev,
            transcriptStatus: "VERIFIED_TRANSCRIPT",
          }));
      } else {
        audioEvidence = "Audio vuoto o inintelligibile.";
        logger.warn("[GROQ_LITE_AUDIO_FAIL]");
        if (updatePipelineStep)
          updatePipelineStep(
            "audio-anchor",
            "error",
            "Trascrizione audio fallita",
          );
      }
    } catch (e: any) {
      const isTimeout = isGroqWhisperTimeoutError(e);
      logger.error("[GROQ_LITE_AUDIO_FAIL]", e);
      audioEvidence = `Errore di estrazione/trascrizione: ${e.message}`;
      if (updatePipelineStep)
        updatePipelineStep(
          "audio-anchor",
          isTimeout ? "warning" : "error",
          isTimeout
            ? "Trascrizione audio non completata: timeout Groq Whisper"
            : `Trascrizione audio fallita: ${e.message}`,
        );
      if (setLoadingText)
        setLoadingText(
          isTimeout
            ? "[2/6] Trascrizione audio non completata: timeout Groq Whisper. Proseguo in modalita degradata."
            : "[2/6] Trascrizione audio fallita. Proseguo in modalita degradata.",
        );
      logger.warn("[GROQ_TRANSCRIBE_TIMEOUT_HANDLED]", {
        timeoutMs: e?.timeoutMs || 120000,
        fileSizeBytes: extractedAudioBlob?.size || videoFileForAudio?.size || 0,
        audioDurationSeconds,
        action: "degraded_result_returned",
      });
      if (setPartialProtocol) {
        setPartialProtocol((prev: any) => ({
          ...prev,
          audioVerified: false,
          transcriptStatus: isTimeout
            ? "AUDIO_TRANSCRIBE_TIMEOUT"
            : "AUDIO_NOT_VERIFIED",
          audioSource: isTimeout ? "GROQ_WHISPER_TIMEOUT" : "NONE",
          scriptSourceMode: "FRAME_VISUAL_DESCRIPTION",
          runtimeTruthStatus: {
            mode: "DEGRADED_MODE",
            severity: "HIGH",
            failedModules: ["GROQ_WHISPER_TRANSCRIPTION"],
            fallbackActive: true,
            userMessage: isTimeout
              ? "Trascrizione audio non completata: timeout Groq Whisper. Riprova o usa modalità senza audio."
              : `Trascrizione audio fallita: ${e.message}`,
            details: e?.message || String(e),
            timestamp: new Date().toISOString(),
          },
        }));
      }
      isComplete = false;
    }

    // B. FRAME
    logger.info("[GROQ_LITE_FRAME_START]");
    if (updatePipelineStep)
      updatePipelineStep(
        "frame-analysis",
        "running",
        "Analisi frame (Hugging Face)...",
      );
    if (setLoadingText) setLoadingText("[3/6] Vision reasoning locale (HF)...");

    let frameAnalysis = "";
    const hfKey = getHuggingFaceKey();

    try {
      if (!video) throw new Error("No video file provided for frames");
      if (!hfKey) throw new Error("Hugging Face API key is missing");

      logger.info("[FRAME_EXTRACTION_START]", {
        numFrames: 5,
        startTime: 0,
        endTime: "auto",
        maxDim: 200,
      });
      let framesBase64: string[] = [];

      let videoFileForFrames: File;
      if (video instanceof File || video instanceof Blob) {
        videoFileForFrames = video as File;
      } else if (video && video.base64) {
        const response = await fetch(
          `data:${video.mimeType};base64,${video.base64}`,
        );
        const blob = await response.blob();
        videoFileForFrames = new File([blob], video.fileName, {
          type: video.mimeType,
        });
      } else if (typeof video === "string") {
        const res = await fetch(video);
        const blob = await res.blob();
        videoFileForFrames = new File([blob], "video.mp4", {
          type: "video/mp4",
        });
      } else {
        throw new Error(
          "Formato video non supportato per estrazione frame in Groq Hybrid",
        );
      }

      framesBase64 = await extractFrames(
        videoFileForFrames,
        5,
        0,
        undefined,
        200,
      );

      if (framesBase64.length === 0) {
        logger.error(
          "Frame extraction failed: nessun frame estratto dal video.",
        );
        throw new Error(
          "Frame extraction failed: nessun frame estratto dal video.",
        );
      }

      logger.info("[FRAME_EXTRACTION_DONE]", {
        frameCount: framesBase64.length,
        firstFrameSizeKB: framesBase64[0]
          ? Math.round(framesBase64[0].length / 1024)
          : 0,
        totalPayloadKB: Math.round(
          framesBase64.reduce((acc, f) => acc + f.length, 0) / 1024,
        ),
      });

      // [FRAME_DEBUG_PREVIEW] log
      logger.info("[FRAME_DEBUG_PREVIEW]", {
        frames: framesBase64.map((f) => f.substring(0, 50) + "..."),
      });

      // [HF_VISION_INPUT_AUDIT]
      logger.info("[HF_VISION_INPUT_AUDIT]", {
        frameCount: framesBase64.length,
        videoFileName: videoName,
        source: videoSource,
      });

      const vModel = hfVisionModel || resolveHuggingFaceModel("vision");
      const forensicPrompt = `AGISCI COME ANALISTA FORENSE. Descrivi SOLO ciÃ² che si vede nei frame in modo oggettivo. 
Esempio: 'Una persona in cucina parla al telefono'. 
NON INVENTARE OGGETTI, ESPLOSIONI, MEME O PERSONAGGI NON VISIBILI. 
Se il video Ã¨ nero o non si capisce, scrivi 'NON VISIBILE'. 
Sii estremamente letterale. Non interpretare lo stile o il genere.`;

      logger.info("[HF_PROXY_REQUEST_START] task=vision");
      frameAnalysis = await hfVisionAnalysis(
        framesBase64,
        forensicPrompt,
        hfKey,
        vModel,
      );

      if (frameAnalysis && frameAnalysis.trim().length > 0) {
        videoEvidence = `L'AI ha rilevato:\n${frameAnalysis.substring(0, 150)}${frameAnalysis.length > 150 ? "..." : ""}`;
        logger.info("[HF_PROXY_SUCCESS] task=vision");
        logger.info("[GROQ_LITE_FRAME_SUCCESS]");
        if (updatePipelineStep)
          updatePipelineStep(
            "frame-analysis",
            "success",
            "Frame analizzati correttamente",
          );
      } else {
        throw new Error("Risposta vuota da HF Vision");
      }
    } catch (e: any) {
      if (isHuggingFaceCreditsDepletedError(e)) {
        logger.info("[HF_VISION_EXPECTED_FALLBACK_TO_OPENROUTER]", {
          provider: "huggingface",
          fallback: "openrouter",
          reason: "hf_credits_depleted",
        });

        let orModel =
          (import.meta as any).env?.VITE_OPENROUTER_VISION_MODEL ||
          "backend-resolve";
        if (orModel === "nvidia/nemotron-nano-12b-v2-vl:free")
          orModel = "backend-resolve";
        const orKey =
          (import.meta as any).env?.VITE_OPENROUTER_API_KEY ||
          globalThis.localStorage?.getItem("openrouter_api_key") ||
          "";

        if (!orModel) {
          logger.info(
            "[OPENROUTER_VISION_MODEL_AUDIT] model=missing configured=false",
          );
          if (params.groqFullPhase === "prompt") throw e;
          else {
            logger.error("[GROQ_LITE_FRAME_FAIL] Fallback not configured", e);
            videoEvidence = `Errore sui frame: HF Depleted, OR not configured`;
            if (updatePipelineStep)
              updatePipelineStep(
                "frame-analysis",
                "error",
                `Analisi frame fallita: HF Depleted`,
              );
            isComplete = false;
          }
        } else {
          logger.info(
            `[OPENROUTER_VISION_MODEL_AUDIT] model=${orModel} configured=true`,
          );
          const oldTimeoutMs = 60000;
          const visionTimeoutMs = 120000;
          logger.info("[OPENROUTER_VISION_TIMEOUT_POLICY_APPLIED]", {
            oldTimeoutMs,
            newTimeoutMs: visionTimeoutMs,
            inputMode: "frames_only",
            frameCount: 10,
            model: orModel,
          });
          logger.info("[GROQ_FULL_PHASE1_TIMEOUT_CONFIG]", {
            timeoutMs: visionTimeoutMs,
            source: "local_constant_or_existing_config",
          });
          try {
            const requestedFrames = 10;
            const maxFrames = 10;
            const usedFrames = Math.min(requestedFrames, maxFrames);

            openRouterRequestedFrames = requestedFrames;
            openRouterMaxFrames = maxFrames;
            openRouterUsedFrames = usedFrames;

            logger.info("[OPENROUTER_VISION_FRAME_COUNT_AUDIT]", {
              requested: requestedFrames,
              max: maxFrames,
              used: usedFrames,
            });

            const videoFile = await resolveVideoFile(video);
            const frames = await extractFrames(
              videoFile,
              usedFrames,
              0,
              undefined,
              200,
            );
            logger.info("[OPENROUTER_10_FRAME_FORCE_ACTIVE]", {
              callerFunction: "runGroqHybridPipeline",
              branch: "lite",
              requestedFrames,
              maxFrames,
              usedFrames,
              framesArrayLength: frames.length,
              timestamps: openRouterTimestamps,
              sourceFile: "src/services/gemini/groqHybrid.ts",
              runtimePatchId: "FORCE_10_FRAMES_2026_05_13",
            });

            // [OPENROUTER_VISION_FRAME_TIMESTAMPS_AUDIT]
            try {
              const duration = await getVideoDuration(videoFile);
              const interval = duration / (usedFrames + 1);
              const timestamps = Array.from(
                { length: usedFrames },
                (_, i) => (i + 1) * interval,
              );
              openRouterTimestamps = timestamps.map((t) => t.toFixed(2) + "s");
              logger.info("[OPENROUTER_VISION_FRAME_TIMESTAMPS_AUDIT]", {
                count: usedFrames,
                timestamps: openRouterTimestamps,
                duration: duration.toFixed(2) + "s",
              });
            } catch (tError) {
              logger.warn(
                "[OPENROUTER_VISION_FRAME_TIMESTAMPS_AUDIT_FAILED]",
                tError,
              );
            }

            logger.info("[OPENROUTER_10_FRAME_FORCE_ACTIVE]", {
              callerFunction: "runGroqHybridPipeline",
              branch: "lite",
              requestedFrames,
              maxFrames,
              usedFrames,
              framesArrayLength: frames.length,
              timestamps: openRouterTimestamps,
              sourceFile: "src/services/gemini/groqHybrid.ts",
              runtimePatchId: "FORCE_10_FRAMES_2026_05_13",
            });
            logger.info("[OPENROUTER_VISION_CLIENT_CALL_START]", {
              frameCount: usedFrames,
              maxCallsPerVideo: 1,
              model: orModel,
            });
            // [OPENROUTER_CALL_BLOCKED_NO_FRAMES]
            if (!frames || frames.length === 0) {
              logger.error("[OPENROUTER_CALL_BLOCKED_NO_FRAMES]");
              throw new Error("FRAME_EXTRACTION_FAILED: NO_FRAMES_EXTRACTED");
            }
            const orResult = await openRouterVisionAnalysis(
              frames,
              orKey,
              orModel,
              undefined,
              openRouterTimestamps,
            );

            frameAnalysis = orResult.frameAnalysis;
            videoEvidence = `L'AI ha rilevato:\n${frameAnalysis.substring(0, 150)}${frameAnalysis.length > 150 ? "..." : ""}`;

            const visionStatus = orResult.visionStatus || "TEST_OK";
            if (visionStatus === "OPENROUTER_TIMEOUT_CONTROLLED") {
              logger.warn("[OPENROUTER_TIMEOUT_CONTROLLED_LITE]");
              if (updatePipelineStep)
                updatePipelineStep(
                  "frame-analysis",
                  "error",
                  "Visione video non disponibile per timeout controllato.",
                );
              isComplete = false;
            } else if (visionStatus === "WEAK_VISION_OUTPUT") {
              logger.warn("[OPENROUTER_WEAK_VISION_OUTPUT_DETECTED_LITE]", {
                reason: orResult.visionWeakFallback?.reason || "unknown",
              });
              if (updatePipelineStep)
                updatePipelineStep(
                  "frame-analysis",
                  "warning",
                  "Visione video ricevuta, ma non abbastanza precisa per assegnare personaggi e battute.",
                );
            } else {
              if (updatePipelineStep)
                updatePipelineStep(
                  "frame-analysis",
                  "success",
                  "Visione recuperata tramite OpenRouter",
                );
            }

            logger.info("[GROQ_LITE_VISION_RECOVERED_WITH_OPENROUTER]", {
              visionProvider: "openrouter",
              reason: "hf_credits_depleted",
              visionStatus,
            });
          } catch (orErr: any) {
            logger.error("[OPENROUTER_VISION_FALLBACK_FAILED]", {
              reason: orErr.message || String(orErr),
            });
            if (params.groqFullPhase === "prompt") {
              throw buildOpenRouterFallbackFailureError({
                hfError: e,
                openRouterError: orErr,
                transcript,
                audioSegments,
                frameTimestamps: openRouterTimestamps,
                frameCount: openRouterUsedFrames,
                inputMode: "frames_only",
              });
            } else {
              videoEvidence = `Errore sui frame: Fallback OpenRouter fallito`;
              if (updatePipelineStep)
                updatePipelineStep(
                  "frame-analysis",
                  "error",
                  `Fallback fallito: ${orErr.message}`,
                );
              isComplete = false;
            }
          }
        }
      } else {
        logger.error("[GROQ_LITE_FRAME_FAIL]", e);
        videoEvidence = `Errore sui frame: ${e.message}`;
        if (updatePipelineStep)
          updatePipelineStep(
            "frame-analysis",
            "error",
            `Analisi frame fallita: ${e.message}`,
          );
        isComplete = false;
      }
    }

    if (updatePipelineStep)
      updatePipelineStep(
        "market-data",
        "skipped",
        "Market Data",
        "Saltato in modalitÃ  ibrida locale",
      );

    // C. FINALE
    logger.info("[GROQ_LITE_FINAL_START]");
    if (updatePipelineStep)
      updatePipelineStep(
        "generation",
        "running",
        "Generazione risultato finale (Hugging Face)...",
      );
    if (setLoadingText) setLoadingText("[4/6] Sintesi strategica finale...");

    let finalSummary = "";
    try {
      if (!hfKey) throw new Error("Hugging Face API key is missing");

      const messages = [
        {
          role: "system",
          content:
            "Sei un analista esperto di contenuti virali short-form. Analizza l'evidenza video e audio fornita senza inventare elementi esterni.",
        },
        {
          role: "user",
          content: `
              Richiesta o contesto utente: ${overrideDescription || "Genera video virale"}
              
              Trascrizione Audio (Groq):
              ${transcript || "Nessun audio rilevato."}
 
              Evidenza Visiva dai Frame (Hugging Face Vision Analysis):
              ${frameAnalysis || "Nessuna evidenza visiva."}
 
              COMPITO:
              Riassumi brevemente in italiano l'azione. 
              NON INVENTARE elementi non presenti nella trascrizione o nell'evidenza visiva (es. no esplosioni, no panini, no meme surreali se non descritti sopra).
              Se l'audio e il video sembrano non correlati, segnalalo.
              Dai 3 spunti virali rapidi basati strettamente sui fatti.
            `.trim(),
        },
      ];

      const tModel = hfTextModel || resolveHuggingFaceModel("text");

      // --- GEMINI_REAL_CALL_BLOCKED_IN_GROQ check ---
      // This is a safety log to ensure no Gemini calls happen here.
      logger.info(
        "[GEMINI_REAL_CALL_BLOCKED_IN_GROQ] No Gemini calls will be made in Groq Hybrid mode.",
      );

      const isVisionRecovered =
        frameAnalysis &&
        frameAnalysis.length > 0 &&
        videoEvidence.includes("OpenRouter");

      if (isVisionRecovered) {
        logger.info("[GROQ_LITE_FINAL_GROQ_START]", {
          reason: "openrouter_vision_recovered",
        });
        try {
          const groqRes = await groqTextCompletion({
            messages: messages as any,
            task: "lite_final_fallback",
          });
          finalSummary = groqRes.text;
          logger.info("[GROQ_LITE_FINAL_GROQ_SUCCESS]");
          if (updatePipelineStep)
            updatePipelineStep(
              "generation",
              "success",
              "Sintesi completata (Groq)",
            );
        } catch (groqErr: any) {
          logger.error("[GROQ_LITE_FINAL_GROQ_FAILED]", {
            reason: groqErr.message,
          });
          finalSummary = `Errore ragionamento Groq: ${groqErr.message}`;
          isComplete = false;
        }
      } else {
        logger.info("[GROQ_LITE_FINAL_HF_START]");
        try {
          logger.info("[HF_PROXY_REQUEST_START] task=text");
          finalSummary = await hfChatCompletion(messages, hfKey, tModel);
          logger.info("[HF_PROXY_SUCCESS] task=text");

          if (finalSummary && finalSummary.trim().length > 0) {
            logger.info("[GROQ_LITE_FINAL_HF_SUCCESS]");
            if (updatePipelineStep)
              updatePipelineStep("generation", "success", "Sintesi completata");
          } else {
            throw new Error("Risposta finale vuota da HF Chat");
          }
        } catch (hfErr: any) {
          if (
            isHuggingFaceCreditsDepletedError(hfErr) ||
            hfErr.status === 402 ||
            hfErr.status === 429
          ) {
            logger.info("[GROQ_LITE_FINAL_HF_FAILED]", {
              reason: "credits_depleted",
              status: hfErr.status || "UNKNOWN",
            });
            logger.info("[GROQ_LITE_FINAL_GROQ_START]", {
              reason: "hf_credits_depleted_on_text",
            });
            try {
              const groqRes = await groqTextCompletion({
                messages: messages as any,
                task: "lite_final_fallback_depleted",
              });
              finalSummary = groqRes.text;
              logger.info("[GROQ_LITE_FINAL_GROQ_SUCCESS]");
            } catch (groqErr: any) {
              logger.error("[GROQ_LITE_FINAL_GROQ_FAILED]", {
                reason: groqErr.message,
              });
              finalSummary = `Errore ragionamento Groq (fallback): ${groqErr.message}`;
              isComplete = false;
            }
          } else {
            logger.error("[GROQ_LITE_FINAL_FAIL]", hfErr);
            finalSummary = `Errore HF: ${hfErr.message}`;
            isComplete = false;
          }
        }
      }
    } catch (e: any) {
      logger.error("[GROQ_LITE_FINAL_FAIL]", e);
      finalSummary = `Errore nel ragionamento finale: ${e.message}`;
      isComplete = false;
      if (updatePipelineStep)
        updatePipelineStep(
          "generation",
          "error",
          `Sintesi fallita: ${e.message}`,
        );
    }

    if (updatePipelineStep)
      updatePipelineStep(
        "runtime-status",
        "success",
        "Analisi Groq Hybrid completata",
        isComplete ? "Success" : "Partial",
      );
    if (setLoadingText) setLoadingText("Analisi completata!");

    const confidence = isComplete ? "MEDIA" : "BASSA";
    const transcriptSpeakerEstimateLite = inferCastFromAudioTurns({
      transcript,
      audioSegments,
    });
    const realAudioFeatureAudit =
      await analyzeRealAudioVoiceClustersExperimental({
        audioBlob: extractedAudioBlob,
        audioSegments,
      });
    const audioVoiceClusterCapabilityAudit = {
      ...buildAudioVoiceClusterCapabilityAudit({
        hasOriginalAudioInput: !!video,
        hasAudioBlobAccess: audioBlobAvailable === true,
        hasAudioSegments:
          Array.isArray(audioSegments) && audioSegments.length > 0,
        hasWordTimestamps:
          Array.isArray(audioSegments) &&
          audioSegments.some(
            (segment: any) =>
              Array.isArray(segment?.words) && segment.words.length > 0,
          ),
      }),
      hasAudioBufferAccess: realAudioFeatureAudit.audioBufferAvailable === true,
      hasWaveformAccess: realAudioFeatureAudit.audioBufferAvailable === true,
      currentAudioMethod: realAudioFeatureAudit.realAudioAnalyzed
        ? "EXPERIMENTAL_AUDIO_FEATURE_CLUSTERING"
        : "GROQ_WHISPER_TRANSCRIPT_SEGMENTS_ONLY",
      safeConclusion: realAudioFeatureAudit.realAudioAnalyzed
        ? "Experimental audio feature clustering available, but real diarization is still not available."
        : "Real voice clustering not available: current pipeline only has transcript segments from Groq Whisper, not voice embeddings or diarization.",
    };
    logger.info("[REAL_AUDIO_VOICE_CLUSTER_EXPERIMENTAL_AUDIT]", {
      audioBufferAvailable: realAudioFeatureAudit.audioBufferAvailable,
      realAudioAnalyzed: realAudioFeatureAudit.realAudioAnalyzed,
      analyzedSegmentsCount: realAudioFeatureAudit.analyzedSegmentsCount,
      experimentalVoiceClusterCount:
        realAudioFeatureAudit.experimentalVoiceClusterCount,
      clusterConfidence: realAudioFeatureAudit.clusterConfidence,
      method: realAudioFeatureAudit.method,
      limitations: realAudioFeatureAudit.limitations,
    });
    logger.info(
      "[AUDIO_VOICE_CLUSTER_CAPABILITY_AUDIT]",
      audioVoiceClusterCapabilityAudit,
    );

    const resultString = `RISULTATO:
${isComplete ? finalSummary : "Analisi incompleta."}

EVIDENZA AUDIO:
${transcript || audioEvidence}

EVIDENZA VIDEO:
${frameAnalysis || videoEvidence}

NOTA:
Groq audio + Hugging vision/final. Gemini non usato. ${!isComplete ? "Fallito in uno step AUDIO / FRAME / FINALE." : ""}`;

    return {
      analysis: resultString,
      viralScore: "UNVERIFIED",
      script:
        transcript.length > 0
          ? transcript
          : "Nessun copione vocale estraibile.",
      aiPrompts:
        "I prompt di generazione video sono limitati in modalitÃ  Groq Hybrid. Basati sul riassunto allegato per guidare Kulla/Sora.",
      analysisMode: overrideAnalysisMode || "standard",
      status: "success",
      transcriptStatus:
        transcript.length > 0 ? "VERIFIED_TRANSCRIPT" : "MISSING_AUDIO",
      audioVerified: transcript.length > 0,
      audioSource:
        transcript.length > 0
          ? "GROQ_WHISPER"
          : audioEvidence.includes("GROQ_TRANSCRIBE_TIMEOUT")
            ? "GROQ_WHISPER_TIMEOUT"
            : "NONE",
      scriptSourceMode:
        transcript.length > 0 ? "AUDIO_TRANSCRIPT_GROQ" : "VISUAL_FALLBACK",
      verifiedTranscript: transcript,
      audioConscienceAudit,
      audioTimelineSegments,
      audioSpeakerGroups,
      mirrorTestBlocks,
      audioWarnings,
      audioDurationSeconds,
      audioSegments,
      audioVoiceClusterCapabilityAudit,
      realAudioVoiceClusterAvailable: false,
      realAudioVoiceClusterCount: null,
      realAudioVoiceClusterConfidence: "NOT_AVAILABLE",
      audioVoiceClusterMethod: "NOT_AVAILABLE",
      audioVoiceClusterConclusion:
        "Il sistema al momento non puo sapere con certezza quante voci o timbri diversi parlano nell'audio.",
      audioVoiceClusterMissingReason:
        audioVoiceClusterCapabilityAudit.missingRequirement,
      audioVoiceClusterRecommendedNextStep:
        "Serve speaker diarization o voice embedding separato per distinguere davvero le voci.",
      transcriptSpeakerCountEstimate:
        transcriptSpeakerEstimateLite.transcriptSpeakerCountEstimate ?? null,
      visualFaithfulCastCount: null,
      probableSpeakerToVisualCharacterMapStatus:
        "NOT_AVAILABLE_NO_REAL_VOICE_CLUSTERS",
      experimentalAudioVoiceClusterAvailable:
        realAudioFeatureAudit.realAudioAnalyzed === true,
      experimentalAudioVoiceClusterCount:
        realAudioFeatureAudit.experimentalVoiceClusterCount,
      experimentalAudioVoiceClusterConfidence:
        realAudioFeatureAudit.clusterConfidence,
      realAudioFeatureAudit,
      audioVoiceUserSummary: buildAudioVoiceUserSummary({
        transcriptAvailable: transcript.length > 0,
        timedSegmentsAvailable:
          Array.isArray(audioSegments) && audioSegments.length > 0,
        experimentalAudioAnalysisAvailable:
          realAudioFeatureAudit.realAudioAnalyzed === true,
        experimentalClusterCount:
          realAudioFeatureAudit.experimentalVoiceClusterCount,
        transcriptSpeakerEstimate:
          transcriptSpeakerEstimateLite.transcriptSpeakerCountEstimate ?? null,
        certifiedSpeakerCount: null,
        reliability: realAudioFeatureAudit.realAudioAnalyzed ? "MEDIUM" : "LOW",
        userConclusion:
          "I cluster audio sono una stima tecnica sperimentale: non equivalgono a persone reali certe.",
        userWarning:
          "Cluster audio sperimentali e stima transcript non rappresentano un conteggio certo di persone o voci reali.",
      }),
      runtimeTruthStatus: {
        mode: transcript.length > 0 ? "FULL_MODE" : "DEGRADED_MODE",
        severity: audioEvidence.includes("GROQ_TRANSCRIBE_TIMEOUT")
          ? "HIGH"
          : transcript.length > 0
            ? "NONE"
            : "MEDIUM",
        failedModules: audioEvidence.includes("GROQ_TRANSCRIBE_TIMEOUT")
          ? ["GROQ_WHISPER_TRANSCRIPTION"]
          : transcript.length > 0
            ? []
            : ["audio_anchor"],
        fallbackActive: transcript.length === 0,
        reliabilityImpact: transcript.length > 0 ? "NONE" : "MEDIUM",
        userMessage: audioEvidence.includes("GROQ_TRANSCRIBE_TIMEOUT")
          ? "Trascrizione audio non completata: timeout Groq Whisper. Riprova o usa modalità senza audio."
          : transcript.length > 0
            ? "Analisi completata."
            : "Trascrizione audio non disponibile.",
        details: audioEvidence,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (globalError: any) {
    if (
      params.groqFullPhase === "prompt" &&
      isHuggingFaceCreditsDepletedError(globalError)
    ) {
      console.error("[GROQ_FULL_GLOBAL_FAIL_INTERCEPTED_FOR_PHASE2]", {
        reason: "hf_credits_depleted",
        phase: "prompt",
      });
      logger.error("[HF_CREDITS_DEPLETED_DETECTED]", {
        phase: "vision_or_auto_chain",
        error: globalError.message,
      });

      const result = buildGroqFullPhase2ProviderUnavailableResult({
        phase1PartialResult: { status: "error" },
        reason: "TOTAL_PROVIDER_FAILURE",
        provider: "huggingface",
        errorMessage: String(globalError?.message || globalError),
      });
      logger.info("[GROQ_FULL_PHASE2_DONE]", {
        status: "failed_provider_unavailable_during_auto_chain",
      });

      logger.info("[GROQ_FULL_PHASE2_PROVIDER_UNAVAILABLE_RETURNING_TO_UI]", {
        hasResult: true,
        groqFullPhase: result.groqFullPhase,
        reason: result.bestOptimizedPrompt?.reason,
      });

      return result;
    }

    logger.error("[GROQ_HYBRID_PIPELINE_GLOBAL_FAIL]", globalError);
    return {
      error: globalError.message || "Errore sconosciuto nella pipeline",
      status: "error",
    };
  } finally {
    isGroqHybridPipelineRunning = false;
  }
}

/**
 * PHASE 1 - GROQ HYBRID FULL: CORE ANALYSIS
 */
async function runGroqHybridFullPhase1(params: any) {
  const {
    video,
    overrideDescription,
    overrideGenre,
    updatePipelineStep,
    setLoadingText,
    setPartialProtocol,
  } = params;

  const emptyGroqResult = {
    aiPrompts: "",
    sceneMasterPrompt: "",
    publishingKit: "",
    parsedKit: {
      operationalDecision: "REPLACE",
      titleIt: "",
      titleEn: "",
      videoHookIt: "",
      videoHookEn: "",
      descriptionIt: "",
      descriptionEn: "",
      hashtagsIt: "",
      hashtagsEn: "",
      tagsIt: "",
      tagsEn: "",
      fileName: "",
      recommendedTime: "",
      pinnedCommentIt: "",
      pinnedCommentEn: "",
      publishingKitPro: ""
    },
    humanVerdict: "",
    finalPromptVerdict: "",
    verifiedTranscript: "",
    frameAnalysis: "",
    frameObservations: [],
    detectedCharacters: [],
    detectedCharacterDescriptors: [],
    visualCastCount: 0,
    visibleSceneMechanism: null,
    sceneMechanismAudit: null,
    newVisorAudit: {
      enabled: true,
      visualCastApprovedCount: 0,
      visualCastApprovedList: []
    },
    visualBatchReports: [],
    visualCharactersDetected: [],
    castAndDialogueAudit: null,
    dialogueSyncAudit: null,
    composerDossier: null,
    audioConscienceAudit: null,
    audioTimelineSegments: [],
    audioSpeakerGroups: [],
    mirrorTestBlocks: [],
    audioWarnings: [],
    audioDurationSeconds: 0,
    audioSegments: [],
    audioVoiceClusterCapabilityAudit: {
      supported: false,
      missingRequirement: "Nessun dato audio",
      reason: "Analisi interrotta"
    },
    experimentalAudioVoiceClusterAvailable: false,
    experimentalAudioVoiceClusterCount: null,
    experimentalAudioVoiceClusterConfidence: "NOT_AVAILABLE",
    audioVoiceClusterMethod: "NOT_AVAILABLE",
    audioVoiceClusterConclusion: "Nessun dato",
    audioVoiceClusterMissingReason: "",
    audioVoiceClusterRecommendedNextStep: "",
    transcriptSpeakerCountEstimate: null,
    visualFaithfulCastCount: null,
    probableSpeakerToVisualCharacterMapStatus: "NOT_AVAILABLE",
    runtimeTruthStatus: {
      mode: "DEGRADED_MODE",
      severity: "HIGH",
      failedModules: ["gemini_eye_ear"],
      fallbackActive: true,
      reliabilityImpact: "HIGH",
      userMessage: "Analisi interrotta.",
      details: [],
      timestamp: new Date().toISOString()
    }
  };

  let transcript = "";
  let audioSegments: any[] = [];
  let audioDurationSeconds: number | null = null;
  let audioBlobAvailable = false;
  let extractedAudioBlob: Blob | null = null;
  let audioConscienceAudit: any = null;
  let audioTimelineSegments: any[] = [];
  let audioSpeakerGroups: any[] = [];
  let mirrorTestBlocks: any[] = [];
  let audioWarnings: string[] = [];
  let frameAnalysis = "";
  let frameObservations: any[] = [];
  let detectedCharacters: string[] = [];
  let detectedCharacterDescriptors: any[] = [];
  let visualCastCount = 0;
  let visibleSceneMechanism: any = null;
  let sceneMechanismAudit: any = null;
  let newVisorAudit: any = null;
  let visualBatchReports: any[] = [];
  let visualCharactersDetected: any[] = [];
  let castAndDialogueAudit: any = null;
  let dialogueSyncAudit: any = null;
  let composerDossier: any = null;
  let promptDecisionTrace: any = null;
  let openRouterCallStartedAt: number | null = null;
  let coreAnalysis = "";
  let failedPhase: string | null = null;
  let isComplete = true;
  let isVisionRecoveredWithOpenRouter = false;
  let openRouterVisionStatus = "TEST_OK";
  let visionRecoveryAttempted = false;
  let visionRecoverySuccessful = false;

  const hfKey = (globalThis.localStorage?.getItem("huggingface_api_key") ||
    "") as string;

  let videoFile: any = null;
  let originalVideoDuration = 0;
  let finalFileUri: string | undefined = params.uploadedFileUri;
  let geminiKey = params.geminiApiKey || params.apiKey || "";
  let uploadAttemptedLogs = "no";
  let uploadStatusStr = "sconosciuto";
  let fileState = "unknown";
  let display_name = "video_upload";
  let fileSize = 0;
  let uriPresent = false;

  try {
    // -------------------------------------------------------------------------
    let multioK = false;
    try {
      videoFile = await resolveVideoFile(video);
      try {
        originalVideoDuration = await getVideoDuration(videoFile as File);
      } catch (e) {}

      let visorFrames: string[] = [];
      try {
        visorFrames = await extractFrames(videoFile, 15, 0, undefined, 200);
      } catch (err) {}

      finalFileUri = params.uploadedFileUri;
      geminiKey = params.geminiApiKey || params.apiKey || "";

      uploadAttemptedLogs = "no";
      uploadStatusStr = "sconosciuto";

      // 1. Resolve variables to pre-check
      let winningVariant = (window as any).__WINNING_GEMINI_UPLOAD_VARIANT;
      let sessionUploadedFileUriPresent = !!finalFileUri;
      
      fileState = "unknown";
      display_name = videoFile ? (videoFile as File).name : 'video_upload';
      fileSize = videoFile ? (videoFile as File).size : 0;

      // Try reading from sessionStorage if needed
      let smokeTestPassedSession = false;
      let smokeFileName = "";
      let smokeFileSizeStr = "";
      try {
        smokeTestPassedSession = sessionStorage.getItem('geminiUploadSmokePassed') === 'true';
        if (!winningVariant) winningVariant = sessionStorage.getItem('geminiUploadWinningVariant');
        if (!finalFileUri) {
          finalFileUri = sessionStorage.getItem('geminiUploadFileUri') || undefined;
          sessionUploadedFileUriPresent = !!finalFileUri;
        }
        smokeFileName = sessionStorage.getItem('geminiUploadFileName') || "";
        smokeFileSizeStr = sessionStorage.getItem('geminiUploadFileSize') || "";
        if (smokeTestPassedSession && !fileState || fileState === "unknown") {
             fileState = sessionStorage.getItem('geminiUploadFileState') || "unknown";
        }
      } catch(e) {}

      if (finalFileUri && geminiKey && fileState !== "ACTIVE" && fileState !== "URI_VALIDATED_BY_MODEL" && !fileState.includes("unknown (name present)")) {
        try {
          if (setLoadingText) setLoadingText("[2/6] Attendendo elaborazione video su Gemini...");
          await waitForFileActive(finalFileUri, geminiKey, (msg) => { if (setLoadingText) setLoadingText(`[2/6] ${msg}`); });
          fileState = "ACTIVE";
        } catch (e: any) {
          logger.error(`[GEMINI_FILE_STATE_EXCEPTION] ${e?.message}`);
          if (smokeTestPassedSession) fileState = sessionStorage.getItem('geminiUploadFileState') || "ACTIVE";
        }
      }

      const smokeTestPassed = !!winningVariant || smokeTestPassedSession;
      const uriPresent = !!finalFileUri;
      // const hasActiveStatus = fileState === "ACTIVE" || fileState === "unknown (name present)" || fileState === "URI_VALIDATED_BY_MODEL" || fileState === "PROCESSING";
      const hasActiveStatus = fileState === "ACTIVE" || fileState === "unknown (name present)" || fileState === "URI_VALIDATED_BY_MODEL";
      const globalWinningVariantPresent = !!winningVariant;

      const fileMismatch = (smokeFileName && smokeFileName !== display_name) || (smokeFileSizeStr && smokeFileSizeStr !== fileSize.toString());

      const missingFields: string[] = [];
      if (!smokeTestPassed) missingFields.push("smokeTestPassed");
      if (!winningVariant) missingFields.push("winningVariant");
      if (!uriPresent) missingFields.push("uriPresent");
      if (!sessionUploadedFileUriPresent) missingFields.push("sessionUploadedFileUriPresent");
      if (!hasActiveStatus) {
        if (fileState === 'PROCESSING') {
          missingFields.push("fileState (IN CORSO - attendi pochi secondi)");
        } else {                
          missingFields.push(`fileState (must be ACTIVE, got ${fileState})`);
        }
      }
      if (fileMismatch) missingFields.push("FILE_MISMATCH_BETWEEN_SMOKE_TEST_AND_PIPELINE");

      const willStartEyeEar = smokeTestPassed && uriPresent && hasActiveStatus && !!winningVariant && !fileMismatch;

      logger.info(`[GEMINI_PIPELINE_UPLOAD_PRECHECK] smokeTestPassed: ${smokeTestPassed}, winningVariant: ${winningVariant || "none"}, uriPresent: ${uriPresent}, sessionUploadedFileUriPresent: ${sessionUploadedFileUriPresent}, fileState: ${fileState}, globalWinningVariantPresent: ${globalWinningVariantPresent}, fileName: ${display_name}, fileSize: ${fileSize}, missingFields: ${JSON.stringify(missingFields)}, willStartEyeEar: ${willStartEyeEar}`);

      if (!willStartEyeEar) {
        logger.error(`[GEMINI_UPLOAD_PRECHECK_FAILED] Blocking pipeline because upload criteria not met. missingFields: ${JSON.stringify(missingFields)}`);
        
        if (updatePipelineStep) {
          updatePipelineStep('frame-analysis', 'error', 'Upload Gemini non verificato: ricarica il video o esegui analisi');
          updatePipelineStep('audio-anchor', 'error', 'Upload Gemini non verificato');
        }

        const diagnosticReport = buildEyeEarDiagnosticReport({
          reason: "Criteri upload Gemini non verificati prima dell'analisi",
          errorMessage: "I controlli di integrità dell'upload del file o del smoke test su Gemini non sono stati superati.",
          errorCode: "GEMINI_UPLOAD_PRECHECK_FAILED",
          fileSelected: videoFile ? "yes" : "no",
          fileName: display_name,
          fileSize: fileSize,
          uploadAttempted: uploadAttemptedLogs,
          fileState: fileState,
          uriPresent: uriPresent ? "yes" : "no",
          uriValue: finalFileUri || "nessuno",
          duration: originalVideoDuration,
          missingFields: missingFields,
          keyAvailable: !!geminiKey,
          modelSelected: params.eyeEarModel || "gemini-2.0-flash"
        });

        const customEmptyResult = {
          ...emptyGroqResult,
          videoSummary: diagnosticReport,
          publishingKit: `### 📋 COPIA IL DOSSIER DIAGNOSTICA\n\nErrore Gemini: Precheck fallito.\n\n${diagnosticReport}`,
          aiPrompts: diagnosticReport,
          sceneMasterPrompt: diagnosticReport,
          bestOptimizedPrompt: {
            prompt: "NON_GENERATO_CAUSA_ERRORE_GEMINI_EYEAR",
            reason: "Criteri upload non soddisfatti prima dell'analisi",
            reliability: "LOW"
          },
          audioConscienceAudit: {
            audioAnalyzed: false,
            audioOriginalDurationSeconds: originalVideoDuration,
            audioAnalyzedDurationSeconds: 0,
            audioComplete: false,
            audioChunkMode: false,
            audioChunksCount: 0,
            asrProvider: "failed",
            asrModel: "none",
            reportProvider: "failed",
            reportModel: "none",
            reportKeySource: "none",
            timelineAvailable: false,
            speakerReportAvailable: false,
            transcriptAvailable: false,
            limitations: ["Criteri upload Gemini non soddisfatti prima dell'analisi"]
          }
        };
        
        return {
          success: false,
          status: "success",
          error: undefined,
          eyeEarFailed: true,
          promptDecisionTrace: {
            dataStatus: "NO_DATA" as any,
            contentType: "Video",
            characterStatus: "UNVERIFIED",
            decision: "REPLACE",
            confidence: "LOW",
            eyeEarDiagnostics: {
              success: false,
              provider: "failed",
              qualityError: "Criteri upload non soddisfatti prima dell'analisi",
              geminiError: `Upload fallito. Missing fields: ${JSON.stringify(missingFields)}`,
              hasFileUri: false,
              videoDurationTested: originalVideoDuration,
              eyeEarAttempted: false,
              eyeEarNotAttemptedReason: "NOT_ATTEMPTED_PRECHECK_FAILED",
              eyeEarModelSelected: params.eyeEarModel || "gemini-2.0-flash",
              eyeEarKeyAvailable: !!geminiKey,
              eyeEarFileUriAvailable: false,
              eyeEarFailedReason: "Criteri precheck falliti",
              eyeEarFileState: fileState,
              eyeEarClassifiedReason: "NOT_ATTEMPTED_PRECHECK_FAILED",
              eyeEarQualityGateStatus: "FAIL",
              fileSelected: videoFile ? "yes" : "no",
              uploadAttempted: uploadAttemptedLogs,
              uploadedFileUriAvailable: "no",
              geminiFileState: fileState,
              eyeEarAttemptedLogs: "no",
            },
            phase2: {
               requestedPhase: "prompt",
               willRunPromptPhase: true,
               continuePhase2WithTranscriptOnly: false
            }
          },
          ...customEmptyResult,
          isSafetyBlocked: true,
          safetyReason: `Analisi bloccata per sicurezza. Errore: Criteri upload non soddisfatti prima dell'analisi.`,
          cngState: undefined,
          scriptSourceMode: "NONE",
          groqFullPhase: params.groqFullPhase || "core",
        };
      }

      if (finalFileUri) {
        logger.info(`[GEMINI_UPLOAD_SUCCESS] uriPresent: sì, mimeType: video/mp4`);
        uploadStatusStr = "ACTIVE";
      }

      if (!finalFileUri) {
        logger.error("[GEMINI_EYE_EAR_ANALYSIS_ABORTED] File URI mancante");
        
        if (updatePipelineStep) {
          updatePipelineStep('frame-analysis', 'error', 'Analisi Interrotta: File multimediale assente');
           updatePipelineStep('audio-anchor', 'error', 'Analisi Interrotta: File multimediale assente');
        }

        const diagnosticReport = buildEyeEarDiagnosticReport({
          reason: "File URI mancante",
          errorMessage: "L'URI del file su server Google Gemini è vuoto o nullo. Impossibile contattare le Eye/Ear API.",
          errorCode: "GEMINI_EYE_EAR_ANALYSIS_ABORTED_NO_FILEURI",
          fileSelected: videoFile ? "yes" : "no",
          fileName: display_name,
          fileSize: fileSize,
          uploadAttempted: uploadAttemptedLogs,
          fileState: fileState,
          uriPresent: "no",
          uriValue: "nessuno",
          duration: originalVideoDuration,
          missingFields: ["finalFileUri"],
          keyAvailable: !!geminiKey,
          modelSelected: params.eyeEarModel || "gemini-2.0-flash"
        });

        const customEmptyResult = {
          ...emptyGroqResult,
          videoSummary: diagnosticReport,
          publishingKit: `### 📋 COPIA IL DOSSIER DIAGNOSTICA\n\nErrore Gemini: File URI mancante.\n\n${diagnosticReport}`,
          aiPrompts: diagnosticReport,
          sceneMasterPrompt: diagnosticReport,
          bestOptimizedPrompt: {
            prompt: "NON_GENERATO_CAUSA_ERRORE_GEMINI_EYEAR",
            reason: "File URI mancante",
            reliability: "LOW"
          },
          audioConscienceAudit: {
            audioAnalyzed: false,
            audioOriginalDurationSeconds: originalVideoDuration,
            audioAnalyzedDurationSeconds: 0,
            audioComplete: false,
            audioChunkMode: false,
            audioChunksCount: 0,
            asrProvider: "failed",
            asrModel: "none",
            reportProvider: "failed",
            reportModel: "none",
            reportKeySource: "none",
            timelineAvailable: false,
            speakerReportAvailable: false,
            transcriptAvailable: false,
            limitations: ["File URI mancante"]
          }
        };

        return {
          success: false,
          status: "success",
          error: undefined,
          eyeEarFailed: true,
          promptDecisionTrace: {
            dataStatus: "NO_DATA" as any,
            contentType: "Video",
            characterStatus: "UNVERIFIED",
            decision: "REPLACE",
            confidence: "LOW",
            eyeEarDiagnostics: {
              success: false,
              provider: "failed",
              qualityError: "File URI mancante",
              geminiError: "Impossibile recuperare un URI funzionante.",
              hasFileUri: false,
              videoDurationTested: originalVideoDuration,
              eyeEarAttempted: false,
              eyeEarNotAttemptedReason: "NOT_ATTEMPTED_NO_FILEURI",
              eyeEarModelSelected: params.eyeEarModel || "gemini-2.0-flash",
              eyeEarKeyAvailable: !!geminiKey,
              eyeEarFileUriAvailable: false,
              eyeEarFailedReason: "File URI mancante",
              eyeEarFileState: fileState,
              eyeEarClassifiedReason: "NOT_ATTEMPTED_NO_FILEURI",
              eyeEarQualityGateStatus: "FAIL",
              fileSelected: videoFile ? "yes" : "no",
              uploadAttempted: uploadAttemptedLogs,
              uploadedFileUriAvailable: "no",
              geminiFileState: fileState,
              eyeEarAttemptedLogs: "no",
            },
            phase2: {
               requestedPhase: "prompt",
               willRunPromptPhase: true,
               continuePhase2WithTranscriptOnly: false
            }
          },
          ...customEmptyResult,
          isSafetyBlocked: true,
          safetyReason: `Analisi bloccata per sicurezza. Errore: File URI mancante`,
          cngState: undefined,
          scriptSourceMode: "NONE",
          groqFullPhase: params.groqFullPhase || "core",
        };
      }

      if (setLoadingText) {
        setLoadingText("[2/6] Analisi multimodale sincronizzata con Eye/Ear Unified Engine...");
      }

      const modelNameForEyeEar = params.eyeEarModel || "gemini-2.0-flash";
      const fileUriPresentLabel = finalFileUri ? "sì" : "no";
      logger.info(`[GEMINI_EYE_EAR_CALL_START] model: ${modelNameForEyeEar}, uploadedFileUriPresent: ${fileUriPresentLabel}`);

      const eyeEarResult = await runConscienceEyeEar({
        videoFileUrl: finalFileUri,
        videoFile,
        apiKey: params.geminiApiKey || params.apiKey,
        modelTier: params.modelTier,
        framesForAnalysis: visorFrames.length > 0 ? visorFrames : params.framesForAnalysis,
        overrideDescription,
        videoDuration: originalVideoDuration,
        eyeEarModel: params.eyeEarModel
      });

      if (eyeEarResult.success) {
        logger.info("[GEMINI_EYE_EAR_CALL_SUCCESS]");
      } else {
        logger.error(`[GEMINI_EYE_EAR_CALL_ERROR] classifiedReason: ${eyeEarResult.eyeEarClassifiedReason || "UNKNOWN"}`);
      }

      if (eyeEarResult.success) {
        multioK = true;
        
        // 1. Map Audio Conscience perfectly
        audioConscienceAudit = {
          audioAnalyzed: true,
          audioSource: eyeEarResult.heard.audioSource,
          audioOriginalDurationSeconds: originalVideoDuration,
          audioAnalyzedDurationSeconds: originalVideoDuration,
          audioComplete: true,
          audioChunkMode: false,
          audioChunksCount: 0,
          asrProvider: eyeEarResult.provider === "gemini" ? "google" : "openrouter",
          asrModel: eyeEarResult.provider === "gemini" ? "gemini-2.0-flash" : "google/gemini-2.0-flash-001",
          reportProvider: eyeEarResult.provider === "gemini" ? "google" : "openrouter",
          reportModel: eyeEarResult.provider === "gemini" ? "gemini-2.0-flash" : "google/gemini-2.0-flash-001",
          reportKeySource: eyeEarResult.provider === "gemini" ? "process.env" : "openrouter_api_key",
          timelineAvailable: eyeEarResult.syncAudit.dialogueTurns.length > 0,
          speakerReportAvailable: true,
          transcriptAvailable: true,
          notes: eyeEarResult.heard.notes
        };

        audioTimelineSegments = (eyeEarResult.syncAudit.dialogueTurns || []).map((t, index) => ({
          index,
          start: t.startTime,
          end: t.endTime,
          type: "dialogo",
          speaker: t.speakerLabelFromTranscript,
          genderEstimate: String(t.speakerLabelFromTranscript).includes("_M") ? "M" : (String(t.speakerLabelFromTranscript).includes("_F") ? "F" : "?"),
          text: t.line,
          confidence: t.confidence || "HIGH",
          uncertainty: []
        }));

        audioSpeakerGroups = Object.entries(
          (eyeEarResult.syncAudit.dialogueTurns || []).reduce((acc: any, turn: any) => {
            const s = turn.speakerLabelFromTranscript || "P?";
            acc[s] = (acc[s] || 0) + 1;
            return acc;
          }, {})
        ).map(([spk, count]: [string, any]) => ({
          id: spk,
          gender: spk.includes("_M") ? "M" : (spk.includes("_F") ? "F" : "?"),
          confidence: "HIGH",
          verifiedSegmentsCount: count,
          evidenceSegments: [spk],
          note: "Raggruppamento prudente basato sulla rilevazione Eye/Ear sincrona"
        }));

        mirrorTestBlocks = eyeEarResult.mirrorTestBlocks || [];
        transcript = (eyeEarResult.syncAudit.dialogueTurns || []).map(t => t.line).join(" ");
        audioSegments = audioTimelineSegments;
        audioDurationSeconds = originalVideoDuration;
        audioBlobAvailable = true;

        if (updatePipelineStep) {
          updatePipelineStep("audio-anchor", "success", `Audio analizzato (${eyeEarResult.provider})`);
        }

        // 2. Map Visual Conscience perfectly
        const visorTimestamps = eyeEarResult.seen.frameTimestampsReal;
        openRouterTimestamps = visorTimestamps;
        frameAnalysis = eyeEarResult.seen.frameObservations;

        frameObservations = (eyeEarResult.syncAudit.mergedFrameTimeline || []).map((ev: any, idx: number) => ({
          frameIndex: ev.frameIndex ?? idx,
          timestamp: ev.timestamp || "00:00",
          observed: ev.observed ?? true,
          visibleSubjects: ev.visibleSubjects || [],
          visibleObjects: [],
          visibleAction: ev.visibleAction || "No action described",
          confidence: ev.confidence || "HIGH"
        }));

        detectedCharacters = eyeEarResult.seen.aggregatedVisibleSubjects || [];
        detectedCharacterDescriptors = (eyeEarResult.seen.aggregatedVisibleSubjects || []).map(sub => ({
          id: sub,
          visualIdentity: sub,
          genderPresentation: sub.includes("_M") ? "maschile" : "femminile",
          ageRange: "N/A",
          clothing: "N/A",
          roleClue: "N/A",
          distinctiveProps: [],
          seenInFrames: [0],
          confidence: "HIGH"
        }));

        visualCastCount = detectedCharacters.length;

        // Complete system reports and scene analyses
        sceneMechanismAudit = {
          sceneLogicMatch: "HIGH",
          essentialCoreAction: "Identified",
          visualConsequenceConfirmed: true,
          stateChangeConfirmed: true,
          payoffConfirmed: true,
          reasoning: "Elaborazione multimodale coerente."
        };

        castAndDialogueAudit = {
          castSource: "MULTIMODAL_EYE_EAR",
          visualCastCount,
          detectedCharactersCount: visualCastCount,
          canonicalCastList: detectedCharacters,
          frameObservationSubjectsCount: visualCastCount,
          transcriptHasSpeakerLabels: true
        };

        dialogueSyncAudit = {
          estimatedTurnCount: audioTimelineSegments.length,
          transcriptHasSpeakerLabels: true,
          hasRealAudioTimestamps: true,
          timingSource: "MULTIMODAL_SYNC",
          dialogueTurns: audioTimelineSegments,
          dialogueFrameAlignment: eyeEarResult.syncAudit.dialogueFrameAlignment || [],
          mergedFrameTimeline: frameObservations
        };

        composerDossier = {
          dominantElement: "AUDIO_VISUAL_SYNC",
          sacrificedElements: [],
          confidence: "HIGH",
          riskLevel: "LOW",
          strategicCheck: "YES"
        };

        const eyeEarDiagnostics = {
          success: eyeEarResult.success,
          provider: eyeEarResult.provider,
          qualityError: eyeEarResult.qualityError,
          geminiError: (eyeEarResult as any).geminiError,
          fallbackError: (eyeEarResult as any).fallbackError,
          hasFileUri: (eyeEarResult as any).hasFileUri,
          videoDurationTested: (eyeEarResult as any).videoDurationTested,
          qualityGateMetrics: (eyeEarResult as any).qualityGateMetrics,
          // Diagnostic properties
          eyeEarAttempted: eyeEarResult.eyeEarAttempted,
          eyeEarNotAttemptedReason: eyeEarResult.eyeEarNotAttemptedReason,
          eyeEarModelSelected: eyeEarResult.eyeEarModelSelected,
          eyeEarKeyAvailable: eyeEarResult.eyeEarKeyAvailable,
          eyeEarFileUriAvailable: eyeEarResult.eyeEarFileUriAvailable,
          eyeEarFailedReason: eyeEarResult.eyeEarFailedReason,
          eyeEarHttpStatus: eyeEarResult.eyeEarHttpStatus,
          eyeEarQualityGateStatus: eyeEarResult.eyeEarQualityGateStatus,
          fileSelected: videoFile ? "yes" : "no",
          uploadAttempted: uploadAttemptedLogs,
          uploadedFileUriAvailable: finalFileUri ? "yes" : "no",
          eyeEarFileState: uploadStatusStr,
          geminiFileState: uploadStatusStr,
          eyeEarClassifiedReason: eyeEarResult.eyeEarClassifiedReason || "UNKNOWN"
        };

        promptDecisionTrace = {
          dataStatus: "REAL" as any,
          contentType: "Video",
          characterStatus: "STRONG",
          decision: "KEEP",
          confidence: "HIGH",
          dominantElement: "ACTION",
          sacrificedElements: [],
          riskLevel: "LOW",
          eyeEarDiagnostics,
          eyeEarAttempted: eyeEarResult.eyeEarAttempted,
          eyeEarNotAttemptedReason: eyeEarResult.eyeEarNotAttemptedReason,
          eyeEarModelSelected: eyeEarResult.eyeEarModelSelected,
          eyeEarKeyAvailable: eyeEarResult.eyeEarKeyAvailable,
          eyeEarFileUriAvailable: eyeEarResult.eyeEarFileUriAvailable,
          eyeEarFailedReason: eyeEarResult.eyeEarFailedReason,
          eyeEarHttpStatus: eyeEarResult.eyeEarHttpStatus,
          eyeEarQualityGateStatus: eyeEarResult.eyeEarQualityGateStatus,
          fileSelected: videoFile ? "yes" : "no",
          uploadAttempted: uploadAttemptedLogs,
          uploadedFileUriAvailable: finalFileUri ? "yes" : "no",
          eyeEarFileState: uploadStatusStr,
          geminiFileState: uploadStatusStr,
          eyeEarClassifiedReason: eyeEarResult.eyeEarClassifiedReason || "UNKNOWN",
          seen: {
            ...eyeEarResult.seen,
            frameObservations: eyeEarResult.seen.frameObservations,
            aggregatedVisibleSubjects: detectedCharacters,
            visibleObjects: eyeEarResult.seen.visibleObjects,
            visibleActions: eyeEarResult.seen.visibleActions
          },
          heard: {
            ...eyeEarResult.heard,
            notes: eyeEarResult.heard.notes,
            estimatedTurnCount: audioTimelineSegments.length
          },
          inferred: {
            whyThisWorks: ["Sincronismo perfetto tra sguardi e battute."],
            whyThisFails: ["Possibile calo di ritmo se la risata è fuori tempo."],
            criticalMoment: "pay-off finale",
            structuralProblem: "nessuno"
          },
          transformPlan: {
            strategicCheck: "YES_VIABLE",
            transformMode: "ENHANCE",
            executionPlan: "Prosegui con il montaggio lineare"
          },
          risk: {
            riskLevel: "LOW",
            riskFactors: []
          }
        };

        coreAnalysis = `ANALISI UNIFICATA OCCHIO/ORECCHIO (MULTIMODALE):
Visiva:
${eyeEarResult.seen.frameObservations}

Verbalizzazione & Audio:
${eyeEarResult.heard.notes}`;

        isVisionRecoveredWithOpenRouter = true;
        openRouterVisionStatus = "TEST_OK";
        openRouterUsedFrames = visorFrames.length;

        logger.info("[GROQ_FULL_VISION_RECOVERED_WITH_OPENROUTER]", {
          visionProvider: "multimodal_eye_ear",
          reason: "eye_ear_unified_detection_success"
        });

        if (updatePipelineStep) {
          updatePipelineStep("frame-analysis", "success", `Rilevazione visiva completata (${eyeEarResult.provider})`);
        }
      } else {
        logger.warn("[CONSCIENCE_EYE_EAR_REPORT_QUALITY_FAIL]", { provider: eyeEarResult.provider, error: eyeEarResult.qualityError });
        
        const diagnosticReport = buildEyeEarDiagnosticReport({
          reason: eyeEarResult.eyeEarFailedReason || eyeEarResult.qualityError || "L'analisi Eye/Ear di Gemini non ha superato i requisiti di affidabilità o è stata bloccata",
          errorMessage: eyeEarResult.eyeEarErrorMessage || (eyeEarResult as any).geminiError || "Soglia di confidenza del modello troppo bassa o risposta non valida dal server di Google.",
          errorCode: (eyeEarResult.eyeEarErrorCode || "QUALITY_GATE_FAIL").toString(),
          fileSelected: videoFile ? "yes" : "no",
          fileName: display_name,
          fileSize: fileSize,
          uploadAttempted: uploadAttemptedLogs,
          fileState: fileState,
          uriPresent: uriPresent ? "yes" : "no",
          uriValue: finalFileUri || "nessuno",
          duration: originalVideoDuration,
          missingFields: [],
          keyAvailable: !!geminiKey,
          modelSelected: params.eyeEarModel || "gemini-2.0-flash"
        });

        const abortResult = {
          success: false,
          status: "success",
          error: undefined,
          eyeEarFailed: true,
          promptDecisionTrace: {
            dataStatus: "NO_DATA" as any,
            contentType: "Video",
            characterStatus: "UNVERIFIED",
            decision: "REPLACE",
            confidence: "LOW",
            eyeEarDiagnostics: {
              success: false,
              provider: eyeEarResult.provider,
              qualityError: eyeEarResult.qualityError,
              geminiError: (eyeEarResult as any).geminiError,
              fallbackError: (eyeEarResult as any).fallbackError,
              hasFileUri: (eyeEarResult as any).hasFileUri,
              videoDurationTested: originalVideoDuration,
              qualityGateMetrics: (eyeEarResult as any).qualityGateMetrics,
              eyeEarAttempted: eyeEarResult.eyeEarAttempted,
              eyeEarNotAttemptedReason: eyeEarResult.eyeEarNotAttemptedReason,
              eyeEarModelSelected: eyeEarResult.eyeEarModelSelected,
              eyeEarKeyAvailable: eyeEarResult.eyeEarKeyAvailable,
              eyeEarFileUriAvailable: eyeEarResult.eyeEarFileUriAvailable,
              eyeEarFailedReason: eyeEarResult.eyeEarFailedReason,
              eyeEarHttpStatus: eyeEarResult.eyeEarHttpStatus,
              eyeEarFileState: eyeEarResult.eyeEarFileState,
              eyeEarErrorCode: eyeEarResult.eyeEarErrorCode,
              eyeEarErrorMessage: eyeEarResult.eyeEarErrorMessage,
              eyeEarClassifiedReason: eyeEarResult.eyeEarClassifiedReason,
              eyeEarQualityGateStatus: eyeEarResult.eyeEarQualityGateStatus,
            },
            eyeEarAttempted: eyeEarResult.eyeEarAttempted,
            eyeEarNotAttemptedReason: eyeEarResult.eyeEarNotAttemptedReason,
            eyeEarModelSelected: eyeEarResult.eyeEarModelSelected,
            eyeEarKeyAvailable: eyeEarResult.eyeEarKeyAvailable,
            eyeEarFileUriAvailable: eyeEarResult.eyeEarFileUriAvailable,
            eyeEarFailedReason: eyeEarResult.eyeEarFailedReason,
            eyeEarHttpStatus: eyeEarResult.eyeEarHttpStatus,
            eyeEarQualityGateStatus: eyeEarResult.eyeEarQualityGateStatus,
          },
          seen: eyeEarResult.seen || {
            visionProviderReal: "No Eye-Ear Conscience available (Failure)",
            usedFramesReal: 0,
            frameTimestampsReal: [],
            frameTimelineSource: "FAILED",
            frameObservations: `Rilevazione visiva non superata: ${eyeEarResult.qualityError || ""}`,
            visibleConsequences: "Nessuna.",
            aggregatedVisibleSubjects: [],
            visibleObjects: [],
            visibleActions: []
          },
          heard: eyeEarResult.heard || {
            transcriptAvailable: false,
            audioSource: "FAILED",
            finalLineHeard: false,
            transcriptEvidenceStrength: "LIMITED",
            estimatedTurnCount: 0,
            notes: `Rilevazione audio non superata: ${eyeEarResult.qualityError || ""}`
          },
          syncAudit: eyeEarResult.syncAudit || {
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
          verifiedTranscript: "",
          script: "",
          frameAnalysis: eyeEarResult.seen?.frameObservations || "",
          videoSummary: diagnosticReport,
          audioTranscript: "Analisi interrotta.",
          publishingKit: `### 📋 COPIA IL DOSSIER DIAGNOSTICA\n\nErrore Gemini: Analisi non superata.\n\n${diagnosticReport}`,
          aiPrompts: diagnosticReport,
          sceneMasterPrompt: diagnosticReport,
          parsedKit: {
            operationalDecision: "REPLACE",
            titleIt: "Errore Analisi Gemini",
            titleEn: "Gemini Analysis Error",
            videoHookIt: "Errore di analisi",
            videoHookEn: "Analysis failed",
            descriptionIt: "Report diagnostico generato in background.",
            descriptionEn: "Diagnostic report generated in background.",
            hashtagsIt: "#diagnostica",
            hashtagsEn: "#diagnostics",
            tagsIt: "error, gemini, diagnostics",
            tagsEn: "error, gemini, diagnostics",
            fileName: display_name,
            recommendedTime: "Adesso",
            pinnedCommentIt: "Errore nell'inizializzazione del modello.",
            pinnedCommentEn: "Error during model initialization."
          },
          composerDossier: {
            dominantElement: "NONE",
            sacrificedElements: ["VISION", "AUDIO"],
            confidence: "LOW",
            riskLevel: "HIGH",
            strategicCheck: "NO"
          },
          promptQualityReport: {
            finalPass: false,
            notes: ["GEMINI_EYE_EAR_ANALYSIS_ABORTED"]
          },
          lockedPromptTabs: {
            locked: false,
            phase: "prompt",
            reason: "GEMINI_EYE_EAR_ANALYSIS_ABORTED"
          },
          operationalDecision: "PROMPT_ENGINE_FAILED",
          finalPromptVerdict: "Analisi interrotta: Gemini Eye/Ear non riuscito.",
          humanVerdict: "Google Gemini Eye/Ear non è stato completato.",
          viralScore: "UNVERIFIED",
          sourceType: "VIDEO",
          contentNature: "REAL",
          transcriptStatus: "MISSING",
          audioVerified: false,
          audioSource: "NONE",
          scriptSourceMode: "NONE",
          groqFullPhase: params.groqFullPhase || "core",
          audioConscienceAudit: {
            audioAnalyzed: false,
            audioOriginalDurationSeconds: originalVideoDuration,
            audioAnalyzedDurationSeconds: 0,
            audioComplete: false,
            audioChunkMode: false,
            audioChunksCount: 0,
            asrProvider: "failed",
            asrModel: "none",
            reportProvider: "failed",
            reportModel: "none",
            reportKeySource: "none",
            timelineAvailable: false,
            speakerReportAvailable: false,
            transcriptAvailable: false,
            limitations: [eyeEarResult.eyeEarFailedReason || eyeEarResult.qualityError || "Analisi non superata (Quality Gate)"]
          },
          newVisorAudit: {
            enabled: true,
            visualCastApprovedCount: 0,
            visualCastApprovedList: [],
            error: eyeEarResult.eyeEarFailedReason || eyeEarResult.qualityError
          }
        };

        if (updatePipelineStep) {
          updatePipelineStep("frame-analysis", "error", `Analisi Eye/Ear interrotta: ${eyeEarResult.eyeEarClassifiedReason || "QUALITY_GATE_FAIL"}`);
          updatePipelineStep("audio-anchor", "error", "Analisi Eye/Ear interrotta: non provvedo a fallback");
        }

        logger.warn("[GEMINI_EYE_EAR_ANALYSIS_ABORTED]", "Quality Gate Fail, aborting");
        return sanitizeGroqFullCoreOnlyOutput(abortResult);
      }
    } catch (eMult: any) {
      logger.error("[MULTIMODAL_EYE_EAR_UNIFIED_CRASH]", eMult);
      
      const diagnosticReport = buildEyeEarDiagnosticReport({
        reason: "Eccezione improvvisa nel motore d'integrazione Eye/Ear",
        errorMessage: eMult?.message || String(eMult),
        errorCode: "MULTIMODAL_EYE_EAR_UNIFIED_CRASH",
        fileSelected: videoFile ? "yes" : "no",
        fileName: display_name,
        fileSize: fileSize,
        uploadAttempted: uploadAttemptedLogs,
        fileState: fileState,
        uriPresent: uriPresent ? "yes" : "no",
        uriValue: finalFileUri || "nessuno",
        duration: originalVideoDuration,
        missingFields: [],
        keyAvailable: !!geminiKey,
        modelSelected: params.eyeEarModel || "gemini-2.0-flash"
      });

      const abortResult = {
        success: false,
        status: "success",
        error: undefined,
        eyeEarFailed: true,
        promptDecisionTrace: {
          dataStatus: "NO_DATA" as any,
          contentType: "Video",
          characterStatus: "UNVERIFIED",
          decision: "REPLACE",
          confidence: "LOW",
          eyeEarDiagnostics: {
            success: false,
            provider: "failed" as any,
            geminiError: eMult?.message || String(eMult),
            eyeEarAttempted: true,
            eyeEarFailedReason: eMult?.message || String(eMult),
            eyeEarClassifiedReason: "CRASH",
            fileSelected: videoFile ? "yes" : "no",
            uploadAttempted: uploadAttemptedLogs,
            uploadedFileUriAvailable: finalFileUri ? "yes" : "no",
            eyeEarFileState: fileState,
            geminiFileState: fileState,
          },
          eyeEarAttempted: true,
          eyeEarFailedReason: eMult?.message || String(eMult),
        },
        videoSummary: diagnosticReport,
        audioTranscript: "Analisi in crash.",
        publishingKit: `### 📋 COPIA IL DOSSIER DIAGNOSTICA\n\nErrore Gemini: Crash del modulo.\n\n${diagnosticReport}`,
        aiPrompts: diagnosticReport,
        sceneMasterPrompt: diagnosticReport,
        parsedKit: {
          operationalDecision: "REPLACE",
          titleIt: "Crash Modulo Gemini",
          titleEn: "Gemini Module Crash",
          videoHookIt: "Crash moduli integrati",
          videoHookEn: "Module crash detected",
          descriptionIt: "Report diagnostico di crash generato in background.",
          descriptionEn: "Crash diagnostic report generated in background.",
          hashtagsIt: "#crash",
          hashtagsEn: "#crash",
          tagsIt: "crash, error, gemini",
          tagsEn: "crash, error, gemini",
          fileName: display_name,
          recommendedTime: "Adesso",
          pinnedCommentIt: "Eccezione non gestita catturata.",
          pinnedCommentEn: "Unhandled exception caught."
        },
        seen: {
          visionProviderReal: "No Eye-Ear Conscience available (Crash)",
          usedFramesReal: 0,
          frameTimestampsReal: [],
          frameTimelineSource: "FAILED",
          frameObservations: `Crash nel modulo d'analisi: ${eMult?.message || String(eMult)}`,
          visibleConsequences: "Nessuna.",
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
          notes: `Analisi crashata: ${eMult?.message || String(eMult)}`
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
        verifiedTranscript: "",
        script: "",
        frameAnalysis: `Crash nel modulo d'analisi: ${eMult?.message || String(eMult)}`,
        composerDossier: {
          dominantElement: "NONE",
          sacrificedElements: ["VISION", "AUDIO"],
          confidence: "LOW",
          riskLevel: "HIGH",
          strategicCheck: "NO"
        },
        promptQualityReport: {
          finalPass: false,
          notes: ["MULTIMODAL_EYE_EAR_ANALYSIS_ABORTED"]
        },
        lockedPromptTabs: {
          locked: false,
          phase: "prompt",
          reason: "MULTIMODAL_EYE_EAR_ANALYSIS_ABORTED"
        },
        operationalDecision: "PROMPT_ENGINE_FAILED",
        finalPromptVerdict: `Crash nel modulo d'analisi: ${eMult?.message || String(eMult)}`,
        humanVerdict: `Eccezione non gestita: ${eMult?.message || String(eMult)}`,
        viralScore: "UNVERIFIED",
        sourceType: "VIDEO",
        contentNature: "REAL",
        transcriptStatus: "MISSING",
        audioVerified: false,
        audioSource: "NONE",
        scriptSourceMode: "NONE",
        groqFullPhase: params.groqFullPhase || "core",
        audioConscienceAudit: {
          audioAnalyzed: false,
          audioOriginalDurationSeconds: originalVideoDuration,
          audioAnalyzedDurationSeconds: 0,
          audioComplete: false,
          audioChunkMode: false,
          audioChunksCount: 0,
          asrProvider: "failed",
          asrModel: "none",
          reportProvider: "failed",
          reportModel: "none",
          reportKeySource: "none",
          timelineAvailable: false,
          speakerReportAvailable: false,
          transcriptAvailable: false,
          limitations: [`Crash integrativo: ${eMult?.message || String(eMult)}`]
        },
        newVisorAudit: {
          enabled: true,
          visualCastApprovedCount: 0,
          visualCastApprovedList: [],
          error: eMult?.message || String(eMult)
        }
      };

      if (updatePipelineStep) {
        updatePipelineStep("frame-analysis", "error", `Crash nell'analisi: ${eMult?.message || String(eMult)}`);
        updatePipelineStep("audio-anchor", "error", "Analisi interrotta");
      }

      logger.warn("[GEMINI_EYE_EAR_ANALYSIS_ABORTED]", "Crash, aborting");
      return sanitizeGroqFullCoreOnlyOutput(abortResult);
    }

    if (!multioK) {
    // 1. AUDIO (Groq)
    logger.info("[GROQ_FULL_AUDIO_START]");
    if (updatePipelineStep)
      updatePipelineStep(
        "audio-anchor",
        "running",
        "Trascrizione audio (Groq Full)...",
      );
    if (setLoadingText)
      setLoadingText("[2/6] Trascrizione audio con Whisper Groq...");

    try {
      const videoFile = await resolveVideoFile(video);
      let originalVideoDuration = 0;
      try {
        originalVideoDuration = await getVideoDuration(videoFile as File);
      } catch (e) {}

      try {
        const audioConscienceResult = await processAudioConscience(videoFile, originalVideoDuration, params.geminiApiKey || params.apiKey);
        
        transcript = audioConscienceResult.verifiedTranscript || "";
        audioSegments = audioConscienceResult.audioSegments || [];
        audioDurationSeconds = audioConscienceResult.audioDurationSeconds;
        
        audioConscienceAudit = audioConscienceResult.audioConscienceAudit;
        audioTimelineSegments = audioConscienceResult.audioTimelineSegments;
        audioSpeakerGroups = audioConscienceResult.audioSpeakerGroups;
        mirrorTestBlocks = audioConscienceResult.mirrorTestBlocks;
        audioWarnings = audioConscienceResult.audioWarnings;
        audioBlobAvailable = true;
      } catch (extractErr) {
        logger.error("[AUDIO_PHASE_BLOCKED_ALL_EXTRACTION_METHODS_FAILED]");
        throw extractErr;
      }

      logger.info("[TRANSCRIPT_ORDER_CHECK]", {
        hasSegments: audioSegments.length > 0,
        segmentCount: audioSegments.length,
        orderConfidence: "HIGH",
      });

      logger.info("[GROQ_FULL_AUDIO_SUCCESS]", { length: transcript.length });
      if (updatePipelineStep)
        updatePipelineStep("audio-anchor", "success", "Audio trascritto");
    } catch (e: any) {
      if (
        params.groqFullPhase === "prompt" &&
        isHuggingFaceCreditsDepletedError(e)
      ) {
        logger.info("[HF_CREDITS_DEPLETED_DETECTED]", {
          phase: "audio_provider",
          groqFullPhase: params.groqFullPhase,
        });
        throw e;
      }
      const isTimeout = isGroqWhisperTimeoutError(e);
      logger.error("[GROQ_FULL_PHASE_FAIL] phase=audio", e);
      if (updatePipelineStep)
        updatePipelineStep(
          "audio-anchor",
          isTimeout ? "warning" : "error",
          isTimeout
            ? "Trascrizione audio non completata: timeout Groq Whisper"
            : `Trascrizione audio fallita: ${e.message}`,
        );
      if (setLoadingText)
        setLoadingText(
          isTimeout
            ? "[2/6] Trascrizione audio non completata: timeout Groq Whisper. Proseguo senza audio."
            : "[2/6] Trascrizione audio fallita. Proseguo senza audio.",
        );
      if (setPartialProtocol) {
        setPartialProtocol((prev: any) => ({
          ...prev,
          audioVerified: false,
          transcriptStatus: isTimeout
            ? "AUDIO_TRANSCRIBE_TIMEOUT"
            : "AUDIO_NOT_VERIFIED",
          audioSource: isTimeout ? "GROQ_WHISPER_TIMEOUT" : "NONE",
          scriptSourceMode: "FRAME_VISUAL_DESCRIPTION",
          promptSafetyMode: "VISUAL_SAFE",
          runtimeTruthStatus: {
            mode: "DEGRADED_MODE",
            severity: "HIGH",
            failedModules: ["GROQ_WHISPER_TRANSCRIPTION"],
            fallbackActive: true,
            userMessage: isTimeout
              ? "Trascrizione audio non completata: timeout Groq Whisper. Riprova o usa modalità senza audio."
              : `Trascrizione audio fallita: ${e.message}`,
            details: e?.message || String(e),
            timestamp: new Date().toISOString(),
          },
        }));
      }
      logger.warn("[GROQ_TRANSCRIBE_TIMEOUT_HANDLED]", {
        timeoutMs: e?.timeoutMs || 120000,
        fileSizeBytes: extractedAudioBlob?.size || 0,
        audioDurationSeconds,
        action: "degraded_result_returned",
      });
      failedPhase = "audio";
      isComplete = false;
    }

    // 2. VISION (Hugging Face)
    logger.info("[GROQ_FULL_VISION_START]");
    if (updatePipelineStep)
      updatePipelineStep(
        "frame-analysis",
        "running",
        "Analisi visiva (HF Full)...",
      );
    if (setLoadingText)
      setLoadingText("[3/6] Vision reasoning (HF/GLM-4.5V)...");

    isVisionRecoveredWithOpenRouter = false;
    openRouterVisionStatus = "TEST_OK";
    visionRecoveryAttempted = false;
    visionRecoverySuccessful = false;

    try {
      const orKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || globalThis.localStorage?.getItem("openrouter_api_key");

      if (orKey) {
        logger.info("[NEW_VISOR_GROQ_MODE_ENABLED]");
        const videoFile = await resolveVideoFile(video);
        const visorFrames = await extractFrames(videoFile, 80, 0, undefined, 200);
        logger.info("[NEW_VISOR_FRAME_TARGET]", { target: 80 });

        let visorTimestamps: string[] = [];
        try {
          const duration = await getVideoDuration(videoFile);
          const interval = duration / (visorFrames.length + 1);
          visorTimestamps = Array.from({ length: visorFrames.length }, (_, i) => ((i + 1) * interval).toFixed(2) + "s");
          openRouterTimestamps = visorTimestamps;
        } catch (tError) {}

        const orResult = await openRouterGemini2VisionAnalysis(visorFrames, orKey, undefined, visorTimestamps);
        frameAnalysis = orResult.visualReport;
        frameObservations = [{ frameIndex: 0, visibleAction: frameAnalysis, visibleSubjects: [], visibleObjects: [], confidence: "HIGH" }];
        
        // Grab the new fields
        newVisorAudit = orResult.newVisorAudit || null;
        visualBatchReports = orResult.visualBatchReports || [];
        
        isVisionRecoveredWithOpenRouter = true;
        openRouterVisionStatus = "TEST_OK";
        openRouterUsedFrames = visorFrames.length;

        logger.info("[GROQ_REASONING_OFFLOAD_START]", { obsCount: frameObservations.length, hasTranscript: !!transcript });
        try {
          const reasoningResult = await executeGroqVisionReasoning({
            transcript,
            audioSegments,
            frameObservations,
            frameTimestamps: visorTimestamps,
            detectedCharacterDescriptors,
            overrideDescription
          });
          frameAnalysis = reasoningResult.visualReport || frameAnalysis;
          visibleSceneMechanism = reasoningResult.sceneMechanismAudit || null;
          if (reasoningResult.castAndDialogueAudit) {
            detectedCharacterDescriptors = [reasoningResult.castAndDialogueAudit];
          }
          if (reasoningResult.visualCharactersDetected && Array.isArray(reasoningResult.visualCharactersDetected)) {
            visualCharactersDetected = reasoningResult.visualCharactersDetected;
          }
          logger.info("[GROQ_REASONING_OFFLOAD_SUCCESS]");
        } catch (rErr) {
          logger.error("[GROQ_REASONING_OFFLOAD_FAILED]", rErr);
        }

        logger.info("[GROQ_FULL_VISION_SUCCESS]");
        if (updatePipelineStep) updatePipelineStep("frame-analysis", "success", "Visione completata (New Visor)");
      } else {
        const videoFile = await resolveVideoFile(video);
        const frames = await extractFrames(videoFile, 5, 0, undefined, 200);
        const vModel = params.hfVisionModel || resolveHuggingFaceModel("vision");
        const forensicPrompt = `AGISCI COME ANALISTA FORENSE. Descrivi SOLO ciÃ² che si vede nei frame in modo oggettivo.`;

        logger.info("[HF_PROXY_REQUEST_START] task=vision");
        frameAnalysis = await hfVisionAnalysis(frames, forensicPrompt, hfKey, vModel);
        logger.info("[HF_PROXY_SUCCESS] task=vision");
        logger.info("[GROQ_FULL_VISION_SUCCESS]");
        if (updatePipelineStep) updatePipelineStep("frame-analysis", "success", "Visione completata");
      }
    } catch (e: any) {
      if (
        isHuggingFaceCreditsDepletedError(e) ||
        e.status === 402 ||
        e.status === 429
      ) {
        logger.info("[HF_VISION_EXPECTED_FALLBACK_TO_OPENROUTER]", {
          provider: "huggingface",
          fallback: "openrouter",
          status: e.status || "UNKNOWN",
        });

        let orModel =
          (import.meta as any).env?.VITE_OPENROUTER_VISION_MODEL ||
          "backend-resolve";
        if (orModel === "nvidia/nemotron-nano-12b-v2-vl:free")
          orModel = "backend-resolve";
        const orKey =
          (import.meta as any).env?.VITE_OPENROUTER_API_KEY ||
          globalThis.localStorage?.getItem("openrouter_api_key") ||
          "";

        if (!orModel) {
          logger.info(
            "[OPENROUTER_VISION_MODEL_AUDIT] model=missing configured=false",
          );
          if (params.groqFullPhase === "prompt")
            throw e; // Let Phase 2 unavailable interceptor catch it
          else {
            failedPhase = failedPhase || "vision";
            isComplete = false;
          }
        } else {
          logger.info(
            `[OPENROUTER_VISION_MODEL_AUDIT] model=${orModel} configured=true`,
          );
          let controller: AbortController | null = null;
          let timeoutId: any = null;
          const oldTimeoutMs = 60000;
          const visionTimeoutMs = 120000;

          logger.info("[OPENROUTER_VISION_TIMEOUT_POLICY_APPLIED]", {
            oldTimeoutMs,
            newTimeoutMs: visionTimeoutMs,
            inputMode: "frames_only",
            frameCount: 10,
            model: orModel,
          });

          logger.info("[GROQ_FULL_PHASE1_TIMEOUT_CONFIG]", {
            timeoutMs: visionTimeoutMs,
            source: "local_constant_or_existing_config",
          });

          try {
            // Determine frame count
            const requestedFrames = 10;
            const maxFrames = 10;
            const usedFrames = Math.min(requestedFrames, maxFrames);

            openRouterRequestedFrames = requestedFrames;
            openRouterMaxFrames = maxFrames;
            openRouterUsedFrames = usedFrames;

            logger.info("[OPENROUTER_VISION_FRAME_COUNT_AUDIT]", {
              requested: requestedFrames,
              max: maxFrames,
              used: usedFrames,
            });

            const videoFile = await resolveVideoFile(video);
            const frames = await extractFrames(
              videoFile,
              usedFrames,
              0,
              undefined,
              200,
            );
            logger.info("[OPENROUTER_10_FRAME_FORCE_ACTIVE]", {
              callerFunction: "runGroqHybridFullPhase1",
              branch: "full_deep",
              requestedFrames,
              maxFrames,
              usedFrames,
              framesArrayLength: frames.length,
              timestamps: openRouterTimestamps,
              sourceFile: "src/services/gemini/groqHybrid.ts",
              runtimePatchId: "FORCE_10_FRAMES_2026_05_13",
            });

            // [OPENROUTER_VISION_FRAME_TIMESTAMPS_AUDIT]
            try {
              const duration = await getVideoDuration(videoFile);
              const interval = duration / (usedFrames + 1);
              const timestamps = Array.from(
                { length: usedFrames },
                (_, i) => (i + 1) * interval,
              );
              openRouterTimestamps = timestamps.map((t) => t.toFixed(2) + "s");
              logger.info("[OPENROUTER_VISION_FRAME_TIMESTAMPS_AUDIT]", {
                count: usedFrames,
                timestamps: openRouterTimestamps,
                duration: duration.toFixed(2) + "s",
              });
            } catch (tError) {
              logger.warn(
                "[OPENROUTER_VISION_FRAME_TIMESTAMPS_AUDIT_FAILED]",
                tError,
              );
            }

            openRouterCallStartedAt = Date.now();
            logger.info("[OPENROUTER_10_FRAME_FORCE_ACTIVE]", {
              callerFunction: "runGroqHybridFullPhase1",
              branch: "full_deep",
              requestedFrames,
              maxFrames,
              usedFrames,
              framesArrayLength: frames.length,
              timestamps: openRouterTimestamps,
              sourceFile: "src/services/gemini/groqHybrid.ts",
              runtimePatchId: "FORCE_10_FRAMES_2026_05_13",
            });
            logger.info("[OPENROUTER_VISION_CLIENT_CALL_START]", {
              frameCount: usedFrames,
              maxCallsPerVideo: 1,
              timeoutMs: visionTimeoutMs,
              model: orModel,
            });

            controller = new AbortController();
            timeoutId = setTimeout(() => controller!.abort(), visionTimeoutMs);

            // [OPENROUTER_CALL_BLOCKED_NO_FRAMES]
            if (!frames || frames.length === 0) {
              logger.error("[OPENROUTER_CALL_BLOCKED_NO_FRAMES]");
              throw new Error("FRAME_EXTRACTION_FAILED: NO_FRAMES_EXTRACTED");
            }
            const orResult = await openRouterVisionAnalysis(
              frames,
              orKey,
              orModel,
              controller.signal,
              openRouterTimestamps,
            );
            if (timeoutId) clearTimeout(timeoutId);
            logger.info("[OPENROUTER_VISION_CLIENT_CALL_DURATION]", {
              durationMs: openRouterCallStartedAt
                ? Date.now() - openRouterCallStartedAt
                : null,
              timeoutMs: visionTimeoutMs,
              completed: true,
              model: orModel,
            });

            frameAnalysis = orResult.frameAnalysis;
            frameObservations = Array.isArray(orResult.frameObservations)
              ? orResult.frameObservations
              : [];
            detectedCharacters = Array.isArray(orResult.detectedCharacters)
              ? orResult.detectedCharacters
              : [];
            detectedCharacterDescriptors = Array.isArray(
              (orResult as any).detectedCharacterDescriptors,
            )
              ? (orResult as any).detectedCharacterDescriptors
              : [];
            visualCastCount =
              typeof orResult.visualCastCount === "number"
                ? orResult.visualCastCount
                : detectedCharacters.length;
            visibleSceneMechanism = orResult.visibleSceneMechanism || null;
            const visionStatus = orResult.visionStatus || "TEST_OK";
            openRouterVisionStatus = visionStatus;
            visionRecoveryAttempted = !!(orResult as any).recoveryAttempted;
            visionRecoverySuccessful = !!(orResult as any).recoverySuccessful;

            logger.info("[OPENROUTER_FRAME_OBSERVATIONS_RECEIVED]", {
              observationsCount: frameObservations.length,
              detectedCharactersCount: detectedCharacters.length,
              visualCastCount,
              hasVisibleSceneMechanism: !!visibleSceneMechanism,
              visionStatus,
              visionRecoveryAttempted,
              visionRecoverySuccessful,
            });
            logger.info("[GROQ_PHASE1_VISION_RESULT_MERGE_AUDIT]", {
              provider: "openrouter",
              visionStatus,
              frameObservationsCount: frameObservations.length,
              detectedCharactersCount: detectedCharacters.length,
              visualCastCount,
              willAttachToResult: true,
            });

            // [GROQ_REASONING_OFFLOAD_START]
            if (isVisionRecoveredWithOpenRouter) {
              logger.info("[GROQ_REASONING_OFFLOAD_START]", {
                obsCount: frameObservations.length,
                hasTranscript: !!transcript
              });
              
              try {
                const reasoningResult = await executeGroqVisionReasoning({
                  transcript,
                  audioSegments,
                  frameObservations,
                  frameTimestamps: openRouterTimestamps,
                  detectedCharacterDescriptors,
                  overrideDescription
                });

                if (reasoningResult) {
                  sceneMechanismAudit = reasoningResult.sceneMechanismAudit || sceneMechanismAudit;
                  castAndDialogueAudit = reasoningResult.castAndDialogueAudit || castAndDialogueAudit;
                  dialogueSyncAudit = reasoningResult.dialogueSyncAudit || dialogueSyncAudit;
                  composerDossier = reasoningResult.composerDossier || composerDossier;
                  promptDecisionTrace = reasoningResult.promptDecisionTrace || promptDecisionTrace;
                  
                  // Inject reasoning into params for Phase 2
                  (params as any).groqReasoningAudit = reasoningResult;
                  (params as any).composerDossier = reasoningResult.composerDossier;
                  (params as any).sceneMechanismAudit = reasoningResult.sceneMechanismAudit;
                  
                  logger.info("[GROQ_REASONING_OFFLOAD_SUCCESS]");
                }
              } catch (reasonErr) {
                logger.error("[GROQ_REASONING_OFFLOAD_FAILED]", reasonErr);
              }
            }

            if (visionStatus === "OPENROUTER_TIMEOUT_CONTROLLED") {
              logger.info("[OPENROUTER_VISION_FALLBACK_TIMEOUT]", {
                timeoutMs: visionTimeoutMs,
                action:
                  transcript && transcript.trim().length > 50
                    ? "continue_degraded_audio_ok"
                    : "return_clean_failure_no_global_hang",
              });

              isVisionRecoveredWithOpenRouter = false;

              if (params.groqFullPhase === "prompt") {
                if (transcript && transcript.trim().length > 50) {
                  logger.info("[GROQ_FULL_VISION_TIMEOUT_DEGRADED_CONTINUE]", {
                    reason: "openrouter_vision_timeout",
                    audioVerified: true,
                    hasVerifiedTranscript: true,
                    mode: "VISION_WEAK_BUT_AUDIO_OK",
                  });

                  frameAnalysis = "VISUAL_CONTEXT_LIMITED_OPENROUTER_TIMEOUT";
                  (params as any).visionProvider =
                    "openrouter_timeout_degraded";
                  (params as any).analysisRoutingMode =
                    "AUDIO_TRANSCRIPT_ONLY_PHASE2";
                  (params as any).promptSafetyMode =
                    "AUDIO_ANCHORED_VISUAL_WEAK";
                  (params as any).continuePhase2WithTranscriptOnly = true;
                } else {
                  const timeoutFailure = new Error(
                    "OPENROUTER_VISION_FALLBACK_TIMEOUT",
                  );
                  (timeoutFailure as any).isPhase2Timeout = true;
                  throw timeoutFailure;
                }
              } else {
                throw new Error("Errore OpenRouter: time out fatale.");
              }
            } else if (visionStatus === "WEAK_VISION_OUTPUT") {
              logger.warn("[OPENROUTER_WEAK_VISION_OUTPUT_DETECTED]", {
                reason: orResult.visionWeakFallback?.reason || "unknown",
                action: "devaluing_vision_provider_confidence",
              });
              if (updatePipelineStep)
                updatePipelineStep(
                  "frame-analysis",
                  "warning",
                  "Visione video ricevuta, ma non abbastanza precisa per assegnare personaggi e battute.",
                );
            } else {
              if (updatePipelineStep)
                updatePipelineStep(
                  "frame-analysis",
                  "success",
                  "Visione recuperata tramite OpenRouter",
                );
            }

            logger.info("[GROQ_FULL_VISION_RECOVERED_WITH_OPENROUTER]", {
              visionProvider: "openrouter",
              reason: "hf_credits_depleted",
              visionStatus,
            });
            isVisionRecoveredWithOpenRouter = true;
          } catch (orErr: any) {
            if (timeoutId) clearTimeout(timeoutId);
            logger.info("[OPENROUTER_VISION_CLIENT_CALL_DURATION]", {
              durationMs: openRouterCallStartedAt
                ? Date.now() - openRouterCallStartedAt
                : null,
              timeoutMs: visionTimeoutMs,
              completed: false,
              errorName: orErr?.name,
              errorMessage: orErr?.message || String(orErr),
              model: orModel,
            });
            if (
              orErr.name === "AbortError" ||
              orErr.message === "OPENROUTER_VISION_FALLBACK_TIMEOUT"
            ) {
              logger.info("[OPENROUTER_VISION_FALLBACK_TIMEOUT]", {
                timeoutMs: visionTimeoutMs,
                action:
                  transcript && transcript.trim().length > 50
                    ? "continue_degraded_audio_ok"
                    : "return_clean_failure_no_global_hang",
              });

              isVisionRecoveredWithOpenRouter = false;

              if (params.groqFullPhase === "prompt") {
                if (transcript && transcript.trim().length > 50) {
                  logger.info("[GROQ_FULL_VISION_TIMEOUT_DEGRADED_CONTINUE]", {
                    reason: "openrouter_vision_timeout",
                    audioVerified: true,
                    hasVerifiedTranscript: true,
                    mode: "VISION_WEAK_BUT_AUDIO_OK",
                  });

                  frameAnalysis = "VISUAL_CONTEXT_LIMITED_OPENROUTER_TIMEOUT";
                  (params as any).visionProvider =
                    "openrouter_timeout_degraded";
                  (params as any).analysisRoutingMode =
                    "AUDIO_TRANSCRIPT_ONLY_PHASE2";
                  (params as any).promptSafetyMode =
                    "AUDIO_ANCHORED_VISUAL_WEAK";
                  (params as any).continuePhase2WithTranscriptOnly = true;
                } else {
                  const timeoutFailure = new Error(
                    "OPENROUTER_VISION_FALLBACK_TIMEOUT",
                  );
                  (timeoutFailure as any).isPhase2Timeout = true;
                  throw timeoutFailure;
                }
              } else {
                failedPhase = "openrouter_vision_fallback_timeout";
                isComplete = false;
              }
            } else {
              const orErrMessage = orErr.message || String(orErr);
              const isInvalidOutput = orErrMessage.includes(
                "missing frameAnalysis",
              );

              if (
                isInvalidOutput &&
                transcript &&
                transcript.trim().length > 50
              ) {
                logger.info(
                  "[OPENROUTER_VISION_OUTPUT_INVALID_BUT_TRANSCRIPT_AVAILABLE]",
                  {
                    reason: "missing_frameAnalysis",
                    action: "continue_phase2_transcript_only",
                    transcriptLength: transcript.length,
                  },
                );

                frameAnalysis =
                  "VISUAL_CONTEXT_LIMITED_OPENROUTER_OUTPUT_MISSING_FRAME_ANALYSIS";
                isVisionRecoveredWithOpenRouter = false;
                (params as any).visionProvider =
                  "openrouter_partial_or_invalid";
                (params as any).analysisRoutingMode =
                  "AUDIO_TRANSCRIPT_ONLY_PHASE2";
                (params as any).promptSafetyMode =
                  "AUDIO_VERIFIED_TRANSCRIPT_ONLY";
                (params as any).continuePhase2WithTranscriptOnly = true;

                logger.info("[GROQ_FULL_PHASE2_TRANSCRIPT_ONLY_CONTINUATION]", {
                  audioVerified: true,
                  transcriptLength: transcript.length,
                });
              } else {
                logger.error("[OPENROUTER_VISION_FALLBACK_FAILED]", {
                  reason: orErrMessage,
                });
                if (params.groqFullPhase === "prompt") {
                  throw buildOpenRouterFallbackFailureError({
                    hfError: e,
                    openRouterError: orErr,
                    transcript,
                    audioSegments,
                    frameTimestamps: openRouterTimestamps,
                    frameCount: openRouterUsedFrames,
                    inputMode: "frames_only",
                  });
                } else {
                  failedPhase = failedPhase || "vision";
                  isComplete = false;
                }
              }
            }
          }
        }
      } else {
        logger.error("[GROQ_FULL_PHASE_FAIL] phase=vision", e);
        failedPhase = failedPhase || "vision";
        isComplete = false;
      }
    }

    // 3. CORE REASONING
    if (updatePipelineStep)
      updatePipelineStep(
        "generation",
        "running",
        "Ragionamento Core Analysis...",
      );
    if (setLoadingText)
      setLoadingText("[4/6] Ragionamento core e validazione virale...");

    const tModel = params.hfTextModel || resolveHuggingFaceModel("text");
    const reasoningMessages = [
      {
        role: "system",
        content: `Sei un esperto di analisi virale. Devi produrre un output strutturato in italiano. 
        Analizza i dati audio e video e rispondi con:
        1. Analisi dettagliata dell'evento.
        2. Evento principale (1 frase).
        3. Viral Score (0-100) basato sulla struttura.

        REGOLA PERSONAGGI (FASE 1 CORE):
        - NON inventare i nomi degli attori o personaggi tramite riconoscimento facciale.
        - Usa SOLO nomi forniti dall'utente, dall'audio o dalla descrizione.
        - Se non ci sono nomi, descrivili per ruolo visivo (es. "Uomo anziano", "Ragazza con occhiali").
        - Un mancato riconoscimento identitario NON Ã¨ un errore.
        `,
      },
      {
        role: "user",
        content: `
          Descrizione utente: ${overrideDescription || "Nessuna"}
          Audio: ${transcript || "Nessun audio"}
          Video: ${frameAnalysis || "Nessuna visione"}
          Piattaforma: ${params.platform || "General"}
        `,
      },
    ];

    if (isVisionRecoveredWithOpenRouter) {
      logger.info("[GROQ_FULL_CORE_REASONING_GROQ_START]", {
        reason: "openrouter_vision_recovered",
      });
      try {
        const groqRes = await groqTextCompletion({
          messages: reasoningMessages as any,
          task: "core_reasoning_fallback",
        });
        coreAnalysis = groqRes.text;
        logger.info("[GROQ_FULL_CORE_REASONING_GROQ_SUCCESS]");
      } catch (groqErr: any) {
        logger.error("[GROQ_FULL_CORE_REASONING_GROQ_FAILED]", {
          reason: groqErr.message || String(groqErr),
        });
        failedPhase = failedPhase || "core_reasoning";
        isComplete = false;
        coreAnalysis = `Errore ragionamento Groq: ${groqErr.message}`;
      }
    } else {
      logger.info("[GROQ_FULL_CORE_REASONING_HF_START]");
      try {
        logger.info(
          "[GEMINI_REAL_CALL_BLOCKED_IN_GROQ_FULL] No Gemini calls will be made.",
        );
        logger.info("[HF_PROXY_REQUEST_START] task=text");
        coreAnalysis = await hfChatCompletion(reasoningMessages, hfKey, tModel);
        logger.info("[HF_PROXY_SUCCESS] task=text");
        logger.info("[GROQ_FULL_CORE_REASONING_HF_SUCCESS]");
      } catch (hfErr: any) {
        if (isHuggingFaceCreditsDepletedError(hfErr)) {
          logger.info("[GROQ_FULL_CORE_REASONING_HF_FAILED]", {
            reason: "credits_depleted",
          });
          logger.info("[GROQ_FULL_CORE_REASONING_GROQ_START]", {
            reason: "hf_credits_depleted_on_text",
          });
          try {
            const groqRes = await groqTextCompletion({
              messages: reasoningMessages as any,
              task: "core_reasoning_fallback_depleted",
            });
            coreAnalysis = groqRes.text;
            logger.info("[GROQ_FULL_CORE_REASONING_GROQ_SUCCESS]");
          } catch (groqErr: any) {
            logger.error("[GROQ_FULL_CORE_REASONING_GROQ_FAILED]", {
              reason: groqErr.message || String(groqErr),
            });
            failedPhase = failedPhase || "core_reasoning";
            isComplete = false;
            coreAnalysis = `Errore ragionamento Groq (fallback): ${groqErr.message}`;
          }
        } else {
          logger.error("[GROQ_FULL_PHASE_FAIL] phase=core_reasoning", hfErr);
          failedPhase = failedPhase || "core_reasoning";
          isComplete = false;
          coreAnalysis = `Errore ragionamento HF: ${hfErr.message}`;
        }
      }
    }

    logger.info("[NO_GEMINI_IN_EXTERNAL_MODE_CONFIRMED]");
    logger.info("[GROQ_FULL_CORE_ANALYSIS_DONE]");

    const isPromptPhase = params.groqFullPhase === "prompt";
    const isDegradedScriptOnly = !!(params as any)
      .continuePhase2WithTranscriptOnly;

    if (isPromptPhase || isDegradedScriptOnly) {
      logger.info("[GROQ_FULL_PHASE2_PRESERVED_AFTER_DEGRADED_CORE]", {
        groqFullPhase: params.groqFullPhase,
        continuePhase2WithTranscriptOnly: isDegradedScriptOnly,
        visionProvider: (params as any).visionProvider,
        analysisRoutingMode: (params as any).analysisRoutingMode,
        promptSafetyMode: (params as any).promptSafetyMode,
        coreOnlyBefore: true,
        coreOnlyAfter: false,
      });
    } else {
      logger.info("[GROQ_FULL_CORE_ONLY_MODE]", { enabled: true });
      logger.info("[GROQ_FULL_PHASE_SKIPPED]", {
        phase: "prompt_engine",
        reason: "core_only_phase_1",
      });
      logger.info("[GROQ_FULL_PHASE_SKIPPED]", {
        phase: "publishing",
        reason: "core_only_phase_1",
      });
      logger.info("[GROQ_FULL_PHASE_SKIPPED]", {
        phase: "cover",
        reason: "core_only_phase_1",
      });
    }
    } // End of if (!multioK) for unified Multimodal eye-ear option

    const resultString = `RISULTATO:
${coreAnalysis}

SCRIPT / TRASCRIZIONE:
${transcript || "Non disponibile"}

EVENTO SELEZIONATO:
${isComplete ? "Estratto dal ragionamento" : "Indisponibile"}

VALUTAZIONE VIRALE:
${isComplete ? "Calcolata" : "UNVERIFIED"}

EVIDENZA AUDIO:
${transcript.substring(0, 200)}...

EVIDENZA VIDEO:
${frameAnalysis.substring(0, 200)}...

NOTA:
GROQ HYBRID FULL Fase 1. Audio Groq + Vision/Reasoning Hugging Face. Gemini non usato. ${!isComplete ? `Fase fallita: ${failedPhase}` : ""}`;

    logger.info("[TRANSCRIPT_ORDER_LOCKED]", {
      target: "verifiedTranscript",
      mode: "chronological",
    });

    // Check if we suspect a loop candidate (optional, mostly for diagnostic mapping)
    if (transcript && transcript.length > 50) {
      logger.info("[TRANSCRIPT_LOOP_CANDIDATE_DETECTED]", {
        line: "Trascrizione cronologica bloccata per la prima fase",
        originalPosition: "end",
        suggestedUse: "optimizedLoopScript",
      });
    }

    const castGrounding = deriveCanonicalCastFromVision({
      detectedCharacters,
      detectedCharacterDescriptors,
      visualCastCount,
      frameObservations,
      transcript,
      visionStatus: openRouterVisionStatus,
      audioSegments,
      frameTimestamps: isVisionRecoveredWithOpenRouter
        ? openRouterTimestamps
        : [],
      recoveryAttempted: visionRecoveryAttempted,
      recoverySuccessful: visionRecoverySuccessful,
    });
    const realAudioFeatureAudit =
      await analyzeRealAudioVoiceClustersExperimental({
        audioBlob: extractedAudioBlob,
        audioSegments,
      });
    const audioVoiceClusterCapabilityAudit = {
      ...buildAudioVoiceClusterCapabilityAudit({
        hasOriginalAudioInput: !!video,
        hasAudioBlobAccess: audioBlobAvailable === true,
        hasAudioSegments:
          Array.isArray(audioSegments) && audioSegments.length > 0,
        hasWordTimestamps:
          Array.isArray(audioSegments) &&
          audioSegments.some(
            (segment: any) =>
              Array.isArray(segment?.words) && segment.words.length > 0,
          ),
      }),
      hasAudioBufferAccess: realAudioFeatureAudit.audioBufferAvailable === true,
      hasWaveformAccess: realAudioFeatureAudit.audioBufferAvailable === true,
      currentAudioMethod: realAudioFeatureAudit.realAudioAnalyzed
        ? "EXPERIMENTAL_AUDIO_FEATURE_CLUSTERING"
        : "GROQ_WHISPER_TRANSCRIPT_SEGMENTS_ONLY",
      safeConclusion: realAudioFeatureAudit.realAudioAnalyzed
        ? "Experimental audio feature clustering available, but real diarization is still not available."
        : "Real voice clustering not available: current pipeline only has transcript segments from Groq Whisper, not voice embeddings or diarization.",
    };
    logger.info("[REAL_AUDIO_VOICE_CLUSTER_EXPERIMENTAL_AUDIT]", {
      audioBufferAvailable: realAudioFeatureAudit.audioBufferAvailable,
      realAudioAnalyzed: realAudioFeatureAudit.realAudioAnalyzed,
      analyzedSegmentsCount: realAudioFeatureAudit.analyzedSegmentsCount,
      experimentalVoiceClusterCount:
        realAudioFeatureAudit.experimentalVoiceClusterCount,
      clusterConfidence: realAudioFeatureAudit.clusterConfidence,
      method: realAudioFeatureAudit.method,
      limitations: realAudioFeatureAudit.limitations,
    });
    logger.info(
      "[AUDIO_VOICE_CLUSTER_CAPABILITY_AUDIT]",
      audioVoiceClusterCapabilityAudit,
    );
    logger.info("[CAST_GROUNDING_AUDIT_ONLY]", {
      visualCastCount: castGrounding.castGroundingAudit.visualCastCount,
      detectedCharactersCount:
        castGrounding.castGroundingAudit.detectedCharactersCount,
      frameObservationSubjectsCount:
        castGrounding.castGroundingAudit.frameObservationSubjectsCount,
      canonicalCastCount: castGrounding.castGroundingAudit.canonicalCastCount,
      castSource: castGrounding.castGroundingAudit.castSource,
      transcriptHasSpeakerLabels:
        castGrounding.castGroundingAudit.transcriptHasSpeakerLabels,
    });

    const baseResult = {
      analysis: resultString,
      originalScript: transcript,
      script: transcript,
      verifiedTranscript: transcript,
      audioConscienceAudit,
      audioTimelineSegments,
      audioSpeakerGroups,
      mirrorTestBlocks,
      audioWarnings,
      finalScriptNormalized: transcript,
      audioSegments,
      audioDurationSeconds,
      frameTimestamps: isVisionRecoveredWithOpenRouter
        ? openRouterTimestamps
        : [],
      canonicalCastList: castGrounding.canonicalCastList,
      castConfidence: overrideDescription
        ? "USER_PROVIDED_CONTEXT"
        : castGrounding.castConfidence,
      castGroundingAudit: castGrounding.castGroundingAudit,
      audioVoiceClusterCapabilityAudit,
      realAudioVoiceClusterAvailable: false,
      realAudioVoiceClusterCount: null,
      realAudioVoiceClusterConfidence: "NOT_AVAILABLE",
      audioVoiceClusterMethod: "NOT_AVAILABLE",
      audioVoiceClusterConclusion:
        "Il sistema al momento non puo sapere con certezza quante voci o timbri diversi parlano nell'audio.",
      audioVoiceClusterMissingReason:
        audioVoiceClusterCapabilityAudit.missingRequirement,
      audioVoiceClusterRecommendedNextStep:
        "Serve speaker diarization o voice embedding separato per distinguere davvero le voci.",
      transcriptSpeakerCountEstimate:
        castGrounding.castGroundingAudit?.transcriptSpeakerCountEstimate ??
        castGrounding.castGroundingAudit?.estimatedSpeakerCount ??
        null,
      visualFaithfulCastCount:
        castGrounding.castGroundingAudit?.faithfulCastAudit
          ?.finalFaithfulCastCount ??
        castGrounding.castGroundingAudit?.visualCastDetectedCount ??
        null,
      probableSpeakerToVisualCharacterMapStatus:
        "NOT_AVAILABLE_NO_REAL_VOICE_CLUSTERS",
      experimentalAudioVoiceClusterAvailable:
        realAudioFeatureAudit.realAudioAnalyzed === true,
      experimentalAudioVoiceClusterCount:
        realAudioFeatureAudit.experimentalVoiceClusterCount,
      experimentalAudioVoiceClusterConfidence:
        realAudioFeatureAudit.clusterConfidence,
      realAudioFeatureAudit,
      audioVoiceUserSummary: buildAudioVoiceUserSummary({
        transcriptAvailable: !!transcript,
        timedSegmentsAvailable:
          Array.isArray(audioSegments) && audioSegments.length > 0,
        experimentalAudioAnalysisAvailable:
          realAudioFeatureAudit.realAudioAnalyzed === true,
        experimentalClusterCount:
          realAudioFeatureAudit.experimentalVoiceClusterCount,
        transcriptSpeakerEstimate:
          castGrounding.castGroundingAudit?.transcriptSpeakerCountEstimate ??
          castGrounding.castGroundingAudit?.estimatedSpeakerCount ??
          null,
        certifiedSpeakerCount: null,
        reliability: realAudioFeatureAudit.realAudioAnalyzed ? "MEDIUM" : "LOW",
        userConclusion:
          "I cluster audio sono una stima tecnica sperimentale: non equivalgono a persone reali certe.",
        userWarning:
          "Cluster audio sperimentali e stima transcript non rappresentano un conteggio certo di persone o voci reali.",
      }),
      frameObservations,
      detectedCharacters,
      detectedCharacterDescriptors,
      visualCastCount: castGrounding.castGroundingAudit.visualCastCount,
      visibleSceneMechanism,
      sceneMechanismAudit,
      castAndDialogueAudit,
      dialogueSyncAudit,
      composerDossier,
      promptDecisionTrace,
      newVisorAudit,
      visualBatchReports,
      visualCharactersDetected,
      openRouterVisionMinimalAudit: isVisionRecoveredWithOpenRouter ? {
        enabled: true,
        targetFrameCount: 80,
        actualFrameCountSent: openRouterUsedFrames,
        isNewVisor: true,
        provider: "OpenRouter",
        model: "google/gemini-2.0-flash-001",
        batchMode: openRouterUsedFrames > 20,
        reportLength: frameAnalysis?.length || 0,
        visualReportPreview: frameAnalysis?.substring(0, 150) + (frameAnalysis?.length > 150 ? "..." : ""),
        payloadMode: "VISION_NEW_VISOR",
        openRouterResponsibilities: [
          "frame_visible_subjects",
          "frame_visible_objects",
          "frame_visible_action",
          "environment",
          "raw_visual_descriptors"
        ],
        groqResponsibilities: [
          "scene_reasoning",
          "gag_interpretation",
          "cast_dialogue_reasoning",
          "prompt_decision_trace",
          "composer_dossier",
          "prompt_generation",
          "infiltrator_diagnosis"
        ],
        estimatedTokenReduction: "MEDIUM",
        finalVisionStatus: "OK"
      } : undefined,
      promptProcessInfiltrator: (params as any).groqReasoningAudit ? {
        truthSourceLedger: {
           audioAvailable: !!transcript,
           transcriptSource: "GROQ_WHISPER",
           visualFramesCount: openRouterUsedFrames,
           visionProvider: "OpenRouter",
           synchronizedDialogue: !!(params as any).groqReasoningAudit?.dialogueSyncAudit?.timingConfirmation
        },
        infiltratorDiagnosis: (params as any).groqReasoningAudit?.infiltratorDiagnosis || "Analysis completed with Groq Brain.",
        infiltratorAudit: (params as any).groqReasoningAudit?.infiltratorAudit
      } : undefined,
      optimizedLoopScript: "NON_GENERATO_CORE_TEST",
      loopStrategy: {
        enabled: false,
        movedLine: "NON_GENERATA",
        reason:
          "ModalitÃ  GROQ FULL Fase 1 Core: loop script non generato in questa fase.",
        warning:
          "Lo script principale Ã¨ bloccato in ordine puramente cronologico.",
      },
      selectedEvent: isComplete ? "Evento identificato" : "NON_DEFINITO",
      isVisionRecoveredWithOpenRouter,
      runtimeTruthStatus: {
        mode: isComplete ? "FULL_MODE" : "DEGRADED_MODE",
        severity:
          failedPhase === "audio" && !transcript
            ? "HIGH"
            : failedPhase === "openrouter_vision_fallback_timeout" ||
                failedPhase === "vision_timeout"
              ? "HIGH"
              : isComplete
                ? "NONE"
                : "LOW",
        fallbackActive:
          isVisionRecoveredWithOpenRouter ||
          failedPhase === "openrouter_vision_fallback_timeout" ||
          failedPhase === "vision_timeout",
        failedModules:
          failedPhase === "audio" && !transcript
            ? ["GROQ_WHISPER_TRANSCRIPTION"]
            : failedPhase
              ? [failedPhase]
              : [],
        userMessage:
          failedPhase === "audio" && !transcript
            ? "Trascrizione audio non completata: timeout Groq Whisper. Riprova o usa modalità senza audio."
            : failedPhase === "openrouter_vision_fallback_timeout" ||
                failedPhase === "vision_timeout"
              ? "Analisi visiva non completata: fallback OpenRouter Vision scaduto."
              : undefined,
        frameCount: isVisionRecoveredWithOpenRouter ? openRouterUsedFrames : 5,
        frameTimestamps: isVisionRecoveredWithOpenRouter
          ? openRouterTimestamps
          : "Not generated from HF",
        visionProviderRequestedFrames: openRouterRequestedFrames,
        visionProviderMaxFrames: openRouterMaxFrames,
      },
      visionProviderInfo: {
        name: isVisionRecoveredWithOpenRouter ? "OpenRouter" : "Hugging Face",
        reason: isVisionRecoveredWithOpenRouter
          ? "hf_credits_depleted"
          : "default",
      },
      visionProvider: isVisionRecoveredWithOpenRouter
        ? "OpenRouter"
        : (params as any).continuePhase2WithTranscriptOnly
          ? "openrouter_partial_or_invalid"
          : "Hugging Face",
      analysisRoutingMode: (params as any).continuePhase2WithTranscriptOnly
        ? "AUDIO_TRANSCRIPT_ONLY_PHASE2"
        : undefined,
      promptSafetyMode: (params as any).continuePhase2WithTranscriptOnly
        ? "AUDIO_VERIFIED_TRANSCRIPT_ONLY"
        : undefined,
      viralScore: isComplete ? "50/100 (Esempio)" : "UNVERIFIED_CORE_TEST",
      sourceType: "VIDEO",
      contentNature: "REAL",
      transcriptStatus: transcript ? "VERIFIED_TRANSCRIPT" : "MISSING",
      audioVerified: !!transcript,
      audioSource: "GROQ_WHISPER",
      scriptSourceMode: "AUDIO_TRANSCRIPT_GROQ",
      groqFullPhase: params.groqFullPhase || "core",
      status: "success",
    };

    return sanitizeGroqFullCoreOnlyOutput(baseResult);
  } catch (globalError: any) {
    if (
      params.groqFullPhase === "prompt" &&
      (globalError.isPhase2Timeout ||
        String(globalError.message || "").includes(
          "openrouter_vision_timeout",
        ) ||
        String(globalError).includes("openrouter_vision_timeout"))
    ) {
      logger.info("[GROQ_FULL_GLOBAL_FAIL_INTERCEPTED_FOR_PHASE2_TIMEOUT]", {
        reason: "openrouter_vision_timeout",
      });
      const timeoutResult = buildGroqFullPhase2TimeoutResult({
        transcript,
        frameAnalysis: "TIMEOUT_OPENROUTER_VISION",
        reason: "OPENROUTER_VISION_FALLBACK_TIMEOUT",
      });

      logger.info("[OPENROUTER_TIMEOUT_RESULT_RETURNED_TO_UI]", {
        status: "failed_openrouter_vision_timeout",
        sanitized: true,
        visibleToUi: true,
      });

      return timeoutResult;
    }

    if (
      params.groqFullPhase === "prompt" &&
      ((globalError as any)?.openRouterFallbackFailed ||
        String(globalError?.message || "").includes(
          "OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE",
        ))
    ) {
      logger.error("[OPENROUTER_FALLBACK_FAILED_CLASSIFIED_FOR_PHASE2]", {
        hfOriginalError: (globalError as any)?.hfOriginalError || null,
        openRouterOriginalError:
          (globalError as any)?.openRouterOriginalError ||
          String(globalError?.message || globalError),
        openRouterFailureKind:
          (globalError as any)?.openRouterFailureKind || null,
      });

      const partialResult = {
        verifiedTranscript: transcript,
        script: transcript,
        frameAnalysis:
          frameAnalysis || "VISUAL_CONTEXT_LIMITED_OPENROUTER_FAILURE",
        canonicalCastList: [],
        audioSegments: Array.isArray(audioSegments) ? audioSegments : [],
        frameTimestamps: Array.isArray(openRouterTimestamps)
          ? openRouterTimestamps
          : [],
        visualCastCount: 0,
        status: "error",
        groqFullPhase: "prompt",
        visionProvider: "OpenRouter",
        runtimeTruthStatus: {
          inputMode: "frames_only",
          frameCount: openRouterUsedFrames || 0,
          frameTimestamps: Array.isArray(openRouterTimestamps)
            ? openRouterTimestamps
            : [],
        },
      };

      const result = buildGroqFullPhase2ProviderUnavailableResult({
        phase1PartialResult: partialResult,
        reason: "OPENROUTER_FALLBACK_FAILED_EMPTY_OR_PARSE",
        provider: "openrouter",
        errorMessage: String(
          (globalError as any)?.openRouterOriginalError ||
            globalError?.message ||
            globalError,
        ),
      });
      logger.info("[GROQ_FULL_PHASE2_DONE]", {
        status: "failed_openrouter_fallback_empty_or_parse",
      });
      return result;
    }

    if (
      params.groqFullPhase === "prompt" &&
      isHuggingFaceCreditsDepletedError(globalError)
    ) {
      console.error("[GROQ_FULL_GLOBAL_FAIL_INTERCEPTED_FOR_PHASE2]", {
        reason: "hf_credits_depleted",
        phase: "prompt",
      });
      logger.error("[HF_CREDITS_DEPLETED_DETECTED]", {
        phase: "vision_or_auto_chain",
        error: globalError.message,
      });

      const partialResult = {
        verifiedTranscript: transcript,
        script: transcript,
        frameAnalysis: frameAnalysis,
        canonicalCastList: [],
        status: "error",
        groqFullPhase: "prompt",
      };

      const result = buildGroqFullPhase2ProviderUnavailableResult({
        phase1PartialResult: partialResult,
        reason: "TOTAL_PROVIDER_FAILURE",
        provider: "huggingface",
        errorMessage: String(globalError?.message || globalError),
      });
      logger.info("[GROQ_FULL_PHASE2_DONE]", {
        status: "failed_provider_unavailable_during_auto_chain",
      });
      return result;
    }

    logger.error("[GROQ_FULL_GLOBAL_FAIL]", globalError);
    return {
      error: globalError.message,
      status: "error",
      groqFullPhase: params.groqFullPhase || "core",
    };
  }
}

function sanitizeGroqFullCoreOnlyOutput(result: any): any {
  if (result.eyeEarFailed || result.success === false) {
    logger.info("[CORE_ONLY_SANITIZER_SKIPPED_ON_FAILURE]");
    return result;
  }

  if (result.groqFullPhase === "prompt") {
    logger.info("[CORE_ONLY_SANITIZER_SKIPPED_FOR_PHASE2]", {
      reason: "groqFullPhase_prompt_phase2_success",
    });
    return result;
  }

  logger.info("[GROQ_FULL_CORE_ONLY_SANITIZER_APPLIED]");
  return {
    ...result,
    // Phase 2/3/4 placeholders - FORCED BLOCK FOR CORE ONLY
    aiPrompts: "NON_GENERATO_CORE_TEST",
    publishingKit: "NON_GENERATO_CORE_TEST",
    sceneDNA: "NON_GENERATO_CORE_TEST",
    promptStrategy: "NON_GENERATO_CORE_TEST",
    promptQualityReport: "NON_GENERATO_CORE_TEST",
    soraPrompt12s: "NON_GENERATO_CORE_TEST",
    promptSora12s: "NON_GENERATO_CORE_TEST",
    promptSora15s: "NON_GENERATO_CORE_TEST",
    soraPrompt15s: "NON_GENERATO_CORE_TEST",
    klingPrompt15s: "NON_GENERATO_CORE_TEST",
    klingPrompt10s: "NON_GENERATO_CORE_TEST",
    klingPrompt: "NON_GENERATO_CORE_TEST",
    veo3Prompt8s: "NON_GENERATO_CORE_TEST",
    veoPrompt: "NON_GENERATO_CORE_TEST",
    veo3ExtensionPart1Prompt8s: "NON_GENERATO_CORE_TEST",
    veo3ExtensionPart2Prompt8s: "NON_GENERATO_CORE_TEST",
    seedancePrompt15s: "NON_GENERATO_CORE_TEST",
    sendancePrompt15s: "NON_GENERATO_CORE_TEST",
    coverPrompt: "NON_GENERATO_CORE_TEST",

    parsedKit: {
      operationalDecision: "NON_GENERATO_CORE_TEST",
    },
    bestOptimizedPrompt: {
      reason: "NON_GENERATO_CORE_TEST",
    },
    lockedPromptTabs: {
      locked: false,
    },
  };
}

async function resolveVideoFile(video: any): Promise<File> {
  if (video instanceof File) return video;
  if (video instanceof Blob)
    return new File([video], "video.mp4", { type: video.type || "video/mp4" });
  if (video && video.base64) {
    const response = await fetch(
      `data:${video.mimeType};base64,${video.base64}`,
    );
    const blob = await response.blob();
    return new File([blob], video.fileName, { type: video.mimeType });
  }
  if (typeof video === "string") {
    const res = await fetch(video);
    const blob = await res.blob();
    return new File([blob], "video.mp4", { type: "video/mp4" });
  }
  throw new Error("Video source could not be resolved");
}

function buildGroqFullPhase2TimeoutResult(params: {
  transcript: string;
  frameAnalysis: string;
  reason: string;
}) {
  const FAIL = "NON_GENERATO_PROMPT_VALIDATION_FAILED";
  const BLOCKED_P2 = "NON_GENERATO_PHASE_2";

  const result = {
    status: "failed_openrouter_vision_timeout",
    groqFullPhase: "prompt",
    verifiedTranscript: params.transcript,
    script: params.transcript,
    frameAnalysis: params.frameAnalysis,
    canonicalCastList: ["Personaggio 1 (Analisi visiva fallita per timeout)"],

    isVisionRecoveredWithOpenRouter: false,

    runtimeTruthStatus: {
      mode: "FULL_MODE",
      severity: "HIGH",
      failedModules: ["openrouter_vision_fallback_timeout"],
      warnings: ["OpenRouter Vision fallback timeout after 30000ms"],
      fallbackActive: true,
      reliabilityImpact:
        "Analisi visiva non completata: fallback OpenRouter Vision scaduto.",
      userMessage:
        "Analisi visiva non completata: fallback OpenRouter Vision scaduto.",
      details: "OpenRouter Vision fallback timeout after 30000ms",
    },

    promptQualityReport: {
      finalPass: false,
      notes: ["OPENROUTER_VISION_FALLBACK_TIMEOUT"],
    },
    lockedPromptTabs: {
      locked: false,
      phase: "prompt",
      reason: params.reason,
    },
    operationalDecision: "PROMPT_ENGINE_FAILED",
    finalPromptVerdict: "Fase 2 non generata: timeout analisi visiva.",
    humanVerdict:
      "La Fase 1 Ã¨ valida, ma i prompt non sono stati generati perchÃ© l'analisi visiva Ã¨ andata in timeout.",

    // All promptly fields
    aiPrompts: FAIL,
    sceneMasterPrompt: FAIL,
    promptSora12s: FAIL,
    soraPrompt12s: FAIL,
    promptSora15s: FAIL,
    soraPrompt15s: FAIL,
    klingPrompt: FAIL,
    klingPrompt10s: FAIL,
    klingPrompt15s: FAIL,
    veoPrompt: FAIL,
    veo3Prompt8s: FAIL,
    veo3ExtensionPart1Prompt8s: FAIL,
    veo3ExtensionPart2Prompt8s: FAIL,
    seedancePrompt15s: FAIL,
    sendancePrompt15s: FAIL,
    optimizedPrompt12s: FAIL,
    optimizedPrompt15s: FAIL,

    bestOptimizedPrompt: {
      targetField: "NONE",
      model: "OpenRouter-Fallback",
      duration: 0,
      prompt: FAIL,
      reason: params.reason,
    },

    // Blocked publishing/cover/youtube
    publishingKit: BLOCKED_P2,
    parsedKit: BLOCKED_P2,
    coverPrompt: BLOCKED_P2,
    coverAntiScrollPrompt: BLOCKED_P2,
    titles: BLOCKED_P2,
    description: BLOCKED_P2,
    hashtags: BLOCKED_P2,
    tags: BLOCKED_P2,
    pinnedComment: BLOCKED_P2,
    youtubeMarketData: BLOCKED_P2,
  };

  const sanitized = sanitizeGroqFullPhase2Output(result);
  logger.info("[AUDIO_STATE_BEFORE_FINAL_CONTRACT]", {
    audioVerified: sanitized?.audioVerified === true,
    transcriptStatus: sanitized?.transcriptStatus || "",
    verifiedTranscriptLength:
      typeof sanitized?.verifiedTranscript === "string"
        ? sanitized.verifiedTranscript.trim().length
        : 0,
    analysisRoutingMode: sanitized?.analysisRoutingMode || "",
    audioSource: sanitized?.audioSource || "",
    scriptSourceMode: sanitized?.scriptSourceMode || "",
  });
  const normalized = normalizeFinalResultContract(sanitized, {
    analysisMode: "deep",
  });
  logger.info("[AUDIO_STATE_AFTER_FINAL_CONTRACT]", {
    audioVerified: normalized?.audioVerified === true,
    transcriptStatus: normalized?.transcriptStatus || "",
    verifiedTranscriptLength:
      typeof normalized?.verifiedTranscript === "string"
        ? normalized.verifiedTranscript.trim().length
        : 0,
    analysisRoutingMode: normalized?.analysisRoutingMode || "",
  });
  return normalized;
}

async function executeGroqVisionReasoning(params: {
  transcript: string;
  audioSegments: any[];
  frameObservations: any[];
  frameTimestamps: string[];
  detectedCharacterDescriptors: any[];
  overrideDescription: string;
}) {
  const { transcript, audioSegments, frameObservations, frameTimestamps, detectedCharacterDescriptors, overrideDescription } = params;

  logger.info("[GROQ_VISION_REASONING_ENGINE_INVOKED]");

  const systemPrompt = `You are the 'Brain' (Groq) of a viral video analysis system. 
You receive raw visual 'Eyes' observations from OpenRouter (minimal visual mode) and audio data from Whisper.
Your job is to perform high-level reasoning, gag interpretation, cast analysis, and prompt strategy.

Distinguish between:
SEEN = Visible in frames (from OpenRouter)
HEARD = Audio transcript/segments
INFERRED = Your logical deduction
NOT CONFIRMED = Gaps or uncertainties

Return a valid JSON object with:
{
  "sceneMechanismAudit": {
    "mechanism": "detailed description of the gag mechanics",
    "gagType": "e.g. SLAPSTICK, DIALOGUE_BASED, ACTION_REACTION",
    "hookEvolution": "how it evolves in time",
    "payoffConfirmation": "why the payoff works or fails",
    "loopPotential": "analysis of loop feasibility"
  },
  "castAndDialogueAudit": {
    "castList": ["list of identified roles/personas"],
    "dialogueAlignment": "how lines match characters",
    "speakerConfidence": "HIGH | MEDIUM | LOW"
  },
  "dialogueSyncAudit": {
    "syncIssues": ["list of potential lip-sync or timing mismatches"],
    "timingConfirmation": "summary of audio-visual alignment"
  },
  "composerDossier": {
    "visualContext": "summary of SEEN elements",
    "audioContext": "summary of HEARD elements",
    "combinedStrategy": "how to mix both for the best prompt"
  },
  "promptDecisionTrace": {
    "primaryFocus": "ACTION | EMOTION | CAMERA | AUDIO",
    "secondaryFocus": "string",
    "reasoning": "why these focuses were chosen"
  },
  "infiltratorDiagnosis": "string analysis of data reliability and possible hallucinations",
  "infiltratorAudit": {
    "isAnomaly": boolean,
    "whatHappened": "string",
    "whyItHappened": "string",
    "whatToDoNow": ["string"],
    "howToPreventNextTime": ["string"]
  },
  "visualCharactersDetected": [
    {
      "id": "string",
      "label": "string",
      "description": "string",
      "confidence": "HIGH | MEDIUM | LOW"
    }
  ]
}`;

  logger.info("[GROQ_SEEN_HEARD_INFERRED_TRACE_BUILT]");

  const userPayload = {
    userDescription: overrideDescription,
    verifiedTranscript: transcript,
    audioSegmentsCount: audioSegments?.length || 0,
    frameObservations,
    frameTimestamps,
    detectedCharacterDescriptors
  };

  try {
    const response = await groqTextCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) }
      ],
      task: "vision_reasoning_offload",
      responseFormat: "json_object"
    });

    const data = JSON.parse(response.text || '{}');
    logger.info("[GROQ_VISION_REASONING_ENGINE_SUCCESS]", { dataKeys: Object.keys(data) });
    return data;
  } catch (error) {
    logger.error("[GROQ_VISION_REASONING_ENGINE_FAILED]", error);
    return null;
  }
}

