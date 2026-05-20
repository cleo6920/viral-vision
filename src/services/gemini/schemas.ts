import { Type, Schema } from '@google/genai';

export const MULTI_EVIDENCE_VALIDATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "MULTI_EVIDENCE_VALIDATION: Mandatory logic to ensure decisions are supported by multiple sources (VIDEO, AUDIO, SCRIPT, CONTEXT).",
  properties: {
    decision: { type: Type.STRING, enum: ["KEEP", "MODIFY", "REPLACE"], description: "Decisione strategica basata sulla forza delle prove." },
    evidences: {
      type: Type.OBJECT,
      properties: {
        video: { type: Type.STRING, description: "Prove visive (scena, movimento, gesti, espressioni)." },
        audio: { type: Type.STRING, description: "Prove sonore (voce, tono, rumori, musica)." },
        script: { type: Type.STRING, description: "Prove testuali (parole trascritte o originali)." },
        context: { type: Type.STRING, description: "Prove contestuali (sequenza, causa-effetto)." }
      },
      required: ["video", "audio", "script", "context"]
    },
    evidence_count: { type: Type.NUMBER, description: "Numero di fonti diverse che confermano la decisione." },
    has_conflicts: { type: Type.BOOLEAN, description: "True se esistono discrepanze tra le fonti." },
    confidence_level: { type: Type.NUMBER, description: "Livello di certezza da 0 a 10." },
    status: { type: Type.STRING, enum: ["CONFIRMED", "WEAK", "CONFLICTED", "INSUFFICIENT"], description: "CONFIRMED (>=3 fonti, no conflitti), WEAK (2 fonti, no conflitti), CONFLICTED (conflitti rilevati), INSUFFICIENT (<2 fonti)." },
    narrative_status: { type: Type.STRING, enum: ["FULL", "PARTIAL", "FRAGMENTED"], description: "Stato della coerenza narrativa globale." },
    missing_parts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "start, trigger, progression, peak, ending, audio_alignment, emotion_tone" },
          severity: { type: Type.STRING, enum: ["CRITICAL", "IMPORTANT", "MINOR"] }
        },
        required: ["type", "severity"]
      }
    }
  },
  required: ["decision", "evidences", "evidence_count", "has_conflicts", "confidence_level", "status", "narrative_status", "missing_parts"]
};

export const VIRAL_STRUCTURE_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "VIRAL_STRUCTURE_ENFORCER: Struttura temporale obbligatoria per massimizzare la ritenzione.",
  properties: {
    hook: { type: Type.STRING, description: "0-1.2s -> Deve creare interruzione visiva o curiosità. Se assente o debole -> FAIL." },
    build: { type: Type.STRING, description: "1.2-4s -> Deve aumentare tensione o attenzione. Se la scena procede lineare senza build -> FAIL." },
    payoff: { type: Type.STRING, description: "4-7s -> Deve introdurre un cambiamento reale (visivo o percettivo). Se è solo un'azione ordinaria -> FAIL." },
    loop: { type: Type.STRING, description: "7-10s -> Deve riportare all'inizio senza stacco evidente." },
    validationStatus: { type: Type.STRING, enum: ["PASS", "FAIL"], description: "ESITO VALIDAZIONE. Regole FAIL: (1) Manca una fase. (2) Scena è lineare senza curve di interesse. (3) Payoff assente o nullo." },
    validationReason: { type: Type.STRING, description: "Motivo dettagliato del pass/fail basato sulla struttura temporale." }
  },
  required: ["hook", "build", "payoff", "loop", "validationStatus", "validationReason"]
};

export const STATIC_TO_VIDEO_TRANSLATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "STATIC_TO_VIDEO_TRANSLATION_ENGINE: Trasforma immagini statiche in micro-scene video realistiche.",
  properties: {
    subject: { type: Type.STRING, description: "Identificazione del primarySubject (PERSONA)." },
    movableElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista di elementi movibili (volto, occhi, mani, oggetti collegati)." },
    microScene: { type: Type.STRING, description: "Descrizione della micro-scena (naturale, coerente, breve)." },
    loopType: { type: Type.STRING, description: "Metodo di looping (ciclico, ritorno alla pos. iniziale)." },
    complexity: { type: Type.STRING, enum: ["low"], description: "Deve essere basso per mantenere realismo." }
  },
  required: ["subject", "movableElements", "microScene", "loopType", "complexity"]
};

export const MICRO_ACTIVATION_STRATEGY_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "MICRO_ACTIVATION_STRATEGY: Strategia integrata per contenuti STATIC + PERSONA.",
  properties: {
    type: { type: Type.STRING, description: "gesture, gaze, rhythm, disturbance." },
    target: { type: Type.STRING, enum: ["primarySubject"] },
    loopable: { type: Type.BOOLEAN },
    intensity: { type: Type.STRING, enum: ["low"] }
  },
  required: ["type", "target", "loopable", "intensity"]
};

export const VIRAL_VALIDATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "REAL_VIRAL_VALIDATOR: Validazione dell'effettiva efficacia e mutazione tra le fasi temporali.",
  properties: {
    phasesAreDistinct: { type: Type.BOOLEAN, description: "True se hook, build, payoff e loop sono semanticamente diversi. False se ripetono la stessa cosa o situazione. Se False -> FAIL." },
    hasRealEvolution: { type: Type.BOOLEAN, description: "True se c'è un cambiamento REALE (emotivo, visivo o concettuale) tra startState e endState. Se False (piatto) -> FAIL." },
    payoffStrength: { type: Type.STRING, enum: ["weak", "medium", "strong"], description: "Weak se è solo una continuazione. Strong se introduce un cambiamento reale o micro evento umano. Se Weak -> FAIL." },
    loopQuality: { type: Type.STRING, enum: ["poor", "valid", "seamless"], description: "Poor se il taglio è netto e innaturale, Seamless se invisibile. Se Poor -> FAIL." },
    finalVerdict: { type: Type.STRING, enum: ["PASS", "FAIL"], description: "FAIL se le fasi sono identiche, se non c'è evoluzione, se il payoff è debole o inesistente, o se il loop non è organico. QUALSIASI OUTPUT PIATTO O SOLO DESCRITTIVO DEVE ESSERE 'FAIL'." }
  },
  required: ["phasesAreDistinct", "hasRealEvolution", "payoffStrength", "loopQuality", "finalVerdict"]
};

