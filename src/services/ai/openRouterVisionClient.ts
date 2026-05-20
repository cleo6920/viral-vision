import { logger } from "../../utils/logger";

interface OpenRouterVisionResult {
  frameAnalysis: string;
  visualConfidence: number;
  frameObservations?: Array<{
    frameIndex: number;
    timestamp: string;
    visibleSubjects: string[];
    visibleObjects: string[];
    visibleAction: string;
    environment?: string;
    clothingOrRoleClues?: string[];
    rawVisualDescriptors?: string[];
    possibleRole?: string;
    possibleSpeaker?: string;
    relationToTranscript?: string;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    sourceKeySlot?: number;
  }>;
  detectedCharacters?: string[];
  detectedCharacterDescriptors?: Array<{
    id: string;
    visualIdentity: string;
    genderPresentation: string;
    ageRange: string;
    clothing: string;
    roleClue: string;
    religiousUniformClue?: boolean;
    lawUniformClue?: boolean;
    distinctiveProps: string[];
    seenInFrames: number[];
    confidence: "LOW" | "MEDIUM" | "HIGH";
    sourceKeySlot?: number;
  }>;
  visualCastCount?: number;
  sourceKeySlot?: number;
  recoveryAttempted?: boolean;
  recoverySuccessful?: boolean;
  missingFrameIndexesAfterRecovery?: number[];
  visionStatus?: string;
  [key: string]: any;
}

