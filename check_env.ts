
const keysToCheck = [
  'GROQ_API_KEY',
  'GROQ_API_KEY_2',
  'GROQ_API_KEY_3',
  'OPENROUTER_API_KEY',
  'OPENROUTER_API_KEY_2',
  'YOUTUBE_API_KEY',
  'GEMINI_API_KEY',
  'HUGGINGFACE_TOKEN',
  'HF_TOKEN'
];

console.log('--- SECRET INVENTORY ---');
keysToCheck.forEach(key => {
  const value = process.env[key];
  if (value && value.trim() !== '') {
    console.log(`${key}: PRESENT`);
  } else {
    console.log(`${key}: MISSING`);
  }
});

// Check if any other keys starting with VITE_ are present (optional check but user asked for any other)
Object.keys(process.env).forEach(key => {
  if (key.includes('API_KEY') || key.includes('TOKEN')) {
      if (!keysToCheck.includes(key)) {
           const value = process.env[key];
           if (value && value.trim() !== '') {
               console.log(`${key}: PRESENT (Other)`);
           }
      }
  }
});
