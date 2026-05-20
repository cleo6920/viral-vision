import { useState } from 'react';

export function useFormState(initialState: any) {
  const [file, setFile] = useState<File | null>(null);
  const [savedVideoData, setSavedVideoData] = useState<{base64: string, mimeType: string, fileName: string} | null>(null);
  const [description, setDescription] = useState(initialState?.description || '');
  const [analysisMode, setAnalysisMode] = useState<'generate' | 'estimate' | 'anti-ai-slop' | 'trend-hunter' | 'hook-test' | 'viral-hook-bulk' | 'production-flow' | 'guided-short' | 'pensaci-tu'>(initialState?.analysisMode || 'generate');
  const [pensaciTuGenre, setPensaciTuGenre] = useState(initialState?.pensaciTuGenre || 'Auto-Detect');
  const [wizardAnswers, setWizardAnswers] = useState(initialState?.wizardAnswers || { promise: '', target: '', vibe: '', duration: '15s' });
  const [trendNiche, setTrendNiche] = useState(initialState?.trendNiche || '');
  const [hookA, setHookA] = useState(initialState?.hookA || '');
  const [hookB, setHookB] = useState(initialState?.hookB || '');
  const [originalPrompt, setOriginalPrompt] = useState(initialState?.originalPrompt || '');
  const [estimateInputType, setEstimateInputType] = useState<'video' | 'prompt'>(initialState?.estimateInputType || 'video');
  const [pensaciTuGoal, setPensaciTuGoal] = useState(initialState?.pensaciTuGoal || '');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setError: (err: string | null) => void) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError("Il file è troppo grande. Massimo 100MB per l'analisi video diretta.");
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, setError: (err: string | null) => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError("Il file è troppo grande. Massimo 100MB per l'analisi video diretta.");
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  return {
    file, setFile,
    savedVideoData, setSavedVideoData,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    description, setDescription,
    analysisMode, setAnalysisMode,
    pensaciTuGenre, setPensaciTuGenre,
    wizardAnswers, setWizardAnswers,
    trendNiche, setTrendNiche,
    hookA, setHookA,
    hookB, setHookB,
    originalPrompt, setOriginalPrompt,
    estimateInputType, setEstimateInputType,
    pensaciTuGoal, setPensaciTuGoal
  };
}
