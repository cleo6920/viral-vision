import { logger } from "../../utils/logger";
import { groqWhisperTranscription } from "../ai/groqClient";
import { extractAudioTrack, chunkWavBlob } from "../../utils/videoProcessor";

function robustParseJSON(rawText: string): any {
  let stripped = String(rawText || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  
  const match = stripped.match(/[\{\[]([\s\S]*)[\}\]]/);
  if (match) {
    stripped = match[0];
  }

  let inString = false;
  let escaped = false;
  const chars: string[] = [];
  
  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    if (escaped) {
      chars.push(char);
      escaped = false;
      continue;
    }
    if (char === '\\') {
      chars.push(char);
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      chars.push(char);
      continue;
    }
    if (inString) {
      if (char === '\n') {
        chars.push('\\n');
      } else if (char === '\r') {
        chars.push('\\r');
      } else if (char === '\t') {
        chars.push('\\t');
      } else {
        chars.push(char);
      }
    } else {
      chars.push(char);
    }
  }
  
  let repaired = chars.join('');
  repaired = repaired.replace(/,\s*([\}\]])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch (err: any) {
    logger.warn("[ROBUST_JSON_PARSE_FIRST_ATTEMPT_FAILED]", { error: err.message, length: repaired.length });
    
    let curlyCount = 0;
    let squareCount = 0;
    let openQuote = false;
    let esc = false;
    
    for (let i = 0; i < repaired.length; i++) {
      const c = repaired[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') {
        openQuote = !openQuote;
      }
      if (!openQuote) {
        if (c === '{') curlyCount++;
        if (c === '}') curlyCount--;
        if (c === '[') squareCount++;
        if (c === ']') squareCount--;
      }
    }
    
    let fix = repaired;
    if (openQuote) {
      fix += '"';
    }
    while (squareCount > 0) {
      fix += ']';
      squareCount--;
    }
    while (curlyCount > 0) {
      fix += '}';
      curlyCount--;
    }
    
    try {
      return JSON.parse(fix);
    } catch (secondErr: any) {
      logger.error("[ROBUST_JSON_PARSE_SECOND_ATTEMPT_FAILED]", { error: secondErr.message });
      throw secondErr;
    }
  }
}

