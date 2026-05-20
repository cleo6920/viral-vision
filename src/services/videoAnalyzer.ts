import { VideoAnalysisResult } from "../types";
import { generateVideoPrompt } from "./gemini/generation";

export async function extractFrames(file: File, numFrames: number = 5): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const interval = duration / (numFrames + 1);
      const frames: string[] = [];
      let currentFrame = 0;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const captureFrame = () => {
        if (currentFrame >= numFrames) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }

        const time = interval * (currentFrame + 1);
        video.currentTime = time;
      };

      video.onseeked = () => {
        if (!ctx) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get data URL
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        frames.push(dataUrl);
        
        currentFrame++;
        captureFrame();
      };

      video.onerror = (e) => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Error loading video for frame extraction"));
      };

      captureFrame();
    };
  });
}

export async function analyzeVideo(file: File, onProgress?: (msg: string) => void): Promise<VideoAnalysisResult> {
  if (onProgress) onProgress("Extracting key frames from video...");
  
  let frames: string[] = [];
  try {
    frames = await extractFrames(file, 6);
  } catch (e) {
    console.error("Frame extraction failed:", e);
    throw new Error("Failed to extract frames from the video.");
  }

  if (onProgress) onProgress("Analyzing video content, structure, and viral potential...");

  // Use the modular generation service
  const result = await generateVideoPrompt(
    file,
    file.type,
    "", // No extra text input
    false, // useBypass
    "general", // niche
    "general", // genre
    "TikTok", // platform
    [], // feedbackHistory
    true, // algoCuriosity
    { start: 0, end: 0 }, // videoRange
    true, // isDeepAnalysis
    false, // isEscalation
    false, // spinOffMode
    true, // viralBoost50k
    'generate', // mode
    'pro', // modelTier
    false, // isFidelityMode
    process.env.GEMINI_API_KEY || '',
    undefined, // musicalType
    undefined, // preferredSinger
    undefined, // pomelli
    undefined, // pensaciTuGoal
    onProgress,
    frames
  );

  return result as VideoAnalysisResult;
}
