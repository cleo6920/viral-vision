import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will not work.");
}

export const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const VIRAL_ANALYSIS_PROMPT = `
Sei un esperto di social media marketing e ingegnere dei prompt. 
Analizza questo video e fornisci:
1. **Analisi del Gancio (Hook)**: Com'è l'inizio? È efficace?
2. **Punti di Forza**: Cosa rende questo video potenzialmente virale?
3. **Aree di Miglioramento**: Cosa potrebbe essere ottimizzato?
4. **Prompt Virali**: Genera 3 prompt specifici per strumenti di IA (come Midjourney, Runway, o lo stesso Gemini) per creare contenuti simili o complementari che seguano il trend.
5. **Strategia di Pubblicazione**: Orari, hashtag e caption suggerite.

Rispondi in formato Markdown professionale ma energico.
`;
