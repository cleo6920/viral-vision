import React from 'react';
import { logger } from '../../utils/logger';

type TechnicalAudioConscienceProps = {
  result?: any;
};

export function TechnicalAudioConscience({ result }: TechnicalAudioConscienceProps) {
  if (result?.eyeEarFailed) {
    return (
      <div className="p-4 border border-red-500/30 rounded-xl bg-red-950/20 space-y-4 shadow-sm text-zinc-300 mt-6">
        <h2 className="text-sm font-bold text-red-400 font-mono flex items-center gap-2">
          <span>⚠️ COSCIENZA TECNICA AUDIO — ANALISI INTERROTTA</span>
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          La Coscienza Tecnica Audio non è disponibile poiché l'analisi Google Gemini Eye/Ear non è stata eseguita o completata con successo.
        </p>
        <div className="bg-black/45 p-3.5 rounded-lg border border-red-500/25 text-[11px] text-zinc-400 leading-relaxed font-mono">
          <span className="font-bold text-red-400 block mb-1">Motivo dell'interruzione:</span>
          {result?.promptDecisionTrace?.eyeEarDiagnostics?.eyeEarFailedReason || result?.promptDecisionTrace?.eyeEarDiagnostics?.qualityError || "Precheck o upload Gemini fallito o non attivo."}
          <div className="mt-2.5 pt-2 border-t border-zinc-800 text-zinc-500 italic">
            La timeline audio e i gruppi di parlanti ipotizzati non possono essere elaborati senza un'analisi oculo/auricolare funzionante.
          </div>
        </div>
      </div>
    );
  }

  const audit = result?.audioConscienceAudit;
  const warnings = result?.audioWarnings || [];
  const observationReport = result?.audioObservationReport;
  const timelineSegments = result?.audioTimelineSegments || [];
  const speakerGroups = result?.audioSpeakerGroups || [];
  const mirrorTestBlocks = result?.mirrorTestBlocks || [];
  
  React.useEffect(() => {
    logger.info("[CONSCIENCE_EYE_EAR_UI_RENDERED]");
  }, []);
  
  if (!audit) {
    return (
      <div className="p-4 border border-zinc-700/50 rounded-lg bg-zinc-900/60 space-y-4 shadow-sm text-zinc-300 mt-6">
        <h2 className="text-sm font-bold text-zinc-200">COSCIENZA TECNICA AUDIO (NUOVA)</h2>
        <p className="text-xs text-zinc-500 italic">Dati di Coscienza Audio non disponibili per questa analisi.</p>
      </div>
    );
  }

  const formatTime = (seconds: any) => {
    const num = Number(seconds);
    if (!Number.isFinite(num)) return "00:00";
    const m = Math.floor(num / 60);
    const s = Math.floor(num % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 border border-zinc-700/50 rounded-lg bg-zinc-900/60 space-y-4 shadow-sm text-zinc-300 mt-6">
      <h2 className="text-sm font-bold text-zinc-200">COSCIENZA TECNICA AUDIO (OSSERVAZIONE)</h2>
      
      <div className="space-y-1">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Metadati & Orecchie Grezze</h3>
        <ul className="text-xs text-zinc-300 space-y-1.5">
          <li><span className="text-zinc-500 mr-1">Durata originale:</span> {audit.audioOriginalDurationSeconds?.toFixed(1) || 0}s</li>
          <li><span className="text-zinc-500 mr-1">Durata analizzata:</span> {audit.audioAnalyzedDurationSeconds?.toFixed(1) || 0}s</li>
          <li><span className="text-zinc-500 mr-1">Completato:</span> {audit.audioComplete ? "Sì" : "No"}</li>
          <li><span className="text-zinc-500 mr-1">Modalità Chunk:</span> {audit.audioChunkMode ? `Sì (${audit.audioChunksCount} chunks)` : "No"}</li>
          <li><span className="text-zinc-500 mr-1">ASR:</span> {audit.asrProvider} / {audit.asrModel}</li>
          <li><span className="text-zinc-500 mr-1">Report Analyzer:</span> {audit.reportProvider} / {audit.reportModel}</li>
          <li><span className="text-zinc-500 mr-1">Key Source:</span> <span className="font-mono text-emerald-400">{audit.reportKeySource}</span></li>
          {observationReport?.detectedAudioTypes && (
            <li><span className="text-zinc-500 mr-1">Tipi rilevati:</span> {observationReport.detectedAudioTypes.join(", ")}</li>
          )}
        </ul>
      </div>

      <div className="space-y-1 pt-3 border-t border-zinc-800/50 flex flex-col gap-2">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Avvertenze Strutturali</h3>
        <p className="text-[10px] bg-blue-900/20 text-blue-400 p-1.5 rounded">La Coscienza Audio osserva e organizza. Non assegna identità definitive. Il cervellone deve confermare con i frame.</p>
        {warnings.map((w: string, i: number) => (
          <div key={i} className="text-[10px] bg-red-900/20 text-red-400 p-1.5 rounded">{w}</div>
        ))}
        {audit.limitations?.map((l: string, i: number) => (
          <div key={`lim-${i}`} className="text-[10px] bg-yellow-900/20 text-yellow-400 p-1.5 rounded">{l}</div>
        ))}
      </div>

      <div className="space-y-1 pt-3 border-t border-zinc-800/50">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Transcript Completo</h3>
        <p className="text-xs text-zinc-400 bg-black/30 p-2 rounded max-h-32 overflow-y-auto">
          {result?.verifiedTranscript || <span className="italic">Nessun transcript generato.</span>}
        </p>
      </div>

      <div className="space-y-1 pt-3 border-t border-zinc-800/50">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Speaker Groups (Ipotesi)</h3>
        {speakerGroups.length === 0 ? (
           <p className="text-xs text-zinc-500 italic">Nessun gruppo identificato.</p>
        ) : (
          <ul className="text-xs text-zinc-300 space-y-1.5">
            {speakerGroups.map((group: any, idx: number) => (
               <li key={idx} className="flex flex-col gap-0.5 bg-black/20 p-2 rounded border border-white/5">
                 <div>
                   <span className="font-bold text-white pr-2">{group.id}</span>
                   <span className="text-zinc-400">({group.gender || group.genderEstimate || "?"})</span>
                   <span className="text-zinc-500 ml-2">Conf: {group.confidence}</span>
                 </div>
                 {group.note && <div className="text-zinc-400 text-[10px] italic">{group.note}</div>}
                 <div className="text-zinc-500 text-[9px]">Segmenti: {(group.evidenceSegments || []).join(", ")}</div>
               </li>
            ))}
          </ul>
        )}
      </div>
      
      {mirrorTestBlocks.length > 0 && (
        <div className="space-y-1 pt-3 border-t border-zinc-800/50">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Mirror Tests (Prove specchio)</h3>
          <ul className="text-xs text-zinc-300 space-y-1.5">
            {mirrorTestBlocks.map((mb: any, idx: number) => (
              <li key={idx} className="bg-blue-900/20 text-blue-300 p-2 rounded text-[10px]">
                <span className="font-bold">{mb.id}</span> [{formatTime(mb.start)} - {formatTime(mb.end)}] {mb.speakerGuess} ({mb.confidence})<br />
                <span className="italic">"{mb.text}"</span><br />
                <span className="text-blue-400/70">{mb.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 pt-3 border-t border-zinc-800/50">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Timeline Osservativa ({timelineSegments.length})</h3>
        {timelineSegments.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">Nessun segmento audio rilevato o timeline assente.</p>
        ) : (
          <div className="space-y-2">
            <ul className="text-xs text-zinc-300 space-y-2">
              {timelineSegments.slice(0, 10).map((seg: any, index: number) => {
                const text = seg?.text || "";
                const hasUncertainties = Array.isArray(seg.uncertainty) && seg.uncertainty.length > 0;
                return (
                  <li key={index} className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0 relative">
                    <div className="flex justify-between items-center">
                       <span className="text-zinc-500 shrink-0 font-mono text-[9px]">
                         [{seg.start !== undefined ? `${formatTime(seg.start)} - ${formatTime(seg.end)}` : `idx ${seg.index || index}`}] 
                       </span>
                       <div className="flex gap-1.5 items-center">
                         {seg.type && (
                           <span className="text-[8px] uppercase px-1 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                             {seg.type}
                           </span>
                         )}
                         {(seg.speakerLabel || seg.speaker) && (
                           <span className={`text-[9px] px-1 rounded ${String(seg.speakerLabel || seg.speaker).includes('?') || hasUncertainties ? 'bg-orange-900/40 text-orange-200' : 'bg-primary/20 text-primary-200'}`}>
                             {seg.speakerLabel || seg.speaker} ({seg.genderEstimate || seg.gender || "?"})
                           </span>
                         )}
                       </div>
                    </div>
                    {text && <span className="line-clamp-2 mt-0.5 text-zinc-300">"{(text.length > 150 ? text.substring(0, 150) + '...' : text).trim()}"</span>}
                    {seg.label && !text && <span className="italic mt-0.5 text-zinc-400">{seg.label}</span>}
                    {hasUncertainties && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {seg.uncertainty.map((u: string, idx: number) => (
                           <span key={idx} className="text-[8px] bg-red-900/30 text-red-300 px-1 py-0.5 rounded border border-red-900/50">
                             {u}
                           </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {timelineSegments.length > 10 && (
                <div className="text-[10px] text-zinc-400 mt-2 border-t border-zinc-800/30 pt-2 space-y-1">
                  <p>Mostrate 10 di {timelineSegments.length} eventi.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
