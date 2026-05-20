import React from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Activity, ShieldCheck, Terminal, Cpu } from 'lucide-react';

type CreativeDecisionConscienceProps = {
  result?: any;
};

export function CreativeDecisionConscience({ result }: CreativeDecisionConscienceProps) {
  // Lettura dati
  const transcript = result?.verifiedTranscript || result?.script || result?.originalScript || "";
  const audioSegments = Array.isArray(result?.audioSegments) ? result.audioSegments : [];
  const frameObservations = Array.isArray(result?.frameObservations) ? result.frameObservations : [];
  const frameTimestamps = Array.isArray(result?.frameTimestamps) ? result.frameTimestamps : [];
  const canonicalCastList = Array.isArray(result?.canonicalCastList) ? result.canonicalCastList : [];
  
  const hasVideo = frameObservations.length > 0 || frameTimestamps.length > 0;
  const hasAudio = audioSegments.length > 0 || transcript.trim().length > 0;
  const hasTranscript = transcript.trim().length > 0;

  // Logica decisionSource
  let decisionSource = "insufficient_data";
  let decisionSourceLabel = "Insufficient Data";

  if (hasVideo && hasAudio) {
    decisionSource = "creative_decision_conscience";
    decisionSourceLabel = "Coscienza Decisionale Creativa";
  } else if (hasVideo || hasAudio) {
    decisionSource = "composer_conscience_fallback";
    decisionSourceLabel = "Composer Conscience (Fallback)";
  } else {
    decisionSource = "insufficient_data";
    decisionSourceLabel = "Dati insufficienti";
  }

  // Logica decisione creativa
  let decisionText = "decisione creativa non generabile con sicurezza";
  if (hasVideo && hasAudio && hasTranscript) {
    decisionText = "puntare su scena dialogata con ruoli chiari";
  } else if (!hasVideo && hasAudio) {
    decisionText = "puntare su ricostruzione guidata dalla trascrizione";
  } else if (hasVideo && !hasAudio) {
    decisionText = "puntare su descrizione visiva e azioni";
  } else if (hasVideo && hasAudio) {
    // Caso in cui abbiamo video e audio ma magari manca transcript pulito
    decisionText = "puntare su integrazione multimodale prudente";
  }

  return (
    <div className="bg-zinc-900 p-5 border border-amber-500/20 rounded-2xl shadow-xl mb-6 text-sm text-zinc-200 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles className="w-12 h-12 text-amber-400" />
      </div>
      
      <h4 className="font-bold text-white mb-1 border-b border-zinc-800 pb-2 flex items-center gap-2 uppercase tracking-tight">
        <Sparkles className="w-4 h-4 text-amber-400" />
        COSCIENZA DECISIONALE CREATIVA
      </h4>
      <p className="text-zinc-400 text-xs italic mb-4">
        Decide la direzione creativa finale usando Composer + Strategia. Per ora non modifica i prompt.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RIQUADRO 1 — DECISIONE CREATIVA CONSIGLIATA */}
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
          <p className="text-zinc-400 text-xs font-bold uppercase mb-4">Decisione creativa consigliata</p>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-zinc-500 uppercase font-bold mb-1">Fonte decisione:</p>
              <p className="text-amber-400 font-mono text-[12px]">{decisionSourceLabel}</p>
              <p className="text-zinc-600 text-[10px] italic mt-1">Non ancora collegata al prompt engine.</p>
            </div>
            
            <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
              <p className="text-[13px] leading-relaxed text-zinc-300">
                {decisionText === "decisione creativa non generabile con sicurezza" ? (
                  <span className="text-zinc-500">{decisionText}</span>
                ) : (
                  <>
                    Conviene costruire la scena mantenendo il nucleo dialogato e la relazione tra i personaggi visibili. 
                    Le battute devono restare ordinate secondo la trascrizione. 
                    L'assegnazione delle battute ai personaggi va fatta in modo prudente, usando solo indizi video/audio confermati.
                    <br />
                    <span className="text-amber-300/80 font-medium block mt-2">→ {decisionText}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* RIQUADRO 2 — COSA FARE / COSA EVITARE */}
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-[13px]">
          <div className="mb-4">
            <p className="text-emerald-400 text-[11px] font-bold uppercase mb-2 tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" /> FARE
            </p>
            <ul className="space-y-1.5 text-zinc-300 list-none pl-1">
              <li className="flex items-start gap-2"><span className="text-emerald-500 text-[10px] mt-1">•</span> mantenere i personaggi visivi confermati</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 text-[10px] mt-1">•</span> rispettare l’ordine delle battute</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 text-[10px] mt-1">•</span> usare ruoli chiari</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 text-[10px] mt-1">•</span> evidenziare azioni e reazioni visibili</li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 text-[10px] mt-1">•</span> usare la strategia come orientamento</li>
            </ul>
          </div>
          <div>
            <p className="text-rose-500 text-[11px] font-bold uppercase mb-2 tracking-wider flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> EVITARE
            </p>
            <ul className="space-y-1.5 text-zinc-400 list-none pl-1 text-[12px]">
              <li className="flex items-start gap-2"><span className="text-rose-500 text-[10px] mt-1">•</span> inventare identità non confermate</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 text-[10px] mt-1">•</span> assegnare battute senza prova</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 text-[10px] mt-1">•</span> sommare parlanti audio e personaggi</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 text-[10px] mt-1">•</span> generare prompt troppo generici</li>
              <li className="flex items-start gap-2"><span className="text-rose-500 text-[10px] mt-1">•</span> ignorare incertezze su voci e cast</li>
            </ul>
          </div>
        </div>
      </div>

      {/* NUOVO BLOCCO DIAGNOSTICO — STEP G1 */}
      <div className="mt-8 pt-6 border-t border-zinc-800/80">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-zinc-600" />
          <h5 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Decisione pronta per i prompt (Diagnostica)</h5>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Sintesi Tecnica */}
          <div className="space-y-4">
            <div>
              <p className="text-[9px] text-zinc-600 uppercase font-bold mb-1.5">Stato Analisi</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-1.5 rounded border text-[10px] flex items-center justify-between px-2 ${hasVideo ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                  VIDEO {hasVideo ? 'OK' : 'NO'}
                </div>
                <div className={`p-1.5 rounded border text-[10px] flex items-center justify-between px-2 ${hasAudio ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                  AUDIO {hasAudio ? 'OK' : 'NO'}
                </div>
                <div className={`p-1.5 rounded border text-[10px] flex items-center justify-between px-2 ${canonicalCastList.length > 0 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                  CAST {canonicalCastList.length > 0 ? 'OK' : 'NO'}
                </div>
                <div className={`p-1.5 rounded border text-[10px] flex items-center justify-between px-2 ${hasTranscript ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                  TESTO {hasTranscript ? 'OK' : 'NO'}
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
              <p className="text-[9px] text-zinc-600 uppercase font-bold mb-1">Fonte Identificata</p>
              <p className="text-[10px] text-amber-500 font-mono truncate">{decisionSource}</p>
            </div>
          </div>

          {/* Vincoli Attivi */}
          <div className="col-span-1 sm:col-span-2 bg-zinc-950 p-4 rounded-xl border border-zinc-800/50">
            <div className="flex items-center justify-between mb-3 border-b border-zinc-900 pb-2">
               <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Vincoli di Sicurezza Decisionale</p>
               <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
               <p className="text-[11px] text-zinc-400 flex items-center gap-2"><span className="w-1 h-1 bg-amber-500 rounded-full" /> No invenzioni identità</p>
               <p className="text-[11px] text-zinc-400 flex items-center gap-2"><span className="w-1 h-1 bg-amber-500 rounded-full" /> No battute senza prova</p>
               <p className="text-[11px] text-zinc-400 flex items-center gap-2"><span className="w-1 h-1 bg-amber-500 rounded-full" /> Rispetto ordine trascrizione</p>
               <p className="text-[11px] text-zinc-400 flex items-center gap-2"><span className="w-1 h-1 bg-amber-500 rounded-full" /> Prudenza se manca diarizzazione</p>
            </div>
            
            <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-rose-500/80 font-bold uppercase">Non ancora collegato al prompt engine</span>
               </div>
               <span className="text-[9px] text-zinc-600 font-mono italic">Diagnostic: {decisionText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* PAYLOAD DIAGNOSTICO PRONTO — STEP H1 */}
      <div className="mt-6 pt-6 border-t border-zinc-800/80">
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 overflow-hidden relative group/payload">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-amber-500" />
              <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Payload diagnostico pronto</h5>
            </div>
            <Cpu className="w-3.5 h-3.5 text-zinc-700" />
          </div>

          <div className="font-mono text-[11px] space-y-2 text-zinc-400 leading-relaxed">
            <div className="flex gap-2">
              <span className="text-zinc-600 shrink-0">01_SOURCE:</span>
              <span className="text-amber-500/90 font-bold">{decisionSource}</span>
            </div>
            <div className="flex gap-4">
              <div className="flex gap-2">
                <span className="text-zinc-600 shrink-0">02_STATO:</span>
                <span className="text-zinc-500">[{hasVideo ? 'V' : '-'}{hasAudio ? 'A' : '-'}{canonicalCastList.length > 0 ? 'C' : '-'}{hasTranscript ? 'T' : '-'}]</span>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-600 shrink-0">03_DIREZIONE:</span>
              <span className="text-zinc-300 italic">"{decisionText}"</span>
            </div>
            <div className="pt-2">
              <span className="text-zinc-600 block mb-1">04_VINCOLI_SICUREZZA:</span>
              <div className="pl-4 space-y-0.5 text-[10px] text-zinc-500">
                <p>• IMMUTABILITY_IDENTITY_RESTRICTION: ON</p>
                <p>• TRANSCRIPT_ORDER_ENFORCEMENT: ON</p>
                <p>• EVIDENCE_BASED_SPEAKER_ASSIGNMENT: PRUDENT</p>
                <p>• MULTIMODAL_CONSISTENCY_GATE: ACTIVE</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 justify-end">
            <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-500 font-bold">
              SOLO DIAGNOSTICA — NON INVIATO AL PROMPT ENGINE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
