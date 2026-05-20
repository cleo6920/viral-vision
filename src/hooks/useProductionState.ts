import { useState, useEffect, useCallback } from 'react';
import { ResultData, NicheIdea } from '../types';
import { useUndoRedo } from './useUndoRedo';

interface InitialState {
  result: ResultData | null;
  editableScript: string;
  editablePrompts: string;
  editableSora12s: string;
  editableKling: string;
  editableVeo: string;
  editablePrompts1: string;
  editableSora12s1: string;
  editableKling1: string;
  editableVeo1: string;
  editablePrompts2: string;
  editableSora12s2: string;
  editableKling2: string;
  editableVeo2: string;
  dangerousWords: string[];
  coverHookText?: string;
  coverGoal?: string;
  isRefiningCover?: boolean;
  activePromptTab?: 'sora' | 'kling' | 'veo';
  soraDuration?: '15s' | '12s';
  activePromptTab1?: 'sora' | 'kling' | 'veo';
  soraDuration1?: '15s' | '12s';
  activePromptTab2?: 'sora' | 'kling' | 'veo';
  soraDuration2?: '15s' | '12s';
  pastPrompts?: string[];
  futurePrompts?: string[];
  pastSora12s?: string[];
  futureSora12s?: string[];
  pastKling?: string[];
  futureKling?: string[];
  pastVeo?: string[];
  futureVeo?: string[];
  pastPrompts1?: string[];
  futurePrompts1?: string[];
  pastSora12s1?: string[];
  futureSora12s1?: string[];
  pastKling1?: string[];
  futureKling1?: string[];
  pastVeo1?: string[];
  futureVeo1?: string[];
  pastPrompts2?: string[];
  futurePrompts2?: string[];
  pastSora12s2?: string[];
  futureSora12s2?: string[];
  pastKling2?: string[];
  futureKling2?: string[];
  pastVeo2?: string[];
  futureVeo2?: string[];
}

