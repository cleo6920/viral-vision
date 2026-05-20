import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Loader2, Check, X, Brain, Trophy, Play, ShieldAlert } from 'lucide-react';
import { generateWizardHooks, compareWizardHooks } from '../services/gemini';

interface SmartGuideWizardProps {
  apiKey: string;
  onComplete: (genre: string, idea: string, winningHook: string) => void;
  onClose: () => void;
}

export const SmartGuideWizard: React.FC<SmartGuideWizardProps> = ({ apiKey, onComplete, onClose }) => {
  const [step, setStep] = useState(1);
  const [genre, setGenre] = useState('');
  const [idea, setIdea] = useState('');
  const [hooks, setHooks] = useState<string[]>([]);
  const [selectedHooks, setSelectedHooks] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [abTestResult, setAbTestResult] = useState<{ verdict: string, recommendedWinner: 'A' | 'B' } | null>(null);
  const [winningHook, setWinningHook] = useState<string>('');
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) return;
    
    const texts = step === 3 
      ? [
          "L'IA sta elaborando 5 hook virali per la tua idea...",
          "Analisi dei trend attuali...",
          "Ottimizzazione per la ritenzione...",
          "Quasi pronti con le proposte..."
        ]
      : [
          "L'IA sta confrontando i due hook in modo spietato...",
          "Analisi psicologica del pubblico...",
          "Valutazione del potenziale virale...",
          "Scegliendo il vincitore statistico..."
        ];
    
    setLoadingText(texts[0]);
    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % texts.length;
      setLoadingText(texts[currentIndex]);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [isLoading, step]);

  const genres = ['Comedy', 'Sport', 'Music', 'Drama', 'Educational', 'Storytelling', 'ASMR', 'Auto-Detect'];

  const handleNextStep1 = () => {
    if (genre) setStep(2);
  };

  const handleNextStep2 = async () => {
    if (!idea.trim()) return;
    setIsLoading(true);
    setError(null);
    setStep(3);
    try {
      const generatedHooks = await generateWizardHooks(genre, idea, apiKey);
      setHooks(generatedHooks);
    } catch (err: any) {
      console.error(err);
      const errorMessage = (err.message || String(err)).toUpperCase();
      if (errorMessage.includes('429') || errorMessage.includes('QUOTA') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        setError("Hai esaurito i token gratuiti (Limite API Google raggiunto). Riprova più tardi.");
      } else {
        setError("Errore durante la generazione degli hook.");
      }
      setStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleHookSelection = (index: number) => {
    if (selectedHooks.includes(index)) {
      setSelectedHooks(selectedHooks.filter(i => i !== index));
    } else {
      if (selectedHooks.length < 2) {
        setSelectedHooks([...selectedHooks, index]);
      }
    }
  };

  const handleNextStep3 = async () => {
    if (selectedHooks.length === 1) {
      setWinningHook(hooks[selectedHooks[0]]);
      setStep(5); // Skip A/B test
    } else if (selectedHooks.length === 2) {
      setIsLoading(true);
      setError(null);
      setStep(4);
      try {
        const result = await compareWizardHooks(genre, idea, hooks[selectedHooks[0]], hooks[selectedHooks[1]], apiKey);
        setAbTestResult(result);
      } catch (err: any) {
        console.error(err);
        const errorMessage = (err.message || String(err)).toUpperCase();
        if (errorMessage.includes('429') || errorMessage.includes('QUOTA') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
          setError("Hai esaurito i token gratuiti (Limite API Google raggiunto). Riprova più tardi.");
        } else {
          setError("Errore durante il confronto degli hook.");
        }
        setStep(3);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSelectWinner = (winnerIndex: number) => {
    setWinningHook(hooks[selectedHooks[winnerIndex]]);
    setStep(5);
  };

  const handleFinish = () => {
    onComplete(genre, idea, winningHook);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-zinc-900/90 border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] glass-panel"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-2xl">
              <Brain className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight premium-gradient-text">Guida Intelligente</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">AI Strategy Assistant</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-all rounded-xl hover:bg-white/5">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 animate-shake">
              <ShieldAlert className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400 font-medium leading-relaxed">{error}</p>
            </div>
          )}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">In quale categoria vuoi lavorare?</h3>
                  <p className="text-zinc-400 text-sm font-medium">Seleziona il genere per ottimizzare l'algoritmo di ritenzione.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {genres.map(g => (
                    <button
                      key={g}
                      onClick={() => setGenre(g)}
                      className={`p-5 rounded-2xl border text-left transition-all duration-300 font-bold text-sm ${genre === g ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/10 scale-[1.02]' : 'bg-zinc-800/30 border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="mt-10 flex justify-end">
                  <button 
                    onClick={handleNextStep1}
                    disabled={!genre}
                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                  >
                    Avanti <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">Qual è la tua idea?</h3>
                  <p className="text-zinc-400 text-sm font-medium">Descrivi brevemente cosa vuoi mostrare nel video.</p>
                </div>
                <div className="relative group">
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="Es: Un cane che fa surf, spiegazione dei buchi neri, Elvis Presley..."
                    className="w-full h-40 bg-zinc-800/30 border border-white/5 rounded-3xl p-6 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium leading-relaxed resize-none glass-panel"
                  />
                </div>
                <div className="mt-10 flex justify-between items-center">
                  <button onClick={() => setStep(1)} className="px-6 py-3 text-zinc-500 hover:text-white font-bold transition-colors">Indietro</button>
                  <button 
                    onClick={handleNextStep2}
                    disabled={!idea.trim()}
                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                  >
                    Genera Strategia <Sparkles className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse" />
                      <Loader2 className="w-16 h-16 text-emerald-500 animate-spin relative z-10" />
                    </div>
                    <p className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-xs animate-pulse text-center max-w-xs">{loadingText}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-white tracking-tight">5 Hook Strategici</h3>
                      <p className="text-zinc-400 text-sm font-medium">Seleziona 1 hook per procedere, o 2 per un Test A/B.</p>
                    </div>
                    <div className="space-y-3">
                      {hooks.map((hook, idx) => (
                        <div 
                          key={idx}
                          onClick={() => toggleHookSelection(idx)}
                          className={`p-5 rounded-2xl border cursor-pointer transition-all duration-300 flex gap-4 relative overflow-hidden group ${selectedHooks.includes(idx) ? 'bg-emerald-500/10 border-emerald-500/50 scale-[1.01]' : 'bg-zinc-800/20 border-white/5 hover:border-white/10'}`}
                        >
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-all ${selectedHooks.includes(idx) ? 'bg-emerald-500 text-white rotate-0' : 'bg-zinc-800 border border-white/5 rotate-12 group-hover:rotate-0'}`}>
                            {selectedHooks.includes(idx) && <Check className="w-5 h-5" />}
                          </div>
                          <p className={`text-sm font-medium leading-relaxed ${selectedHooks.includes(idx) ? 'text-emerald-100' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{hook}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-10 flex justify-between items-center">
                      <button onClick={() => setStep(2)} className="px-6 py-3 text-zinc-500 hover:text-white font-bold transition-colors">Indietro</button>
                      <button 
                        onClick={handleNextStep3}
                        disabled={selectedHooks.length === 0}
                        className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                      >
                        {selectedHooks.length === 2 ? 'Avvia Test A/B' : 'Procedi'} <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse" />
                      <Loader2 className="w-16 h-16 text-emerald-500 animate-spin relative z-10" />
                    </div>
                    <p className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-xs animate-pulse text-center max-w-xs">{loadingText}</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <Trophy className="w-8 h-8 text-amber-400" />
                        Risultato Test A/B
                      </h3>
                      <p className="text-zinc-400 text-sm font-medium">L'IA ha analizzato i due hook. Ecco il verdetto statistico.</p>
                    </div>
                    
                    <div className="bg-zinc-800/30 border border-white/5 p-6 rounded-3xl glass-panel relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                      <p className="text-zinc-300 text-sm font-medium leading-relaxed italic">"{abTestResult?.verdict}"</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-2">Scegli il vincitore</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={() => handleSelectWinner(0)}
                          className={`p-6 rounded-3xl border text-left transition-all duration-300 relative group overflow-hidden ${abTestResult?.recommendedWinner === 'A' ? 'bg-emerald-500/10 border-emerald-500/50 ring-4 ring-emerald-500/10 scale-[1.02]' : 'bg-zinc-800/20 border-white/5 hover:border-white/10'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hook A</span>
                            {abTestResult?.recommendedWinner === 'A' && <span className="px-2 py-0.5 bg-emerald-500 text-[9px] font-black text-white rounded-full uppercase tracking-widest">Consigliato</span>}
                          </div>
                          <p className="text-sm font-bold text-zinc-200 leading-relaxed">{hooks[selectedHooks[0]]}</p>
                        </button>
                        
                        <button
                          onClick={() => handleSelectWinner(1)}
                          className={`p-6 rounded-3xl border text-left transition-all duration-300 relative group overflow-hidden ${abTestResult?.recommendedWinner === 'B' ? 'bg-emerald-500/10 border-emerald-500/50 ring-4 ring-emerald-500/10 scale-[1.02]' : 'bg-zinc-800/20 border-white/5 hover:border-white/10'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hook B</span>
                            {abTestResult?.recommendedWinner === 'B' && <span className="px-2 py-0.5 bg-emerald-500 text-[9px] font-black text-white rounded-full uppercase tracking-widest">Consigliato</span>}
                          </div>
                          <p className="text-sm font-bold text-zinc-200 leading-relaxed">{hooks[selectedHooks[1]]}</p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-center py-12 space-y-8">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-emerald-500/30 blur-3xl rounded-full animate-pulse" />
                  <div className="w-24 h-24 bg-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto relative z-10 border border-emerald-500/30">
                    <Check className="w-12 h-12 text-emerald-400" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-4xl font-black text-white tracking-tighter premium-gradient-text">Strategia Pronta</h3>
                  <p className="text-zinc-400 font-medium max-w-md mx-auto leading-relaxed">
                    Abbiamo l'idea perfetta e l'hook vincente. Ora genereremo il prompt completo ottimizzato per l'algoritmo.
                  </p>
                </div>
                <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2rem] text-left max-w-lg mx-auto glass-panel relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                  <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Hook Selezionato</div>
                  <p className="text-lg font-bold text-emerald-300 leading-tight italic">"{winningHook}"</p>
                </div>
                <button 
                  onClick={handleFinish}
                  className="px-12 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black uppercase tracking-widest text-sm flex items-center gap-3 mx-auto transition-all shadow-2xl shadow-emerald-600/30 active:scale-95"
                >
                  Genera Video Prompt <Play className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