export const SORA_PROMPT_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "SORA_PROMPT_SCHEMA: Specific schema for Sora 15s generation.",
  properties: {
    prompt: { type: Type.STRING },
    viralValidation: VIRAL_VALIDATION_SCHEMA
  },
  required: ["prompt", "viralValidation"]
};

export const VIRAL_BRAIN_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "VIRAL_BRAIN: Mandatory narrative evolution check layer.",
  properties: {
    stateChange: {
      type: Type.OBJECT,
      properties: {
        detected: { type: Type.BOOLEAN },
        description: { type: Type.STRING, description: "Spiega come l'inizio differisce dalla fine." }
      },
      required: ["detected", "description"]
    },
    payoff: {
      type: Type.OBJECT,
      properties: {
        detected: { type: Type.BOOLEAN },
        description: { type: Type.STRING, description: "Descrivi l'evento visivo/percettivo." },
        strength: { type: Type.STRING, enum: ["weak", "medium", "strong"] }
      },
      required: ["detected", "description", "strength"]
    },
    loop: {
      type: Type.OBJECT,
      properties: {
        isNatural: { type: Type.BOOLEAN },
        quality: { type: Type.STRING, enum: ["seamless", "valid", "poor"] }
      },
      required: ["isNatural", "quality"]
    },
    microActivation: {
      type: Type.OBJECT,
      properties: {
        detected: { type: Type.BOOLEAN },
        type: { type: Type.STRING, description: "respiro, occhi, gesto, etc." },
        isRealistic: { type: Type.BOOLEAN }
      },
      required: ["detected", "type", "isRealistic"]
    },
    hookSource: { type: Type.STRING, enum: ["human", "action", "situation", "environment"], description: "Se environment -> FAIL." },
    phaseCheck: {
      type: Type.OBJECT,
      properties: {
        distinct: { type: Type.BOOLEAN, description: "True se hook != build != payoff." },
        reasoning: { type: Type.STRING }
      },
      required: ["distinct", "reasoning"]
    },
    creativeDepth: { type: Type.STRING, enum: ["low", "medium", "high"] },
    finalVerdict: { type: Type.STRING, enum: ["PASS", "WEAK_PASS", "FAIL"] },
    issues: { type: Type.ARRAY, items: { type: Type.STRING } },
    retryInstructions: {
      type: Type.OBJECT,
      properties: {
        fix: { type: Type.STRING },
        avoid: { type: Type.STRING },
        target: { type: Type.STRING }
      },
      required: ["fix", "avoid", "target"]
    }
  },
  required: ["stateChange", "payoff", "loop", "microActivation", "hookSource", "phaseCheck", "creativeDepth", "finalVerdict"]
};

export const CORE_INTENT_CLASSIFIER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    coreIntent: { type: Type.STRING, enum: ["PERSONA", "PERFORMANCE", "REAL_EVENT", "PRODOTTO", "EVENTO", "AMBIENTE", "INFORMATIVO", "ALTRO"] },
    confidence: { type: Type.NUMBER },
    intentReasoning: { type: Type.STRING },
    intentPriorityApplied: { type: Type.BOOLEAN },
    rejectedIntentCandidates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["intent", "reason"]
      }
    }
  },
  required: ["coreIntent", "confidence", "intentReasoning", "intentPriorityApplied", "rejectedIntentCandidates"]
};

export const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    viralScore: { type: Type.STRING },
    viralScoreReason: { type: Type.STRING },
    contentType: { type: Type.STRING },
    dominantElement: { type: Type.STRING },
    narrativeArc: { type: Type.STRING },
    hookPotential: { type: Type.STRING },
    retentionEstimate: { type: Type.STRING }
  },
  required: ["viralScore", "viralScoreReason", "contentType", "dominantElement", "narrativeArc", "hookPotential", "retentionEstimate"]
};

export const EXTERNAL_SIGNAL_EXTRACTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    characterArtist: { type: Type.STRING, description: "Main character or artist identified (e.g., Main Subject, ABBA)" },
    theme: { type: Type.STRING, description: "Core theme of the content" },
    contentType: { type: Type.STRING, description: "Content category (Tutorial, Comedy, etc.)" },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific keywords for the content" },
    formatCues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Format descriptors (Slapstick, etc.)" },
    searchQueries: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 highly optimized YouTube search queries" },
    detectedGenre: { type: Type.STRING, description: "The musical or content genre" },
    genreConfidence: { type: Type.STRING, description: "Confidence level of genre detection (e.g., '85')" },
    signals: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Generic market signals" },
    marketTrend: { type: Type.STRING, description: "Identified market trend" },
    saturationLevel: { type: Type.STRING, description: "Content saturation level" }
  },
  required: ["characterArtist", "theme", "contentType", "keywords", "formatCues", "searchQueries", "detectedGenre", "genreConfidence"]
};

export const BLUE_OCEAN_NICHES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    niches: { type: Type.ARRAY, items: { type: Type.STRING } },
    opportunityScore: { type: Type.NUMBER }
  },
  required: ["niches", "opportunityScore"]
};

