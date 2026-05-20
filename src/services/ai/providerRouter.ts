import { logger } from '@/src/utils/logger';

export type AIProvider = 'GEMINI' | 'GROQ' | 'LOCAL' | 'YOUTUBE' | 'HUGGINGFACE';

export type AIProviderTaskType =
  | 'AUDIO_TRANSCRIPTION'
  | 'SCENE_DNA'
  | 'PROMPT_STRATEGY'
  | 'MARKET_TEXT'
  | 'MARKET_VALIDATION'
  | 'PROMPT_TEXT'
  | 'PROMPT_JUDGE'
  | 'SCENE_MASTER'
  | 'EDITORIAL_TEXT'
  | 'COVER_TEXT'
  | 'JSON_CLEANUP'
  | 'CHAT_ASSISTANT'
  | 'IDEA_ANALYSIS'
  | 'SCRIPT_ANALYSIS'
  | 'MULTIMODAL_SUMMARY'
  | 'MULTIMODAL_VALIDATION'
  | 'VIDEO_GROUNDING'
  | 'IMAGE_GROUNDING'
  | 'CNG_VISUAL'
  | 'FILE_UPLOAD'
  | 'BLUE_OCEAN'
  | 'FINAL_JUDGE'
  | 'PROMPT_GENERATION'
  | 'REPAIR_TEXT'
  | 'CORE_ANALYSIS'
  | 'EYE_EAR_MULTIMODAL'
  | 'TEST_LIGHT';

export interface ProviderPolicy {
  taskType: AIProviderTaskType;
  preferredProvider: AIProvider;
  fallbackProviders: AIProvider[];
  allowStableGeminiKey: boolean;
  critical: boolean;
  timeoutMs?: number;
  maxRetries?: number;
}

export function isGroqMode(mode?: string): boolean {
  return (mode || '').trim().toLowerCase() === 'groq';
}

export function isHuggingMode(mode?: string): boolean {
  return (mode || '').trim().toLowerCase() === 'hugging';
}

const TEXTUAL_TASKS = new Set<AIProviderTaskType>([
  'MARKET_TEXT',
  'MARKET_VALIDATION',
  'SCENE_DNA',
  'PROMPT_STRATEGY',
  'PROMPT_TEXT',
  'PROMPT_JUDGE',
  'SCENE_MASTER',
  'EDITORIAL_TEXT',
  'COVER_TEXT',
  'JSON_CLEANUP',
  'CHAT_ASSISTANT',
  'IDEA_ANALYSIS',
  'SCRIPT_ANALYSIS',
  'BLUE_OCEAN',
  'FINAL_JUDGE',
  'PROMPT_GENERATION',
  'REPAIR_TEXT',
  'CORE_ANALYSIS'
]);

export function hasGroqApiKey(): boolean {
  const hasBrowserStoredKey = (() => {
    try {
      return !!globalThis.localStorage?.getItem('groq_api_key');
    } catch {
      return false;
    }
  })();

  const hasGlobalKey = (() => {
    try {
      return !!(globalThis as any).GROQ_API_KEY || !!(globalThis as any).__GROQ_API_KEY__;
    } catch {
      return false;
    }
  })();

  try {
    return (
      !!process.env.GROQ_API_KEY ||
      !!process.env.GROQ_API_KEY_1 ||
      !!process.env.GROQ_API_KEY_2 ||
      !!process.env.GROQ_API_KEY_3 ||
      !!(import.meta as any).env?.VITE_GROQ_API_KEY ||
      !!(import.meta as any).env?.VITE_GROQ_API_KEY_1 ||
      !!(import.meta as any).env?.VITE_GROQ_API_KEY_2 ||
      !!(import.meta as any).env?.VITE_GROQ_API_KEY_3 ||
      hasBrowserStoredKey ||
      hasGlobalKey
    );
  } catch {
    return (
      !!(import.meta as any).env?.VITE_GROQ_API_KEY ||
      !!(import.meta as any).env?.VITE_GROQ_API_KEY_1 ||
      !!(import.meta as any).env?.VITE_GROQ_API_KEY_2 ||
      !!(import.meta as any).env?.VITE_GROQ_API_KEY_3 ||
      hasBrowserStoredKey ||
      hasGlobalKey
    );
  }
}

