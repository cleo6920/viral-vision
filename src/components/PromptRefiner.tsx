import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { refinePromptWithGoal } from '../services/gemini';

interface PromptRefinerProps {
  prompt: string;
  onRefined: (newPrompt: string) => void;
  context?: string;
  colorClass?: "emerald" | "orange" | "red";
}

export const PromptRefiner = ({ 
  prompt, 
  onRefined,
  context = "",
  colorClass = "emerald"
}: PromptRefinerProps) => {
  const [goal, setGoal] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefine = async () => {
    if (!goal.trim() || !prompt.trim()) return;
    setIsRefining(true);
    setError(null);
    try {
      const refined = await refinePromptWithGoal(prompt, goal, context);
      onRefined(refined);
      setGoal('');
    } catch (err) {
      console.error(err);
      setError("Errore durante l'affinamento. Riprova.");
    } finally {
      setIsRefining(false);
    }
  };

  const colors = {
    emerald: "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
    orange: "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/10",
    red: "from-red-500/20 to-red-600/20 border-red-500/30 text-red-400 hover:bg-red-500/10"
  };

  return (
    <div className={`mt-4 p-4 rounded-xl border bg-gradient-to-br ${colors[colorClass]} transition-all`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-bold uppercase tracking-wider">Affinamento Intelligente</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Es: Rendi l'atmosfera più cupa..."
          className="flex-1 bg-black/40 border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 placeholder:text-white/20"
          onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
        />
        <button
          onClick={handleRefine}
          disabled={isRefining || !goal.trim()}
          className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
        >
          {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Applica
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
};