export const IDEA_ENGINE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    step1_ideaAnalysis: {
      type: Type.OBJECT,
      properties: {
        coreViralMechanic: { type: Type.STRING },
        curiosityType: { type: Type.STRING },
        expectedRetentionPoint: { type: Type.STRING },
        ideaWeaknesses: { type: Type.STRING },
        banalityRisk: { type: Type.STRING },
        nicheViability: { type: Type.STRING },
        nicheViabilityReason: { type: Type.STRING }
      },
      required: ["nicheViability", "nicheViabilityReason"]
    },
    step2_ideaEngine: {
      type: Type.OBJECT,
      properties: {
        safeIdea: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            marketGap: { type: Type.STRING },
            psychologicalTrigger: { type: Type.STRING },
            risk: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              properties: {
                immediateClarity: { type: Type.NUMBER },
                scrollStopPower: { type: Type.NUMBER },
                escalationStrength: { type: Type.NUMBER },
                humanMoment: { type: Type.NUMBER },
                loopPotential: { type: Type.NUMBER },
                shockNovelty: { type: Type.NUMBER },
                finalScore: { type: Type.NUMBER }
              },
              required: ["finalScore"]
            },
            isHighRiskHighReward: { type: Type.BOOLEAN }
          },
          required: ["id", "title", "description", "scores"]
        },
        unexpectedIdea: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            marketGap: { type: Type.STRING },
            psychologicalTrigger: { type: Type.STRING },
            risk: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              properties: {
                immediateClarity: { type: Type.NUMBER },
                scrollStopPower: { type: Type.NUMBER },
                escalationStrength: { type: Type.NUMBER },
                humanMoment: { type: Type.NUMBER },
                loopPotential: { type: Type.NUMBER },
                shockNovelty: { type: Type.NUMBER },
                finalScore: { type: Type.NUMBER }
              },
              required: ["finalScore"]
            },
            isHighRiskHighReward: { type: Type.BOOLEAN }
          },
          required: ["id", "title", "description", "scores"]
        },
        extremeIdea: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            marketGap: { type: Type.STRING },
            psychologicalTrigger: { type: Type.STRING },
            risk: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              properties: {
                immediateClarity: { type: Type.NUMBER },
                scrollStopPower: { type: Type.NUMBER },
                escalationStrength: { type: Type.NUMBER },
                humanMoment: { type: Type.NUMBER },
                loopPotential: { type: Type.NUMBER },
                shockNovelty: { type: Type.NUMBER },
                finalScore: { type: Type.NUMBER }
              },
              required: ["finalScore"]
            },
            isHighRiskHighReward: { type: Type.BOOLEAN }
          },
          required: ["id", "title", "description", "scores"]
        },
        improvedOriginalIdea: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            marketGap: { type: Type.STRING },
            psychologicalTrigger: { type: Type.STRING },
            risk: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              properties: {
                immediateClarity: { type: Type.NUMBER },
                scrollStopPower: { type: Type.NUMBER },
                escalationStrength: { type: Type.NUMBER },
                humanMoment: { type: Type.NUMBER },
                loopPotential: { type: Type.NUMBER },
                shockNovelty: { type: Type.NUMBER },
                finalScore: { type: Type.NUMBER }
              },
              required: ["finalScore"]
            },
            isHighRiskHighReward: { type: Type.BOOLEAN }
          },
          required: ["id", "title", "description", "scores"]
        },
        aiRecommendedIdeaId: { type: Type.STRING },
        aiRecommendedReason: { type: Type.STRING }
      },
      required: ["safeIdea", "unexpectedIdea", "extremeIdea", "improvedOriginalIdea", "aiRecommendedIdeaId"]
    }
  },
  required: ["step1_ideaAnalysis", "step2_ideaEngine"]
};

export const BASE_PROMPT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    prompt: { type: Type.STRING },
    modifications: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["prompt", "modifications"]
};

export const VIRAL_BOOST_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    boosters: { type: Type.ARRAY, items: { type: Type.STRING } },
    potentialImpact: { type: Type.STRING }
  },
  required: ["boosters", "potentialImpact"]
};

export const DOMINANCE_PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    plan: { type: Type.STRING }
  },
  required: ["plan"]
};

export const CONTENT_HIERARCHY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    contentType: { type: Type.STRING },
    primarySubject: { type: Type.STRING, description: "Chi o cosa è il soggetto principale?" },
    secondarySubjects: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Quali sono gli elementi secondari?" },
    tertiaryElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Quali sono gli elementi terziari o di supporto?" },
    hookCandidates: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Quale elemento può servire da hook senza diventare il centro?" },
    dominantPurpose: { type: Type.STRING, description: "Qual è la promessa o funzione del contenuto (es. vendere, evento, ecc)?" },
    requiredSceneDestination: { type: Type.STRING, description: "Quale deve essere la destinazione finale della scena generata?" },
    forbiddenDominantElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Quali elementi NON possono diventare dominanti pur essendo presenti?" },
    optionalEnhancements: {
      type: Type.OBJECT,
      properties: {
        musicMatchesContent: { type: Type.BOOLEAN },
        suggestedAudioStyle: { type: Type.STRING },
        pacing: { type: Type.STRING }
      }
    }
  },
  required: [
    "contentType", "primarySubject", "secondarySubjects", 
    "tertiaryElements", "hookCandidates", "dominantPurpose", 
    "requiredSceneDestination", "forbiddenDominantElements"
  ]
};

export const SUPREME_VIRAL_VALIDATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "SUPREME_VIRAL_VALIDATOR: Final gate to decide if output is truly publishable.",
  properties: {
    svv: {
      type: Type.OBJECT,
      properties: {
        verdict: { type: Type.STRING, enum: ["PUBLISH", "RETRY", "REJECT"] },
        confidence: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
        reason: { type: Type.STRING },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["verdict", "confidence", "reason", "actions"]
    }
  },
  required: ["svv"]
};

export const MICRO_TENSION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING, enum: ["generate", "extract"] },
    type: { type: Type.STRING, enum: ["gaze anomaly", "micro-delay", "interrupted action", "off-frame trigger", "contrast behavior", "natural emphasis", "timing shift", "none"] },
    mechanism: { type: Type.STRING },
    loopable: { type: Type.BOOLEAN },
    intensity: { type: Type.STRING, enum: ["low", "medium"] }
  },
  required: ["mode", "type", "mechanism", "loopable", "intensity"]
};

export const CAUSAL_LINK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    valid: { type: Type.BOOLEAN },
    confidence: { type: Type.NUMBER },
    note: { type: Type.STRING }
  },
  required: ["valid", "confidence", "note"]
};

export const CAUSAL_CHAIN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    start_to_trigger: CAUSAL_LINK_SCHEMA,
    trigger_to_progression: CAUSAL_LINK_SCHEMA,
    progression_to_peak: CAUSAL_LINK_SCHEMA,
    peak_to_ending: CAUSAL_LINK_SCHEMA,
    causal_score: { type: Type.NUMBER },
    weak_links: { type: Type.ARRAY, items: { type: Type.STRING } },
    causal_chain_valid: { type: Type.BOOLEAN }
  },
  required: ["start_to_trigger", "trigger_to_progression", "progression_to_peak", "peak_to_ending", "causal_score", "weak_links", "causal_chain_valid"]
};

