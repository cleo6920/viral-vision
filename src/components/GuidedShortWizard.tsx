import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Sparkles, Loader2, ChevronDown } from 'lucide-react';

interface GuidedShortWizardProps {
  onComplete: (answers: any) => void;
  isLoading: boolean;
}

export const GuidedShortWizard = ({ onComplete, isLoading }: GuidedShortWizardProps) => {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({
    genre: '',
    topic: '',
    target: '',
    vibe: '',
    duration: '15s'
  });

  const genres = ['Lifestyle', 'Tech', 'Comedy', 'Educational', 'Travel', 'Food', 'Fitness', 'Business'];
  const vibes = ['Cinematic', 'Fast-paced', 'Minimalist', 'Vibrant', 'Dark', 'Professional', 'Casual', 'Aesthetic'];

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
    else onComplete(answers);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-500/20 rounded-lg">
          <Target className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Guided Short Wizard</h3>
          <p className="text-xs text-zinc-500">Passo {step} di 5</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          {step === 1 && (
            <div className="space-y-4">
              <label className="text-sm font-medium text-zinc-300">Qual è il genere del tuo video?</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {genres.map(g => (
                  <button
                    key={g}
                    onClick={() => { setAnswers({ ...answers, genre: g }); handleNext(); }}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      answers.genre === g ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="text-sm font-medium text-zinc-300">Di cosa parla il video? (Argomento principale)</label>
              <textarea
                value={answers.topic}
                onChange={(e) => setAnswers({ ...answers, topic: e.target.value })}
                placeholder="Es: Una giornata nella vita di uno sviluppatore..."
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 h-32"
              />
              <button
                onClick={handleNext}
                disabled={!answers.topic.trim()}
                className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-zinc-200 disabled:opacity-50 transition-all"
              >
                Continua
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="text-sm font-medium text-zinc-300">Chi è il tuo target ideale?</label>
              <input
                type="text"
                value={answers.target}
                onChange={(e) => setAnswers({ ...answers, target: e.target.value })}
                placeholder="Es: Gen Z interessata alla tecnologia..."
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                onClick={handleNext}
                disabled={!answers.target.trim()}
                className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-zinc-200 disabled:opacity-50 transition-all"
              >
                Continua
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <label className="text-sm font-medium text-zinc-300">Che "vibe" vuoi trasmettere?</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {vibes.map(v => (
                  <button
                    key={v}
                    onClick={() => { setAnswers({ ...answers, vibe: v }); handleNext(); }}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      answers.vibe === v ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-medium text-zinc-300">Durata desiderata</label>
                <div className="flex gap-2">
                  {['15s', '30s', '60s'].map(d => (
                    <button
                      key={d}
                      onClick={() => setAnswers({ ...answers, duration: d })}
                      className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-all ${
                        answers.duration === d ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => onComplete(answers)}
                disabled={isLoading}
                className="w-full bg-emerald-500 text-black py-4 rounded-xl font-bold hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Genera Script & Prompt Virali
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
