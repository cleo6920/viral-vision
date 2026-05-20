import { GoogleGenAI } from '@google/genai';
try {
  const ai = new GoogleGenAI({ apiKey: '' });
  ai.models.generateContent({ model: 'gemini-2.0-flash', contents: 'Hello' }).then(() => console.log('success')).catch(e => console.log('ERROR:', e.message));
} catch (e) {
  console.log('INIT ERROR:', e.message);
}