function extractJsonCandidate(rawText: string): string {
  const stripped = String(rawText || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? match[0] : stripped;
}

function parseOpenRouterVisionTextFallback(rawText: string, frameTimeline?: string[]): OpenRouterVisionResult | null {
  try {
    const observations: any[] = [];
    const lines = rawText.split('\n');
    let frameAnalysis = "";
    let inObservations = false;

    for (let line of lines) {
      const trimmed = line.trim();
      if (!frameAnalysis && trimmed.length > 20) {
        frameAnalysis = trimmed;
      }
      
      const frameMatch = trimmed.match(/frame\s*(\d+)/i);
      if (frameMatch) {
        const frameIndex = parseInt(frameMatch[1]);
        const timestamp = frameTimeline?.[frameIndex] || `${frameIndex * 2}s`;
        observations.push({
          frameIndex,
          timestamp,
          visibleSubjects: [],
          visibleObjects: [],
          visibleAction: trimmed,
          confidence: "LOW"
        });
      }
    }

    if (observations.length === 0) return null;

    return {
      frameAnalysis: frameAnalysis || "Fallback parsing successful.",
      visualConfidence: 0.3,
      frameObservations: observations,
      detectedCharacters: [],
      visualCastCount: 0
    };
  } catch (e) {
    return null;
  }
}

async function performSingleVisionCall(
  framesBase64: string[],
  apiKey: string,
  model: string,
  keySlot: number,
  signal?: AbortSignal,
  frameTimeline?: string[],
  isRecovery: boolean = false
): Promise<OpenRouterVisionResult> {
  const normalizedTimeline = Array.isArray(frameTimeline)
    ? frameTimeline.map((value, index) => `Frame ${index} = ${String(value || "").trim()}`)
    : [];
  
  const recoveryNote = isRecovery ? "\nIMPORTANT: This is a RECOVERY call for specific frames that were missed in the previous pass. Focus ONLY on these frames and ensure you use the ORIGINAL frameIndex provided." : "";

  const messages = [
    {
      role: "system",
      content: "You are a pure computer vision module. Analyze only the visible content of each frame. Return compact JSON observations. Do not infer story, jokes, intent, speaker identity, virality, or video prompts. Describe only what is visible."
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `[OPENROUTER_VISION_MINIMAL_MODE_ACTIVE]${recoveryNote}
Focus ONLY on visible objects, subjects, clothing, setting, specific visual action per frame.
Return ONLY a compact JSON object with this schema:

{
  "frameAnalysis": "One sentence summary of visible environment",
  "frameObservations": [
    {
      "frameIndex": 0,
      "timestamp": "5.43s",
      "visibleSubjects": ["person_1", "dog"],
      "visibleObjects": ["phone", "table"],
      "visibleAction": "person is holding a phone and laughing",
      "environment": "kitchen, indoor, bright lighting",
      "clothingOrRoleClues": ["red shirt", "white apron"],
      "rawVisualDescriptors": ["close-up", "high contrast"],
      "confidence": "HIGH"
    }
  ],
  "visualCastCount": 0
}

Rules:
- Describe ONLY what is visible. No interpretation of story or gag.
- For each frameObservation: Return observations using exactly the provided frameIndex and timestamp.
${normalizedTimeline.length > 0 ? `\nFrame timeline:\n${normalizedTimeline.join("\n")}` : ""}`
        },
        ...framesBase64.map(fBase64 => ({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${fBase64.replace(/^data:image\/[a-z]+;base64,/, '')}`
          }
        }))
      ]
    }
  ];

  const response = await fetch('/api/openrouter/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    signal,
    body: JSON.stringify({
      model,
      messages,
      openRouterApiKey: apiKey,
      frameCount: framesBase64.length,
      keySlot
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let errorData: any = { error: "OPENROUTER_VISION_FAILED" };
    try {
      if (errorText.trim().startsWith('{')) {
        errorData = JSON.parse(errorText);
      }
    } catch (e) {
      // ignored
    }
    const reason = errorData.error || (errorText.length > 0 ? errorText.slice(0, 100) : "Unknown Error");
    logger.error(`[OPENROUTER_VISION_FAILED] slot=${keySlot} reason=${reason}`, { status: response.status, errorText });
    throw new Error(reason);
  }

  const responseText = await response.text().catch(() => "");
  let data: any;
  try {
    if (responseText.trim().startsWith('{')) {
      data = JSON.parse(responseText);
    } else {
      throw new Error(`Invalid JSON response: ${responseText.slice(0, 100)}`);
    }
  } catch (e: any) {
    logger.error(`[OPENROUTER_JSON_PARSE_ERROR] slot=${keySlot} error=${e.message}`, { responseText: responseText.slice(0, 500) });
    throw new Error(`Failed to parse OpenRouter response: ${e.message}`);
  }

  const content = data?.choices?.[0]?.message?.content || data?.content || data?.rawText || "";
  
  if (!String(content || "").trim()) {
    throw new Error("EMPTY_OPENROUTER_RESPONSE");
  }

  let result: OpenRouterVisionResult;
  try {
    let cleanContent = extractJsonCandidate(String(content || ""));
    result = JSON.parse(cleanContent);
  } catch (e) {
    const fallbackResult = parseOpenRouterVisionTextFallback(String(content || ""), frameTimeline);
    if (!fallbackResult) {
      throw new Error("OPENROUTER_JSON_PARSE_FAILED");
    }
    result = fallbackResult;
  }

  result.sourceKeySlot = keySlot;
  if (Array.isArray(result.frameObservations)) {
    result.frameObservations.forEach(obs => {
      obs.sourceKeySlot = keySlot;
    });
  }
  if (Array.isArray(result.detectedCharacterDescriptors)) {
    result.detectedCharacterDescriptors.forEach(desc => {
      desc.sourceKeySlot = keySlot;
    });
  }

  return result;
}

export async function openRouterVisionAnalysis(
  framesBase64: string[],
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  frameTimeline?: string[]
): Promise<OpenRouterVisionResult> {
  const totalRequested = framesBase64.length;
  
  logger.info("[OPENROUTER_VISION_MINIMAL_MODE_ENABLED]");
  logger.info("[OPENROUTER_VISION_PAYLOAD_REDUCED]");
  logger.info("[OPENROUTER_TARGET_FRAME_COUNT_10]");
  logger.info("[OPENROUTER_MINIMAL_FRAME_OBSERVATIONS_ONLY]");

  // Adaptive Token Split Logic
  const hardLimitObserved = 12192;
  const safeTargetPerCall = 10500;
  // Frame load estimate: ~1600 tokens per frame + ~1500 for prompts/JSON instructions
  const estimatedTokensPerFrame = 1600;
  const fixedOverhead = 1500;
  
  const totalEstimatedTokens = (totalRequested * estimatedTokensPerFrame) + fixedOverhead;
  const splitRequired = totalEstimatedTokens > safeTargetPerCall;

  logger.info("[OPENROUTER_ADAPTIVE_TOKEN_SPLIT_PLAN]", {
    frameCount: totalRequested,
    totalEstimatedTokens,
    splitRequired,
    safeTargetPerCall,
    model
  });

  // Check for secondary key availability
  let apiKey2 = "";
  let secondaryAvailable = false;
  try {
    const checkRes = await fetch('/api/debug/keys');
    if (checkRes.ok) {
       const keyStatus = await checkRes.json();
       apiKey2 = keyStatus.openRouterKey2 || "";
       secondaryAvailable = !!apiKey2 && apiKey2 !== apiKey;
       logger.info("[OPENROUTER_KEY_SLOT_AVAILABLE]", { secondaryAvailable });
    }
  } catch (e) {
    logger.warn("[VISION_KEY_CHECK_FAILED]", e);
  }

  let finalResult: OpenRouterVisionResult = {
    frameAnalysis: "",
    visualConfidence: 0,
    frameObservations: [],
    detectedCharacters: [],
    visualCastCount: 0,
    sourceKeySlot: 0
  };

  const audit: any = {
    minimalMode: true,
    targetFrameCount: 10,
    payloadMode: "VISION_MINIMAL",
    openRouterResponsibilities: [
      "frame_visible_subjects",
      "frame_visible_objects",
      "frame_visible_action",
      "environment",
      "raw_visual_descriptors"
    ],
    removedFromOpenRouterPayload: [
      "gag_reasoning",
      "prompt_generation",
      "viral_reasoning",
      "composer_dossier",
      "infiltrator",
      "validator_report",
      "pagella",
      "long_audits"
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
    estimatedTokenReduction: "MEDIUM", // Reduced requested schema size
    hardLimitObserved,
    safeTargetPerCall,
    totalEstimatedTokens,
    splitRequired,
    primaryKeyUsed: true,
    secondaryKeyUsed: false,
    primaryEstimatedTokens: 0,
    secondaryEstimatedTokens: 0,
    primaryFrames: [],
    secondaryFrames: [],
    primaryCompletedFrames: [],
    secondaryCompletedFrames: [],
    failedFrames: [],
    partialVisionPreserved: false,
    finalFrameObservationsCount: 0,
    finalVisionStatus: "FAILED",
    failureReason: ""
  };

  if (!splitRequired || !secondaryAvailable) {
    logger.info("[OPENROUTER_ONE_CALL_ENOUGH]", { splitRequired, secondaryAvailable });
    audit.primaryFrames = Array.from({ length: totalRequested }, (_, i) => i);
    audit.primaryEstimatedTokens = totalEstimatedTokens;
    
    try {
      finalResult = await performSingleVisionCall(framesBase64, apiKey, model, 0, signal, frameTimeline, false);
      audit.primaryCompletedFrames = (finalResult.frameObservations || []).map(o => o.frameIndex);
      audit.finalVisionStatus = "OK";
      logger.info("[OPENROUTER_PRIMARY_CALL_SUCCESS]");
    } catch (error: any) {
      logger.error("[VISION_PRIMARY_CALL_FAILED_AUDIT]", error);
      audit.failureReason = error.message || String(error);
      audit.failedFrames = audit.primaryFrames;
    }
  } else {
    // Perform split: Key 1 takes max safe load
    const maxFramesForPrimary = Math.max(1, Math.floor((safeTargetPerCall - fixedOverhead) / estimatedTokensPerFrame));
    const batch1Indices = Array.from({ length: Math.min(maxFramesForPrimary, totalRequested) }, (_, i) => i);
    const batch2Indices = Array.from({ length: totalRequested - batch1Indices.length }, (_, i) => i + batch1Indices.length);

    logger.info("[OPENROUTER_PRIMARY_MAX_SAFE_LOAD]", { frames: batch1Indices.length });
    logger.info("[OPENROUTER_SECONDARY_REMAINING_LOAD]", { frames: batch2Indices.length });

    audit.primaryFrames = batch1Indices;
    audit.secondaryFrames = batch2Indices;
    audit.primaryEstimatedTokens = (batch1Indices.length * estimatedTokensPerFrame) + fixedOverhead;
    audit.secondaryEstimatedTokens = (batch2Indices.length * estimatedTokensPerFrame) + fixedOverhead;
    audit.secondaryKeyUsed = true;

    logger.info("[OPENROUTER_TWO_KEY_SPLIT_REQUIRED]", {
      batch1: batch1Indices.length,
      batch2: batch2Indices.length
    });

    // Call 1
    let result1: OpenRouterVisionResult | null = null;
    try {
      const frames1 = batch1Indices.map(idx => framesBase64[idx]);
      const timeline1 = batch1Indices.map(idx => frameTimeline?.[idx] || "");
      result1 = await performSingleVisionCall(frames1, apiKey, model, 0, signal, timeline1, false);
      
      // Remap indices
      if (result1.frameObservations) {
        result1.frameObservations.forEach(obs => {
          obs.frameIndex = batch1Indices[obs.frameIndex] ?? obs.frameIndex;
        });
      }
      if (result1.detectedCharacterDescriptors) {
        result1.detectedCharacterDescriptors.forEach(desc => {
          desc.seenInFrames = desc.seenInFrames.map(idx => batch1Indices[idx] ?? idx);
        });
      }

      audit.primaryCompletedFrames = (result1.frameObservations || []).map(o => o.frameIndex);
      logger.info("[OPENROUTER_PRIMARY_CALL_SUCCESS]");
    } catch (err: any) {
      logger.error("[OPENROUTER_PRIMARY_CALL_FAILED]", err);
      audit.failureReason = `Primary failed: ${err.message}`;
      audit.failedFrames.push(...batch1Indices);
    }

    // Call 2 (Remaining frames)
    let result2: OpenRouterVisionResult | null = null;
    try {
      const frames2 = batch2Indices.map(idx => framesBase64[idx]);
      const timeline2 = batch2Indices.map(idx => frameTimeline?.[idx] || "");
      result2 = await performSingleVisionCall(frames2, apiKey2, model, 1, signal, timeline2, false);

      // Remap indices
      if (result2.frameObservations) {
        result2.frameObservations.forEach(obs => {
          obs.frameIndex = batch2Indices[obs.frameIndex] ?? obs.frameIndex;
        });
      }
      if (result2.detectedCharacterDescriptors) {
        result2.detectedCharacterDescriptors.forEach(desc => {
          desc.seenInFrames = desc.seenInFrames.map(idx => batch2Indices[idx] ?? idx);
        });
      }

      audit.secondaryCompletedFrames = (result2.frameObservations || []).map(o => o.frameIndex);
      logger.info("[OPENROUTER_SECONDARY_CALL_SUCCESS]");
    } catch (err: any) {
      logger.error("[OPENROUTER_SECONDARY_CALL_FAILED]", err);
      audit.failureReason += ` | Secondary failed: ${err.message}`;
      audit.failedFrames.push(...batch2Indices);
    }

    // Merge results
    if (result1 || result2) {
      audit.partialVisionPreserved = true;
      logger.info("[OPENROUTER_FRAME_OBSERVATIONS_MERGED]");
      const mergedObs = [
        ...(result1?.frameObservations || []),
        ...(result2?.frameObservations || [])
      ].sort((a, b) => a.frameIndex - b.frameIndex);

      const mergedDescs = [
        ...(result1?.detectedCharacterDescriptors || []),
        ...(result2?.detectedCharacterDescriptors || [])
      ];

      finalResult = {
        frameAnalysis: `${result1?.frameAnalysis || ""} ${result2?.frameAnalysis || ""}`.trim(),
        visualConfidence: Math.max(result1?.visualConfidence || 0, result2?.visualConfidence || 0),
        frameObservations: mergedObs,
        detectedCharacterDescriptors: mergedDescs,
        visualCastCount: Math.max(result1?.visualCastCount || 0, result2?.visualCastCount || 0),
        sourceKeySlot: result1 ? 0 : 1
      };

      audit.finalVisionStatus = audit.failedFrames.length === 0 ? "OK" : "PARTIAL";
    }
  }

  // Final check for missing indices
  const finalObservedTable = new Set((finalResult.frameObservations || []).map(o => o.frameIndex));
  const trulyMissing = [];
  for (let i = 0; i < totalRequested; i++) {
    if (!finalObservedTable.has(i)) trulyMissing.push(i);
  }
  
  audit.finalFrameObservationsCount = finalObservedTable.size;
  if (trulyMissing.length > 0 && audit.finalVisionStatus === "OK") {
    audit.finalVisionStatus = "PARTIAL";
  }

  (finalResult as any).openRouterAdaptiveTokenSplitAudit = audit;

  logger.info("[OPENROUTER_ADAPTIVE_TOKEN_SPLIT_COMPLETED]", {
    status: audit.finalVisionStatus,
    observed: audit.finalFrameObservationsCount,
    missing: trulyMissing.length
  });

  if (trulyMissing.length > 0 && audit.finalVisionStatus !== "FAILED") {
    logger.info("[OPENROUTER_PARTIAL_VISION_PRESERVED]", { missing: trulyMissing });
  } else if (audit.finalVisionStatus === "FAILED") {
    logger.error("[OPENROUTER_NO_EMPTY_RESPONSE_IF_PARTIAL_EXISTS_FAILED]");
  }

  return finalResult;
}

export interface NewVisorResult {
  visualReport: string;
  sourceKeySlot?: number;
  newVisorAudit?: any;
  visualBatchReports?: any[];
}

export async function openRouterGemini2VisionAnalysis(
  framesBase64: string[],
  apiKey: string,
  signal?: AbortSignal,
  frameTimeline?: string[]
): Promise<NewVisorResult> {
  const model = "google/gemini-2.0-flash-001";
  const totalRequested = framesBase64.length;
  logger.info("[NEW_VISOR_GROQ_MODE_ENABLED]");
  logger.info("[NEW_VISOR_PROVIDER_SELECTED]", { provider: "openrouter" });
  logger.info("[NEW_VISOR_MODEL_SELECTED]", { model });
  logger.info("[NEW_VISOR_FRAME_TARGET]", { target: 80 });
  logger.info("[NEW_VISOR_FRAME_COUNT_EXTRACTED]", { extracted: totalRequested });
  logger.info("[NEW_VISOR_NO_AUDIO_CONFIRMED]");

  const systemInstructions =
    "Sei un visore puro. Analizza dettagliatamente i frame visivi senza audio e senza generare prompt.\n" +
    "Devi produrre un visual report narrativo fedele e strutturato contenente:\n" +
    "- ambiente\n" +
    "- personaggi visibili\n" +
    "- oggetti chiave\n" +
    "- azioni\n" +
    "- timeline visiva sintetica\n" +
    "- momento finale visivo\n" +
    "- incertezze (cosa non e' chiaro)";

  const BATCH_SIZE = 20;
  let allReports: string[] = [];

  if (totalRequested > BATCH_SIZE) {
    logger.info("[NEW_VISOR_BATCH_MODE_ENABLED]", { totalRequested, BATCH_SIZE });
    for (let i = 0; i < totalRequested; i += BATCH_SIZE) {
      const chunk = framesBase64.slice(i, i + BATCH_SIZE);
      const timelineChunk = frameTimeline ? frameTimeline.slice(i, i + BATCH_SIZE) : [];
      logger.info("[NEW_VISOR_BATCH_SEND_START]", { batchIndex: i / BATCH_SIZE, framesInBatch: chunk.length });
      
      const messages = [
        { role: "system", content: systemInstructions },
        {
          role: "user",
          content: [
            { type: "text", text: "Analizza questo gruppo di frame." },
            ...chunk.map((fBase64) => ({
              type: "image_url",
              image_url: { url: 'data:image/jpeg;base64,' + fBase64.replace(/^data:image\/[a-z]+;base64,/, '') }
            }))
          ]
        }
      ];

      const response = await fetch('/api/openrouter/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ model, messages, openRouterApiKey: apiKey, frameCount: chunk.length, keySlot: 0, forceModel: true, newVisorMode: true, disableVisionFallbackChain: true })
      });

      if (!response.ok) throw new Error(`Batch ${i / BATCH_SIZE} failed with status ${response.status}`);
      
      const responseText = await response.text();
      let content = "";
      try {
        const data = JSON.parse(responseText);
        if (data.ok === false) {
          throw new Error(`OpenRouter backend returned error: ${data.reason || data.visionStatus}`);
        }
        content = data?.choices?.[0]?.message?.content || data?.content || "";
      } catch (e: any) {
        throw new Error(`Failed to parse OpenRouter chunk response: ${e.message}`);
      }
      logger.info("[NEW_VISOR_BATCH_SEND_SUCCESS]", { batchIndex: i / BATCH_SIZE });
      allReports.push(`[BATCH ${i / BATCH_SIZE}]\n${content}`);
    }
  } else {
    logger.info("[NEW_VISOR_BATCH_SEND_START]", { batchIndex: 0, framesInBatch: totalRequested });
    const messages = [
      { role: "system", content: systemInstructions },
      {
        role: "user",
        content: [
          { type: "text", text: "Analizza questi frame." },
          ...framesBase64.map((fBase64) => ({
            type: "image_url",
            image_url: { url: 'data:image/jpeg;base64,' + fBase64.replace(/^data:image\/[a-z]+;base64,/, '') }
          }))
        ]
      }
    ];

    const response = await fetch('/api/openrouter/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ model, messages, openRouterApiKey: apiKey, frameCount: totalRequested, keySlot: 0, forceModel: true, newVisorMode: true, disableVisionFallbackChain: true })
    });

    if (!response.ok) throw new Error(`Vision request failed with status ${response.status}`);
    const responseText = await response.text();
    let content = "";
    try {
      const data = JSON.parse(responseText);
      if (data.ok === false) {
        throw new Error(`OpenRouter backend returned error: ${data.reason || data.visionStatus}`);
      }
      content = data?.choices?.[0]?.message?.content || data?.content || "";
    } catch (e: any) {
      throw new Error(`Failed to parse OpenRouter response: ${e.message}`);
    }
    logger.info("[NEW_VISOR_BATCH_SEND_SUCCESS]", { batchIndex: 0 });
    allReports.push(content);
  }

  let finalReport = allReports.join("\n\n");

  if (totalRequested > BATCH_SIZE && allReports.length > 1) {
    logger.info("[NEW_VISOR_MERGING_REPORTS]");
    const mergeMessages = [
      { role: "system", content: systemInstructions },
      { role: "user", content: "Ecco i report visivi parziali dei vari gruppi di frame. Uniscili in un unico visual report coerente senza ripetizioni, mantenendo la stessa struttura richiesta.\n\n" + finalReport }
    ];
    const response = await fetch('/api/openrouter/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ model, messages: mergeMessages, openRouterApiKey: apiKey, frameCount: 0, keySlot: 0, forceModel: true, newVisorMode: true, disableVisionFallbackChain: true })
    });
    if (response.ok) {
      try {
        const data = JSON.parse(await response.text());
        finalReport = data?.choices?.[0]?.message?.content || data?.content || finalReport;
      } catch (e) {}
    }
  }

  logger.info("[NEW_VISOR_VISUAL_REPORT_CREATED]");
  logger.info("[NEW_VISOR_VISUAL_REPORT_LENGTH]", { length: finalReport.length });

  return {
    visualReport: finalReport,
    sourceKeySlot: 0,
    newVisorAudit: {
      enabled: true,
      provider: "openrouter",
      model: "google/gemini-2.0-flash-001",
      frameTarget: totalRequested,
      framesExtracted: framesBase64.length,
      framesAnalyzed: framesBase64.length,
      framesUsed: framesBase64.length,
      framesMissing: Math.max(0, totalRequested - framesBase64.length),
      batchMode: totalRequested > BATCH_SIZE,
      batchSize: BATCH_SIZE,
      batchesCount: Math.ceil(framesBase64.length / BATCH_SIZE),
      visualReportLength: finalReport.length
    },
    visualBatchReports: allReports.map((r, i) => ({
      batchIndex: i,
      frameStartIndex: i * BATCH_SIZE,
      frameEndIndex: Math.min((i + 1) * BATCH_SIZE - 1, framesBase64.length - 1),
      framesAnalyzed: Math.min(BATCH_SIZE, framesBase64.length - i * BATCH_SIZE),
      report: r
    }))
  };
}
