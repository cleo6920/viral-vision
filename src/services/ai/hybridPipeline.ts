import { hfChatCompletion, hfVisionAnalysis, hfAudioTranscription } from './huggingFaceClient';
import { performForensicTranscription } from '../gemini/analysis';
import { ResultData, AnalyticMode } from '../../types';
import { logger } from '../../utils/logger';

export interface HybridPipelineConfig {
  mode: AnalyticMode;
  hfApiKey: string;
  groqApiKey?: string;
}

export async function runHybridPipeline(
  task: 'AUDIO' | 'VISION' | 'FINAL_REASONING' | 'IDEA_GENERATION',
  payload: any,
  config: HybridPipelineConfig
): Promise<any> {
  const { mode, hfApiKey, groqApiKey } = config;

  logger.info(`[HYBRID_PIPELINE] task=${task} mode=${mode}`);

  if (mode === 'HUGGING') {
    // Everything Hugging Face
    switch (task) {
      case 'AUDIO':
        return hfAudioTranscription(payload.audio, hfApiKey);
      case 'VISION':
        return hfVisionAnalysis(payload.frames, payload.prompt, hfApiKey);
      case 'IDEA_GENERATION':
      case 'FINAL_REASONING':
        return hfChatCompletion(payload.messages, hfApiKey);
    }
  }

  if (mode === 'GROQ') {
    // Audio: Groq | Others: Hugging Face
    switch (task) {
      case 'AUDIO':
        // Reuse existing Groq transcription logic if possible, 
        // or call Groq directly
        return performForensicTranscription(payload.file, payload.frames, 'groq');
      case 'VISION':
        return hfVisionAnalysis(payload.frames, payload.prompt, hfApiKey);
      case 'IDEA_GENERATION':
      case 'FINAL_REASONING':
        return hfChatCompletion(payload.messages, hfApiKey);
    }
  }

  throw new Error(`Hybrid pipeline not configured for mode: ${mode}`);
}
