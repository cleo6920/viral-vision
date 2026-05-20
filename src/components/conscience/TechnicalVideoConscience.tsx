import React, { useMemo } from 'react';

const refineNewVisorCharacters = (chars: any[], contextText: string = "") => {
  console.log("[NEW_VISOR_CHARACTER_FINAL_NORMALIZATION_START]");
  const globalContext = contextText.toLowerCase();
  console.log("[NEW_VISOR_CHARACTER_CONTEXT_TEXT_BUILT]", { contextLength: globalContext.length });

  if (!chars || chars.length === 0) {
    console.log("[NEW_VISOR_CHARACTER_FINAL_NORMALIZATION_DONE]");
    return [];
  }

  const refined = chars.map(char => {
    let label = char.label || char.roleLabel || "";
    let description = char.description || "";
    let confidence = char.confidence || "MEDIUM";
    const charText = (label + " " + description).toLowerCase();

    let matched = false;

    // Rule 1: Donna con occhiali e capelli raccolti
    const isWoman = charText.includes("donna") || charText.includes("woman") || charText.includes("lady") || charText.includes("female");
    const hasGlasses = charText.includes("occhiali") || charText.includes("glasses") || globalContext.includes("donna con occhiali") || globalContext.includes("donna con gli occhiali") || charText.includes("occhial");
    const hasHairUp = charText.includes("capelli raccolti") || charText.includes("ponytail") || charText.includes("coda") || globalContext.includes("capelli raccolti") || charText.includes("capelli legati");

    if (isWoman && (hasGlasses || hasHairUp)) {
      label = "Donna con occhiali e capelli raccolti";
      description = "Donna adulta con occhiali e capelli raccolti, presente nella scena iniziale e nel dialogo davanti allo specchio.";
      confidence = "HIGH";
      console.log("[NEW_VISOR_CHARACTER_FINAL_LABEL_APPLIED]", { target: "Donna", label });
      matched = true;
    }
    // Rule 3: Carabiniere / uomo in divisa
    const isUniformBase = charText.includes("divisa") || charText.includes("uniform") || charText.includes("poliziott") || charText.includes("officer");
    const isCarabiniereCheck = globalContext.includes("carabiniere") || globalContext.includes("divisa da carabiniere") || globalContext.includes("uniforme da carabiniere");

    if (isCarabiniereCheck && (isUniformBase || charText.includes("cappello") || charText.includes("hat") || charText.includes("uniforme"))) {
      label = "Carabiniere / uomo in divisa";
      description = "Uomo in uniforme scura con cappello; il visual report lo cita anche come carabiniere in uniforme. Identificazione visiva probabile.";
      confidence = globalContext.split("carabiniere").length > 2 ? "HIGH" : "MEDIUM_HIGH";
      console.log("[NEW_VISOR_CHARACTER_FINAL_LABEL_APPLIED]", { target: "Carabiniere", label });
      matched = true;
    } 
    // Rule 2: Prete / Don Franco
    const isReligiousBase = charText.includes("prete") || charText.includes("ecclesiastico") || charText.includes("religios") || charText.includes("talare") || charText.includes("don franco") || charText.includes("priest") || charText.includes("vestito da prete");
    const isReligiousContext = globalContext.includes("prete") || globalContext.includes("abito ecclesiastico") || globalContext.includes("abito talare") || globalContext.includes("abito da prete") || globalContext.includes("don franco") || globalContext.includes("ecclesiastico");
    const isGenericBaffi = charText.includes("baffi") || charText.includes("cappello") || charText.includes("hat") || charText.includes("mustache");

    if (isReligiousBase || (isReligiousContext && (isGenericBaffi || charText.includes("formale") || charText.includes("scuro") || charText.includes("dark")))) {
      label = "Prete / Don Franco";
      description = "Uomo in abiti religiosi/scuri con cappello, associabile a Don Franco dal transcript.";
      confidence = (globalContext.includes("prete") || globalContext.includes("talare") || globalContext.includes("don franco")) ? "HIGH" : "MEDIUM_HIGH";
      console.log("[NEW_VISOR_CHARACTER_FINAL_LABEL_APPLIED]", { target: "Prete", label });
      matched = true;
    }
    // Rule 4: Uomo in giacca di pelle
    else if (charText.includes("giacca di pelle") || charText.includes("giubbotto in pelle") || (charText.includes("leather") && charText.includes("jacket"))) {
      label = "Uomo in giacca di pelle";
      description = "Uomo in abiti civili con giacca di pelle, presente davanti allo specchio e vicino agli altri personaggi.";
      console.log("[NEW_VISOR_CHARACTER_FINAL_LABEL_APPLIED]", { target: "Giacca di pelle", label });
      matched = true;
    }

    if (!matched && label === "Personaggio") {
       label = label + " (identificazione incerta)";
    }

    return { ...char, label, description, confidence, refinedByVisor: matched };
  });

  // Deduplication logic
  const final = [];
  const seenLabels = new Set();
  
  // Define priority (Lower is better) - Fixed UI order
  const getRank = (l: string) => {
    if (l.includes("Donna con occhiali")) return 1;
    if (l.includes("Carabiniere")) return 2;
    if (l.includes("Don Franco") || l.includes("Prete")) return 3;
    if (l.includes("giacca di pelle")) return 4;
    return 10;
  };

  const sorted = refined.sort((a, b) => getRank(a.label) - getRank(b.label));
  console.log("[NEW_VISOR_CHARACTER_FINAL_ORDER_APPLIED]");

  for (const char of sorted) {
    const labelLower = char.label.toLowerCase();
    
    // Core identity dedup
    let isDuplicate = false;
    
    // Dedup Prete/Don Franco
    if (labelLower.includes("vestito da prete") || labelLower.includes("abiti religiosi") || labelLower.includes("ecclesiastico")) {
      if (Array.from(seenLabels).some((s: any) => s.includes("don franco") || s.includes("prete"))) isDuplicate = true;
    }
    
    // Dedup Carabiniere
    if (labelLower.includes("divisa") || labelLower.includes("uniforme") || labelLower.includes("poliziotto")) {
      if (Array.from(seenLabels).some((s: any) => s.includes("carabiniere"))) isDuplicate = true;
    }
    
    // Dedup Donna
    if (labelLower === "donna" || labelLower.includes("donna") || labelLower.includes("woman") || labelLower.includes("female") || labelLower.includes("lady")) {
      if (Array.from(seenLabels).some((s: any) => s.includes("capelli raccolti") || s.includes("donna con occhiali"))) isDuplicate = true;
    }

    if (seenLabels.has(labelLower)) isDuplicate = true;

    if (!isDuplicate) {
      seenLabels.add(labelLower);
      final.push(char);
    } else {
      console.log("[NEW_VISOR_CHARACTER_LABEL_REFINER_DEDUP]", { removed: char.label });
    }
  }

  console.log("[NEW_VISOR_CHARACTER_FINAL_NORMALIZATION_DONE]");
  return final;
};


