export const MAX_CANVAS_HEIGHT = 600;
export const BRUSH_COLOR = 'rgba(239, 68, 68, 0.5)'; // Red with opacity
export const BRUSH_STROKE_WIDTH = 20;
export const RECT_FILL_COLOR = 'rgba(239, 68, 68, 0.5)';

export const GEMINI_MODEL_VISION = 'gemini-2.0-flash';

export const getFramesToExtract = (modelTier: string, isDeepAnalysis: boolean): number => {
    if (modelTier === 'test') return 5;
    if (modelTier === 'pro') return isDeepAnalysis ? 40 : 20;
    return isDeepAnalysis ? 20 : 10;
};
