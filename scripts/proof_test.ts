
import { analyzeContent } from '../src/services/gemini/analysis';
import { getExternalMarketSignals } from '../src/services/youtubeService';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

async function runTest(name: string, description: string) {
  console.log(`\n=== TEST CASE: ${name} ===`);
  console.log(`Input: ${description}`);
  
  try {
    const analysis = await analyzeContent(description, apiKey);
    console.log(`Detected Genre: ${analysis.detectedGenre}`);
    console.log(`Confidence: ${analysis.genreConfidence}`);
    
    // Extracting facts vs interpretation from verifiableIntelligence if available
    if (analysis.verifiableIntelligence) {
      console.log(`Observed Facts: ${JSON.stringify(analysis.verifiableIntelligence.observedFacts)}`);
      console.log(`Inferences (Interpretation): ${JSON.stringify(analysis.verifiableIntelligence.inferences)}`);
    }

    const confidenceValue = parseInt(analysis.genreConfidence?.replace('%', '') || '0');
    if (confidenceValue < 80) {
      console.log(`Status: Genre usage BLOCKED (Confidence < 80%)`);
    } else {
      console.log(`Status: Genre usage ALLOWED (Confidence >= 80%)`);
    }

    console.log(`\n--- YouTube Validation ---`);
    const marketSignals = await getExternalMarketSignals(description, apiKey!);
    console.log(`Market Summary: ${marketSignals.marketSummary}`);
    console.log(`Data Status: ${marketSignals.dataStatus}`);
    
    if (marketSignals.comparableVideos && marketSignals.comparableVideos.length > 0) {
      console.log(`Accepted Comparables:`);
      marketSignals.comparableVideos.forEach(v => console.log(` - ${v.title} (${v.videoLink})`));
    } else {
      console.log(`No comparables accepted (Market Validation Filtered them out).`);
    }

  } catch (error) {
    console.error(`Error in test ${name}:`, error);
  }
}

async function main() {
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing in .env");
    return;
  }

  await runTest("Ma Baker", "A video showing a group of people performing a high-energy dance routine to the song 'Ma Baker' by Boney M. The setting looks like a 1970s TV studio with colorful lights and retro costumes. The music has a strong disco beat.");
  
  await runTest("Clip Soul Vintage", "A vintage black and white clip of a soul singer performing with a live band. The singer has a powerful, emotive voice. The music features a brass section, a steady rhythm, and soulful backing vocals. It's from the late 60s.");
  
  await runTest("Sketch con Musica", "A comedy sketch where two people are arguing in a restaurant. In the background, there is some light jazz music playing quietly. The focus is entirely on the dialogue and the funny situation.");
  
  await runTest("Live Retro TV", "A live performance from a 1960s variety TV show. The host introduces a musical act. The set is a typical TV stage of that era, not a dark nightclub. The audience is seated in a studio setting.");
}

main();
