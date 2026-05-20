import { getAI, selectModel, executeWithNetworkRetry, getBypassedWord } from './core';
import { logger } from '../../utils/logger';
import { safeParseJSON } from '../../utils/json';
import { ModelUsageTrace } from '../../types';

function coercePromptText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => coercePromptText(item))
      .filter(Boolean)
      .join(" ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const findDangerousWords = (text: string): string[] => {
  const dangerousWords = [
    "Secondary Subject", "Main Subject", "terence", "bud", "hill", "spencer", "nintendo", "mario", "zelda", "pokemon", "disney", "marvel", "star wars",
    "batman", "superman", "spiderman", "iron man", "avengers", "harry potter", "lord of the rings",
    "game of thrones", "stranger things", "netflix", "apple", "iphone", "macbook", "microsoft", "xbox",
    "playstation", "sony", "nike", "adidas", "puma", "gucci", "prada", "louis vuitton", "ferrari", "lamborghini",
    "porsche", "rolex", "mcdonalds", "coca cola", "pepsi", "red bull", "monster energy", "gta", "grand theft auto",
    "call of duty", "fortnite", "minecraft", "roblox", "lego", "barbie", "hot wheels", "transformers",
    "jurassic park", "matrix", "terminator", "alien", "predator", "godzilla", "king kong", "james bond",
    "indiana jones", "rocky", "rambo", "minions", "shrek", "toy story", "finding nemo", "lion king", "frozen",
    "mickey mouse", "donald duck", "bugs bunny", "spongebob", "simpsons", "family guy", "south park",
    "rick and morty", "breaking bad", "walking dead", "squid game", "peaky blinders", "friends", "office",
    "seinfeld", "big bang theory", "how i met your mother", "brooklyn 99", "stranger things", "witcher",
    "mandalorian", "baby yoda", "darth vader", "luke skywalker", "yoda", "chewbacca", "han solo", "princess leia",
    "obi wan", "anakin", "kylo ren", "rey", "finn", "poe", "bb8", "r2d2", "c3po", "stormtrooper", "jedi", "sith",
    "lightsaber", "death star", "millennium falcon", "x-wing", "tie fighter", "hogwarts", "gryffindor",
    "slytherin", "hufflepuff", "ravenclaw", "dumbledore", "voldemort", "snape", "hermione", "ron", "hagrid",
    "dobby", "gollum", "frodo", "sam", "gandalf", "aragorn", "legolas", "gimli", "boromir", "sauron", "saruman",
    "orc", "hobbit", "elf", "dwarf", "ring", "mordor", "shire", "rivendell", "gondor", "rohan", "iron throne",
    "targaryen", "stark", "lannister", "baratheon", "greyjoy", "tyrell", "martell", "tully", "arryn", "snow",
    "daenerys", "jon", "tyrion", "cersei", "jaime", "arya", "sansa", "bran", "robb", "ned", "catelyn", "joffrey",
    "ramsay", "theon", "brienne", "hound", "mountain", "varys", "littlefinger", "melisandre", "davos", "samwell",
    "gilly", "tormund", "ygritte", "margaery", "olenna", "loras", "renly", "stannis", "shireen", "selyse",
    "robert", "tommen", "myrcella", "viserys", "khal drogo", "jorah", "barristan", "grey worm", "missandei",
    "daario", "jaqen", "waif", "high sparrow", "mance", "craster", "gilly", "illyrio", "xaro", "pyat", "kraznys",
    "yunkai", "meereen", "astapor", "qarth", "braavos", "pentos", "volantis", "valyria", "westeros", "essos",
    "sothoryos", "ulthos", "asshai", "yi ti", "leng", "ibben", "summer isles", "naath", "basilisk isles",
    "stepstones", "iron islands", "north", "riverlands", "vale", "westerlands", "crownlands", "stormlands",
    "reach", "dorne", "wall", "beyond the wall", "kings landing", "winterfell", "eyrie", "riverrun", "casterly rock",
    "harrenhal", "dragonstone", "storms end", "highgarden", "sunspear", "pyke", "oldtown", "white harbor",
    "gulltown", "lannisport", "braavos", "pentos", "volantis", "qohor", "norvos", "lorath", "myr", "tyrosh",
    "lys", "volantis", "valyria", "gogossos", "zamettar", "yosh", "asshai", "yi ti", "leng", "ibben", "summer isles",
    "naath", "basilisk isles", "stepstones", "iron islands", "north", "riverlands", "vale", "westerlands",
    "crownlands", "stormlands", "reach", "dorne", "wall", "beyond the wall", "kings landing", "winterfell",
    "eyrie", "riverrun", "casterly rock", "harrenhal", "dragonstone", "storms end", "highgarden", "sunspear",
    "pyke", "oldtown", "white harbor", "gulltown", "lannisport", "braavos", "pentos", "volantis", "qohor",
    "norvos", "lorath", "myr", "tyrosh", "lys", "volantis", "valyria", "gogossos", "zamettar", "yosh", "asshai",
    "yi ti", "leng", "ibben", "summer isles", "naath", "basilisk isles", "stepstones", "iron islands", "north",
    "riverlands", "vale", "westerlands", "crownlands", "stormlands", "reach", "dorne", "wall", "beyond the wall",
    "kings landing", "winterfell", "eyrie", "riverrun", "casterly rock", "harrenhal", "dragonstone", "storms end",
    "highgarden", "sunspear", "pyke", "oldtown", "white harbor", "gulltown", "lannisport", "braavos", "pentos",
    "volantis", "qohor", "norvos", "lorath", "myr", "tyrosh", "lys", "volantis", "valyria", "gogossos", "zamettar",
    "yosh", "asshai", "yi ti", "leng", "ibben", "summer isles", "naath", "basilisk isles", "stepstones", "iron islands",
    "north", "riverlands", "vale", "westerlands", "crownlands", "stormlands", "reach", "dorne", "wall", "beyond the wall",
    "kings landing", "winterfell", "eyrie", "riverrun", "casterly rock", "harrenhal", "dragonstone", "storms end",
    "highgarden", "sunspear", "pyke", "oldtown", "white harbor", "gulltown", "lannisport", "braavos", "pentos",
    "volantis", "qohor", "norvos", "lorath", "myr", "tyrosh", "lys", "volantis", "valyria", "gogossos", "zamettar",
    "yosh", "asshai", "yi ti", "leng", "ibben", "summer isles", "naath", "basilisk isles", "stepstones", "iron islands",
    "north", "riverlands", "vale", "westerlands", "crownlands", "stormlands", "reach", "dorne", "wall", "beyond the wall",
    "kings landing", "winterfell", "eyrie", "riverrun", "casterly rock", "harrenhal", "dragonstone", "storms end",
    "highgarden", "sunspear", "pyke", "oldtown", "white harbor", "gulltown", "lannisport", "braavos", "pentos",
    "volantis", "qohor", "norvos", "lorath", "myr", "tyrosh", "lys", "volantis", "valyria", "gogossos", "zamettar",
    "yosh", "asshai", "yi ti", "leng", "ibben", "summer isles", "naath", "basilisk isles", "stepstones"
  ];
  
  const found: string[] = [];
  
  for (const word of dangerousWords) {
    // Escape special characters in word just in case
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
    if (regex.test(text)) {
      found.push(word);
    }
  }
  
  return [...new Set(found)];
};