export const PROMPT_PROCESS_INFILTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  description: "PROMPT_PROCESS_INFILTRATOR: Diagnostica profonda della filiera di generazione.",
  properties: {
    truthSourceLedger: {
      type: Type.OBJECT,
      properties: {
        audioAvailable: { type: Type.BOOLEAN },
        transcriptSource: { type: Type.STRING, enum: ["GROQ_WHISPER", "HF_WHISPER", "FALLBACK_LLM", "NONE"] },
        visualFramesCount: { type: Type.NUMBER },
        visionProvider: { type: Type.STRING },
        synchronizedDialogue: { type: Type.BOOLEAN }
      },
      required: ["audioAvailable", "transcriptSource", "visualFramesCount", "visionProvider", "synchronizedDialogue"]
    },
    composerUsageTrace: {
      type: Type.OBJECT,
      properties: {
        baseDossierUsed: { type: Type.BOOLEAN },
        audioContextIntegrated: { type: Type.BOOLEAN },
        videoContextIntegrated: { type: Type.BOOLEAN },
        alignmentConfidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW", "NONE"] }
      },
      required: ["baseDossierUsed", "audioContextIntegrated", "videoContextIntegrated", "alignmentConfidence"]
    },
    promptLineageTrace: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING },
          origin: { type: Type.STRING, enum: ["PHASE_2_LLM", "PHASE_1_DIRECT", "RECOVERY_FALLBACK"] },
          primaryDataSource: { type: Type.STRING, enum: ["TRANSCRIPT", "VISION", "HYBRID", "INFERRED"] },
          wasScrubbed: { type: Type.BOOLEAN }
        },
        required: ["field", "origin", "primaryDataSource", "wasScrubbed"]
      }
    },
    validatorInterrogationTrace: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          checkName: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["PASS", "FAIL", "WARNING"] },
          technicalDetail: { type: Type.STRING }
        },
        required: ["checkName", "status", "technicalDetail"]
      }
    },
    gradeInterrogationTrace: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          rawScore: { type: Type.NUMBER },
          finalScore: { type: Type.NUMBER },
          uiReason: { type: Type.STRING },
          dataUsed: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["subject", "rawScore", "finalScore", "uiReason", "dataUsed"]
      }
    },
    promptLineageDeepTrace: {
      type: Type.OBJECT,
      properties: {
        rawLlmPromptFields: { type: Type.OBJECT },
        parsedPromptFields: { type: Type.OBJECT },
        validatedPromptFields: { type: Type.OBJECT },
        promotedPromptFields: { type: Type.OBJECT },
        postNormalizationPromptFields: { type: Type.OBJECT },
        uiBoundPromptFields: { type: Type.OBJECT },
        displayedActivePrompt: { type: Type.OBJECT },
        mismatches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
              evidence: { type: Type.STRING },
              suspectedCause: { type: Type.STRING }
            },
            required: ["type", "severity", "evidence", "suspectedCause"]
          }
        },
        finalInvestigationConclusion: { type: Type.STRING }
      },
      required: ["rawLlmPromptFields", "parsedPromptFields", "validatedPromptFields", "promotedPromptFields", "postNormalizationPromptFields", "uiBoundPromptFields", "displayedActivePrompt", "mismatches", "finalInvestigationConclusion"]
    },
    finalInfiltratorVerdict: { type: Type.STRING, enum: ["OK", "SUSPICIOUS", "VISIBLE_FALLBACK", "AUDIO_ONLY", "VISION_ONLY", "DATA_MISMATCH"] },
    infiltratorDiagnosis: { type: Type.STRING }
  },
  required: ["truthSourceLedger", "composerUsageTrace", "promptLineageTrace", "validatorInterrogationTrace", "gradeInterrogationTrace", "promptLineageDeepTrace", "finalInfiltratorVerdict", "infiltratorDiagnosis"]
};

