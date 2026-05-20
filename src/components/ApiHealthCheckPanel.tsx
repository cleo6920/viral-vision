import React, { useState, useEffect } from 'react';
import { runAllKeysHealthCheck, HealthCheckResult } from '../services/ai/healthCheck';
import { Settings2, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Zap, ServerCrash } from 'lucide-react';

interface ApiHealthCheckPanelProps {
  youtubeApiKey?: string;
}

export function ApiHealthCheckPanel({ youtubeApiKey }: ApiHealthCheckPanelProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<HealthCheckResult[] | null>(null);

  useEffect(() => {
    const handleReset = () => {
      setResults(null);
      setIsTesting(false);
    };
    window.addEventListener('provider-runtime-state-reset', handleReset);
    return () => window.removeEventListener('provider-runtime-state-reset', handleReset);
  }, []);

  const handleTestKeys = async () => {
    setIsTesting(true);
    try {
      const res = await runAllKeysHealthCheck(youtubeApiKey);
      setResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = (status: HealthCheckResult['status']) => {
    switch (status) {
      case 'OK': 
      case 'GEMINI_PARTIAL_OK':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'RATE_LIMIT':
      case 'QUOTA_EXCEEDED':
      case 'QUOTA_DEPLETED':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'MISSING_KEY':
        return <AlertCircle className="w-4 h-4 text-zinc-500" />;
      case 'PARSER_ERROR':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Stato Chiavi API</h3>
        </div>
        <button
          onClick={handleTestKeys}
          disabled={isTesting}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {isTesting ? 'Testing...' : 'Test Chiavi'}
        </button>
      </div>

      {results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((res, i) => (
            <div key={`${res.provider}-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-800/50 text-xs">
              <div className="flex items-center gap-3">
                {getStatusIcon(res.status)}
                <div>
                  <span className="font-bold text-zinc-200">{res.provider} {res.source ? `(${res.source})` : ''}</span>
                  <span className="ml-2 text-[10px] text-zinc-500 font-mono">key={res.maskedKey} {res.model ? `| model=${res.model}` : ''}</span>
                </div>
              </div>
              <div className="text-right">
                 <div className={`font-mono text-[10px] uppercase font-bold tracking-wider ${(res.status === 'OK' || res.status === 'GEMINI_PARTIAL_OK') ? 'text-emerald-500' : (res.status.includes('LIMIT') || res.status.includes('QUOTA')) ? 'text-amber-500' : res.status === 'MISSING_KEY' ? 'text-zinc-500' : 'text-red-500'}`}>
                    {res.status === 'GEMINI_PARTIAL_OK' ? 'ATTIVA (Limit Modelli)' : res.status}
                 </div>
                 {res.status === 'OK' || res.status === 'GEMINI_PARTIAL_OK' ? (
                   <div className="text-[10px] text-zinc-500 mt-0.5">{res.message} {res.status === 'OK' ? `(${res.latencyMs}ms)` : ''}</div>
                 ) : (
                   <div className="text-[9px] text-zinc-500 mt-0.5 truncate max-w-[120px]" title={res.message}>{res.message}</div>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}

      {results && results.length === 0 && (
        <div className="text-xs text-zinc-500 italic flex items-center gap-2 mt-2">
          <ServerCrash className="w-3.5 h-3.5" />
          Nessuna chiave trovata nel sistema.
        </div>
      )}
    </div>
  );
}
