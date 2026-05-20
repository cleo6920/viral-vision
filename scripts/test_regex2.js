const sanitizePrompt = (text) => {
  if (!text) return '';
  
  let cleaned = text;
  
  const extractRegex = /(?:\*\*Prompt:\*\*|\*\*Prompt\*\*|\nPrompt:|^Prompt:|\n> \*\*Prompt:\*\*|^> \*\*Prompt:\*\*|\n> Prompt:|^> Prompt:)\s*([\s\S]*?)(?=\n\n###|\n\n---|Option \d+|\n\n\*\*Key|\n\n\*\*Notes|$)/i;
  const match = cleaned.match(extractRegex);
  
  if (match && match[1]) {
    cleaned = match[1];
  } else {
    const startOfPrompt = cleaned.search(/(?:A cinematic|Cinematic|Shot on|Medium shot|Close up|Wide shot|A detailed|A realistic|A hyper-realistic|Camera starts|The scene opens)/i);
    if (startOfPrompt > 30) {
      cleaned = cleaned.substring(startOfPrompt);
    }
  }

  const trailingRegex = /\n\n(?:###|---|Option \d+|Key|Notes|Analysis|Optimization|Tactics|Sora|Suggested|Viral|Enhancements|Execution|Why this works)/i;
  const trailingIndex = cleaned.search(trailingRegex);
  if (trailingIndex !== -1) {
    cleaned = cleaned.substring(0, trailingIndex);
  }

  cleaned = cleaned
    .replace(/^(Ecco|Here is|Here are|Per ottimizzare|To optimize|To push|The goal|Option \d+|Sora 2\.0 Master Prompt|Why these prompts|This prompt|In this optimized|The following).*?[:\s-]*/im, '')
    .replace(/<(?!original_script|director_script|\/original_script|\/director_script)[^>]*>/g, '') 
    .replace(/^>\s*/gm, '') 
    .replace(/### .*?\n/g, '') 
    .replace(/\*\*Prompt:\*\*/gi, '') 
    .replace(/\*\*/g, '') 
    .replace(/---[\s\S]*$/g, '') 
    .trim();
    
  if (cleaned.toLowerCase().startsWith('to optimize') || cleaned.toLowerCase().startsWith('here is') || cleaned.toLowerCase().startsWith('this prompt')) {
     const paragraphs = cleaned.split('\n\n');
     for (const p of paragraphs) {
        if (p.match(/(?:A cinematic|Cinematic|Shot on|Medium shot|Close up|Wide shot|A detailed|A realistic|A hyper-realistic|Camera starts|The scene opens)/i)) {
            cleaned = p;
            break;
        }
     }
  }

  return cleaned.trim();
};

const text = `To optimize for a "Sora 2.0" level model...

### Option 1
> **Prompt:** A cinematic shot... <original_script>Officer: "License please."</original_script>

### Analysis
...`;

console.log("Cleaned:", sanitizePrompt(text));