export const FINAL_EVOLUTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    promptProcessInfiltrator: PROMPT_PROCESS_INFILTRATOR_SCHEMA,
    sourceType: { type: Type.STRING, enum: ["STATIC_IMAGE", "POSTER", "FLYER", "REAL_VIDEO", "ANIMATED", "ILLUSTRATION"], description: "Classificazione obbligatoria del contenuto sorgente." },
    contentNature: { type: Type.STRING, description: "Classificazione universale della natura del contenuto (es. REAL_EVENT, PRODUCT_DEMO, TALK_DIALOGUE)." },
    primaryEngine: { type: Type.STRING, description: "Motore primario di engagement (es. ACTION_DRIVEN, VERBAL_DRIVEN)." },
    script: { type: Type.STRING },
    originalScript: { type: Type.STRING },
    visibleSurfaceElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "RULE: prefer abstract class if visually uncertain; prefer functional role over invented specific noun; do not force specific nouns from weak evidence." },
    semanticMentions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "RULE: include only high-confidence labels directly supported by visual/audio evidence; do not infer scenario-specific objects, foods, products, event types, or narrative context from weak clues." },
    physicsWhitelist: { type: Type.ARRAY, items: { type: Type.STRING } },
    promptInventory: { type: Type.ARRAY, items: { type: Type.STRING }, description: "RULE: prefer abstract class if visually uncertain; prefer functional role over invented specific noun; do not force specific nouns from weak evidence." },
    aiPrompts: { type: Type.STRING },
    soraPrompt12s: { type: Type.STRING },
    klingPrompt: { type: Type.STRING },
    veoPrompt: { type: Type.STRING },
    translation: STATIC_TO_VIDEO_TRANSLATION_SCHEMA,
    microActivationStrategy: MICRO_ACTIVATION_STRATEGY_SCHEMA,
    microTension: MICRO_TENSION_SCHEMA,
    viralStructure: VIRAL_STRUCTURE_SCHEMA,
    viralBrain: VIRAL_BRAIN_SCHEMA,
    creativeDepth: { type: Type.STRING, enum: ["low", "medium", "high"], description: "Valutazione sulla profondità creativa. HIGH solo se patternBreak è true." },
    creativePotential: { type: Type.STRING, enum: ["low", "medium", "high"], description: "Potenziale creativo in base all'input." },
    creativePotentialReason: { type: Type.STRING, description: "Motivazione basata su: numero soggetti, oggetti attivabili, tensione implicita, varietà segnali visivi, micro-payoff disponibili." },
    qualityWithinCeiling: {
      type: Type.OBJECT,
      properties: {
        ceiling: { type: Type.STRING, enum: ["low", "medium", "high"] },
        achieved: { type: Type.STRING, enum: ["low", "medium", "high"] },
        isMaxedOut: { type: Type.BOOLEAN, description: "True sse tutte le opportunità di payoff individuate sono state sfruttate." },
        reason: { type: Type.STRING, description: "Spiegazione empirica del perché l'output è considerato (o meno) al massimo delle sue possibilità." }
      },
      required: ["ceiling", "achieved", "isMaxedOut", "reason"]
    },
    creativeEvaluation: {
      type: Type.OBJECT,
      properties: {
        novelty: { type: Type.STRING, enum: ["low", "medium", "high"] },
        humanEngagement: { type: Type.STRING, enum: ["low", "medium", "high"] },
        microPayoffQuality: { type: Type.STRING, enum: ["low", "medium", "high"] },
        loopNaturalness: { type: Type.STRING, enum: ["low", "medium", "high"] }
      },
      required: ["novelty", "humanEngagement", "microPayoffQuality", "loopNaturalness"]
    },
    coverPrompt: { type: Type.STRING },
    sceneEvolution: {
      type: Type.OBJECT,
      properties: {
        startState: { type: Type.STRING },
        endState: { type: Type.STRING },
        transformationType: { type: Type.STRING },
        isMeaningful: { type: Type.BOOLEAN }
      },
      required: ["startState", "endState", "transformationType", "isMeaningful"]
    },
    pubTitleIt: { type: Type.STRING },
    pubTitleEn: { type: Type.STRING },
    pubTitoliHookIt: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubTitoliHookEn: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubVideoHookIt: { type: Type.STRING },
    pubVideoHookEn: { type: Type.STRING },
    pubAudioStrategyIt: { type: Type.STRING },
    pubAudioStrategyEn: { type: Type.STRING },
    pubDescriptionIt: { type: Type.STRING },
    pubDescriptionEn: { type: Type.STRING },
    pubHashtagsIt: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubHashtagsEn: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubTagsIt: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubTagsEn: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubPinnedCommentIt: { type: Type.STRING },
    pubPinnedCommentEn: { type: Type.STRING },
    pubFileName: { type: Type.STRING },
    pubRecommendedTime: { type: Type.STRING },
    viralScore: { type: Type.STRING },
    retentionProbability: { type: Type.STRING },
    predictedViews: { type: Type.STRING },
    neuroScore: { type: Type.STRING },
    neuroHookRate: { type: Type.STRING },
    neuroRetention: { type: Type.STRING },
    neuroViralPotential: { type: Type.STRING },
    cognitiveClass: { type: Type.STRING },
    cognitiveActivation: { type: Type.STRING },
    cognitiveProcessing: { type: Type.STRING },
    spreadabilityScore: { type: Type.STRING },
    spreadabilityReasoning: { type: Type.STRING },
    shareTrigger: { type: Type.STRING },
    commentPressure: { type: Type.STRING },
    relatability: { type: Type.STRING },
    patternBreak: { type: Type.STRING },
    finalPromptVerdict: { type: Type.STRING },
    altHook: { type: Type.STRING },
    altScene: { type: Type.STRING },
    altTwist: { type: Type.STRING },
    humanVerdict: { type: Type.STRING },
    operationalDecision: { type: Type.STRING, enum: ["GENERA", "GENERA_CON_AVVERTENZA", "RIVEDI", "BLCCA"] },
    readyAlternative: { type: Type.ARRAY, items: { type: Type.STRING } },
    alternativePrompt: { type: Type.STRING },
    scriptSourceMode: { type: Type.STRING, enum: ["FROM_ORIGINAL_SCRIPT", "FROM_SUBTITLES", "FROM_VISUAL_INFERENCE", "MIXED"], description: "Source methodology for the optimized script." },
    scriptOptimizationStatus: { type: Type.STRING, enum: ["OPTIMIZED_OK", "ORIGINAL_SCRIPT_PREFERRED", "SCRIPT_WEAK_REVIEW_REQUIRED"], description: "Status of the script optimization process." },
    scriptFaithfulnessScore: { type: Type.NUMBER, description: "Faithfulness score relative to originalScript (0-100)." },
    preservedKeyLines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of key lines preserved from the original." },
    removedLinesReason: { type: Type.STRING, description: "Reasoning for line removal during optimization." },
    transcriptSource: { type: Type.STRING, enum: ["VERIFIED_AUDIO", "SUBTITLES", "VISUAL_INFERENCE", "NOT_AVAILABLE"], description: "Source of the dialogue/transcript." },
    dialogueConfidence: { type: Type.NUMBER, description: "Confidence in the accuracy of the transcription/inference (0-100)." },
    sourceAnchor: {
      type: Type.OBJECT,
      properties: {
        isAligned: { type: Type.BOOLEAN },
        reason: { type: Type.STRING },
        alternativeGenerated: { type: Type.BOOLEAN }
      },
      required: ["isAligned", "reason", "alternativeGenerated"]
    },
    validationTrace: {
      type: Type.OBJECT,
      properties: {
        structuralFailTriggered: { type: Type.BOOLEAN },
        reason: { type: Type.STRING },
        regenerationCount: { type: Type.NUMBER },
        finalPassSource: { type: Type.STRING }
      },
      required: ["structuralFailTriggered", "reason", "regenerationCount", "finalPassSource"]
    },
    failureHandling: {
      type: Type.OBJECT,
      properties: {
        usedSanitization: { type: Type.BOOLEAN },
        usedRegeneration: { type: Type.BOOLEAN },
        retryCount: { type: Type.NUMBER },
        semanticIntegrityPreserved: { type: Type.BOOLEAN }
      },
      required: ["usedSanitization", "usedRegeneration", "retryCount", "semanticIntegrityPreserved"]
    },
    missingDataLog: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["field", "reason"]
      }
    },
    observedFacts: {
      type: Type.OBJECT,
      properties: {
        observedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        interpretations: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["observedFacts", "interpretations"]
    },
    executionDebugBlock: {
      type: Type.OBJECT,
      properties: {
        detectedLanguage: { type: Type.STRING },
        culturalContext: { type: Type.STRING },
        contentType: { type: Type.STRING },
        dominantEntity: { type: Type.STRING },
        dialogueMappingCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        externalDataLanguageMatch: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        externalDataCultureMatch: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        coverPromptGenerated: { type: Type.BOOLEAN },
        outputCompletenessCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        scoreConsistencyCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        transformationOverreach: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        noActivation: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        languageSeparationCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        directivePriorityCheck: { type: Type.STRING, enum: ["PASS", "FAIL", "N/A"] },
        originalScriptRealityCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        promptRealityCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        sourceContextDepth: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
        frameCoverageQuality: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
        transcriptConfidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
        sourceReliabilityLevel: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] }
      },
      required: [
        "detectedLanguage", "culturalContext", "contentType", "dominantEntity",
        "dialogueMappingCheck", "externalDataLanguageMatch", "externalDataCultureMatch",
        "coverPromptGenerated", "outputCompletenessCheck", "scoreConsistencyCheck",
        "transformationOverreach", "noActivation",
        "languageSeparationCheck", "directivePriorityCheck", "originalScriptRealityCheck",
        "promptRealityCheck",
        "sourceContextDepth", "frameCoverageQuality", "transcriptConfidence", "sourceReliabilityLevel"
      ]
    },
    viralAudit: {
      type: Type.OBJECT,
      properties: {
        signature: { type: Type.STRING },
        enforcementMarker: { type: Type.STRING },
        strategyReasoning: { type: Type.STRING },
        enforcementPass: { type: Type.BOOLEAN }
      },
      required: ["signature", "enforcementMarker", "strategyReasoning", "enforcementPass"]
    },
    multiEvidenceValidation: MULTI_EVIDENCE_VALIDATION_SCHEMA,
    causalChainValidation: CAUSAL_CHAIN_SCHEMA
  },
  required: [
    "sourceType", "script", "originalScript", "visibleSurfaceElements", "semanticMentions", "physicsWhitelist", "promptInventory", "aiPrompts", "soraPrompt12s", "klingPrompt", "veoPrompt", "viralStructure", "coverPrompt", "sceneEvolution",
    "pubTitleIt", "pubTitleEn", "pubTitoliHookIt", "pubVideoHookIt", "pubDescriptionIt", "pubHashtagsIt", "pubTagsIt", "pubPinnedCommentIt", "pubRecommendedTime", "viralScore", "retentionProbability", "predictedViews",
    "neuroScore", "neuroHookRate", "neuroRetention", "neuroViralPotential", "cognitiveClass", "cognitiveActivation", "cognitiveProcessing", "spreadabilityScore", "shareTrigger", "commentPressure", "relatability", "patternBreak",
    "finalPromptVerdict", "altHook", "altScene", "altTwist", "humanVerdict", "operationalDecision", "readyAlternative", "sourceAnchor", "validationTrace", "viralAudit", "executionDebugBlock", "observedFacts", "multiEvidenceValidation", "causalChainValidation",
    "scriptSourceMode", "scriptOptimizationStatus", "scriptFaithfulnessScore", "transcriptSource", "dialogueConfidence"
  ]
};

