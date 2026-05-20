import { getAI, executeWithNetworkRetry, maskApiKeySafe } from './core';

export interface LiteAnalysisResult {
  summary: string;
  chunkResults: string[];
  status: 'COMPLETED' | 'FAILED' | 'QUOTA_STOP';
  callsUsed: number;
  diagnosis: string;
}

export async function runVideoAnalysisLite(
  file: File,
  apiKey: string,
  onLog: (msg: string) => void
): Promise<LiteAnalysisResult> {
  onLog("[VIDEO_ANALYSIS_LITE_START]");
  
  const { ai, apiKey: resolvedKey } = getAI(apiKey);
  onLog(`[LITE_API_KEY_STATUS] present=${!!resolvedKey} masked=${resolvedKey ? maskApiKeySafe(resolvedKey) : 'none'}`);
  
  if (!resolvedKey) {
    onLog("[LITE_API_KEY_MISSING]");
    throw new Error("LITE ANALYSIS: API key non disponibile");
  }
  
  onLog("[LITE_GEMINI_CLIENT_CREATED]");

  const results: string[] = [];
  let callsUsed = 0;

  try {
    // 1. Frame Extraction
    onLog("[LITE_FRAME_EXTRACTION_START]");
    const frames = await extractFrames(file, 4, onLog); // Extract 4 frames total
    onLog("[LITE_FRAME_EXTRACTION_DONE]");

    // 2. Chunks (2 chunks of 2 frames each)
    for (let i = 0; i < 2; i++) {
      onLog(`[LITE_CHUNK_START] index=${i}`);
      callsUsed++;

      try {
        const chunkFrames = frames.slice(i * 2, (i + 1) * 2);
        onLog(`[LITE_GEMINI_CALL_PREPARED] chunkIndex=${i} frameCount=${chunkFrames.length}`);
        
        const model = 'gemini-1.5-flash';
        onLog(`[LITE_MODEL_SELECTED] ${model}`);

        const response = await executeWithNetworkRetry(
          (currentAi, dynamicModel) =>
            currentAi.models.generateContent({
              model: dynamicModel || model,
              contents: {
                parts: [
                  { text: "Analizza questi frame per potenziale virale e tensione narrativa. Rispondi in italiano, brevemente, strutturando in: Tipo scena, Soggetti, Ambiente, Azione, Tono, Chiarezza, Hook, Narrativa, Limiti." },
                  ...chunkFrames.map(data => ({ inlineData: { data: data.split(',')[1], mimeType: 'image/jpeg' } }))
                ]
              }
            }),
          3,
          undefined,
          300000,
          apiKey,
          undefined,
          model,
          undefined,
          `Lite Chunk ${i}`,
          'flash'
        );
        
        const responseText = response.text;
        results.push(responseText || "");
        onLog(`[LITE_CHUNK_SUCCESS] index=${i}`);
      } catch (e: any) {
        onLog(`[LITE_CHUNK_FAILED] index=${i} status=${e.status || 'unknown'} message=${e.message || 'Unknown'}`);
        if (e.message?.includes('429') || e.message?.includes('QUOTA') || e.message?.includes('503')) {
          onLog("[LITE_QUOTA_STOP]");
          return { summary: "Stopped due to quota", chunkResults: results, status: 'QUOTA_STOP', callsUsed, diagnosis: e.message };
        }
        throw e;
      }
    }

    // 3. Simple Local Merge and Format
    onLog("[LITE_LOCAL_MERGE_USED]");
    const rawSummary = results.map(r => r.replace(/^(Okay,|Here is|Ecco|Per analizzare).+?[:\s-]*/i, '')).join("\n\n");
    const summary = `VIDEO ANALYSIS LITE — COMPLETED

Frame analizzati: 4
Chiamate Gemini usate: ${callsUsed}
Modalità: Frame extraction browser-side + local merge

CONTENUTO RILEVATO
${rawSummary}

NOTA TECNICA
Analisi basata su frame estratti. Non sostituisce l'analisi completa audio/video.`;
    
    onLog("[VIDEO_ANALYSIS_LITE_RESULT]");
    
    return { summary, chunkResults: results, status: 'COMPLETED', callsUsed, diagnosis: 'SUCCESS' };
  } catch (err: any) {
    return { summary: "Failed", chunkResults: results, status: 'FAILED', callsUsed, diagnosis: err.message || 'Unknown error' };
  }
}

async function extractFrames(file: File, count: number, onLog: (msg: string) => void): Promise<string[]> {
  const videoUrl = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    
    video.onloadedmetadata = () => {
      onLog(`[LITE_VIDEO_METADATA_READY] duration=${video.duration}`);
      const frames: string[] = [];
      const canvas = document.createElement('canvas');
      // Low resolution for mobile performance
      canvas.width = 480; 
      canvas.height = 270;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      const interval = video.duration / (count + 1);
      let currentTime = interval;

      video.onseeked = () => {
        onLog(`[LITE_FRAME_CAPTURE_START] index=${frames.length}`);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.6));
        onLog(`[LITE_FRAME_CAPTURE_DONE] index=${frames.length - 1}`);
        
        if (frames.length < count) {
          currentTime += interval;
          video.currentTime = currentTime;
        } else {
          URL.revokeObjectURL(videoUrl);
          resolve(frames);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        resolve(frames);
      };

      video.currentTime = currentTime;
    };
  });
}