export const detectDangerousWordsWithAI = async (
  text: string,
  apiKey?: string,
  modelTier: string = "flash",
  trace?: ModelUsageTrace,
): Promise<string[]> => {
  const { ai } = getAI(apiKey);
  const model = selectModel(
    modelTier,
    "flash",
    apiKey,
  );

  const prompt = `
    Analizza il seguente testo e identifica TUTTI i nomi propri di personaggi famosi (attori, cantanti, personaggi storici), brand registrati (aziende, prodotti commerciali), titoli di film, serie tv, videogiochi o canzoni protette da copyright.
    
    Testo:
    "${text}"
    
    Restituisci SOLO un array JSON di stringhe contenente le parole pericolose trovate. Se non ne trovi, restituisci [].
    Esempio output: ["Secondary Subject", "Main Subject", "Coca Cola", "Star Wars"]
  `;

  try {
    const response = await executeWithNetworkRetry(async (currentAi, dynamicModel) =>
        currentAi.models.generateContent({
        model: dynamicModel || model,
          contents: { parts: [{ text: prompt }] },
          config: { responseMimeType: "application/json" },
        }),
      2,
      undefined,
      180000,
      apiKey,
      undefined,
      model,
      trace,
      "Dangerous Words Detection",
      modelTier,
      false,
      'BANAL'
    );

    const result = safeParseJSON(response.text || "[]");
    return Array.isArray(result) ? result : [];
  } catch (err: any) {
    console.error("[Gemini] Errore in detectDangerousWordsWithAI:", err);
    return findDangerousWords(text);
  }
};