export const SORA_PROMPT_VERSION_SCHEMA: Schema = SORA_PROMPT_SCHEMA;
export const FULL_VIDEO_ANALYSIS_SCHEMA: Schema = FINAL_EVOLUTION_SCHEMA;

export const DECISION_GATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    decision: { type: Type.STRING, enum: ["KEEP", "MODIFY", "REPLACE"] },
    confidence: { type: Type.STRING },
    reasoning: { type: Type.STRING }
  },
  required: ["decision", "confidence", "reasoning"]
};

export const TRANSFORMATION_ENGINE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    transformation: { type: Type.STRING },
    impact: { type: Type.STRING }
  },
  required: ["transformation", "impact"]
};

export const PRIMARY_PURPOSE_LOCK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    lockStatus: { type: Type.STRING, enum: ["PASS", "FAIL"] },
    elementsClassification: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          element: { type: Type.STRING },
          role: { type: Type.STRING, enum: ["CORE_DRIVER", "SUPPORT", "DECORATION"] },
          justification: { type: Type.STRING }
        },
        required: ["element", "role", "justification"]
      }
    },
    hookConstraint: {
      type: Type.OBJECT,
      properties: {
        allowedElements: { type: Type.ARRAY, items: { type: Type.STRING } },
        forbiddenElements: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestedHookFocus: { type: Type.STRING }
      },
      required: ["allowedElements", "forbiddenElements", "suggestedHookFocus"]
    },
    openingConstraint: { type: Type.STRING },
    reason: { type: Type.STRING },
    scrappedElement: { type: Type.STRING }
  },
  required: ["lockStatus", "elementsClassification", "hookConstraint", "openingConstraint", "reason"]
};

export const FUNCTIONAL_ROLE_LOCK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    lockStatus: { type: Type.STRING, enum: ["PASS", "FAIL"] },
    primaryEmotion: { type: Type.STRING, enum: ["curiosity", "tension", "experience", "utility", "other"] },
    implicitElement: { type: Type.STRING },
    emotionSourceRole: { type: Type.STRING, enum: ["CORE_DRIVER", "SUPPORT", "DECORATION"] },
    passReasoning: { type: Type.STRING },
    correctiveDirection: { type: Type.STRING }
  },
  required: ["lockStatus", "primaryEmotion", "implicitElement", "emotionSourceRole", "passReasoning"]
};

export const IDEA_ANCHOR_LOCK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    anchorStatus: { type: Type.STRING, enum: ["LOCKED", "FAIL"] },
    coreConcept: { type: Type.STRING },
    unbreakableElements: { type: Type.ARRAY, items: { type: Type.STRING } },
    forbiddenDrift: { type: Type.ARRAY, items: { type: Type.STRING } },
    anchorReasoning: { type: Type.STRING }
  },
  required: ["anchorStatus", "coreConcept", "unbreakableElements", "forbiddenDrift", "anchorReasoning"]
};

