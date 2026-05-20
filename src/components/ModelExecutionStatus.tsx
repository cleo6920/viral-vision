import React from 'react';
import { Brain, Zap } from 'lucide-react';
import { ModelUsageTrace } from '../types';

export const ModelExecutionStatus: React.FC<{ trace: ModelUsageTrace }> = ({ trace }) => {
  if (!trace || !trace.entries || trace.entries.length === 0) return null;

  const getTierLabel = (entry: ModelUsageTrace["entries"][number]) => {
    const model = (entry.modelId || entry.modelName || "").toLowerCase();
    return model.includes('pro') ? 'PRO' : 'FLASH';
  };

  return (
    <div className="bg-zinc-900/50 rounded-xl p-4 mt-6 border border-zinc-800">
      <h3 className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-wider flex items-center gap-2">
        <Brain className="w-4 h-4 text-purple-400" />
        Model Execution Trace {trace.fidelity === 'DEGRADED' && <span className="text-yellow-500 text-[10px] ml-2">(DEGRADED)</span>}
      </h3>
      <div className="space-y-2 border-l border-zinc-800 ml-2 pl-4">
        {trace.entries.map((entry, index) => (
          <div key={index} className="flex flex-col gap-1 relative">
            <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-zinc-700"></div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${getTierLabel(entry) === 'FLASH' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-purple-500/20 text-purple-400'}`}>
                {getTierLabel(entry)}
              </span>
              <span className="text-xs text-zinc-300 font-medium">{entry.taskContext}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
              <span>richiesto: <span className="text-zinc-300">{(entry.planned || '').toUpperCase() || '-'}</span></span>
              <span>finale: <span className="text-zinc-300">{entry.modelId || entry.modelName || '-'}</span></span>
              <span>fallback: <span className={entry.fallback ? "text-yellow-400" : "text-emerald-400"}>{entry.fallback ? "sì" : "no"}</span></span>
              <span>chiave: <span className="text-zinc-300">{entry.keyLabel || '-'}</span></span>
            </div>
            {(entry.requestedModelId || entry.fallbackReason || entry.keySource) && (
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
                {entry.requestedModelId && <span>modello richiesto: {entry.requestedModelId}</span>}
                {entry.fallbackReason && <span>motivo fallback: {entry.fallbackReason}</span>}
                {entry.keySource && <span>sorgente chiave: {entry.keySource}</span>}
              </div>
            )}
            {entry.tokensUsed && (
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <Zap className="w-3 h-3 text-zinc-600" /> {entry.tokensUsed} tokens
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