export const rewriteDangerousPrompt = async (
  promptText: string,
  apiKey?: string,
  trace?: ModelUsageTrace,
): Promise<string> => {
  logger.info("--- SAFETY LAYER: DANGEROUS WORDS DETECTION ---");
  const normalizedPromptText = coercePromptText(promptText);
  logger.info("ORIGINAL INPUT:", normalizedPromptText);

  let currentPrompt = normalizedPromptText;

  // Skip AI detection to save API rate limits (15 RPM on free tier).
  // Rely purely on the comprehensive static list `findDangerousWords`
  // const aiDetectedWords = await detectDangerousWordsWithAI(currentPrompt, apiKey);
  const staticDetectedWords = findDangerousWords(currentPrompt);
  const allDangerousWords = [...new Set([...staticDetectedWords])];

  if (allDangerousWords.length === 0) {
    logger.info("DANGEROUS WORDS DETECTED: None");
    logger.info("FINAL SANITIZED INPUT PASSED TO ANALYSIS:", currentPrompt);
    return currentPrompt;
  }

  logger.info("DANGEROUS WORDS DETECTED:", allDangerousWords.join(", "));
  console.log(
    `[Gemini] Trovate parole pericolose: ${allDangerousWords.join(", ")}. Avvio riscrittura...`,
  );

  const { ai } = getAI(apiKey);
  const model = selectModel("flash", "flash", apiKey);

  const rewritePrompt = `
    Sei un Esperto di Identikit Forense e Prompt Engineering.
    Il seguente prompt video contiene termini protetti da copyright o nomi di celebrità che causeranno il blocco della generazione AI.
    
    Termini da eliminare: ${allDangerousWords.join(", ")}
    
    Il tuo compito è riscrivere il prompt SOSTITUENDO questi termini con descrizioni fisiche iper-dettagliate (DNA Cinematografico) che evochino lo stesso soggetto senza nominarlo.
    
    REGOLE CRITICHE:
    1. NON USARE MAI i termini vietati o varianti simili.
    2. Usa descrizioni biometriche "Clone-Level" (es. invece di "Secondary Subject" usa "Lean build, piercing ice-blue eyes, sandy-blonde hair, agile movements").
    3. Mantieni intatto il resto del prompt (regia, luci, azioni, dialoghi).
    4. PRESERVA L'IDENTITÀ SEMANTICA: Se l'input originale riguarda una registrazione in studio di una band pop anni '70, il risultato DEVE descrivere chiaramente una band pop anni '70 in studio. NON degradare il contenuto in concetti generici o non correlati.
    5. Restituisci SOLO il prompt riscritto, senza introduzioni o spiegazioni.
    
    Prompt originale:
    "${currentPrompt}"
  `;

  try {
    const response = await executeWithNetworkRetry(async (currentAi, dynamicModel) =>
        currentAi.models.generateContent({
        model: dynamicModel || model,
          contents: { parts: [{ text: rewritePrompt }] },
        }),
      2,
      undefined,
      180000,
      apiKey,
      undefined,
      model,
      trace,
      "Safety Rewrite",
      "flash",
      false,
      'BANAL'
    );
    
    let rewritten = coercePromptText(response.text || currentPrompt);
    logger.info("REWRITTEN INPUT (AI):", rewritten);
    
    const stillDangerous = findDangerousWords(rewritten);
    if (stillDangerous.length > 0) {
      console.warn(`[Gemini] Rilevata pericolosità: ${stillDangerous.join(', ')}. Discarding content for full regeneration.`);
      return "[DISCARD]";
    }
    
    return rewritten;
  } catch (err: any) {
    console.error("[Gemini] Errore in rewriteDangerousPrompt:", err);
    // Explicitly return [DISCARD] to trigger regeneration on error, 
    // rather than falling back to potentially broken static patches.
    return "[DISCARD]";
  }
};