export const LIGHT_VIDEO_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    detectedGenre: { type: Type.STRING },
    contentNature: { type: Type.STRING },
    primaryEngine: { type: Type.STRING },
    genreConfidence: { type: Type.NUMBER },
    viralScore: { type: Type.STRING },
    analysisMeaning: { type: Type.STRING },
    originalScript: { type: Type.STRING },
    visibleSurfaceElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "RULE: prefer abstract class if visually uncertain; prefer functional role over invented specific noun; do not force specific nouns from weak evidence." },
    semanticMentions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "RULE: include only high-confidence labels directly supported by visual/audio evidence; do not infer scenario-specific objects, foods, products, event types, or narrative context from weak clues." },
    physicsWhitelist: { type: Type.ARRAY, items: { type: Type.STRING } },
    promptInventory: { type: Type.ARRAY, items: { type: Type.STRING }, description: "RULE: prefer abstract class if visually uncertain; prefer functional role over invented specific noun; do not force specific nouns from weak evidence." },
    optimizedScript: { type: Type.STRING },
    promptSora15s: { type: Type.STRING },
    promptSora12s: { type: Type.STRING },
    promptKling: { type: Type.STRING },
    promptVeo: { type: Type.STRING },
    translation: STATIC_TO_VIDEO_TRANSLATION_SCHEMA,
    microActivationStrategy: MICRO_ACTIVATION_STRATEGY_SCHEMA,
    microTension: MICRO_TENSION_SCHEMA,
    viralStructure: VIRAL_STRUCTURE_SCHEMA,
    pubTitleIt: { type: Type.STRING },
    pubTitleEn: { type: Type.STRING },
    pubTitoliHookIt: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubTitoliHookEn: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubVideoHookIt: { type: Type.STRING },
    pubVideoHookEn: { type: Type.STRING },
    pubAudioStrategyIt: { type: Type.STRING },
    pubAudioStrategyEn: { type: Type.STRING },
    pubDescriptionIt: { type: Type.STRING },
    pubDescriptionEn: { type: Type.STRING },
    pubHashtagsIt: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubHashtagsEn: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubTagsIt: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubTagsEn: { type: Type.ARRAY, items: { type: Type.STRING } },
    pubPinnedCommentIt: { type: Type.STRING },
    pubPinnedCommentEn: { type: Type.STRING },
    pubFileName: { type: Type.STRING },
    pubRecommendedTime: { type: Type.STRING },
    neuroScore: { type: Type.STRING },
    neuroHookRate: { type: Type.STRING },
    neuroRetention: { type: Type.STRING },
    neuroViralPotential: { type: Type.STRING },
    spreadabilityScore: { type: Type.STRING },
    shareTrigger: { type: Type.STRING },
    commentPressure: { type: Type.STRING },
    relatability: { type: Type.STRING },
    patternBreak: { type: Type.STRING },
    dnaStatus: { type: Type.STRING },
    dnaScore: { type: Type.STRING },
    coverPrompt: { type: Type.STRING },
    engineVerdict: { type: Type.STRING },
    finalPromptVerdict: { type: Type.STRING },
    altHook: { type: Type.STRING },
    altScene: { type: Type.STRING },
    altTwist: { type: Type.STRING },
    humanVerdict: { type: Type.STRING },
    operationalDecision: { type: Type.STRING, enum: ["GENERA", "GENERA_CON_AVVERTENZA", "RIVEDI", "BLCCA"] },
    readyAlternative: { type: Type.ARRAY, items: { type: Type.STRING } },
    scriptSourceMode: { type: Type.STRING, enum: ["FROM_ORIGINAL_SCRIPT", "FROM_SUBTITLES", "FROM_VISUAL_INFERENCE", "MIXED"] },
    scriptOptimizationStatus: { type: Type.STRING, enum: ["OPTIMIZED_OK", "ORIGINAL_SCRIPT_PREFERRED", "SCRIPT_WEAK_REVIEW_REQUIRED"] },
    scriptFaithfulnessScore: { type: Type.NUMBER },
    preservedKeyLines: { type: Type.ARRAY, items: { type: Type.STRING } },
    removedLinesReason: { type: Type.STRING },
    transcriptSource: { type: Type.STRING, enum: ["VERIFIED_AUDIO", "SUBTITLES", "VISUAL_INFERENCE", "NOT_AVAILABLE"] },
    dialogueConfidence: { type: Type.NUMBER },
    isSaturated: { type: Type.BOOLEAN },
    observedFacts: {
      type: Type.OBJECT,
      properties: {
        observedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        interpretations: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["observedFacts", "interpretations"]
    },
    executionDebugBlock: {
      type: Type.OBJECT,
      properties: {
        detectedLanguage: { type: Type.STRING },
        culturalContext: { type: Type.STRING },
        contentType: { type: Type.STRING },
        dominantEntity: { type: Type.STRING },
        dialogueMappingCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        externalDataLanguageMatch: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        externalDataCultureMatch: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        coverPromptGenerated: { type: Type.BOOLEAN },
        outputCompletenessCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        scoreConsistencyCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        transformationOverreach: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        noActivation: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        languageSeparationCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        directivePriorityCheck: { type: Type.STRING, enum: ["PASS", "FAIL", "N/A"] },
        originalScriptRealityCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        promptRealityCheck: { type: Type.STRING, enum: ["PASS", "FAIL"] },
        sourceContextDepth: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
        frameCoverageQuality: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
        transcriptConfidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
        sourceReliabilityLevel: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] }
      },
      required: [
        "detectedLanguage", "culturalContext", "contentType", "dominantEntity",
        "dialogueMappingCheck", "externalDataLanguageMatch", "externalDataCultureMatch",
        "coverPromptGenerated", "outputCompletenessCheck", "scoreConsistencyCheck",
        "transformationOverreach", "noActivation",
        "languageSeparationCheck", "directivePriorityCheck", "originalScriptRealityCheck",
        "promptRealityCheck",
        "sourceContextDepth", "frameCoverageQuality", "transcriptConfidence", "sourceReliabilityLevel"
      ]
    },
    validationTrace: {
      type: Type.OBJECT,
      properties: {
        structuralFailTriggered: { type: Type.BOOLEAN },
        reason: { type: Type.STRING },
        regenerationCount: { type: Type.NUMBER },
        finalPassSource: { type: Type.STRING }
      },
      required: ["structuralFailTriggered", "reason", "regenerationCount", "finalPassSource"]
    },
    sourceAnchor: {
      type: Type.OBJECT,
      properties: {
        isAligned: { type: Type.BOOLEAN },
        reason: { type: Type.STRING },
        alternativeGenerated: { type: Type.BOOLEAN }
      },
      required: ["isAligned", "reason", "alternativeGenerated"]
    },
    eventQualitySelector: {
      type: Type.OBJECT,
      properties: {
        candidate1: { type: Type.STRING },
        candidate2: { type: Type.STRING },
        candidate3: { type: Type.STRING },
        evaluation: { type: Type.STRING },
        selectedEvent: { type: Type.STRING },
        eventCategory: { type: Type.STRING, enum: ["EVENTO REALE", "ESPERIENZA CONCRETA", "CURIOSITÀ GRAFICA", "DETTAGLIO SURFACE"] },
        intentScoring: {
          type: Type.OBJECT,
          properties: {
            eventIntentScore: { type: Type.NUMBER },
            experienceIntentScore: { type: Type.NUMBER },
            actionLandingIntentScore: { type: Type.NUMBER },
            finalVerdict: { type: Type.STRING }
          },
          required: ["eventIntentScore", "experienceIntentScore", "actionLandingIntentScore", "finalVerdict"]
        }
      },
      required: ["candidate1", "candidate2", "candidate3", "evaluation", "selectedEvent", "eventCategory", "intentScoring"]
    },
    viralAudit: {
      type: Type.OBJECT,
      properties: {
        signature: { type: Type.STRING },
        enforcementMarker: { type: Type.STRING },
        strategyReasoning: { type: Type.STRING },
        enforcementPass: { type: Type.BOOLEAN }
      },
      required: ["signature", "enforcementMarker", "strategyReasoning", "enforcementPass"]
    },
    multiEvidenceValidation: MULTI_EVIDENCE_VALIDATION_SCHEMA,
    causalChainValidation: CAUSAL_CHAIN_SCHEMA,
    missingDataLog: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["field", "reason"]
      }
    }
  },
  required: [
    "detectedGenre", "genreConfidence", "viralScore", "analysisMeaning", "originalScript",
    "visibleSurfaceElements", "semanticMentions", "physicsWhitelist", "promptInventory",
    "optimizedScript", "promptSora15s", "promptSora12s", "promptKling", "promptVeo", "viralStructure",
    "pubTitleIt", "pubTitleEn", "pubTitoliHookIt", "pubTitoliHookEn", "pubVideoHookIt", "pubVideoHookEn",
    "pubAudioStrategyIt", "pubAudioStrategyEn", "pubDescriptionIt", "pubDescriptionEn",
    "pubHashtagsIt", "pubHashtagsEn", "pubTagsIt", "pubTagsEn", "pubPinnedCommentIt", "pubPinnedCommentEn",
    "pubFileName", "pubRecommendedTime", "neuroScore", "neuroHookRate", "neuroRetention", "neuroViralPotential",
    "spreadabilityScore", "shareTrigger", "commentPressure", "relatability", "patternBreak",
    "dnaStatus", "dnaScore", "coverPrompt", "engineVerdict", "finalPromptVerdict",
    "altHook", "altScene", "altTwist", "humanVerdict", "operationalDecision", "readyAlternative",
    "isSaturated", "observedFacts", "executionDebugBlock", "validationTrace", "sourceAnchor",
    "eventQualitySelector", "viralAudit", "missingDataLog", "multiEvidenceValidation", "causalChainValidation",
    "scriptSourceMode", "scriptOptimizationStatus", "scriptFaithfulnessScore", "transcriptSource", "dialogueConfidence"
  ]
};

