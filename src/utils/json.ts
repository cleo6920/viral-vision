export const safeParseJSON = <T = any>(json: string, fallback: T | null = null): T | null => {
  if (!json) return fallback;
  try {
    // Remove potential markdown code blocks
    const cleanJson = json.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error('JSON Parse Error:', e, 'Raw string:', json);
    return fallback;
  }
};
