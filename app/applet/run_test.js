function applyLocalHierarchyValidation(plan, coreIntent) {
    const severeErrors = [];
    if (!plan) return { plan, severeErrors: ["Plan is null"] };
    if (!plan.secondaryElements) plan.secondaryElements = [];
    if (!plan.tertiaryElements) plan.tertiaryElements = [];
    if (!plan.effectElements) plan.effectElements = [];
    if (!plan.hookCandidates) plan.hookCandidates = [];

    const genericSubjects = ["soggetto non identificato", "persona", "oggetto", "uomo", "donna"];
    if (coreIntent !== "INFORMATIVO" && plan.primarySubject && genericSubjects.includes(plan.primarySubject.toLowerCase().trim())) {
        severeErrors.push(`primarySubject troppo generico: ${plan.primarySubject}`);
    }

    const effectKeywords = ["vapore", "luce", "luci", "fumo", "riflesso", "ombra", "sole", "caldo", "freddo"];
    const newSecondary = [];
    for (const el of plan.secondaryElements) {
        let isEffect = false;
        for (const kw of effectKeywords) {
            if (typeof el === 'string' && el.toLowerCase().includes(kw)) {
                if (!plan.effectElements.includes(el)) plan.effectElements.push(el);
                isEffect = true;
                break;
            }
        }
        if (!isEffect) {
            newSecondary.push(el);
        }
    }
    plan.secondaryElements = newSecondary;

    const dedupedSecondary = [];
    const seenSecondary = new Set();
    for (const el of plan.secondaryElements) {
      if (typeof el === 'string') {
        const lower = el.toLowerCase().trim();
        if (!seenSecondary.has(lower)) {
          seenSecondary.add(lower);
          dedupedSecondary.push(el);
        }
      }
    }
    plan.secondaryElements = dedupedSecondary;
    
    // 3. Action Core extraction and isolation (BEFORE truncation)
    const actionRegex = /\b[A-Za-z]+(are|ere|ire|arsi|ersi|irsi)\b/i;
    const actionKeyword = /azione|movimento/i;
    
    const cleanSecondary = [];
    for (const e of plan.secondaryElements) {
        if (typeof e === 'string' && (actionRegex.test(e) || actionKeyword.test(e))) {
            if (!plan.actionCore) {
                plan.actionCore = e;
            }
            // Do NOT push to cleanSecondary to completely remove it from secondaryElements
        } else {
            cleanSecondary.push(e);
        }
    }
    plan.secondaryElements = cleanSecondary;

    if (plan.actionCore) {
        plan.tertiaryElements = plan.tertiaryElements.filter((e) => e.toLowerCase() !== plan.actionCore.toLowerCase());
    } else if (coreIntent === "PERSONA") {
        severeErrors.push("actionCore mancante o non rilevato per un intento PERSONA.");
    }

    if (plan.secondaryElements.length > 2) {
        const overflow = plan.secondaryElements.slice(2);
        plan.secondaryElements = plan.secondaryElements.slice(0, 2);
        plan.tertiaryElements.push(...overflow);
    }

    const badHookRegex = /(macro|dettaglio|texture)/i;
    const originalHooksLength = plan.hookCandidates.length;
    plan.hookCandidates = plan.hookCandidates.filter((hook) => !badHookRegex.test(hook));
    if (originalHooksLength > 0 && plan.hookCandidates.length === 0) {
        plan.hookCandidates = ["Sguardo intenzionale o gesto di presenza umana"];
    }

    const genericPurposes = ["atmosphere", "mood", "aesthetic", "atmosfera", "human_presence", "human presence", "estetica"];
    if (plan.dominantPurpose && genericPurposes.includes(plan.dominantPurpose.toLowerCase().trim())) {
        if (coreIntent === "PERSONA") plan.dominantPurpose = "character_study";
        else if (coreIntent === "PRODOTTO") plan.dominantPurpose = "product_showcase";
        else plan.dominantPurpose = "context_establishment";
    }

    return { plan, severeErrors };
}
const caso2 = {
  primarySubject: "Soggetto umano reale",
  secondaryElements: ["rete azzurra", "riparare la rete", "sole al tramonto", "rete azzurra", "barche di legno", "banchina antica"],
  tertiaryElements: [],
  dominantPurpose: "human presence",
  hookCandidates: ["dettaglio delle mani nodose", "texture dell'intreccio"]
};

console.log("1. Payload prima del validator:");
console.log(JSON.stringify(caso2, null, 2));

const res2 = applyLocalHierarchyValidation(JSON.parse(JSON.stringify(caso2)), "PERSONA");
console.log("\n2. Payload dopo il validator:");
console.log(JSON.stringify(res2.plan, null, 2));
console.log("\n3. SEVERE ERRORS:");
console.log(res2.severeErrors.length > 0 ? res2.severeErrors : "None");
