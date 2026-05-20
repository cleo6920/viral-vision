import React from 'react';
// Test
import { Target } from 'lucide-react';

type StrategicConscienceProps = {
  result?: any;
};

export function StrategicConscience({ result }: StrategicConscienceProps) {
  const transcript = typeof result?.verifiedTranscript === "string" ? result.verifiedTranscript : (typeof result?.script === "string" ? result.script : "");
  const audioSegments = Array.isArray(result?.audioSegments) ? result.audioSegments : [];
  const frameObservations = Array.isArray(result?.frameObservations) ? result.frameObservations : [];
  const canonicalCastList = Array.isArray(result?.canonicalCastList) ? result.canonicalCastList : [];
  const genre = typeof result?.genre === "string" ? result.genre : "";
  const niche = typeof result?.niche === "string" ? result.niche : "";

  const hasTranscript = transcript.trim().length > 0;
  const hasDialogue = audioSegments.length > 1;
  const hasVideo = frameObservations.length > 0;
  const hasCast = canonicalCastList.length > 0;

  let potentialLabel = "Basso";
  let potentialColor = "text-zinc-500";
  const elementsCount = [hasTranscript, hasDialogue, hasVideo, hasCast].filter(Boolean).length;

  if (elementsCount >= 4) {
    potentialLabel = "Alto";
    potentialColor = "text-emerald-400";
  } else if (elementsCount >= 2) {
    potentialLabel = "Medio";
    potentialColor = "text-amber-400";
  }

  const getSummary = () => {
    if (elementsCount === 0) return "Dati insufficienti per una valutazione strategica del contenuto.";
    
    let summary = "Il contenuto sembra ";
    if (genre) summary += `un contenuto di genere ${genre.toLowerCase()} `;
    else if (hasDialogue) summary += "una scena con dialoghi ";
    else summary += "un frammento visivo ";

    if (niche) summary += `dedicato alla nicchia ${niche.toLowerCase()}. `;
    
    summary += `Il potenziale complessivo è ${potentialLabel.toLowerCase()} perché `;
    if (elementsCount >= 4) {
      summary += "combina una chiara presenza visiva, dialoghi trascritti e personaggi identificabili, permettendo una narrazione completa.";
    } else if (elementsCount >= 2) {
      summary += "possiede una base tecnica utile (video o audio), ma mancano alcuni elementi per una produzione automatizzata senza errori.";
    } else {
      summary += "le informazioni sono troppo frammentate per garantire un risultato coerente senza un pesante intervento manuale.";
    }
    
    return summary;
  };

  return (
    <div className="bg-zinc-900 p-5 border border-purple-500/20 rounded-2xl shadow-xl mb-6 text-sm text-zinc-200 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <Target className="w-12 h-12 text-purple-400" />
      </div>
      <h4 className="font-bold text-white mb-1 border-b border-zinc-800 pb-2 flex items-center gap-2 uppercase tracking-tight">
        <Target className="w-4 h-4 text-purple-400" />
        COSCIENZA STRATEGICA
      </h4>
      <p className="text-zinc-400 text-xs italic mb-4">Valuta il potenziale del contenuto, senza modificare i prompt.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RIQUADRO 1 — POTENZIALE DEL CONTENUTO */}
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
          <p className="text-zinc-400 text-xs font-bold uppercase mb-4">Potenziale del contenuto</p>
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-zinc-300">
              {getSummary()}
            </p>
            <p className="text-xs uppercase tracking-wider font-bold">
              Grado di potenziale: <span className={potentialColor}>{potentialLabel}</span>
            </p>
          </div>
        </div>

        {/* RIQUADRO 2 — PUNTI FORTI / RISCHI */}
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-[13px]">
          <div className="mb-4">
            <p className="text-emerald-400 text-[11px] font-bold uppercase mb-2 tracking-wider">Punti Forti</p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-300">
              {hasTranscript && <li>Testo trascritto disponibile</li>}
              {hasDialogue && <li>Dialoghi temporizzati rilevati ({audioSegments.length})</li>}
              {hasVideo && <li>Azioni visive analizzate ({frameObservations.length} fotogrammi)</li>}
              {hasCast && <li>Personaggi identificati visivamente ({canonicalCastList.length})</li>}
              {elementsCount === 0 && <li className="text-zinc-500 italic">Nessun punto di forza rilevato</li>}
            </ul>
          </div>
          <div>
            <p className="text-amber-500 text-[11px] font-bold uppercase mb-2 tracking-wider">Rischi Rilevati</p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-400">
              {!hasDialogue && <li>Assenza di dialoghi temporizzati</li>}
              {!hasCast && <li>Mancata identificazione chiara dei personaggi visivi</li>}
              {(typeof result?.transcriptSpeakerCountEstimate === "number" && result.transcriptSpeakerCountEstimate > 3) && <li>Elevato numero di parlanti rilevati ({result.transcriptSpeakerCountEstimate})</li>}
              {!hasTranscript && <li>Mancanza di script o trascrizione verificata</li>}
              {hasVideo && frameObservations.length < 5 && <li>Copertura visiva limitata</li>}
              {elementsCount < 2 && <li>Dati insufficienti per automazione affidabile</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