export function resolveGroqTextModel(): string {
  try {
    return process.env.GROQ_TEXT_MODEL || (import.meta as any).env?.VITE_GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile';
  } catch {
    return (import.meta as any).env?.VITE_GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile';
  }
}

export function hasHuggingFaceApiKey(): boolean {
  try {
    return !!globalThis.localStorage?.getItem('huggingface_api_key') || !!process.env.HUGGINGFACE_API_KEY || !!(import.meta as any).env?.VITE_HUGGINGFACE_API_KEY;
  } catch {
    return false;
  }
}

export function resolveHuggingFaceModel(type: 'vision' | 'audio' | 'text'): string {
  try {
    if (type === 'vision') return process.env.VITE_HF_VISION_MODEL || (import.meta as any).env?.VITE_HF_VISION_MODEL || 'zai-org/GLM-4.5V';
    if (type === 'audio') return process.env.VITE_HF_AUDIO_MODEL || (import.meta as any).env?.VITE_HF_AUDIO_MODEL || 'openai/whisper-large-v3-turbo';
    return process.env.VITE_HF_TEXT_MODEL || (import.meta as any).env?.VITE_HF_TEXT_MODEL || 'zai-org/GLM-4.5V';
  } catch {
    if (type === 'vision') return 'zai-org/GLM-4.5V';
    if (type === 'audio') return 'openai/whisper-large-v3-turbo';
    return 'zai-org/GLM-4.5V';
  }
}

export function isTextualTask(taskType: AIProviderTaskType): boolean {
  return TEXTUAL_TASKS.has(taskType);
}

export function resolveProviderPolicy(taskType: AIProviderTaskType): ProviderPolicy {
  const groqAvailable = hasGroqApiKey();

  if (taskType === 'AUDIO_TRANSCRIPTION') {
    return {
      taskType,
      preferredProvider: groqAvailable ? 'GROQ' : 'GEMINI',
      fallbackProviders: groqAvailable ? ['GEMINI', 'LOCAL'] : ['LOCAL'],
      allowStableGeminiKey: true,
      critical: false,
      timeoutMs: 210000,
      maxRetries: 1,
    };
  }

  if (isTextualTask(taskType)) {
    return {
      taskType,
      preferredProvider: groqAvailable ? 'GROQ' : 'GEMINI',
      fallbackProviders: groqAvailable ? ['GEMINI', 'LOCAL'] : ['LOCAL'],
      allowStableGeminiKey: true,
      critical: false,
      timeoutMs: 180000,
      maxRetries: 1,
    };
  }

  if (taskType === 'VIDEO_GROUNDING' || taskType === 'IMAGE_GROUNDING' || taskType === 'CNG_VISUAL' || taskType === 'FILE_UPLOAD' || taskType === 'MULTIMODAL_SUMMARY' || taskType === 'MULTIMODAL_VALIDATION') {
    return {
      taskType,
      preferredProvider: groqAvailable ? 'HUGGINGFACE' : 'GEMINI',
      fallbackProviders: groqAvailable ? ['GEMINI', 'LOCAL'] : ['LOCAL'],
      allowStableGeminiKey: true,
      critical: true,
      timeoutMs: 300000,
      maxRetries: 1,
    };
  }

  return {
    taskType,
    preferredProvider: 'GEMINI',
    fallbackProviders: ['LOCAL'],
    allowStableGeminiKey: true,
    critical: true,
    timeoutMs: 300000,
    maxRetries: 1,
  };
}

export function logKeyPolicyDecision(taskType: AIProviderTaskType, stableKeyAvailable: boolean, policy?: ProviderPolicy) {
  const resolved = policy || resolveProviderPolicy(taskType);
  const currentModelTier = typeof localStorage !== 'undefined' ? localStorage.getItem('analysis_model_tier') : null;
  const isGroqDiagnostic = currentModelTier === 'groq';
  const prefix = isGroqDiagnostic ? '[GEMINI_DIAGNOSTIC_ONLY] ' : '';
  
  logger.info(
    `${prefix}[KEY_POLICY_DECISION] taskType=${taskType} preferredProvider=${resolved.preferredProvider} allowStableGeminiKey=${resolved.allowStableGeminiKey} critical=${resolved.critical} stableKeyAvailable=${stableKeyAvailable}`
  );
  return resolved;
}