export const forceTextInPrompt = async (
  promptText: string,
  apiKey?: string,
  modelTier: string = "flash",
  trace?: ModelUsageTrace,
): Promise<string> => {
  const normalizedPromptText = coercePromptText(promptText);
  const { ai } = getAI(apiKey);
  // Always use flash for this trivial task to save Pro quota
  const model = selectModel("flash", "flash", apiKey);

  const prompt = `
    Sei un Esperto di Prompt Engineering per Video AI.
    Il seguente prompt video contiene un titolo, una frase o un testo che l'utente vuole far apparire in sovraimpressione.
    
    Il tuo compito è:
    1. Identificare quale testo l'utente vuole mostrare a schermo (se presente nel prompt).
    2. Se c'è un testo da mostrare, aggiungi all'inizio del prompt questa esatta istruzione (sostituendo "IL_TESTO_QUI" con il testo identificato):
       "MASSIVE BOLD TEXT OVERLAY reading "IL_TESTO_QUI" from 0.0s to 1.5s. Yellowed 1970s Bold Typography, 15% opacity drop-shadow, with an analog jitter effect, appearing as a physical layer of the film stock. "
    3. Se non trovi nessun testo evidente da mostrare, inventa un titolo d'impatto (massimo 3-4 parole) basato sul contenuto del video e usa quello.
    4. Rimuovi eventuali altre istruzioni di testo in sovraimpressione dal prompt originale per evitare conflitti.
    5. Restituisci SOLO il prompt finale modificato, senza altre spiegazioni o formattazioni markdown.
    
    Prompt originale:
    "${normalizedPromptText}"
  `;

  try {
    const response = await executeWithNetworkRetry(async (currentAi, dynamicModel) =>
        currentAi.models.generateContent({
        model: dynamicModel || model,
          contents: { parts: [{ text: prompt }] },
        }),
      2,
      undefined,
      180000,
      apiKey,
      undefined,
      model,
      trace,
      "Force Text In Prompt",
      "flash",
      false,
      'BANAL'
    );
    
    let rewritten = coercePromptText(response.text || normalizedPromptText);
    // Remove markdown code blocks if present
    rewritten = rewritten.replace(/^```[\s\S]*?\n/g, '').replace(/```$/g, '').trim();
    return rewritten;
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('QUOTA_EXHAUSTED')) {
      logger.error("[Gemini] forceTextInPrompt: Hard fail due to Auth/Quota. Bubbling up.");
      throw err;
    }
    logger.warn(`[Gemini] Notice in forceTextInPrompt: ${errorMsg}. Using original prompt as fallback.`);
    return normalizedPromptText;
  }
};

export const purifyPromptAntiEmoji = (prompt: string, apiKey?: string, modelTier?: string): string => {
  const normalizedPrompt = coercePromptText(prompt);
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{2B05}\u{2B06}\u{2B07}\u{2194}\u{2195}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FC}\u{25FB}\u{2B1B}\u{2B1C}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}\u{1F251}\u{3297}\u{3299}\u{23F0}\u{23F3}\u{231A}\u{231B}\u{25B6}\u{23E9}-\u{23EC}\u{23F8}-\u{23FA}\u{23EB}\u{23EA}\u{23ED}\u{23EE}\u{23EF}\u{23F1}\u{23F2}\u{23F4}-\u{23F7}\u{23F8}\u{23F9}\u{23FA}\u{23FB}\u{23FC}\u{23FD}\u{23FE}\u{23FF}\u{24C2}\u{1F550}-\u{1F567}\u{2614}\u{2615}\u{2648}-\u{2653}\u{26CE}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}\u{2935}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;
  return normalizedPrompt.replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim();
};