export const FINAL_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    viralScore: { type: Type.STRING },
    viralScoreReason: { type: Type.STRING },
    viralStructure: VIRAL_STRUCTURE_SCHEMA,
    viralValidation: VIRAL_VALIDATION_SCHEMA,
    ideaCore: { type: Type.STRING },
    retentionDrops: { type: Type.STRING },
    analysisHook: { type: Type.STRING },
    analysisRetention: { type: Type.STRING },
    analysisEscalation: { type: Type.STRING },
    analysisPayoff: { type: Type.STRING },
    analysisLoop: { type: Type.STRING },
    finalPromptVerdict: { type: Type.STRING },
    coverPrompt: { type: Type.STRING },
    validationQuestions: {
      type: Type.OBJECT,
      properties: {
        hasTwoNonScrollMoments: { type: Type.BOOLEAN },
        createsTensionUnder1_2s: { type: Type.BOOLEAN },
        loopWorksWithoutForcedCuts: { type: Type.BOOLEAN },
        dnaRespected: { type: Type.BOOLEAN }
      },
      required: ["hasTwoNonScrollMoments", "createsTensionUnder1_2s", "loopWorksWithoutForcedCuts", "dnaRespected"]
    },
    dnaStatus: { type: Type.STRING },
    dnaReasoning: { type: Type.STRING },
    dopamineMap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phase: { type: Type.STRING },
          event: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["phase", "event", "reason"]
      }
    },
    dopamineHits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["time", "description"]
      }
    },
    dopamineValidation: { type: Type.STRING },
    retentionProbability: { type: Type.STRING },
    predictedViews: { type: Type.STRING },
    neuroScore: { type: Type.STRING },
    neuroHookRate: { type: Type.STRING },
    neuroRetention: { type: Type.STRING },
    neuroViralPotential: { type: Type.STRING },
    spreadabilityScore: { type: Type.STRING },
    spreadabilityReasoning: { type: Type.STRING },
    shareTrigger: { type: Type.STRING },
    commentPressure: { type: Type.STRING },
    relatability: { type: Type.STRING },
    patternBreak: { type: Type.STRING },
    operationalDecision: { type: Type.STRING, enum: ["SCARTA", "MIGLIORA", "GENERA"] },
    readyAlternative: { type: Type.ARRAY, items: { type: Type.STRING } },
    isSaturated: { type: Type.BOOLEAN },
    observedFacts: {
      type: Type.OBJECT,
      properties: {
        observedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        interpretations: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["observedFacts", "interpretations"]
    }
  },
  required: ["viralScore", "viralScoreReason", "viralStructure", "viralValidation", "ideaCore", "retentionDrops", "analysisHook", "analysisRetention", "analysisEscalation", "analysisPayoff", "analysisLoop", "finalPromptVerdict", "validationQuestions", "dopamineHits", "dopamineValidation", "retentionProbability", "predictedViews", "neuroScore", "neuroHookRate", "neuroRetention", "neuroViralPotential", "spreadabilityScore", "spreadabilityReasoning", "shareTrigger", "commentPressure", "relatability", "patternBreak", "operationalDecision", "readyAlternative", "isSaturated", "observedFacts"]
};

export const DOMINANCE_VALIDATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    pass: { type: Type.BOOLEAN },
    reason: { type: Type.STRING },
    severity: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
    dominantElement: { type: Type.STRING },
    expectedPrimary: { type: Type.STRING },
    details: { type: Type.STRING }
  },
  required: ["pass", "reason", "severity", "dominantElement", "expectedPrimary", "details"]
};

export const QUERY_ALIGNMENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    isAligned: { type: Type.BOOLEAN },
    reasoning: { type: Type.STRING },
    missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["isAligned", "reasoning", "missingKeywords"]
};

export const COMPARABLE_VIDEOS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    videos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          views: { type: Type.STRING },
          relevance: { type: Type.STRING }
        },
        required: ["title", "views", "relevance"]
      }
    }
  },
  required: ["videos"]
};

export const COMPARISON_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    winner: { type: Type.STRING, enum: ["HOOK_A", "HOOK_B"] },
    confidence: { type: Type.NUMBER },
    reasoning: { type: Type.STRING },
    metrics: {
      type: Type.OBJECT,
      properties: {
        curiosityGap: { type: Type.NUMBER },
        patternInterrupt: { type: Type.NUMBER },
        clarity: { type: Type.NUMBER }
      },
      required: ["curiosityGap", "patternInterrupt", "clarity"]
    }
  },
  required: ["winner", "confidence", "reasoning", "metrics"]
};
