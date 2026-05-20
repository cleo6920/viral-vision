import { StrategicManifest, StrategicStrategy } from "../../types";

export type RoutingSourceType = "STATIC" | "VIDEO" | "WEAK_VIDEO" | "INFORMATIONAL";

/**
 * Universal Content Routing Matrix
 * Acts as the deterministic engine to select the generation strategy
 * based on physical input (SourceType) and semantic intent (CoreIntent).
 */
export function getStrategicRouting(
  sourceType: string,
  coreIntent: string
): StrategicManifest {
  const normalizedSource = normalizeSourceType(sourceType);
  const normalizedIntent = (coreIntent || "").trim().toUpperCase();
  const s = sourceType || "ALTRO";

  // ROUTING MATRIX LOGIC
  if (normalizedSource === "STATIC" || normalizedSource === "INFORMATIONAL") {
    switch (normalizedIntent) {
      case "PERSONA":
        return createManifest("MICRO_HUMAN_ACTIVATION", {
          activation: "Sguardo, espressione facciale, respiro, accenno di sorriso o gesto minimo.",
          forbidden: ["Azioni complesse", "Spostamenti fisici", "Vento artificiale forzato"],
          mandatory: ["Fidelity assoluta al volto/posa", "Dominanza del soggetto umano"],
          dominance: "PERSONA",
          sourceType: s,
          coreIntent: normalizedIntent
        });
      case "PRODOTTO":
        return createManifest("PRODUCT_REVEAL_PLAUSIBLE_USE", {
          activation: "Focus sulla qualità materica, riflessi naturali, dettaglio d'uso plausibile.",
          forbidden: ["Interazioni umane non presenti", "Movimenti di macchina dinamici"],
          mandatory: ["Esaltazione del prodotto", "Supervisione texture"],
          dominance: "PRODOTTO",
          sourceType: s,
          coreIntent: normalizedIntent
        });
      case "EVENTO":
        return createManifest("PLAUSIBLE_PARTICIPATION_SCENE", {
          activation: "Evocazione della partecipazione tramite focus su elementi iconici dell'evento.",
          forbidden: ["Folle cinematiche inventate", "Narrazioni POV complesse"],
          mandatory: ["Atterraggio semantico sull'evento", "Coerenza informativa"],
          dominance: "EVENTO",
          sourceType: s,
          coreIntent: normalizedIntent
        });
      case "AMBIENTE":
        return createManifest("NATURAL_MINIMAL_ACTIVATION", {
          activation: "Cambiamenti di luce naturale, micro-vibrazioni atmosferiche, focus su profondità.",
          forbidden: ["Aggiunta di fauna o elementi estranei", "Timelapse forzati"],
          mandatory: ["Rispetto della composizione originale", "Atmosfera neutra"],
          dominance: "AMBIENTE",
          sourceType: s,
          coreIntent: normalizedIntent
        });
      case "INFORMATIVO":
      default:
        return createManifest("EDITORIAL_REVEAL", {
          activation: "Svelamento materico del supporto (carta, inchiostro), focus sul testo o grafica.",
          forbidden: ["Trasformazioni in live action", "Attivazione di soggetti inanimati"],
          mandatory: ["Leggibilità", "Rispetto del layout grafico"],
          dominance: "INFORMATIVO",
          sourceType: s,
          coreIntent: normalizedIntent
        });
    }
  }

  // VIDEO / WEAK VIDEO ROUTING
  const isWeak = normalizedSource === "WEAK_VIDEO";
  
  switch (normalizedIntent) {
    case "PERFORMANCE":
      return createManifest("REAL_HUMAN_BEHAVIOR_AND_PERFORMANCE", {
        activation: isWeak ? "Micro-movimento fluido e reazione autentica." : "Performance, escalation emotiva, reazione o azione scenica (comedy, recitazione, coreografia).",
        forbidden: ["Allucinazioni fisiche", "De-sincronizzazione labiale"],
        mandatory: ["Coerenza del carattere", "Human signal dominante", "Aderenza al genere (es. comedy, drama)"],
        dominance: "PERSONA",
        sourceType: s,
        coreIntent: normalizedIntent
      });
    case "REAL_EVENT":
      return createManifest("REAL_HUMAN_EVENT_LOGIC", {
        activation: isWeak ? "Micro-movimento fluido e partecipazione." : "Escalation emotiva e payoff d'azione interattiva.",
        forbidden: ["Allucinazioni fisiche", "De-sincronizzazione labiale"],
        mandatory: ["Coerenza con l'evento", "Partecipazione organica"],
        dominance: "EVENTO",
        sourceType: s,
        coreIntent: normalizedIntent
      });
    case "PERSONA":
      return createManifest("REAL_HUMAN_PRESENCE", {
        activation: isWeak ? "Micro-reazione facciale e mantenimento contatto." : "Storytelling verbale, dialogo, reazione organica pacata.",
        forbidden: ["Azione fisica forzata fuori contesto", "Allucinazioni massive"],
        mandatory: ["Dominanza volto/human signal", "Tono colloquiale organico"],
        dominance: "PERSONA",
        sourceType: s,
        coreIntent: normalizedIntent
      });
    case "PRODOTTO":
      return createManifest("DEMO_REVEAL_USE", {
        activation: "Dimostrazione d'uso, svelamento delle caratteristiche, interazione fisica.",
        forbidden: ["Abstractismo eccessivo", "Fisica impossibile"],
        mandatory: ["Chiarificazione dell'utilità", "Focus sul prodotto"],
        dominance: "PRODOTTO",
        sourceType: s,
        coreIntent: normalizedIntent
      });
    case "EVENTO":
      return createManifest("ESCALATION_ACTION_PAYOFF", {
        activation: "Sviluppo dell'azione legata all'evento, progressione della partecipazione.",
        forbidden: ["Disconnessione dal luogo", "Elementi fuori contesto"],
        mandatory: ["Energia dell'evento", "Progressione narrativa"],
        dominance: "EVENTO",
        sourceType: s,
        coreIntent: normalizedIntent
      });
    case "AMBIENTE":
      return createManifest("OBSERVED_NATURAL_DYNAMICS", {
        activation: "Dinamiche naturali osservate, evoluzione atmosferica, esplorazione spaziale.",
        forbidden: ["Interventi umani invasivi", "Narrativa forzata"],
        mandatory: ["Rispetto della composizione originale", "Atmosfera neutra"],
        dominance: "AMBIENTE",
        sourceType: s,
        coreIntent: normalizedIntent
      });
    default:
      return createManifest("LEGACY_DEFAULT", {
        activation: "Trasformazione standard coerente con l'intent.",
        forbidden: [],
        mandatory: [],
        dominance: "ALTRO",
        sourceType: s,
        coreIntent: normalizedIntent
      });
  }
}

function normalizeSourceType(sourceType: string): RoutingSourceType {
  const s = (sourceType || "").toUpperCase();
  if (s === "STATIC_IMAGE" || s === "POSTER" || s === "FLYER" || s === "STATIC") return "STATIC";
  if (s === "INFORMATIONAL" || s === "GRAPHIC" || s === "DOCUMENT") return "INFORMATIONAL";
  if (s === "WEAK_VIDEO" || s === "QUASI_STATIC") return "WEAK_VIDEO";
  return "VIDEO";
}

function createManifest(
  strategy: StrategicStrategy, 
  details: { activation: string, forbidden: string[], mandatory: string[], dominance: string, sourceType: string, coreIntent: string }
): StrategicManifest {
  return {
    strategy,
    sourceType: details.sourceType,
    coreIntent: details.coreIntent,
    primaryActivation: details.activation,
    forbiddenDynamics: details.forbidden,
    mandatoryElements: details.mandatory,
    intentDominance: details.dominance
  };
}
