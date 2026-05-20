import { getAI, selectModel, executeWithNetworkRetry, resetQuotaStatus } from './core';
import { UNIFIED_FRAMEWORK_RULES } from './constants';
import { logger } from '../../utils/logger';
import { getGroqConfig, groqTextCompletion } from '../ai/groqClient';
import { hasGroqApiKey, isGroqMode } from '../ai/providerRouter';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: any[];
  modelUsed?: string;
}

const hasVisualAttachmentsInHistory = (history: any[] = []): boolean => {
  return history.some((entry) =>
    Array.isArray(entry?.parts) &&
    entry.parts.some((part: any) => {
      const mimeType = String(part?.inlineData?.mimeType || '');
      return mimeType.startsWith('image/') || mimeType.startsWith('video/');
    })
  );
};

const runGroqAssistant = async (message: string | ChatMessage[], history: any[] = []): Promise<string> => {
  const msg = typeof message === 'string'
    ? message
    : message.map((entry) => `${entry.role}: ${entry.content}`).join('\n');

  const transcript = history
    .map((entry) => {
      const text = Array.isArray(entry?.parts)
        ? entry.parts
            .map((part: any) => typeof part?.text === 'string' ? part.text : '')
            .filter(Boolean)
            .join('\n')
        : '';
      const role = entry?.role === 'model' ? 'assistant' : 'user';
      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean)
    .slice(-8)
    .join('\n');

  const response = await groqTextCompletion({
    task: 'chat_assistant',
    messages: [
      { role: 'system', content: `You are a Viral Content Assistant. ${UNIFIED_FRAMEWORK_RULES}` },
      { role: 'user', content: [transcript, msg || 'Analyze this.'].filter(Boolean).join('\n\n') },
    ],
    timeoutMs: 120000,
  });
  return response.text || '';
};

export async function chatWithAssistant(message: string | ChatMessage[], history: any[] = [], apiKey?: string, modelTier: string = 'pro'): Promise<string> {
  const groqRuntime = getGroqConfig();
  const groqAvailable = hasGroqApiKey() && groqRuntime.hasHealthyKeys && !groqRuntime.allKeysInCooldown;
  const hasVisualAttachments = hasVisualAttachmentsInHistory(history);

  if (isGroqMode(modelTier) || (groqAvailable && !hasVisualAttachments)) {
    return await runGroqAssistant(message, history);
  }
  const executeChat = async (currentModelTier: string) => {
    const { ai } = getAI(apiKey, false, 'MODERATE', 'CHAT_ASSISTANT');
    const model = selectModel(currentModelTier === 'pro' ? 'pro' : 'flash', 'flash', apiKey);
    
    const prevHistory = history.slice(0, -1);
    const currentMsg = history[history.length - 1];
    
    const chat = ai.chats.create({ 
      model, 
      history: prevHistory,
      config: { systemInstruction: `You are a Viral Content Assistant. ${UNIFIED_FRAMEWORK_RULES}` } 
    });
    
    const msg = currentMsg?.parts || (typeof message === 'string' ? message : "Analyze this.");
    const response = await executeWithNetworkRetry(async (currentAi, dynamicModel) => {
      // If we swap AI, we should ideally recreate the chat session with the same history.
      // But for simple cases, just retry the message.
      return chat.sendMessage({ message: msg as any });
    }, 2, undefined, 180000, apiKey, undefined, model, undefined, "Chat Assistant", currentModelTier, currentModelTier === 'pro', "MODERATE", undefined, "Conversational assistance", "text_input", false, false, "CHAT_ASSISTANT");
    return response.text || '';
  };

  try {
    return await executeChat(modelTier);
  } catch (err: any) {
    if (err?.message === 'GEMINI_TEXT_FALLBACK_BLOCKED_GROQ_AVAILABLE' && groqAvailable) {
      logger.info('[CHAT_ASSISTANT_ROUTED_TO_GROQ]');
      return await runGroqAssistant(message, history);
    }
    const errorMessage = err.message || String(err);
    const isQuotaError = errorMessage.toLowerCase().includes('quota') || 
                         errorMessage.includes('429') || 
                         errorMessage.toLowerCase().includes('resource_exhausted') ||
                         errorMessage.toLowerCase().includes('rate limit');
    if (isQuotaError && modelTier === 'pro') {
      logger.warn("[Gemini] Quota exceeded for PRO model in chatWithAssistant. Auto-switching to FLASH mode.");
      resetQuotaStatus();
      if (groqAvailable && !hasVisualAttachments) {
        return await runGroqAssistant(message, history);
      }
      return await executeChat('flash');
    }
    throw err;
  }
}
