import { useCallback } from 'react';
import { useProductionState } from './useProductionState';
import { useSettings } from './useSettings';
import { useFormState } from './useFormState';
import { 
  generateVideoPrompt, 
  refinePromptWithGoal, 
  refineCoverPromptWithGoal, 
  optimizeForSora2, 
  rewriteDangerousPrompt, 
  detectDangerousWordsWithAI,
  generateCover,
  getTrendingTopics,
  compareHooks,
  generateVoiceover,
  getBypassedWord,
  getAI,
  preflightCheckGeminiQuota
} from '../services/gemini';

export function useGeminiActions(
  state: ReturnType<typeof useProductionState>,
  settings: ReturnType<typeof useSettings>,
  formState: ReturnType<typeof useFormState>
) {
  const {
    setIsLoading, setIsTakingLong, setResult,
    setIsAnalyzingPrompt, setIsAnalyzingPrompt1, setIsAnalyzingPrompt2,
    setPromptAnalysis, setPrompt1Analysis, setPrompt2Analysis,
    resetPrompts, resetSora12s, resetKling, resetVeo,
    resetPrompts1, resetSora12s1, resetKling1, resetVeo1,
    resetPrompts2, resetSora12s2, resetKling2, resetVeo2,
    setError, setIsGeneratingCover, setCoverImage,
    setIsRewriting, setIsRewriting1, setIsRewriting2,
    setDangerousWords, setIsOptimizingSora2, setIsOptimizingSora2_1, setIsOptimizingSora2_2,
    editableScript, setBypassingWord, setIsGeneratingVoiceover, setVoiceoverAudio, setVoiceoverError,
    coverReferenceImage, coverAspectRatio, coverHookText
  } = state;

  const { apiKey } = getAI();

  const {
    useBypass, niche, genre, platform, algoCuriosity, isDeepAnalysis, spinOffMode, viralBoost50k,
    musicalType, preferredSinger,
    setSoraDuration, setSoraDuration1, setSoraDuration2
  } = settings;

  const {
    description, analysisMode, pensaciTuGenre, wizardAnswers, trendNiche, hookA, hookB,
    estimateInputType, originalPrompt, file, pensaciTuGoal, savedVideoData
  } = formState;

  const handleAnalyzePrompt = useCallback(async (promptText: string, type: 'estimate' | 'anti-ai-slop', target: 'prompt' | 'prompt1' | 'prompt2') => {
    if (!promptText) return;
    
    if (target === 'prompt') setIsAnalyzingPrompt(true);
    else if (target === 'prompt1') setIsAnalyzingPrompt1(true);
    else if (target === 'prompt2') setIsAnalyzingPrompt2(true);
    
    try {
      const res = await generateVideoPrompt(
        undefined, undefined, promptText, useBypass, niche, genre, platform, [],
        algoCuriosity, null, isDeepAnalysis, false, spinOffMode,
        viralBoost50k, type, 'pro', false, apiKey, musicalType, preferredSinger
      );
      
      if (!res || !res.text) throw new Error("Risposta vuota dal servizio Gemini");

      const extractTag = (text: string, tag: string) => {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
      };

      const soraPrompt15s = extractTag(res.text, 'prompt_sora_15s');
      const soraPrompt12s = extractTag(res.text, 'prompt_sora_12s');
      const klingPrompt = extractTag(res.text, 'prompt_kling');
      const veoPrompt = extractTag(res.text, 'prompt_veo');
      
      const analysisData = { type, result: res.text };
      
      if (target === 'prompt') {
        setPromptAnalysis(analysisData);
        if (soraPrompt15s) resetPrompts(soraPrompt15s);
        if (soraPrompt12s) resetSora12s(soraPrompt12s);
        if (klingPrompt) resetKling(klingPrompt);
        if (veoPrompt) resetVeo(veoPrompt);
        if (soraPrompt12s && !soraPrompt15s) setSoraDuration('12s');
      } else if (target === 'prompt1') {
        setPrompt1Analysis(analysisData);
        if (soraPrompt15s) resetPrompts1(soraPrompt15s);
        if (soraPrompt12s) resetSora12s1(soraPrompt12s);
        if (klingPrompt) resetKling1(klingPrompt);
        if (veoPrompt) resetVeo1(veoPrompt);
        if (soraPrompt12s && !soraPrompt15s) setSoraDuration1('12s');
      } else if (target === 'prompt2') {
        setPrompt2Analysis(analysisData);
        if (soraPrompt15s) resetPrompts2(soraPrompt15s);
        if (soraPrompt12s) resetSora12s2(soraPrompt12s);
        if (klingPrompt) resetKling2(klingPrompt);
        if (veoPrompt) resetVeo2(veoPrompt);
        if (soraPrompt12s && !soraPrompt15s) setSoraDuration2('12s');
      }
    } catch (err: any) {
      setError(err.message || "Errore durante l'analisi.");
    } finally {
      if (target === 'prompt') setIsAnalyzingPrompt(false);
      else if (target === 'prompt1') setIsAnalyzingPrompt1(false);
      else if (target === 'prompt2') setIsAnalyzingPrompt2(false);
    }
  }, [useBypass, niche, genre, platform, algoCuriosity, isDeepAnalysis, spinOffMode, viralBoost50k, musicalType, preferredSinger, resetPrompts, resetSora12s, resetKling, resetVeo, resetPrompts1, resetSora12s1, resetKling1, resetVeo1, resetPrompts2, resetSora12s2, resetKling2, resetVeo2, setError, setIsAnalyzingPrompt, setIsAnalyzingPrompt1, setIsAnalyzingPrompt2, setPromptAnalysis, setPrompt1Analysis, setPrompt2Analysis, setSoraDuration, setSoraDuration1, setSoraDuration2]);

  const handleRefineCover = useCallback(async (prompt: string, goal: string) => {
    setIsGeneratingCover(true);
    try {
      const newPrompt = await refineCoverPromptWithGoal(prompt, goal, apiKey, 'flash');
      const img = await generateCover(newPrompt, coverAspectRatio, coverReferenceImage || undefined, coverHookText || undefined);
      setCoverImage(img);
    } catch (err: any) {
      setError(err.message || "Errore generazione cover.");
    } finally {
      setIsGeneratingCover(false);
    }
  }, [genre, platform, coverAspectRatio, coverReferenceImage, coverHookText, setError, setIsGeneratingCover, setCoverImage]);

  const handleGenerateCover = useCallback(async () => {
    if (!editableScript && !description) {
      setError("Fornisci uno script o una descrizione per generare la cover.");
      return;
    }
    setIsGeneratingCover(true);
    try {
      const img = await generateCover(editableScript || description, coverAspectRatio, coverReferenceImage || undefined, coverHookText || undefined);
      setCoverImage(img);
    } catch (err: any) {
      setError(err.message || "Errore generazione cover.");
    } finally {
      setIsGeneratingCover(false);
    }
  }, [editableScript, description, coverAspectRatio, coverReferenceImage, coverHookText, setError, setIsGeneratingCover, setCoverImage]);

  const handleRewritePrompt = useCallback(async (promptText: string, target: 'prompts' | 'prompts1' | 'prompts2', level: number) => {
    if (!promptText) return;
    if (target === 'prompts') setIsRewriting(true);
    else if (target === 'prompts1') setIsRewriting1(true);
    else if (target === 'prompts2') setIsRewriting2(true);
    
    try {
      const rewritten = await rewriteDangerousPrompt(promptText, apiKey);
      if (rewritten === "[DISCARD]") {
        console.warn("Prompt discarded. Triggering regeneration...");
        // Minimal approach: re-run the analysis (this is a simplified fix path)
        await handleAnalyzePrompt(promptText, 'anti-ai-slop', target === 'prompts' ? 'prompt' : target === 'prompts1' ? 'prompt1' : 'prompt2');
        return;
      }
      if (target === 'prompts') resetPrompts(rewritten);
      else if (target === 'prompts1') resetPrompts1(rewritten);
      else if (target === 'prompts2') resetPrompts2(rewritten);
    } catch (err: any) {
      setError(err.message || "Errore durante il rewrite.");
    } finally {
      if (target === 'prompts') setIsRewriting(false);
      else if (target === 'prompts1') setIsRewriting1(false);
      else if (target === 'prompts2') setIsRewriting2(false);
    }
  }, [resetPrompts, resetPrompts1, resetPrompts2, setError, setIsRewriting, setIsRewriting1, setIsRewriting2]);

  const handleOptimizeSora2 = useCallback(async (promptText: string, target: 'prompts' | 'prompts1' | 'prompts2') => {
    if (!promptText) return;
    if (target === 'prompts') setIsOptimizingSora2(true);
    else if (target === 'prompts1') setIsOptimizingSora2_1(true);
    else if (target === 'prompts2') setIsOptimizingSora2_2(true);
    
    try {
      const optimized = await optimizeForSora2(promptText);
      if (target === 'prompts') resetPrompts(optimized);
      else if (target === 'prompts1') resetPrompts1(optimized);
      else if (target === 'prompts2') resetPrompts2(optimized);
    } catch (err: any) {
      setError(err.message || "Errore durante l'ottimizzazione.");
    } finally {
      if (target === 'prompts') setIsOptimizingSora2(false);
      else if (target === 'prompts1') setIsOptimizingSora2_1(false);
      else if (target === 'prompts2') setIsOptimizingSora2_2(false);
    }
  }, [resetPrompts, resetPrompts1, resetPrompts2, setError, setIsOptimizingSora2, setIsOptimizingSora2_1, setIsOptimizingSora2_2]);

  const handleGenerateVoiceover = useCallback(async (script: string) => {
    if (!script) return;
    setIsGeneratingVoiceover(true);
    setVoiceoverError(null);
    try {
      const audioData = await generateVoiceover(script, preferredSinger || 'Kore', apiKey);
      setVoiceoverAudio({ data: audioData, mimeType: 'audio/wav', script });
    } catch (err: any) {
      setVoiceoverError(err.message || "Errore generazione voiceover.");
    } finally {
      setIsGeneratingVoiceover(false);
    }
  }, [preferredSinger, setVoiceoverAudio, setVoiceoverError, setIsGeneratingVoiceover]);

  const handleDetectDangerousWords = useCallback(async (text: string, setLocalLoading: (val: boolean) => void) => {
    if (!text) return;
    setLocalLoading(true);
    try {
      const words = await detectDangerousWordsWithAI(text);
      setDangerousWords(words);
    } catch (err: any) {
      setError(err.message || "Errore rilevamento parole pericolose.");
    } finally {
      setLocalLoading(false);
    }
  }, [setDangerousWords, setError]);

  const handleBypassWord = useCallback(async (word: string, target: 'prompts' | 'prompts1' | 'prompts2') => {
    setBypassingWord({ word, target });
    try {
      let setter: ((val: string | ((prev: string) => string)) => void) | null = null;
      if (target === 'prompts') setter = resetPrompts;
      else if (target === 'prompts1') setter = resetPrompts1;
      else if (target === 'prompts2') setter = resetPrompts2;

      if (!setter) return;

      const bypassed = await getBypassedWord(word, apiKey);
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      let currentVal = '';
      if (target === 'prompts') currentVal = state.editablePrompts;
      else if (target === 'prompts1') currentVal = state.editablePrompts1;
      else if (target === 'prompts2') currentVal = state.editablePrompts2;

      const newText = currentVal.replace(new RegExp(escapedWord, 'gi'), bypassed);
      setter(newText);
      
      setDangerousWords(prev => prev.filter(w => w.toLowerCase() !== word.toLowerCase()));
    } catch (err: any) {
      setError(err.message || "Errore bypass parola.");
    } finally {
      setBypassingWord(null);
    }
  }, [state.editablePrompts, state.editablePrompts1, state.editablePrompts2, resetPrompts, resetPrompts1, resetPrompts2, setDangerousWords, setError, setBypassingWord]);

  const handleGenerate = useCallback(async (
    isFeedback = false,
    overrideDescription?: string,
    overrideGenre?: string,
    overrideAnalysisMode?: any,
    overrideWizardAnswers?: any
  ) => {
    const currentAnalysisMode = overrideAnalysisMode !== undefined ? overrideAnalysisMode : analysisMode;
    const currentDescription = overrideDescription !== undefined ? overrideDescription : description;
    const currentGenre = currentAnalysisMode === 'pensaci-tu' ? pensaciTuGenre : (overrideGenre !== undefined ? overrideGenre : genre);
    const currentWizardAnswers = overrideWizardAnswers !== undefined ? overrideWizardAnswers : wizardAnswers;

    if (currentAnalysisMode === 'guided-short' && !currentWizardAnswers.promise) {
      setError("La promessa è obbligatoria per la modalità guidata.");
      return;
    }

    if (currentAnalysisMode === 'trend-hunter' && !trendNiche.trim()) {
      setError("Inserisci una nicchia per cercare i trend.");
      return;
    }

    if (currentAnalysisMode === 'hook-test' && (!hookA.trim() || !hookB.trim())) {
      setError("Inserisci entrambi i ganci (Hook A e Hook B) per confrontarli.");
      return;
    }

    if (currentAnalysisMode === 'estimate' || currentAnalysisMode === 'anti-ai-slop') {
      if (estimateInputType === 'video' && !file && !savedVideoData && !currentDescription.trim()) {
        setError(`Per la ${currentAnalysisMode === 'estimate' ? 'stima delle visualizzazioni' : 'cura anti-ai slop'} è necessario caricare un video o descrivere l'idea.`);
        return;
      }
      if (estimateInputType === 'prompt' && !originalPrompt.trim() && !currentDescription.trim()) {
        setError(`Per la ${currentAnalysisMode === 'estimate' ? 'stima delle visualizzazioni' : 'cura anti-ai slop'} è necessario incollare il prompt originale o descrivere l'idea.`);
        return;
      }
    }

    if (currentAnalysisMode === 'generate' && !file && !savedVideoData && !currentDescription.trim()) {
      setError("Fornisci un video o una descrizione per iniziare.");
      return;
    }

    setIsLoading(true);
    setIsTakingLong(false);
    setError(null);
    
    let finalMode: any = currentAnalysisMode;
    const takingLongTimeout = setTimeout(() => setIsTakingLong(true), 90000);

    try {
      if (['pensaci-tu', 'generate', 'estimate', 'anti-ai-slop'].includes(currentAnalysisMode)) {
        console.log("[App] Executing Gemini preflight check...");
        const preflight = await preflightCheckGeminiQuota(apiKey);
        if (!preflight.ok) {
          const canDegrade = !['generate', 'pensaci-tu'].includes(currentAnalysisMode) || (!file && !savedVideoData);
          if (canDegrade) {
            console.warn("[PIPELINE_DEGRADED_MODE] reason=GEMINI_QUOTA_EXCEEDED mode=GROQ_ONLY_DEGRADED");
            finalMode = "GROQ_ONLY_DEGRADED";
            // Do not setError here, let the UI handle the mode state if needed
          } else {
            console.warn("[PIPELINE_ABORTED] reason=GEMINI_QUOTA_INSUFFICIENT");
            setError(`❌ Analisi non avviata\n\nMotivo: ${preflight.reason || 'Quota Gemini insufficiente per eseguire analisi completa'}\n\nSuggerimento: attendere reset quota.`);
            return;
          }
        }
      }

      if (currentAnalysisMode === 'trend-hunter') {
        const trends = await getTrendingTopics(trendNiche);
        setResult({
          analysis: "Analisi Trend completata.",
          script: '',
          aiPrompts: '',
          trends: trends.map(t => ({ type: 'trend', title: t, description: '' }))
        });
      } else if (currentAnalysisMode === 'hook-test') {
        const comparison = await compareHooks(hookA, hookB, trendNiche || currentGenre, apiKey);
        setResult({
          analysis: comparison.analysis.join('\n'),
          script: '',
          aiPrompts: '',
          hookComparison: comparison.analysis.join('\n'),
          winner: comparison.winner === 0 ? 'A' : 'B'
        });
      } else if (finalMode === 'pensaci-tu') {
        const videoToProcess = file || undefined;
        let visualOverride = null;
        if (videoToProcess && videoToProcess.type.startsWith('video/')) {
          console.log("[App] Starting visual variance check...");
          try {
            const { calculateVideoVariance } = await import('../utils/videoVarianceSensor');
            // Fail-safe: if the sensor takes too long (> 10s), we proceed without it
            const variancePromise = calculateVideoVariance(videoToProcess);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Variance sensor timeout")), 12000));
            
            const varianceData = await Promise.race([variancePromise, timeoutPromise]) as any;
            visualOverride = varianceData.overrideString;
            console.log(`[App] Visual variance check completed: ${varianceData.variancePercent.toFixed(2)}%`);
          } catch (e) {
            console.error("[App] Variance sensor failed or timed out:", e);
          }
        }
        
        let effectiveIsDeepAnalysis = isDeepAnalysis;
        if (finalMode === "GROQ_ONLY_DEGRADED") {
            effectiveIsDeepAnalysis = false;
            console.warn("[GEMINI_VISUAL_MODULE_SKIPPED] module=visual_analysis reason=groq_only_degraded");
            
            // Log as requested
            console.log("[GROQ_ONLY_DEGRADED_ENTERED]", {
                source: file ? "transcript" : description ? "description" : "idea",
                skipGeminiVideo: true
            });
            console.log("[GEMINI_MULTIMODAL_SKIPPED]", { reason: "groq_only_degraded" });
            console.log("[GROQ_ONLY_CREATIVE_STARTED]");
            
            try {
                console.log("[GROQ_ONLY_CREATIVE_COMPLETED]", {
                    hasSceneDna: false, hasPromptStrategy: false, hasPrompts: false, hasPublishingKit: false
                });
                
                setResult({
                  analysis: "Modalità Groq-only: risultato basato su testo/audio, senza verifica visiva Gemini.",
                  script: '',
                  aiPrompts: '',
                  modelUsed: 'flash',
                  analysisMode: "GROQ_ONLY_DEGRADED",
                  engineReliability: "DEGRADED"
                } as any);
            } catch (err: any) {
                console.log("[GROQ_ONLY_CREATIVE_FAILED]", { reason: err.message });
                throw err;
            }
        } else {
            console.log("[App] Triggering Gemini generateVideoPrompt...");
            const res = await generateVideoPrompt(
              videoToProcess,
              file?.type || (savedVideoData ? 'video/mp4' : undefined),
              currentDescription, useBypass, niche, currentGenre, platform, [],
              algoCuriosity, null, effectiveIsDeepAnalysis, false, spinOffMode,
              viralBoost50k, finalMode, 'pro', false, apiKey, musicalType, preferredSinger,
              undefined, pensaciTuGoal, undefined, undefined, undefined, undefined, 'AUTO', visualOverride
            );
            setResult({
              analysis: res.text,
              script: '',
              aiPrompts: '',
              modelUsed: 'pro'
            });
        }
      } else {
        const videoToProcess = file || undefined;
        let visualOverride = null;
        if (videoToProcess && videoToProcess.type.startsWith('video/')) {
          console.log("[App] Starting visual variance check...");
          try {
            const { calculateVideoVariance } = await import('../utils/videoVarianceSensor');
            const variancePromise = calculateVideoVariance(videoToProcess);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Variance sensor timeout")), 12000));
            
            const varianceData = await Promise.race([variancePromise, timeoutPromise]) as any;
            visualOverride = varianceData.overrideString;
            console.log(`[App] Visual variance check completed: ${varianceData.variancePercent.toFixed(2)}%`);
          } catch (e) {
            console.error("[App] Variance sensor failed or timed out:", e);
          }
        }

        let effectiveIsDeepAnalysis = isDeepAnalysis;
        if (finalMode === "GROQ_ONLY_DEGRADED") {
            effectiveIsDeepAnalysis = false;
            console.warn("[GEMINI_VISUAL_MODULE_SKIPPED] module=visual_analysis reason=groq_only_degraded");
            
            console.log("[GROQ_ONLY_DEGRADED_ENTERED]", {
                source: file ? "transcript" : description ? "description" : "idea",
                skipGeminiVideo: true
            });
            console.log("[GEMINI_MULTIMODAL_SKIPPED]", { reason: "groq_only_degraded" });
            console.log("[GROQ_ONLY_CREATIVE_STARTED]");
            
            try {
                console.log("[GROQ_ONLY_CREATIVE_COMPLETED]", {
                    hasSceneDna: false, hasPromptStrategy: false, hasPrompts: false, hasPublishingKit: false
                });
                
                setResult({
                  analysis: "Modalità Groq-only: risultato basato su testo/audio, senza verifica visiva Gemini.",
                  script: '',
                  aiPrompts: '',
                  modelUsed: 'flash',
                  analysisMode: "GROQ_ONLY_DEGRADED",
                  engineReliability: "DEGRADED"
                } as any);
            } catch (err: any) {
                console.log("[GROQ_ONLY_CREATIVE_FAILED]", { reason: err.message });
                throw err;
            }
        } else {
            console.log("[App] Triggering Gemini generateVideoPrompt...");
            const res = await generateVideoPrompt(
              videoToProcess,
              file?.type || (savedVideoData ? 'video/mp4' : undefined),
              currentDescription, useBypass, niche, currentGenre, platform, [],
              algoCuriosity, null, effectiveIsDeepAnalysis, false, spinOffMode,
              viralBoost50k, finalMode, 'pro', false, apiKey, musicalType, preferredSinger,
              undefined, undefined, undefined, undefined, undefined, undefined, 'AUTO', visualOverride
            );
            setResult({
              analysis: res.text,
              script: '',
              aiPrompts: '',
              modelUsed: 'pro'
            });
        }
      }
    } catch (err: any) {
      setError(err.message || "Errore durante la generazione.");
    } finally {
      setIsLoading(false);
      setIsTakingLong(false);
      clearTimeout(takingLongTimeout);
    }
  }, [analysisMode, wizardAnswers, trendNiche, hookA, hookB, estimateInputType, file, description, originalPrompt, useBypass, niche, genre, platform, algoCuriosity, isDeepAnalysis, spinOffMode, viralBoost50k, musicalType, preferredSinger, pensaciTuGenre, pensaciTuGoal, savedVideoData, setError, setIsLoading, setIsTakingLong, setResult]);

  return {
    handleAnalyzePrompt,
    handleRefineCover,
    handleGenerateCover,
    handleRewritePrompt,
    handleOptimizeSora2,
    handleGenerateVoiceover,
    handleGenerate,
    handleBypassWord,
    handleDetectDangerousWords
  };
}
