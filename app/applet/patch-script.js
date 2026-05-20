const fs = require('fs');
const original = fs.readFileSync('block.tsx', 'utf8');

const newCode = `(() => {
  const vReport = result.promptValidationReport;
  const lockedTabs = result.lockedPromptTabs;
  const activePromptText = result.bestOptimizedPrompt?.prompt || result.aiPrompts || '';
  const dataStatus = (result as any)?.dataStatus || 'NO_DATA';
  
  const isRecovered = vReport?.status === 'RECOVERED' || vReport?.recoveryTriggered || vReport?.recoveryReason === 'VALIDATOR_FAILED' || vReport?.failedFields?.length > 0;
  
  // Single source frame observation logic
  const frameObservationsCount = result.frameObservationsCount || result.vdbMetadata?.totalItems || result.openRouterVisionMinimalAudit?.actualFrameCountSent || result.promptProcessInfiltrator?.truthSourceLedger?.visualFramesCount || result.mergedFrameTimelineCount || result.castGroundingAudit?.frameObservationsCount || 0;
  const missingObservationFrames = result.castGroundingAudit?.missingObservationFrames || 0;

  const prompt = result.bestOptimizedPrompt?.prompt || '';
  const transcript = result.verifiedTranscript || '';
  
  const hasGraveDirtyLabels = ["person_", "unknown", "[object object]", "undefined"].some(t => prompt.toLowerCase().includes(t));
  const hasTechTerms = ["glasses", "man", "woman"].some(t => prompt.toLowerCase().includes(t));
  const hasTemplate = ["Apertura su", "Sora 12s", "Kling 15s", "Seedance 15s"].some(t => prompt.includes(t));
  const usesAudio = transcript && prompt.length > 20 && prompt.toLowerCase().includes(transcript.substring(0, 10).toLowerCase());

  const subjects = [
    { name: "Lingua", score: hasTechTerms ? 4 : 10, reason: hasTechTerms ? "Contiene termini inglesi sporchi" : "Linguaggio coerente" },
    { name: "Coerenza scena", score: prompt.length > 150 ? 10 : (prompt.length > 100 ? 7 : 4), reason: prompt.length > 150 ? "Descrizione visiva ricca" : "Descrizione superficiale" },
    { name: "Audio/Dialoghi", score: usesAudio ? 10 : (transcript ? 6 : 0), reason: usesAudio ? "Dialoghi integrati correttamente" : (transcript ? "Dialoghi rilevati ma non usati" : "Nessun audio rilevato") },
    { name: "Personaggi", score: hasGraveDirtyLabels ? 2 : 10, reason: hasGraveDirtyLabels ? "Presenza di label tipo person_X o unknown" : "Personaggi ben identificati" },
    { name: "Nucleo video", score: prompt.length > 120 ? 9 : 5, reason: prompt.length > 120 ? "Cattura l'essenza della scena" : "Analisi del nucleo limitata" },
    { name: "Pulizia tecnica", score: (hasGraveDirtyLabels || hasTemplate) ? 4 : 10, reason: (hasGraveDirtyLabels || hasTemplate) ? "Presenza di residui tecnici o template" : "Prompt pulito da boilerplate" },
    { name: "Struttura Short", score: prompt.length > 180 ? 10 : 6, reason: prompt.length > 180 ? "Ritmo e struttura ottimizzati per mobile" : "Struttura narrativa lineare" },
    { name: "Potenziale TikTok/YouTube", score: (prompt.length > 150 && !hasTemplate) ? 9 : 5, reason: (prompt.length > 150 && !hasTemplate) ? "Alto engagement potenziale" : "Potenziale di viralità moderato" },
    { name: "Originalità / Pattern Break", score: (!hasTemplate && prompt.length > 160) ? 10 : 6, reason: (!hasTemplate && prompt.length > 160) ? "Approccio creativo unico" : "Seguendo schemi standard" }
  ];

  const avgScore = subjects.reduce((acc, s) => acc + s.score, 0) / subjects.length;
  
  let level = "BOCCIATO";
  let levelColor = "text-red-400";
  let bgLevel = "bg-red-500/10 border-red-500/20";
  
  const isPromoted = vReport?.status === "PASSED" && !isRecovered;
  
  if (isPromoted) {
    level = "PROMOSSO";
    levelColor = "text-emerald-400";
    bgLevel = "bg-emerald-500/10 border-emerald-500/20";
  } else if (vReport?.status === "PARTIAL" || isRecovered) {
    level = "PARZIALE";
    levelColor = "text-yellow-400";
    bgLevel = "bg-yellow-500/10 border-yellow-500/20";
  }

  const infiltrator = result.promptProcessInfiltrator;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-black text-zinc-100 uppercase tracking-widest">PAGELLA CREATIVA</h3>
        </div>
        
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-baseline gap-1.5 px-3 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">PUNTEGGIO:</span>
            <span className={\`text-xs font-black \${avgScore >= 8 ? 'text-emerald-400' : avgScore >= 6 ? 'text-yellow-400' : 'text-red-400'}\`}>
              {avgScore.toFixed(1)} / 10
            </span>
          </div>
          <div className={\`px-3 py-1.5 rounded-full border \${bgLevel} flex items-center gap-2\`}>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">STATO FINALE:</span>
            <span className={\`text-[10px] font-black uppercase tracking-widest \${levelColor}\`}>{level}</span>
          </div>
          <button 
            onClick={() => setIsPromptQualityExpanded(!isPromptQualityExpanded)}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-[10px] font-bold uppercase transition-colors"
          >
            {isPromptQualityExpanded ? "Nascondi dettagli" : "Dettagli"}
          </button>
        </div>
      </div>

      <div className="mb-6 space-y-2 p-3 bg-zinc-800/20 border border-zinc-800 rounded-xl">
        <p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Motivo Principale:</span> {vReport?.recoveryReason || infiltrator?.whatHappened || (isPromoted ? 'Superato validatore e controlli qualità.' : 'Problemi rilevati durante la verifica.')}</p>
        <p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Audio Usato:</span> {usesAudio ? 'Sì' : 'No'}</p>
        <p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Frame Usati:</span> {frameObservationsCount > 0 ? \`Sì (\${frameObservationsCount})\` : 'No'} {missingObservationFrames > 0 && \`(mancanti: \${missingObservationFrames})\`}</p>
        <p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Provider Vision:</span> {result.vdbMetadata?.provider || infiltrator?.truthSourceLedger?.visionProvider || 'Unknown'}</p>
        <p className="text-[10px] text-zinc-300"><span className="font-bold text-zinc-500 uppercase tracking-widest mr-2">Rischio Infiltrato:</span> <span className={infiltrator?.isAnomaly ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{infiltrator?.finalInfiltratorVerdict || 'NON ESEGUITO'}</span></p>
      </div>
      
      {isPromptQualityExpanded && (
        <div className="space-y-4 mb-6">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">DETTAGLI PAGELLE</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.map((s, idx) => (
              <div key={idx} className="p-3 bg-zinc-800/30 border border-zinc-800/50 rounded-xl flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">{s.name}</span>
                  <span className={\`text-xs font-black \${
                    s.score >= 9 ? 'text-emerald-400' :
                    s.score >= 7 ? 'text-orange-400' :
                    s.score >= 6 ? 'text-yellow-400' :
                    'text-red-400'
                  }\`}>{s.score}/10</span>
                </div>
                <p className="text-[10px] text-zinc-200 leading-tight">{s.reason}</p>
                <div className="w-full h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={\`h-full rounded-full \${
                      s.score >= 9 ? 'bg-emerald-500' :
                      s.score >= 7 ? 'bg-orange-500' :
                      s.score >= 6 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }\`}
                    style={{ width: \`\${s.score * 10}%\` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
})()`;

let appText = fs.readFileSync('src/App.tsx', 'utf8');
appText = appText.replace(original, newCode);
fs.writeFileSync('src/App.tsx', appText);
console.log('App.tsx pagella rewritten');
