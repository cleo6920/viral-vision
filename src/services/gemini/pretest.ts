
import { getAI, selectModel, executeWithNetworkRetry, safeParseJSON } from './core';
import { SemanticNature, CNGContentType } from '../../types/cng';
import { ModelUsageTrace } from '../../types';
import { logger } from '../../utils/logger';

export interface PretestSemanticResult {
  nature: SemanticNature;
  contentType: CNGContentType;
}

export async function checkContentNatureSemantics(
  frames: any[], 
  apiKey?: string, 
  onProgress?: (text: string) => void,
  trace?: ModelUsageTrace
): Promise<PretestSemanticResult> {
  const { ai } = getAI(apiKey);
  const model = selectModel('gemini-1.5-flash', 'gemini-1.5-flash', apiKey);
  const modelTier = 'flash';
  
  const prompt = `
    Analizza i frame forniti. Determina la natura strutturale e la classificazione del contenuto.
    
    Regole per "nature":
    - SEMANTIC_STILL: Una foto congelata, un asset grafico immobile o una diapositiva (anche se con rumore/grana).
    - ACTIVE_VIDEO: Una scena con movimento reale, performance umana, parlato o azione meccanica.

    Regole per "contentType":
    - VIDEO_PERFORMANCE: Video reale di persone, scene o gameplay.
    - GENERIC_STILL: Una foto statica generica (panorama, selfie immobile, quadro).
    - INFORMATIONAL_POSTER: Locandine, flyer, infografiche strutturate con intenti informativi, solitamente con molto testo.
    - UI_SCREENSHOT: Screenshot di interfacce, chat, tweet, meme quasi interamente testuali.

    Rispondi esclusivamente in JSON usando questa precisa struttura:
    {"nature": "SEMANTIC_STILL" | "ACTIVE_VIDEO", "contentType": "VIDEO_PERFORMANCE" | "GENERIC_STILL" | "INFORMATIONAL_POSTER" | "UI_SCREENSHOT"}
  `;

  try {
    if (onProgress) onProgress("CNG: Avvio pretest semantico...");

    const response = await executeWithNetworkRetry(
      async (currentAi, dynamicModel) => {
        return await currentAi.models.generateContent({
          model: dynamicModel || model,
          contents: [{ role: 'user', parts: [...frames, { text: prompt }] }],
          config: {
            temperature: 0,
            responseMimeType: "application/json"
          }
        });
      }, 
      1, // Reduced retries for non-critical pretest
      undefined, // fallbackOp
      180000, // Increased timeout (180s) for slow connections
      apiKey, // providedApiKey
      onProgress, // onProgress callback
      model,
      trace,
      "Semantic Pretest",
      "flash",
      false,
      'BANAL'
    );

    if (!response) {
      throw new Error("No response from Gemini during pretest");
    }

    const text = response.text || '{}';
    const parsed = safeParseJSON(text);
    
    const nature: SemanticNature = parsed.nature === 'SEMANTIC_STILL' ? 'SEMANTIC_STILL' : 'ACTIVE_VIDEO';
    const contentType: CNGContentType = ['VIDEO_PERFORMANCE', 'GENERIC_STILL', 'INFORMATIONAL_POSTER', 'UI_SCREENSHOT'].includes(parsed.contentType) 
      ? parsed.contentType 
      : 'VIDEO_PERFORMANCE';

    logger.info(`[CNG-Semantic] Result: ${nature}, ContentType: ${contentType}`);
    return { nature, contentType };
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED')) {
      logger.error("[CNG-Semantic] Hard fail due to Auth/Quota. Bubbling up.", err);
      throw err; // MUST bubble up auth/quota errors so the core app stops immediately
    }
    logger.error("[CNG-Semantic] Non-critical fail, defaulting to ACTIVE_VIDEO to avoid false blocks", { error: errorMsg });
    return { nature: 'ACTIVE_VIDEO', contentType: 'VIDEO_PERFORMANCE' };
  }
}
