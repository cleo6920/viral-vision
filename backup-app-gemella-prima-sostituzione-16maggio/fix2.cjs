const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const splitPointStartIndices = content.indexOf('<h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Sincronizzazione Battute-Frame</h4>');

if (splitPointStartIndices === -1) {
    console.log("splitPointStartIndices not found");
    process.exit(1);
}

// Find the start of the <div className="bg-zinc... before it
const splitPointStart = content.lastIndexOf('<div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">', splitPointStartIndices);

if (splitPointStart === -1) {
    console.log("div start not found");
    process.exit(1);
}

const before = content.substring(0, splitPointStart);
const after = content.substring(splitPointStart);

const splitReplacement = `
                                </div>
                              </details>
                            </div>
                            
                            {/* COSCIENZA TECNICA AUDIO */}
                            <div className="bg-zinc-800/50 p-5 border border-zinc-700/50 rounded-2xl shadow-xl mb-6 text-sm text-zinc-200 relative overflow-hidden group">
                               <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                 <Mic className="w-12 h-12 text-blue-400" />
                               </div>
                               <h4 className="font-bold text-white mb-4 border-b border-zinc-700 pb-2 flex items-center gap-2 uppercase tracking-tight">
                                 <Mic className="w-4 h-4 text-blue-400" />
                                 COSCIENZA TECNICA AUDIO
                               </h4>
                               
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                 
                                 {/* RIQUADRO 1 — COSA HO SENTITO */}
                                 <div className="bg-black/30 p-4 rounded-xl border border-zinc-700/30">
                                   <p className="text-zinc-400 text-xs font-bold uppercase mb-4">Cosa ho sentito nell'audio</p>
                                   <div className="space-y-3 text-zinc-200 text-[13px]">
                                     <p>Trascrizione: <span className="font-bold text-white">{trace.heard?.transcriptAvailable ? "disponibile" : "non disponibile"}</span></p>
                                     <p>Segmenti audio rilevati: <span className="font-bold text-white">{audioSegmentsForUi.length}</span></p>
                                     <p>Durata audio: <span className="font-bold text-white">{audioSegmentsForUi.length > 0 ? audioSegmentsForUi[audioSegmentsForUi.length - 1]?.end || "sconosciuta" : 0} secondi</span></p>
                                     <p>Battute temporizzate: <span className="font-bold text-white">{originalTimedScriptRows.length > 0 ? "sì" : "no"}</span></p>
                                     <p>Speaker reali: <span className="font-bold text-amber-500">non determinabili se manca diarizzazione vera</span></p>
                                     {typeof castAuditForCard?.estimatedSpeakerCount === "number" && (
                                       <p>Stima da script: <span className="font-bold text-white">{castAuditForCard.estimatedSpeakerCount}</span> <span className="text-zinc-500 text-xs italic">(stima teorica da testo, non certezza audio)</span></p>
                                     )}
                                   </div>
                                 </div>
                                 
                                 {/* RIQUADRO 2 — BATTUTE PRINCIPALI */}
                                 <div className="bg-black/30 p-4 rounded-xl border border-zinc-700/30">
                                   <p className="text-zinc-400 text-xs font-bold uppercase mb-4">Battute / Dialoghi principali</p>
                                   <div className="space-y-4 text-zinc-200 text-[13px]">
                                     <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                       {originalTimedScriptRows.length > 0 ? originalTimedScriptRows.slice(0, 8).map((row, idx) => (
                                         <p key={"audio-row-"+idx} className="border-l-2 border-blue-500/50 pl-2">
                                           <span className="font-mono text-[10px] text-zinc-500 select-none">{formatSecondsLabel(row.startTime)} - {formatSecondsLabel(row.endTime)} — </span>
                                           <span className="italic">"{row.line}"</span>
                                         </p>
                                       )) : (
                                         <p className="text-zinc-500 italic">Nessun dialogo disponibile</p>
                                       )}
                                       {originalTimedScriptRows.length > 8 && (
                                         <p className="text-zinc-500 text-xs italic opacity-70">...ulteriori battute disponibili nei dettagli avanzati</p>
                                       )}
                                     </div>
                                   </div>
                                 </div>
                                 
                               </div>

                               <details className="bg-zinc-900/60 border border-zinc-700/40 rounded-xl p-4 text-xs text-zinc-300">
                                 <summary className="cursor-pointer font-bold text-zinc-400 uppercase tracking-wider hover:text-white transition-colors flex items-center gap-2">
                                   Dettagli tecnici avanzati audio
                                 </summary>
                                 <div className="mt-6 opacity-70 hover:opacity-100 transition-opacity space-y-4">
`;

let finalContent = before + splitReplacement + after;

if (!finalContent.includes('Mic,')) {
    finalContent = finalContent.replace('import {', 'import { Mic, ');
}

fs.writeFileSync('src/App.tsx', finalContent);
console.log('Split completed');
