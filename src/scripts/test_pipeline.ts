
import { 
  runContentHierarchyReasoner 
} from '../services/gemini/generation';
import {
  runPrimaryPurposeLock, 
  runFunctionalRoleLock, 
  runIdeaAnchorLock, 
  runFinalViralAnalysis 
} from '../services/gemini/analysis';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';

async function runTest(testName: string, visualDescription: string, genre: string) {
  console.log(`\n=== TEST: ${testName} ===`);
  console.log(`Description: ${visualDescription}`);

  try {
    const parts = [{ text: visualDescription }];
    
    console.log("1. Content Hierarchy Reasoning...");
    const contentHierarchy = await runContentHierarchyReasoner(parts, apiKey);
    console.log("Hierarchy:", JSON.stringify(contentHierarchy, null, 2));

    console.log("2. Primary Purpose Lock...");
    const primaryPurposeLock = await runPrimaryPurposeLock(apiKey, contentHierarchy);
    console.log("Purpose Lock:", JSON.stringify(primaryPurposeLock, null, 2));

    console.log("3. Functional Role Lock...");
    const functionalRoleLock = await runFunctionalRoleLock(apiKey, contentHierarchy, primaryPurposeLock);
    console.log("Functional Lock:", JSON.stringify(functionalRoleLock, null, 2));

    console.log("4. Idea Anchor Lock...");
    const ideaAnchorLock = await runIdeaAnchorLock(apiKey, contentHierarchy, primaryPurposeLock, functionalRoleLock);
    console.log("Idea Anchor:", JSON.stringify(ideaAnchorLock, null, 2));

    console.log("5. Final Production...");
    const result = await runFinalViralAnalysis(
      { prompt: visualDescription }, 
      apiKey, 
      genre, 
      'flash', 
      undefined, 
      undefined, 
      undefined, 
      contentHierarchy, 
      primaryPurposeLock, 
      functionalRoleLock, 
      ideaAnchorLock
    );

    console.log("\n--- FINAL OUTPUT ---");
    console.log("Script:", result.script);
    console.log("Title (IT):", result.pubTitleIt);
    console.log("Hook:", result.pubVideoHookIt || result.hook);
    console.log("Selected Event:", result.selectedEvent);
    console.log("Dominance Check:", JSON.stringify(result.dominanceCheck, null, 2));
    
    return result;
  } catch (error) {
    console.error(`Test ${testName} failed:`, error);
  }
}

async function main() {
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }

  // TEST 1: EVENTO REALE (Simile Busatello)
  // Scenario: Un documentario naturalistico su un raro intreccio di canne, ma con delle strane piume blu elettrico (accessorio) lasciate da un uccello migratore.
  await runTest(
    "EVENTO REALE (CANNETO)", 
    "Video di un canneto millenario mosso dal vento in una riserva naturale. In primo piano su un ramo ci sono delle piume blu elettrico artificiali (accessorio curioso). L'obiettivo è mostrare la biodiversità del luogo.",
    "documentary"
  );

  // TEST 2: PRODOTTO (TONNO)
  // Scenario: Una lattina di tonno su un tavolo rustico, con un gatto che miagola in sottofondo e un raggio di sole che illumina la polvere (scenico).
  await runTest(
    "PRODOTTO (TONNO)",
    "Una lattina di tonno aperta su un tagliere di legno. In sottofondo un gatto guarda incuriosito. La luce del tramonto evidenzia le particelle di polvere che danzano nell'aria. Il prodotto deve essere il re della scena.",
    "commercial"
  );

  // TEST 3: PERSONA
  // Scenario: Un artigiano che lavora, ma indossa un orologio d'oro gigante (accessorio visivo).
  await runTest(
    "PERSONA (ARTIGIANO)",
    "Un anziano artigiano che incide il legno con pazienza. Indossa un orologio d'oro molto vistoso che brilla ad ogni movimento della mano. Il focus deve restare sulla sua maestria e sul volto espressivo.",
    "biography"
  );
}

main();
