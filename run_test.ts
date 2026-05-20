import { findBlueOceanNiches } from './src/services/gemini/analysis.ts';
import { generateWizardHooks } from './src/services/gemini/hooks.ts';
import dotenv from 'dotenv';
dotenv.config();

// Since AI studio agent environment does not have process.env.VITE_ prefixed injected unless in Vite, let's proxy it:
if (process.env.GROQ_API_KEY) {
  process.env.VITE_GROQ_API_KEY = process.env.GROQ_API_KEY;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    location: { hostname: 'localhost' },
    localStorage: {
      getItem: () => null,
      setItem: () => null
    }
  };
}

const tests = [
  { goal: "barzelletta sui carabinieri", cast: "carabinieri", genre: "Comedy" }
];

async function run() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  for (const t of tests) {
    console.log(`\n\n--- TEST: ${t.goal} ---`);
    try {
      console.log("-> Testing findBlueOceanNiches");
      const ideas = await findBlueOceanNiches([], t.goal, t.cast, apiKey, t.genre, 'flash');
      console.log("step2_ideaEngine presente: ", !!ideas.step2_ideaEngine);
      console.log("Ideas in step2_ideaEngine:", Object.keys(ideas.step2_ideaEngine || {}).length);
    } catch (e: any) {
      console.log("-> findBlueOceanNiches Errore:", e.message);
    }
    try {
      console.log("-> Testing generateWizardHooks");
      const hooks = await generateWizardHooks(t.genre, t.goal, apiKey, 'flash');
      console.log("Hooks generate:", hooks.length);
      console.log("Hooks sample:", hooks);
    } catch (e: any) {
      console.log("-> generateWizardHooks Errore:", e.message);
    }
  }
}
run();
