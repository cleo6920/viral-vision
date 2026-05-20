import React, { useState } from 'react';
import { VideoAnalysisResult } from '../types';
import { DecisionEngineReport } from './DecisionEngineReport';
import { 
  BrainCircuit, 
  Target, 
  TrendingUp, 
  Clapperboard, 
  Share2, 
  Activity,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ShieldCheck,
  Search,
  Eye,
  Info,
  Crown,
  ShieldAlert,
  Zap,
  Cpu,
  AlertTriangle,
  Scale,
  Globe,
  MessageSquare,
  XCircle,
  Video,
  Wind
} from 'lucide-react';

interface AnalysisDisplayProps {
  result: VideoAnalysisResult;
}

type TabType = 'analysis' | 'prioritization' | 'critical' | 'brain' | 'reality' | 'prompts' | 'reasoning' | 'publishing' | 'verifiable';

export function AnalysisDisplay({ result }: AnalysisDisplayProps) {
  const [activeTab, setActiveTab] = useState<TabType>('analysis');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'analysis', label: 'Core Engine', icon: <BrainCircuit className="w-4 h-4" /> },
    { id: 'prioritization', label: 'Dominance', icon: <Crown className="w-4 h-4" /> },
    { id: 'critical', label: 'Decision Engine', icon: <Scale className="w-4 h-4" /> },
    { id: 'brain', label: 'Viral Brain', icon: <Zap className="w-4 h-4" /> },
    { id: 'reality', label: 'Reality & Comments', icon: <Globe className="w-4 h-4" /> },
    { id: 'prompts', label: 'AI Prompts', icon: <Clapperboard className="w-4 h-4" /> },
    { id: 'reasoning', label: 'Analisi di Coscienza AI', icon: <Search className="w-4 h-4" /> },
    { id: 'publishing', label: 'Publishing', icon: <Share2 className="w-4 h-4" /> },
    { id: 'verifiable', label: 'Verifiable Intel', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Missing Data Log Warning */}
      {result.missingDataLog && result.missingDataLog.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4 rounded-r-lg shadow-sm">
          <div className="flex items-center mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="text-red-800 font-bold">Dati Mancanti & Giustificati</h3>
          </div>
          <div className="space-y-2">
            {result.missingDataLog.map((log, index) => (
              <div key={index} className="text-sm bg-white p-2 rounded border border-red-100 flex gap-2">
                <span className="font-semibold text-red-700 min-w-[120px]">{log.field}:</span>
                <span className="text-gray-700">{log.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex overflow-x-auto border-b bg-gray-50/50 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {activeTab === 'analysis' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BrainCircuit className="w-5 h-5 mr-2 text-blue-500" />
                Deep Understanding
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Meaning</span>
                  <p className="mt-1 text-gray-800">{result.analysisMeaning || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Intent</span>
                  <p className="mt-1 text-gray-800">{result.analysisIntent || 'N/A'}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Structure</span>
                  <p className="mt-1 text-gray-800">{result.analysisStructure || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rhythm</span>
                  <p className="mt-1 text-gray-800">{result.analysisRhythm || 'N/A'}</p>
                </div>
              </div>
            </section>

            {result.viralStructure && (
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-indigo-500" />
                  Mandatory Viral Structure
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                    <span className="text-xs font-black text-blue-700 uppercase tracking-wider block mb-2">Hook (0-1.2s)</span>
                    <p className="text-sm text-gray-800">{result.viralStructure.hook || 'N/A'}</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 shadow-sm">
                    <span className="text-xs font-black text-amber-700 uppercase tracking-wider block mb-2">Build (1.2-4s)</span>
                    <p className="text-sm text-gray-800">{result.viralStructure.build || 'N/A'}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
                    <span className="text-xs font-black text-red-700 uppercase tracking-wider block mb-2">Payoff (4-7s)</span>
                    <p className="text-sm text-gray-800">{result.viralStructure.payoff || 'N/A'}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 shadow-sm">
                    <span className="text-xs font-black text-purple-700 uppercase tracking-wider block mb-2">Loop (7-10s)</span>
                    <p className="text-sm text-gray-800">{result.viralStructure.loop || 'N/A'}</p>
                  </div>
                </div>
                {result.viralStructure.validationStatus && (
                  <div className={`mt-4 p-3 rounded-md text-sm font-medium border ${result.viralStructure.validationStatus === 'PASS' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                    <span className="font-bold">Validation Status:</span> {result.viralStructure.validationStatus}
                    {result.viralStructure.validationReason && <p className="mt-1 text-xs opacity-80">{result.viralStructure.validationReason}</p>}
                  </div>
                )}
                
                {result.viralValidation && (
                  <div className="mt-4 bg-zinc-50 rounded-xl p-4 border border-zinc-200 shadow-sm transition-all hover:bg-zinc-100/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-zinc-900 rounded-lg">
                          <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Real Viral Validator</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.viralValidation.creativeLevel && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-black uppercase border border-yellow-200">
                             <Crown className="w-2.5 h-2.5" />
                             {result.viralValidation.creativeLevel}
                          </div>
                        )}
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border ${
                          result.viralValidation.finalVerdict === 'PASS' ? 'bg-green-600 text-white border-green-700' : 
                          result.viralValidation.finalVerdict === 'WEAK_PASS' ? 'bg-yellow-500 text-white border-yellow-600' : 
                          'bg-red-600 text-white border-red-700'
                        }`}>
                          {result.viralValidation.finalVerdict === 'PASS' ? 'OK' : result.viralValidation.finalVerdict === 'WEAK_PASS' ? 'WEAK' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                       <div className="bg-white p-2 rounded-lg border border-zinc-200 flex flex-col items-center justify-center text-center">
                          <span className="block text-[8px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Semantic Diff</span>
                          <span className={`text-[10px] font-black ${result.viralValidation.phasesAreDistinct ? 'text-green-600' : 'text-red-500'}`}>{result.viralValidation.phasesAreDistinct ? "DISTINCT" : "FLAT"}</span>
                       </div>
                       <div className="bg-white p-2 rounded-lg border border-zinc-200 flex flex-col items-center justify-center text-center">
                          <span className="block text-[8px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Evolution</span>
                          <span className={`text-[10px] font-black ${result.viralValidation.hasRealEvolution ? 'text-green-600' : 'text-red-500'}`}>{result.viralValidation.hasRealEvolution ? "REAL" : "NONE"}</span>
                       </div>
                       <div className="bg-white p-2 rounded-lg border border-zinc-200 flex flex-col items-center justify-center text-center">
                          <span className="block text-[8px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Payoff</span>
                          <span className={`text-[10px] font-black uppercase ${result.viralValidation.payoffStrength === 'WEAK' ? 'text-red-500' : result.viralValidation.payoffStrength === 'STRONG' ? 'text-green-600' : 'text-yellow-600'}`}>{result.viralValidation.payoffStrength}</span>
                       </div>
                       <div className="bg-white p-2 rounded-lg border border-zinc-200 flex flex-col items-center justify-center text-center">
                          <span className="block text-[8px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Loop</span>
                          <span className={`text-[10px] font-black uppercase ${result.viralValidation.loopQuality === 'POOR' ? 'text-red-500' : 'text-green-600'}`}>{result.viralValidation.loopQuality}</span>
                       </div>
                    </div>

                    {result.viralValidation.issues && result.viralValidation.issues.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50/50 rounded-xl border border-red-100">
                        <div className="flex items-center gap-2 mb-2 text-red-700">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Identified Issues</span>
                        </div>
                        <ul className="space-y-1">
                          {result.viralValidation.issues.map((issue, idx) => (
                            <li key={idx} className="text-[11px] text-red-600 font-medium flex items-start gap-1.5 leading-tight">
                              <span className="mt-1 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.viralValidation.retryInstructions && result.viralValidation.finalVerdict !== 'PASS' && (
                      <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-2 mb-2 text-indigo-700">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Retry Strategy</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <span className="block text-[9px] font-bold text-indigo-400 uppercase">Actionable Fix</span>
                            <p className="text-[11px] text-zinc-600 font-medium leading-relaxed italic">"{result.viralValidation.retryInstructions.fix}"</p>
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[9px] font-bold text-indigo-400 uppercase">Creative Target</span>
                            <p className="text-[11px] text-zinc-600 font-medium leading-relaxed italic">"{result.viralValidation.retryInstructions.target}"</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {result.modelRouting && (
                  <div className="mt-6 border-t border-zinc-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-bold text-gray-900">AI Routing Report</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${result.modelRouting.fallbackTriggered ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {result.modelRouting.fallbackTriggered ? 'Fallback Active' : 'Optimal Path'}
                        </span>
                        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${result.modelRouting.proAvailable ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {result.modelRouting.proAvailable ? (
                            <>
                              <Zap className="w-3 h-3 fill-current" />
                              Pro Available
                            </>
                          ) : 'Pro Locked'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {result.modelRouting.steps.map((step, idx) => (
                        <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition-all ${step.status === 'fallback' ? 'bg-orange-50/50 border-orange-200 shadow-sm' : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{step.step}</span>
                              {step.status === 'fallback' && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                                  <ShieldAlert className="w-2.5 h-2.5" />
                                  FALLBACK
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-zinc-900 truncate">{step.reason}</h4>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className={`text-xs font-black uppercase tracking-tighter ${step.model === 'pro' ? 'text-blue-600' : 'text-zinc-500'}`}>
                              {step.model === 'pro' ? 'Gemini Pro' : 'Gemini Flash'}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium">{step.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <span className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Routing Confidence</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-black uppercase tracking-tight ${result.modelRouting.confidence === 'high' ? 'text-indigo-700' : result.modelRouting.confidence === 'medium' ? 'text-orange-700' : 'text-red-700'}`}>
                            {result.modelRouting.confidence}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map((star) => {
                              const conf = result.modelRouting.confidence;
                              const filled = (conf === 'high') || (conf === 'medium' && star <= 2) || (conf === 'low' && star <= 1);
                              return (
                                <div key={star} className={`w-1.5 h-3 rounded-sm ${filled ? 'bg-indigo-500' : 'bg-indigo-200'}`} />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-zinc-900 rounded-xl flex items-center justify-between">
                         <div>
                          <span className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Pro Utilization</span>
                          <span className="text-lg font-black text-white italic">{result.modelRouting.attempts}</span>
                         </div>
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${result.modelRouting.usedPro ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-zinc-800'}`}>
                           <Crown className={`w-4 h-4 ${result.modelRouting.usedPro ? 'text-white' : 'text-zinc-600'}`} />
                         </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scene Breakdown</h3>
              <div className="space-y-3">
                {result.analysisScenes?.map((scene, idx) => (
                  <div key={idx} className="flex gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-shrink-0 w-16 text-sm font-mono text-blue-600 bg-blue-50 rounded px-2 py-1 h-fit text-center">
                      {scene.timestamp}
                    </div>
                    <div>
                      <p className="text-gray-800">{scene.description}</p>
                      <span className="inline-block mt-2 text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                        Emotion: {scene.emotion}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Viral Triggers Detected</h3>
              <div className="flex flex-wrap gap-2">
                {result.analysisViralTriggers?.map((trigger, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full text-sm font-medium border border-orange-200">
                    {trigger}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'prioritization' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                Context-Aware Dominance System
              </h3>
              
              {/* Step 1 & 2: Classification and Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 shadow-sm">
                  <div className="flex items-center space-x-2 border-b border-purple-200 pb-3 mb-3">
                    <Search className="w-5 h-5 text-purple-600" />
                    <h4 className="text-sm font-bold text-purple-800 uppercase tracking-wider">Step 1: Content Classification</h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-bold text-purple-700 uppercase">Detected Type:</span>
                      <p className="text-lg font-black text-purple-900 uppercase tracking-tighter">{result.promptPrioritization.contentType}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-purple-700 uppercase">Reasoning:</span>
                      <p className="text-sm text-purple-800">{result.promptPrioritization.typeReasoning}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-purple-700 uppercase">Signals:</span>
                      <ul className="list-disc list-inside text-sm text-purple-800 mt-1">
                        {result.promptPrioritization.signals.map((signal, idx) => (
                          <li key={idx}>{signal}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-5 rounded-xl border border-yellow-200 shadow-sm">
                  <div className="flex items-center space-x-2 border-b border-yellow-200 pb-3 mb-3">
                    <Target className="w-5 h-5 text-yellow-600" />
                    <h4 className="text-sm font-bold text-yellow-800 uppercase tracking-wider">Step 2: Dominant Selection</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-yellow-100 p-3 rounded-lg border border-yellow-300">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-yellow-800 uppercase">Selected Dominant Element</span>
                        <span className="text-[10px] bg-yellow-300 text-yellow-900 px-2 py-0.5 rounded font-black">SOVEREIGN</span>
                      </div>
                      <p className="text-xl font-black text-yellow-900 uppercase tracking-tighter">{result.promptPrioritization.selectedElement}</p>
                      <p className="text-sm text-yellow-800 mt-2">{result.promptPrioritization.selectionReasoning}</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded-lg border border-yellow-200">
                      <span className="text-xs font-bold text-slate-500 uppercase">Rejected Elements:</span>
                      <p className="text-sm text-slate-600 font-medium">{result.promptPrioritization.rejectedElements.join(', ')}</p>
                      <p className="text-xs text-slate-500 mt-1 italic">{result.promptPrioritization.rejectionReasoning}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 & 4: Hierarchy and Sacrifice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center">
                    <BrainCircuit className="w-4 h-4 mr-2 text-slate-600" />
                    Step 3: Dominance Hierarchy
                  </h4>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Primary (Absolute Dominance)</span>
                    </div>
                    <p className="text-sm text-red-900 font-medium">{result.promptPrioritization.primary}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 shadow-sm">
                    <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">Secondary (Supportive Only)</span>
                    <p className="mt-1 text-sm text-orange-900">{result.promptPrioritization.secondary}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suppressed (Aggressive Reduction)</span>
                      <ShieldAlert className="w-3 h-3 text-red-500" />
                    </div>
                    <p className="text-sm text-slate-300 italic">{result.promptPrioritization.suppressed}</p>
                  </div>
                </div>

                <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm space-y-6">
                  <div className="flex items-center space-x-2 border-b border-red-200 pb-2">
                    <Zap className="w-5 h-5 text-red-600" />
                    <h4 className="text-sm font-bold text-red-800 uppercase tracking-wider">Step 4: Sacrifice Logic</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-white/80 p-4 rounded-lg border border-red-100 shadow-sm">
                      <h5 className="text-[10px] font-black text-red-600 uppercase mb-1">What was sacrificed?</h5>
                      <p className="text-sm text-slate-800 font-medium">{result.promptPrioritization.whatIsSacrificed}</p>
                    </div>
                    
                    <div className="bg-white/80 p-4 rounded-lg border border-red-100 shadow-sm">
                      <h5 className="text-[10px] font-black text-purple-600 uppercase mb-1">Why? (Dominance Enforcement)</h5>
                      <p className="text-sm text-slate-800">{result.promptPrioritization.whyReduced}</p>
                    </div>
                    
                    <div className="bg-white/80 p-4 rounded-lg border border-red-100 shadow-sm">
                      <h5 className="text-[10px] font-black text-green-600 uppercase mb-1">Final Output Quality Gain</h5>
                      <p className="text-sm text-slate-800 font-bold">{result.promptPrioritization.qualityImprovement}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center space-x-2 text-[10px] text-red-600 font-black uppercase bg-red-100 p-2 rounded">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Zero-Balance Policy Enforced</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'critical' && (
          <DecisionEngineReport data={result as any} />
        )}

        {activeTab === 'brain' && (
          <div className="space-y-8">
            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-gray-900 flex items-center uppercase tracking-tighter">
                  <Zap className="w-6 h-6 mr-2 text-yellow-500 fill-yellow-500" />
                  Viral Brain: Narrative Evolution
                </h3>
                {result.viralBrain && (
                  <div className={`flex items-center gap-2 px-4 py-2 border rounded-full font-black text-sm uppercase tracking-widest shadow-sm ${
                    result.viralBrain.finalVerdict === 'PASS' 
                      ? 'bg-green-50 border-green-200 text-green-700' 
                      : result.viralBrain.finalVerdict === 'WEAK_PASS'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {result.viralBrain.finalVerdict === 'PASS' && <CheckCircle2 className="w-4 h-4" />}
                    {result.viralBrain.finalVerdict === 'WEAK_PASS' && <AlertCircle className="w-4 h-4" />}
                    {result.viralBrain.finalVerdict === 'FAIL' && <XCircle className="w-4 h-4" />}
                    Verdict: {result.viralBrain.finalVerdict}
                  </div>
                )}
              </div>

              {!result.viralBrain ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                  <BrainCircuit className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium tracking-tight">Viral Brain analysis data not available for this run.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Quality Indicators */}
                  <div className="space-y-4">
                    <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Mandatory State Checks</h4>
                      
                      {/* State Change */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">State Evolution (Start ≠ End)</span>
                          <p className="text-xs text-slate-500 mt-1">{result.viralBrain.stateChange.description}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                          result.viralBrain.stateChange.detected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {result.viralBrain.stateChange.detected ? 'PASS' : 'FAIL'}
                        </span>
                      </div>

                      {/* Payoff Strength */}
                      <div className="flex items-start justify-between border-t pt-3">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Visual Payoff Event</span>
                          <p className="text-xs text-slate-500 mt-1">{result.viralBrain.payoff.event}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                          result.viralBrain.payoff.strength === 'STRONG' ? 'bg-green-100 text-green-700' : 
                          result.viralBrain.payoff.strength === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {result.viralBrain.payoff.strength}
                        </span>
                      </div>

                      {/* Loop Quality */}
                      <div className="flex items-start justify-between border-t pt-3">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Looping Logic</span>
                          <p className="text-xs text-slate-500 mt-1">{result.viralBrain.loop.isNatural ? 'Natural cycle detected' : 'Inconsistent loop points'}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                          result.viralBrain.loop.quality === 'SEAMLESS' ? 'bg-green-100 text-green-700' : 
                          result.viralBrain.loop.quality === 'VALID' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {result.viralBrain.loop.quality}
                        </span>
                      </div>

                      {/* Micro Activation */}
                      <div className="flex items-start justify-between border-t pt-3">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Micro-Activation (Static/Persona)</span>
                          <p className="text-xs text-slate-500 mt-1">{result.viralBrain.microActivation.type || 'None'}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                          result.viralBrain.microActivation.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {result.viralBrain.microActivation.present ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-inner">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Creative Intelligence</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${
                          result.viralBrain.creativeDepth === 'high' ? 'bg-purple-500 text-white' : 
                          result.viralBrain.creativeDepth === 'medium' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}>
                          Depth: {result.viralBrain.creativeDepth}
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Hook Source Classification</span>
                          <div className={`mt-2 p-2 rounded border text-xs font-mono text-center uppercase tracking-widest ${
                            result.viralBrain.hookSource === 'ENVIRONMENT' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
                          }`}>
                            {result.viralBrain.hookSource} {result.viralBrain.hookSource === 'ENVIRONMENT' ? '(INVALID)' : '(VALID)'}
                          </div>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Phase Integrity (Hook ≠ Build ≠ Payoff)</span>
                          <div className={`mt-2 p-3 rounded-xl border text-xs leading-relaxed ${
                            result.viralBrain.phaseCheck.distinct ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-100' : 'bg-red-500/5 border-red-500/10 text-red-100'
                          }`}>
                            {result.viralBrain.phaseCheck.details}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Retry Logic & Issues */}
                  <div className="space-y-4">
                    {result.viralBrain.retryInstructions && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center space-x-2 text-red-600 mb-4 border-b border-red-100 pb-2">
                          <AlertTriangle className="w-5 h-5" />
                          <h4 className="font-black text-sm uppercase tracking-wider">Retry Strategy / Patch</h4>
                        </div>
                        
                        <div className="space-y-6">
                          <div>
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 block">Immediate Fix</span>
                            <p className="text-sm text-red-900 font-bold leading-tight">{result.viralBrain.retryInstructions.fix}</p>
                          </div>
                          
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Concepts to Avoid</span>
                            <p className="text-sm text-slate-700 bg-white/50 p-3 rounded-lg border border-red-100 italic">"{result.viralBrain.retryInstructions.avoid}"</p>
                          </div>
                          
                          <div>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Target Goal (Elite)</span>
                            <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                              <Crown className="w-4 h-4 text-indigo-500" />
                              <p className="text-sm text-indigo-900 font-black">{result.viralBrain.retryInstructions.target}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-white border rounded-2xl p-5 shadow-sm">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-2">System Routing Info</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Validator Tier</span>
                          <span className="text-slate-900 font-bold uppercase">{result.modelRouting?.validator || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Hybrid Check</span>
                          <span className="text-slate-900 font-bold uppercase">{result.modelRouting?.usedPro ? 'PRO JUDGE ACTIVE' : 'FLASH ONLY'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Confidence Score</span>
                          <span className="text-slate-900 font-bold uppercase">{result.modelRouting?.confidence || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Translation Engine Result */}
                  {result.translation && (
                    <div className="md:col-span-2 mt-4">
                      <div className="bg-blue-900 border border-blue-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Video className="w-24 h-24 text-white" />
                        </div>
                        
                        <div className="flex items-center space-x-2 text-blue-300 mb-4 border-b border-blue-800 pb-2 relative z-10">
                          <Wind className="w-5 h-5" />
                          <h4 className="font-black text-sm uppercase tracking-wider">Static-to-Video Translation Engine</h4>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
                          <div className="lg:col-span-2 space-y-4">
                            <div>
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 block">Generated Micro-Scene</span>
                              <p className="text-sm text-blue-50 leading-relaxed font-medium">
                                {result.translation.microScene}
                              </p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {result.translation.movableElements.map((el, idx) => (
                                <span key={idx} className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-[10px] font-bold text-blue-200">
                                  {el}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="bg-blue-950/50 rounded-xl p-4 border border-blue-800 space-y-3">
                            <div>
                              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Activation Strategy</span>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-blue-100 font-bold uppercase">{result.microActivationStrategy?.type}</span>
                                <span className="text-[9px] px-1.5 py-0.5 bg-blue-400 text-blue-950 rounded font-black uppercase">Intensity: {result.microActivationStrategy?.intensity}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-blue-800 pt-2">
                              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Loop Policy</span>
                              <span className="text-[10px] text-blue-200 font-bold uppercase">{result.translation.loopType}</span>
                            </div>

                            <div className="flex items-center justify-between border-t border-blue-800 pt-2">
                              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Complexity</span>
                              <span className="text-[10px] text-blue-200 font-bold uppercase">{result.translation.complexity}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'reality' && (
          <div className="space-y-8">
            {result.realityMode && (
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-blue-600" />
                  Reality Validation
                </h3>
                
                {result.realityMode === 'NO_DATA_MODE' ? (
                  <div className="bg-slate-100 p-6 rounded-xl border border-slate-300 flex items-center justify-center text-center">
                    <div>
                      <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider text-sm mb-2">No Verified Data</h4>
                      <p className="text-sm text-slate-600">{result.realityNoDataMessage || "This analysis cannot be validated with real data."}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-5 rounded-xl border shadow-sm mb-6">
                      <div className="flex justify-between items-center border-b pb-3 mb-4">
                        <h4 className="font-bold text-gray-800 uppercase tracking-wider text-sm">Detection Result</h4>
                        <span className={`px-3 py-1 rounded text-xs font-bold ${
                          result.realityDetection === 'REAL VIRAL' ? 'bg-green-100 text-green-800' :
                          result.realityDetection === 'FAKE VIRAL' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {result.realityDetection}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{result.realityDetectionReasoning}</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-800 uppercase tracking-wider text-sm">Comparable Patterns</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {result.realityComparablePatterns.map((pattern, idx) => (
                          <div key={idx} className={`p-4 rounded-lg border ${pattern.isFakeViral ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
                            <a href={pattern.videoLink} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline mb-2 block truncate">
                              {pattern.videoLink}
                            </a>
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                              <div><span className="text-gray-500">Views:</span> <span className="font-semibold">{pattern.views.toLocaleString()}</span></div>
                              <div><span className="text-gray-500">Likes:</span> <span className="font-semibold">{pattern.likes.toLocaleString()}</span></div>
                              <div><span className="text-gray-500">Comments:</span> <span className="font-semibold">{pattern.comments.toLocaleString()}</span></div>
                              <div><span className="text-gray-500">Eng. Ratio:</span> <span className="font-semibold">{(pattern.engagementRatio * 100).toFixed(2)}%</span></div>
                            </div>
                            <div className="border-t pt-2">
                              <p className="text-xs text-gray-700">{pattern.explanation}</p>
                              {pattern.isFakeViral && (
                                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-1 rounded uppercase bg-red-100 text-red-700">
                                  FAKE VIRAL DETECTED
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}

            {result.commentMode && (
              <section className="pt-6 border-t">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-indigo-600" />
                  Comment Intelligence
                </h3>

                {result.commentMode === 'NO_DATA_MODE' ? (
                  <div className="bg-slate-100 p-6 rounded-xl border border-slate-300 flex items-center justify-center text-center">
                    <div>
                      <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                      <h4 className="font-bold text-slate-800 uppercase tracking-wider text-sm mb-2">No Verified Data</h4>
                      <p className="text-sm text-slate-600">{result.commentNoDataMessage || "This analysis cannot be validated with real data."}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-5 rounded-xl border shadow-sm mb-6">
                      <div className="flex justify-between items-center border-b pb-3 mb-4">
                        <h4 className="font-bold text-gray-800 uppercase tracking-wider text-sm">Overall Quality Level</h4>
                        <span className={`px-3 py-1 rounded text-xs font-bold ${
                          result.commentOverallQualityLevel === 'HIGH' ? 'bg-green-100 text-green-800' :
                          result.commentOverallQualityLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {result.commentOverallQualityLevel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{result.commentExplanation}</p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-bold text-gray-800 uppercase tracking-wider text-sm">Analyzed Comments</h4>
                      {result.commentAnalyzedComments.map((comment, idx) => (
                        <div key={idx} className="bg-gray-50 p-4 rounded-lg border flex flex-col md:flex-row gap-4">
                          <div className="md:w-1/3">
                            <div className="bg-white p-3 rounded border shadow-sm text-sm italic text-gray-800">
                              "{comment.comment}"
                            </div>
                          </div>
                          <div className="md:w-2/3 space-y-2">
                            <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              comment.valueCategory === 'VERY HIGH VALUE' ? 'bg-purple-100 text-purple-800' :
                              comment.valueCategory === 'HIGH VALUE' ? 'bg-green-100 text-green-800' :
                              comment.valueCategory === 'MEDIUM VALUE' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {comment.valueCategory}
                            </span>
                            <p className="text-sm text-gray-600">{comment.interpretation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        )}

        {activeTab === 'prompts' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimized Generation Prompts</h3>
            
            <div className="space-y-6">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b font-semibold text-gray-700">Sora</div>
                <div className="p-4 space-y-4">
                  <div>
                    <span className="text-xs font-bold text-gray-500 uppercase">15s Version</span>
                    <p className="mt-1 text-sm text-gray-800 font-mono bg-gray-50 p-3 rounded border">{result.promptSora15s}</p>
                  </div>
                  {result.promptSora12s && (
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase">12s Version</span>
                      <p className="mt-1 text-sm text-gray-800 font-mono bg-gray-50 p-3 rounded border">{result.promptSora12s}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b font-semibold text-gray-700">Kling</div>
                <div className="p-4">
                  <span className="text-xs font-bold text-gray-500 uppercase">15s Version</span>
                  <p className="mt-1 text-sm text-gray-800 font-mono bg-gray-50 p-3 rounded border">{result.promptKling}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b font-semibold text-gray-700">Veo</div>
                <div className="p-4">
                  <span className="text-xs font-bold text-gray-500 uppercase">8s Version</span>
                  <p className="mt-1 text-sm text-gray-800 font-mono bg-gray-50 p-3 rounded border">{result.promptVeo}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'publishing' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Anti-Scroll Titles</h3>
              <div className="space-y-2">
                {result.pubTitoliHookIt?.map((title: string, idx: number) => (
                  <div key={idx} className="p-3 bg-white border rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                    <p className="font-medium text-gray-900">{title}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scroll-Stopping Hooks</h3>
              <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                <p className="font-medium text-yellow-900">"{result.pubVideoHookIt}"</p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent-Reinforcing Description</h3>
              <div className="p-4 bg-gray-50 border rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.pubDescriptionIt}</p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'verifiable' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Eye className="w-5 h-5 mr-2 text-blue-500" />
                Fact vs. Interpretation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Observed Facts</span>
                  <ul className="mt-2 space-y-1">
                    {result.verifiableIntelligence?.observedFacts?.map((fact, i) => (
                      <li key={i} className="text-sm text-green-900 flex items-start">
                        <span className="mr-2">•</span> {fact}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Inferences</span>
                  <ul className="mt-2 space-y-1">
                    {result.verifiableIntelligence?.inferences?.map((inf, i) => (
                      <li key={i} className="text-sm text-blue-900 flex items-start">
                        <span className="mr-2">•</span> {inf}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Uncertainties</span>
                  <ul className="mt-2 space-y-1">
                    {result.verifiableIntelligence?.uncertainties?.map((unc, i) => (
                      <li key={i} className="text-sm text-amber-900 flex items-start">
                        <span className="mr-2">•</span> {unc}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-purple-500" />
                Search Validation
              </h3>
              <div className="bg-gray-50 p-5 rounded-xl border space-y-4">
                {/* Data Awareness Header */}
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block mb-1">Data Type</span>
                      <span className="text-sm font-bold text-indigo-900">{result.verifiableIntelligence?.dataType}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block mb-1">Reality Risk Level</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        result.verifiableIntelligence?.realityRiskLevel === 'LOW' ? 'bg-green-200 text-green-900' :
                        result.verifiableIntelligence?.realityRiskLevel === 'MEDIUM' ? 'bg-amber-200 text-amber-900' :
                        'bg-red-200 text-red-900'
                      }`}>
                        {result.verifiableIntelligence?.realityRiskLevel}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-indigo-700 italic mb-2">{result.verifiableIntelligence?.dataDisclaimer}</p>
                  <p className="text-xs text-indigo-800 font-medium border-t border-indigo-200 pt-2 mt-2">
                    <span className="font-bold">Risk Reasoning:</span> {result.verifiableIntelligence?.realityRiskReasoning}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Simulated Queries</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.verifiableIntelligence?.queries?.map((q, i) => (
                      <span key={i} className="px-2 py-1 bg-white border rounded text-xs font-mono text-gray-600">
                        "{q}"
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Platform References</h4>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">{result.verifiableIntelligence?.referenceDisclaimer}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.verifiableIntelligence?.references?.map((ref, i) => (
                      <div key={i} className="bg-white p-3 rounded border shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black px-1.5 py-0.5 bg-gray-900 text-white rounded">
                            {ref.platform}
                          </span>
                          <span className="text-[10px] text-blue-500 truncate max-w-[150px]">{ref.url}</span>
                        </div>
                        <p className="text-xs text-gray-700">{ref.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Humility Statement */}
                <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                  <span className="inline-flex items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <ShieldAlert className="w-3 h-3 mr-1" />
                    {result.verifiableIntelligence?.humilityStatement}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Info className="w-5 h-5 mr-2 text-indigo-500" />
                Confidence Levels
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Visual Analysis</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(result.verifiableIntelligence?.visualAnalysisScore) >= 8 ? 'bg-green-100 text-green-700' : Number(result.verifiableIntelligence?.visualAnalysisScore) >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {result.verifiableIntelligence?.visualAnalysisScore}/10
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{result.verifiableIntelligence?.visualAnalysisReason}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Audio Analysis</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(result.verifiableIntelligence?.audioAnalysisScore) >= 8 ? 'bg-green-100 text-green-700' : Number(result.verifiableIntelligence?.audioAnalysisScore) >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {result.verifiableIntelligence?.audioAnalysisScore}/10
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{result.verifiableIntelligence?.audioAnalysisReason}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Trend Validation</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(result.verifiableIntelligence?.trendValidationScore) >= 8 ? 'bg-green-100 text-green-700' : Number(result.verifiableIntelligence?.trendValidationScore) >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {result.verifiableIntelligence?.trendValidationScore}/10
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{result.verifiableIntelligence?.trendValidationReason}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Viral Prediction</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(result.verifiableIntelligence?.viralPredictionScore) >= 8 ? 'bg-green-100 text-green-700' : Number(result.verifiableIntelligence?.viralPredictionScore) >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {result.verifiableIntelligence?.viralPredictionScore}/10
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{result.verifiableIntelligence?.viralPredictionReason}</p>
                </div>
              </div>
            </section>
          </div>
        )}
        {activeTab === 'reasoning' && (
          <div className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-blue-600" />
                Prompt Decision Trace (Analisi di Coscienza)
              </h3>
              
              {!result.promptDecisionTrace ? (
                <div className="bg-slate-100 p-6 rounded-xl border border-slate-300 flex items-center justify-center text-center">
                  <div>
                    <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-sm mb-2">Traccia Non Disponibile</h4>
                    <p className="text-sm text-slate-600">Nessun Prompt Decision Trace presente nel risultato corrente.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm space-y-6 overflow-x-auto text-sm text-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* HO SENTITO */}
                    <div className="bg-white p-4 border rounded shadow-sm">
                      <h4 className="font-bold text-slate-900 mb-2 border-b pb-1 uppercase text-xs">1. Ho Sentito (Heard)</h4>
                      <ul className="space-y-1">
                         <li><span className="font-semibold">Transcript:</span> {result.promptDecisionTrace.heard?.transcriptAvailable ? "Disponibile" : "Non disponibile"}</li>
                         <li><span className="font-semibold">Testo Selezionato:</span> {result.promptDecisionTrace.heard?.selectedLine || "Nessuno"}</li>
                         <li><span className="font-semibold">Contesto Audio:</span> {result.promptDecisionTrace.heard?.audioContextDesc || "Sconosciuto"}</li>
                         <li><span className="font-semibold">Linee Rilevanti:</span> {JSON.stringify(result.promptDecisionTrace.heard?.relevantLinesFound || [])}</li>
                      </ul>
                    </div>

                    {/* HO VISTO */}
                    <div className="bg-white p-4 border rounded shadow-sm">
                      <h4 className="font-bold text-slate-900 mb-2 border-b pb-1 uppercase text-xs">2. Ho Visto (Seen)</h4>
                      <ul className="space-y-1">
                         <li><span className="font-semibold">Osservazioni Frame:</span> {typeof result.promptDecisionTrace.seen?.frameObservations === 'string' ? result.promptDecisionTrace.seen.frameObservations : JSON.stringify(result.promptDecisionTrace.seen?.frameObservations || "Non disponibile")}</li>
                         <li><span className="font-semibold">Sommario Visivo:</span> {result.promptDecisionTrace.seen?.visualSummary || "Sconosciuto"}</li>
                         <li><span className="font-semibold">Soggetti:</span> {JSON.stringify(result.promptDecisionTrace.seen?.subjectsIdentified || [])}</li>
                         <li><span className="font-semibold">Soggetto Finale Visibile:</span> {result.promptDecisionTrace.seen?.finalSubjectVisible ? "Sì" : "Visibilità non confermabile"}</li>
                         <li><span className="font-semibold">Payoff Rilevato {">"}46s:</span> {result.promptDecisionTrace.seen?.payoffDetectedAfter46s ? "Sì" : "Non confermabile"}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* HO DEDOTTO */}
                    <div className="bg-white p-4 border rounded shadow-sm">
                      <h4 className="font-bold text-slate-900 mb-2 border-b pb-1 uppercase text-xs">3. Ho Dedotto (Inferred)</h4>
                      <ul className="space-y-1">
                         <li><span className="font-semibold">Connessione Visivo/Uditivo:</span> {result.promptDecisionTrace.inferred?.connectionHeardSeen || "N/A"}</li>
                         <li><span className="font-semibold">Twist Intenzionale:</span> {result.promptDecisionTrace.inferred?.intendedTwist || "N/A"}</li>
                         <li><span className="font-semibold">Payoff Visivo Conferma:</span> {result.promptDecisionTrace.inferred?.visualPayoffConfirmed ? "Sì" : "Non confermabile"}</li>
                         <li><span className="font-semibold">Strongest Beat:</span> {result.promptDecisionTrace.inferred?.strongestBeatDetected || "N/A"}</li>
                      </ul>
                    </div>

                    {/* SCELTA E RISCHIO */}
                    <div className="bg-white p-4 border rounded shadow-sm">
                      <h4 className="font-bold text-slate-900 mb-2 border-b pb-1 uppercase text-xs">4. La Mia Scelta & Rischio</h4>
                      <ul className="space-y-1 mb-3">
                         <li><span className="font-semibold">Beat Scelto:</span> {result.promptDecisionTrace.decision?.selectedBeat || "N/A"}</li>
                         <li><span className="font-semibold">Personaggio Scelto:</span> {result.promptDecisionTrace.decision?.selectedCharacter || "N/A"}</li>
                         <li><span className="font-semibold">Perché:</span> {result.promptDecisionTrace.decision?.selectionReason || "N/A"}</li>
                         <li><span className="font-semibold">Cosa ho scartato:</span> {result.promptDecisionTrace.decision?.alternativeRejected || "N/A"}</li>
                      </ul>
                      <div className={`p-2 rounded ${result.promptDecisionTrace.risk?.confidenceInSelection === 'HIGH' ? 'bg-green-100' : result.promptDecisionTrace.risk?.confidenceInSelection === 'LOW' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                         <span className="font-bold">Rischio/Errore Possibile:</span> {result.promptDecisionTrace.risk?.possibleError || "Sconosciuto"}
                         <span className="block mt-1 font-bold">Confidence: {result.promptDecisionTrace.risk?.confidenceInSelection || "UNKNOWN"}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* NON HO VISTO E COPERTURA */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 border rounded shadow-sm">
                      <h4 className="font-bold text-slate-900 mb-2 border-b pb-1 uppercase text-xs">Cosa NON ho visto (o non confermato)</h4>
                      <pre className="text-xs text-red-700 whitespace-pre-wrap">{JSON.stringify(result.promptDecisionTrace.notSeenOrNotConfirmed || [], null, 2)}</pre>
                    </div>

                    <div className="bg-white p-4 border rounded shadow-sm">
                      <h4 className="font-bold text-slate-900 mb-2 border-b pb-1 uppercase text-xs">Copertura Frame Finali (Reale)</h4>
                      <ul className="space-y-1">
                         <li><span className="font-semibold">Provider Vision:</span> {result.promptDecisionTrace.finalFramesCoverage?.visionProviderReal || "N/A"}</li>
                         <li><span className="font-semibold">Frame Totali in Video:</span> {result.promptDecisionTrace.finalFramesCoverage?.frameCountReal ?? "N/A"}</li>
                         <li><span className="font-semibold">Frame Analizzati:</span> {result.promptDecisionTrace.finalFramesCoverage?.usedFramesReal ?? "N/A"}</li>
                         <li><span className="font-semibold">Frame dopo i 46s:</span> {result.promptDecisionTrace.finalFramesCoverage?.framesAfter46s ?? "N/A"}</li>
                         <li><span className="font-semibold">Timestamps {">"}46s:</span> {JSON.stringify(result.promptDecisionTrace.finalFramesCoverage?.timestampsAfter46s || [])}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <h4 className="font-bold text-slate-900 mb-2 uppercase text-xs">JSON Raw Completo</h4>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto">
                      {JSON.stringify(result.promptDecisionTrace, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

      </div>
    </div>
  );
}
