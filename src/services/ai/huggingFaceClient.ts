import { logger } from '../../utils/logger';

export interface HuggingFaceConfig {
  apiKey: string;
  visionModel?: string;
  audioModel?: string;
  finalModel?: string;
}

/**
 * Validates if a model is compatible with the /v1/chat/completions endpoint.
 */
function isChatCompatible(model: string): boolean {
    const incompatible = ['blip', 'whisper', 'stable-diffusion', 'vit-', 'vision-transformer'];
    const lower = model.toLowerCase();
    return !incompatible.some(inc => lower.includes(inc));
}

/**
 * Base function to call our local Express proxy for Hugging Face Router
 */
async function callHfProxy(payload: any): Promise<any> {
    const endpoint = "/api/huggingface/chat";
    const task = payload.messages?.some((m: any) => JSON.stringify(m).includes('image_url')) ? 'vision' : 'text';
    
    let modelToUse = payload.model;
    const isCompatible = isChatCompatible(modelToUse);
    
    logger.info("[HF_MODEL_VALIDATION]", { 
        task, 
        requestedModel: modelToUse, 
        isChatCompatible: isCompatible,
        promptLength: JSON.stringify(payload.messages).length
    });

    if (!isCompatible) {
        logger.info("[HF_MODEL_FALLBACK_APPLIED]", { 
            from: modelToUse, 
            to: 'zai-org/GLM-4.5V', 
            reason: 'not_chat_model' 
        });
        modelToUse = 'zai-org/GLM-4.5V';
        payload.model = modelToUse;
    }

    logger.info(`[HF_PROXY_REQUEST_START] task=${task} model=${modelToUse} via=backend_proxy endpoint=${endpoint}`);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            let parsed;
            try { parsed = JSON.parse(errText); } catch { parsed = { error: { message: errText } }; }
            
            let errorMsg = "Errore sconosciuto HF Proxy";
            if (typeof parsed.error === 'string') {
                errorMsg = parsed.error;
            } else if (parsed.error?.message) {
                errorMsg = parsed.error.message;
            } else if (parsed.details) {
                errorMsg = parsed.details;
            }

            if (errorMsg.includes("not a chat model") || errorMsg.includes("not supported by any provider")) {
                errorMsg = `Il modello selezionato (${payload.model}) non è compatibile o non è abilitato. Prova zai-org/GLM-4.5V.`;
            }

            const isDepleted = errorMsg.includes("depleted") || errorMsg.includes("Credits Depleted") || response.status === 402 || response.status === 429;

            if (isDepleted) {
                logger.info(`[HF_PROXY_FAIL_EXPECTED] status=${response.status} error=${errorMsg}`);
            } else {
                logger.error(`[HF_PROXY_FAIL] status=${response.status} error=${errorMsg}`);
            }
            const err = new Error(`Errore Hugging Face: ${errorMsg}`);
            (err as any).status = response.status;
            throw err;
        }

        const data = await response.json();
        logger.info(`[HF_PROXY_SUCCESS]`);
        return data;
    } catch (error: any) {
        const isDepleted = error.message?.includes("depleted") || error.message?.includes("Credits Depleted") || error.status === 402 || error.status === 429;
        const isNetworkError = error.message?.includes('fetch') || error.name === 'TypeError' || error.message?.includes('NetworkError');
        
        if (isDepleted) {
            logger.info(`[HF_PROXY_FAIL_EXPECTED] error=${error.message}`);
        } else if (isNetworkError) {
            logger.error(`[HF_PROXY_NETWORK_ERROR] error=${error.message} tip=Check if server.ts is running on port 3000`);
        } else {
            logger.error(`[HF_PROXY_FAIL] error=${error.message}`);
        }

        if (isNetworkError) {
            throw new Error("Errore Hugging Face: proxy/backend non raggiungibile o richiesta bloccata.");
        }
        throw error;
    }
}

