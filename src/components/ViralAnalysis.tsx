import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Terminal, Share2, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import type { ResultData } from '../types';

interface ViralAnalysisProps {
  analysis: string;
  isLoading: boolean;
  resultData?: ResultData | null;
}

export const ViralAnalysis: React.FC<ViralAnalysisProps> = ({ analysis, isLoading, resultData }) => {
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-12 space-y-6">
        <div className="flex items-center justify-center gap-4 py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-12 h-12 text-primary" />
          </motion.div>
          <h2 className="text-3xl font-black tracking-tighter italic uppercase">Analisi in corso...</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-pulse">
              <div className="h-48 bg-muted rounded-t-xl" />
              <div className="p-6 space-y-3">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto mt-12 pb-24"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black">
          <TrendingUp className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-4xl font-black tracking-tighter italic uppercase">Report Virale</h2>
      </div>

      <div className="prose prose-invert max-w-none">
        <div className="grid grid-cols-1 gap-8">
          <Card className="border-4 border-black bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="w-32 h-32" />
            </div>
            <CardHeader className="border-b-4 border-black bg-primary/5">
              <CardTitle className="flex items-center justify-between text-black uppercase tracking-widest font-black text-sm italic">
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Analisi Strategica
                </span>
                {resultData?.validationTrace && (
                  <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${resultData.validationTrace.structuralFailTriggered ? 'bg-red-500/20 text-red-600' : 'bg-emerald-500/20 text-emerald-600'}`}>
                    <Activity className="w-3 h-3" />
                    TRACE: {resultData.validationTrace.structuralFailTriggered ? `FAIL (${resultData.validationTrace.regenerationCount} retries)` : 'PASS (1st try)'}
                  </span>
                )}
                {resultData?.viralAudit && (
                  <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${resultData.viralAudit.enforcementPass ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'}`}>
                    <Activity className="w-3 h-3" />
                    ENFORCEMENT: {resultData.viralAudit.enforcementPass ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {resultData?.validationTrace && resultData.validationTrace.structuralFailTriggered && (
                <div className="mb-6 p-4 bg-amber-500/10 border-l-4 border-amber-500 text-amber-900 rounded-r-lg text-xs">
                  <strong>⚠️ Intervento Strutturale Fail-Safe:</strong> L'Agente aveva generato un output promozionale o debole, intercettato dal Trace Engine.
                  <br/><em>Motivo:</em> {resultData.validationTrace.reason}
                  <br/><em>Tentativi:</em> {resultData.validationTrace.regenerationCount}
                </div>
              )}
              {resultData?.eventQualitySelector && (
                <div className="mb-6 p-4 bg-blue-500/10 border-l-4 border-blue-500 text-blue-900 rounded-r-lg text-xs font-mono">
                  <strong>🧠 Event Quality Selector:</strong>
                  <ul className="mt-2 space-y-1 list-disc pl-4">
                    <li><em>Candidate 1:</em> {resultData.eventQualitySelector.candidate1}</li>
                    <li><em>Candidate 2:</em> {resultData.eventQualitySelector.candidate2}</li>
                    <li><em>Candidate 3:</em> {resultData.eventQualitySelector.candidate3}</li>
                  </ul>
                  <div className="mt-2 text-blue-800"><em>Eval:</em> {resultData.eventQualitySelector.evaluation}</div>
                  <div className="mt-1 font-bold">🎯 Winner: {resultData.eventQualitySelector.selectedEvent}</div>
                </div>
              )}
              {resultData?.sourceAnchor && (
                <div className={`mb-6 p-4 border-l-4 rounded-r-lg text-xs flex flex-col gap-2 ${!resultData.sourceAnchor.isAligned ? 'bg-red-500/10 border-red-500 text-red-900' : 'bg-green-500/10 border-green-500 text-green-900'}`}>
                   <div>
                     <strong>{!resultData.sourceAnchor.isAligned ? '🔗 SOURCE LINK BROKEN (Narrativa inventata / Azioni introdotte)' : '🔗 SOURCE LINK ALIGNED (Fedeltà rispettata)'}</strong>
                   </div>
                   <div><em>Motivazione:</em> {resultData.sourceAnchor.reason}</div>
                   {resultData.sourceAnchor.alternativeGenerated && (
                     <div className="font-bold">⚠️ Generazione doppio prompt forzata (Source-aligned + Alternative Event-driven)</div>
                   )}
                </div>
              )}
              <div className="markdown-body text-lg leading-relaxed text-black">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 justify-center">
        <Button size="lg" className="rounded-full px-8 font-black uppercase tracking-wider border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all">
          <Share2 className="mr-2 w-5 h-5" />
          Copia Strategia
        </Button>
      </div>
    </motion.div>
  );
};