export function useProductionState(initialState: InitialState | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTakingLong, setIsTakingLong] = useState(false);
  const [result, setResult] = useState<ResultData | null>(initialState?.result || null);
  const [editableScript, setEditableScript] = useState(initialState?.editableScript || initialState?.result?.script || '');
  
  const [editablePrompts, setEditablePrompts, undoPrompts, redoPrompts, canUndoPrompts, canRedoPrompts, resetPrompts, pastPrompts, futurePrompts] = useUndoRedo<string>(initialState?.editablePrompts ?? initialState?.result?.aiPrompts ?? '', initialState?.pastPrompts, initialState?.futurePrompts);
  const [editableSora12s, setEditableSora12s, undoSora12s, redoSora12s, canUndoSora12s, canRedoSora12s, resetSora12s, pastSora12s, futureSora12s] = useUndoRedo<string>(initialState?.editableSora12s ?? '', initialState?.pastSora12s, initialState?.futureSora12s);
  const [editableKling, setEditableKling, undoKling, redoKling, canUndoKling, canRedoKling, resetKling, pastKling, futureKling] = useUndoRedo<string>(initialState?.editableKling ?? initialState?.result?.klingPrompt ?? '', initialState?.pastKling, initialState?.futureKling);
  const [editableVeo, setEditableVeo, undoVeo, redoVeo, canUndoVeo, canRedoVeo, resetVeo, pastVeo, futureVeo] = useUndoRedo<string>(initialState?.editableVeo ?? initialState?.result?.veoPrompt ?? '', initialState?.pastVeo, initialState?.futureVeo);
  
  const [editablePrompts1, setEditablePrompts1, undoPrompts1, redoPrompts1, canUndoPrompts1, canRedoPrompts1, resetPrompts1, pastPrompts1, futurePrompts1] = useUndoRedo<string>(initialState?.editablePrompts1 ?? '', initialState?.pastPrompts1, initialState?.futurePrompts1);
  const [editableSora12s1, setEditableSora12s1, undoSora12s1, redoSora12s1, canUndoSora12s1, canRedoSora12s1, resetSora12s1, pastSora12s1, futureSora12s1] = useUndoRedo<string>(initialState?.editableSora12s1 ?? '', initialState?.pastSora12s1, initialState?.futureSora12s1);
  const [editableKling1, setEditableKling1, undoKling1, redoKling1, canUndoKling1, canRedoKling1, resetKling1, pastKling1, futureKling1] = useUndoRedo<string>(initialState?.editableKling1 ?? initialState?.result?.klingPrompt1 ?? '', initialState?.pastKling1, initialState?.futureKling1);
  const [editableVeo1, setEditableVeo1, undoVeo1, redoVeo1, canUndoVeo1, canRedoVeo1, resetVeo1, pastVeo1, futureVeo1] = useUndoRedo<string>(initialState?.editableVeo1 ?? initialState?.result?.veoPrompt1 ?? '', initialState?.pastVeo1, initialState?.futureVeo1);
  
  const [editablePrompts2, setEditablePrompts2, undoPrompts2, redoPrompts2, canUndoPrompts2, canRedoPrompts2, resetPrompts2, pastPrompts2, futurePrompts2] = useUndoRedo<string>(initialState?.editablePrompts2 ?? '', initialState?.pastPrompts2, initialState?.futurePrompts2);
  const [editableSora12s2, setEditableSora12s2, undoSora12s2, redoSora12s2, canUndoSora12s2, canRedoSora12s2, resetSora12s2, pastSora12s2, futureSora12s2] = useUndoRedo<string>(initialState?.editableSora12s2 ?? '', initialState?.pastSora12s2, initialState?.futureSora12s2);
  const [editableKling2, setEditableKling2, undoKling2, redoKling2, canUndoKling2, canRedoKling2, resetKling2, pastKling2, futureKling2] = useUndoRedo<string>(initialState?.editableKling2 ?? initialState?.result?.klingPrompt2 ?? '', initialState?.pastKling2, initialState?.futureKling2);
  const [editableVeo2, setEditableVeo2, undoVeo2, redoVeo2, canUndoVeo2, canRedoVeo2, resetVeo2, pastVeo2, futureVeo2] = useUndoRedo<string>(initialState?.editableVeo2 ?? initialState?.result?.veoPrompt2 ?? '', initialState?.pastVeo2, initialState?.futureVeo2);
  
  const [dangerousWords, setDangerousWords] = useState<string[]>(initialState?.dangerousWords || []);
  const [error, setError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState("Analisi dell'algoritmo di ritenzione...");

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isRewriting1, setIsRewriting1] = useState(false);
  const [isRewriting2, setIsRewriting2] = useState(false);
  const [isOptimizingSora2, setIsOptimizingSora2] = useState(false);
  const [isOptimizingSora2_1, setIsOptimizingSora2_1] = useState(false);
  const [isOptimizingSora2_2, setIsOptimizingSora2_2] = useState(false);
  const [isDetectingDangerousWords, setIsDetectingDangerousWords] = useState(false);
  const [isDetectingDangerousWords_1, setIsDetectingDangerousWords_1] = useState(false);
  const [isDetectingDangerousWords_2, setIsDetectingDangerousWords_2] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [voiceoverAudio, setVoiceoverAudio] = useState<{ data: string, mimeType: string, script: string } | null>(null);
  const [voiceoverError, setVoiceoverError] = useState<string | null>(null);
  const [rewriteLevel, setRewriteLevel] = useState(1);
  const [rewriteLevel1, setRewriteLevel1] = useState(1);
  const [rewriteLevel2, setRewriteLevel2] = useState(1);
  const [activePromptTab, setActivePromptTab] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab || 'sora');
  const [soraDuration, setSoraDuration] = useState<'15s' | '12s'>(initialState?.soraDuration || '15s');
  const [activePromptTab1, setActivePromptTab1] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab1 || 'sora');
  const [soraDuration1, setSoraDuration1] = useState<'15s' | '12s'>(initialState?.soraDuration1 || '15s');
  const [activePromptTab2, setActivePromptTab2] = useState<'sora' | 'kling' | 'veo'>(initialState?.activePromptTab2 || 'sora');
  const [soraDuration2, setSoraDuration2] = useState<'15s' | '12s'>(initialState?.soraDuration2 || '15s');
  const [bypassingWord, setBypassingWord] = useState<{ word: string, target: 'prompts' | 'prompts1' | 'prompts2' } | null>(null);
  const [coverAspectRatio, setCoverAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [coverReferenceImage, setCoverReferenceImage] = useState<string | null>(null);
  const [coverHookText, setCoverHookText] = useState<string>("");
  const [coverGoal, setCoverGoal] = useState('');
  const [isRefiningCover, setIsRefiningCover] = useState(false);
  const [flashPrompt, setFlashPrompt] = useState(false);
  const [flashPrompt1, setFlashPrompt1] = useState(false);
  const [flashPrompt2, setFlashPrompt2] = useState(false);
  const [promptAnalysis, setPromptAnalysis] = useState<{ type: 'estimate' | 'anti-ai-slop', result: string } | null>(null);
  const [isAnalyzingPrompt, setIsAnalyzingPrompt] = useState(false);
  const [prompt1Analysis, setPrompt1Analysis] = useState<{ type: 'estimate' | 'anti-ai-slop', result: string } | null>(null);
  const [isAnalyzingPrompt1, setIsAnalyzingPrompt1] = useState(false);
  const [prompt2Analysis, setPrompt2Analysis] = useState<{ type: 'estimate' | 'anti-ai-slop', result: string } | null>(null);
  const [isAnalyzingPrompt2, setIsAnalyzingPrompt2] = useState(false);
  const [feedback, setFeedback] = useState('');

  const resetAll = useCallback(() => {
    setResult(null);
    setEditableScript('');
    resetPrompts('');
    resetSora12s('');
    resetKling('');
    resetVeo('');
    resetPrompts1('');
    resetSora12s1('');
    resetKling1('');
    resetVeo1('');
    resetPrompts2('');
    resetSora12s2('');
    resetKling2('');
    resetVeo2('');
    setDangerousWords([]);
    setError(null);
    setCoverImage(null);
    setPromptAnalysis(null);
    setPrompt1Analysis(null);
    setPrompt2Analysis(null);
    setFeedback('');
  }, [resetPrompts, resetSora12s, resetKling, resetVeo, resetPrompts1, resetSora12s1, resetKling1, resetVeo1, resetPrompts2, resetSora12s2, resetKling2, resetVeo2]);

  return {
    isLoading, setIsLoading,
    isTakingLong, setIsTakingLong,
    result, setResult,
    editableScript, setEditableScript,
    editablePrompts, setEditablePrompts, undoPrompts, redoPrompts, canUndoPrompts, canRedoPrompts, resetPrompts, pastPrompts, futurePrompts,
    editableSora12s, setEditableSora12s, undoSora12s, redoSora12s, canUndoSora12s, canRedoSora12s, resetSora12s, pastSora12s, futureSora12s,
    editableKling, setEditableKling, undoKling, redoKling, canUndoKling, canRedoKling, resetKling, pastKling, futureKling,
    editableVeo, setEditableVeo, undoVeo, redoVeo, canUndoVeo, canRedoVeo, resetVeo, pastVeo, futureVeo,
    editablePrompts1, setEditablePrompts1, undoPrompts1, redoPrompts1, canUndoPrompts1, canRedoPrompts1, resetPrompts1, pastPrompts1, futurePrompts1,
    editableSora12s1, setEditableSora12s1, undoSora12s1, redoSora12s1, canUndoSora12s1, canRedoSora12s1, resetSora12s1, pastSora12s1, futureSora12s1,
    editableKling1, setEditableKling1, undoKling1, redoKling1, canUndoKling1, canRedoKling1, resetKling1, pastKling1, futureKling1,
    editableVeo1, setEditableVeo1, undoVeo1, redoVeo1, canUndoVeo1, canRedoVeo1, resetVeo1, pastVeo1, futureVeo1,
    editablePrompts2, setEditablePrompts2, undoPrompts2, redoPrompts2, canUndoPrompts2, canRedoPrompts2, resetPrompts2, pastPrompts2, futurePrompts2,
    editableSora12s2, setEditableSora12s2, undoSora12s2, redoSora12s2, canUndoSora12s2, canRedoSora12s2, resetSora12s2, pastSora12s2, futureSora12s2,
    editableKling2, setEditableKling2, undoKling2, redoKling2, canUndoKling2, canRedoKling2, resetKling2, pastKling2, futureKling2,
    editableVeo2, setEditableVeo2, undoVeo2, redoVeo2, canUndoVeo2, canRedoVeo2, resetVeo2, pastVeo2, futureVeo2,
    dangerousWords, setDangerousWords,
    error, setError,
    loadingText, setLoadingText,
    copiedField, setCopiedField,
    isGeneratingCover, setIsGeneratingCover,
    coverImage, setCoverImage,
    isRewriting, setIsRewriting,
    isRewriting1, setIsRewriting1,
    isRewriting2, setIsRewriting2,
    isOptimizingSora2, setIsOptimizingSora2,
    isOptimizingSora2_1, setIsOptimizingSora2_1,
    isOptimizingSora2_2, setIsOptimizingSora2_2,
    isDetectingDangerousWords, setIsDetectingDangerousWords,
    isDetectingDangerousWords_1, setIsDetectingDangerousWords_1,
    isDetectingDangerousWords_2, setIsDetectingDangerousWords_2,
    isTrimming, setIsTrimming,
    trimProgress, setTrimProgress,
    isGeneratingVoiceover, setIsGeneratingVoiceover,
    voiceoverAudio, setVoiceoverAudio,
    voiceoverError, setVoiceoverError,
    rewriteLevel, setRewriteLevel,
    rewriteLevel1, setRewriteLevel1,
    rewriteLevel2, setRewriteLevel2,
    activePromptTab, setActivePromptTab,
    soraDuration, setSoraDuration,
    activePromptTab1, setActivePromptTab1,
    soraDuration1, setSoraDuration1,
    activePromptTab2, setActivePromptTab2,
    soraDuration2, setSoraDuration2,
    bypassingWord, setBypassingWord,
    coverAspectRatio, setCoverAspectRatio,
    coverReferenceImage, setCoverReferenceImage,
    coverHookText, setCoverHookText,
    coverGoal, setCoverGoal,
    isRefiningCover, setIsRefiningCover,
    flashPrompt, setFlashPrompt,
    flashPrompt1, setFlashPrompt1,
    flashPrompt2, setFlashPrompt2,
    promptAnalysis, setPromptAnalysis,
    isAnalyzingPrompt, setIsAnalyzingPrompt,
    prompt1Analysis, setPrompt1Analysis,
    isAnalyzingPrompt1, setIsAnalyzingPrompt1,
    prompt2Analysis, setPrompt2Analysis,
    isAnalyzingPrompt2, setIsAnalyzingPrompt2,
    feedback, setFeedback,
    resetAll
  };
}