export async function hfInference(
  model: string,
  payload: any,
  apiKey: string,
  taskType: 'text' | 'image-to-text' | 'audio-to-text' = 'text'
): Promise<any> {
  if (!apiKey) {
    throw new Error('Hugging Face API Key is missing.');
  }

  const endpoint = `https://api-inference.huggingface.co/models/${model}`;
  
  logger.info(`[HF_INFERENCE_START] model=${model} task=${taskType}`);

  try {
    const isBinary = payload instanceof Blob || payload instanceof Uint8Array || payload instanceof ArrayBuffer;
    
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(isBinary ? {} : { 'Content-Type': 'application/json' }),
      },
      method: 'POST',
      body: isBinary ? payload : JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[HF_INFERENCE_FAILED] model=${model} status=${response.status} error=${errorText}`);
      throw new Error(`Hugging Face API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    logger.info(`[HF_INFERENCE_SUCCESS] model=${model}`);
    return result;
  } catch (error: any) {
    logger.error(`[HF_INFERENCE_CRITICAL_ERROR] model=${model} error=${error.message}`);
    throw error;
  }
}

/**
 * Specifically for GLM-4.5V or similar Vision models on HF using OpenAI-compatible Router
 */
export async function hfVisionAnalysis(
  frames: string[], // base64 strings
  prompt: string,
  apiKey: string,
  model: string = 'zai-org/GLM-4.5V'
): Promise<string> {
  const subset = frames.slice(0, 5); 
  
  // Format content array with text and images
  const content: any[] = [{ type: "text", text: prompt }];
  
  subset.forEach(frame => {
    let dataUrl = frame;
    if (!frame.startsWith('data:')) {
      dataUrl = `data:image/jpeg;base64,${frame}`;
    }
    content.push({
      type: "image_url",
      image_url: { url: dataUrl }
    });
  });

  const payload = {
    model,
    apiKey, // Pass to proxy if wanted
    messages: [
      { role: "user", content }
    ],
    max_tokens: 1500
  };

  try {
    const result = await callHfProxy(payload);
    const text = result.choices?.[0]?.message?.content || result.generated_text || JSON.stringify(result);
    return text;
  } catch (e: any) {
    if (e.message.includes("depleted") || e.message.includes("Credits Depleted")) {
        logger.info(`[HF_VISION_FAILED_EXPECTED] ${e.message}`);
    } else {
        logger.error(`[HF_VISION_FAILED] ${e.message}`);
    }
    throw e;
  }
}

/**
 * Whisper transcription on Hugging Face via Backend Proxy
 */
export async function hfAudioTranscription(
  audioData: string | Blob,
  apiKey: string,
  model: string = 'openai/whisper-large-v3-turbo'
): Promise<any> {
  const endpoint = "/api/huggingface/audio";
  logger.info(`[HF_AUDIO_PROXY_REQUEST_START] endpoint=${endpoint} model=${model}`);

  let base64 = "";
  if (typeof audioData === 'string') {
    // Clean base64 prefix
    base64 = audioData.includes('base64,') ? audioData.split('base64,')[1] : audioData;
  } else {
    // Convert Blob to base64
    const buffer = await audioData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }

  logger.info("[HF_AUDIO_BASE64_READY]", {
    hasPrefix: false,
    audioSizeKB: Math.round(base64.length / 1024)
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        inputs: base64,
        apiKey
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        let parsed;
        try { parsed = JSON.parse(errText); } catch { parsed = { error: errText }; }
        const errorMsg = parsed.details || parsed.error || String(errText);
        throw new Error(errorMsg);
    }

    const data = await response.json();
    const text = data.text || data.transcription || "";
    logger.info("[HF_AUDIO_SUCCESS]", { transcriptLength: text.length });
    return data;
  } catch (error: any) {
    logger.error("[HF_AUDIO_FAIL]", { error: error.message });
    throw error;
  }
}

/**
 * Final reasoning using a text model on Hugging Face via Router
 */
export async function hfChatCompletion(
  messages: { role: string, content: string }[],
  apiKey: string,
  model: string = 'mistralai/Mistral-7B-Instruct-v0.2'
): Promise<string> {
  const payload = {
    model,
    apiKey,
    messages,
    max_tokens: 1500
  };

  try {
    const result = await callHfProxy(payload);
    const text = result.choices?.[0]?.message?.content || result.generated_text || JSON.stringify(result);
    return text;
  } catch (e: any) {
    logger.error(`[HF_FINAL_FAILED] ${e.message}`);
    throw e;
  }
}