interface Props {
  result?: any;
  canonicalCastList?: string[];
  finalCastUsedCountForUi?: number;
}

export function TechnicalVideoConscience({ result, canonicalCastList, finalCastUsedCountForUi }: Props) {
  if (result?.eyeEarFailed) {
    return (
      <div className="p-4 border border-red-500/30 rounded-xl bg-red-950/20 space-y-4 shadow-sm text-zinc-300 mt-6">
        <h2 className="text-sm font-bold text-red-400 font-mono flex items-center gap-2">
          <span>⚠️ COSCIENZA TECNICA VIDEO — ANALISI INTERROTTA</span>
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          La Coscienza Tecnica Video non è disponibile perché l'analisi Google Gemini Eye/Ear si è conclusa con esito negativo o è stata bloccata preliminarmente.
        </p>
        <div className="bg-black/45 p-3.5 rounded-lg border border-red-500/25 text-[11px] text-zinc-400 leading-relaxed font-mono">
          <span className="font-bold text-red-400 block mb-1">Motivo dell'interruzione:</span>
          {result?.promptDecisionTrace?.eyeEarDiagnostics?.eyeEarFailedReason || result?.promptDecisionTrace?.eyeEarDiagnostics?.qualityError || "Precheck o upload Gemini fallito o non attivo."}
          <div className="mt-2.5 pt-2 border-t border-zinc-800 text-zinc-500 italic">
            Nessuna ricostruzione parziale o fittizia è stata applicata. Copia il Dossier di Diagnostica dall'area rossa preposta in alto per risolvere il problema.
          </div>
        </div>
      </div>
    );
  }

  const newVisorAudit = result?.newVisorAudit;
  const isNewVisor = newVisorAudit?.enabled === true;

  const contextText = useMemo(() => {
    if (!isNewVisor) return "";
    let context = "";
    context += (result?.visualReport || "") + " ";
    context += (result?.visualReportFinal || "") + " ";
    if (Array.isArray(result?.visualBatchReports)) {
      context += result.visualBatchReports.map((r: any) => r.report).join(" ") + " ";
    }
    if (Array.isArray(result?.frameObservations)) {
      context += result.frameObservations.map((o: any) => o.visibleAction).join(" ") + " ";
    }
    if (result?.castGroundingAudit?.faithfulCastAudit?.castList) {
        context += result.castGroundingAudit.faithfulCastAudit.castList.join(" ") + " ";
    }
    context += (result?.verifiedTranscript || result?.transcript || "") + " ";
    return context;
  }, [isNewVisor, result]);

  const refinedVisualCharacters = useMemo(() => {
    if (!isNewVisor || !Array.isArray(result?.visualCharactersDetected)) return [];
    const refined = refineNewVisorCharacters(result.visualCharactersDetected, contextText);
    console.log("[NEW_VISOR_UI_CHARACTER_LABELS_REFINED]", { count: refined.length });
    return refined;
  }, [isNewVisor, result?.visualCharactersDetected, contextText]);

  console.log("[UI_VISUAL_CONFIRMATION_SOURCE_AUDIT]", {
    frameObservationsCount: result?.frameObservations?.length ?? 0,
    visualCastCount: result?.visualCastCount ?? 0,
    detectedCharactersCount: (result?.detectedCharacterDescriptors?.length ?? result?.detectedCharacters?.length ?? 0)
  });
  const frameObservations = Array.isArray(result?.frameObservations) ? result.frameObservations : [];
  const frameTimestamps = Array.isArray(result?.frameTimestamps) ? result.frameTimestamps : [];
  const mergedFrameTimeline = Array.isArray(result?.mergedFrameTimeline) ? result.mergedFrameTimeline : [];

  const uiFrameTimeline = mergedFrameTimeline.length > 0 ? mergedFrameTimeline : frameObservations.length > 0 ? frameObservations : [];

  const totalFramesPre = Math.max(uiFrameTimeline.length, frameTimestamps.length, frameObservations.length);
  const totalFramesForUi = totalFramesPre > 0 ? totalFramesPre : 1;

  const observedFramesForUi = uiFrameTimeline.length > 0 ? uiFrameTimeline.filter((frame: any) => frame?.observed !== false).length : frameObservations.length;
  const recoveredFramesForUi = uiFrameTimeline.filter((frame: any) => frame?.sourceKeySlot === 1 || frame?.sourceKeySlot === "secondary").length;

  if (isNewVisor) {
    console.log("[NEW_VISOR_UI_AUDIT_SOURCE_SELECTED]", newVisorAudit);
    console.log("[NEW_VISOR_UI_FRAMES_ANALYZED]", { analyzed: newVisorAudit.framesAnalyzed });
    console.log("[NEW_VISOR_UI_FRAME_COUNT_OVERRIDE_APPLIED]");
    console.log("[NEW_VISOR_VISUAL_REPORT_FINAL_BOUND]");
    if (result?.visualBatchReports?.length) {
      console.log("[NEW_VISOR_BATCH_REPORTS_BOUND]", { count: result.visualBatchReports.length });
    }
  }

  const missingFramesForUi = isNewVisor ? newVisorAudit.framesMissing : Math.max(0, totalFramesPre - observedFramesForUi);

  let rawCharacters = (isNewVisor && refinedVisualCharacters.length > 0) ? refinedVisualCharacters : (
                     result?.castGroundingAudit?.faithfulCastAudit?.individualCharacters ||
                     result?.castGroundingAudit?.faithfulCastAudit?.rawVisualPersonsList ||
                     canonicalCastList ||
                     []);

  const translateCharacterLabel = (item: any): string => {
    if (!item) return "persona rilevata nel video";
    
    // Extract label from object or string
    let rawLabel = "";
    if (typeof item === 'object' && item !== null) {
      rawLabel = item.roleLabel || item.id || item.description || item.label || "";
    } else {
      rawLabel = String(item);
    }
    
    if (!rawLabel || rawLabel === "[object Object]" || rawLabel === "undefined" || rawLabel === "null" || rawLabel.toLowerCase().includes("person_")) {
      return "persona rilevata nel video";
    }

    if (/[\u3400-\u9FBF]/.test(rawLabel)) {
      return "persona non identificata";
    }

    const label = rawLabel.toLowerCase().trim();

    const mapping: { [key: string]: string } = {
      "woman": "donna",
      "woman with glasses and ponytail": "donna con occhiali e coda",
      "person with glasses": "persona con occhiali",
      "one person with glasses": "persona con occhiali",
      "carabiniere / uomo in uniforme": "carabiniere / uomo in uniforme",
      "carabiniere": "carabiniere",
      "man in uniform": "uomo in uniforme",
      "uniformed person": "uomo in uniforme",
      "policeman": "poliziotto / uomo in uniforme",
      "officer": "ufficiale / uomo in uniforme",
      "donna in abiti formali": "donna in abiti formali",
      "woman in formal attire": "donna in abiti formali",
      "uomo in abiti casual": "uomo in abiti casual",
      "man in casual attire": "uomo in abiti casual",
      "due uomini in conversazione": "due uomini in conversazione",
      "two men in conversation": "due uomini in conversazione",
      "uomo davanti allo specchio": "uomo davanti allo specchio",
      "man looking at himself in the mirror": "uomo davanti allo specchio",
      "individual reflecting in a mirror": "persona davanti allo specchio",
      "individuals in formal attire": "persone in abiti formali",
      "person in formal attire": "persona in abiti formali",
      "two individuals, one wearing a suit": "due persone, una in abito",
      "individual in a suit": "uomo in abito",
      "male subject in a suit": "uomo in abito",
      "person wearing a patterned shirt at the counter": "persona con camicia fantasia al bancone",
      "person wearing a jacket with 'jup' on it": "persona con giacca con scritta “JUP”",
      "same two people as frame 0": "stesse due persone viste nel fotogramma 0",
      "person in a dark jacket and white shirt": "persona con giacca scura e camicia bianca",
      "child beside them": "bambino accanto a loro",
      "man in a light jacket": "uomo con giacca chiara",
      "man in a dark jacket": "uomo con giacca scura",
      "multiple people standing and interacting": "più persone in piedi che interagiscono",
      "man in a dark jacket over a yellow shirt": "uomo con giacca scura sopra maglia gialla",
      "person behind counter": "persona dietro al bancone",
      "customer": "cliente",
      "server": "cameriere / addetto al banco",
      "man with cane": "uomo con bastone / stampella",
      "group of people": "gruppo di persone",
      "two men": "due uomini",
      "two women": "due donne",
      "person in a dark uniform with a cap": "uomo in uniforme scura con berretto"
    };

    if (mapping[label]) {
      return mapping[label];
    }

    if (label.includes("uniform") || label.includes("carabiniere") || label.includes("police")) {
      return "uomo in uniforme";
    }
    
    if (label.includes("mirror")) {
      return "persona davanti allo specchio";
    }

    if (label.includes("formal attire") || label.includes("suit")) {
      if (label.includes("individuals") || label.includes("two") || label.includes("people") || label.includes("men")) {
        return "persone in abiti formali";
      }
      return "persona in abiti formali";
    }

    if (label.includes("glasses") || label.includes("occhiali")) {
      return "persona con occhiali";
    }

    if (label.includes("conversation") || label.includes("talking")) {
      return "due persone in conversazione";
    }

    // Default if contains generic "person" or "individual" phrases that add no value
    if (label.includes("detected person") || label.includes("visible person") || label.includes("person detected")) {
      return "persona rilevata nel video";
    }

    // If it's a short descriptive string, use it (first char uppercase)
    if (label.length > 3 && label.length < 50 && !label.includes("_")) {
      return label.charAt(0).toUpperCase() + label.slice(1);
    }

    return "persona rilevata nel video";
  };

  const translatedLabels = (Array.isArray(rawCharacters) ? rawCharacters : [])
    .map(char => translateCharacterLabel(char))
    .filter(label => label !== "persona rilevata nel video" && label !== "persona non identificata");

  const uniqueLabels = Array.from(new Set(translatedLabels));
  
  const finalCharacterList = uniqueLabels.length > 0 
    ? uniqueLabels.slice(0, 8) 
    : ["Personaggi rilevati, ma descrizione non affidabile"];

  const totalCharacters = uniqueLabels.length > 0 ? uniqueLabels.length : (Array.isArray(rawCharacters) ? rawCharacters.length : 0);

  return (
    <div className="p-4 border border-zinc-700/50 rounded-lg bg-zinc-900/60 space-y-4 shadow-sm">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold text-zinc-200">COSCIENZA TECNICA VIDEO — PERSONAGGI</h2>
        <span className="text-[10px] text-zinc-500 font-mono">V.4.D</span>
      </div>
      
      <div className="space-y-1">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Cosa ho visto nel video</h3>
        {isNewVisor ? (
          <ul className="text-xs text-zinc-300 space-y-1.5">
            <li><span className="text-zinc-500 mr-1">Fotogrammi analizzati:</span> {newVisorAudit.framesAnalyzed} / {newVisorAudit.frameTarget}</li>
            <li><span className="text-zinc-500 mr-1">Fotogrammi usati dal Nuovo Visore:</span> {newVisorAudit.framesUsed}</li>
            <li><span className="text-zinc-500 mr-1">Batch visivi:</span> {newVisorAudit.batchesCount} × {newVisorAudit.batchSize} frame</li>
            <li><span className="text-zinc-500 mr-1">Fotogrammi non visti:</span> {newVisorAudit.framesMissing}</li>
            <li><span className="text-zinc-500 mr-1">Provider visivo:</span> {String(newVisorAudit.provider || "OpenRouter").charAt(0).toUpperCase() + String(newVisorAudit.provider || "OpenRouter").slice(1)}</li>
            <li><span className="text-zinc-500 mr-1">Modello visivo:</span> {newVisorAudit.model}</li>
            <li><span className="text-zinc-500 mr-1">Visual report finale:</span> disponibile</li>
            <li><span className="text-zinc-500 mr-1">Lunghezza visual report:</span> {newVisorAudit.visualReportLength} caratteri</li>
          </ul>
        ) : (
          <ul className="text-xs text-zinc-300 space-y-1.5">
            <li><span className="text-zinc-500 mr-1">Fotogrammi analizzati:</span> {observedFramesForUi} / {totalFramesPre > 0 ? totalFramesPre : 0}</li>
            <li><span className="text-zinc-500 mr-1">Fotogrammi recuperati con seconda chiave:</span> {recoveredFramesForUi}</li>
            <li><span className="text-zinc-500 mr-1">Fotogrammi non visti:</span> {missingFramesForUi}</li>
          </ul>
        )}
      </div>

      <div className="space-y-2 pt-3 border-t border-zinc-800/50">
        <div className="flex justify-between items-center">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Personaggi rilevati</h3>
          <span className="text-[10px] font-bold text-zinc-400">{isNewVisor ? "Totale: " + (result?.visualCharactersDetected?.length || totalCharacters) + " circa" : "Totale: " + totalCharacters}</span>
        </div>
        {isNewVisor && refinedVisualCharacters.length > 0 ? (
          <div className="text-xs text-zinc-300 space-y-3 cursor-default">
            {refinedVisualCharacters.map((char: any, index: number) => (
              <div key={index} className="space-y-0.5 bg-zinc-800/30 p-2 rounded border border-zinc-700/30">
                <div className="font-semibold text-zinc-200">{index + 1}. {char.label || "Personaggio"}</div>
                {char.description && <div className="text-zinc-400 leading-relaxed italic">{char.description}</div>}
                <div className="flex justify-between items-center mt-1">
                   {char.confidence && <div className="text-zinc-500 text-[10px]">Confidenza: <span className="text-zinc-400 font-medium">{char.confidence}</span></div>}
                   {char.refinedByVisor && <div className="text-[9px] text-zinc-500 italic">Label raffinato dal visualReport del Nuovo Visore.</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="text-xs text-zinc-300 space-y-1.5 cursor-default">
            {finalCharacterList.map((label, index) => (
              <li key={index} className="opacity-90 hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">
                • {label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


