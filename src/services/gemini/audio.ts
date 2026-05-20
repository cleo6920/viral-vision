import { GoogleGenAI, Modality } from '@google/genai';
import { getAI, selectModel, executeWithNetworkRetry, cleanPerformanceMarkers } from './core';
import { logger } from '../../utils/logger';

export async function generateVoiceover(text: string, voiceName: string = 'Puck', apiKey?: string): Promise<string> {
  const { ai } = getAI(apiKey);
  const model = selectModel('gemini-1.5-flash', 'gemini-1.5-flash', apiKey);
  
  const cleanedText = cleanPerformanceMarkers(text);
  
  const payloadText = `Leggi ad alta voce il seguente testo, esattamente come scritto, senza aggiungere commenti, spiegazioni o analisi. Genera solo l'audio della lettura.

TESTO DA LEGGERE:
${cleanedText}`;

  try {
    const response = await executeWithNetworkRetry((currentAi, currentModel) => currentAi.models.generateContent({
      model: currentModel || model,
      contents: [{ parts: [{ text: payloadText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        }
      }
    }), 2, undefined, 300000, apiKey, undefined, model);
    
    logger.info("[Gemini] TTS Response received", { 
      hasCandidates: !!response.candidates,
      candidateCount: response.candidates?.length,
      firstCandidateParts: response.candidates?.[0]?.content?.parts?.length
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find(p => p.inlineData && p.inlineData.data);
    
    const base64Audio = audioPart?.inlineData?.data;
    const mimeType = audioPart?.inlineData?.mimeType || 'audio/wav';
    
    if (base64Audio) {
      // Check if it's already a WAV (starts with RIFF in base64)
      // "RIFF" in base64 starts with "UklGR"
      if (base64Audio.startsWith('UklGR') || mimeType.includes('wav')) {
        return base64Audio;
      }

      // If it's likely raw PCM (common for some Gemini TTS versions), wrap it in a WAV header
      // Defaulting to 24kHz mono 16-bit PCM which is standard for Gemini TTS
      try {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        const sampleRate = 24000;

        // RIFF identifier
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + bytes.length, true);
        view.setUint32(8, 0x57415645, false); // "WAVE"
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, bytes.length, true);

        const wavBuffer = new Uint8Array(44 + bytes.length);
        wavBuffer.set(new Uint8Array(wavHeader), 0);
        wavBuffer.set(bytes, 44);

        // Convert back to base64
        let binaryString = '';
        for (let i = 0; i < wavBuffer.length; i++) {
          binaryString += String.fromCharCode(wavBuffer[i]);
        }
        return btoa(binaryString);
      } catch (err) {
        console.error("[Gemini] Failed to wrap PCM in WAV:", err);
        return base64Audio; // Fallback to original
      }
    }
    
    const responseText = response.text || '';
    throw new Error(`No audio data returned from TTS model. ${responseText ? 'Model response: ' + responseText : ''}`);
  } catch (e) {
    console.error("[Gemini] TTS Error:", e);
    throw e;
  }
}
