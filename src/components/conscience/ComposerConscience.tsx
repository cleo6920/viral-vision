import React from 'react';

type ComposerConscienceProps = {
  result?: any;
};

export function ComposerConscience({ result }: ComposerConscienceProps) {
  if (result?.eyeEarFailed) {
    return (
      <div className="p-4 border border-red-500/30 rounded-xl bg-red-950/20 space-y-4 shadow-sm text-zinc-300 mt-6">
        <h2 className="text-sm font-bold text-red-400 font-mono flex items-center gap-2">
          <span>⚠️ COSCIENZA TECNICA COMPOSITORE — ANALISI INTERROTTA</span>
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          La Coscienza Tecnica Compositore non è abilitata poiché l'analisi Google Gemini Eye/Ear si è interrotta.
        </p>
        <div className="bg-black/45 p-3.5 rounded-lg border border-red-500/25 text-[11px] text-zinc-400 leading-relaxed font-mono">
          <span className="font-bold text-red-400 block mb-1">Motivo dell'interruzione:</span>
          {result?.promptDecisionTrace?.eyeEarDiagnostics?.eyeEarFailedReason || result?.promptDecisionTrace?.eyeEarDiagnostics?.qualityError || "Precheck o upload Gemini fallito o non attivo."}
          <div className="mt-2.5 pt-2 border-t border-zinc-800 text-zinc-500 italic">
            I prompt di composizione e le relative ottimizzazioni non possono essere generati in assenza dei dati d'analisi primari.
          </div>
        </div>
      </div>
    );
  }

  const hasBestOptimizedPrompt = !!result?.bestOptimizedPrompt;
  const hasAiPrompts = !!result?.aiPrompts;
  const hasSora = !!(result?.soraPrompt15s || result?.soraPrompt12s || result?.soraPrompt1 || result?.soraPrompt);
  const hasKling = !!(result?.klingPrompt15s || result?.klingPrompt10s || result?.klingPrompt1 || result?.klingPrompt);
  const hasVeo = !!(result?.veoPrompt || result?.veo3Prompt8s || result?.veoPrompt1);

  const hasAnyPrompt = hasBestOptimizedPrompt || hasAiPrompts || hasSora || hasKling || hasVeo;

  const finalPass = result?.promptQualityReport?.finalPass;
  const locked = result?.lockedPromptTabs?.locked;

  let mainPromptText = "";
  let mainPromptSource = "non disponibile";

  if (result?.bestOptimizedPrompt) {
    mainPromptSource = "bestOptimizedPrompt";
    mainPromptText = typeof result.bestOptimizedPrompt === 'string' ? result.bestOptimizedPrompt : (result.bestOptimizedPrompt.prompt || JSON.stringify(result.bestOptimizedPrompt));
  } else if (result?.optimizedPrompt15s) {
    mainPromptSource = "optimizedPrompt15s";
    mainPromptText = typeof result.optimizedPrompt15s === 'string' ? result.optimizedPrompt15s : JSON.stringify(result.optimizedPrompt15s);
  } else if (result?.optimizedPrompt12s) {
    mainPromptSource = "optimizedPrompt12s";
    mainPromptText = typeof result.optimizedPrompt12s === 'string' ? result.optimizedPrompt12s : JSON.stringify(result.optimizedPrompt12s);
  } else if (result?.aiPrompts) {
    mainPromptSource = "aiPrompts";
    mainPromptText = typeof result.aiPrompts === 'string' ? result.aiPrompts : JSON.stringify(result.aiPrompts);
  }

  const hasMainPrompt = mainPromptText.trim().length > 0;
  const promptPreview = mainPromptText.length > 180 ? mainPromptText.substring(0, 180) + "..." : mainPromptText;

  let diagnosisText = "dati composizione non disponibili";
  if (result) {
    if (finalPass === true && locked === true && hasMainPrompt) {
      diagnosisText = "composizione utilizzabile";
    } else if (hasMainPrompt && (finalPass !== true || locked !== true)) {
      diagnosisText = "composizione presente ma non completamente validata";
    } else if (!hasMainPrompt) {
      diagnosisText = "composizione non ancora disponibile";
    }
  }

  const renderBoolean = (val: any) => {
    if (val === true) return <span className="text-emerald-400 font-bold">Vero</span>;
    if (val === false) return <span className="text-red-400 font-bold">Falso</span>;
    return <span className="text-amber-500 font-bold">Non disponibile</span>;
  };

  const renderPresence = (label: string, isPresent: boolean) => (
    <li>
      <span className="text-zinc-500 mr-1">{label}:</span> 
      <span className={isPresent ? "text-white font-semibold" : "text-zinc-500"}>{isPresent ? "Presente" : "Assente"}</span>
    </li>
  );

  return (
    <div className="p-4 border border-zinc-700/50 rounded-lg bg-zinc-900/60 space-y-4 shadow-sm text-zinc-300 mt-6">
      <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-tight">Coscienza Tecnica Compositore</h2>
      
      <div className="space-y-1">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Stato Composizione</h3>
        <p className="text-xs text-zinc-300 mb-1">
          {hasAnyPrompt ? (
            <span className="font-bold text-emerald-400">Prompt compositivi presenti</span>
          ) : (
            <span className="italic text-zinc-500">Prompt compositivi non ancora rilevati</span>
          )}
        </p>
        <p className="text-xs text-zinc-300">
          <span className="text-zinc-500 mr-1">Diagnosi composizione:</span>
          <span className="font-semibold text-white">{diagnosisText}</span>
        </p>
      </div>

      <div className="space-y-1 pt-3 border-t border-zinc-800/50">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Stato Blocco Finale</h3>
        <ul className="text-xs text-zinc-300 space-y-1.5">
          <li><span className="text-zinc-500 mr-1">Final Pass:</span> {renderBoolean(finalPass)}</li>
          <li><span className="text-zinc-500 mr-1">Locked:</span> {renderBoolean(locked)}</li>
        </ul>
      </div>

      <div className="space-y-1 pt-3 border-t border-zinc-800/50">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Presenza Output Principali</h3>
        <ul className="text-xs text-zinc-300 space-y-1.5">
          {renderPresence("Universal/Best Prompt", hasBestOptimizedPrompt)}
          {renderPresence("AI Prompts", hasAiPrompts)}
          {renderPresence("Sora", hasSora)}
          {renderPresence("Kling", hasKling)}
          {renderPresence("Veo", hasVeo)}
        </ul>
      </div>

      <div className="space-y-1 pt-3 border-t border-zinc-800/50">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Anteprima Prompt</h3>
        <p className="text-xs text-zinc-300 mb-1">
          <span className="text-zinc-500">Prompt principale:</span> <span className={hasMainPrompt ? "text-white font-semibold" : "text-zinc-500"}>{hasMainPrompt ? "Presente" : "Assente"}</span>
        </p>
        <p className="text-xs text-zinc-300 mb-2">
          <span className="text-zinc-500">Sorgente rilevata:</span> <span className="font-mono text-[10px] text-zinc-400">{mainPromptSource}</span>
        </p>
        {hasMainPrompt && (
          <div className="bg-black/30 p-2 rounded border border-zinc-800/50 text-xs text-zinc-400 italic">
            "{promptPreview}"
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-zinc-800/50">
        <p className="text-[10px] text-zinc-500 italic">
          Questa sezione legge solo dati già presenti nel result. Il JSON/export resta completo.
        </p>
      </div>
    </div>
  );
}