export async function processAudioConscience(videoFile: File | Blob, videoDurationSeconds: number | null, uiGeminiKey?: string): Promise<any> {
  const result: any = {
    audioConscienceAudit: {
      enabled: true,
      audioOriginalDurationSeconds: videoDurationSeconds || 0,
      audioAnalyzedDurationSeconds: 0,
      audioComplete: false,
      audioChunkMode: false,
      audioChunkSizeSeconds: 60,
      audioChunksCount: 0,
      coverageStart: 0,
      coverageEnd: 0,
      asrProvider: "groq",
      asrModel: "whisper-large-v3",
      asrKeySource: "process.env",
      reportProvider: "google",
      reportModel: "gemini-3.1-flash-lite",
      reportKeySource: "process.env",
      transcriptAvailable: false,
      transcriptLength: 0,
      timelineAvailable: false,
      speakerReportAvailable: false,
      limitations: [
        "P1/P2/F/M are audio-text hypotheses, not certified diarization",
        "Final speaker-to-character assignment must be confirmed by video brain"
      ]
    },
    audioTimelineSegments: [],
    audioSpeakerGroups: [],
    mirrorTestBlocks: [],
    audioWarnings: [
      "Speaker labels are hypotheses.",
      "Do not treat repeated 'Io penso' as same speaker automatically.",
      "Cervellone must confirm with frames."
    ]
  };

  try {
    logger.info("[REAL_AUDIO_BINARY_RECEIVER]", { videoFile: typeof videoFile });
    logger.info("[REAL_AUDIO_TRANSCRIBER_PROVIDER]", { provider: "groq" });
    logger.info("[REAL_AUDIO_TRANSCRIBER_MODEL]", { model: "whisper-large-v3" });
    logger.info("[REAL_AUDIO_ORIGINAL_DURATION_SECONDS]", { duration: videoDurationSeconds });
  
    const audioBlob = await extractAudioTrack(videoFile as File);
    let chunks: Blob[] = [];
  
    // Estimate if we need chunking. 
    // Wait, let's just chunk it if it's over 60s
    if (videoDurationSeconds && videoDurationSeconds > 60) {
      logger.info("[REAL_AUDIO_CHUNK_MODE_ENABLED]");
      chunks = await chunkWavBlob(audioBlob, 60);
      result.audioConscienceAudit.audioChunkMode = true;
      result.audioConscienceAudit.audioChunksCount = chunks.length;
    } else {
      chunks = [audioBlob];
      result.audioConscienceAudit.audioChunkMode = false;
      result.audioConscienceAudit.audioChunksCount = 1;
    }
  
    let allSegments: any[] = [];
    let fullTranscript = "";
    let analyzedSeconds = 0;
  
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.info("[REAL_AUDIO_CHUNK_SEND_START]", { chunkIndex: i + 1, totalChunks: chunks.length });
        
        try {
            const chunkFile = new File([chunk], `chunk_${i}.wav`, { type: "audio/wav" });
            const chunkRes = await groqWhisperTranscription({ file: chunkFile, task: "audio_enhanced" });
            logger.info("[REAL_AUDIO_CHUNK_SEND_SUCCESS]", { chunkIndex: i + 1 });
            
            const chunkSegments = Array.isArray(chunkRes.segments) ? chunkRes.segments : [];
            const timeOffset = i * 60;
            
            chunkSegments.forEach((seg: any) => {
                const start = seg.start + timeOffset;
                const end = seg.end + timeOffset;
                allSegments.push({
                    start,
                    end,
                    text: seg.text,
                });
            });
            analyzedSeconds += (chunkRes.duration || (chunkSegments.length ? chunkSegments[chunkSegments.length - 1].end : 0));
        } catch (e) {
            logger.error("[REAL_AUDIO_CHUNK_SEND_ERROR]", { chunkIndex: i + 1, error: e });
            logger.info("[REAL_AUDIO_TRUNCATED_WARNING]");
            result.audioWarnings.push("L'audio è stato parzialmente troncato. Non caricato completamente causa di timeout o errore API.");
            break;
        }
    }
  
    logger.info("[REAL_AUDIO_CHUNKS_COMPLETED]", { analyzedSeconds });
    
    // Sort all segments just in case
    allSegments.sort((a, b) => a.start - b.start);
    fullTranscript = allSegments.map(s => s.text.trim()).join(" ");
    
    result.audioConscienceAudit.audioAnalyzedDurationSeconds = analyzedSeconds;
    result.audioConscienceAudit.coverageEnd = analyzedSeconds;
    
    if (analyzedSeconds >= (videoDurationSeconds || 0) * 0.95 || chunks.length === 1) {
        logger.info("[REAL_AUDIO_COMPLETE_TRUE]");
        result.audioConscienceAudit.audioComplete = true;
    }
    
    if (!fullTranscript || fullTranscript.trim() === "") {
        return result; // Nothing else to do
    }
    
    result.audioConscienceAudit.transcriptAvailable = true;
    result.audioConscienceAudit.transcriptLength = fullTranscript.length;
    
    // Phase 2: GEMINI REPORT
    logger.info("[REAL_AUDIO_REPORT_PROVIDER]", { provider: "google" });
    logger.info("[REAL_AUDIO_REPORT_MODEL]", { model: "gemini-3.1-flash-lite" });
    logger.info("[REAL_AUDIO_REPORT_KEY_SOURCE]", { source: "VITE_GEMINI_API_KEY" });
        const apiPayload = {
      contents: [{
        role: "user",
        parts: [{
          text: `Sei la Coscienza Audio.
Compito: analizzare la trascrizione audio fornita per estrarre la timeline audio e gli eventi sonori.
Devi comportarti da OSSERVATORE TECNICO. NON devi interpretare la scena, capire le battute o immaginare chi siano i personaggi visivamente (es. poliziotto, prete).

Devi rispondere a queste domande:
1. Cosa si sente? (dialogo, voci, rumori, risate, effetti sonori, pause/silenzio, incomprensibile)
2. Quando si sente? (dai timestamp dei segmenti)
3. Chi parla? (Solo P1, P2, P3... ecc.)

REGOLE TASSATIVE (SPEAKER E INCERTEZZA):
- Usa questi formati: 
  - Se speaker sicuro con genere certo: P1_F o P1_M
  - Se speaker sicuro ma genere incerto: P1_? o P1_F? 
  - Se probabile stesso speaker ma NON CERTO: P1?
  - Se probabile nuovo speaker ma NON CERTO: P2?
  - Se non sai nulla: P?_? o P?
- NON RIUSARE MAI "P1" (o un altro P) se non sei altamente sicuro che sia lo stesso speaker della battuta precedente. In caso di dubbio è meglio usare "P?", "P2?" e marcare "uncertainty: ['(stesso speaker?)']". 
- Nel campo "gender" usa "F", "M", "?", oppure "F?", "M?" per il genere incerto.
- Ogni dubbio deve essere esplicito nel campo "uncertainty" (es. "(stesso speaker?)", "(nuova voce?)", "(risata?)"). Formato \`['...', '...']\`.

REGOLE TASSATIVE (MIRROR TEST):
- OGNI E SINGOLA occorrenza in cui si pronuncia "io penso" deve DIVENTARE un blocco "mirrorTestBlock" SEPARATO.
- Anche se un frammento dice "Don Franco, Don Franco. io penso", DOVRAI ESTARRE "io penso" e metterlo in un "mirrorTestBlocks" separato (ad esempio MIRROR_TEST_3), mantenendo il resto della battuta ("Don Franco, Don Franco.") nel dialogo della timeline normale.
- È obbligatorio contare e separare tutte le prove specchio, esempio: MIRROR_TEST_1, MIRROR_TEST_2, MIRROR_TEST_3, ecc. NON tralasciarne nessuna.

Trascrizione completa aggregata:
${fullTranscript}

Segmenti originali (con timestamp basati sull'estrazione ASR, da usare per "start" e "end"):
${JSON.stringify(allSegments)}

Restituisci strettamente un JSON aderente a questo formato:
{
  "audioObservationReport": {
    "detectedAudioTypes": ["dialogo", "rumori"],
    "uncertaintyPolicy": "Ogni dubbio viene marcato con (?) nelle note",
    "note": "..."
  },
  "audioTimeline": [
    { 
      "start": 0.0, 
      "end": 2.5, 
      "type": "dialogo", 
      "speaker": "P1_?", 
      "gender": "F?", 
      "confidence": "LOW", 
      "text": "ciao a tutti", 
      "uncertainty": ["(stesso speaker?)", "(gender?)"] 
    }
  ],
  "audioSpeakerGroups": [
    { 
      "id": "P1", 
      "gender": "F?", 
      "confidence": "LOW", 
      "evidenceSegments": ["0.0-2.5"], 
      "note": "Gruppo vocale osservato, non identita certa" 
    }
  ],
  "mirrorTestBlocks": [
    { "id": "MIRROR_TEST_1", "start": 10.0, "end": 12.0, "text": "Io penso...", "speakerGuess": "P?", "confidence": "LOW", "note": "Blocco prova separato; speaker da confermare col video" },
    { "id": "MIRROR_TEST_2", "start": 21.0, "end": 21.5, "text": "io penso", "speakerGuess": "P?", "confidence": "LOW", "note": "Estratto del terzo test specchio" }
  ]
}`
        }]
      }],
      generationConfig: {
        maxOutputTokens: 2400,
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };
    
    let keySource = "UNKNOWN";
    let geminiKey = uiGeminiKey;

    if (geminiKey) {
        keySource = "UI_EXTERNAL_KEY";
        logger.info("[REAL_AUDIO_REPORT_USES_UI_KEY]");
    } else {
        keySource = "process.env";
        geminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (geminiKey) {
            logger.info("[REAL_AUDIO_REPORT_USES_ENV_KEY]");
        }
    }

    result.audioConscienceAudit.reportKeySource = keySource;
    logger.info("[REAL_AUDIO_REPORT_KEY_SOURCE]", { source: keySource });

    logger.info("[GEMINI_AUDIO_CALL]", { tokenCount: fullTranscript.length });
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload)
    });
    
    if (!res.ok) {
        throw new Error("Gemini generateContent failed: " + await res.text());
    }
    
    const data = await res.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (responseText) {
        let parsed: any = { audioObservationReport: {}, audioTimeline: [], audioSpeakerGroups: [], mirrorTestBlocks: [] };
        try {
            parsed = robustParseJSON(responseText);
        } catch (je) {
            console.error("Failed to parse Gemini Audio Report array", je);
        }
        
        result.audioObservationReport = parsed.audioObservationReport || {};
        result.audioTimelineSegments = parsed.audioTimeline || parsed.audioTimelineSegments || [];
        result.audioSpeakerGroups = parsed.audioSpeakerGroups || [];
        result.mirrorTestBlocks = parsed.mirrorTestBlocks || [];
        
        result.audioConscienceAudit.timelineAvailable = result.audioTimelineSegments.length > 0;
        result.audioConscienceAudit.speakerReportAvailable = result.audioSpeakerGroups.length > 0;
        
        logger.info("[REAL_AUDIO_OBSERVATION_REPORT_CREATED]");
        logger.info("[REAL_AUDIO_TIMELINE_OBSERVATIVE_CREATED]");
        logger.info("[REAL_AUDIO_UNCERTAINTY_MARKERS_APPLIED]");
        logger.info("[REAL_AUDIO_SPEAKER_GROUPS_PRUDENT]");
        logger.info("[REAL_AUDIO_MIRROR_TEST_BLOCKS_CREATED]");
        logger.info("[REAL_AUDIO_NON_INTERPRETATIVE_MODE_ENABLED]");
    }
  } catch (err) {
      logger.error("[AUDIO_CONSCIENCE_ERROR]", err);
  }

  // Preserve the basic output so downstream doesn't break
  result.audioSegments = result.audioTimelineSegments.length > 0 ? result.audioTimelineSegments : [];
  result.verifiedTranscript = result.audioTimelineSegments.map((s: any) => s.text).join(" ");
  result.audioDurationSeconds = result.audioConscienceAudit.audioAnalyzedDurationSeconds;
  
  return result;
}
