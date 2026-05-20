
import React, { useState, useEffect } from 'react';
import { 
  runContentHierarchyReasoner 
} from '../services/gemini/generation';
import {
  runPrimaryPurposeLock, 
  runFunctionalRoleLock, 
  runIdeaAnchorLock, 
  runFinalViralAnalysis,
  runCoreIntentClassifier,
  runTransformationEngine
} from '../services/gemini/analysis';
import { resetRuntimeProviderState } from '../services/gemini/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, CheckCircle2, XCircle, ShieldCheck, Anchor, Zap, AlertTriangle, Play, Loader2, BrainCircuit, RefreshCw, Trash2, Wand2 } from 'lucide-react';

interface TestResult {
  name: string;
  description: string;
  hierarchy: any;
  purposeLock: any;
  functionalLock: any;
  ideaAnchor: any;
  finalOutput: any;
  coreIntent: any;
  transformation: any;
}

export function LockValidationTests() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState("");
  const [currentStep, setCurrentStep] = useState("");
  const [testStats, setTestStats] = useState({ current: 0, total: 3 });

  // Load results from localStorage on mount
  useEffect(() => {
    const savedResults = localStorage.getItem('lock_validation_results');
    if (savedResults) {
      try {
        setResults(JSON.parse(savedResults));
      } catch (e) {
        console.error("Failed to parse saved results", e);
      }
    }
  }, []);

  // Save results to localStorage whenever they change
  useEffect(() => {
    if (results.length > 0) {
      localStorage.setItem('lock_validation_results', JSON.stringify(results));
    }
  }, [results]);

  const resetResults = () => {
    if (window.confirm("Sei sicuro di voler eliminare tutti i risultati salvati?")) {
      setResults([]);
      localStorage.removeItem('lock_validation_results');
      resetRuntimeProviderState();
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);
    const apiKey = ""; 

    const testCases = [
      {
        name: "EVENTO REALE (CANNETO)",
        description: "Video di un canneto millenario mosso dal vento in una riserva naturale. In primo piano su un ramo ci sono delle piume blu elettrico artificiali (accessorio curioso). L'obiettivo è mostrare la biodiversità del luogo.",
        genre: "documentary"
      },
      {
        name: "PRODOTTO (TONNO)",
        description: "Una lattina di tonno aperta su un tagliere di legno. In sottofondo un gatto guarda incuriosito. La luce del tramonto evidenzia le particelle di polvere che danzano nell'aria. Il prodotto deve essere il re della scena.",
        genre: "commercial"
      },
      {
        name: "PERSONA (ARTIGIANO)",
        description: "Un anziano artigiano che incide il legno con pazienza. Indossa un orologio d'oro molto vistoso che brilla ad ogni movimento della mano. Il focus deve restare sulla sua maestria e sul volto espressivo.",
        genre: "biography"
      }
    ];

    const newResults: TestResult[] = [];
    setTestStats({ current: 0, total: testCases.length });

    for (let index = 0; index < testCases.length; index++) {
      const test = testCases[index];
      setCurrentTest(test.name);
      setTestStats(prev => ({ ...prev, current: index + 1 }));

      try {
        const parts = [{ text: test.description }];
        
        setCurrentStep("Classificazione Intento (Persona/Prodotto/Evento)...");
        const coreIntent = await runCoreIntentClassifier(parts, apiKey);

        setCurrentStep("Analisi Gerarchica...");
        const hierarchy = await runContentHierarchyReasoner(parts, apiKey);
        
        setCurrentStep("Primary Purpose Lock...");
        const purposeLock = await runPrimaryPurposeLock(apiKey, hierarchy);
        
        setCurrentStep("Functional Role Lock...");
        const functionalLock = await runFunctionalRoleLock(apiKey, hierarchy, purposeLock);
        
        setCurrentStep("Idea Anchor Lock...");
        const ideaAnchor = await runIdeaAnchorLock(apiKey, hierarchy, purposeLock, functionalLock);

        setCurrentStep("Transformation Engine (Static -> Active)...");
        const transformation = await runTransformationEngine(apiKey, coreIntent, hierarchy, 'STATIC_IMAGE');
        
        setCurrentStep("Final Viral Analysis & Formatting...");
        const finalOutput = await runFinalViralAnalysis(
          { prompt: test.description }, 
          apiKey, 
          test.genre, 
          'flash', 
          undefined, 
          undefined, 
          undefined, 
          hierarchy, 
          purposeLock, 
          functionalLock, 
          ideaAnchor,
          coreIntent
        );

        newResults.push({
          name: test.name,
          description: test.description,
          hierarchy,
          purposeLock,
          functionalLock,
          ideaAnchor,
          finalOutput,
          coreIntent,
          transformation
        });
      } catch (e) {
        console.error(`Test ${test.name} failed`, e);
      }
    }

    setResults(newResults);
    setIsRunning(false);
    setCurrentTest("");
    setCurrentStep("");
  };

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Beaker className="text-purple-400" /> Practical Lock Validation
            </h1>
            <p className="text-zinc-400 mt-2 italic">Verifica dello stress-test dei layer di protezione (Purpose, Functional, Anchor)</p>
          </div>
          <div className="flex items-center gap-3">
            {results.length > 0 && !isRunning && (
              <button 
                onClick={resetResults}
                className="px-4 py-3 bg-zinc-900 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-xl font-bold flex items-center gap-2 border border-white/5 transition-all"
              >
                <Trash2 className="w-5 h-5" /> Reset
              </button>
            )}
            <button 
              onClick={runAllTests}
              disabled={isRunning}
              className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                isRunning ? 'bg-zinc-800 text-zinc-500' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
              }`}
            >
              {isRunning ? (
                <><Loader2 className="animate-spin w-5 h-5" /> In esecuzione</>
              ) : (
                <>{results.length > 0 ? <RefreshCw className="w-5 h-5" /> : <Play className="w-5 h-5" />} {results.length > 0 ? 'Riesegui Test' : 'Esegui Suite di Test'}</>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-12">
          {isRunning && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-8 text-center space-y-6"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                   <div className="w-20 h-20 border-4 border-zinc-800 border-t-purple-500 rounded-full animate-spin" />
                   <Beaker className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Stress-Test in Corso</h3>
                   <p className="text-zinc-400 text-sm mt-1">Esecuzione dei layer di protezione su scenari complessi</p>
                </div>
              </div>

              <div className="max-w-md mx-auto space-y-3">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <span>Progresso Test</span>
                    <span className="text-purple-400">{testStats.current} / {testStats.total}</span>
                 </div>
                 <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(testStats.current / testStats.total) * 100}%` }}
                    />
                 </div>
                 <div className="flex items-center justify-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-zinc-300 italic">
                       {currentTest}: <span className="text-purple-400">{currentStep}</span>
                    </span>
                 </div>
              </div>

              <div className="flex justify-center gap-4 text-[10px] uppercase font-black tracking-[0.2em] text-zinc-600">
                 <span className={currentStep.includes("Intento") || testStats.current > 0 ? 'text-purple-500' : ''}>Intent</span>
                 <span className="opacity-30">•</span>
                 <span className={currentStep.includes("Gerarchica") || testStats.current > 0 ? 'text-purple-500' : ''}>Hierarchy</span>
                 <span className="opacity-30">•</span>
                 <span className={currentStep.includes("Purpose") || testStats.current > 0 ? 'text-purple-500' : ''}>Purpose</span>
                 <span className="opacity-30">•</span>
                 <span className={currentStep.includes("Functional") || testStats.current > 0 ? 'text-purple-500' : ''}>Functional</span>
                 <span className="opacity-30">•</span>
                 <span className={currentStep.includes("Anchor") || testStats.current > 0 ? 'text-purple-500' : ''}>Anchor</span>
                 <span className="opacity-30">•</span>
                 <span className={currentStep.includes("Transformation") || testStats.current > 0 ? 'text-purple-500' : ''}>Transformation</span>
                 <span className="opacity-30">•</span>
                 <span className={currentStep.includes("Final") || testStats.current > 0 ? 'text-purple-500' : ''}>Dominance</span>
              </div>
            </motion.div>
          )}

          {results.map((res, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="border border-white/10 rounded-3xl overflow-hidden bg-white/5 backdrop-blur-md"
            >
              <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{res.name}</h2>
                  <p className="text-xs text-zinc-400 mt-1">{res.description}</p>
                </div>
                <div className="flex items-center gap-2">
                   <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold rounded-full">
                      Hierarchy Validated
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 p-6">
                {/* 0. INTENT */}
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-amber-500/10">
                   <div className="flex items-center gap-2 mb-3">
                      <BrainCircuit className="w-4 h-4 text-amber-400" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Core Intent</span>
                   </div>
                   <div className="space-y-2">
                      <div className={`text-xs font-black italic tracking-tighter text-amber-400`}>
                         {res.coreIntent?.coreIntent || "N/A"}
                      </div>
                      <div className="text-[10px] text-zinc-500 leading-tight line-clamp-2">
                         {res.coreIntent?.reasoning}
                      </div>
                   </div>
                </div>

                {/* 1. PURPOSE */}
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Purpose Lock</span>
                   </div>
                   <div className="space-y-2">
                      <div className="text-[10px] text-zinc-500">Core Subject: {res.hierarchy.primarySubject}</div>
                      <div className="text-[10px] font-bold text-orange-400 uppercase">Forbidden: {res.purposeLock.elementsClassification?.filter((e:any) => e.role === 'DECORATION').map((e:any)=>e.element).join(", ")}</div>
                   </div>
                </div>

                {/* 2. FUNCTIONAL */}
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-purple-400" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Functional Lock</span>
                   </div>
                   <div className="space-y-2">
                      <div className="text-[10px] text-zinc-500">Emotion: {res.functionalLock.primaryEmotion}</div>
                      <div className={`text-[10px] px-1 rounded inline-block ${res.functionalLock.lockStatus === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>
                         {res.functionalLock.lockStatus}
                      </div>
                   </div>
                </div>

                {/* 3. ANCHOR */}
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2 mb-3">
                      <Anchor className="w-4 h-4 text-indigo-400" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Idea Anchor</span>
                   </div>
                   <div className="space-y-2">
                      <div className="text-[10px] text-zinc-500 italic block leading-tight">"{res.ideaAnchor.centralIdea}"</div>
                      <div className="text-[10px] text-zinc-500">Source: {res.ideaAnchor.anchorSource}</div>
                   </div>
                </div>

                {/* 4. TRANSFORMATION */}
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5 bg-gradient-to-br from-purple-500/5 to-transparent">
                   <div className="flex items-center gap-2 mb-3">
                      <Wand2 className="w-4 h-4 text-pink-400" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Transformation</span>
                   </div>
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold text-pink-300 italic">{res.transformation?.activationType}</div>
                      <div className="text-[9px] text-zinc-400 leading-tight">"{res.transformation?.microScene}"</div>
                   </div>
                </div>

                {/* 5. DOMINANCE */}
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2 mb-3">
                      {res.finalOutput.dominanceCheck?.pass ? (
                         <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                         <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Dominance Final</span>
                   </div>
                   <div className="text-[10px] text-zinc-500">
                      {res.finalOutput.dominanceCheck?.reason || "Check Passed"}
                   </div>
                </div>
              </div>

              {/* GENERATED CONTENT */}
              <div className="p-6 bg-zinc-900/30">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                       <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 block mb-2">Selected Event & Title</span>
                       <div className="p-4 bg-black/40 border border-white/5 rounded-xl">
                          <div className="text-indigo-400 text-xs font-bold mb-1 uppercase tracking-wider">{res.finalOutput.selectedEvent}</div>
                          <div className="text-lg font-bold text-white mb-2">{res.finalOutput.pubTitleIt}</div>
                          <div className="text-sm text-emerald-300 font-medium italic">Hook: "{res.finalOutput.pubVideoHookIt || res.finalOutput.hook}"</div>
                       </div>
                    </div>
                    <div>
                       <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 block mb-2">Production Script</span>
                       <div className="p-4 bg-black/40 border border-white/5 rounded-xl text-xs text-zinc-300 leading-relaxed max-h-[150px] overflow-y-auto">
                          {res.finalOutput.script}
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          ))}
        </div>

        {results.length === 0 && !isRunning && (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/5 rounded-3xl opacity-50">
            <Beaker className="w-12 h-12 mb-4" />
            <p className="text-sm">Nessun test eseguito. Clicca sul pulsante in alto per iniziare.</p>
          </div>
        )}
      </div>
    </div>
  );
}
