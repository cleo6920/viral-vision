import { GoogleGenAI, Type } from "@google/genai";
import { ResultData, ResultData as ViralAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeVideo(videoBase64: string, mimeType: string): Promise<any> {
  const model = "gemini-flash-latest";
  
  const systemInstruction = `You are a world-class social media strategist and viral content consultant. 
Your goal is to analyze the provided video and give actionable feedback to make it go viral. 
Focus on:
1. High-engagement HOOKS (the first 3 seconds).
2. Trending topics related to the content.
3. Pacing and editing quality.
4. Suggested captions for Instagram, TikTok, and YouTube Shorts.
5. "Viral Prompts" - modified prompts the user can use to re-generate or improve similar content with AI.

Return the result strictly as a JSON object matching the following schema:
{
  "hooks": [{"text": "string", "description": "string"}],
  "trendingTopics": ["string"],
  "pacingScore": number (0-100),
  "pacingFeedback": "string",
  "suggestedCaptions": ["string"],
  "viralPrompts": ["string"]
}`;

  const promptPart = {
    text: "Analyze this video and provide viral growth insights based on the system instructions.",
  };

  const videoPart = {
    inlineData: {
      data: videoBase64,
      mimeType: mimeType,
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [videoPart, promptPart] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["hooks", "trendingTopics", "pacingScore", "pacingFeedback", "suggestedCaptions", "viralPrompts"],
          properties: {
            hooks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            trendingTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            pacingScore: { type: Type.NUMBER },
            pacingFeedback: { type: Type.STRING },
            suggestedCaptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            viralPrompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI");
    
    return JSON.parse(resultText) as ViralAnalysis;
  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error;
  }
}
